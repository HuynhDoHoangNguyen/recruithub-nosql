import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createAdminBackupRouter } from '../../src/routes/admin-backup.routes.js';
import { AuthServiceError } from '../../src/services/auth.service.js';
import { createAuthenticate } from '../../src/middleware/authenticate.js';
import { BACKUP_LIMITS } from '../../src/models/admin-backup.schema.js';
import { archiveFixture, restoreFixture } from '../helpers/admin-restore-fixtures.js';

async function serverFixture(t, options) {
  const f = await restoreFixture(t, options);
  const authenticate = createAuthenticate({ serviceProvider: () => ({ async authenticate(token) {
    if (['locked', 'expired'].includes(token)) throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Invalid session');
    return { principal: { sub: `user:${token}`, role: ['candidate', 'recruiter'].includes(token) ? token.toUpperCase() : 'ADMIN' } };
  } }) });
  const app = express(); app.use(express.json({ limit: '512kb' }));
  app.use('/api/v1/admin', createAdminBackupRouter({ authenticate, serviceProvider: () => f.service }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (route, { token = 'admin', body, binary = false, type } = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin${route}`, {
    method: body !== undefined ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': type || (binary ? 'application/octet-stream' : 'application/json') } : {}) },
    ...(body !== undefined ? { body: binary ? body : JSON.stringify(body) } : {}),
  });
  return { ...f, request, origin: `http://127.0.0.1:${server.address().port}` };
}

test('upload and restore APIs apply role/session guard before accepting bytes or JSON', async t => {
  const f = await serverFixture(t);
  for (const token of [null, 'candidate', 'recruiter', 'locked', 'expired']) {
    const expected = ['candidate', 'recruiter'].includes(token) ? 403 : 401;
    for (const [route, body, binary] of [['/backups/validate', Buffer.from('bad'), true], ['/restores', {}, false], ['/restores/invalid', undefined, false]]) {
      const r = await f.request(route, { token, body, binary }); assert.equal(r.status, expected); assert.equal(r.headers.get('cache-control'), 'no-store');
    }
  }
  assert.equal(f.repositories.length, 0);
});

test('HTTP upload -> validation -> restore -> status works and enforces owner and strict payload', async t => {
  const f = await serverFixture(t); const archive = await archiveFixture(t);
  assert.equal((await f.request('/backups/validate', { body: 'bad', binary: true, type: 'text/plain' })).status, 415);
  assert.equal((await f.request('/restores', { body: { validation_id: 'bad', target_database: 'recruitment_db', confirm: true } })).status, 400);
  const upload = await f.request('/backups/validate', { body: archive.bytes, binary: true }); assert.equal(upload.status, 202);
  const validationId = (await upload.json()).data.job_id; await f.service.pending.get(validationId);
  const validation = await (await f.request(`/backups/${validationId}`)).json(); assert.equal(validation.data.status, 'SUCCEEDED');
  assert.equal((await f.request(`/backups/${validationId}/download`)).status, 404);
  const payload = { validation_id: validationId, target_database: 'recruithub_restore_test_http', confirm: true };
  assert.equal((await f.request('/restores', { token: 'other', body: payload })).status, 404);
  assert.equal((await f.request('/restores', { body: { ...payload, url: 'http://attacker' } })).status, 400);
  const restore = await f.request('/restores', { body: payload }); assert.equal(restore.status, 202);
  const id = (await restore.json()).data.job_id; await f.service.pending.get(id);
  const result = await (await f.request(`/restores/${id}`)).json(); assert.equal(result.data.status, 'SUCCEEDED');
  assert.equal(result.data.result.requires_manual_configuration, true);
  assert.equal((await f.request(`/restores/${id}`, { token: 'other' })).status, 404);
  assert.equal((await f.request(`/backups/${id}`)).status, 404);
  assert.equal((await f.request('/restores', { body: payload })).status, 409);
});

test('oversize binary upload returns 413 and leaves no reusable validation/target', async t => {
  const f = await serverFixture(t, { limits: { ...BACKUP_LIMITS, compressed: 10 } });
  const result = await f.request('/backups/validate', { body: Buffer.alloc(100), binary: true });
  assert.equal(result.status, 413); assert.equal(f.repositories.length, 0);
});

test('aborted binary upload fails job, removes partial and releases the shared lock', async t => {
  const f = await serverFixture(t); await f.service.ready();
  const req = http.request(f.origin + '/api/v1/admin/backups/validate', { method: 'POST', headers: {
    Authorization: 'Bearer admin', 'Content-Type': 'application/octet-stream',
  } });
  req.on('error', () => {}); req.write(Buffer.from('partial gzip bytes'));
  let job;
  for (let i = 0; i < 100; i++) {
    const ids = await fs.readdir(f.store.root);
    if (ids.length) { job = await f.store.read(ids[0]).catch(() => null); if (job?.status === 'RUNNING') break; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(job?.status, 'RUNNING'); req.destroy();
  for (let i = 0; i < 100; i++) {
    job = await f.store.read(job.id); if (job.status === 'FAILED') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(job.status, 'FAILED'); assert.equal(f.repositories.length, 0);
  const next = await f.service.create('user:admin', 'business'); await f.service.pending.get(next.job_id);
  assert.equal((await f.service.status('user:admin', next.job_id)).status, 'SUCCEEDED');
});
