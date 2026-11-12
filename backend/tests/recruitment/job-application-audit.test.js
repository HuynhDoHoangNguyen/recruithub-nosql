import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import express from 'express';
import { createApp } from '../../src/app.js';
import { getAuditDatabaseConfig } from '../../src/config/audit-database.config.js';
import { AuditEventRepository } from '../../src/repositories/audit-event.repository.js';
import { buildAuditSourceDesignV1, JobApplicationAuditSource, provisionAuditSource } from '../../src/repositories/job-application-audit-source.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { createCouchDbClient } from '../../src/services/couchdb.client.js';
import { AdminUserService } from '../../src/services/admin-user.service.js';
import { createAdminAuditService } from '../../src/services/admin-audit.service.js';
import { createAdminUserRouter } from '../../src/routes/admin-user.routes.js';
import { requestCorrelation } from '../../src/middleware/request-correlation.js';
import { JobApplicationRepository } from '../../src/repositories/job-application.repository.js';
import { AuditDeliveryService } from '../../src/services/audit-delivery.service.js';
import { provisionAuditStore } from '../../../scripts/database/provision-audit-store.mjs';
import { createFixture, mutation, signToken, startFixture, submission } from './fixtures.js';

test('Audit producer keeps old pending events on reapply and excludes private metadata from HTTP responses', async t => {
  const f = await startFixture(t);
  const initial = (await f.request('POST', '/applications', { job_id: f.job._id, submission })).body.data;
  assert.equal((await f.repo.get(initial._id)).audit_outbox, undefined);
  const withdrawn = (await f.request('PATCH', '/applications/' + initial._id + '/withdraw', mutation(initial))).body.data;
  const before = (await f.repo.get(initial._id)).audit_outbox[0];
  const payload = { job_id: f.job._id, submission, request_id: randomUUID(), expected_rev: withdrawn._rev };
  const reapplied = await f.request('POST', '/applications', payload);
  assert.equal(reapplied.status, 201);
  assert.equal(reapplied.body.data.audit_outbox, undefined);
  assert.equal((await f.request('POST', '/applications', payload)).status, 201);
  const entries = (await f.repo.get(initial._id)).audit_outbox;
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], before);
  assert.deepEqual(entries[1].event.change, { field: 'current_stage', from: 'WITHDRAWN', to: 'APPLIED' });
  assert.equal(entries[1].event.actor.id, f.users.candidate._id);
  assert.doesNotMatch(JSON.stringify(entries), /resume_text|cover_letter|evidence|email/);

  const job = await f.repo.get(f.job._id);
  const close = await f.request('PATCH', '/jobs/' + job._id + '/status', { status: 'CLOSED', expected_rev: job._rev }, 'recruiter');
  assert.equal(close.status, 200);
  assert.equal(close.body.data.audit_outbox, undefined);
  const list = await f.request('GET', '/recruiter/jobs?status=CLOSED', undefined, 'recruiter');
  const detail = await f.request('GET', '/recruiter/jobs/' + f.job._id, undefined, 'recruiter');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.audit_outbox, undefined);
  assert.equal(list.body.data.items[0].audit_outbox, undefined);
  const removed = await f.request('DELETE', '/jobs/' + f.job._id, { expected_rev: close.body.data._rev }, 'recruiter');
  assert.equal(removed.status, 200);
  assert.equal((await f.repo.get(f.job._id)).audit_outbox.length, 1);
});

test('Audit backlog rejects covered mutations before write and ordinary Job edit preserves pending', async t => {
  const f = await startFixture(t);
  const initialJob = await f.repo.get(f.job._id);
  const removed = await f.request('DELETE', '/jobs/' + initialJob._id, { expected_rev: initialJob._rev }, 'recruiter');
  assert.equal(removed.status, 200);
  assert.equal((await f.repo.get(f.job._id)).audit_outbox[0].event.operation, 'SOFT_DELETE');

  let job = await f.repo.get(f.otherJob._id);
  for (let index = 0; index < 32; index++) {
    const status = job.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    const result = await f.request('PATCH', '/jobs/' + job._id + '/status', { status, expected_rev: job._rev }, 'otherRecruiter');
    assert.equal(result.status, 200);
    job = result.body.data;
  }
  const before = await f.repo.get(job._id);
  const rejected = await f.request('PATCH', '/jobs/' + job._id + '/status',
    { status: job.status === 'OPEN' ? 'CLOSED' : 'OPEN', expected_rev: job._rev }, 'otherRecruiter');
  assert.equal(rejected.status, 503);
  assert.equal(rejected.body.error.code, 'AUDIT_BACKLOG_FULL');
  assert.deepEqual(await f.repo.get(job._id), before);
  assert.equal(before.status, 'OPEN');
  const edited = await f.request('PATCH', '/jobs/' + job._id, { title: 'Tên tin đã sửa', expected_rev: job._rev }, 'otherRecruiter');
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.audit_outbox, undefined);
  assert.deepEqual((await f.repo.get(job._id)).audit_outbox, before.audit_outbox);
});

const testUrl = process.env.RECRUITHUB_AUDIT_TEST_URL;
test('Express mutation and revision-guarded source delivery run through separate CouchDB databases', {
  skip: !testUrl, timeout: 60000,
}, async t => {
  const admin = process.env.RECRUITHUB_AUDIT_TEST_ADMIN;
  const adminPassword = process.env.RECRUITHUB_AUDIT_TEST_PASSWORD;
  const suffix = randomUUID().replaceAll('-', '');
  const database = 'recruithub_source_test_' + suffix;
  const worker = 'worker_' + suffix;
  const password = randomUUID();
  const header = (user, pass) => 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
  const adminHeader = header(admin, adminPassword);
  const workerHeader = header(worker, password);
  const request = (path, method, authorization, data) => fetch(testUrl + path, {
    method, headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    ...(data && { body: JSON.stringify(data) }),
  });
  assert.equal((await request('/_users/org.couchdb.user:' + worker, 'PUT', adminHeader,
    { name: worker, password, roles: [], type: 'user' })).status, 201);
  assert.equal((await request('/' + database, 'PUT', adminHeader)).status, 201);
  assert.equal((await request('/' + database + '/_security', 'PUT', adminHeader,
    { admins: { names: [], roles: [] }, members: { names: [worker], roles: [] } })).status, 200);
  const repository = new JobApplicationRepository({ url: testUrl, database, authHeader: adminHeader });
  const workerRepo = new JobApplicationRepository({ url: testUrl, database, authHeader: workerHeader });
  await repository.put(buildAuditSourceDesignV1(worker, { includeUsers: false }));
  await provisionAuditSource(repository, worker);
  await provisionAuditSource(repository, worker);
  const f = createFixture();
  for (const { _rev, ...document } of f.repo.docs.values()) await repository.put(document);
  const environment = {
    AUDIT_COUCHDB_URL: testUrl, AUDIT_COUCHDB_DATABASE: 'recruithub_logs_' + suffix,
    AUDIT_COUCHDB_USER: admin, AUDIT_COUCHDB_PASSWORD: adminPassword,
    AUDIT_COUCHDB_WRITER: worker, AUDIT_COUCHDB_READER: 'reader_' + suffix, AUDIT_COUCHDB_PRUNER: 'pruner_' + suffix,
  };
  await provisionAuditStore(environment);
  const sink = new AuditEventRepository(getAuditDatabaseConfig({
    ...environment, AUDIT_COUCHDB_USER: worker, AUDIT_COUCHDB_PASSWORD: password,
  }));
  const source = new JobApplicationAuditSource(workerRepo, { worker, now: f.now });
  const jwtEnv = { JWT_ACCESS_SECRET: randomUUID() };
  const app = createApp({ repository, jwtEnv, now: f.now, analyzeApplication: async () => {} });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const call = (method, path, data, user) => fetch('http://127.0.0.1:' + server.address().port + '/api/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + signToken(jwtEnv, f.users[user], {}, {}, f.now()),
      'Content-Type': 'application/json' },
    ...(data && { body: JSON.stringify(data) }),
  });
  const appliedResponse = await call('POST', '/applications', { job_id: f.job._id, submission }, 'candidate');
  assert.equal(appliedResponse.status, 201);
  const applied = (await appliedResponse.json()).data;
  const path = '/applications/' + applied._id + '/stage';
  const input = mutation(applied, { to_stage: 'SCREENING' });
  const denied = await call('PATCH', path, input, 'candidate');
  assert.equal(denied.status, 403);
  assert.equal((await repository.get(applied._id)).audit_outbox, undefined);
  const results = await Promise.all([call('PATCH', path, input, 'recruiter'), call('PATCH', path, input, 'recruiter')]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  const winner = results.find(response => response.ok);
  const saved = await repository.get(applied._id);
  assert.equal(saved.audit_outbox.length, 1);
  const event = saved.audit_outbox[0].event;
  assert.equal(event.correlation_id, winner.headers.get('X-Request-Id'));
  assert.equal(event.actor.id, f.users.recruiter._id);
  assert.equal(saved.current_stage, 'SCREENING');

  const job = await repository.get(f.job._id);
  const jobPath = '/jobs/' + job._id + '/status';
  const put = repository.put.bind(repository);
  repository.put = async (document, options) => {
    const result = await put(document, options);
    if (document._id === job._id) throw new Error('Simulated lost mutation response');
    return result;
  };
  const lost = await call('PATCH', jobPath, { status: 'CLOSED', expected_rev: job._rev }, 'recruiter');
  assert.equal(lost.status, 500);
  repository.put = put;
  const closed = await repository.get(job._id);
  assert.equal(closed.status, 'CLOSED');
  assert.equal(closed.audit_outbox[0].event.correlation_id, lost.headers.get('X-Request-Id'));
  assert.equal((await request('/' + database + '/' + encodeURIComponent(job._id), 'PUT', workerHeader,
    { ...closed, title: 'Forbidden edit', audit_outbox: [] })).status, 403);

  const outage = new AuditDeliveryService({ source, sink: { async append() { throw new Error('Offline'); } }, now: f.now });
  assert.equal((await outage.runBatch()).sink_retryable, 2);
  const incidentDocument = await repository.get(applied._id);
  const incidentEntry = incidentDocument.audit_outbox[0];
  assert.equal(incidentEntry.delivery_incident.code, 'EVENT_STORE_UNAVAILABLE');
  assert.equal(incidentEntry.delivery_incident.attempts, 1);
  assert.equal((await request('/' + database + '/' + encodeURIComponent(applied._id), 'PUT', workerHeader, {
    ...incidentDocument,
    audit_outbox: [{ ...incidentEntry, event: { ...incidentEntry.event, correlation_id: randomUUID() } }],
  })).status, 403);
  assert.equal((await request('/' + database + '/' + encodeURIComponent(applied._id), 'PUT', workerHeader, {
    ...incidentDocument,
    audit_outbox: [{ ...incidentEntry, delivery_incident: { ...incidentEntry.delivery_incident, failure_event_id: randomUUID() } }],
  })).status, 403);
  const settle = source.updateEntry.bind(source);
  source.updateEntry = async () => { throw new Error('Ack interrupted'); };
  assert.equal((await new AuditDeliveryService({ source, sink, now: f.now }).runBatch()).source_retryable, 2);
  source.updateEntry = settle;
  const reports = await Promise.all([
    new AuditDeliveryService({ source, sink, now: f.now }).runBatch(),
    new AuditDeliveryService({ source, sink, now: f.now }).runBatch(),
  ]);
  assert.equal(reports.reduce((total, report) => total + report.delivered, 0), 2, JSON.stringify(reports));
  assert.deepEqual((await repository.get(applied._id)).audit_outbox, []);
  assert.deepEqual((await repository.get(job._id)).audit_outbox, []);
  const audit = await sink.list({ kind: 'audit_trail', from: '2026-10-22T00:00:00.000Z', to: '2026-10-23T00:00:00.000Z' });
  assert.deepEqual(audit.items.map(item => item.event_id).sort(), [event.event_id, closed.audit_outbox[0].event.event_id].sort());
  const deliveryFailures = await sink.list({ kind: 'system_log', action: 'AUDIT_DELIVERY_FAILED',
    from: '2026-10-22T00:00:00.000Z', to: '2026-10-23T00:00:00.000Z' });
  const deliveryRecoveries = await sink.list({ kind: 'system_log', action: 'AUDIT_DELIVERY_RECOVERED',
    from: '2026-10-22T00:00:00.000Z', to: '2026-10-23T00:00:00.000Z' });
  assert.equal(deliveryFailures.items.length, 2, JSON.stringify(reports));
  assert.equal(deliveryRecoveries.items.length, 2, JSON.stringify(reports));
  assert.doesNotMatch(JSON.stringify([deliveryFailures, deliveryRecoveries]), /password|email|audit_outbox|stack/i);
  const stale = await call('PATCH', jobPath, { status: 'OPEN', expected_rev: closed._rev }, 'recruiter');
  assert.equal(stale.status, 409);
  const fresh = await repository.get(job._id);
  assert.equal((await call('PATCH', jobPath, { status: 'OPEN', expected_rev: fresh._rev }, 'recruiter')).status, 200);
  const expiredSource = new JobApplicationAuditSource(workerRepo, {
    worker, now: () => new Date(f.now().getTime() + 181 * 86400000),
  });
  const expired = await new AuditDeliveryService({ source: expiredSource, sink, now: f.now }).runBatch();
  assert.equal(expired.quarantined, 1);
  assert.equal((await repository.get(job._id)).audit_outbox[0].code, 'EVENT_RETENTION_EXPIRED');
  assert.equal((await sink.list({ kind: 'audit_trail', from: '2026-10-22T00:00:00.000Z', to: '2026-10-23T00:00:00.000Z' })).items.length, 2);

  const users = new UserRepository({ client: createCouchDbClient({
    config: { url: testUrl, database, username: admin, password: adminPassword, timeoutMs: 5000 },
  }) });
  const adminApp = express();
  adminApp.use(requestCorrelation, express.json());
  const browserBuild = process.env.RECRUITHUB_AUDIT_BROWSER_BUILD;
  if (browserBuild) {
    const adminUser = { id: f.users.admin._id, email: f.users.admin.email, role: 'ADMIN' };
    adminApp.post('/api/v1/auth/login', (_req, res) => res.json({ data: { accessToken: 'admin', user: adminUser } }));
    adminApp.get('/api/v1/auth/me', (_req, res) => res.json({ data: { user: adminUser } }));
  }
  adminApp.use('/api/v1/admin', createAdminUserRouter({ servicesFactory: () => ({
    auth: { async authenticate(token) {
      return { principal: token === 'admin'
        ? { sub: f.users.admin._id, role: 'ADMIN' }
        : { sub: f.users.candidate._id, role: 'CANDIDATE' } };
    } },
    admin: new AdminUserService({
      userRepository: users, candidateRepository: { async listByIdPrefix() { return { docs: [] }; } }, now: f.now,
    }),
  }), auditServiceFactory: () => createAdminAuditService({ repository: sink, secret: 'test-only-audit-cursor-secret-32-bytes' }) }));
  if (browserBuild) {
    adminApp.use(express.static(resolve(browserBuild)));
    adminApp.get(['/login', '/admin/dashboard'], (_req, res) => res.sendFile(resolve(browserBuild, 'index.html')));
  }
  const adminServer = adminApp.listen(0, '127.0.0.1');
  await once(adminServer, 'listening');
  t.after(() => new Promise(resolve => { adminServer.close(resolve); adminServer.closeAllConnections(); }));
  const user = await users.getById(f.users.candidate._id);
  const endpoint = 'http://127.0.0.1:' + adminServer.address().port + '/api/v1/admin/users/' + user._id;
  const statusRequest = (account_status, revision, token = 'admin') => fetch(endpoint + '/status', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'If-Match': revision },
    body: JSON.stringify({ account_status }),
  });
  assert.equal((await statusRequest('LOCKED', user._rev, 'candidate')).status, 403);
  const locks = await Promise.all([statusRequest('LOCKED', user._rev), statusRequest('LOCKED', user._rev)]);
  assert.deepEqual(locks.map(response => response.status).sort(), [200, 409]);
  const lock = locks.find(response => response.ok);
  const locked = await users.getById(user._id);
  assert.equal(locked.audit_outbox.length, 1);
  const lockEvent = locked.audit_outbox[0].event;
  assert.equal(lockEvent.correlation_id, lock.headers.get('X-Request-Id'));
  assert.equal(lockEvent.actor.id, f.users.admin._id);
  assert.equal((await lock.json()).data.user.audit_outbox, undefined);
  assert.equal((await request('/' + database + '/' + user._id, 'PUT', workerHeader,
    { ...locked, audit_outbox: [], account_status: 'ACTIVE' })).status, 403);
  assert.equal((await outage.runBatch()).sink_retryable, 1);
  assert.equal((await new AuditDeliveryService({ source, sink, now: f.now }).runBatch()).delivered, 1);
  assert.equal((await statusRequest('ACTIVE', lock.headers.get('etag'))).status, 409);
  const latest = await fetch(endpoint, { headers: { Authorization: 'Bearer admin' } });
  const update = users.update.bind(users);
  users.update = async (...args) => {
    await update(...args);
    throw new Error('Simulated lost User write response');
  };
  const unlock = await statusRequest('ACTIVE', latest.headers.get('etag'));
  assert.equal(unlock.status, 500);
  users.update = update;
  const unlocked = await users.getById(user._id);
  assert.equal(unlocked.account_status, 'ACTIVE');
  assert.equal(unlocked.audit_outbox[0].event.correlation_id, unlock.headers.get('X-Request-Id'));
  source.updateEntry = async () => { throw new Error('User ack interrupted'); };
  assert.equal((await new AuditDeliveryService({ source, sink, now: f.now }).runBatch()).source_retryable, 1);
  source.updateEntry = settle;
  assert.equal((await new AuditDeliveryService({ source, sink, now: f.now }).runBatch()).delivered, 1);
  const accountAudit = await sink.list({ kind: 'audit_trail', action: 'USER_ACCOUNT_STATUS_CHANGED',
    from: '2026-10-22T00:00:00.000Z', to: '2026-10-23T00:00:00.000Z' });
  assert.equal(accountAudit.items.length, 2);
  assert.ok(accountAudit.items.some(event => event.event_id === lockEvent.event_id));
  assert.doesNotMatch(JSON.stringify(accountAudit), /password_hash|email|audit_outbox/);

  if (browserBuild) {
    const { chromium } = await import(pathToFileURL(resolve(process.env.RECRUITHUB_AUDIT_PLAYWRIGHT)).href);
    const freshUser = await users.getById(user._id);
    const queued = await statusRequest('LOCKED', freshUser._rev);
    assert.equal(queued.status, 200);
    const queuedCorrelationId = queued.headers.get('X-Request-Id');
    const queuedUser = await users.getById(user._id);
    const queuedEvent = queuedUser.audit_outbox[0].event;
    assert.equal(queuedEvent.correlation_id, queuedCorrelationId);
    const browserOutage = await outage.runBatch();
    assert.equal(browserOutage.sink_retryable, 1, JSON.stringify(browserOutage));
    const browserIncidentUser = await users.getById(user._id);
    const browserIncident = browserIncidentUser.audit_outbox[0].delivery_incident;
    assert.equal(browserIncident.code, 'EVENT_STORE_UNAVAILABLE');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const page = await browser.newPage();
      page.on('dialog', dialog => dialog.accept());
      await page.goto('http://127.0.0.1:' + adminServer.address().port + '/login');
      await page.getByLabel('Địa chỉ email', { exact: true }).fill(f.users.admin.email);
      await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-password');
      const loginRequest = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/login');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      assert.equal((await loginRequest).status(), 200);
      await page.waitForURL('**/admin/dashboard');
      const userRow = page.getByRole('row').filter({ hasText: user.email });
      await userRow.waitFor();
      await userRow.getByRole('button', { name: 'Chi tiết' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Mở khóa tài khoản' }).waitFor();
      const browserRecovery = await new AuditDeliveryService({ source, sink, now: f.now }).runBatch();
      assert.equal(browserRecovery.delivered, 1, JSON.stringify(browserRecovery));
      assert.equal(browserRecovery.failures_logged, 1, JSON.stringify(browserRecovery));
      assert.equal(browserRecovery.recoveries_logged, 1, JSON.stringify(browserRecovery));
      const conflict = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/status'));
      await dialog.getByRole('button', { name: 'Mở khóa tài khoản' }).click();
      assert.equal((await conflict).status(), 409);
      await dialog.getByText(/xác nhận lại/).waitFor();
      assert.equal((await users.getById(user._id)).account_status, 'LOCKED');
      const retry = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/status'));
      await dialog.getByRole('button', { name: 'Mở khóa tài khoản' }).click();
      assert.equal((await retry).status(), 200);
      assert.equal((await users.getById(user._id)).account_status, 'ACTIVE');
      await page.getByRole('tab', { name: 'Vết kiểm toán' }).click();
      await page.getByLabel('Từ ngày').fill('2026-10-22');
      await page.getByLabel('Đến ngày').fill('2026-10-22');
      await page.getByRole('button', { name: 'Áp dụng' }).click();
      const auditRow = page.locator('article').filter({ hasText: queuedEvent.event_id });
      await auditRow.waitFor();
      await auditRow.getByText('Chi tiết kỹ thuật').click();
      await auditRow.getByText(queuedEvent.event_id).waitFor();
      await auditRow.getByText(queuedCorrelationId).waitFor();
      await page.getByRole('tab', { name: 'Nhật ký hệ thống' }).click();
      await page.getByLabel('Từ ngày').fill('2026-10-22');
      await page.getByLabel('Đến ngày').fill('2026-10-22');
      await page.getByRole('button', { name: 'Áp dụng' }).click();
      const recoveryRow = page.locator('article').filter({ hasText: browserIncident.recovery_event_id });
      await recoveryRow.waitFor();
      await recoveryRow.getByText('Chi tiết kỹ thuật').click();
      await recoveryRow.getByText(browserIncident.recovery_event_id).waitFor();
      await recoveryRow.getByText(queuedCorrelationId).waitFor();
    } finally {
      await browser.close();
    }
  }
});
