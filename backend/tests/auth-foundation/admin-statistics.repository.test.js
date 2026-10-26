import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_USER_STATISTICS_DESIGN, AdminStatisticsRepository } from '../../src/repositories/admin-statistics.repository.js';
import { AuthServiceError } from '../../src/services/auth.service.js';
import { CouchDbError } from '../../src/services/couchdb.errors.js';

function runMap(source, document) {
  const emitted = [];
  Function('doc', 'emit', `(${source})(doc);`)(document, (key, value) => emitted.push({ key, value }));
  return emitted;
}

function simulateCountView(mapSource, documents, { group = false, groupLevel } = {}) {
  const rows = documents.flatMap((document) => runMap(mapSource, document));
  const keyFor = (key) => Array.isArray(key) && groupLevel ? key.slice(0, groupLevel) : key;
  if (!group && groupLevel === undefined) return rows.length ? [{ key: null, value: rows.length }] : [];
  const counts = new Map();
  for (const row of rows) {
    const key = keyFor(row.key);
    const serialized = JSON.stringify(key);
    const current = counts.get(serialized) ?? { key, value: 0 };
    current.value += 1;
    counts.set(serialized, current);
  }
  return [...counts.values()].sort((left, right) => JSON.stringify(left.key).localeCompare(JSON.stringify(right.key)));
}

const docs = [
  { type: 'user', role: 'CANDIDATE', account_status: 'ACTIVE' },
  { type: 'user', role: 'CANDIDATE', account_status: 'LOCKED' },
  { type: 'user', role: 'RECRUITER', account_status: 'ACTIVE' },
  { type: 'candidate', user_id: 'user:one' },
  { type: 'job', recruiter_id: 'recruiter:one', status: 'OPEN' },
];

test('Admin MapReduce source emits only schema-backed User and Candidate fields', () => {
  const views = ADMIN_USER_STATISTICS_DESIGN.views;
  assert.deepEqual(runMap(views.user_count_by_role.map, docs[0]), [{ key: 'CANDIDATE', value: 1 }]);
  assert.deepEqual(runMap(views.user_count_by_status.map, docs[1]), [{ key: 'LOCKED', value: 1 }]);
  assert.deepEqual(runMap(views.user_total.map, docs[3]), []);
  assert.deepEqual(runMap(views.candidate_total.map, docs[3]), [{ key: null, value: 1 }]);
  for (const view of Object.values(views)) assert.equal(view.reduce, '_count');
  assert.deepEqual(simulateCountView(views.user_count_by_role.map, docs, { group: true }), [
    { key: 'CANDIDATE', value: 2 }, { key: 'RECRUITER', value: 1 },
  ]);
  assert.deepEqual(simulateCountView(views.user_total.map, docs), [{ key: null, value: 3 }]);
});

test('Admin statistics repository calls CouchDB MapReduce views and combines recruiter/status composite groups', async () => {
  const calls = [];
  const usersClient = { async getDatabaseInfo() { return { db_name: 'auth_test' }; }, async queryView(design, view, options) {
    calls.push({ database: 'auth', design, view, options });
    const map = ADMIN_USER_STATISTICS_DESIGN.views[view].map;
    return { rows: simulateCountView(map, docs, options) };
  } };
  const jobsClient = { async getDatabaseInfo() { return { db_name: 'jobs_test' }; }, async queryView(design, view, options) {
    calls.push({ database: 'jobs', design, view, options });
    assert.equal(design, 'job_application');
    assert.equal(view, 'jobs_by_recruiter');
    return { rows: [
      { key: ['recruiter:one', 'OPEN'], value: 2 },
      { key: ['recruiter:two', 'OPEN'], value: 1 },
      { key: ['recruiter:one', 'DRAFT'], value: 4 },
      { key: ['recruiter:two', 'CLOSED'], value: 1 },
    ] };
  } };
  const result = await new AdminStatisticsRepository({ usersClient, jobsClient }).getStatistics();
  assert.deepEqual(result, {
    source: 'couchdb_mapreduce', totalUsers: 3, totalCandidates: 1,
    roles: { CANDIDATE: 2, RECRUITER: 1, ADMIN: 0 },
    statuses: { ACTIVE: 2, LOCKED: 1, RESET_REQUIRED: 0 },
    jobs: { total: 8, statuses: { DRAFT: 4, OPEN: 3, CLOSED: 1 } },
  });
  assert.ok(calls.some((call) => call.view === 'user_count_by_role' && call.options.group === true));
  assert.ok(calls.some((call) => call.view === 'user_count_by_status' && call.options.group === true));
  assert.ok(calls.some((call) => call.view === 'jobs_by_recruiter' && call.options.group_level === 2));
});

test('missing Admin views become an explicit setup error; database failures remain failures', async () => {
  const missing = new AdminStatisticsRepository({
    usersClient: { async getDatabaseInfo() {}, async queryView() { throw new CouchDbError('NOT_FOUND', 'Missing view'); } },
    jobsClient: { async getDatabaseInfo() {}, async queryView() { return { rows: [] }; } },
  });
  await assert.rejects(() => missing.getStatistics(), (error) => error instanceof AuthServiceError && error.status === 503 && error.code === 'STATISTICS_VIEW_NOT_INSTALLED');
  const offline = new AdminStatisticsRepository({
    usersClient: { async getDatabaseInfo() { throw new CouchDbError('DATABASE_NOT_FOUND', 'Missing database'); }, async queryView() { return { rows: [] }; } },
    jobsClient: { async getDatabaseInfo() {}, async queryView() { return { rows: [] }; } },
  });
  await assert.rejects(() => offline.getStatistics(), (error) => error instanceof CouchDbError && error.code === 'DATABASE_NOT_FOUND');
});

test('invalid reduced rows are rejected instead of being presented as real statistics', async () => {
  const badUsers = { async getDatabaseInfo() {}, async queryView(_design, view) { return { rows: view === 'user_count_by_role' ? [{ key: 'OWNER', value: 99 }] : [] }; } };
  const jobs = { async getDatabaseInfo() {}, async queryView() { return { rows: [] }; } };
  await assert.rejects(() => new AdminStatisticsRepository({ usersClient: badUsers, jobsClient: jobs }).getStatistics(),
    (error) => error instanceof AuthServiceError && error.code === 'STATISTICS_QUERY_FAILED');
});
