import test from 'node:test';
import assert from 'node:assert/strict';
import { jobInput, startFixture } from './fixtures.js';

const cases = [
  ['missing Company', f => f.repo.docs.delete(f.recruiter.company_id), 404, 'NOT_FOUND'],
  ['invalid Company schema', f => { f.repo.docs.get(f.recruiter.company_id).name = ''; }, 403, 'INVALID_SCOPE'],
  ['missing Department', f => f.repo.docs.delete(f.recruiter.department_id), 404, 'NOT_FOUND'],
  ['invalid Department schema', f => { f.repo.docs.get(f.recruiter.department_id).name = ''; }, 403, 'INVALID_SCOPE'],
  ['Department belongs to another Company', f => { f.repo.docs.get(f.recruiter.department_id).company_id = 'company:other'; }, 403, 'INVALID_SCOPE'],
  ['ambiguous Recruiter profile', f => f.repo.docs.set('recruiter:duplicate', { ...f.repo.docs.get(f.recruiter._id), _id: 'recruiter:duplicate' }), 403, 'PROFILE_REQUIRED'],
  ['locked Recruiter User', f => { f.repo.docs.get(f.users.recruiter._id).account_status = 'LOCKED'; }, 401, 'UNAUTHENTICATED'],
];
for (const [name, corrupt, status, code] of cases) {
  test(`Job creation rejects ${name} without writing`, async t => {
    const f = await startFixture(t);
    corrupt(f);
    const response = await f.request('POST', '/jobs', jobInput, 'recruiter');
    assert.equal(response.status, status);
    assert.equal(response.body.error.code, code);
    assert.equal(f.repo.writes.length, 0);
  });
}

test('Job ownership fields are server-owned and a different Recruiter cannot edit', async t => {
  const f = await startFixture(t);
  for (const key of ['recruiter_id', 'company_id', 'department_id']) {
    const response = await f.request('POST', '/jobs', { ...jobInput, [key]: 'fake:owner' }, 'recruiter');
    assert.equal(response.status, 400);
  }
  const before = await f.repo.get(f.job._id);
  const response = await f.request('PATCH', `/jobs/${f.job._id}`, { title: 'Forbidden', expected_rev: before._rev }, 'otherRecruiter');
  assert.equal(response.status, 403);
  assert.deepEqual(await f.repo.get(f.job._id), before);
  assert.equal(f.repo.writes.length, 0);
});
