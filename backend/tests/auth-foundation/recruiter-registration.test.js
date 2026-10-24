import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseRepository } from '../../src/repositories/base.repository.js';
import { CompanyRepository, DepartmentRepository, RecruiterRepository } from '../../src/repositories/organization.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { CandidateRepository } from '../../src/repositories/candidate.repository.js';
import { AuthService, AuthServiceError } from '../../src/services/auth.service.js';
import { CouchDbError } from '../../src/services/couchdb.errors.js';
import { companyDocumentSchema } from '../../src/schemas/company.schema.js';
import { departmentDocumentSchema } from '../../src/schemas/department.schema.js';
import { recruiterDocumentSchema } from '../../src/schemas/recruiter.schema.js';
import { userDocumentSchema } from '../../src/schemas/user.schema.js';
import {
  companyIdFromSelfRegistration, departmentIdFromSelfRegistration, departmentKeyFromName,
  recruiterIdFromSelfRegistration,
} from '../../src/utils/recruiter-registration-id.utils.js';
import { userIdFromEmail } from '../../src/utils/id.utils.js';

const secret = 'recruiter-registration-test-secret-32-bytes';
const registration = {
  email: 'Recruiter@example.test', password: 'StrongPass1',
  company: { name: '  Công ty Ánh Dương ', industry: ' Công nghệ ' },
  department: { name: 'Nhân sự' },
};

function createService({ failType } = {}) {
  const docs = new Map();
  const writes = [];
  const client = {
    async getDocument(id) {
      const doc = docs.get(id);
      if (!doc) throw new CouchDbError('NOT_FOUND', 'Not found');
      return structuredClone(doc);
    },
    async find({ selector }) {
      return { docs: [...docs.values()].filter(doc => Object.entries(selector).every(([key, value]) => doc[key] === value)).map(doc => structuredClone(doc)) };
    },
    async listDocumentsByIdPrefix(prefix, { afterId, limit = 250 } = {}) {
      const all = [...docs.values()].filter(doc => doc._id.startsWith(prefix)).sort((a, b) => a._id.localeCompare(b._id));
      const eligible = afterId ? all.filter(doc => doc._id > afterId) : all;
      const page = eligible.slice(0, limit);
      return { docs: page.map(doc => structuredClone(doc)), lastId: page.at(-1)?._id ?? afterId ?? null, hasMore: eligible.length > limit };
    },
    async createDocument(doc) {
      writes.push(doc.type);
      if (doc.type === failType) throw new Error(`fake ${failType} write error`);
      if (docs.has(doc._id)) throw new CouchDbError('CONFLICT', 'Conflict', { status: 409 });
      docs.set(doc._id, { ...structuredClone(doc), _rev: '1-test' });
      return { ok: true, id: doc._id, rev: '1-test' };
    },
    async updateDocument() { throw new Error('not used'); },
    async exists(id) { return docs.has(id); },
  };
  const users = new UserRepository({ client });
  const candidates = new CandidateRepository({ client });
  const companies = new CompanyRepository({ client });
  const departments = new DepartmentRepository({ client });
  const recruiters = new RecruiterRepository({ client });
  return {
    docs, writes,
    service: new AuthService({ userRepository: users, candidateRepository: candidates, companyRepository: companies,
      departmentRepository: departments, recruiterRepository: recruiters, jwtSecret: secret }),
  };
}

test('self-registration ID helpers use distinct user namespaces and deterministic canonical keys', () => {
  const companyId = companyIdFromSelfRegistration(registration.company.name);
  const canonicalCompanyId = companyIdFromSelfRegistration('CÔNG TY ÁNH DƯƠNG');
  const departmentKey = departmentKeyFromName(registration.department.name);
  const departmentId = departmentIdFromSelfRegistration(companyId, departmentKey);
  const userId = userIdFromEmail(registration.email);
  const recruiterId = recruiterIdFromSelfRegistration(userId, companyId, departmentId);
  assert.equal(companyId, canonicalCompanyId);
  assert.match(companyId, /^company:user:[a-f0-9]{64}$/);
  assert.match(departmentId, /^department:user:[a-f0-9]{64}$/);
  assert.match(recruiterId, /^recruiter:user:[a-f0-9]{64}$/);
  assert.equal(departmentKey, 'nhan-su');
});

test('registration validates and writes Company, Department, Recruiter, then ACTIVE User', async () => {
  const { service, docs, writes } = createService();
  const result = await service.registerRecruiter(registration);
  const userId = userIdFromEmail(registration.email);
  const user = docs.get(userId);
  const recruiter = [...docs.values()].find(doc => doc.type === 'recruiter');
  const company = docs.get(recruiter.company_id);
  const department = docs.get(recruiter.department_id);

  assert.deepEqual(writes, ['company', 'department', 'recruiter', 'user']);
  assert.equal(result.user.role, 'RECRUITER');
  assert.equal(result.user.account_status, 'ACTIVE');
  assert.equal('password_hash' in result.user, false);
  assert.equal(userDocumentSchema.safeParse(user).success, true);
  assert.equal(companyDocumentSchema.safeParse(company).success, true);
  assert.equal(departmentDocumentSchema.safeParse(department).success, true);
  assert.equal(recruiterDocumentSchema.safeParse(recruiter).success, true);
  assert.equal(company.name, 'Công ty Ánh Dương');
  assert.equal(department.company_id, company._id);
  assert.equal(recruiter.user_id, user._id);
  assert.equal(company.provenance.classification, 'mixed');
  assert.equal(department.provenance.classification, 'mixed');
  assert.equal(recruiter.provenance.classification, 'mixed');
  assert.equal(companyIdFromSelfRegistration(company.name), company._id);
});

test('duplicate email and normalized Company are rejected without attaching to existing Company', async () => {
  const { service, docs, writes } = createService();
  await service.registerRecruiter(registration);
  const originalWriteCount = writes.length;
  await assert.rejects(() => service.registerRecruiter({ ...registration, email: 'other@example.test', company: { ...registration.company, name: 'CÔNG TY ÁNH DƯƠNG' } }),
    error => error instanceof AuthServiceError && error.status === 409 && error.code === 'COMPANY_ALREADY_EXISTS');
  await assert.rejects(() => service.registerRecruiter(registration),
    error => error instanceof AuthServiceError && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED');
  assert.equal(writes.length, originalWriteCount);
  assert.equal([...docs.values()].filter(doc => doc.type === 'company').length, 1);
  assert.equal([...docs.values()].filter(doc => doc.type === 'user').length, 1);
});

test('concurrent registrations for the same normalized Company never attach a second User', async () => {
  const { service, docs } = createService();
  const outcomes = await Promise.allSettled([
    service.registerRecruiter(registration),
    service.registerRecruiter({ ...registration, email: 'second@example.test', company: { ...registration.company, name: 'CÔNG TY ÁNH DƯƠNG' } }),
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  assert.equal(failure.reason.code, 'COMPANY_ALREADY_EXISTS');
  assert.equal([...docs.values()].filter(doc => doc.type === 'company').length, 1);
  assert.equal([...docs.values()].filter(doc => doc.type === 'user').length, 1);
});

test('partial write stops immediately, returns operator reference, and does not retry or compensate', async () => {
  const { service, docs, writes } = createService({ failType: 'department' });
  await assert.rejects(() => service.registerRecruiter(registration), error => (
    error.status === 503 && error.code === 'REGISTRATION_INCOMPLETE' && error.details.registration_ref === userIdFromEmail(registration.email)
  ));
  assert.deepEqual(writes, ['company', 'department']);
  assert.equal([...docs.values()].filter(doc => doc.type === 'company').length, 1);
  assert.equal([...docs.values()].filter(doc => doc.type === 'user').length, 0);
  await assert.rejects(() => service.registerRecruiter(registration), error => error.code === 'COMPANY_ALREADY_EXISTS');
  assert.deepEqual(writes, ['company', 'department']);
});

test('Recruiter login and existing tokens require a complete valid organization scope', async () => {
  const { service, docs } = createService();
  const registered = await service.registerRecruiter(registration);
  const login = await service.login({ email: registration.email, password: registration.password });
  assert.equal(login.user.id, registered.user.id);
  assert.equal((await service.authenticate(login.accessToken)).principal.role, 'RECRUITER');

  const recruiter = [...docs.values()].find(doc => doc.type === 'recruiter');
  docs.delete(recruiter.department_id);
  await assert.rejects(() => service.login({ email: registration.email, password: registration.password }), error => error.code === 'RECRUITER_PROFILE_INCOMPLETE');
  await assert.rejects(() => service.authenticate(login.accessToken), error => error.code === 'RECRUITER_PROFILE_INCOMPLETE');
});

test('Recruiter login and existing tokens reject missing Company and mismatched Department ownership', async () => {
  for (const brokenReference of ['company', 'department-company']) {
    const { service, docs } = createService();
    await service.registerRecruiter(registration);
    const login = await service.login({ email: registration.email, password: registration.password });
    const recruiter = [...docs.values()].find(doc => doc.type === 'recruiter');
    if (brokenReference === 'company') docs.delete(recruiter.company_id);
    else {
      const department = docs.get(recruiter.department_id);
      docs.set(department._id, { ...department, company_id: 'company:other' });
    }
    await assert.rejects(() => service.login({ email: registration.email, password: registration.password }), error => error.code === 'RECRUITER_PROFILE_INCOMPLETE');
    await assert.rejects(() => service.authenticate(login.accessToken), error => error.code === 'RECRUITER_PROFILE_INCOMPLETE');
  }
});
