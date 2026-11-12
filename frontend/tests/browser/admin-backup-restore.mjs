// Explicit test-only server: production SPA + real BR-002/003 router/service + isolated CouchDB.
// Login uses a fixture adapter here; production auth and environment are untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import express from '../../../backend/node_modules/express/index.js';
import { AdminBackupService } from '../../../backend/src/services/admin-backup.service.js';
import { BackupJobStore } from '../../../backend/src/services/admin-backup-job.service.js';
import { createAdminBackupRouter } from '../../../backend/src/routes/admin-backup.routes.js';
import { createAuthenticate } from '../../../backend/src/middleware/authenticate.js';
import { AuthServiceError } from '../../../backend/src/services/auth.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(root, 'docs/reports/admin-backup-restore/BR-004-evidence');
const playwrightPath = process.env.BR004_PLAYWRIGHT_PATH || path.join(os.tmpdir(), 'recruithub-003b-browser/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath));
const results = { fixture: 'production build + fixture login + real API/service + CouchDB 3.5.2.1 isolated', checks: [], screenshots: [], errors: [] };
const check = (name, condition) => { assert.ok(condition, name); results.checks.push(name); };
const container = `recruithub-br004-test-${randomUUID().slice(0, 8)}`;
const dockerEnv = { ...process.env, COUCHDB_USER: 'br004_test_admin', COUCHDB_PASSWORD: randomBytes(32).toString('hex') };
const docker = args => {
  const response = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, env: dockerEnv, timeout: 25000 });
  assert.equal(response.status, 0, `Docker ${args[0]} failed`); return response.stdout.trim();
};
const spool = await fs.mkdtemp(path.join(os.tmpdir(), 'rhbr-br004-browser-'));
let browser, server, store, service, started = false;
const keepAlive = setInterval(() => {}, 1000);
await fs.mkdir(evidence, { recursive: true });
try {
  docker(['run', '-d', '--name', container, '-p', '127.0.0.1::5984', '--env', 'COUCHDB_USER', '--env', 'COUCHDB_PASSWORD', 'couchdb:3.5.2.1']); started = true;
  const couch = `http://${docker(['port', container, '5984/tcp']).split('\n')[0]}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(couch, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready);
  const headers = { Authorization: `Basic ${Buffer.from(`${dockerEnv.COUCHDB_USER}:${dockerEnv.COUCHDB_PASSWORD}`).toString('base64')}`, 'Content-Type': 'application/json' };
  const call = async (endpoint, method = 'GET', body) => {
    const response = await fetch(couch + endpoint, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok, `Fixture CouchDB ${method} failed: ${response.status}`); return response.json();
  };
  const source = 'br004_source_fixture'; await call('/' + source, 'PUT');
  const rows = await call(`/${source}/_bulk_docs`, 'POST', { docs: [
    ...['user', 'candidate', 'company', 'department', 'recruiter', 'job', 'application', 'interview', 'resume_analysis'].map(type => ({ _id: `${type}:fixture`, type, label: 'Dữ liệu kiểm thử BR-004' })),
    { _id: 'asset:fixture', type: 'uploaded_asset', _attachments: { content: { content_type: 'application/octet-stream', data: Buffer.from([0, 255, 1, 9]).toString('base64') } } },
  ] }); assert.ok(rows.every(row => row.ok));
  await call(`/${source}/_design/count`, 'PUT', { views: { count: { map: 'function(doc){emit(doc.type,1)}', reduce: '_sum' } } });
  await call(`/${source}/_index`, 'POST', { ddoc: 'by_type', name: 'by_type', type: 'json', index: { fields: ['type'] } });
  const before = await call('/' + source);
  const env = { COUCHDB_URL: couch, COUCHDB_DATABASE: source, AUTH_COUCHDB_DATABASE: source,
    COUCHDB_USER: dockerEnv.COUCHDB_USER, COUCHDB_PASSWORD: dockerEnv.COUCHDB_PASSWORD,
    BACKUP_SIGNING_KEY: randomBytes(48).toString('base64url'), BACKUP_SIGNING_KEY_ID: 'br004-browser' };
  store = new BackupJobStore({ root: path.join(spool, 'spool') });
  service = new AdminBackupService({ env, store });
  const token = randomBytes(32).toString('hex');
  const user = { id: 'user:br004_fixture', role: 'ADMIN', name: 'Admin kiểm thử BR-004', email: 'br004@example.test' };
  const authenticate = createAuthenticate({ serviceProvider: () => ({ async authenticate(input) {
    if (input !== token) throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Invalid fixture session');
    return { principal: { sub: user.id, role: user.role }, user };
  } }) });
  const app = express(); app.use(express.json());
  app.post('/api/v1/auth/login', (_req, res) => res.json({ data: { accessToken: token, user } }));
  app.get('/api/v1/auth/me', authenticate, (_req, res) => res.json({ data: { user } }));
  app.use('/api/v1/admin', createAdminBackupRouter({ authenticate, serviceProvider: () => service }));
  // Other tabs only need read-only fixture responses for navigation regression.
  app.get('/api/v1/admin/users', authenticate, (_req, res) => res.json({ data: { users: [], total: 0 } }));
  app.get('/api/v1/admin/stats', authenticate, (_req, res) => res.json({ data: { totalUsers: 0, statuses: {} } }));
  for (const type of ['audit-trails', 'system-logs']) app.get(`/api/v1/admin/${type}`, authenticate, (_req, res) => res.json({ data: { items: [], has_more: false, next_cursor: null } }));
  app.use(express.static(path.join(root, 'frontend/dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => results.errors.push(error.message));
  const login = async () => {
    await page.getByLabel('Địa chỉ email').fill('br004@example.test'); await page.getByLabel('Mật khẩu', { exact: true }).fill('FixtureOnly123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('tab', { name: 'Sao lưu & khôi phục' }).waitFor();
  };
  await page.goto(origin + '/admin/dashboard'); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor(); check('Guest redirected through production route guard', page.url().includes('/login'));
  await login();
  await page.getByRole('tab', { name: 'Sao lưu & khôi phục' }).click();
  await page.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('#backup-source').disabled);
  check('Four admin tabs available', await page.getByRole('tab').count() === 4);
  for (const [width, height] of [[1440, 900], [768, 1024], [375, 812]]) {
    await page.setViewportSize({ width, height }); await page.screenshot({ path: path.join(evidence, `empty-${width}.png`), fullPage: true });
    check(`No horizontal page overflow at ${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.screenshots.push(`empty-${width}.png`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const signingKey = env.BACKUP_SIGNING_KEY;
  env.BACKUP_SIGNING_KEY = '';
  await page.getByRole('tab', { name: 'Vết kiểm toán' }).click();
  await page.getByRole('tab', { name: 'Sao lưu & khôi phục' }).click();
  await page.getByText('Máy chủ chưa cấu hình sao lưu an toàn. Liên hệ người vận hành.').waitFor();
  check('Real configuration error disables backup submission', await page.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).isDisabled());
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(evidence, 'configuration-error-375.png'), fullPage: true }); results.screenshots.push('configuration-error-375.png');
  env.BACKUP_SIGNING_KEY = signingKey;
  let releaseSources;
  const sourcesGate = new Promise(resolve => { releaseSources = resolve; });
  await page.route('**/api/v1/admin/backups/sources', async route => { await sourcesGate; await route.continue(); });
  await page.getByRole('button', { name: 'Tải lại nguồn' }).click();
  await page.getByText('Đang tải nguồn và giới hạn sao lưu…').waitFor();
  await page.screenshot({ path: path.join(evidence, 'loading-375.png'), fullPage: true }); results.screenshots.push('loading-375.png');
  check('Loading state waits for the real source response', await page.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).isDisabled());
  releaseSources(); await page.waitForFunction(() => !document.querySelector('#backup-source').disabled);
  await page.unroute('**/api/v1/admin/backups/sources');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).click();
  const downloadButton = page.getByRole('button', { name: 'Tải file sao lưu', exact: true }); await downloadButton.waitFor();
  const downloaded = page.waitForEvent('download'); await downloadButton.click(); const download = await downloaded;
  const file = path.join(spool, 'roundtrip.rhbr.gz'); await download.saveAs(file);
  check('Downloaded signed gzip through production Axios', (await fs.stat(file)).size > 0 && download.suggestedFilename().endsWith('.rhbr.gz'));
  await page.getByLabel('File sao lưu (.rhbr.gz)').setInputFiles(file);
  await page.getByRole('button', { name: 'Tải lên và kiểm tra' }).click();
  await page.getByText('File đã kiểm tra hợp lệ').waitFor();
  check('Real API verified uploaded signature, documents and attachment', await page.getByText('12 (design: 2)').count() === 1);
  const target = `recruithub_restore_browser_${randomUUID().replaceAll('-', '')}`;
  await page.getByLabel('Tên database mới').fill(target);
  await page.getByRole('button', { name: 'Xem lại và khôi phục' }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(evidence, 'confirm-375.png'), fullPage: true }); results.screenshots.push('confirm-375.png');
  check('Mobile dialog stays within viewport', await dialog.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }));
  await page.getByRole('button', { name: 'Hủy', exact: true }).focus();
  await page.keyboard.press('Shift+Tab'); check('Native dialog traps backwards focus', await page.getByRole('button', { name: 'Xác nhận tạo và khôi phục' }).evaluate(element => element === document.activeElement));
  await page.keyboard.press('Tab'); check('Native dialog traps forwards focus', await page.getByRole('button', { name: 'Hủy', exact: true }).evaluate(element => element === document.activeElement));
  await page.keyboard.press('Escape'); check('Escape closes dialog', await page.getByRole('dialog').count() === 0);
  check('Focus returns to restore trigger', await page.getByRole('button', { name: 'Xem lại và khôi phục' }).evaluate(element => element === document.activeElement));
  await page.getByRole('button', { name: 'Xem lại và khôi phục' }).click();
  await page.getByRole('button', { name: 'Xác nhận tạo và khôi phục' }).click();
  await page.getByText('Đã đối chiếu 12 tài liệu, tệp đính kèm và chỉ mục.').waitFor();
  const restored = await call('/' + target); check('Restore created real CouchDB target with exact document count', restored.doc_count === before.doc_count);
  check('Restore target denies anonymous access', (await fetch(couch + '/' + target)).status === 401);
  check('Source database sequence unchanged', (await call('/' + source)).update_seq === before.update_seq);
  for (const [width, height] of [[375, 812], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.screenshot({ path: path.join(evidence, `success-${width}.png`), fullPage: true }); results.screenshots.push(`success-${width}.png`);
    check(`Success state no horizontal page overflow at ${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.reload(); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  await login(); await page.getByText('Đã đối chiếu 12 tài liệu, tệp đính kèm và chỉ mục.').waitFor();
  check('Reload requires login and restores tab plus tracked jobs', await page.getByRole('tab', { name: 'Sao lưu & khôi phục' }).getAttribute('aria-selected') === 'true');
  const stored = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
  check('Session tracking contains no file contents or tokens', !JSON.stringify(stored).includes(token) && !JSON.stringify(stored).includes('source_database'));
  await page.getByRole('tab', { name: 'Vết kiểm toán' }).click(); await page.getByRole('heading', { name: /Vết kiểm toán/ }).waitFor();
  check('Audit navigation still works', true);
  check('No uncaught browser errors', results.errors.length === 0);
  results.target = target; results.source = source; results.verifiedDocuments = restored.doc_count;
  results.status = 'PASS';
} catch (error) {
  results.status = 'FAIL'; results.failure = error.message; throw error;
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (service) await Promise.allSettled([...service.pending.values()]);
  await store?.close();
  if (started) { docker(['stop', container]); results.retainedStoppedContainer = container; }
  // Keep this private fixture spool for local review; no database deletion or global cleanup.
  results.privateFixtureDirectory = spool;
  clearInterval(keepAlive);
  await fs.writeFile(path.join(evidence, 'RESULT.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: results.status, checks: results.checks.length, container, evidence, failure: results.failure }));
}
