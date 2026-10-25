import test from 'node:test';
import assert from 'node:assert/strict';
import { JobApplicationRepository, recruitmentIndexes } from '../../src/repositories/job-application.repository.js';

const config = { url: 'http://couch.test:5984', database: 'isolated_test_db', authHeader: 'Basic test-only' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('Repository refuses implicit CouchDB database configuration', () => {
  assert.throws(() => new JobApplicationRepository(), error => error.code === 'AUTH_DATABASE_CONFIGURATION_ERROR');
});

test('Repository blocks new writes with unavailable classification but allows explicit legacy updates', async () => {
  const requests = [];
  const repo = new JobApplicationRepository(config, async (url, init) => {
    requests.push({ url, ...init });
    return json({ ok: true, rev: '2-legacy' });
  });
  const legacy = { _id: 'job:legacy', _rev: '1-legacy', provenance: { classification: 'unavailable' } };

  await assert.rejects(repo.put(legacy), error => error.code === 'VALIDATION_ERROR');
  assert.equal(requests.length, 0);
  await repo.put(legacy, { allowLegacyUnavailable: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'PUT');
});

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
  assert.deepEqual(JSON.parse(requests[2].body), { selector, limit: 1, bookmark: 'next', use_index: 'candidate_applications_stage', sort });
});

test('Public job scan uses the built-in _all_docs job ID range in bounded read-only pages', async () => {
  let requestedUrl;
  const repo = new JobApplicationRepository(config, async (url, init) => {
    requestedUrl = new URL(url);
    assert.equal(init.method, 'GET');
    return json({ rows: [{ id: 'job:cms:J_000001', doc: { _id: 'job:cms:J_000001', type: 'job' } }] });
  });
  const jobs = await repo.scanPublicJobs({ afterId: 'job:cms:J_000000', limit: 100 });
  assert.equal(requestedUrl.pathname.endsWith('/_all_docs'), true);
  assert.equal(requestedUrl.searchParams.get('include_docs'), 'true');
  assert.equal(requestedUrl.searchParams.get('startkey'), JSON.stringify('job:cms:J_000000'));
  assert.equal(requestedUrl.searchParams.get('endkey'), JSON.stringify('job:\ufff0'));
  assert.equal(requestedUrl.searchParams.get('skip'), '1');
  assert.equal(requestedUrl.searchParams.get('limit'), '100');
  assert.deepEqual(jobs.map(job => job._id), ['job:cms:J_000001']);
});

test('Repository reports has_more truthfully for empty, partial, exact-final, and continuing pages', async t => {
  async function pageFor(count, limit) {
    const docs = Array.from({ length: count }, (_, i) => ({ _id: `job:${i + 1}` }));
    const requests = [];
    const repo = new JobApplicationRepository(config, async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      const offset = Number(body.bookmark || 0);
      const items = docs.slice(offset, offset + body.limit);
      return json({ docs: items, bookmark: String(offset + items.length) });
    });
    const page = await repo.find({ type: 'job' }, { limit });
    return { page, requests };
  }

  for (const scenario of [
    { name: '0 jobs', count: 0, limit: 1, hasMore: false },
    { name: 'fewer than limit', count: 1, limit: 2, hasMore: false },
    { name: 'exact limit at end', count: 1, limit: 1, hasMore: false },
    { name: 'exact limit with next page', count: 2, limit: 1, hasMore: true },
    { name: 'limit 2 at end', count: 2, limit: 2, hasMore: false },
    { name: 'limit 2 with more rows', count: 3, limit: 2, hasMore: true },
  ]) {
    await t.test(scenario.name, async () => {
      const { page, requests } = await pageFor(scenario.count, scenario.limit);
      assert.equal(page.items.length, Math.min(scenario.count, scenario.limit));
      assert.equal(page.has_more, scenario.hasMore);
      assert.equal(requests.length, page.items.length === scenario.limit ? 2 : 1);
      if (requests.length === 2) {
        assert.equal(requests[1].limit, 1);
        assert.equal(requests[1].bookmark, page.bookmark);
      }
    });
  }
});

test('Repository bookmarks traverse multiple pages without duplicates or skipped documents', async () => {
  const docs = Array.from({ length: 5 }, (_, i) => ({ _id: `job:${i + 1}` }));
  const repo = new JobApplicationRepository(config, async (_url, init) => {
    const body = JSON.parse(init.body);
    const offset = Number(body.bookmark || 0);
    const items = docs.slice(offset, offset + body.limit);
    return json({ docs: items, bookmark: String(offset + items.length) });
  });
  const actual = [];
  let bookmark;
  do {
    const page = await repo.find({ type: 'job' }, { limit: 2, ...(bookmark ? { bookmark } : {}) });
    actual.push(...page.items.map(item => item._id));
    bookmark = page.has_more ? page.bookmark : undefined;
  } while (bookmark);
  assert.deepEqual(actual, docs.map(doc => doc._id));
  assert.equal(new Set(actual).size, docs.length);
});

test('Setup creates named index design docs and reduces scoped stats without loading candidate documents', async () => {
  const requests = [];
  const repo = new JobApplicationRepository(config, async (url, init) => {
    requests.push({ url, ...init });
    if (url.includes('jobs_by_recruiter')) return json({ rows: [{ key: ['recruiter:one', 'OPEN'], value: 25 }] });
    if (url.includes('job_ids_by_recruiter')) return json({ rows: [{ id: 'job:one', key: 'recruiter:one' }] });
    if (url.includes('applications_by_job_stage')) return json({ rows: [{ key: ['job:one', 'APPLIED'], value: 230 }] });
    if (url.includes('attempts_by_job')) return json({ rows: [{ key: 'job:one', value: 240 }] });
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
  assert.equal(stats.total_attempts, 240); assert.equal(stats.historical_attempts, 10);
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
  const repo = new JobApplicationRepository(config, async (url, init) => {
    requests.push(new URL(url));
    if (url.includes('attempts_by_candidate')) {
      assert.deepEqual(JSON.parse(init.body).keys, ['candidate:one']);
      return json({ rows: [{ key: 'candidate:one', value: 28 }] });
    }
    return json({ rows: [{ key: ['candidate:one', 'APPLIED'], value: 24 }, { key: ['candidate:one', 'WITHDRAWN'], value: 1 }] });
  });
  assert.deepEqual(await repo.candidateStats('candidate:one'), { total_applications: 25, total_attempts: 28, historical_attempts: 3, by_stage: { APPLIED: 24, WITHDRAWN: 1 } });
  assert.equal(requests[0].searchParams.get('group'), 'true');
  assert.deepEqual(JSON.parse(requests[0].searchParams.get('startkey')), ['candidate:one']);
  assert.deepEqual(JSON.parse(requests[0].searchParams.get('endkey')), ['candidate:one', {}]);
  const missing = new JobApplicationRepository(config, async () => json({}, 404));
  await assert.rejects(() => missing.candidateStats('candidate:one'), error => error.status === 503 && error.code === 'DATABASE_NOT_INITIALIZED');
});
