import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, apply, startFixture } from './fixtures.js';

for (const scenario of ['wrong-role', 'missing-candidate', 'missing-user']) {
  test(`transition rejects ${scenario} before any write and maps HTTP error`, async t => {
    const f = await startFixture(t);
    let application = (await apply(f)).body.data;
    application = (await advance(f, application, 'SCREENING')).body.data;
    if (scenario === 'wrong-role') f.repo.docs.get(f.users.candidate._id).role = 'RECRUITER';
    if (scenario === 'missing-candidate') f.repo.docs.delete(f.candidate._id);
    if (scenario === 'missing-user') f.repo.docs.delete(f.users.candidate._id);
    const before = await f.repo.get(application._id);
    const writes = f.repo.writes.length;
    const response = await advance(f, application, 'INTERVIEW');
    assert.equal(response.status, scenario === 'wrong-role' ? 409 : 404);
    assert.equal(response.body.error.code, scenario === 'wrong-role' ? 'INVALID_SCOPE' : 'NOT_FOUND');
    assert.deepEqual(await f.repo.get(application._id), before);
    assert.equal(f.repo.writes.length, writes);
  });
}

for (const action of ['apply', 'transition']) {
  test(`${action} prepares its response before writing and returns the saved revision`, async t => {
    const f = await startFixture(t);
    let application;
    if (action === 'transition') application = (await apply(f)).body.data;
    let written = false;
    const get = f.repo.get.bind(f.repo);
    f.repo.get = async id => {
      assert.equal(written, false, 'response must not fetch references after the write');
      return get(id);
    };
    f.repo.beforePut = () => { written = true; };
    const response = action === 'apply' ? await apply(f) : await advance(f, application, 'SCREENING');
    assert.equal(response.status, action === 'apply' ? 201 : 200);
    assert.equal(response.body.data._rev, f.repo.docs.get(response.body.data._id)._rev);
    assert.equal(response.body.data.current_stage, action === 'apply' ? 'APPLIED' : 'SCREENING');
  });
}

test('same revision competing transitions retain exactly the winning event', async t => {
  const f = await startFixture(t);
  const application = (await apply(f)).body.data;
  const writes = f.repo.writes.length;
  const responses = await Promise.all([advance(f, application, 'SCREENING'), advance(f, application, 'REJECTED', { reason_code: 'OTHER' })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const stored = await f.repo.get(application._id);
  assert.equal(f.repo.writes.length, writes + 1);
  assert.equal(stored.stage_history.length, 2);
  assert.equal(stored.current_stage, responses.find(r => r.status === 200).body.data.current_stage);
});

test('partial Job PATCH preserves precise deadline and permits an explicit UTC change', async t => {
  const f = await startFixture(t);
  f.repo.docs.get(f.job._id).deadline = '2026-10-30T23:59:59.123Z';
  let job = await f.repo.get(f.job._id);
  let response = await f.request('PATCH', `/jobs/${job._id}`, { title: 'Đổi tiêu đề', expected_rev: job._rev }, 'recruiter');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.deadline, job.deadline);
  job = response.body.data;
  response = await f.request('PATCH', `/jobs/${job._id}`, { deadline: '2026-11-01T02:30:00.000Z', expected_rev: job._rev }, 'recruiter');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.deadline, '2026-11-01T02:30:00.000Z');
});
