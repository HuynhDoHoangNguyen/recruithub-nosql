import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { getAuditDatabaseConfig } from '../../src/config/audit-database.config.js';
import { AuditEventRepository } from '../../src/repositories/audit-event.repository.js';
import { auditEventSchema } from '../../src/schemas/audit-event.schema.js';
import { toAuditEventDto } from '../../src/services/audit-event-mapper.js';
import { AuditDeliveryService } from '../../src/services/audit-delivery.service.js';
import { provisionAuditStore } from '../../../scripts/database/provision-audit-store.mjs';
import { createConfiguredAdminAuditService } from '../../src/services/admin-audit.service.js';
import { createAdminUserRouter } from '../../src/routes/admin-user.routes.js';
import { createSystemEventReporter } from '../../src/services/system-event.service.js';

function event(overrides = {}) {
  return {
    schema_version: 1, kind: 'audit_trail', event_id: randomUUID(), correlation_id: randomUUID(),
    occurred_at: '2026-11-12T12:00:00.000Z', outcome: 'SUCCEEDED', action: 'APPLICATION_STAGE_CHANGED',
    actor: { type: 'USER', id: 'user:demo', role: 'RECRUITER' },
    subject: { type: 'APPLICATION', id: 'application:demo' },
    change: { field: 'current_stage', from: 'SCREENING', to: 'INTERVIEW' },
    ...overrides,
  };
}

function systemEvent(occurred_at) {
  return event({
    kind: 'system_log', action: 'AUDIT_DELIVERY_FAILED', outcome: 'FAILED', occurred_at,
    actor: { type: 'SYSTEM' }, subject: { type: 'COMPONENT', id: 'audit-delivery' },
    change: undefined, code: 'EVENT_STORE_UNAVAILABLE',
  });
}

test('Audit allowlist rejects sensitive fields at write and projects only approved fields at read', () => {
  const valid = event();
  const contaminated = {
    ...valid,
    token: 'secret', credentials: {}, request_body: {}, stack: 'trace',
    actor: { ...valid.actor, email: 'demo@example.test', password_hash: 'secret' },
    change: { ...valid.change, cv: 'content', evidence: 'private' },
  };
  assert.equal(auditEventSchema.safeParse(contaminated).success, false);
  assert.deepEqual(toAuditEventDto(contaminated), valid);
  assert.equal(auditEventSchema.safeParse(event({ outcome: 'FAILED' })).success, false);
  assert.equal(auditEventSchema.safeParse(event({ change: { ...valid.change, to: 'SCREENING' } })).success, false);
  assert.equal(auditEventSchema.safeParse(event({ occurred_at: '2026-11-12T12:00:00+07:00' })).success, false);
  assert.equal(auditEventSchema.safeParse(event({ actor: { ...valid.actor, role: 'ADMIN' } })).success, false);
  assert.equal(auditEventSchema.safeParse(event({ action: 'USER_ROLE_CHANGED' })).success, false);
  assert.equal(auditEventSchema.safeParse(event({
    action: 'USER_ACCOUNT_STATUS_CHANGED', actor: { ...valid.actor, role: 'ADMIN' },
    subject: { type: 'USER', id: 'user:target' },
    change: { field: 'account_status', from: 'ACTIVE', to: 'LOCKED' },
  })).success, true);
  assert.equal(auditEventSchema.safeParse(event({
    action: 'JOB_STATUS_CHANGED', subject: { type: 'JOB', id: 'job:demo' },
    change: { field: 'status', from: 'OPEN', to: 'CLOSED' }, operation: 'SOFT_DELETE',
  })).success, true);
});

test('Audit target is explicit and rejects primary, auth and configured business databases', () => {
  for (const environment of [
    {},
    { AUDIT_COUCHDB_DATABASE: 'recruitment_db' },
    { AUDIT_COUCHDB_DATABASE: 'recruithub_logs_auth', AUTH_COUCHDB_DATABASE: 'recruithub_logs_auth' },
    { AUDIT_COUCHDB_DATABASE: 'recruithub_logs_primary', COUCHDB_DATABASE: 'recruithub_logs_primary' },
  ]) {
    assert.throws(() => getAuditDatabaseConfig(environment), { code: 'INVALID_AUDIT_DATABASE' });
  }
});

const testUrl = process.env.RECRUITHUB_AUDIT_TEST_URL;

test('CouchDB audit store provisions, enforces permissions, reconciles duplicate writes, queries views and expires by kind', {
  skip: !testUrl, timeout: 60000,
}, async t => {
  const password = randomUUID();
  const admin = process.env.RECRUITHUB_AUDIT_TEST_ADMIN;
  const adminPassword = process.env.RECRUITHUB_AUDIT_TEST_PASSWORD;
  const suffix = randomUUID().replaceAll('-', '');
  const names = Object.fromEntries(['writer', 'reader', 'pruner', 'outsider'].map(role => [role, role + '_' + suffix]));
  const environment = {
    AUDIT_COUCHDB_URL: testUrl,
    AUDIT_COUCHDB_DATABASE: 'recruithub_logs_test_' + suffix,
    AUDIT_COUCHDB_USER: admin,
    AUDIT_COUCHDB_PASSWORD: adminPassword,
    AUDIT_COUCHDB_WRITER: names.writer,
    AUDIT_COUCHDB_READER: names.reader,
    AUDIT_COUCHDB_PRUNER: names.pruner,
  };
  function request(path, method, user, pass, body) {
    return fetch(testUrl + path, {
      method, headers: { Authorization: 'Basic ' + Buffer.from(user + ':' + pass).toString('base64'),
        'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
    });
  }
  for (const name of Object.values(names)) {
    const response = await request('/_users/org.couchdb.user:' + name, 'PUT', admin, adminPassword, {
      name, password, roles: [], type: 'user',
    });
    assert.equal(response.status, 201);
  }
  assert.equal((await provisionAuditStore(environment)).created, true);
  assert.equal((await provisionAuditStore(environment)).created, false);
  const config = user => getAuditDatabaseConfig({
    ...environment, AUDIT_COUCHDB_USER: user, AUDIT_COUCHDB_PASSWORD: password,
  });
  const writer = new AuditEventRepository(config(names.writer));
  const reader = new AuditEventRepository(config(names.reader));
  const pruner = new AuditEventRepository(config(names.pruner));
  const query = { kind: 'audit_trail', from: '2026-11-12T12:00:00.000Z', to: '2026-11-13T00:00:00.000Z' };
  const dependencyReporter = createSystemEventReporter({ sink: writer,
    now: () => new Date('2026-11-12T12:30:00.000Z') });
  const dependencyResult = await dependencyReporter.dependencyWriteFailed({
    actor: { _id: 'user:demo', role: 'RECRUITER' }, component: 'job', correlationId: randomUUID(),
  });
  assert.equal(dependencyResult.logged, true);
  const dependencyPage = await reader.list({
    kind: 'system_log', action: 'DEPENDENCY_WRITE_FAILED',
    from: '2026-11-12T12:00:00.000Z', to: '2026-11-13T00:00:00.000Z',
  });
  assert.equal(dependencyPage.items.length, 1);
  assert.equal(dependencyPage.items[0].event_id, dependencyResult.event_id);
  assert.doesNotMatch(JSON.stringify(dependencyPage), /email|password|token|credentials/i);
  const first = event();
  await assert.rejects(reader.append(first), { code: 'EVENT_STORE_UNAVAILABLE' });
  await assert.rejects(pruner.append(first), { code: 'EVENT_STORE_UNAVAILABLE' });
  await assert.rejects(new AuditEventRepository(config(names.outsider)).list(query), { code: 'EVENT_STORE_UNAVAILABLE' });
  const concurrent = await Promise.all([writer.append(first), writer.append(first)]);
  assert.equal(concurrent.filter(result => result.created).length, 1);
  const eventPath = '/' + environment.AUDIT_COUCHDB_DATABASE + '/' + encodeURIComponent('event:' + first.event_id);
  const stored = await (await request(eventPath, 'GET', names.reader, password)).json();
  assert.equal((await request(eventPath, 'PUT', names.writer, password, stored)).status, 403);
  for (const name of [names.writer, names.reader]) {
    assert.equal((await request(eventPath + '?rev=' + stored._rev, 'DELETE', name, password)).status, 403);
  }
  await assert.rejects(writer.append({ ...first, correlation_id: randomUUID() }), { code: 'EVENT_ID_CONFLICT' });
  const second = event();
  const losingResponse = new AuditEventRepository(config(names.writer), async (url, options) => {
    const response = await fetch(url, options);
    if (options.method === 'PUT') {
      assert.equal(response.status, 201);
      throw new Error('simulated lost response');
    }
    return response;
  });
  await assert.rejects(losingResponse.append(second), { code: 'EVENT_STORE_UNAVAILABLE' });
  assert.equal((await writer.append(second)).created, false);
  await writer.append(event({ occurred_at: query.to }));
  const expected = [first.event_id, second.event_id].sort().reverse();
  for (const filter of [{}, { action: first.action }, { actorId: first.actor.id }, { subject: first.subject }]) {
    const page = await reader.list({ ...query, ...filter, limit: 1 });
    assert.equal(page.has_more, true);
    const next = await reader.list({ ...query, ...filter, limit: 1, after: page.next_after });
    assert.deepEqual([...page.items, ...next.items].map(item => item.event_id), expected);
    assert.equal(next.has_more, false);
  }

  const now = new Date('2026-11-12T12:00:00.000Z');
  for (const [kind, days] of [['audit_trail', 180], ['system_log', 30]]) {
    const cutoff = now.getTime() - days * 86400000;
    for (const delta of [-2, -1, 0, 1]) {
      const occurred_at = new Date(cutoff + delta).toISOString();
      const record = kind === 'audit_trail' ? event({ occurred_at }) : systemEvent(occurred_at);
      const { change, ...rest } = record;
      await writer.append(kind === 'audit_trail' ? record : rest);
    }
  }
  const dry = await pruner.prune({ now, batchSize: 1 });
  const applied = await pruner.prune({ now, batchSize: 1, dryRun: false });
  const repeated = await pruner.prune({ now, batchSize: 1, dryRun: false });
  for (const kind of ['audit_trail', 'system_log']) {
    assert.equal(dry[kind].scanned, 2);
    assert.equal(dry[kind].deleted, 0);
    assert.equal(applied[kind].deleted, 2);
    assert.equal(applied[kind].errors, 0);
    assert.equal(repeated[kind].scanned, 0);
  }

  const deliveryEvent = event();
  let pending = { sourceRef: 'application:demo', event: deliveryEvent };
  const source = {
    async listPending() { return pending ? [pending] : []; },
    async readEntry() { return pending && { ...pending, revision: '1-test', state: 'pending' }; },
    async updateEntry() { throw new Error('ack unavailable after real CouchDB write'); },
  };
  const beforeRestart = await new AuditDeliveryService({ source, sink: writer }).runBatch();
  assert.equal(beforeRestart.source_retryable, 1);
  assert.ok(pending);
  source.updateEntry = async () => { pending = null; };
  const afterRestart = await new AuditDeliveryService({ source, sink: writer }).runBatch();
  assert.equal(afterRestart.delivered, 1);
  assert.equal(pending, null);
  const delivered = await reader.list(query);
  assert.deepEqual(delivered.items.filter(item => item.event_id === deliveryEvent.event_id), [deliveryEvent]);

  const systemRecord = systemEvent(first.occurred_at);
  delete systemRecord.change;
  await writer.append(systemRecord);
  const contaminated = event();
  const rawPath = '/' + environment.AUDIT_COUCHDB_DATABASE + '/' + encodeURIComponent('event:' + contaminated.event_id);
  assert.equal((await request(rawPath, 'PUT', names.writer, password, {
    ...contaminated, _id: 'event:' + contaminated.event_id, password_hash: 'private',
    actor: { ...contaminated.actor, email: 'private@example.invalid' }, evidence: 'private',
  })).status, 201);
  const app = express();
  const auditEnvironment = { ...environment, AUDIT_COUCHDB_READER_PASSWORD: password, AUDIT_CURSOR_SECRET: randomUUID() };
  const servicesFactory = () => ({
    auth: { async authenticate() { return { principal: { role: 'ADMIN', sub: 'user:demo' } }; } },
  });
  app.use('/admin', createAdminUserRouter({
    servicesFactory, auditServiceFactory: () => createConfiguredAdminAuditService(auditEnvironment),
  }));
  app.use('/unavailable', createAdminUserRouter({
    servicesFactory, auditServiceFactory: () => createConfiguredAdminAuditService({
      ...auditEnvironment, AUDIT_COUCHDB_READER: names.outsider,
    }),
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const fetchLog = path => fetch('http://127.0.0.1:' + server.address().port + path,
    { headers: { Authorization: 'Bearer admin' } });
  const window = '?from=' + query.from + '&to=' + query.to;
  const auditEndpoint = '/admin/audit-trails';
  const expectedIds = [first, second, deliveryEvent, contaminated].map(event => event.event_id).sort().reverse();
  for (const filter of ['', '&action=' + first.action, '&actor_id=' + first.actor.id,
    '&subject_type=' + first.subject.type + '&subject_id=' + first.subject.id]) {
    const ids = [];
    let url = auditEndpoint + window + filter + '&limit=1';
    do {
      const response = await fetchLog(url);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.text();
      assert.doesNotMatch(body, /password_hash|private|evidence|"_rev"|"next_after"/);
      const page = JSON.parse(body).data;
      ids.push(...page.items.map(item => item.event_id));
      assert.ok(ids.length <= expectedIds.length);
      url = page.next_cursor && auditEndpoint + '?cursor=' + page.next_cursor;
    } while (url);
    assert.deepEqual(ids, expectedIds);
  }
  const logs = await fetchLog('/admin/system-logs' + window + '&action=' + systemRecord.action);
  assert.equal(logs.status, 200);
  assert.deepEqual((await logs.json()).data.items, [systemRecord]);
  const denied = await fetchLog('/unavailable/system-logs' + window);
  assert.equal(denied.status, 503);
  assert.equal((await denied.json()).error.code, 'AUDIT_READ_UNAVAILABLE');
});
