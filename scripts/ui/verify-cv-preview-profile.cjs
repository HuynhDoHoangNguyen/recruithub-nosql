const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { randomUUID, createHash } = require('node:crypto');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const { pdfFixture, docxFixture } = await import(pathToFileURL(path.resolve('backend/tests/helpers/upload-fixtures.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  assert.ok(env.AUTH_COUCHDB_DATABASE && env.AUTH_COUCHDB_DATABASE !== config.database, 'Use an isolated private database');
  const out = path.resolve('docs/cv-preview-profile-verification'); fs.mkdirSync(out, { recursive: true });
  const results = { checked_at: new Date().toISOString(), mocked: false, checks: [], runtime_errors: [] };
  const primary = async () => { const response = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(response.status, 200); const body = await response.json(); return { doc_count: body.doc_count, update_seq: body.update_seq }; };
  async function request(method, route, token, body, expected = 200, headers = {}) {
    const response = await fetch(origin + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = await response.json(); assert.equal(response.status, expected, `${method} ${route}: ${json.error?.code || 'unexpected status'}`); return { data: json.data, etag: response.headers.get('etag') };
  }
  const auth = async kind => (await request('POST', '/auth/login', null, { email: env[`LOCAL_TEST_${kind}_EMAIL`], password: env[`LOCAL_TEST_${kind}_PASSWORD`] })).data.accessToken;
  const before = await primary(), candidateToken = await auth('CANDIDATE'), recruiterToken = await auth('RECRUITER');
  const original = await request('GET', '/candidate/profile/me', candidateToken);
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); let testProfile, job;
  const watch = page => { page.on('pageerror', error => results.runtime_errors.push(error.message)); };
  async function login(page, kind, route) {
    await page.goto(origin + route); await page.getByLabel('Địa chỉ email', { exact: true }).fill(env[`LOCAL_TEST_${kind}_EMAIL`]); await page.getByLabel('Mật khẩu', { exact: true }).fill(env[`LOCAL_TEST_${kind}_PASSWORD`]); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname === route);
  }
  const capture = async (page, name) => { await page.waitForLoadState('networkidle'); await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished))); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); };
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); watch(page);
    let downloads = 0; page.on('download', () => downloads++);
    await login(page, 'CANDIDATE', '/profile'); await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click();
    const avatar = page.getByRole('button', { name: 'Thay ảnh đại diện', exact: true }); await avatar.waitFor();
    const avatarImage = page.locator('main header span[title="Ảnh đại diện ứng viên"]').first();
    const imageBox = await avatarImage.boundingBox(), buttonBox = await avatar.boundingBox(); assert.ok(buttonBox.y >= imageBox.y + imageBox.height);
    const png = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const context = canvas.getContext('2d'); context.fillStyle = '#2563eb'; context.fillRect(0, 0, 128, 128); context.fillStyle = '#fff'; context.font = 'bold 48px sans-serif'; context.fillText('UV', 27, 82); return canvas.toDataURL().split(',')[1]; }), 'base64');
    await page.getByLabel('Ảnh đại diện ứng viên', { exact: true }).setInputFiles({ name: 'avatar-test.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).waitFor({ state: 'visible' });
    await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678'); await page.getByLabel('Tỉnh / Thành phố', { exact: true }).fill('Hà Nội');
    await page.getByRole('tab', { name: 'Kỹ năng & Chuyên môn', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm ngoại ngữ', exact: true }).click(); const languageIndex = (original.data.profile.languages || []).length + 1;
    await page.getByLabel(`Ngoại ngữ ${languageIndex}`, { exact: true }).fill('English'); await page.getByLabel(`Trình độ ngoại ngữ ${languageIndex}`, { exact: true }).fill('Giao tiếp');
    await page.getByRole('tab', { name: 'CV Đính Kèm', exact: true }).click();
    // This PDF reproduces the old validator's rejection despite being readable.
    const pdf = Buffer.concat([Buffer.from('\ufeff\n'), pdfFixture('CV browser preview'), Buffer.alloc(4096, 32)]), word = docxFixture();
    const input = page.getByLabel('Tải CV trong hồ sơ ứng viên', { exact: true });
    await input.setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfake\n%%EOF') });
    await page.getByText(/Không đọc được cấu trúc PDF/).waitFor();
    await input.setInputFiles({ name: 'CV-compatible.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.getByRole('button', { name: 'Xem CV', exact: true }).waitFor(); await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click(); await page.getByText('Hồ sơ đã được lưu.', { exact: true }).waitFor();
    testProfile = (await request('GET', '/candidate/profile/me', candidateToken)).data.profile;
    assert.equal(testProfile.profile.phone, '0912345678'); assert.equal(testProfile.profile.location, 'Hà Nội'); assert.equal(testProfile.languages.at(-1).name, 'English');
    for (const key of ['skills', 'education', 'experience', 'projects', 'data_availability']) assert.deepEqual(testProfile[key], original.data.profile[key]);
    await page.getByRole('button', { name: 'Xem CV', exact: true }).click(); await page.getByTitle('CV: CV-compatible.pdf', { exact: true }).waitFor();
    await capture(page, 'candidate-pdf-preview'); assert.equal(downloads, 0); await page.getByRole('button', { name: 'Đóng bản xem CV', exact: true }).click();
    await page.getByRole('tab', { name: 'Thông tin chung', exact: true }).click(); await capture(page, 'candidate-profile-general');
    assert.equal(await page.getByLabel('Số điện thoại', { exact: true }).inputValue(), '0912345678');
    await page.getByRole('tab', { name: 'Kỹ năng & Chuyên môn', exact: true }).click(); await capture(page, 'candidate-profile-skills');
    await page.getByRole('tab', { name: 'Kinh nghiệm & Dự án', exact: true }).click(); await capture(page, 'candidate-profile-experience');
    await page.getByRole('tab', { name: 'Học vấn & Bằng cấp', exact: true }).click(); await capture(page, 'candidate-profile-education');
    results.checks.push('PDF with BOM/preamble and >1KB trailing padding uploads successfully; fake PDF is rejected; PDF preview opens without triggering download');
    results.checks.push('Five profile tabs, explicit view/edit, avatar button physically below image; contact/languages/CV/avatar persist without changing career collections');
    job = (await request('POST', '/jobs', recruiterToken, { title: `Kiểm thử xem CV ${Date.now()}`, industry: 'Công nghệ thông tin', seniority: 'JUNIOR', description: 'Tin cô lập để kiểm tra trình xem hồ sơ.', responsibilities: [], required_skills: ['JavaScript'], optional_skills: [], requirements: { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } }, status: 'OPEN', deadline: new Date(Date.now() + 86400000 * 7).toISOString() }, 201)).data;
    const uploadResponse = await fetch(origin + '/api/v1/uploads/resume', { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': 'CV-word.docx' }, body: word }); assert.equal(uploadResponse.status, 201); const wordAsset = (await uploadResponse.json()).data;
    let app = (await request('POST', '/applications', candidateToken, { job_id: job._id, request_id: randomUUID(), submission: { resume_file_id: wordAsset.asset_id } }, 201)).data;
    app = (await request('PATCH', `/applications/${encodeURIComponent(app._id)}/withdraw`, candidateToken, { expected_rev: app._rev, expected_stage: app.current_stage })).data;
    app = (await request('POST', '/applications', candidateToken, { job_id: job._id, request_id: randomUUID(), expected_rev: app._rev, submission: { resume_file_id: testProfile.resume_file.asset_id } }, 201)).data;
    results.job_id = job._id; results.application_id = app._id;
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Bảng Điều Khiển', exact: true }).click();
    const appCard = page.locator('article').filter({ has: page.getByRole('heading', { name: job.title, exact: true }) });
    await appCard.getByRole('heading', { name: job.title, exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.loading-spinner'));
    assert.equal(await appCard.getByRole('button', { name: 'Xem CV', exact: true }).count(), 0); await capture(page, 'candidate-dashboard');
    await appCard.getByRole('button', { name: /Xem chi tiết, CV và lịch sử/ }).click(); await appCard.getByRole('button', { name: 'Xem CV', exact: true }).first().waitFor(); await capture(page, 'candidate-dashboard-details');
    const recruiter = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); watch(recruiter); let recruiterDownloads = 0; recruiter.on('download', () => recruiterDownloads++);
    await login(recruiter, 'RECRUITER', '/recruiter/dashboard');
    await recruiter.locator('article').filter({ has: recruiter.getByRole('heading', { name: job.title, exact: true }) }).getByRole('link', { name: 'Xem ứng viên', exact: true }).click();
    await recruiter.getByRole('button', { name: 'Xem CV và xử lý', exact: true }).click();
    await recruiter.getByRole('button', { name: 'Xem CV', exact: true }).first().click(); await recruiter.getByTitle('CV: CV-compatible.pdf', { exact: true }).waitFor(); await capture(recruiter, 'recruiter-pdf-preview'); assert.equal(recruiterDownloads, 0);
    const downloadEvent = recruiter.waitForEvent('download'); await recruiter.getByRole('dialog').last().getByRole('button', { name: 'Tải CV: CV-compatible.pdf', exact: true }).click(); const downloaded = await downloadEvent; assert.equal(sha(fs.readFileSync(await downloaded.path())), sha(pdf));
    await recruiter.getByRole('button', { name: 'Đóng bản xem CV', exact: true }).click(); await recruiter.getByText(/Lần 1 · Đã rút đơn/).click();
    await recruiter.getByRole('button', { name: 'Xem CV', exact: true }).last().click(); await recruiter.getByRole('dialog').last().getByText('RecruiHub upload test', { exact: true }).waitFor(); await capture(recruiter, 'recruiter-word-preview');
    results.checks.push('Real Recruiter opens PDF and archived DOCX in browser; optional download retains SHA-256; lazy Candidate dashboard expands CV/history on demand');
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true }); watch(mobile); await login(mobile, 'CANDIDATE', '/profile');
    await mobile.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click(); await capture(mobile, 'candidate-profile-mobile'); assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.checks.push('Mobile Candidate profile at 390px has no horizontal overflow'); assert.deepEqual(results.runtime_errors, []);
  } catch (error) {
    results.failure = error.message;
    for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) await capture(page, `failure-${index}`).catch(() => {});
    throw error;
  } finally {
    try {
      const current = await request('GET', '/candidate/profile/me', candidateToken), patch = {};
      if (testProfile) {
        for (const [key, input] of [['resume_file', 'resume_file_id'], ['avatar', 'avatar_asset_id']]) if (current.data.profile[key]?.asset_id === testProfile[key]?.asset_id) patch[input] = original.data.profile[key]?.asset_id || null;
        for (const key of ['phone', 'location']) if (current.data.profile.profile[key] === testProfile.profile[key]) { patch.profile ||= {}; patch.profile[key] = original.data.profile.profile[key] || ''; }
        if (JSON.stringify(current.data.profile.languages) === JSON.stringify(testProfile.languages)) patch.languages = original.data.profile.languages || [];
        if (Object.keys(patch).length) await request('PATCH', '/candidate/profile/me', candidateToken, patch, 200, { 'If-Match': current.etag });
      }
      if (job) { const currentJob = (await request('GET', `/recruiter/jobs/${encodeURIComponent(job._id)}`, recruiterToken)).data; await request('DELETE', `/jobs/${encodeURIComponent(job._id)}`, recruiterToken, { expected_rev: currentJob._rev }); }
    } catch (error) { results.cleanup_failure = error.message; }
    results.primary_before = before; results.primary_after = await primary(); results.primary_unchanged = JSON.stringify(before) === JSON.stringify(results.primary_after);
    await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    assert.ok(results.primary_unchanged); assert.ok(!results.cleanup_failure, results.cleanup_failure); console.log(JSON.stringify(results, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
