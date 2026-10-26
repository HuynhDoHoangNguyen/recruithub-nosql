import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { applicationDocumentSchema } from '../../src/schemas/application.schema.js';
import { provenanceSchema } from '../../src/schemas/common.schema.js';
import { validateWrite } from '../../src/services/job.service.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';
import { advance, apply, interviewFor, jobInput, mutation, startFixture, submission } from './fixtures.js';

test('new writes reject unavailable classification while the stored-document schema accepts it', () => {
  const schema = z.object({ provenance: provenanceSchema });
  const legacy = { _rev: '1-legacy', provenance: { classification: 'unavailable', field_origins: { old: 'legacy' } } };
  assert.throws(() => validateWrite(schema, legacy), error => error.code === 'VALIDATION_ERROR');
  assert.deepEqual(validateWrite(schema, legacy, { allowLegacyUnavailable: true }), { provenance: legacy.provenance });
  assert.throws(() => validateWrite(schema, { provenance: { classification: 'mixed', field_origins: { profile: 42 } } }), error => error.code === 'VALIDATION_ERROR');
});

test('Job create/edit/publish/close validates schema and real recruiter scope', async t => {
  const f = await startFixture(t);
  assert.equal((await f.request('POST', '/jobs', { ...jobInput, recruiter_id: 'recruiter:two' }, 'recruiter')).status, 400);
  assert.equal((await f.request('POST', '/jobs', { ...jobInput, company_id: f.otherCompany._id }, 'recruiter')).status, 400);
  assert.equal((await f.request('POST', '/jobs', { ...jobInput, department_id: f.otherDepartment._id }, 'recruiter')).status, 400);
  assert.equal((await f.request('POST', '/jobs', jobInput, 'candidate')).status, 403);
  assert.equal((await f.request('POST', '/jobs', jobInput, 'admin')).status, 403);
  const created = await f.request('POST', '/jobs', { ...jobInput, status: 'DRAFT' }, 'recruiter');
  assert.equal(created.status, 201);
  let job = created.body.data;
  assert.match(job._id, /^job:[a-z0-9-]+$/); assert.equal(job.recruiter_id, f.recruiter._id);
  assert.equal(job.source_job_id, undefined); assert.equal(job.provenance.generated, false);
  assert.equal((await f.request('PATCH', `/jobs/${job._id}`, { title: 'Sai quyền', expected_rev: job._rev }, 'otherRecruiter')).status, 403);
  const edited = await f.request('PATCH', `/jobs/${job._id}`, { title: 'Kỹ sư mới', expected_rev: job._rev }, 'recruiter');
  assert.equal(edited.status, 200); job = edited.body.data;
  const published = await f.request('PATCH', `/jobs/${job._id}/status`, { status: 'OPEN', expected_rev: job._rev }, 'recruiter');
  assert.equal(published.status, 200); job = published.body.data; assert.ok(job.published_at);
  const closed = await f.request('PATCH', `/jobs/${job._id}/status`, { status: 'CLOSED', expected_rev: job._rev }, 'recruiter');
  assert.equal(closed.status, 200);
  const list = await f.request('GET', '/recruiter/jobs?status=CLOSED', undefined, 'recruiter');
  assert.deepEqual(list.body.data.items.map(item => item._id), [job._id]);
  assert.equal((await f.request('PATCH', `/jobs/${job._id}/status`, { status: 'OPEN', expected_rev: closed.body.data._rev }, 'recruiter')).status, 200);
});

test('Recruiter organization scope is enforced for cross-company Job and Application access', async t => {
  const f = await startFixture(t);
  const originalJob = structuredClone(await f.repo.get(f.job._id));
  const deniedCreate = await f.request('POST', '/jobs', jobInput, 'otherRecruiter');
  assert.equal(deniedCreate.status, 201);
  assert.equal(deniedCreate.body.data.company_id, f.otherCompany._id);
  assert.equal(deniedCreate.body.data.department_id, f.otherDepartment._id);

  const application = (await apply(f)).body.data;
  const jobRev = (await f.repo.get(f.job._id))._rev;
  const appRev = (await f.repo.get(application._id))._rev;
  const denied = [
    await f.request('PATCH', `/jobs/${f.job._id}`, { title: 'Không được sửa', expected_rev: jobRev }, 'otherRecruiter'),
    await f.request('PATCH', `/jobs/${f.job._id}/status`, { status: 'CLOSED', expected_rev: jobRev }, 'otherRecruiter'),
    await f.request('GET', `/jobs/${f.job._id}/applicants`, undefined, 'otherRecruiter'),
    await f.request('GET', `/applications/${application._id}`, undefined, 'otherRecruiter'),
    await f.request('PATCH', `/applications/${application._id}/stage`, mutation(application, { to_stage: 'SCREENING' }), 'otherRecruiter'),
  ];
  assert.deepEqual(denied.map(response => response.status), [403, 403, 403, 403, 403]);
  assert.deepEqual(await f.repo.get(f.job._id), { ...originalJob, _rev: jobRev });
  assert.equal((await f.repo.get(application._id))._rev, appRev);
});

test('Public Job search is literal, OPEN-only, filterable, and uses stable cursor pagination', async t => {
  const f = await startFixture(t);
  const second = await f.repo.get(f.otherJob._id);
  second.title = 'Data Analyst'; second.industry = 'FinTech'; second.seniority = 'JUNIOR';
  second.required_skills = ['sql', 'python']; second.optional_skills = [];
  await f.repo.put(second);
  const draft = { ...structuredClone(f.job), _id: 'job:draft', status: 'DRAFT', published_at: undefined };
  f.repo.docs.set(draft._id, { ...draft, _rev: '1-fixture' });

  const oneTerm = await f.request('GET', '/jobs?q=Backend');
  assert.equal(oneTerm.status, 200); assert.deepEqual(oneTerm.body.data.items.map(job => job._id), ['job:one']);
  const literalSpecial = await f.request('GET', '/jobs?q=%2E%2A');
  assert.equal(literalSpecial.status, 200); assert.deepEqual(literalSpecial.body.data.items, []);
  const empty = await f.request('GET', '/jobs');
  assert.equal(empty.status, 200); assert.deepEqual(empty.body.data.items.map(job => job._id), ['job:two', 'job:one']);
  const bySkill = await f.request('GET', '/jobs?skills=JavaScript');
  assert.deepEqual(bySkill.body.data.items.map(job => job._id), ['job:one']);
  const combined = await f.request('GET', '/jobs?industry=FinTech&seniority=JUNIOR&skills=SQL');
  assert.deepEqual(combined.body.data.items.map(job => job._id), ['job:two']);

  const first = await f.request('GET', '/jobs?limit=1');
  assert.equal(first.body.data.items[0]._id, 'job:two'); assert.equal(first.body.data.has_more, true);
  const next = await f.request('GET', `/jobs?limit=1&bookmark=${encodeURIComponent(first.body.data.bookmark)}`);
  assert.equal(next.body.data.items[0]._id, 'job:one'); assert.equal(next.body.data.has_more, false);
  const mismatchedCursor = await f.request('GET', `/jobs?industry=FinTech&limit=1&bookmark=${encodeURIComponent(first.body.data.bookmark)}`);
  assert.equal(mismatchedCursor.status, 400); assert.equal(mismatchedCursor.body.error.code, 'INVALID_BOOKMARK');
  const filteredPage = await f.request('GET', '/jobs?skills=JavaScript&limit=1');
  assert.equal(filteredPage.status, 200);
  const invalidUnfiltered = await f.request('GET', `/jobs?bookmark=${encodeURIComponent('not-a-valid-cursor')}`);
  assert.equal(invalidUnfiltered.status, 400); assert.equal(invalidUnfiltered.body.error.code, 'INVALID_BOOKMARK');
  for (const path of ['/jobs?salary_min=1', '/jobs?location=Hanoi', '/jobs?seniority=LEAD', '/jobs?limit=500']) {
    const invalid = await f.request('GET', path);
    assert.equal(invalid.status, 400);
  }
  assert.equal(f.repo.writes.length, 1);
});

test('Public Job detail exposes only OPEN jobs and returns a safe optional Company DTO', async t => {
  const f = await startFixture(t);
  const publicDetail = await f.request('GET', `/jobs/${encodeURIComponent(f.job._id)}`, undefined, null);
  assert.equal(publicDetail.status, 200);
  assert.equal(publicDetail.body.data.status, 'OPEN');
  assert.deepEqual(publicDetail.body.data.company, { name: f.company.name, industry: f.company.industry });
  for (const field of ['_rev', 'provenance', 'company_id', 'department_id', 'recruiter_id']) {
    assert.equal(Object.hasOwn(publicDetail.body.data, field), false);
  }
  for (const field of ['_id', '_rev', 'provenance', 'created_at', 'updated_at']) {
    assert.equal(Object.hasOwn(publicDetail.body.data.company, field), false);
  }

  const closed = { ...structuredClone(f.job), _id: 'job:closed', status: 'CLOSED' };
  const draft = { ...structuredClone(f.job), _id: 'job:draft', status: 'DRAFT', deadline: undefined, published_at: undefined };
  f.repo.docs.set(closed._id, { ...closed, _rev: '1-fixture' });
  f.repo.docs.set(draft._id, { ...draft, _rev: '1-fixture' });
  assert.equal((await f.request('GET', '/jobs/job:closed', undefined, null)).status, 404);
  assert.equal((await f.request('GET', '/jobs/job:draft', undefined, null)).status, 404);
  assert.equal((await f.request('GET', '/jobs/job:missing', undefined, null)).status, 404);
  assert.equal((await f.request('GET', '/jobs/not-a-job-id', undefined, null)).status, 400);

  f.repo.docs.get(f.job._id).company_id = 'company:missing';
  const withoutCompany = await f.request('GET', `/jobs/${encodeURIComponent(f.job._id)}`, undefined, null);
  assert.equal(withoutCompany.status, 200);
  assert.equal(withoutCompany.body.data.company, null);
  assert.equal(Object.hasOwn(withoutCompany.body.data, 'company_name'), false);
  assert.equal(f.repo.writes.length, 0);
});

test('Locked Recruiter and Recruiter with incomplete organization references cannot use Job management', async t => {
  const f = await startFixture(t);
  f.repo.docs.get(f.users.recruiter._id).account_status = 'LOCKED';
  assert.equal((await f.request('GET', '/recruiter/jobs', undefined, 'recruiter')).status, 401);

  f.repo.docs.get(f.users.recruiter._id).account_status = 'ACTIVE';
  f.repo.docs.delete(f.recruiter.department_id);
  const writesBefore = f.repo.writes.length;
  const denied = await f.request('POST', '/jobs', jobInput, 'recruiter');
  assert.notEqual(denied.status, 201);
  assert.equal(f.repo.writes.length, writesBefore);
});

test('Job normalization rejects alias collisions, overlaps, conditional requirements and bad deadlines', async t => {
  const f = await startFixture(t);
  for (const changes of [
    { required_skills: ['React', 'reactjs'] }, { required_skills: ['Node'], optional_skills: ['nodejs'] },
    { requirements: { ...jobInput.requirements, experience: { status: 'REQUIRED' } } },
    { requirements: { ...jobInput.requirements, project: { status: 'REQUIRED', required_technologies: ['React', 'reactjs'] } } },
    { deadline: undefined }, { deadline: '2026-02-30T12:00:00Z' }, { deadline: '2026-10-20T00:00:00Z' },
  ]) assert.equal((await f.request('POST', '/jobs', { ...jobInput, ...changes }, 'recruiter')).status, 400);
  const created = await f.request('POST', '/jobs', { ...jobInput, required_skills: [' JS ', 'NodeJS'] }, 'recruiter');
  assert.equal(created.status, 201); assert.deepEqual(created.body.data.required_skills, ['javascript', 'node.js']);
});

test('Job updates preserve historical unavailable provenance while new writes reject it', async t => {
  const f = await startFixture(t);
  const job = f.repo.docs.get(f.job._id);
  job.provenance = { classification: 'unavailable', field_origins: { legacy: 'historical' } };
  const response = await f.request('PATCH', `/jobs/${job._id}`, { title: 'Updated title', expected_rev: job._rev }, 'recruiter');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.provenance.classification, 'unavailable');
  assert.equal(response.body.data.provenance.field_origins.legacy, 'historical');
  assert.equal(response.body.data.provenance.field_origins.title, 'user_input');
});

test('Apply saves submitted text, deterministic identity and an atomic initial event; legacy remains compatible', async t => {
  const f = await startFixture(t);
  const response = await apply(f); assert.equal(response.status, 201);
  const app = response.body.data;
  assert.equal(app._id, applicationIdFromPair(f.candidate._id, f.job._id));
  assert.deepEqual(app.submission, submission); assert.equal(app.current_stage, 'APPLIED');
  const stored = await f.repo.get(app._id);
  assert.equal(stored.stage_history[0].timestamp, stored.applied_at); assert.equal(stored.stage_history[0].from_stage, null);
  assert.equal(stored.stage_history[0].actor_id, f.users.candidate._id);
  const { submission: ignored, ...legacy } = stored;
  assert.ok(ignored); assert.equal(applicationDocumentSchema.safeParse(legacy).success, true);
  const read = await f.request('GET', `/applications/${app._id}`, undefined, 'recruiter');
  assert.deepEqual(read.body.data.submission, submission); assert.equal(read.body.data.email, f.users.candidate.email);
});

test('Application stage PATCH preserves legacy unavailable provenance', async t => {
  const f = await startFixture(t);
  const applied = await apply(f);
  const app = f.repo.docs.get(applied.body.data._id);
  app.provenance = { classification: 'unavailable', field_origins: { legacy: 'historical' } };

  const transitioned = await advance(f, applied.body.data, 'SCREENING');
  assert.equal(transitioned.status, 200);
  assert.equal(app.provenance.classification, 'unavailable');
  assert.equal(app.provenance.field_origins.legacy, 'historical');
});

test('Apply accepts inclusive UTC deadline and rejects a millisecond after it, DRAFT and CLOSED without writes', async t => {
  for (const [status, offset, expected] of [['OPEN', 0, 201], ['OPEN', 1, 400], ['DRAFT', 0, 400], ['CLOSED', 0, 400]]) {
    const f = await startFixture(t); const job = f.repo.docs.get(f.job._id);
    job.status = status; job.deadline = new Date(f.clock.time).toISOString(); f.clock.time += offset;
    const response = await apply(f); assert.equal(response.status, expected);
    assert.equal(f.repo.writes.filter(doc => doc.type === 'application').length, expected === 201 ? 1 : 0);
  }
});

test('Concurrent and sequential Apply create exactly one lifetime document, including response-loss recovery', async t => {
  const f = await startFixture(t);
  const results = await Promise.all([apply(f), apply(f)]);
  assert.deepEqual(results.map(item => item.status).sort(), [201, 409]);
  assert.equal(results.find(item => item.status === 409).body.error.code, 'DUPLICATE_APPLICATION');
  assert.equal(f.repo.writes.length, 1);
  const duplicate = await apply(f); assert.equal(duplicate.body.error.code, 'DUPLICATE_APPLICATION');
  const recovery = await f.request('GET', `/applications/my-applications?job_id=${f.job._id}`);
  assert.equal(recovery.body.data.items.length, 1);
  assert.equal(recovery.body.data.items[0]._id, applicationIdFromPair(f.candidate._id, f.job._id));
});

test('Apply rejects forbidden input, empty/oversized submissions and invalid references without partial writes', async t => {
  const f = await startFixture(t);
  for (const changes of [{ _id: 'fake' }, { candidate_id: 'candidate:two' }, { current_stage: 'HIRED' }, { stage_history: [] },
    { actor_id: f.users.otherCandidate._id }, { match_score: 100 }, { provenance: {} },
    { submission: { resume_text: ' ' } }, { submission: { resume_text: 'x'.repeat(50001) } },
    { submission: { resume_text: 'CV', cover_letter: 'x'.repeat(10001) } }, { submission: { resume_text: 'CV', cv_url: 'fake' } }]) {
    assert.equal((await f.request('POST', '/applications', { job_id: f.job._id, submission, ...changes })).status, 400);
  }
  f.repo.docs.get(f.job._id).department_id = 'department:missing';
  assert.equal((await apply(f)).body.error.code, 'INVALID_SCOPE'); assert.equal(f.repo.writes.length, 0);
  f.repo.docs.get(f.job._id).department_id = f.recruiter.department_id;
  f.repo.docs.delete(f.recruiter.department_id);
  assert.equal((await apply(f)).status, 404); assert.equal(f.repo.writes.length, 0);
});

test('Ownership and DTOs prevent cross-user reads, recruiter impersonation, admin bypass and internal note leaks', async t => {
  const f = await startFixture(t); const app = (await apply(f)).body.data;
  const stored = f.repo.docs.get(app._id); stored.recruiter_note = 'Nội bộ'; stored.stage_history[0].note = 'Ghi chú kín';
  assert.equal((await f.request('GET', `/applications/${app._id}`, undefined, 'otherCandidate')).status, 403);
  assert.equal((await f.request('GET', `/applications/${app._id}`, undefined, 'otherRecruiter')).status, 403);
  assert.equal((await f.request('GET', `/jobs/${f.job._id}/applicants`, undefined, 'otherRecruiter')).status, 403);
  assert.equal((await f.request('PATCH', `/applications/${app._id}/stage`, mutation(app, { to_stage: 'SCREENING' }), 'candidate')).status, 403);
  assert.equal((await f.request('PATCH', `/applications/${app._id}/stage`, mutation(app, { to_stage: 'SCREENING' }), 'admin')).status, 403);
  assert.equal((await f.request('PATCH', `/applications/${app._id}/withdraw`, mutation(app), 'recruiter')).status, 403);
  const own = await f.request('GET', '/applications/my-applications');
  const serialized = JSON.stringify(own.body); assert.ok(!serialized.includes('Nội bộ')); assert.ok(!serialized.includes('Ghi chú kín'));
  assert.ok(!serialized.includes('actor_id')); assert.ok(!serialized.includes('password_hash')); assert.ok(!serialized.includes('provenance'));
  assert.deepEqual((await f.request('GET', '/applications/my-applications', undefined, 'otherCandidate')).body.data.items, []);
});

test('Candidate reads CLOSED Job details only through their own application history', async t => {
  const f = await startFixture(t);
  const application = (await apply(f)).body.data;
  const currentJob = f.repo.docs.get(f.job._id);
  const closed = await f.request('PATCH', `/jobs/${f.job._id}/status`, {
    status: 'CLOSED', expected_rev: currentJob._rev,
  }, 'recruiter');
  assert.equal(closed.status, 200);

  assert.equal((await f.request('GET', `/jobs/${f.job._id}`, undefined, null)).status, 404);
  const ownHistory = await f.request('GET', `/applications/my-applications?job_id=${encodeURIComponent(f.job._id)}`);
  assert.equal(ownHistory.status, 200);
  assert.equal(ownHistory.body.data.items[0]._id, application._id);
  assert.equal(ownHistory.body.data.items[0].job._id, f.job._id);
  assert.equal(ownHistory.body.data.items[0].job.status, 'CLOSED');
  assert.deepEqual((await f.request('GET', `/applications/my-applications?job_id=${encodeURIComponent(f.job._id)}`, undefined, 'otherCandidate')).body.data.items, []);
});

test('Withdraw is allowed only from three stages and reapplication requires a fresh request and expected revision', async t => {
  for (const stage of ['APPLIED', 'SCREENING', 'INTERVIEW']) {
    const f = await startFixture(t); let app = (await apply(f)).body.data;
    if (stage !== 'APPLIED') app = (await advance(f, app, 'SCREENING')).body.data;
    if (stage === 'INTERVIEW') app = (await advance(f, app, 'INTERVIEW')).body.data;
    f.clock.time += 60000;
    const withdrawn = await f.request('PATCH', `/applications/${app._id}/withdraw`, mutation(app));
    assert.equal(withdrawn.status, 200); assert.equal(withdrawn.body.data.current_stage, 'WITHDRAWN');
    assert.equal(withdrawn.body.data.stage_history.length, app.stage_history.length + 1);
    assert.equal((await apply(f)).body.error.code, 'CONFLICT');
    assert.equal((await f.request('PATCH', `/applications/${app._id}/withdraw`, mutation(withdrawn.body.data))).status, 400);
  }
  const f = await startFixture(t); const app = (await apply(f)).body.data;
  const rejected = (await advance(f, app, 'REJECTED', { reason_code: 'QUALIFICATIONS_MISMATCH' })).body.data;
  assert.equal((await apply(f)).body.error.code, 'DUPLICATE_APPLICATION');
  assert.equal((await advance(f, rejected, 'SCREENING')).status, 400);
});

test('Pipeline forbids skipped/backward/terminal stages and requires context-appropriate rejection reason', async t => {
  const f = await startFixture(t); const app = (await apply(f)).body.data;
  for (const target of ['INTERVIEW', 'OFFER', 'HIRED', 'APPLIED', 'WITHDRAWN']) assert.equal((await advance(f, app, target)).status, 400);
  assert.equal((await advance(f, app, 'REJECTED')).status, 400);
  assert.equal((await advance(f, app, 'REJECTED', { reason_code: 'OFFER_EXPIRED' })).status, 400);
  const screening = (await advance(f, app, 'SCREENING')).body.data;
  assert.equal((await advance(f, screening, 'APPLIED')).status, 400);
});

test('OFFER verifies all real Interview records; HIRED validates acceptance and timestamp; terminal cannot reapply', async t => {
  const f = await startFixture(t); let app = (await apply(f)).body.data;
  app = (await advance(f, app, 'SCREENING')).body.data;
  app = (await advance(f, app, 'INTERVIEW')).body.data;
  assert.equal(app.interview_status, 'SCHEDULING_REQUIRED');
  assert.equal((await advance(f, app, 'OFFER')).body.error.code, 'INTERVIEW_EVIDENCE_REQUIRED');
  assert.equal((await advance(f, app, 'OFFER', { evidence: {} })).status, 400);
  await f.repo.put(interviewFor(app, f.recruiter));
  const pending = await f.repo.put(interviewFor(app, f.recruiter, { round: 2, completed: false }));
  assert.equal((await advance(f, app, 'OFFER')).body.error.code, 'INTERVIEW_EVIDENCE_REQUIRED');
  await f.repo.put({ ...pending, completed_at: pending.scheduled_at, result: 'PASSED' });
  const offered = await advance(f, app, 'OFFER'); assert.equal(offered.status, 200); app = offered.body.data;
  assert.equal(app.stage_history.at(-1).evidence.interview_ids.length, 2);
  assert.equal((await f.request('PATCH', `/applications/${app._id}/withdraw`, mutation(app))).status, 400);
  assert.equal((await advance(f, app, 'REJECTED', { reason_code: 'OTHER' })).body.error.code, 'INVALID_REASON');
  assert.equal((await advance(f, app, 'HIRED')).body.error.code, 'OFFER_ACCEPTANCE_REQUIRED');
  assert.equal((await advance(f, app, 'HIRED', { evidence: { accepted_at: '2099-01-01T00:00:00Z', method: 'EMAIL' } })).status, 400);
  const hired = await advance(f, app, 'HIRED', { evidence: { accepted_at: new Date(f.clock.time).toISOString(), method: 'EMAIL', reference: 'mail:confirmation-test' } });
  assert.equal(hired.status, 200); assert.equal(hired.body.data.current_stage, 'HIRED');
  assert.equal((await apply(f)).body.error.code, 'DUPLICATE_APPLICATION');
  assert.equal((await advance(f, hired.body.data, 'REJECTED', { reason_code: 'OTHER' })).status, 400);
  assert.equal(applicationDocumentSchema.safeParse(await f.repo.get(app._id)).success, true);
});

test('Concurrent lifecycle writes and stale revision preserve the winning history', async t => {
  const f = await startFixture(t); const app = (await apply(f)).body.data;
  f.clock.time += 60000;
  const results = await Promise.all([
    f.request('PATCH', `/applications/${app._id}/stage`, mutation(app, { to_stage: 'SCREENING' }), 'recruiter'),
    f.request('PATCH', `/applications/${app._id}/withdraw`, mutation(app)),
  ]);
  assert.deepEqual(results.map(item => item.status).sort(), [200, 409]);
  const saved = await f.repo.get(app._id); assert.equal(saved.stage_history.length, 2);
  assert.equal(saved.current_stage, saved.stage_history.at(-1).to_stage);
  assert.equal((await advance(f, app, 'SCREENING')).status, 409);
});

test('List pagination/filter/scope, static routes and statistics use complete scoped collections', async t => {
  const f = await startFixture(t);
  await apply(f);
  await f.request('POST', '/applications', { job_id: f.otherJob._id, submission });
  const first = await f.request('GET', '/applications/my-applications?limit=1');
  assert.equal(first.status, 200); assert.equal(first.body.data.items.length, 1); assert.equal(first.body.data.has_more, true);
  const next = await f.request('GET', `/applications/my-applications?limit=1&bookmark=${first.body.data.bookmark}`);
  assert.notEqual(first.body.data.items[0]._id, next.body.data.items[0]._id);
  assert.deepEqual((await f.request('GET', '/applications/my-applications?stage=HIRED')).body.data.items, []);
  assert.equal((await f.request('GET', '/applications/context')).body.data.email, f.users.candidate.email);
  const stats = await f.request('GET', '/recruiter/stats', undefined, 'recruiter');
  assert.equal(stats.body.data.total_applications, 1);
  for (const path of ['/applications/my-applications?limit=10000', '/applications/my-applications?stage=OFFERED', '/recruiter/jobs?selector=anything']) {
    assert.equal((await f.request('GET', path, undefined, path.includes('recruiter') ? 'recruiter' : 'candidate')).status, 400);
  }
});

test('Scoring hook failure preserves accepted application and reports pending retry', async t => {
  const f = await startFixture(t, { analyzeApplication: async () => { throw new Error('analysis offline'); } });
  const response = await apply(f);
  assert.equal(response.status, 201); assert.equal(response.body.data.analysis_status, 'PENDING_RETRY');
  assert.ok(await f.repo.get(response.body.data._id));
});

test('Closing a job preserves applications and hides closed Jobs from the public detail API', async t => {
  const f = await startFixture(t); const app = (await apply(f)).body.data;
  const job = await f.repo.get(f.job._id);
  const closed = await f.request('PATCH', `/jobs/${job._id}/status`, { status: 'CLOSED', expected_rev: job._rev }, 'recruiter');
  assert.equal(closed.status, 200); assert.deepEqual((await f.repo.get(app._id)).stage_history.length, 1);
  assert.equal((await f.request('POST', '/applications', { job_id: job._id, submission }, 'otherCandidate')).status, 400);
  assert.equal((await f.request('GET', `/applications/${app._id}`)).status, 200);
  assert.equal((await f.request('GET', `/jobs/${job._id}`, undefined, null)).status, 404);
  const draft = await f.request('POST', '/jobs', { ...jobInput, status: 'DRAFT', deadline: undefined }, 'recruiter');
  assert.equal(draft.status, 201);
  assert.equal((await f.request('GET', `/jobs/${draft.body.data._id}`, undefined, null)).status, 404);
  assert.equal((await f.request('PATCH', `/jobs/${draft.body.data._id}/status`, { status: 'OPEN', expected_rev: draft.body.data._rev }, 'recruiter')).status, 400);
});

test('Post-write response loss recovers by pair lookup, and a CouchDB write conflict re-reads latest scope', async t => {
  const f = await startFixture(t);
  const put = f.repo.put.bind(f.repo);
  let responseLost = true;
  f.repo.put = async document => {
    const saved = await put(document);
    if (document.type === 'application' && responseLost) { responseLost = false; throw new Error('Response lost after commit'); }
    return saved;
  };
  assert.equal((await apply(f)).status, 500);
  const existing = (await f.request('GET', `/applications/my-applications?job_id=${f.job._id}`)).body.data.items[0];
  assert.ok(existing); assert.equal((await apply(f)).body.error.code, 'DUPLICATE_APPLICATION');
  const old = await f.repo.get(existing._id);
  f.repo.beforePut = async document => {
    if (document.type !== 'application') return;
    f.repo.beforePut = null;
    const current = f.repo.docs.get(document._id);
    current._rev = '2-other-writer'; current.recruiter_note = 'Ghi chú cập nhật đồng thời';
  };
  const conflict = await advance(f, existing, 'SCREENING');
  assert.equal(conflict.status, 409);
  const latest = await f.repo.get(existing._id);
  assert.equal(latest.current_stage, 'APPLIED'); assert.deepEqual(latest.stage_history, old.stage_history);
  assert.equal(latest.recruiter_note, 'Ghi chú cập nhật đồng thời');
});
