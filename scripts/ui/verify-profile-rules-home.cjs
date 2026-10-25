const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  const output = path.resolve('docs/profile-rules-home-verification'); fs.mkdirSync(output, { recursive: true });
  const result = { checked_at: new Date().toISOString(), mocked: false, checks: [], runtime_errors: [] };
  const primary = async () => { const response = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(response.status, 200); const body = await response.json(); return { doc_count: body.doc_count, update_seq: body.update_seq }; };
  async function request(method, route, token, body, expected = 200, headers = {}) {
    const response = await fetch(origin + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = await response.json(); assert.equal(response.status, expected, `${method} ${route}: ${json.error?.code || 'unexpected status'}`); return { data: json.data, etag: response.headers.get('etag') };
  }
  const auth = async role => (await request('POST', '/auth/login', null, { email: env[`LOCAL_TEST_${role}_EMAIL`], password: env[`LOCAL_TEST_${role}_PASSWORD`] })).data.accessToken;
  const before = await primary(), browser = await chromium.launch({ channel: 'chrome', headless: true });
  const watch = page => page.on('pageerror', error => result.runtime_errors.push(error.message));
  async function stable(page) { await page.waitForLoadState('networkidle'); await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished))); }
  async function capture(page, name) { await stable(page); await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }); }
  async function login(page, role, route) { await page.goto(origin + route); await page.getByLabel('Địa chỉ email', { exact: true }).fill(env[`LOCAL_TEST_${role}_EMAIL`]); await page.getByLabel('Mật khẩu', { exact: true }).fill(env[`LOCAL_TEST_${role}_PASSWORD`]); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname === route); }
  try {
    const candidateToken = await auth('CANDIDATE'), recruiterToken = await auth('RECRUITER');
    const candidateBefore = await request('GET', '/candidate/profile/me', candidateToken);
    for (const phone of ['0912', '09123456789', 'abcdef']) await request('PATCH', '/candidate/profile/me', candidateToken, { profile: { phone } }, 400, { 'If-Match': candidateBefore.etag });
    assert.equal((await request('GET', '/candidate/profile/me', candidateToken)).etag, candidateBefore.etag);
    const recruiterBefore = (await request('GET', '/recruiter/profile', recruiterToken)).data;
    await request('PATCH', '/recruiter/profile', recruiterToken, { expected_rev: recruiterBefore.recruiter._rev, profile: { phone: '0912' } }, 400);
    await request('PATCH', '/recruiter/company', recruiterToken, { expected_rev: recruiterBefore.company._rev, company: { name: recruiterBefore.company.name, industry: recruiterBefore.company.industry, website: 'javascript:alert(1)' } }, 400);
    const recruiterAfter = (await request('GET', '/recruiter/profile', recruiterToken)).data;
    assert.equal(recruiterBefore.recruiter._rev, recruiterAfter.recruiter._rev); assert.equal(recruiterBefore.company._rev, recruiterAfter.company._rev);
    result.checks.push('Real API rejects short/long/alphabetic Candidate phone, short Recruiter phone and unsafe company website; private document revisions remain unchanged');
    const candidate = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(candidate); let candidateWrites = 0;
    candidate.on('request', req => { if (req.method() === 'PATCH') candidateWrites++; });
    await login(candidate, 'CANDIDATE', '/profile'); await candidate.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click();
    const phone = candidate.getByLabel('Số điện thoại', { exact: true }); await phone.fill('0912'); await phone.blur(); await candidate.getByText(/Số điện thoại chưa đúng/).waitFor();
    await candidate.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click(); await capture(candidate, 'candidate-phone-validation'); assert.equal(candidateWrites, 0);
    await phone.fill('+84 912 345 678'); await phone.blur(); assert.equal(await phone.getAttribute('aria-invalid'), 'false'); await candidate.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click();
    const recruiter = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(recruiter); let recruiterWrites = 0;
    recruiter.on('request', req => { if (req.method() === 'PATCH') recruiterWrites++; });
    await login(recruiter, 'RECRUITER', '/recruiter/profile'); const recruiterPhone = recruiter.getByLabel('Số điện thoại', { exact: true }); await recruiterPhone.fill('0912'); await recruiterPhone.blur(); await recruiter.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await capture(recruiter, 'recruiter-phone-validation'); assert.equal(recruiterWrites, 0);
    await recruiter.getByRole('tab', { name: 'Thông tin công ty', exact: true }).click(); await recruiter.getByLabel('Website', { exact: true }).fill('congty.vn'); await recruiter.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await recruiter.getByText(/Nhập website http/).waitFor(); await capture(recruiter, 'company-website-validation'); assert.equal(recruiterWrites, 0);
    result.checks.push('Both profile UIs show inline errors, block invalid saves without HTTP PATCH and keep entered values; a complete +84 number clears the phone error');
    const landing = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(landing); await landing.goto(origin);
    await landing.locator('#featured-jobs a.card').first().waitFor(); await capture(landing, 'home-desktop');
    const count = await landing.locator('#featured-jobs a.card').count(); assert.ok(count > 0 && count <= 6);
    await landing.locator('#featured-jobs').screenshot({ path: path.join(output, 'featured-jobs.png') });
    await landing.getByRole('combobox', { name: 'Tìm công việc', exact: true }).fill('React'); await landing.getByRole('button', { name: 'Tìm Kiếm', exact: false }).click(); await landing.waitForURL(url => url.pathname === '/jobs' && url.searchParams.get('q') === 'React');
    await landing.goto(origin); await landing.setViewportSize({ width: 390, height: 844 }); await landing.locator('#featured-jobs a.card').first().waitFor(); await capture(landing, 'home-mobile'); assert.ok(await landing.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await candidate.setViewportSize({ width: 390, height: 844 }); await candidate.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click(); await candidate.getByLabel('Số điện thoại', { exact: true }).fill('0912'); await candidate.getByLabel('Số điện thoại', { exact: true }).blur(); await capture(candidate, 'candidate-validation-mobile'); assert.ok(await candidate.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    result.checks.push('New hero and featured cards use real API jobs; search navigates correctly; 390px landing/profile have no horizontal overflow');
    assert.deepEqual(result.runtime_errors, []);
  } catch (error) { result.failure = error.message; for (const [i, page] of browser.contexts().flatMap(context => context.pages()).entries()) await capture(page, `failure-${i}`).catch(() => {}); throw error; }
  finally { result.primary_before = before; result.primary_after = await primary(); result.primary_unchanged = JSON.stringify(before) === JSON.stringify(result.primary_after); await browser.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2)); assert.ok(result.primary_unchanged); console.log(JSON.stringify(result, null, 2)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
