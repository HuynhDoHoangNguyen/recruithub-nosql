import test from 'node:test';
import assert from 'node:assert/strict';
import { CouchDbClient } from '../../src/services/couchdb.client.js';
import { CouchDbError } from '../../src/services/couchdb.errors.js';

const config = {
  url: 'http://127.0.0.1:5984',
  database: 'recruitment_db',
  username: 'test-user',
  password: 'test-password',
  timeoutMs: 1000,
};

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('readiness and database metadata only issue GET requests', async () => {
  const calls = [];
  const client = new CouchDbClient({
    config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, url.endsWith('/recruitment_db')
        ? { db_name: 'recruitment_db', doc_count: 25750 }
        : { couchdb: 'Welcome', version: '3.5.2' });
    },
  });
  const result = await client.checkReadiness();
  assert.equal(result.ready, true);
  assert.equal(result.database.doc_count, 25750);
  assert.deepEqual(calls.map(({ options }) => options.method), ['GET', 'GET']);
  assert.equal(calls.some(({ url }) => url.includes('_index') || url.includes('_find')), false);
  assert.equal(calls[0].options.headers.Authorization.startsWith('Basic '), true);
});

test('queryView uses a read-only GET and supports MapReduce group/group_level parameters', async () => {
  const calls = [];
  const client = new CouchDbClient({ config, fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return response(200, { rows: [{ key: ['recruiter:one', 'OPEN'], value: 3 }] });
  } });
  const result = await client.queryView('job_application', 'jobs_by_recruiter', { group_level: 2 });
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].url.pathname, '/recruitment_db/_design/job_application/_view/jobs_by_recruiter');
  assert.equal(calls[0].url.searchParams.get('group_level'), '2');
  assert.deepEqual(result.rows[0], { key: ['recruiter:one', 'OPEN'], value: 3 });
  await assert.rejects(() => client.queryView('_design/unsafe', 'jobs'), TypeError);
  await assert.rejects(() => client.queryView('job_application', 'jobs', { limit: 100 }), TypeError);
});

test('ID-prefix document scan uses CouchDB built-in all_docs read endpoint', async () => {
  const calls = [];
  const client = new CouchDbClient({
    config,
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return response(200, { rows: [{ id: 'user:abc', key: 'user:abc', doc: { _id: 'user:abc', type: 'user' } }] });
    },
  });
  const page = await client.listDocumentsByIdPrefix('user:', { limit: 10 });
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].url.pathname, '/recruitment_db/_all_docs');
  assert.equal(calls[0].url.searchParams.get('include_docs'), 'true');
  assert.deepEqual(page.docs, [{ _id: 'user:abc', type: 'user' }]);
  assert.equal(page.lastId, 'user:abc');
  assert.equal(page.hasMore, false);
  await assert.rejects(() => client.listDocumentsByIdPrefix('user:', { afterId: 'candidate:abc' }), TypeError);
  await assert.rejects(() => client.listDocumentsByIdPrefix('user:', { limit: 1001 }), TypeError);
});

test('CRUD uses deterministic ids and expected revision without mutating input', async () => {
  const calls = [];
  const client = new CouchDbClient({
    config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(201, { ok: true, id: 'user:test', rev: '2-new' });
    },
  });
  const original = { _id: 'user:test', type: 'user', field: 'value' };
  await client.createDocument(original);
  await client.updateDocument(original, '1-old');

  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(JSON.parse(calls[0].options.body)._id, 'user:test');
  assert.equal(JSON.parse(calls[1].options.body)._rev, '1-old');
  assert.equal(calls.length, 2);
  assert.equal(original._rev, undefined);
});

test('missing documents, database, and revision conflicts remain distinct', async () => {
  const client = new CouchDbClient({
    config,
    fetchImpl: async (url) => response(404, {
      error: url.endsWith('/recruitment_db') ? 'not_found' : 'not_found',
    }),
  });
  await assert.rejects(client.getDocument('missing'), { code: 'NOT_FOUND' });
  await assert.rejects(client.getDatabaseInfo(), { code: 'DATABASE_NOT_FOUND' });

  const conflictClient = new CouchDbClient({
    config,
    fetchImpl: async () => response(409, { error: 'conflict' }),
  });
  await assert.rejects(
    conflictClient.updateDocument({ _id: 'user:test' }, 'stale-rev'),
    (error) => error instanceof CouchDbError && error.code === 'CONFLICT',
  );
});

test('network failures and timeouts are mapped without secret or URL output', async () => {
  const networkClient = new CouchDbClient({
    config,
    fetchImpl: async () => { throw new Error('network failure for private endpoint'); },
  });
  await assert.rejects(networkClient.getDatabaseInfo(), (error) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message.includes('private'), false);
    return true;
  });

  const timeoutClient = new CouchDbClient({
    config: { ...config, timeoutMs: 10 },
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }),
  });
  await assert.rejects(timeoutClient.getDatabaseInfo(), { code: 'TIMEOUT' });
});

test('exists distinguishes missing document from missing database', async () => {
  const client = new CouchDbClient({
    config,
    fetchImpl: async (url) => url.endsWith('/missing')
      ? response(404, { error: 'not_found', reason: 'missing' })
      : response(200, { _id: 'exists' }),
  });
  assert.equal(await client.exists('missing'), false);
  assert.equal(await client.exists('exists'), true);

  const missingDbClient = new CouchDbClient({
    config,
    fetchImpl: async () => response(404, { error: 'not_found', reason: 'Database does not exist.' }),
  });
  await assert.rejects(missingDbClient.exists('missing'), { code: 'DATABASE_NOT_FOUND' });
});
