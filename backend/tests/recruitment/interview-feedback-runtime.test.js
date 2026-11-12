import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ApplicationService } from '../../src/services/application.service.js';
import { createInterviewService } from '../../src/services/interview.service.js';
import { ApiError } from '../../src/middleware/job-application.middleware.js';
import { createFixture, interviewFor, submission } from './fixtures.js';

const evaluation = { rating: 4, feedback: 'Trình bày rõ cách triển khai.', result: 'PASSED' };

function synchronizeWrites(repository) {
  let release;
  const bothStarted = new Promise(resolve => { release = resolve; });
  let attempts = 0;
  repository.beforePut = async document => {
    if (document.type !== 'interview') return;
    if (++attempts === 2) release();
    await bothStarted;
  };
  return () => attempts;
}

async function prepare() {
  const f = createFixture();
  const applications = new ApplicationService(f.repo, { now: f.now });
  const interviews = createInterviewService(f.repo, { now: f.now });
  const create = options => applications.create(f.users.candidate, {
    job_id: f.job._id, request_id: randomUUID(), submission, ...options,
  });
  const transition = async (application, to_stage, extra = {}) => {
    f.clock.time += 1000;
    return applications.transition(f.users.recruiter, application._id, {
      expected_rev: application._rev, expected_stage: application.current_stage, to_stage, ...extra,
    });
  };
  const enterInterview = async application => transition(await transition(application, 'SCREENING'), 'INTERVIEW');
  const application = await enterInterview(await create());
  const round = await f.repo.put(interviewFor(application, f.recruiter, { completed: false }));
  const complete = (payload = evaluation) => interviews.complete(f.users.recruiter, round._id, payload);
  return { ...f, applications, interviews, create, transition, enterInterview, application, round, complete };
}

test('Two concurrent identical evaluations complete once and return the same timestamp', async () => {
  const f = await prepare();
  const writeAttempts = synchronizeWrites(f.repo);
  const writes = f.repo.writes.length;
  const [a, b] = await Promise.all([f.complete(), f.complete()]);
  assert.deepEqual(a, b);
  assert.equal(a.completed_at, f.now().toISOString());
  assert.equal(f.repo.writes.length, writes + 1);
  assert.equal(writeAttempts(), 2);
});

test('Divergent feedback conflicts and a CouchDB error leaves an incomplete round unchanged', async () => {
  const f = await prepare();
  const writes = f.repo.writes.length;
  for (const status of [409, 503]) {
    f.repo.beforePut = () => { throw new ApiError(status, status === 409 ? 'CONFLICT' : 'DATABASE_UNAVAILABLE', 'Fixture write error'); };
    await assert.rejects(f.complete(), { status });
    assert.deepEqual(await f.repo.get(f.round._id), f.round);
  }
  assert.equal(f.repo.writes.length, writes);
  const writeAttempts = synchronizeWrites(f.repo);
  const results = await Promise.allSettled([
    f.complete(),
    f.complete({ ...evaluation, result: 'FAILED' }),
  ]);
  const winner = results.find(result => result.status === 'fulfilled');
  const loser = results.find(result => result.status === 'rejected');
  assert.equal(loser.reason.code, 'INTERVIEW_FEEDBACK_CONFLICT');
  assert.equal((await f.repo.get(f.round._id)).result, winner.value.result);
  assert.equal(f.repo.writes.length, writes + 1);
  assert.equal(writeAttempts(), 2);
});

test('Feedback supports legacy score and rejects invalid references and a closed stage', async () => {
  const f = await prepare();
  const original = await f.repo.get(f.round._id);
  f.repo.docs.set(f.round._id, { ...original, interviewer_id: f.otherRecruiter._id });
  const writes = f.repo.writes.length;
  await assert.rejects(f.complete(), { code: 'INVALID_INTERVIEW_REFERENCES' });
  await assert.rejects(f.interviews.listFeedback(f.users.recruiter, { application_id: f.application._id }), { code: 'INVALID_INTERVIEW_REFERENCES' });
  assert.equal(f.repo.writes.length, writes);
  f.repo.docs.set(f.round._id, original);
  await f.transition(f.application, 'REJECTED', { reason_code: 'INTERVIEW_FAILED' });
  await assert.rejects(f.complete(), { code: 'INVALID_APPLICATION_STAGE' });
  assert.equal((await f.repo.get(f.round._id)).completed_at, undefined);
  const legacy = { ...original, completed_at: original.scheduled_at, score: 73, result: 'PASSED' };
  f.repo.docs.set(legacy._id, legacy);
  const { items } = await f.interviews.listFeedback(f.users.recruiter, { application_id: f.application._id });
  assert.equal(items[0].score, 73);
  assert.equal(items[0].feedback, undefined);
});

test('An archived round cannot be read or completed after the Candidate reapplies', async () => {
  const f = await prepare();
  const archived = await f.applications.transition(f.users.candidate, f.application._id, {
    expected_rev: f.application._rev, expected_stage: 'INTERVIEW',
  }, true);
  const next = await f.enterInterview(await f.create({ expected_rev: archived._rev }));
  assert.equal(next.attempt_number, 2);
  const writes = f.repo.writes.length;
  await assert.rejects(f.complete(), { code: 'STALE_INTERVIEW_ATTEMPT' });
  assert.deepEqual(await f.interviews.listFeedback(f.users.recruiter, { application_id: next._id }), {
    application_id: next._id, application_attempt: 2, items: [],
  });
  assert.equal(f.repo.writes.length, writes);
});
