const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  const output = path.resolve('docs/dashboard-pagination-verification'); fs.mkdirSync(output, { recursive: true });
  const result = { checked_at: new Date().toISOString(), mocked: false, read_only: true, checks: [], runtime_errors: [] };
  async function primary() { const response = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(response.status, 200); const body = await response.json(); return { doc_count: body.doc_count, update_seq: body.update_seq }; }
  const before = await primary(), browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function stable(page) { await page.waitForLoadState('networkidle'); await page.waitForFunction(() => !document.querySelector('.loading-spinner')); await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished))); }
  try {
    for (const role of ['CANDIDATE', 'RECRUITER']) {
      const candidate = role === 'CANDIDATE', route = candidate ? '/user/dashboard' : '/recruiter/dashboard', endpoint = candidate ? '/api/v1/applications/my-applications' : '/api/v1/recruiter/jobs';
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); let requests = 0;
      page.on('pageerror', error => result.runtime_errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.pathname === endpoint) { assert.equal(url.searchParams.get('limit'), '5'); requests++; } });
      await page.goto(origin + route); await page.getByLabel('Địa chỉ email', { exact: true }).fill(env[`LOCAL_TEST_${role}_EMAIL`]); await page.getByLabel('Mật khẩu', { exact: true }).fill(env[`LOCAL_TEST_${role}_PASSWORD`]); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname === route); await stable(page);
      const cards = page.locator('main article'); assert.equal(await cards.count(), 5);
      const firstLinks = await cards.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert.ok(await page.getByRole('button', { name: 'Trang trước', exact: true }).isDisabled());
      assert.ok(await page.getByRole('button', { name: 'Trang sau', exact: true }).isEnabled());
      await page.screenshot({ path: path.join(output, `${role.toLowerCase()}-page-1.png`), fullPage: true });
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await stable(page);
      await page.locator('nav[aria-label="Phân trang"] [aria-current="page"]').filter({ hasText: 'Trang 2' }).waitFor();
      const secondCount = await cards.count(); assert.ok(secondCount > 0 && secondCount <= 5);
      const secondLinks = await cards.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert.ok(secondLinks.every(link => !firstLinks.includes(link)), 'Pages must not overlap');
      await page.screenshot({ path: path.join(output, `${role.toLowerCase()}-page-2.png`), fullPage: true });
      await page.getByRole('button', { name: 'Trang trước', exact: true }).click(); await stable(page);
      assert.deepEqual(await cards.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href'))), firstLinks);
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await stable(page);
      const filtered = page.waitForResponse(response => { const url = new URL(response.url()); return url.pathname === endpoint && url.searchParams.get(candidate ? 'stage' : 'status') === (candidate ? 'APPLIED' : 'OPEN'); });
      const [filterResponse] = await Promise.all([filtered, candidate ? page.getByRole('button', { name: /Đã nộp — chờ xét duyệt/ }).click() : page.getByLabel('Trạng thái tin').selectOption('OPEN')]);
      assert.ok(!new URL(filterResponse.url()).searchParams.get('bookmark')); await stable(page);
      assert.ok(await page.getByRole('button', { name: 'Trang trước', exact: true }).isDisabled());
      assert.ok(await cards.count() <= 5);
      await page.setViewportSize({ width: 390, height: 844 }); await stable(page); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `${role.toLowerCase()}-mobile.png`), fullPage: true });
      result.checks.push({ role, page_1: 5, page_2: secondCount, api_limit: 5, requests, next_previous_stable: true, filter_resets_bookmark: true, mobile_overflow: false });
    }
    assert.deepEqual(result.runtime_errors, []);
  } catch (error) { result.failure = error.message; for (const [i, page] of browser.contexts().flatMap(context => context.pages()).entries()) await page.screenshot({ path: path.join(output, `failure-${i}.png`), fullPage: true }).catch(() => {}); throw error; }
  finally { result.primary_before = before; result.primary_after = await primary(); result.primary_unchanged = JSON.stringify(before) === JSON.stringify(result.primary_after); await browser.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2)); assert.ok(result.primary_unchanged); console.log(JSON.stringify(result, null, 2)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
