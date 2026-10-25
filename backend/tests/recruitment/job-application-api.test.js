import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { applicationDocumentSchema } from '../../src/schemas/application.schema.js';
import { provenanceSchema } from '../../src/schemas/common.schema.js';
import { validateWrite } from '../../src/services/job.service.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';
import { advance, apply, interviewFor, jobInput, mutation, startFixture, submission } from './fixtures.js';
import { ResumeScoringService } from '../../src/services/scoring/resume-scoring.service.js';

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

  const current = f.repo.docs.get(f.job._id);
  const original = structuredClone(current);
  const writesBefore = f.repo.writes.length;
  const rejectedUpdate = await f.request('PATCH', `/jobs/${current._id}`, {
    requirements: {
      ...current.requirements,
      project: { status: 'REQUIRED', required_technologies: ['NodeJS', 'node.js'] },
    },
    expected_rev: current._rev,
  }, 'recruiter');
  assert.equal(rejectedUpdate.status, 400);
  assert.equal(rejectedUpdate.body.error.code, 'VALIDATION_ERROR');
  assert.equal(rejectedUpdate.body.error.details.some(detail => (
    detail.field === 'requirements.project.required_technologies.1'
  )), true);
  assert.equal(f.repo.writes.length, writesBefore);
  assert.deepEqual(f.repo.docs.get(current._id), original);
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
  assert.equal(f.repo.writes.filter(doc => doc.type === 'application').length, 1);
  assert.equal(f.repo.writes.filter(doc => doc.type === 'resume_analysis').length, 1);
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

function createCompleteCandidateFixture(baseCandidate) {
  return {
    ...structuredClone(baseCandidate),
    skills: [
      { name: 'JavaScript', normalized: 'javascript' },
      { name: 'CouchDB', normalized: 'couchdb' },
    ],
    profile: {
      role: 'Backend Engineer',
      seniority: 'MID',
      industry: 'SaaS',
      years_experience: 2,
      experience_months: 24,
    },
    education: [
      {
        degree: 'BACHELOR',
        institution: 'Đại học Bách Khoa',
        field_of_study: 'Công nghệ thông tin',
      },
    ],
    experience: [
      {
        employer: 'Công ty Công nghệ',
        role: 'Backend Engineer',
        start_date: '2024-01-01',
        end_date: '2026-01-01',
        description: 'Phát triển backend',
      },
    ],
    projects: [
      {
        name: 'Dự án Tuyển dụng NoSQL',
        technologies: ['JavaScript', 'CouchDB'],
        description: 'Phát triển hệ thống',
      },
    ],
    data_availability: {
      skills: 'AVAILABLE',
      experience: 'AVAILABLE',
      education: 'AVAILABLE',
      projects: 'AVAILABLE',
    },
  };
}

test('TV3-UC22-002 Vector 01: Apply lưu Application trước rồi mới tạo Resume Analysis', async t => {
  const f = await startFixture(t);
  const putOrder = [];
  const origPut = f.repo.put.bind(f.repo);
  f.repo.put = async (doc) => {
    putOrder.push(doc.type);
    if (doc.type === 'resume_analysis') {
      const appInRepo = await f.repo.get(doc.application_id);
      assert.ok(appInRepo, 'Application phải tồn tại trong repository trước khi lưu analysis');
      assert.equal(appInRepo.current_stage, 'APPLIED');
    }
    return origPut(doc);
  };
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.deepEqual(putOrder, ['application', 'resume_analysis']);
});

test('TV3-UC22-002 Vector 02: Scoring COMPLETE làm response trả COMPLETE và analysis_fresh: true', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.analysis_status, 'COMPLETE');
  assert.equal(res.body.data.analysis_fresh, true);
  const storedAnalysis = await f.repo.get(`analysis:${res.body.data._id}`);
  assert.ok(storedAnalysis);
  assert.equal(storedAnalysis.analysis_status, 'COMPLETE');
});

test('TV3-UC22-002 Vector 03: Scoring INCOMPLETE làm response trả INCOMPLETE và analysis_fresh: true', async t => {
  const f = await startFixture(t);
  f.repo.docs.get(f.job._id).requirements.education = { status: 'REQUIRED', minimum_degree: 'BACHELOR' };
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.analysis_status, 'INCOMPLETE');
  assert.equal(res.body.data.analysis_fresh, true);
  const storedAnalysis = await f.repo.get(`analysis:${res.body.data._id}`);
  assert.ok(storedAnalysis);
  assert.equal(storedAnalysis.analysis_status, 'INCOMPLETE');
});

test('TV3-UC22-002 Vector 04 & 05: Scoring failure vẫn trả HTTP 201, PENDING_RETRY và không xóa Application', async t => {
  const f = await startFixture(t, {
    analyzeApplication: async () => {
      throw new Error('Scoring engine temporary offline');
    },
  });
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.analysis_status, 'PENDING_RETRY');
  assert.equal(res.body.data.analysis_fresh, false);
  const storedApp = await f.repo.get(res.body.data._id);
  assert.ok(storedApp, 'Application phải tồn tại trong repo và không bị rollback/xóa');
  assert.equal(storedApp.current_stage, 'APPLIED');
});

test('TV3-UC22-002 Vector 06: Hook giả trả COMPLETE nhưng không persist trả REQUESTED và fresh false', async t => {
  let customCalls = 0;
  const f = await startFixture(t, {
    analyzeApplication: async () => {
      customCalls++;
      return { analysis_status: 'COMPLETE', analysis_fresh: true };
    },
  });
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(customCalls, 1, 'Hook được gọi đúng một lần');
  const storedAnalysis = await f.repo.get(`analysis:${res.body.data._id}`);
  assert.equal(storedAnalysis, null, 'Không có analysis document');
  assert.equal(res.body.data.analysis_status, 'REQUESTED', 'Response là REQUESTED khi không persist');
  assert.equal(res.body.data.analysis_fresh, false, 'analysis_fresh === false khi không persist');
});

test('TV3-UC22-002: Hook giả trả INCOMPLETE nhưng không persist trả REQUESTED và fresh false', async t => {
  let customCalls = 0;
  const f = await startFixture(t, {
    analyzeApplication: async () => {
      customCalls++;
      return { analysis_status: 'INCOMPLETE', analysis_fresh: true };
    },
  });
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(customCalls, 1, 'Hook được gọi đúng một lần');
  const storedAnalysis = await f.repo.get(`analysis:${res.body.data._id}`);
  assert.equal(storedAnalysis, null, 'Không có analysis document');
  assert.equal(res.body.data.analysis_status, 'REQUESTED');
  assert.equal(res.body.data.analysis_fresh, false);
});

test('TV3-UC22-002: Hook persist analysis hợp lệ rồi trả undefined, response lấy trạng thái thật từ summary', async t => {
  let hookCalled = 0;
  let scoringService;
  const f = await startFixture(t, {
    analyzeApplication: async (appId) => {
      hookCalled++;
      if (!scoringService) {
        scoringService = new ResumeScoringService(f.repo, { now: f.now });
      }
      await scoringService.analyzeApplication(appId);
      return undefined; // Hook trả undefined sau khi đã persist hợp lệ
    },
  });
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(hookCalled, 1, 'Hook được gọi đúng một lần');
  assert.equal(res.body.data.analysis_status, 'COMPLETE', 'Response lấy trạng thái COMPLETE từ persisted summary');
  assert.equal(res.body.data.analysis_fresh, true, 'analysis_fresh: true từ persisted summary');
  const storedAnalysis = await f.repo.get(`analysis:${res.body.data._id}`);
  assert.ok(storedAnalysis, 'Analysis document đã được persist');
  assert.equal(storedAnalysis.analysis_status, 'COMPLETE');
});

test('TV3-UC22-002: Corrupted persisted analysis sau hook không được báo COMPLETE/fresh, trả PENDING_RETRY', async t => {
  let hookCalled = 0;
  const f = await startFixture(t, {
    analyzeApplication: async (appId) => {
      hookCalled++;
      // Hook ghi document hỏng schema / sai type vào database
      await f.repo.put({
        _id: `analysis:${appId}`,
        type: 'resume_analysis',
        total_score: 'corrupted-not-a-number',
      });
      return { analysis_status: 'COMPLETE', analysis_fresh: true }; // Hook giả vờ báo COMPLETE
    },
  });
  const res = await apply(f);
  assert.equal(res.status, 201);
  assert.equal(hookCalled, 1);
  assert.equal(res.body.data.analysis_status, 'PENDING_RETRY', 'Corrupted analysis không được tin cậy, chuyển thành PENDING_RETRY');
  assert.equal(res.body.data.analysis_fresh, false);
  const storedApp = await f.repo.get(res.body.data._id);
  assert.ok(storedApp, 'Application không bị rollback');
});

test('TV3-UC22-002 Vector 07: Đọc Application chưa có analysis trả NOT_ANALYZED và analysis_fresh: false', async t => {
  const f = await startFixture(t, {
    analyzeApplication: async () => null,
  });
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.analysis_status, 'NOT_ANALYZED');
  assert.equal(readRes.body.data.analysis_fresh, false);
});

test('TV3-UC22-002 Vector 08: Đọc Application có fresh COMPLETE analysis trả COMPLETE và analysis_fresh: true', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.analysis_status, 'COMPLETE');
  assert.equal(readRes.body.data.analysis_fresh, true);
});

test('TV3-UC22-002 Vector 09: Đọc Application có fresh INCOMPLETE analysis trả INCOMPLETE và analysis_fresh: true', async t => {
  const f = await startFixture(t);
  f.repo.docs.get(f.job._id).requirements.education = { status: 'REQUIRED', minimum_degree: 'BACHELOR' };
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.analysis_status, 'INCOMPLETE');
  assert.equal(readRes.body.data.analysis_fresh, true);
});

test('TV3-UC22-002 Vector 10: Candidate thay đổi làm DTO trả analysis_fresh: false', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const updatedCandidate = structuredClone(completeCand);
  updatedCandidate.skills.push({ name: 'TypeScript', normalized: 'typescript' });
  updatedCandidate._rev = '2-fixture';
  f.repo.docs.set(updatedCandidate._id, updatedCandidate);

  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.analysis_status, 'COMPLETE', 'Giữ nguyên status COMPLETE đã lưu');
  assert.equal(readRes.body.data.analysis_fresh, false, 'Candidate thay đổi khiến analysis trở nên stale');
});

test('TV3-UC22-002 Vector 11: Job thay đổi làm DTO trả analysis_fresh: false', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const updatedJob = structuredClone(await f.repo.get(f.job._id));
  updatedJob.required_skills.push('redis');
  updatedJob._rev = '2-fixture';
  f.repo.docs.set(updatedJob._id, updatedJob);

  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.analysis_status, 'COMPLETE', 'Giữ nguyên status COMPLETE đã lưu');
  assert.equal(readRes.body.data.analysis_fresh, false, 'Job thay đổi khiến analysis trở nên stale');
});

test('TV3-UC22-002 Vector 12: Corrupted analysis không được báo là fresh (chặn bằng controlled 409)', async t => {
  const f = await startFixture(t);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const analysisId = `analysis:${applied.body.data._id}`;
  const analysisDoc = f.repo.docs.get(analysisId);
  analysisDoc.total_score = 'corrupted-non-number';

  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 409, 'Trả controlled error 409 khi stored analysis bị corrupted');
  assert.equal(readRes.body.error.code, 'INVALID_STORED_DOCUMENT');
});

test('TV3-UC22-002 Vector 13: Candidate DTO không lộ breakdown, scores hoặc dữ liệu nội bộ ngoài contract', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const readRes = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(readRes.status, 200);
  const dto = readRes.body.data;
  assert.equal(dto.total_score, undefined);
  assert.equal(dto.scores, undefined);
  assert.equal(dto.component_details, undefined);
  assert.equal(dto.matched_skills, undefined);
  assert.equal(dto.missing_skills, undefined);
  assert.equal(dto.confidence, undefined);
  assert.equal(dto.input_fingerprint, undefined);
  assert.equal(dto.algorithm_version, undefined);
  assert.equal(dto.analysis_status, 'COMPLETE');
  assert.equal(dto.analysis_fresh, true);
});

test('TV3-UC22-002 Vector 14: Không có match_score hoặc analysis_status trong stored Application', async t => {
  const f = await startFixture(t);
  const applied = await apply(f);
  assert.equal(applied.status, 201);
  const storedApp = await f.repo.get(applied.body.data._id);
  assert.equal(storedApp.match_score, undefined);
  assert.equal(storedApp.analysis_status, undefined);
  assert.equal(storedApp.analysis_fresh, undefined);
});

test('TV3-UC14 Vector 11: Applicant Recruiter DTO chỉ có score khi COMPLETE + fresh', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const applied = await apply(f);
  assert.equal(applied.status, 201);

  // Recruiter read detail
  const resDetail = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'recruiter');
  assert.equal(resDetail.status, 200);
  assert.equal(resDetail.body.data.analysis_status, 'COMPLETE');
  assert.equal(resDetail.body.data.analysis_fresh, true);
  assert.equal(typeof resDetail.body.data.analysis_total_score, 'number');
  assert.ok(resDetail.body.data.analysis_total_score > 0);
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(resDetail.body.data.analysis_recommendation));

  // Recruiter read applicants list
  const resList = await f.request('GET', `/jobs/${f.job._id}/applicants`, undefined, 'recruiter');
  assert.equal(resList.status, 200);
  const appInList = resList.body.data.items.find(item => item._id === applied.body.data._id);
  assert.ok(appInList);
  assert.equal(appInList.analysis_status, 'COMPLETE');
  assert.equal(appInList.analysis_fresh, true);
  assert.equal(typeof appInList.analysis_total_score, 'number');
  assert.ok(appInList.analysis_total_score > 0);
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(appInList.analysis_recommendation));
});

test('TV3-UC14 Vector 12: Stale/INCOMPLETE/NOT_ANALYZED không có score summary', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  // Case 1: NOT_ANALYZED
  const fNotAnalyzed = await startFixture(t, { analyzeApplication: async () => null });
  const appNotAnalyzed = (await apply(fNotAnalyzed)).body.data;
  const resNotAnalyzed = await fNotAnalyzed.request('GET', `/applications/${appNotAnalyzed._id}`, undefined, 'recruiter');
  assert.equal(resNotAnalyzed.status, 200);
  assert.equal(resNotAnalyzed.body.data.analysis_status, 'NOT_ANALYZED');
  assert.equal(resNotAnalyzed.body.data.analysis_fresh, false);
  assert.equal(resNotAnalyzed.body.data.analysis_total_score, undefined);
  assert.equal(resNotAnalyzed.body.data.analysis_recommendation, undefined);

  // Case 2: INCOMPLETE
  const fIncomplete = await startFixture(t);
  fIncomplete.repo.docs.get(fIncomplete.job._id).requirements.education = { status: 'REQUIRED', minimum_degree: 'BACHELOR' };
  const appIncomplete = (await apply(fIncomplete)).body.data;
  const resIncomplete = await fIncomplete.request('GET', `/applications/${appIncomplete._id}`, undefined, 'recruiter');
  assert.equal(resIncomplete.status, 200);
  assert.equal(resIncomplete.body.data.analysis_status, 'INCOMPLETE');
  assert.equal(resIncomplete.body.data.analysis_fresh, true);
  assert.equal(resIncomplete.body.data.analysis_total_score, undefined);
  assert.equal(resIncomplete.body.data.analysis_recommendation, undefined);

  // Case 3: Stale
  f.repo.docs.get(f.job._id).requirements.education = { status: 'NO_MINIMUM' };
  f.repo.docs.set(completeCand._id, completeCand);
  const appStale = (await apply(f)).body.data;
  const updatedCandidate = structuredClone(completeCand);
  updatedCandidate.skills.push({ name: 'TypeScript', normalized: 'typescript' });
  updatedCandidate._rev = '2-fixture';
  f.repo.docs.set(updatedCandidate._id, updatedCandidate);

  const resStale = await f.request('GET', `/applications/${appStale._id}`, undefined, 'recruiter');
  assert.equal(resStale.status, 200);
  assert.equal(resStale.body.data.analysis_status, 'COMPLETE');
  assert.equal(resStale.body.data.analysis_fresh, false);
  assert.equal(resStale.body.data.analysis_total_score, undefined);
  assert.equal(resStale.body.data.analysis_recommendation, undefined);
});

test('TV3-UC14 Vector 13: Candidate DTO tuyệt đối không lộ score hoặc recommendation', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const applied = await apply(f);
  assert.equal(applied.status, 201);

  // 1. Apply response
  assert.equal(applied.body.data.analysis_total_score, undefined);
  assert.equal(applied.body.data.analysis_recommendation, undefined);

  // 2. Candidate read detail
  const resDetail = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'candidate');
  assert.equal(resDetail.status, 200);
  assert.equal(resDetail.body.data.analysis_status, 'COMPLETE');
  assert.equal(resDetail.body.data.analysis_fresh, true);
  assert.equal(resDetail.body.data.analysis_total_score, undefined);
  assert.equal(resDetail.body.data.analysis_recommendation, undefined);

  // 3. Candidate read my-applications
  const resMine = await f.request('GET', '/applications/my-applications', undefined, 'candidate');
  assert.equal(resMine.status, 200);
  const appInMine = resMine.body.data.items.find(item => item._id === applied.body.data._id);
  assert.ok(appInMine);
  assert.equal(appInMine.analysis_total_score, undefined);
  assert.equal(appInMine.analysis_recommendation, undefined);
});

test('TV3-UC14 Vector 14: Giá trị decimal không bị làm tròn ở backend', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const applied = await apply(f);
  assert.equal(applied.status, 201);

  // Set an unrounded fractional score that matches weighted sum formula
  const analysisId = `analysis:${applied.body.data._id}`;
  const analysisDoc = f.repo.docs.get(analysisId);
  analysisDoc.scores.skill = 100 / 3;
  analysisDoc.scores.experience = 75;
  analysisDoc.scores.education = 80;
  analysisDoc.scores.project = 70;
  const unroundedValue = 0.5 * (100 / 3) + 0.25 * 75 + 0.10 * 80 + 0.15 * 70;
  analysisDoc.total_score = unroundedValue;
  analysisDoc.recommendation = 'LOW';

  // Check Recruiter DTO
  const resDetail = await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'recruiter');
  assert.equal(resDetail.status, 200);
  assert.equal(resDetail.body.data.analysis_total_score, unroundedValue, 'Decimal value must not be rounded');

  // Check GET /resume-analysis/:id
  const resAnalysis = await f.request('GET', `/resume-analysis/${applied.body.data._id}`, undefined, 'recruiter');
  assert.equal(resAnalysis.status, 200);
  assert.equal(resAnalysis.body.data.analysis.total_score, unroundedValue);
  assert.equal(resAnalysis.body.data.analysis.scores.skill, 100 / 3);
});

test('TV3-UC14 Vector 15: Không persist mirrored score vào Application', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const applied = await apply(f);
  assert.equal(applied.status, 201);

  // Trigger Recruiter read which produces DTO with score summary
  await f.request('GET', `/applications/${applied.body.data._id}`, undefined, 'recruiter');
  await f.request('GET', `/jobs/${f.job._id}/applicants`, undefined, 'recruiter');

  // Verify stored Application document has NO score fields
  const storedApp = await f.repo.get(applied.body.data._id);
  assert.equal(storedApp.match_score, undefined);
  assert.equal(storedApp.analysis_total_score, undefined);
  assert.equal(storedApp.analysis_recommendation, undefined);
  assert.equal(storedApp.analysis_status, undefined);
  assert.equal(storedApp.analysis_fresh, undefined);
});
