import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { AuthServiceError } from '../../src/services/auth.service.js';
import { requestCorrelation } from '../../src/middleware/request-correlation.js';
import { createAdminUserRouter } from '../../src/routes/admin-user.routes.js';
import { createAdminAuditService, createConfiguredAdminAuditService } from '../../src/services/admin-audit.service.js';

async function start(t, auditServiceFactory) {
  const app = express();
  app.use(requestCorrelation);
  app.use('/api/v1/admin', createAdminUserRouter({
    auditServiceFactory,
    servicesFactory: () => ({
      auth: { async authenticate(token) {
        if (['expired', 'locked'].includes(token)) throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Invalid session.');
        return { principal: { role: token.toUpperCase(), sub: 'user:test' } };
      } },
      admin: { async getStatistics() { return { users: 1 }; } },
    }),
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return (path, token = 'admin') => fetch('http://127.0.0.1:' + server.address().port + '/api/v1/admin/' + path,
    { headers: token ? { Authorization: 'Bearer ' + token } : {} });
}

const range = 'from=2026-11-01T00:00:00Z&to=2026-11-12T00:00:00Z';
const empty = { items: [], has_more: false, next_after: null };
const secret = 'test-audit-signing-key-at-least-32-bytes';

test('Admin log routes authenticate before lazy storage initialization and isolate configuration failures', async t => {
  let initialized = 0;
  const request = await start(t, () => { initialized++; return createConfiguredAdminAuditService({}); });
  for (const [token, status] of [[null, 401], ['expired', 401], ['locked', 401], ['candidate', 403], ['recruiter', 403]]) {
    const response = await request('audit-trails', token);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(initialized, 0);
  assert.equal((await request('stats')).status, 200);
  assert.equal(initialized, 0);
  for (const endpoint of ['audit-trails', 'system-logs']) {
    const response = await request(endpoint);
    assert.equal(response.status, 503);
    assert.ok(response.headers.get('x-request-id'));
    assert.equal((await response.json()).error.code, 'AUDIT_READ_UNAVAILABLE');
  }
  assert.equal((await request('stats')).status, 200);
});

test('Admin log queries are strict, validate ranges and use a fixed signed cursor across requests', async t => {
  const after = { occurred_at: '2026-11-11T00:00:00.000Z', event_id: randomUUID() };
  let now = '2026-11-12T00:00:00.000Z';
  const queries = [];
  const request = await start(t, () => createAdminAuditService({
    secret, now: () => new Date(now), repository: { async list(query) {
      queries.push(query);
      return query.after ? empty : { items: [], has_more: true, next_after: after };
    } },
  }));
  for (const path of [
    'audit-trails?limit=101', 'audit-trails?limit=1&limit=2', 'audit-trails?kind=system_log',
    'system-logs?actor_id=user:test', 'audit-trails?subject_type=USER',
    'audit-trails?subject_type=USER&subject_id=job:test',
    'audit-trails?from=2026-10-01T00:00:00Z&to=2026-11-12T00:00:00Z',
    'audit-trails?from=2026-11-12T00:00:00Z',
    'audit-trails?from=2026-11-11T00:00:00%2B07:00&to=2026-11-12T00:00:00Z',
    'audit-trails?action=AUDIT_DELIVERY_FAILED', 'audit-trails?actor_id=user:test&action=JOB_STATUS_CHANGED',
  ]) assert.equal((await request(path)).status, 400, path);
  assert.equal(queries.length, 0);
  const first = await request('audit-trails?actor_id=user:test&limit=1');
  assert.equal(first.status, 200);
  const cursor = (await first.json()).data.next_cursor;
  assert.equal(queries[0].from, '2026-11-05T00:00:00.000Z');
  now = '2026-11-14T00:00:00.000Z';
  const next = await request('audit-trails?cursor=' + cursor);
  assert.deepEqual((await next.json()).data, { items: [], has_more: false, next_cursor: null });
  assert.deepEqual(queries[1], { ...queries[0], after });
  for (const path of [
    'system-logs?cursor=' + cursor,
    'audit-trails?cursor=' + cursor + '&actor_id=user:other',
    'audit-trails?cursor=' + cursor + '&' + range,
    'audit-trails?cursor=' + cursor + 'x',
  ]) {
    const response = await request(path);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_CURSOR');
  }
  assert.equal(queries.length, 2);
});

test('Admin read errors do not disclose storage details', async t => {
  const request = await start(t, () => createAdminAuditService({
    secret, repository: { async list() { throw new Error('private credential and stack'); } },
  }));
  const response = await request('system-logs?' + range);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await response.text(), /credential|stack/);
});
