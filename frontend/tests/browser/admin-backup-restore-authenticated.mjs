// BR-005E: production build + real AuthService/JWT + isolated CouchDB/API. No fixture login route.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from '../../../backend/node_modules/express/index.js';
import { operationalFixture } from '../../../backend/tests/helpers/admin-backup-operational-fixtures.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(root, 'docs/reports/admin-backup-restore/BR-005E-evidence');
const playwrightPath = process.env.BR005_PLAYWRIGHT_PATH || path.join(os.tmpdir(), 'recruithub-003b-browser/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath));
const cleanup = [];
const t = { after(fn) { cleanup.push(fn); }, diagnostic() {} };
const result = { fixture: 'production build + real AuthService/JWT + isolated CouchDB/API', checks: [], screenshots: [], errors: [] };
const check = (name, condition) => { assert.ok(condition, name); result.checks.push(name); };
let browser, site;
try {
  await fs.mkdir(evidence, { recursive: true });
  const f = await operationalFixture(t);
  const probe = await f.request('/auth/me');
  assert.equal(probe.status, 401);
  const backendOrigin = new URL(probe.url).origin;
  const app = express();
  app.use('/api', (req, res) => {
    // Build the proxy request explicitly to preserve binary uploads without buffering.
    // Express removes the mount prefix from req.url, so add /api back for the backend.
    const target = new URL('/api' + req.url, backendOrigin);
    const proxy = http.request(target, { method: req.method, headers: req.headers }, upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode, upstreamResponse.headers); upstreamResponse.pipe(res);
    });
    proxy.on('error', () => { if (!res.headersSent) res.status(502).end(); }); req.pipe(proxy);
  });
  app.use(express.static(path.join(root, 'frontend/dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
  site = app.listen(0, '127.0.0.1'); await new Promise(resolve => site.once('listening', resolve));
  const origin = `http://127.0.0.1:${site.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', error => result.errors.push(error.message));
  const login = async () => {
    await page.getByLabel('Địa chỉ email').fill(f.users.admin.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('tab', { name: 'Sao lưu & khôi phục' }).waitFor();
  };
  await page.goto(origin + '/admin/dashboard');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  check('Guest route guard redirects to real login screen', page.url().includes('/login'));
  await login(); await page.getByRole('tab', { name: 'Sao lưu & khôi phục' }).click();
  await page.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).waitFor();
  for (const [width, height] of [[375, 812], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(evidence, `empty-${width}.png`), fullPage: true }); result.screenshots.push(`empty-${width}.png`);
    check(`No horizontal overflow at ${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Tạo bản sao lưu', exact: true }).click();
  const downloadButton = page.getByRole('button', { name: 'Tải file sao lưu', exact: true }); await downloadButton.waitFor();
  const received = page.waitForEvent('download'); await downloadButton.click(); const download = await received;
  const archive = path.join(f.root, 'browser-roundtrip.rhbr.gz'); await download.saveAs(archive);
  check('Authenticated Admin downloaded signed archive', (await fs.stat(archive)).size > 0);
  await page.getByLabel('File sao lưu (.rhbr.gz)').setInputFiles(archive);
  await page.getByRole('button', { name: 'Tải lên và kiểm tra' }).click();
  await page.getByText('File đã kiểm tra hợp lệ').waitFor();
  const target = `recruithub_restore_browser_${Date.now().toString(36)}`;
  await page.getByLabel('Tên database mới').fill(target);
  await page.getByRole('button', { name: 'Xem lại và khôi phục' }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(evidence, 'confirm-375.png'), fullPage: true }); result.screenshots.push('confirm-375.png');
  check('Confirmation dialog fits mobile viewport', await dialog.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }));
  await page.getByRole('button', { name: 'Hủy', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  check('Dialog traps backward Tab focus', await page.getByRole('button', { name: 'Xác nhận tạo và khôi phục' }).evaluate(element => element === document.activeElement));
  await page.keyboard.press('Escape'); check('Escape closes confirmation dialog', await dialog.count() === 0);
  await page.getByRole('button', { name: 'Xem lại và khôi phục' }).click(); await page.getByRole('button', { name: 'Xác nhận tạo và khôi phục' }).click();
  await page.getByText(/Đã đối chiếu \d+ tài liệu, tệp đính kèm và chỉ mục/).waitFor();
  check('Real restore result rendered after authenticated API flow', true);
  for (const [width, height] of [[375, 812], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.screenshot({ path: path.join(evidence, `success-${width}.png`), fullPage: true }); result.screenshots.push(`success-${width}.png`);
    check(`Success has no horizontal overflow at ${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.reload(); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
  await login(); await page.getByText(/Đã đối chiếu \d+ tài liệu/).waitFor();
  check('Reload requires real login and restores tracked job', true);
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
  check('Session storage has neither token nor archive content', !JSON.stringify(storage).includes(f.password) && !JSON.stringify(storage).includes('eyJ'));
  check('No uncaught page errors', result.errors.length === 0);
  result.status = 'PASS'; result.target = target;
} catch (error) {
  result.status = 'FAIL'; result.failure = error.message; throw error;
} finally {
  await browser?.close();
  if (site) await new Promise(resolve => { site.close(resolve); site.closeAllConnections(); });
  for (const close of cleanup.reverse()) await close();
  await fs.writeFile(path.join(evidence, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, evidence, failure: result.failure }));
}
