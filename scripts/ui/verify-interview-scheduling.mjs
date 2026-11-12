import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import argon2 from '../../backend/node_modules/argon2/argon2.cjs';
import express from '../../backend/node_modules/express/index.js';
import { createFixture, submission } from '../../backend/tests/recruitment/fixtures.js';
import { createApp } from '../../backend/src/app.js';
import { JobApplicationRepository } from '../../backend/src/repositories/job-application.repository.js';
import { applicationIdFromPair } from '../../backend/src/utils/id.utils.js';
import { verifyInterviewFeedback } from './interview-feedback-cases.mjs';

// Build with VITE_API_BASE_URL=/api and point this runner to a disposable
// CouchDB instance, the Playwright module, and a fresh evidence directory.
const { UC17_BUILD_DIR, UC17_EVIDENCE_DIR, UC17_PLAYWRIGHT_PATH, UC17_COUCH_URL, UC17_COUCH_PASSWORD } = process.env;
const feedbackMode = process.env.INTERVIEW_VERIFY_MODE === 'feedback';
assert.ok(UC17_BUILD_DIR && UC17_EVIDENCE_DIR && UC17_PLAYWRIGHT_PATH && UC17_COUCH_PASSWORD);
const couch = new URL(UC17_COUCH_URL);
assert.equal(couch.hostname, '127.0.0.1');
const { chromium } = await import(pathToFileURL(resolve(UC17_PLAYWRIGHT_PATH)));
const database = `uc17_e2e_${randomBytes(8).toString('hex')}`;
const authHeader = `Basic ${Buffer.from(`uc17_test:${UC17_COUCH_PASSWORD}`).toString('base64')}`;
const databaseUrl = new URL(database, couch);
const env = {
  COUCHDB_URL: couch.origin,
  COUCHDB_DATABASE: database,
  AUTH_COUCHDB_DATABASE: database,
  COUCHDB_USER: 'uc17_test',
  COUCHDB_PASSWORD: UC17_COUCH_PASSWORD,
  JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
};
Object.assign(process.env, env);
const checks = [];
const errors = [];
let databaseCreated = false;
let server;
let browser;
let failure;
await mkdir(UC17_EVIDENCE_DIR, { recursive: true });
try {
  const created = await fetch(databaseUrl, { method: 'PUT', headers: { Authorization: authHeader } });
  assert.equal(created.status, 201);
  databaseCreated = true;
  let rejectNextWrite = false;
  const repo = new JobApplicationRepository({ url: couch.origin, database, authHeader }, (url, init) => {
    if (rejectNextWrite && init.method === 'PUT' && JSON.parse(init.body).type === 'interview') {
      rejectNextWrite = false;
      return new Response(null, { status: 503 });
    }
    return fetch(url, init);
  });
  await repo.initialize();
  const fixture = createFixture();
  const password = randomBytes(20).toString('hex');
  const passwordHash = await argon2.hash(password);
  for (const doc of fixture.repo.docs.values()) {
    const seed = { ...doc };
    delete seed._rev;
    if (seed.type === 'user') seed.password_hash = passwordHash;
    if (seed.type === 'job') seed.deadline = new Date(Date.now() + 86400000 * 10).toISOString();
    await repo.put(seed);
  }
  const web = express();
  web.use(express.static(resolve(UC17_BUILD_DIR)));
  web.get('/{*path}', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(resolve(UC17_BUILD_DIR, 'index.html')));
  let testTime = Date.now();
  web.use(createApp({ repository: repo, jwtEnv: env, ...(feedbackMode ? { now: () => new Date(testTime) } : {}) }));
  server = web.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const candidate = await fetch(origin + '/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fixture.users.candidate.email, password }),
  });
  assert.equal(candidate.status, 200);
  const { data: { accessToken } } = await candidate.json();
  const applied = await fetch(origin + '/api/v1/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ job_id: fixture.job._id, submission }),
  });
  assert.equal(applied.status, 201);
  const applicationId = applicationIdFromPair(fixture.candidate._id, fixture.job._id);
  const route = `/recruiter/jobs/${encodeURIComponent(fixture.job._id)}/applicants`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  let postCount = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/interviews')) postCount++;
  });
  const button = name => page.getByRole('button', { name, exact: true });
  const listButton = () => button('Xem CV và xử lý');
  const scheduling = page.getByRole('region', { name: 'Lịch phỏng vấn' });
  const schedulingAlert = scheduling.getByRole('alert');
  async function login() {
    await page.getByLabel('Địa chỉ email', { exact: true }).fill(fixture.users.recruiter.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await button('Đăng nhập').click();
    await listButton().waitFor();
  }
  async function transition(label, action = button(label)) {
    await action.click();
    const response = page.waitForResponse(response => response.url().endsWith('/stage') && response.request().method() === 'PATCH');
    await button('Xác nhận chuyển trạng thái').click();
    assert.equal((await response).status(), 200);
  }
  async function expectPost(status) {
    const response = page.waitForResponse(response => response.url().endsWith('/api/v1/interviews') && response.request().method() === 'POST');
    await button('Lưu lịch').click();
    const received = await response;
    assert.equal(received.status(), status);
    return received.json();
  }

  await page.goto(origin + route);
  await login();
  await transition('Duyệt hồ sơ');
  await button('Đóng hộp thoại').click();
  await transition('Mời phỏng vấn');
  await page.getByText('Cần lên lịch phỏng vấn.', { exact: true }).waitFor();
  assert.equal((await repo.get(applicationId)).current_stage, 'INTERVIEW');
  if (feedbackMode) {
    await verifyInterviewFeedback({
      page, repo, applicationId, checks, button, login, transition, expectPost,
      evidenceDir: UC17_EVIDENCE_DIR, setTime: value => { testTime = value; },
    });
  } else {
    await button('Lên lịch phỏng vấn').click();
    const localTime = new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 16);
    const timeInput = page.getByLabel(/Ngày giờ phỏng vấn/);
    await timeInput.fill(localTime);
    await scheduling.evaluate(node => node.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: resolve(UC17_EVIDENCE_DIR, 'desktop-schedule.png') });

    rejectNextWrite = true;
    await expectPost(503);
    await schedulingAlert.filter({ hasText: 'Không thể truy vấn cơ sở dữ liệu' }).waitFor();
    assert.equal((await repo.get(applicationId)).current_stage, 'INTERVIEW');
    assert.deepEqual(await repo.allInterviews(applicationId), []);
    assert.equal(await timeInput.inputValue(), localTime);
    checks.push('503 khi ghi CouchDB: giữ INTERVIEW, giữ form, chưa tạo lịch');

    const network = '**/api/v1/interviews';
    const held = Promise.withResolvers();
    const release = Promise.withResolvers();
    let lostStatus;
    await page.route(network, async route => {
      try {
        lostStatus = (await route.fetch({ timeout: 12000 })).status();
        held.resolve();
        await release.promise;
      } catch (error) {
        held.reject(error);
      }
      await route.abort('failed');
    }, { times: 1 });
    await button('Lưu lịch').click();
    await held.promise;
    try {
      assert.ok(await button('Đang lưu…').isDisabled());
      await scheduling.locator('form').dispatchEvent('submit');
      assert.equal(postCount, 2);
    } finally {
      release.resolve();
    }
    await schedulingAlert.filter({ hasNotText: 'Không thể truy vấn cơ sở dữ liệu' }).waitFor();
    assert.equal(lostStatus, 201);
    assert.equal((await repo.allInterviews(applicationId)).length, 1);
    assert.equal(await timeInput.inputValue(), localTime);
    const retry = await expectPost(200);
    assert.equal(retry.data.idempotent, true);
    assert.equal(postCount, 3);
    await page.getByText(/Vòng 1 · Kỹ thuật/).waitFor();
    checks.push('Chặn submit trùng khi giữ phản hồi 201; retry thủ công sau mất phản hồi trả 200, chỉ một lịch');

    await page.reload();
    await login();
    await page.setViewportSize({ width: 390, height: 844 });
    await listButton().click();
    await page.getByText(/Vòng 1 · Kỹ thuật/).waitFor();
    await button('Lên lịch phỏng vấn').click();
    await page.getByText('Lên lịch vòng 2').waitFor();
    const dialog = page.getByRole('dialog');
    assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'mobile dialog should not overflow horizontally');
    await page.screenshot({ path: resolve(UC17_EVIDENCE_DIR, 'mobile-schedule.png') });
    const interviews = await repo.allInterviews(applicationId);
    assert.equal(interviews.length, 1);
    assert.equal(interviews[0].scheduled_at, new Date(`${localTime}:00+07:00`).toISOString());
    checks.push('Build thật + Edge: đăng nhập, chuyển stage, tải lại, vòng kế tiếp và mobile');
  }
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error;
} finally {
  try {
    await browser?.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (databaseCreated) {
      const deleted = await fetch(databaseUrl, { method: 'DELETE', headers: { Authorization: authHeader } });
      assert.equal(deleted.status, 200);
    }
  } catch (error) {
    failure = failure ? new AggregateError([failure, error], 'Verification and cleanup failed') : error;
  }
  await writeFile(resolve(UC17_EVIDENCE_DIR, 'RESULT.json'), JSON.stringify({
    status: failure ? 'FAIL' : 'PASS', scenario: feedbackMode ? 'UC18' : 'UC17', checks, errors, failure: failure?.stack,
  }, null, 2));
}
if (failure) throw failure;
console.log(checks.join('\n'));
