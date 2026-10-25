// Checks the actual development server, including its dependency optimizer cache.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const checks = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && /(?:node_modules|\/src\/)/.test(response.url())) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    for (const route of ['/', '/jobs', '/login', '/register']) {
      await page.goto(`http://localhost:5173${route}`);
      for (const state of ['initial', 'reload']) {
        if (state === 'reload') await page.reload();
        await page.locator('nav.sticky').waitFor();
        await page.getByRole('heading').first().waitFor();
        assert.ok((await page.locator('#root').innerText()).length > 100);
        assert.equal(await page.locator('nav.sticky').count(), 1);
        checks.push({ route, state, rendered: true });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5173/jobs');
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
    assert.ok(await page.locator('#mobile-navigation').isVisible());
    checks.push({ route: '/jobs', state: 'mobile menu', rendered: true });
    assert.deepEqual(errors, []);
    const output = path.join(process.cwd(), 'docs/ui-verification');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'live-results.json'), JSON.stringify({
      origin: 'http://localhost:5173', checks, runtimeOrModuleErrors: errors,
    }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, runtimeOrModuleErrors: errors }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
