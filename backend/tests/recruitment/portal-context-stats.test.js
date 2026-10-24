import test from 'node:test';
import assert from 'node:assert/strict';
import { startFixture, submission } from './fixtures.js';

test('Candidate statistics aggregate beyond a page and never include another Candidate', async t => {
  const f = await startFixture(t);
  for (let n = 0; n < 25; n++) {
    const id = `job:stats-${n}`;
    f.repo.docs.set(id, { ...structuredClone(f.job), _id: id, _rev: '1-fixture' });
    assert.equal((await f.request('POST', '/applications', { job_id: id, submission })).status, 201);
  }
  assert.equal((await f.request('POST', '/applications', { job_id: f.job._id, submission }, 'otherCandidate')).status, 201);
  const page = await f.request('GET', '/applications/my-applications?limit=1');
  assert.equal(page.body.data.items.length, 1);
  const stats = await f.request('GET', '/applications/stats');
  assert.equal(stats.status, 200);
  assert.deepEqual(stats.body.data, { total_applications: 25, by_stage: { APPLIED: 25 } });
  assert.equal((await f.request('GET', '/applications/stats', undefined, 'recruiter')).status, 403);
});

test('Recruiter context exposes real organization only to the scoped Recruiter', async t => {
  const f = await startFixture(t);
  const result = await f.request('GET', '/recruiter/context', undefined, 'recruiter');
  assert.equal(result.status, 200);
  assert.equal(result.body.data.company._id, f.recruiter.company_id);
  assert.equal(result.body.data.department._id, f.recruiter.department_id);
  assert.equal(result.body.data.email, f.users.recruiter.email);
  assert.equal(JSON.stringify(result.body).includes('password_hash'), false);
  assert.equal((await f.request('GET', '/recruiter/context', undefined, 'candidate')).status, 403);
});
