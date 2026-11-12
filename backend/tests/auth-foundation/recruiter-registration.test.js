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
import { userIdFromEmail } from '../../src/utils/id.utils.js';

const secret = 'recruiter-registration-test-secret-32-bytes';
const timestamp = '2026-10-01T00:00:00.000Z';
const companyId = 'company:existing-acme';
const departmentId = 'department:existing-engineering';
const registration = {
  email: 'Recruiter@example.test', password: 'StrongPass1',
  company_id: companyId, department_id: departmentId,
};
const existingCompany = {
  _id: companyId, type: 'company', name: 'Acme Technology', industry: 'Technology',
  created_at: timestamp, updated_at: timestamp,
  provenance: { classification: 'source', source_dataset: 'approved-company-directory' },
};
const existingDepartment = {
  _id: departmentId, type: 'department', company_id: companyId, name: 'Engineering', key: 'engineering',
  created_at: timestamp, updated_at: timestamp,
  provenance: { classification: 'source', source_dataset: 'approved-company-directory' },
};

function createService({ failType } = {}) {
  const docs = new Map([[companyId, structuredClone(existingCompany)], [departmentId, structuredClone(existingDepartment)]]);
  const writes = [];
  const updates = [];
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
    async updateDocument(doc, expectedRev) {
      updates.push({ type: doc.type, expectedRev });
      if (failType === 'user-activation') throw new Error('fake user-activation write error');
      const current = docs.get(doc._id);
      if (!current || current._rev !== expectedRev) throw new CouchDbError('CONFLICT', 'Conflict', { status: 409 });
      const rev = '2-test';
      docs.set(doc._id, { ...structuredClone(doc), _rev: rev });
      return { ok: true, id: doc._id, rev };
    },
    async exists(id) { return docs.has(id); },
  };
  const users = new UserRepository({ client });
  const candidates = new CandidateRepository({ client });
  const companies = new CompanyRepository({ client });
  const departments = new DepartmentRepository({ client });
  const recruiters = new RecruiterRepository({ client });
  return {
    docs, writes, updates,
    service: new AuthService({ userRepository: users, candidateRepository: candidates, companyRepository: companies,
      departmentRepository: departments, recruiterRepository: recruiters, jwtSecret: secret }),
  };
}

test('registration only accepts existing Company and Department IDs', async () => {
  const { service, docs, writes, updates } = createService();
  const result = await service.registerRecruiter(registration);
  const userId = userIdFromEmail(registration.email);
  const user = docs.get(userId);
  const recruiter = [...docs.values()].find(doc => doc.type === 'recruiter');

  assert.deepEqual(writes, ['user', 'recruiter']);
  assert.deepEqual(updates, [{ type: 'user', expectedRev: '1-test' }]);
  assert.equal(result.user.role, 'RECRUITER');
  assert.equal(result.user.account_status, 'ACTIVE');
  assert.equal('password_hash' in result.user, false);
  assert.equal(userDocumentSchema.safeParse(user).success, true);
  assert.equal(companyDocumentSchema.safeParse(docs.get(companyId)).success, true);
  assert.equal(departmentDocumentSchema.safeParse(docs.get(departmentId)).success, true);
  assert.equal(recruiterDocumentSchema.safeParse(recruiter).success, true);
  assert.equal(recruiter.user_id, user._id);
  assert.equal(recruiter.company_id, companyId);
  assert.equal(recruiter.department_id, departmentId);
  assert.equal(docs.size, 4);
});

test('registration rejects unknown Company/Department and cross-Company Department', async () => {
  for (const input of [
    { ...registration, company_id: 'company:missing' },
    { ...registration, department_id: 'department:missing' },
    { ...registration, company_id: 'company:other' },
  ]) {
    const { service, docs, writes } = createService();
    await assert.rejects(() => service.registerRecruiter(input), error => (
      error instanceof AuthServiceError && error.status === 400 && error.code === 'ORGANIZATION_NOT_SUPPORTED'
    ));
    assert.equal(writes.length, 0);
    assert.equal(docs.size, 2);
  }
});

test('duplicate email is rejected without modifying the existing organization', async () => {
  const { service, docs, writes } = createService();
  await service.registerRecruiter(registration);
  const originalWriteCount = writes.length;
  await assert.rejects(() => service.registerRecruiter(registration),
    error => error instanceof AuthServiceError && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED');
  assert.equal(writes.length, originalWriteCount);
  assert.deepEqual(docs.get(companyId), existingCompany);
  assert.deepEqual(docs.get(departmentId), existingDepartment);
  assert.equal([...docs.values()].filter(doc => doc.type === 'recruiter').length, 1);
});

test('concurrent registration for the same email creates at most one account', async () => {
  const { service, docs } = createService();
  const outcomes = await Promise.allSettled([
    service.registerRecruiter(registration),
    service.registerRecruiter(registration),
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal([...docs.values()].filter(doc => doc.type === 'user').length, 1);
  assert.equal([...docs.values()].filter(doc => doc.type === 'recruiter').length, 1);
});

test('partial Recruiter write returns an operator reference and does not retry or compensate', async () => {
  const { service, docs, writes } = createService({ failType: 'recruiter' });
  await assert.rejects(() => service.registerRecruiter(registration), error => (
    error.status === 503 && error.code === 'REGISTRATION_INCOMPLETE'
      && error.details.registration_ref === userIdFromEmail(registration.email)
  ));
  assert.deepEqual(writes, ['user', 'recruiter']);
  assert.equal([...docs.values()].filter(doc => doc.type === 'user').length, 1);
  assert.equal([...docs.values()].filter(doc => doc.type === 'recruiter').length, 0);
});

test('failed immediate activation leaves a recoverable incomplete registration', async () => {
  const { service, docs, writes, updates } = createService({ failType: 'user-activation' });
  await assert.rejects(() => service.registerRecruiter(registration), error => (
    error.status === 503 && error.code === 'REGISTRATION_INCOMPLETE'
      && error.details.registration_ref === userIdFromEmail(registration.email)
  ));
  assert.deepEqual(writes, ['user', 'recruiter']);
  assert.deepEqual(updates, [{ type: 'user', expectedRev: '1-test' }]);
  assert.equal(docs.get(userIdFromEmail(registration.email)).account_status, 'RESET_REQUIRED');
  assert.equal([...docs.values()].filter(doc => doc.type === 'recruiter').length, 1);
});

test('new Recruiter can login immediately and token requires complete organization scope', async () => {
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

test('login and existing tokens reject missing Company and mismatched Department ownership', async () => {
  for (const brokenReference of ['company', 'department-company']) {
    const { service, docs } = createService();
    await service.registerRecruiter(registration);
    const login = await service.login({ email: registration.email, password: registration.password });
    const recruiter = [...docs.values()].find(doc => doc.type === 'recruiter');
    if (brokenReference === 'company') docs.delete(recruiter.company_id);
    else docs.set(departmentId, { ...existingDepartment, company_id: 'company:other' });
    await assert.rejects(() => service.login({ email: registration.email, password: registration.password }), error => error.code === 'RECRUITER_PROFILE_INCOMPLETE');
    await assert.rejects(() => service.authenticate(login.accessToken), error => error.code === 'RECRUITER_PROFILE_INCOMPLETE');
  }
});

test('registration does not create an organization even when names are supplied', async () => {
  const { service, docs, writes } = createService();
  await assert.rejects(() => service.registerRecruiter({
    email: registration.email, password: registration.password,
    company: { name: 'New company', industry: 'Technology' }, department: { name: 'People' },
  }), error => error.code === 'ORGANIZATION_NOT_SUPPORTED');
  assert.deepEqual(writes, []);
  assert.equal(docs.size, 2);
});
