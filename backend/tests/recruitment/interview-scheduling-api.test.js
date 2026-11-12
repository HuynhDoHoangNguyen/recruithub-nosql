import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, apply, startFixture } from './fixtures.js';

async function prepare(t) {
  const fixture = await startFixture(t);
  const applied = await apply(fixture);
  assert.equal(applied.status, 201);
  const screening = await advance(fixture, applied.body.data, 'SCREENING');
  assert.equal(screening.status, 200);
  const applicationId = applied.body.data._id;
  return {
    ...fixture,
    enterInterview: () => advance(fixture, screening.body.data, 'INTERVIEW'),
    payload: {
      application_id: applicationId,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-23T09:30:00+07:00',
    },
    listPath: `/interviews?application_id=${encodeURIComponent(applicationId)}`,
    post: (body, actor = 'recruiter') => fixture.request('POST', '/interviews', body, actor),
    list: (actor = 'recruiter') => fixture.request('GET', `/interviews?application_id=${encodeURIComponent(applicationId)}`, undefined, actor),
  };
}

test('Interview HTTP authorizes the owner and validates calendar dates before writing', async t => {
  const f = await prepare(t);
  assert.equal((await f.post(f.payload)).status, 422);
  assert.equal((await f.enterInterview()).status, 200);
  for (const [actor, status] of [[null, 401], ['candidate', 403], ['admin', 403], ['otherRecruiter', 403]]) {
    assert.equal((await f.post(f.payload, actor)).status, status);
    assert.equal((await f.list(actor)).status, status);
  }
  for (const scheduled_at of ['2027-13-01T09:00:00+07:00', '2027-02-30T09:00:00+07:00', '2027-02-28T09:00:00', '2027-01-01T24:00:00Z']) {
    const rejected = await f.post({ ...f.payload, scheduled_at });
    assert.equal(rejected.status, 400, scheduled_at);
    assert.equal(rejected.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal((await f.post({ ...f.payload, interviewer_id: f.recruiter._id })).status, 400);
  assert.equal((await f.post({ ...f.payload, scheduled_at: '2026-10-20T00:00:00Z' })).body.error.code, 'INVALID_SCHEDULE_TIMELINE');
  assert.equal((await f.request('GET', f.listPath + '&round=1', undefined, 'recruiter')).status, 400);
  const empty = await f.list();
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data.items, []);
  assert.equal(empty.body.data.scheduling_required, true);
  assert.equal((await f.repo.get(f.payload.application_id)).current_stage, 'INTERVIEW');
});

test('Interview HTTP returns 201 and 200 on concurrent identical writes, then lists rounds', async t => {
  const f = await prepare(t);
  assert.equal((await f.enterInterview()).status, 200);
  assert.equal((await f.post({ ...f.payload, round: 3 })).status, 422);
  const responses = await Promise.all([f.post(f.payload), f.post(f.payload)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
  for (const response of responses) {
    const { interview, idempotent } = response.body.data;
    assert.equal(idempotent, response.status === 200);
    assert.equal(interview.scheduled_at, '2026-10-23T02:30:00.000Z');
    assert.equal(interview._rev, undefined);
  }
  assert.equal((await f.post({ ...f.payload, interview_type: 'BEHAVIORAL' })).status, 409);
  assert.equal((await f.repo.allInterviews(f.payload.application_id)).length, 1);
  assert.equal((await f.post({ ...f.payload, round: 2 })).status, 201);
  const { data } = (await f.list()).body;
  assert.deepEqual(data.items.map(item => item.round), [1, 2]);
  assert.equal(data.next_round, 3);
  assert.equal(data.scheduling_required, false);
});
