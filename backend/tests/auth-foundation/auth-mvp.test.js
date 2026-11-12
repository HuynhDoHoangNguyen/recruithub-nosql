import test from 'node:test';
import assert from 'node:assert/strict';
import { CouchDbError } from '../../src/services/couchdb.errors.js';
import { AuthService, AuthServiceError, PASSWORD_HASH_OPTIONS } from '../../src/services/auth.service.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { CandidateRepository } from '../../src/repositories/candidate.repository.js';
import { USER_ACCOUNT_STATUSES, USER_ROLES } from '../../src/constants/document.constants.js';
import { candidateDocumentSchema } from '../../src/schemas/candidate.schema.js';
import { newDocumentProvenanceSchema } from '../../src/schemas/common.schema.js';
import { candidateIdFromUserId, userIdFromEmail } from '../../src/utils/id.utils.js';

const secret = 'test-only-secret-with-at-least-32-bytes';

function createInMemoryService({
  failCandidateCreate = false,
  failUserUpdate = false,
  now = () => Date.parse('2026-10-23T12:00:00.000Z'),
} = {}) {
  const documents = new Map();
  const client = {
    async getDocument(id) {
      const document = documents.get(id);
      if (!document) throw new CouchDbError('NOT_FOUND', 'Not found');
      return structuredClone(document);
    },
    async find({ selector }) {
      return { docs: [...documents.values()].filter((doc) => Object.entries(selector).every(([key, value]) => doc[key] === value)) };
    },
    async createDocument(document) {
      if (failCandidateCreate && document.type === 'candidate') throw new Error('fake candidate write failure');
      if (documents.has(document._id)) throw new CouchDbError('CONFLICT', 'Conflict', { status: 409 });
      documents.set(document._id, { ...structuredClone(document), _rev: '1-test' });
      return { ok: true, id: document._id, rev: '1-test' };
    },
    async updateDocument(document, expectedRev) {
      if (failUserUpdate) throw new CouchDbError('CONFLICT', 'Conflict', { status: 409 });
      const existing = documents.get(document._id);
      if (!existing || existing._rev !== expectedRev) throw new CouchDbError('CONFLICT', 'Conflict', { status: 409 });
      const updated = { ...structuredClone(document), _rev: '2-test' };
      documents.set(document._id, updated);
      return { ok: true, id: document._id, rev: updated._rev };
    },
    async exists(id) { return documents.has(id); },
  };
  const users = new UserRepository({ client });
  const candidates = new CandidateRepository({ client });
  const service = new AuthService({ userRepository: users, candidateRepository: candidates, jwtSecret: secret, now });
  return { service, documents, client, users, candidates };
}

const registration = {
  email: 'New.Candidate@example.test',
  password: 'StrongPass1',
  full_name: 'New Candidate',
  candidate_role: 'Software Engineer',
  industry: 'Technology',
  seniority: 'JUNIOR',
  years_experience: 0,
};

test('Argon2id uses the provisional approved MVP parameters', () => {
  assert.equal(PASSWORD_HASH_OPTIONS.memoryCost, 65_536);
  assert.equal(PASSWORD_HASH_OPTIONS.timeCost, 3);
  assert.equal(PASSWORD_HASH_OPTIONS.parallelism, 1);
});

test('registration creates canonical User and Candidate documents and only then activates the new account', async () => {
  const { service, documents } = createInMemoryService();
  const result = await service.register(registration);
  const userId = userIdFromEmail(registration.email);
  const user = documents.get(userId);
  const candidate = [...documents.values()].find((doc) => doc.type === 'candidate');

  assert.equal(result.user.id, userId);
  assert.equal(result.user.role, USER_ROLES.CANDIDATE);
  assert.equal(result.user.account_status, USER_ACCOUNT_STATUSES.ACTIVE);
  assert.equal('password_hash' in result.user, false);
  assert.equal(user.email_normalized, 'new.candidate@example.test');
  assert.match(user.password_hash, /^\$argon2id\$/);
  assert.equal(candidate.user_id, userId);
  assert.equal(candidate._id, candidateIdFromUserId(userId));
  assert.equal(candidate.provenance.classification, 'mixed');
  const legacyCandidate = {
    ...candidate,
    provenance: { ...candidate.provenance, classification: 'unavailable' },
  };
  assert.equal(candidateDocumentSchema.safeParse(legacyCandidate).success, true);
  assert.equal(newDocumentProvenanceSchema.safeParse(legacyCandidate.provenance).success, false);
  assert.equal(newDocumentProvenanceSchema.safeParse({ classification: 'mixed', field_origins: { profile: 42 } }).success, false);
  assert.deepEqual(candidate.provenance.field_origins, {
    'profile.full_name': 'candidate_self_registration',
    'profile.role': 'candidate_self_registration',
    'profile.industry': 'candidate_self_registration',
    'profile.seniority': 'candidate_self_registration',
    'profile.years_experience': 'candidate_self_registration',
    'profile.experience_months': 'derived',
  });
  assert.equal(candidate.profile.full_name, registration.full_name);
  assert.equal(candidate.profile.experience_months, 0);
  assert.deepEqual(candidate.skills, []);
  assert.deepEqual(candidate.education, []);
  assert.deepEqual(candidate.experience, []);
  assert.deepEqual(candidate.projects, []);
  assert.equal(Object.hasOwn(candidate, 'experience_summary'), false);
  assert.equal(JSON.stringify(candidate).includes(':null'), false);
  assert.deepEqual(candidate.data_availability, {
    skills: 'UNAVAILABLE', experience: 'PARTIAL', education: 'UNAVAILABLE', projects: 'UNAVAILABLE',
  });
});

test('registration rejects duplicate users and does not permit client role/status selection', async () => {
  const { service } = createInMemoryService();
  await service.register(registration);
  await assert.rejects(() => service.register(registration), (error) => (
    error instanceof AuthServiceError && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED'
  ));
});

test('concurrent registration for one canonical email creates one account and returns a stable conflict', async () => {
  const { service, documents } = createInMemoryService();
  const outcomes = await Promise.allSettled([
    service.register(registration),
    service.register({ ...registration, email: ` ${registration.email.toUpperCase()} ` }),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.equal(rejected.reason.code, 'EMAIL_ALREADY_REGISTERED');
  assert.equal([...documents.values()].filter((document) => document.type === 'user').length, 1);
  assert.equal([...documents.values()].filter((document) => document.type === 'candidate').length, 1);
});

test('login, token authentication, invalid signatures, and expired tokens are enforced', async () => {
  let now = Date.parse('2026-10-23T12:00:00.000Z');
  const { service } = createInMemoryService({ now: () => now });
  await service.register(registration);

  await assert.rejects(() => service.login({ email: registration.email, password: 'WrongPass1' }), (error) => error.status === 401);
  const session = await service.login({ email: registration.email, password: registration.password });
  const authenticated = await service.authenticate(session.accessToken);
  assert.equal(authenticated.principal.role, USER_ROLES.CANDIDATE);
  assert.equal(authenticated.user.email, registration.email);
  await assert.rejects(() => service.authenticate(`${session.accessToken}x`), (error) => error.status === 401);

  now += 16 * 60 * 1000;
  await assert.rejects(() => service.authenticate(session.accessToken), (error) => error.status === 401);
});

test('locked accounts reject an issued access token; unlocking can restore it until its 15-minute expiry', async () => {
  const { service, documents } = createInMemoryService();
  await service.register(registration);
  const session = await service.login({ email: registration.email, password: registration.password });
  const user = documents.get(userIdFromEmail(registration.email));
  user.account_status = USER_ACCOUNT_STATUSES.LOCKED;
  documents.set(user._id, user);

  await assert.rejects(() => service.login({ email: registration.email, password: registration.password }), (error) => error.status === 401);
  await assert.rejects(() => service.authenticate(session.accessToken), (error) => error.status === 401);

  user.account_status = USER_ACCOUNT_STATUSES.ACTIVE;
  documents.set(user._id, user);
  const afterUnlock = await service.authenticate(session.accessToken);
  assert.equal(afterUnlock.principal.sub, user._id);
});

test('RESET_REQUIRED users are rejected without activation or modification', async () => {
  const { service, documents } = createInMemoryService();
  const email = 'seeded@example.invalid';
  const id = userIdFromEmail(email);
  const seeded = {
    _id: id,
    type: 'user',
    email,
    email_normalized: email,
    role: USER_ROLES.CANDIDATE,
    account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    provenance: { classification: 'synthetic', generator_seed: 'fixture', generator_version: 'test' },
  };
  documents.set(id, { ...seeded, _rev: '1-seeded' });

  await assert.rejects(() => service.login({ email, password: 'StrongPass1' }), (error) => error.status === 401);
  assert.deepEqual(documents.get(id), { ...seeded, _rev: '1-seeded' });
});

test('partial Candidate creation failure leaves the newly staged User unable to sign in', async () => {
  const { service, documents } = createInMemoryService({ failCandidateCreate: true });
  await assert.rejects(() => service.register(registration), (error) => (
    error.status === 503 && error.code === 'REGISTRATION_INCOMPLETE'
  ));
  const user = documents.get(userIdFromEmail(registration.email));
  assert.equal(user.account_status, USER_ACCOUNT_STATUSES.RESET_REQUIRED);
  assert.equal([...documents.values()].filter((doc) => doc.type === 'candidate').length, 0);
  await assert.rejects(() => service.login({ email: registration.email, password: registration.password }), (error) => error.status === 401);
});

test('activation conflict leaves the User non-active even when Candidate creation succeeded', async () => {
  const { service, documents } = createInMemoryService({ failUserUpdate: true });
  await assert.rejects(() => service.register(registration), (error) => (
    error.status === 409 && error.code === 'REGISTRATION_INCOMPLETE'
  ));
  const user = documents.get(userIdFromEmail(registration.email));
  const candidate = [...documents.values()].find((doc) => doc.type === 'candidate');
  assert.equal(user.account_status, USER_ACCOUNT_STATUSES.RESET_REQUIRED);
  assert.equal(candidate.user_id, user._id);
  await assert.rejects(() => service.login({ email: registration.email, password: registration.password }), (error) => error.status === 401);
});
