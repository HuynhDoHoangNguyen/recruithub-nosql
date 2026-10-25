const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const { pdfFixture, docxFixture } = await import(pathToFileURL(path.resolve('backend/tests/helpers/upload-fixtures.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  assert.ok(env.AUTH_COUCHDB_DATABASE && env.AUTH_COUCHDB_DATABASE !== config.database);
  const output = path.resolve('docs/dev-merge-repair-verification'); fs.mkdirSync(output, { recursive: true });
  const result = { checked_at: new Date().toISOString(), mocked: false, checks: [], runtime_errors: [] };
  const primary = async () => { const r = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(r.status, 200); const body = await r.json(); return { doc_count: body.doc_count, update_seq: body.update_seq }; };
  async function request(method, route, token, payload, expected = 200) {
    const response = await fetch(origin + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const body = await response.json(); assert.equal(response.status, expected, `${method} ${route}: ${body.error?.code || 'unexpected status'}`); return body.data;
  }
  const auth = async role => (await request('POST', '/auth/login', null, { email: env[`LOCAL_TEST_${role}_EMAIL`], password: env[`LOCAL_TEST_${role}_PASSWORD`] })).accessToken;
  const before = await primary(), recruiterToken = await auth('RECRUITER'), candidateToken = await auth('CANDIDATE');
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); let job;
  const watch = page => { page.on('pageerror', error => result.runtime_errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); };
  // Native Chrome PDF viewers may keep a request open. Callers wait for the
  // actual UI/content above; networkidle is not a readiness signal for PDFs.
  async function capture(page, name) { await page.waitForLoadState('domcontentloaded'); await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished))); await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }); }
  async function login(page, role, route) { await page.getByLabel('Địa chỉ email', { exact: true }).fill(env[`LOCAL_TEST_${role}_EMAIL`]); await page.getByLabel('Mật khẩu', { exact: true }).fill(env[`LOCAL_TEST_${role}_PASSWORD`]); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname === route); }
  try {
    job = await request('POST', '/jobs', recruiterToken, { title: `Tin kiểm tra merge dev ${Date.now()}`, industry: 'Công nghệ thông tin', seniority: 'JUNIOR', location: 'VN-HN', work_mode: 'REMOTE', employment_type: 'FULL_TIME', salary: { type: 'NEGOTIABLE' }, description: 'Kiểm tra bố cục dev cùng chức năng CV của TV2.', responsibilities: ['Phát triển API'], required_skills: ['JavaScript', 'CouchDB'], optional_skills: [], requirements: { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } }, status: 'OPEN', deadline: new Date(Date.now() + 7 * 86400000).toISOString() }, 201);
    result.job_id = job._id; const route = '/jobs/' + encodeURIComponent(job._id);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(page); let downloads = 0; page.on('download', () => downloads++);
    await page.goto(origin + '/jobs?q=' + encodeURIComponent(job.title)); await page.getByRole('heading', { name: job.title, exact: true }).waitFor();
    assert.equal(await page.locator('main').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(205, 234, 244)');
    await page.getByLabel('Kỹ năng', { exact: true }).fill('javascript, couchdb'); await page.getByLabel('Ngành nghề', { exact: true }).fill(job.industry);
    await page.getByRole('button', { name: 'Tìm việc', exact: true }).last().click();
    await page.waitForURL(url => url.searchParams.get('skills') === 'javascript,couchdb' && url.searchParams.get('industry') === job.industry);
    await page.getByLabel('Địa điểm', { exact: true }).selectOption('VN-HN'); await page.getByLabel('Hình thức làm việc', { exact: true }).selectOption('REMOTE');
    await page.getByRole('heading', { name: job.title, exact: true }).waitFor(); await capture(page, 'dev-job-list-filters');
    await page.getByRole('link', { name: new RegExp(job.title) }).click(); await page.getByRole('heading', { name: job.title, exact: true }).waitFor();
    await page.getByRole('link', { name: 'Đăng nhập để ứng tuyển', exact: true }).click(); await login(page, 'CANDIDATE', route);
    await page.getByRole('button', { name: 'Nộp hồ sơ ứng tuyển', exact: true }).click();
    await page.getByLabel('Tải CV từ máy tính', { exact: true }).setInputFiles({ name: 'CV-merge-first.pdf', mimeType: 'application/pdf', buffer: pdfFixture() });
    await page.getByText('CV-merge-first.pdf', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Xác nhận nộp hồ sơ', exact: true }).click(); await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).click(); await page.getByRole('button', { name: 'Ứng tuyển lại', exact: true }).waitFor();
    const withdrawn = (await request('GET', '/applications/my-applications?job_id=' + encodeURIComponent(job._id), candidateToken)).items[0];
    await page.getByRole('button', { name: 'Ứng tuyển lại', exact: true }).click();
    await page.getByLabel('Tải CV từ máy tính', { exact: true }).setInputFiles({ name: 'CV-merge-new.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docxFixture() }); await page.getByText('CV-merge-new.docx', { exact: true }).waitFor();
    const submitting = page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/applications'); await page.getByRole('button', { name: 'Xác nhận nộp hồ sơ', exact: true }).click(); assert.equal((await submitting).postDataJSON().expected_rev, withdrawn._rev);
    await page.getByRole('heading', { name: 'Lịch sử các lần ứng tuyển (1)', exact: true }).waitFor(); await capture(page, 'dev-detail-current-attempt');
    const current = (await request('GET', '/applications/my-applications?job_id=' + encodeURIComponent(job._id), candidateToken)).items[0]; result.application_id = current._id;
    assert.equal(current.current_stage, 'APPLIED'); assert.equal(current.submission.resume_file.file_name, 'CV-merge-new.docx'); assert.equal(current.previous_attempts[0].submission.resume_file.file_name, 'CV-merge-first.pdf');
    await page.getByText('Xem CV và thư giới thiệu đã nộp', { exact: true }).click(); await page.getByRole('button', { name: 'Xem CV', exact: true }).first().click(); await page.getByRole('dialog').getByText('RecruiHub upload test', { exact: true }).waitFor(); await capture(page, 'dev-detail-word-preview'); await page.getByRole('button', { name: 'Đóng bản xem CV', exact: true }).click();
    await page.getByText(/Lần 1 · Đã rút đơn/).click(); await page.getByRole('button', { name: 'Xem CV', exact: true }).last().click(); await page.getByTitle('CV: CV-merge-first.pdf', { exact: true }).waitFor(); await capture(page, 'dev-detail-archived-pdf'); assert.equal(downloads, 0); await page.getByRole('button', { name: 'Đóng bản xem CV', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'dev-detail-mobile'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } }); watch(mobile); await mobile.goto(origin + '/jobs'); await mobile.getByRole('button', { name: 'Mở bộ lọc', exact: false }).click(); await capture(mobile, 'dev-job-list-mobile'); assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const recruiter = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(recruiter); await recruiter.goto(origin + '/recruiter/profile'); await login(recruiter, 'RECRUITER', '/recruiter/profile'); await recruiter.getByLabel('Họ và tên', { exact: true }).waitFor();
    result.checks.push('Dev cyan Job list/detail layout preserved; combined search/skills/industry/location/work-mode filters work', 'Real Candidate login returns to detail, file-only PDF Apply → Withdraw → DOCX Reapply sends current revision and preserves old CV', 'Current Word and archived PDF preview work inside the dev detail layout', 'Recruiter login returns to company profile; 390px list/detail have no horizontal overflow'); assert.deepEqual(result.runtime_errors, []);
  } catch (error) { result.failure = error.message; for (const [i, page] of browser.contexts().flatMap(context => context.pages()).entries()) await capture(page, `failure-${i}`).catch(() => {}); throw error; }
  finally {
    try { if (job) { const current = await request('GET', '/recruiter/jobs/' + encodeURIComponent(job._id), recruiterToken); await request('DELETE', '/jobs/' + encodeURIComponent(job._id), recruiterToken, { expected_rev: current._rev }); } } catch (error) { result.cleanup_failure = error.message; }
    result.primary_before = before; result.primary_after = await primary(); result.primary_unchanged = JSON.stringify(before) === JSON.stringify(result.primary_after); await browser.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2)); assert.ok(result.primary_unchanged); assert.ok(!result.cleanup_failure, result.cleanup_failure); console.log(JSON.stringify(result, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
