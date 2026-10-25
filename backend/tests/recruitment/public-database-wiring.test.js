import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../../src/app.js';
import { createFixture, signToken } from './fixtures.js';

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('public catalog reads the primary database without Auth config and never routes protected writes there', async t => {
  const fixture = createFixture();
  const job = { ...fixture.job };
  delete job.published_at;
  const requests = [];
  const couch = express();
  couch.use(express.json());
  couch.use((req, res, next) => { requests.push({ path: req.path, method: req.method }); next(); });
  couch.post('/existing_catalog/_find', (req, res) => {
    assert.equal(req.body.selector.type, 'job');
    assert.equal(req.body.selector.status, 'OPEN');
    assert.equal(req.body.selector.published_at, undefined);
    res.json({ docs: [job], bookmark: 'end' });
  });
  couch.get('/existing_catalog/_all_docs', (req, res) => res.json({ rows: [{ doc: job }] }));
  couch.get('/existing_catalog/:id', (req, res) => {
    const doc = fixture.repo.docs.get(req.params.id);
    return doc ? res.json(doc) : res.status(404).json({ error: 'not_found' });
  });
  const couchUrl = await listen(t, couch);
  const environment = { COUCHDB_URL: couchUrl, COUCHDB_DATABASE: 'existing_catalog', JWT_ACCESS_SECRET: 'test-only-secret-with-at-least-32-bytes' };
  const apiUrl = await listen(t, createApp({ jwtEnv: environment }));
  for (const path of ['/jobs', '/jobs/all', '/jobs?q=JavaScript']) {
    const response = await fetch(`${apiUrl}/api/v1${path}`);
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.items[0]._id, job._id);
    assert.equal(data.items[0].company_name, 'Công ty kiểm thử');
  }
  const detail = await fetch(`${apiUrl}/api/v1/jobs/${encodeURIComponent(job._id)}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data._id, job._id);
  const readCount = requests.length;
  const denied = await fetch(`${apiUrl}/api/v1/jobs`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${signToken(environment, fixture.users.recruiter)}`,
  }, body: JSON.stringify({ title: 'Never written' }) });
  assert.equal(denied.status, 503);
  assert.equal((await denied.json()).error.code, 'AUTH_DATABASE_CONFIGURATION_ERROR');
  assert.equal(requests.length, readCount);
  assert.ok(requests.every(req => req.path.startsWith('/existing_catalog/')));
  assert.ok(requests.every(req => req.method === 'GET' || (req.method === 'POST' && req.path.endsWith('/_find'))));
});
