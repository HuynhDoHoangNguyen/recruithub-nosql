import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, interviewFor, startFixture, jobInput } from './fixtures.js';
import { ApplicationService } from '../../src/services/application.service.js';
import { JobService } from '../../src/services/job.service.js';
import { applicationDocumentSchema } from '../../src/schemas/application.schema.js';
import { interviewIdFromRound } from '../../src/utils/interview-validation.utils.js';

const submit = (f, overrides = {}) => ({ job_id: f.job._id, request_id: randomUUID(), submission: { resume_text: 'CV mới' }, ...overrides });
async function withdrawn() {
  const f = createFixture(); const service = new ApplicationService(f.repo, { now: f.now });
  const payload = submit(f, { submission: { resume_text: 'CV lần một', cover_letter: 'Thư lần một' } });
  const first = await service.create(f.users.candidate, payload);
  const old = await service.transition(f.users.candidate, first._id, { expected_rev: first._rev, expected_stage: 'APPLIED' }, true);
  return { f, service, first, old, payload };
}
test('reapply archives the withdrawn CV/history, resets current history and counts a single current pair', async () => {
  const { f, service, old } = await withdrawn();
  const next = await service.create(f.users.candidate, submit(f, { expected_rev: old._rev }));
  assert.equal(next._id, old._id); assert.equal(next.current_stage, 'APPLIED'); assert.equal(next.attempt_number, 2);
  assert.equal(next.stage_history.length, 1); assert.equal(next.stage_history[0].from_stage, null);
  assert.equal(next.previous_attempts[0].submission.resume_text, 'CV lần một');
  assert.deepEqual(next.previous_attempts[0].stage_history, old.stage_history);
  assert.ok(applicationDocumentSchema.safeParse(await f.repo.get(next._id)).success);
  assert.deepEqual(await service.stats(f.users.candidate), { by_stage: { APPLIED: 1 }, total_applications: 1, total_attempts: 2, historical_attempts: 1 });
  assert.equal((await service.detail(f.users.recruiter, next._id)).previous_attempts.length, 1);
});
test('different concurrent reapply intents allow one winner; same intent retry after response loss is idempotent', async () => {
  const { f, service, old } = await withdrawn();
  const a = submit(f, { expected_rev: old._rev }); const b = submit(f, { expected_rev: old._rev });
  const results = await Promise.allSettled([service.create(f.users.candidate, a), service.create(f.users.candidate, b)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  const winner = await f.repo.get(old._id); const winnerPayload = winner.request_id === a.request_id ? a : b;
  const writes = f.repo.writes.length;
  assert.equal((await service.create(f.users.candidate, winnerPayload))._rev, winner._rev);
  assert.equal(f.repo.writes.length, writes);
  const again = await service.transition(f.users.candidate, winner._id, { expected_stage: 'APPLIED', expected_rev: winner._rev }, true);
  assert.equal((await service.create(f.users.candidate, winnerPayload)).current_stage, 'WITHDRAWN');
  assert.equal(f.repo.writes.length, writes + 1);
  const third = await service.create(f.users.candidate, submit(f, { expected_rev: again._rev }));
  assert.equal(third.attempt_number, 3);
  await assert.rejects(service.create(f.users.candidate, winnerPayload), error => error.code === 'REQUEST_ALREADY_PROCESSED');
});
test('same concurrent reapply request creates only one attempt and both responses identify the same revision', async () => {
  const { f, service, old } = await withdrawn(); const payload = submit(f, { expected_rev: old._rev });
  const results = await Promise.all([service.create(f.users.candidate, payload), service.create(f.users.candidate, payload)]);
  assert.equal(results[0]._rev, results[1]._rev); assert.equal((await f.repo.get(old._id)).attempt_number, 2);
});
test('reapply rejects stale/missing revisions, closed/expired jobs, wrong Candidate and active/other terminal stages', async () => {
  const { f, service, old } = await withdrawn(); const count = f.repo.writes.length;
  for (const rev of [undefined, 'stale']) await assert.rejects(service.create(f.users.candidate, submit(f, { expected_rev: rev })), error => error.status === 409);
  for (const job of [{ ...f.job, status: 'CLOSED' }, { ...f.job, deadline: '2026-10-21T00:00:00Z' }]) {
    f.repo.docs.set(job._id, { ...job, _rev: '1-fixture' });
    await assert.rejects(service.create(f.users.candidate, submit(f, { expected_rev: old._rev })), error => error.code === 'JOB_NOT_ELIGIBLE');
  }
  assert.equal(f.repo.writes.length, count);
  await assert.rejects(service.detail(f.users.otherCandidate, old._id), error => error.status === 403);
});
test('old interview evidence is excluded from a new attempt, including status and offer validation', async () => {
  const { f, service, old } = await withdrawn();
  f.repo.docs.set('old-interview', { _id: 'old-interview', type: 'interview', application_id: old._id, round: 1, result: 'PASSED' });
  let next = await service.create(f.users.candidate, submit(f, { expected_rev: old._rev }));
  for (const to_stage of ['SCREENING', 'INTERVIEW']) next = await service.transition(f.users.recruiter, next._id, { expected_stage: next.current_stage, expected_rev: next._rev, to_stage });
  assert.equal(next.interview_status, 'SCHEDULING_REQUIRED');
  await assert.rejects(service.transition(f.users.recruiter, next._id, { expected_stage: 'INTERVIEW', expected_rev: next._rev, to_stage: 'OFFER' }), error => error.code === 'INTERVIEW_EVIDENCE_REQUIRED');
  assert.notEqual(interviewIdFromRound(next._id, 1), interviewIdFromRound(next._id, 1, 2));
  const currentInterview = { ...interviewFor(next, f.recruiter), _id: interviewIdFromRound(next._id, 1, 2), application_attempt: 2 };
  await f.repo.put(currentInterview);
  f.clock.time += 1000;
  assert.equal((await service.detail(f.users.recruiter, next._id)).offer_eligible, true);
  const offered = await service.transition(f.users.recruiter, next._id, { expected_stage: 'INTERVIEW', expected_rev: next._rev, to_stage: 'OFFER' });
  assert.deepEqual((await f.repo.get(offered._id)).stage_history.at(-1).evidence.interview_ids, [currentInterview._id]);
});

test('canonical location/work mode survive create/edit/detail, can be cleared and invalid keys never write', async t => {
  const f = await startFixture(t);
  const created = await f.request('POST', '/jobs', { ...jobInput, location: 'VN-HN', work_mode: 'REMOTE' }, 'recruiter');
  assert.equal(created.status, 201); const job = created.body.data;
  const detail = await f.request('GET', `/jobs/${job._id}`, undefined, null);
  assert.equal(detail.body.data.location, 'VN-HN'); assert.equal(detail.body.data.location_label, 'Hà Nội');
  const count = f.repo.writes.length;
  const invalid = await f.request('PATCH', `/jobs/${job._id}`, { expected_rev: job._rev, location: 'inferred-from-company' }, 'recruiter');
  assert.equal(invalid.status, 400); assert.equal(f.repo.writes.length, count);
  const edited = await f.request('PATCH', `/jobs/${job._id}`, { expected_rev: job._rev, location: 'VN-SG', work_mode: 'HYBRID' }, 'recruiter');
  assert.equal(edited.status, 200);
  const cleared = await f.request('PATCH', `/jobs/${job._id}`, { expected_rev: edited.body.data._rev, location: null, work_mode: null }, 'recruiter');
  assert.equal(cleared.status, 200); assert.equal(cleared.body.data.location, undefined); assert.equal(cleared.body.data.work_mode, undefined);
});
test('CLOSED reopen validates future deadline and ownership before writes, preserving application history', async () => {
  const { f, service, old } = await withdrawn(); const jobs = new JobService(f.repo, f.now);
  const closed = await jobs.update(f.users.recruiter, f.job._id, { status: 'CLOSED', expected_rev: '1-fixture' }, true);
  const count = f.repo.writes.length;
  await assert.rejects(jobs.update(f.users.recruiter, closed._id, { status: 'OPEN', expected_rev: closed._rev, deadline: '2026-10-20T12:00:00Z' }, true), error => error.code === 'INVALID_DEADLINE');
  await assert.rejects(jobs.update(f.users.otherRecruiter, closed._id, { status: 'OPEN', expected_rev: closed._rev }, true), error => error.status === 403);
  await assert.rejects(jobs.update(f.users.recruiter, closed._id, { title: 'edit closed', expected_rev: closed._rev }), error => error.code === 'JOB_CLOSED');
  assert.equal(f.repo.writes.length, count);
  const open = await jobs.update(f.users.recruiter, closed._id, { status: 'OPEN', expected_rev: closed._rev, deadline: '2026-11-01T00:00:00.123Z' }, true);
  assert.equal(open.status, 'OPEN'); assert.equal(open.deadline, '2026-11-01T00:00:00.123Z');
  assert.deepEqual((await service.detail(f.users.candidate, old._id)).stage_history, old.stage_history);
  await assert.rejects(jobs.update(f.users.recruiter, closed._id, { status: 'OPEN', expected_rev: closed._rev }, true), error => error.status === 409);
});
test('whole catalog metadata and combined filters use canonical location, work mode and AND skills', async () => {
  const f = createFixture(); const jobs = new JobService(f.repo, f.now);
  for (let index = 0; index < 135; index++) f.repo.docs.set(`job:scan${String(index).padStart(3, '0')}`, { ...f.job, _id: `job:scan${String(index).padStart(3, '0')}` });
  f.repo.docs.set('job:zzlast', { ...f.job, _id: 'job:zzlast', location: 'VN-HN', work_mode: 'REMOTE', required_skills: ['javascript', 'couchdb', 'rare-last-page-skill'] });
  const metadata = await jobs.metadata(); assert.ok(metadata.skills.includes('rare-last-page-skill')); assert.equal(metadata.skills_operator, 'AND');
  const query = { q: 'hệ thống', industry: 'SaaS', seniority: 'MID', skills: ['javascript', 'couchdb'], location: 'VN-HN', work_mode: 'REMOTE', limit: 2 };
  assert.deepEqual((await jobs.publicList(query)).items.map(job => job._id), ['job:zzlast']);
  assert.equal((await jobs.publicList({ ...query, skills: ['javascript', 'missing'] })).items.length, 0);
  const page = await jobs.publicList({ q: '', industry: '', skills: [], limit: 1 });
  await assert.rejects(jobs.publicList({ ...query, bookmark: page.bookmark }), error => error.code === 'INVALID_BOOKMARK');
});
