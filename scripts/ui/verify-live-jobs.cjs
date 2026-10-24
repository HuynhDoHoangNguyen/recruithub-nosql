// Layer C for public pages only: the user's real Vite/Express/CouchDB, no mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const output = path.join(process.cwd(), 'docs/live-job-verification');
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    const response = await page.request.get('http://localhost:5173/api/v1/jobs?limit=20');
    assert.equal(response.status(), 200);
    const jobs = (await response.json()).data.items;
    assert.equal(jobs.length, 20);
    assert.ok(jobs.every(job => job.status === 'OPEN'));
    const first = jobs[0];
    const link = `a[href="/jobs/${encodeURIComponent(first._id)}"]`;
    await page.goto('http://localhost:5173/jobs');
    await page.locator(link).waitFor();
    await page.reload();
    await page.locator(link).waitFor();
    await page.screenshot({ path: path.join(output, 'jobs-desktop.png') });
    await page.locator(link).click();
    await page.getByRole('heading', { name: first.title, exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: first.title, exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'job-detail-desktop.png') });
    assert.ok(await page.getByRole('link', { name: 'Đăng nhập để ứng tuyển', exact: true }).isVisible());
    for (const [width, height, name] of [[768, 1024, 'tablet'], [390, 844, 'mobile']]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://localhost:5173/jobs');
      await page.locator(link).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: path.join(output, `jobs-${name}.png`) });
    }
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
    await page.locator('#mobile-navigation').getByRole('link', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    assert.equal(await page.locator('#mobile-navigation').count(), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({
      origin: 'http://localhost:5173', mocked: false, identitySession: false,
      publicJobsFirstPage: jobs.length, firstJobId: first._id,
      listInitialAndReload: true, detailInitialAndReload: true, tabletAndMobileNoOverflow: true,
      mobileNavigation: true, browserErrors: errors,
    }, null, 2));
    console.log(JSON.stringify({ passed: true, publicJobsFirstPage: jobs.length, firstJobId: first._id, browserErrors: errors }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
