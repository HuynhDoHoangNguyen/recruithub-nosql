import test from 'node:test';
import assert from 'node:assert/strict';
import { CandidateProfileService } from '../../src/services/candidate-profile.service.js';
import { candidateDocumentSchema } from '../../src/schemas/candidate.schema.js';

const userId = `user:${'a'.repeat(64)}`;
function candidate(overrides = {}) {
  return candidateDocumentSchema.parse({
    _id: 'candidate:demo-user', _rev: '1-profile', type: 'candidate', user_id: userId,
    profile: { full_name: 'Demo User', role: 'Developer', industry: 'technology', seniority: 'JUNIOR', years_experience: 1, experience_months: 12 },
    skills: [], education: [], experience: [], projects: [],
    data_availability: { skills: 'UNAVAILABLE', experience: 'UNAVAILABLE', education: 'UNAVAILABLE', projects: 'UNAVAILABLE' },
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    provenance: { classification: 'source', field_origins: { profile: 'seed' } },
    ...overrides,
  });
}

function makeRepo(document = candidate()) {
  return {
    document,
    updates: [],
    async findByUserId(id) { return { docs: id === this.document.user_id ? [this.document] : [] }; },
    async update(doc, rev) { this.updates.push({ doc, rev }); this.document = { ...doc, _rev: '2-profile' }; return { rev: '2-profile' }; },
  };
}

test('Candidate profile DTO omits document identity, revision and provenance', async () => {
  const repository = makeRepo();
  const result = await new CandidateProfileService({ candidateRepository: repository }).getMyProfile(userId);
  assert.equal(result.profile.profile.full_name, 'Demo User');
  assert.equal(result.revision, '1-profile');
  assert.equal('provenance' in result.profile, false);
  assert.equal('_id' in result.profile, false);
});

test('profile update uses the authenticated owner, allowlists fields and requires current revision', async () => {
  const repository = makeRepo();
  const service = new CandidateProfileService({ candidateRepository: repository });
  const result = await service.updateMyProfile(userId, { profile: { full_name: 'Updated', years_experience: 3 } }, '1-profile');
  assert.equal(result.profile.profile.full_name, 'Updated');
  assert.equal(result.profile.profile.experience_months, 36);
  assert.equal(repository.updates[0].rev, '1-profile');
  assert.equal(repository.updates[0].doc.user_id, userId);
  assert.equal(repository.updates[0].doc.type, 'candidate');
  await assert.rejects(() => service.updateMyProfile(userId, { user_id: `user:${'b'.repeat(64)}` }, '1-profile'), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => service.updateMyProfile(userId, { profile: { role: 'Other' } }, 'old-rev'), { code: 'REVISION_CONFLICT' });
});

test('profile update keeps unrelated availability values and marks supplied skill data available', async () => {
  const repository = makeRepo();
  const service = new CandidateProfileService({ candidateRepository: repository });
  await service.updateMyProfile(userId, { skills: [{ name: 'Node.js', normalized: 'node.js' }] }, '1-profile');
  assert.equal(repository.updates[0].doc.data_availability.skills, 'PARTIAL');
  assert.equal(repository.updates[0].doc.data_availability.education, 'UNAVAILABLE');
});

test('profile update rejects data outside the approved Candidate schema and mismatched ownership', async () => {
  const repository = makeRepo(candidate({ user_id: `user:${'b'.repeat(64)}` }));
  const service = new CandidateProfileService({ candidateRepository: repository });
  await assert.rejects(() => service.getMyProfile(userId), { code: 'CANDIDATE_PROFILE_NOT_FOUND' });
  assert.equal(repository.updates.length, 0);
});
