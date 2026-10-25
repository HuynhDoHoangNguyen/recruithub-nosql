import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateProfilePatchSchema } from '../../src/schemas/candidate-profile.schema.js';
import { recruiterProfilePatchSchema, recruiterCompanyPatchSchema } from '../../src/schemas/recruiter-profile.schema.js';
import { CandidateProfileService } from '../../src/services/candidate-profile.service.js';
import { createFixture, startFixture } from './fixtures.js';
import { phoneError } from '../../../frontend/src/features/profile/profileValidation.js';

test('Candidate, Recruiter and frontend agree on complete Vietnamese contact numbers and optional empty contacts', () => {
  const valid = ['', '0912345678', '0391234567', '+84 912 345 678', '84912345678', '02438223735', '+84 24 3822 3735'];
  const invalid = ['09123', '091234567', '09123456789', '0123456789', '+840912345678', '1234567890', '+84 912', 'abc0912345678', '0912345678 ext1', '+1 202 555 0123'];
  for (const [values, accepted] of [[valid, true], [invalid, false]]) for (const phone of values) {
    assert.equal(candidateProfilePatchSchema.safeParse({ profile: { phone } }).success, accepted);
    assert.equal(recruiterProfilePatchSchema.safeParse({ expected_rev: '1-test', profile: { phone } }).success, accepted);
    assert.equal(!phoneError(phone), accepted);
  }
});
test('profile writes reject blank/numeric names, oversized content, duplicate collections, invalid years and unsafe company URLs', () => {
  for (const profile of [{ full_name: ' ' }, { full_name: '1' }, { full_name: '12345' }, { full_name: '<b>An</b>' }, { years_experience: -1 }, { years_experience: 1.5 }, { years_experience: 81 }, { summary: 'a'.repeat(4001) }, { location: 'a'.repeat(161) }]) assert.equal(candidateProfilePatchSchema.safeParse({ profile }).success, false);
  for (const patch of [{ skills: [{ name: 'React', normalized: 'react' }, { name: 'REACT', normalized: 'REACT' }] }, { languages: [{ name: 'English' }, { name: 'english' }] }, { projects: [{ name: 'P', technologies: ['a'.repeat(121)] }] }]) assert.equal(candidateProfilePatchSchema.safeParse(patch).success, false);
  for (const website of ['javascript:alert(1)', 'congty.vn', 'https://user:secret@example.invalid']) assert.equal(recruiterCompanyPatchSchema.safeParse({ expected_rev: '1-test', company: { name: 'Công ty', industry: 'IT', website } }).success, false);
  assert.equal(recruiterCompanyPatchSchema.safeParse({ expected_rev: '1-test', company: { name: '  ', industry: 'IT' } }).success, false);
});
test('Recruiter HTTP validation returns the field and never writes short phone numbers; legacy bad contact remains editable', async t => {
  const f = await startFixture(t), count = f.repo.writes.length;
  for (const phone of ['0912', '09123456789']) {
    const result = await f.request('PATCH', '/recruiter/profile', { expected_rev: '1-fixture', profile: { phone } }, 'recruiter');
    assert.equal(result.status, 400); assert.ok(result.body.error.details.some(issue => issue.field === 'profile.phone'));
  }
  assert.equal(f.repo.writes.length, count);
  f.repo.docs.get(f.recruiter._id).profile = { full_name: 'Nhà tuyển dụng', phone: '123' };
  assert.equal((await f.request('GET', '/recruiter/profile', undefined, 'recruiter')).status, 200);
  assert.equal((await f.request('PATCH', '/recruiter/profile', { expected_rev: '1-fixture', profile: { phone: '+84 912 345 678' } }, 'recruiter')).status, 200);
});
test('Candidate blocks invalid phone and edited date ranges before writing, while keeping untouched historical dates', async () => {
  const f = createFixture();
  const repository = { findByUserId: async id => ({ docs: [...f.repo.docs.values()].filter(doc => doc.type === 'candidate' && doc.user_id === id).map(doc => structuredClone(doc)) }), update: async doc => ({ rev: (await f.repo.put(doc))._rev }) };
  const service = new CandidateProfileService({ candidateRepository: repository, now: () => f.now().getTime() });
  const count = f.repo.writes.length;
  for (const patch of [{ profile: { phone: '0912' } }, { education: [{ degree: 'BACHELOR', start_date: '2024-02-30' }] }, { experience: [{ start_date: '2025-09', end_date: '2025-08' }] }]) await assert.rejects(service.updateMyProfile(f.users.candidate._id, patch, '1-fixture'), error => error.status === 400 && error.code === 'VALIDATION_ERROR');
  assert.equal(f.repo.writes.length, count);
  f.repo.docs.get(f.candidate._id).experience = [{ role: 'Engineer', start_date: '2024-06-01T00:00:00Z', end_date: '2023-01-01T00:00:00Z' }];
  const saved = await service.updateMyProfile(f.users.candidate._id, { experience: [{ role: 'Senior Engineer', start_date: '2024-06-01T00:00:00Z', end_date: '2023-01-01T00:00:00Z' }] }, '1-fixture');
  assert.equal(saved.profile.experience[0].role, 'Senior Engineer');
});
