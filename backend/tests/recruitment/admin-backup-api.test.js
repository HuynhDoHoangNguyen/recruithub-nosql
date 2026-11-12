import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { createAdminBackupRouter } from '../../src/routes/admin-backup.routes.js';
import { createAuthenticate } from '../../src/middleware/authenticate.js';
import { AuthServiceError } from '../../src/services/auth.service.js';
import { serviceFixture, sourceReader } from '../helpers/admin-backup-fixtures.js';
import { issueAccessToken } from '../../src/services/jwt-access-token.js';
import { createApp } from '../../src/app.js';
import { createFixture } from './fixtures.js';

async function apiFixture(t, options) {
  const fixture = await serviceFixture(t, options);
  const auth = createAuthenticate({ serviceProvider: () => ({ async authenticate(token) {
    if (['expired', 'locked'].includes(token)) throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Invalid session.');
    return { principal: { role: ['candidate', 'recruiter'].includes(token) ? token.toUpperCase() : 'ADMIN', sub: `user:${token}` } };
  } }) });
  const app = express(); app.use(express.json());
  app.use('/api/v1/admin', createAdminBackupRouter({ authenticate: auth, serviceProvider: () => fixture.service }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (suffix = '', token = 'admin', body) => fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/backups${suffix}`, {
    method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { ...fixture, request };
}

test('all backup APIs require authenticated active Admin before validation or service calls', async t => {
  const { request } = await apiFixture(t);
  for (const token of [null, 'candidate', 'recruiter', 'expired', 'locked']) {
    for (const route of ['/sources', '/bad-id', '/bad-id/download']) {
      const r = await request(route, token); assert.equal(r.status, ['candidate', 'recruiter'].includes(token) ? 403 : 401);
      assert.equal(r.headers.get('cache-control'), 'no-store');
    }
    const r = await request('', token, { source_id: 'business' });
    assert.equal(r.status, ['candidate', 'recruiter'].includes(token) ? 403 : 401);
  }
});

test('Admin HTTP round-trip creates/polls/downloads signed RHBR; rejects other owner and bad inputs', async t => {
  const { request, service } = await apiFixture(t);
  assert.equal((await request('/sources')).status, 200);
  assert.equal((await request('', 'admin', { source_id: 'business', url: 'http://attacker' })).status, 400);
  assert.equal((await request('/../escape')).status, 404);
  assert.equal((await request('/invalid-id')).status, 400);
  const created = await request('', 'admin', { source_id: 'business' }); assert.equal(created.status, 202);
  const { data } = await created.json(); await service.pending.get(data.job_id);
  const status = await request(`/${data.job_id}`); assert.equal((await status.json()).data.status, 'SUCCEEDED');
  assert.equal((await request(`/${data.job_id}`, 'other')).status, 404);
  assert.equal((await request(`/${data.job_id}/download`, 'other')).status, 404);
  const download = await request(`/${data.job_id}/download`);
  assert.equal(download.status, 200); assert.equal(download.headers.get('content-type'), 'application/gzip');
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.match(download.headers.get('content-disposition'), /^attachment; filename="recruithub-backup-/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await download.arrayBuffer()); assert.equal(Number(download.headers.get('content-length')), bytes.length);
  assert.equal(JSON.parse(gunzipSync(bytes).toString().split('\n')[0]).format, 'recruithub-backup');
  // Authentication is checked anew, including on already-created artifacts.
  assert.equal((await request(`/${data.job_id}/download`, 'locked')).status, 401);
});

test('missing signing config disables feature without crashing HTTP server or exposing keys', async t => {
  const { request, service } = await apiFixture(t); service.env = {};
  const r = await request('/sources'); assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, 'BACKUP_CONFIGURATION_ERROR');
});

test('client-cancelled download closes streams and leaves the successful artifact reusable', async t => {
  const bytes = randomBytes(512 * 1024);
  const reader = sourceReader([{ _id: 'asset:test', type: 'uploaded_asset', _attachments: {
    content: { content_type: 'application/octet-stream', data: bytes.toString('base64') },
  } }]);
  const { request, service } = await apiFixture(t, { reader });
  const r = await request('', 'admin', { source_id: 'business' }); const id = (await r.json()).data.job_id;
  await service.pending.get(id);
  const first = await request(`/${id}/download`); assert.equal(first.status, 200); await first.body.cancel();
  const second = await request(`/${id}/download`); const archive = await second.arrayBuffer();
  assert.ok(gunzipSync(Buffer.from(archive)).length > bytes.length);
  assert.equal((await (await request(`/${id}`)).json()).data.status, 'SUCCEEDED');
});

test('actual createApp mount uses real JWT guard and reloads Admin role/status', async t => {
  const f = createFixture();
  // Obtain a canonical schema-valid user from the existing fixture repository.
  const base = [...f.repo.docs.values()].find(doc => doc.type === 'user');
  const user = { ...base, role: 'ADMIN', account_status: 'ACTIVE' };
  f.repo.docs.set(user._id, user);
  const secret = 'backup-jwt-test-secret-at-least-thirty-two-bytes';
  const { service } = await serviceFixture(t);
  const app = createApp({ repository: f.repo, backupService: service,
    jwtEnv: { JWT_ACCESS_SECRET: secret, FRONTEND_URL: 'http://127.0.0.1:5178' } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const token = issueAccessToken({ sub: user._id, role: 'ADMIN' }, { secret });
  const call = () => fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/backups/sources`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await call()).status, 200);
  const created = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/backups`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: 'business' }),
  });
  assert.equal(created.status, 202);
  await service.pending.get((await created.json()).data.job_id);
  user.role = 'CANDIDATE'; assert.equal((await call()).status, 403);
  user.account_status = 'LOCKED'; assert.equal((await call()).status, 401);
  assert.equal(f.repo.writes.length, 0);
});
