const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'); const { createHash } = require('node:crypto');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const { pdfFixture, docxFixture } = await import(pathToFileURL(path.resolve('backend/tests/helpers/upload-fixtures.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  const output = path.resolve('docs/file-upload-verification'); fs.mkdirSync(output, { recursive: true });
  const result = { checked_at: new Date().toISOString(), origin, mocked: false, checks: [], runtime_errors: [] };
  async function request(method, route, token, body, expected = 200, headers = {}) {
    const response = await fetch(origin + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = await response.json(); assert.equal(response.status, expected, `${method} ${route}: ${json.error?.code || 'unexpected status'}`); return { data: json.data || json.error, etag: response.headers.get('etag') };
  }
  const primaryInfo = async () => { const r = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(r.status, 200); return r.json(); };
  const before = await primaryInfo();
  const auth = async kind => (await request('POST', '/auth/login', null, { email: env[`LOCAL_TEST_${kind}_EMAIL`], password: env[`LOCAL_TEST_${kind}_PASSWORD`] })).data.accessToken;
  const candidateToken = await auth('CANDIDATE'), recruiterToken = await auth('RECRUITER');
  const originalCandidate = await request('GET', '/candidate/profile/me', candidateToken), originalCompany = (await request('GET', '/recruiter/profile', recruiterToken)).data.company;
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); let job, testFiles, testLogo;
  const sha = buffer => createHash('sha256').update(buffer).digest('hex');
  const watch = page => { page.on('pageerror', error => result.runtime_errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); };
  const capture = async (page, name, fullPage = false) => { await page.waitForLoadState('networkidle'); for (const button of await page.locator('.Toastify__close-button').all()) await button.click().catch(() => {}); await page.screenshot({ path: path.join(output, `${name}.png`), fullPage }); };
  async function login(page, kind) {
    await page.getByRole('heading', { name: 'Chào mừng bạn trở lại', exact: true }).waitFor(); await page.getByLabel('Địa chỉ email', { exact: true }).fill(env[`LOCAL_TEST_${kind}_EMAIL`]); await page.getByLabel('Mật khẩu', { exact: true }).fill(env[`LOCAL_TEST_${kind}_PASSWORD`]); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname !== '/login');
  }
  async function download(page, name, buffer) {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: `Tải CV: ${name}`, exact: true }).click(); const file = await pending;
    assert.equal(file.suggestedFilename(), name); assert.equal(sha(fs.readFileSync(await file.path())), sha(buffer));
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); watch(page);
    await page.goto(origin + '/profile'); await login(page, 'CANDIDATE'); await page.getByRole('heading', { name: 'Hồ sơ của bạn', exact: true }).waitFor();
    const png = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; const ctx = c.getContext('2d'); ctx.fillStyle = '#2563eb'; ctx.fillRect(0, 0, 160, 160); ctx.fillStyle = '#fff'; ctx.font = 'bold 58px sans-serif'; ctx.fillText('UV', 32, 100); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    const pdf = pdfFixture(), docx = docxFixture();
    for (const [extension, contentType] of [['jpg', 'image/jpeg'], ['webp', 'image/webp']]) {
      const data = Buffer.from(await page.evaluate(type => { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64); return c.toDataURL(type).split(',')[1]; }, contentType), 'base64');
      const response = await fetch(origin + '/api/v1/uploads/avatar', { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': `avatar.${extension}` }, body: data });
      assert.equal(response.status, 201); assert.equal((await response.json()).data.content_type, contentType);
    }
    const cv = page.getByLabel('Tải CV trong hồ sơ ứng viên', { exact: true });
    await cv.setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') }); await page.getByText('CV chỉ hỗ trợ .doc, .docx và .pdf.', { exact: true }).waitFor();
    await cv.setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024) }); await page.getByText('Kích thước file phải dưới 5 MB.', { exact: true }).waitFor();
    const invalid = await fetch(origin + '/api/v1/uploads/resume', { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': 'fake.pdf' }, body: Buffer.from('not-pdf') }); assert.equal(invalid.status, 400);
    await cv.setInputFiles({ name: 'CV_hoso.pdf', mimeType: 'application/pdf', buffer: pdf }); await page.getByText('CV_hoso.pdf', { exact: true }).waitFor();
    await page.getByLabel('Ảnh đại diện ứng viên', { exact: true }).setInputFiles({ name: 'anh-ung-vien.png', mimeType: 'image/png', buffer: png }); await page.getByText('anh-ung-vien.png', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click(); await page.getByText('Hồ sơ đã được lưu.', { exact: true }).waitFor();
    await page.getByRole('img', { name: 'Ảnh đại diện ứng viên', exact: true }).waitFor(); await download(page, 'CV_hoso.pdf', pdf); await capture(page, 'candidate-profile-files');
    const saved = (await request('GET', '/candidate/profile/me', candidateToken)).data.profile; testFiles = saved; assert.equal(saved.resume_file.file_name, 'CV_hoso.pdf'); assert.equal(saved.avatar.content_type, 'image/png');
    await page.reload(); await login(page, 'CANDIDATE'); await page.getByText('CV_hoso.pdf', { exact: true }).waitFor(); await page.getByRole('img', { name: 'Ảnh đại diện ứng viên', exact: true }).waitFor();
    result.checks.push('Real Candidate profile: invalid extension and exact 5 MiB rejected; PDF and PNG uploaded, saved, reloaded; downloaded PDF has identical SHA-256; real JPEG/WEBP uploads accepted');
    job = (await request('POST', '/jobs', recruiterToken, { title: `Tin thử CV đính kèm ${Date.now()}`, industry: 'Công nghệ thông tin', seniority: 'JUNIOR', description: 'Kiểm chứng file CV và quyền tải.', responsibilities: [], requirements: { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } }, required_skills: ['JavaScript'], optional_skills: [], status: 'OPEN', deadline: new Date(Date.now() + 7 * 86400000).toISOString() }, 201)).data;
    result.job_id = job._id;
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Việc Làm IT', exact: true }).click(); await page.locator(`main a.card[href="/jobs/${encodeURIComponent(job._id)}"]`).click();
    await page.getByRole('button', { name: 'Ứng tuyển ngay', exact: true }).first().click(); await page.getByRole('button', { name: 'Dùng CV từ hồ sơ: CV_hoso.pdf', exact: true }).click();
    await page.getByLabel('Tải CV từ máy tính', { exact: true }).setInputFiles({ name: 'CV_lan_mot.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx }); await page.getByText('CV_lan_mot.docx', { exact: true }).waitFor(); await capture(page, 'apply-file-upload');
    await page.getByRole('button', { name: 'Xác nhận nộp hồ sơ', exact: true }).click(); await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).click(); await page.getByRole('button', { name: 'Ứng tuyển lại', exact: true }).first().click();
    await page.getByRole('button', { name: 'Dùng CV từ hồ sơ: CV_hoso.pdf', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận nộp hồ sơ', exact: true }).click(); await page.getByRole('heading', { name: 'Lịch sử các lần ứng tuyển (1)', exact: true }).waitFor();
    const app = (await request('GET', '/applications/my-applications?job_id=' + encodeURIComponent(job._id), candidateToken)).data.items[0]; result.application_id = app._id;
    assert.equal(app.submission.resume_file.file_name, 'CV_hoso.pdf'); assert.equal(app.previous_attempts[0].submission.resume_file.file_name, 'CV_lan_mot.docx');
    const anonymous = await fetch(origin + `/api/v1/uploads/${encodeURIComponent(app.submission.resume_file.asset_id)}/content`); assert.equal(anonymous.status, 401);
    result.checks.push('Real file-only application: DOCX submitted, withdrawn, reapplied using saved PDF; each attempt preserves its own file; anonymous CV download blocked');
    const recruiter = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); watch(recruiter); await recruiter.goto(origin + '/recruiter/dashboard'); await login(recruiter, 'RECRUITER');
    const card = recruiter.locator('article').filter({ has: recruiter.getByRole('heading', { name: job.title, exact: true }) }); await card.getByRole('link', { name: 'Xem ứng viên', exact: true }).click(); await recruiter.getByRole('button', { name: 'Xem CV và xử lý', exact: true }).click();
    await recruiter.getByRole('img', { name: 'Ảnh đại diện ứng viên', exact: true }).waitFor(); await download(recruiter, 'CV_hoso.pdf', pdf);
    await recruiter.getByText(/Lần 1 · Đã rút đơn/).click(); await download(recruiter, 'CV_lan_mot.docx', docx); await capture(recruiter, 'recruiter-downloads-attempts');
    result.checks.push('Authorized Recruiter loads Candidate avatar and downloads both current and archived CV files; SHA-256 and original Unicode-safe filenames match');
    await recruiter.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click(); await recruiter.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Hồ Sơ Doanh Nghiệp', exact: true }).click(); await recruiter.getByRole('tab', { name: 'Thông tin công ty', exact: true }).click();
    assert.equal(await recruiter.getByLabel('URL logo công ty', { exact: true }).count(), 0);
    await recruiter.getByLabel('Tải logo công ty từ máy tính', { exact: true }).setInputFiles({ name: 'logo-cong-ty.png', mimeType: 'image/png', buffer: png }); await recruiter.getByText('logo-cong-ty.png', { exact: true }).waitFor(); await recruiter.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await recruiter.getByText('Đã lưu thông tin công ty.', { exact: true }).waitFor(); await recruiter.getByRole('tabpanel').screenshot({ path: path.join(output, 'company-logo-upload.png') });
    const company = (await request('GET', '/recruiter/profile', recruiterToken)).data.company; testLogo = company.logo_asset; assert.ok(company.logo_asset?.asset_id); const publicLogo = await fetch(origin + company.logo_url); assert.equal(publicLogo.status, 200); assert.equal(sha(Buffer.from(await publicLogo.arrayBuffer())), sha(png));
    await recruiter.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Bảng Điều Khiển', exact: true }).click(); await card.getByRole('img', { name: `Logo ${company.name}`, exact: true }).waitFor(); await card.screenshot({ path: path.join(output, 'uploaded-logo-job-card.png') });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true }); watch(mobile); await mobile.goto(origin + '/profile'); await login(mobile, 'CANDIDATE'); await mobile.getByText('CV_hoso.pdf', { exact: true }).waitFor(); await capture(mobile, 'candidate-upload-mobile', true); assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    result.checks.push('Company logo selected from disk, persisted as CouchDB attachment and displayed publicly on Job card; mobile Candidate form has no horizontal overflow');
    assert.deepEqual(result.runtime_errors, []);
  } catch (error) {
    result.failure = error.message;
    for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) await capture(page, `failure-${index}`).catch(() => {});
    throw error;
  } finally {
    try {
      const current = await request('GET', '/candidate/profile/me', candidateToken);
      const restore = {};
      for (const [key, input] of [['resume_file', 'resume_file_id'], ['avatar', 'avatar_asset_id']]) {
        if (testFiles?.[key] && current.data.profile[key]?.asset_id === testFiles[key].asset_id) restore[input] = originalCandidate.data.profile[key]?.asset_id || null;
      }
      if (Object.keys(restore).length) await request('PATCH', '/candidate/profile/me', candidateToken, restore, 200, { 'If-Match': current.etag });
      let company = (await request('GET', '/recruiter/profile', recruiterToken)).data.company;
      if (testLogo && company.logo_asset?.asset_id === testLogo.asset_id) {
        await request('PATCH', '/recruiter/company', recruiterToken, { expected_rev: company._rev, company: { name: company.name, industry: company.industry, logo_asset_id: originalCompany.logo_asset?.asset_id || null } });
        if (originalCompany.logo_url && !originalCompany.logo_asset) { company = (await request('GET', '/recruiter/profile', recruiterToken)).data.company; await request('PATCH', '/recruiter/company', recruiterToken, { expected_rev: company._rev, company: { name: company.name, industry: company.industry, logo_url: originalCompany.logo_url } }); }
      }
      if (job) { const currentJob = (await request('GET', '/recruiter/jobs/' + encodeURIComponent(job._id), recruiterToken)).data; await request('DELETE', '/jobs/' + encodeURIComponent(job._id), recruiterToken, { expected_rev: currentJob._rev }); }
      const after = await primaryInfo(); assert.equal(after.doc_count, before.doc_count); assert.equal(after.update_seq, before.update_seq); result.historical_database_unchanged = true; result.profile_and_company_file_choices_restored = true;
    } catch (error) { result.cleanup_failure = error.message; process.exitCode = 1; }
    await browser.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
