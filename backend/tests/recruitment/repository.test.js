import test from 'node:test';
import assert from 'node:assert/strict';
import { JobApplicationRepository, recruitmentIndexes } from '../../src/repositories/job-application.repository.js';

const config = { url: 'http://couch.test:5984', database: 'isolated_test_db', authHeader: 'Basic test-only' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('Repository sends bounded Mango query, index, descending sort, bookmark and encoded document IDs', async () => {
  const requests = [];
  const repo = new JobApplicationRepository(config, async (url, init) => {
    requests.push({ url, ...init });
    return url.endsWith('_find') ? json({ docs: [{ _id: 'application:pair:test' }], bookmark: 'next' }) : json({ _id: 'job:cms:J_000001' });
  });
  await repo.get('job:cms:J_000001');
  assert.ok(requests[0].url.endsWith('job%3Acms%3AJ_000001'));
  const selector = { type: 'application', candidate_id: 'candidate:one', current_stage: 'SCREENING' };
  const sort = [{ applied_at: 'desc' }];
  const page = await repo.find(selector, { limit: 1, bookmark: 'previous', index: 'candidate_applications_stage', sort });
  assert.deepEqual(JSON.parse(requests[1].body), { selector, limit: 1, bookmark: 'previous', use_index: 'candidate_applications_stage', sort });
  assert.equal(page.bookmark, 'next'); assert.equal(page.has_more, true);
});

test('Setup creates named index design docs and reduces scoped stats without loading candidate documents', async () => {
  const requests = [];
  const repo = new JobApplicationRepository(config, async (url, init) => {
    requests.push({ url, ...init });
    if (url.includes('jobs_by_recruiter')) return json({ rows: [{ key: ['recruiter:one', 'OPEN'], value: 25 }] });
    if (url.includes('job_ids_by_recruiter')) return json({ rows: [{ id: 'job:one', key: 'recruiter:one' }] });
    if (url.includes('applications_by_job_stage')) return json({ rows: [{ key: ['job:one', 'APPLIED'], value: 230 }] });
    if (init.method === 'GET') return json({}, 404);
    return json({ ok: true, rev: '1-design' });
  });
  await repo.initialize();
  assert.ok(requests.some(request => request.method === 'PUT' && request.url.endsWith('/_design/job_application')));
  const indexes = requests.filter(request => request.url.endsWith('_index'));
  assert.equal(indexes.length, recruitmentIndexes.length);
  assert.ok(indexes.every(request => { const body = JSON.parse(request.body); return body.ddoc === body.name; }));
  const stats = await repo.stats('recruiter:one');
  assert.equal(stats.jobs.OPEN, 25); assert.equal(stats.total_applications, 230);
  const aggregate = requests.find(request => request.url.includes('applications_by_job_stage'));
  assert.ok(aggregate.url.endsWith('?group=true'));
  assert.deepEqual(JSON.parse(aggregate.body).keys[0], ['job:one', 'APPLIED']);
});

test('Repository converts network/auth/conflict errors without exposing raw URLs or credentials', async () => {
  const offline = new JobApplicationRepository(config, async () => { throw new Error('http://secret:password@host'); });
  await assert.rejects(() => offline.get('job:one'), error => error.status === 503 && !error.message.includes('password'));
  const conflict = new JobApplicationRepository(config, async () => json({}, 409));
  await assert.rejects(() => conflict.put({ _id: 'job:one', _rev: 'stale' }), error => error.status === 409);
  const noAccess = new JobApplicationRepository(config, async () => json({}, 401));
  await assert.rejects(() => noAccess.get('job:one'), error => error.status === 503);
});

test('Candidate aggregate queries only its key range and fails explicitly if the view is missing', async () => {
  const requests = [];
  const repo = new JobApplicationRepository(config, async url => {
    requests.push(new URL(url));
    return json({ rows: [{ key: ['candidate:one', 'APPLIED'], value: 24 }, { key: ['candidate:one', 'WITHDRAWN'], value: 1 }] });
  });
  assert.deepEqual(await repo.candidateStats('candidate:one'), { total_applications: 25, by_stage: { APPLIED: 24, WITHDRAWN: 1 } });
  assert.equal(requests[0].searchParams.get('group'), 'true');
  assert.deepEqual(JSON.parse(requests[0].searchParams.get('startkey')), ['candidate:one']);
  assert.deepEqual(JSON.parse(requests[0].searchParams.get('endkey')), ['candidate:one', {}]);
  const missing = new JobApplicationRepository(config, async () => json({}, 404));
  await assert.rejects(() => missing.candidateStats('candidate:one'), error => error.status === 503 && error.code === 'DATABASE_NOT_INITIALIZED');
});
