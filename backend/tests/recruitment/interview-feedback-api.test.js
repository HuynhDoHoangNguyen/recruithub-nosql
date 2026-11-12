import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, apply, startFixture } from './fixtures.js';

const feedback = { rating: 5, feedback: '  Có ví dụ kiểm chứng.  ', result: 'PASSED' };
const privateFields = ['_rev', 'provenance', 'interviewer_id', 'candidate_id', 'job_id'];

async function prepare(t) {
  const f = await startFixture(t);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const screening = await advance(f, applied.body.data, 'SCREENING');
  assert.equal(screening.status, 200);
  const entered = await advance(f, screening.body.data, 'INTERVIEW');
  assert.equal(entered.status, 200);
  const application = entered.body.data;
  const scheduledAt = new Date(f.clock.time + 60000).toISOString();
  const query = `application_id=${encodeURIComponent(application._id)}`;
  async function schedule(round) {
    const response = await f.request('POST', '/interviews', {
      application_id: application._id, round, interview_type: 'TECHNICAL', scheduled_at: scheduledAt,
    }, 'recruiter');
    assert.equal(response.status, 201);
    return response.body.data.interview;
  }
  return {
    ...f, application, scheduledAt, schedule,
    list: (actor = 'recruiter') => f.request('GET', `/interviews/feedback?${query}`, undefined, actor),
    scheduleList: () => f.request('GET', `/interviews?${query}`, undefined, 'recruiter'),
    complete: (id, body = feedback, actor = 'recruiter') => f.request('PUT', `/interviews/${encodeURIComponent(id)}/feedback`, body, actor),
  };
}

test('Feedback HTTP validates payload, authorization, references and scheduled time without writes', async t => {
  const f = await prepare(t);
  const round = await f.schedule(1);
  const writes = f.repo.writes.length;
  for (const [actor, status] of [[null, 401], ['candidate', 403], ['admin', 403], ['otherRecruiter', 403]]) {
    assert.equal((await f.list(actor)).status, status);
    assert.equal((await f.complete(round._id, feedback, actor)).status, status);
  }
  for (const bad of [
    { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: '4' }, { feedback: '  ' },
    { feedback: 'a'.repeat(2001) }, { result: 'PENDING' }, { score: 50 }, { completed_at: f.scheduledAt },
    { _rev: 'spoofed' }, { application_attempt: 2 }, { candidate_id: 'candidate:other' },
  ]) {
    const response = await f.complete(round._id, { ...feedback, ...bad });
    assert.equal(response.status, 400, JSON.stringify(bad).slice(0, 80));
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal((await f.complete('invalid')).status, 400);
  assert.equal((await f.complete(round._id.replace(/:1$/, ':99'))).status, 404);
  assert.equal((await f.request('GET', '/interviews/feedback?round=1', undefined, 'recruiter')).status, 400);
  f.clock.time = Date.parse(f.scheduledAt) - 1;
  const early = await f.complete(round._id);
  assert.equal(early.status, 422);
  assert.equal(early.body.error.code, 'INVALID_INTERVIEW_TIMELINE');
  assert.deepEqual((await f.list()).body.data.items, [{ _id: round._id, round: 1, status: 'PENDING' }]);
  assert.equal(f.repo.writes.length, writes);
});

test('Feedback HTTP saves PASSED and FAILED and unlocks OFFER only after all rounds finish', async t => {
  const f = await prepare(t);
  const first = await f.schedule(1);
  const second = await f.schedule(2);
  const applicationBefore = await f.repo.get(f.application._id);
  f.clock.time = Date.parse(f.scheduledAt);
  const result = await f.complete(first._id);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, {
    _id: first._id, round: 1, status: 'COMPLETED', score: 100,
    feedback: 'Có ví dụ kiểm chứng.', result: 'PASSED', completed_at: f.scheduledAt,
  });
  const stored = await f.repo.get(first._id);
  assert.equal(stored.score, 100);
  assert.equal(stored.feedback, result.body.data.feedback);
  assert.equal(stored.completed_at, result.body.data.completed_at);
  assert.equal(stored.result, 'PASSED');
  assert.deepEqual(await f.repo.get(f.application._id), applicationBefore);
  const blocked = await advance(f, f.application, 'OFFER');
  assert.equal(blocked.status, 400);
  assert.equal(blocked.body.error.code, 'INTERVIEW_EVIDENCE_REQUIRED');
  const failed = await f.complete(second._id, { rating: 1, feedback: 'Chưa đủ bằng chứng.', result: 'FAILED' });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.data.score, 20);
  assert.equal(failed.body.data.result, 'FAILED');
  const listed = await f.list();
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data.items, [result.body.data, failed.body.data]);
  for (const item of listed.body.data.items) {
    for (const field of privateFields) assert.equal(Object.hasOwn(item, field), false);
  }
  const schedule = await f.scheduleList();
  assert.equal(schedule.status, 200);
  for (const item of schedule.body.data.items) {
    for (const field of ['feedback', 'score', 'result', 'completed_at']) assert.equal(Object.hasOwn(item, field), false);
  }
  const offered = await advance(f, f.application, 'OFFER');
  assert.equal(offered.status, 200);
  const retry = await f.complete(first._id);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, result.body);
  assert.equal((await f.repo.get(first._id))._rev, stored._rev);
  const candidate = await f.request('GET', `/applications/${encodeURIComponent(f.application._id)}`, undefined, 'candidate');
  assert.equal(candidate.status, 200);
  assert.doesNotMatch(JSON.stringify(candidate.body), /Có ví dụ kiểm chứng|Chưa đủ bằng chứng/);
});
