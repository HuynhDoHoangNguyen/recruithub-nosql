const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  const output = path.resolve('docs/recruiter-enhancements-verification'); fs.mkdirSync(output, { recursive: true });
  const result = { checked_at: new Date().toISOString(), origin, mocked: false, checks: [], runtime_errors: [] };
  async function request(method, route, token, payload, status = 200) {
    const r = await fetch(origin + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const body = await r.json(); assert.equal(r.status, status, `${method} ${route}: ${body.error?.code || 'unexpected status'}`); return body.data || body.error;
  }
  const primaryInfo = async () => { const r = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(r.status, 200); return r.json(); };
  const before = await primaryInfo();
  const loginApi = async kind => (await request('POST', '/auth/login', null, { email: env[`LOCAL_TEST_${kind}_EMAIL`], password: env[`LOCAL_TEST_${kind}_PASSWORD`] })).accessToken;
  const recruiterToken = await loginApi('RECRUITER'), candidateToken = await loginApi('CANDIDATE');
  const original = await request('GET', '/recruiter/profile', recruiterToken);
  const person = { full_name: 'Recruiter kiểm thử giao diện', phone: '+84 900 000 001', location: 'Hà Nội', bio: 'Thông tin liên hệ kiểm thử trên tài khoản local riêng.' };
  let uploadedLogo;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const watch = page => { page.on('pageerror', error => result.runtime_errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); };
  const capture = async (page, name, fullPage = true) => {
    await page.waitForLoadState('networkidle');
    for (const button of await page.locator('.Toastify__close-button').all()) await button.click().catch(() => {});
    await page.locator('.Toastify__toast').last().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage });
  };
  async function login(page) {
    await page.getByRole('heading', { name: 'Chào mừng bạn trở lại', exact: true }).waitFor();
    await page.getByLabel('Địa chỉ email', { exact: true }).fill(env.LOCAL_TEST_RECRUITER_EMAIL);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(env.LOCAL_TEST_RECRUITER_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname !== '/login');
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(page);
    await page.goto(origin + '/recruiter/profile'); await login(page); await page.getByLabel('Họ và tên', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Hồ Sơ Doanh Nghiệp', exact: true }).getAttribute('href'), '/recruiter/profile');
    for (const [label, key] of [['Họ và tên', 'full_name'], ['Số điện thoại', 'phone'], ['Tỉnh / Thành phố', 'location'], ['Giới thiệu tóm tắt (Bio / Summary)', 'bio']]) await page.getByLabel(label, { exact: true }).fill(person[key]);
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await page.getByText('Đã lưu thông tin liên hệ.', { exact: true }).waitFor();
    await page.getByRole('heading', { name: person.full_name, exact: true }).waitFor();
    assert.equal((await request('GET', '/recruiter/profile', recruiterToken)).recruiter.profile.phone, person.phone);
    await capture(page, 'recruiter-profile-desktop');
    await page.getByRole('tab', { name: 'Thông tin công ty', exact: true }).click();
    const image = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    await page.getByLabel('Tải logo công ty từ máy tính', { exact: true }).setInputFiles({ name: 'logo-test.png', mimeType: 'image/png', buffer: image });
    await page.getByText('logo-test.png', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await page.getByText('Đã lưu thông tin công ty.', { exact: true }).waitFor();
    uploadedLogo = (await request('GET', '/recruiter/profile', recruiterToken)).company.logo_asset;
    await page.getByRole('img', { name: `Logo ${original.company.name}`, exact: true }).waitFor(); await capture(page, 'company-profile-logo');
    result.checks.push('Real Recruiter profile route, immutable email, personal/contact edits persisted; company logo saved through its own API');
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true }); watch(mobile);
    await mobile.goto(origin + '/recruiter/profile'); await login(mobile); await mobile.getByLabel('Họ và tên', { exact: true }).waitFor();
    assert.equal(await mobile.getByLabel('Họ và tên', { exact: true }).inputValue(), person.full_name); await capture(mobile, 'recruiter-profile-mobile');
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Đăng Tin Tuyển Dụng', exact: true }).click();
    await page.getByRole('heading', { name: 'Đăng Tin Tuyển Dụng IT Mới', exact: true }).waitFor();
    const values = await page.getByLabel('Cấp bậc', { exact: true }).locator('option').allTextContents(); assert.deepEqual(values, ['Intern', 'Fresher', 'Junior', 'Senior']);
    const title = `Tin UI lương và loại hợp đồng ${Date.now()}`; result.job_title = title;
    for (const [label, value] of [['Tiêu đề công việc *', title], ['Ngành nghề *', 'Công nghệ thông tin'], ['Mô tả công việc *', 'Tin kiểm chứng các trường mới qua UI và CouchDB thật.'], ['Kỹ năng bắt buộc * (phân cách bằng dấu phẩy)', 'JavaScript, CouchDB']]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel('Cấp bậc', { exact: true }).selectOption('FRESHER');
    await page.getByLabel('Địa điểm làm việc', { exact: true }).selectOption('VN-HN'); await page.getByLabel('Hình thức làm việc', { exact: true }).selectOption('HYBRID');
    await page.getByLabel('Loại hình làm việc', { exact: true }).selectOption('FULL_TIME'); await page.getByLabel('Thông tin mức lương', { exact: true }).selectOption('RANGE');
    await page.getByLabel('Lương tối thiểu / tháng', { exact: true }).fill('15000000'); await page.getByLabel('Lương tối đa / tháng', { exact: true }).fill('25000000');
    const deadline = new Date(Date.now() + 7 * 86400000 + 7 * 3600000).toISOString().slice(0, 16);
    await page.getByLabel('Hạn nộp (giờ Việt Nam, UTC+7)', { exact: true }).fill(deadline); await capture(page, 'create-job-salary-and-types');
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/v1/jobs') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Tạo tin tuyển dụng', exact: true }).click(); const created = (await (await responsePromise).json()).data; assert.ok(created?._id); result.job_id = created._id;
    const jobRoute = '/jobs/' + encodeURIComponent(created._id);
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) }); await card.waitFor();
    assert.equal(created.employment_type, 'FULL_TIME'); assert.equal(created.work_mode, 'HYBRID'); assert.equal(created.salary.max, 25000000);
    await card.getByRole('img', { name: `Logo ${original.company.name}`, exact: true }).waitFor(); await card.screenshot({ path: path.join(output, 'recruiter-job-card.png') });
    await card.getByRole('link', { name: 'Chỉnh sửa', exact: true }).click(); await page.getByRole('heading', { name: 'Chỉnh Sửa Tin Tuyển Dụng IT', exact: true }).waitFor();
    await page.locator('select#employment_type option[value="PART_TIME"]').waitFor({ state: 'attached' });
    assert.equal(await page.getByLabel('Thông tin mức lương', { exact: true }).inputValue(), 'RANGE');
    await page.getByLabel('Cấp bậc', { exact: true }).selectOption('INTERN'); await page.getByLabel('Loại hình làm việc', { exact: true }).selectOption('PART_TIME');
    await page.getByLabel('Thông tin mức lương', { exact: true }).selectOption('NEGOTIABLE'); await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await card.getByRole('button', { name: 'Đăng tuyển', exact: true }).click(); await card.getByRole('button', { name: 'Đóng tin', exact: true }).waitFor();
    const edited = await request('GET', '/recruiter/jobs/' + encodeURIComponent(created._id), recruiterToken); assert.equal(edited.seniority, 'INTERN'); assert.equal(edited.employment_type, 'PART_TIME'); assert.equal(edited.work_mode, 'HYBRID'); assert.equal(edited.salary.type, 'NEGOTIABLE');
    result.checks.push('Four level choices; create persists separate work mode/employment/range salary; edit restores fields and saves Intern/Part time/negotiable');
    const guest = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(guest); await guest.goto(origin + jobRoute);
    await guest.getByRole('heading', { name: title, exact: true }).waitFor(); await guest.getByText('Thỏa thuận', { exact: true }).waitFor(); await capture(guest, 'public-job-salary');
    const application = await request('POST', '/applications', candidateToken, { job_id: created._id, submission: { resume_text: 'CV được giữ lại sau khi Recruiter xóa tin.' } }, 201);
    const appRoute = '/applications/' + encodeURIComponent(application._id); const appBefore = await request('GET', appRoute, candidateToken);
    await card.getByRole('link', { name: 'Xem ứng viên', exact: true }).click(); await page.getByRole('heading', { name: 'Hồ sơ ứng viên', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }).waitFor(); await capture(page, 'applicants-icons-and-actions');
    await page.getByRole('button', { name: 'Xóa tin', exact: true }).click(); await page.waitForURL(url => url.pathname === '/recruiter/dashboard');
    await page.getByRole('heading', { name: 'Tin tuyển dụng của tôi', exact: true }).waitFor(); assert.equal(await page.getByRole('heading', { name: title, exact: true }).count(), 0);
    await request('GET', jobRoute, null, null, 404);
    const appAfter = await request('GET', appRoute, candidateToken); assert.equal(appAfter._rev, appBefore._rev); assert.deepEqual(appAfter.submission, appBefore.submission); assert.deepEqual(appAfter.stage_history, appBefore.stage_history);
    result.checks.push('Logo and salary render from stored company/job data; compact icon buttons in Job cards and applicants', 'Delete from applicants confirms, hides Job/public page and preserves the exact CV/history/revision', 'Mobile profile reload retains stored contact fields and has no horizontal overflow');
  } catch (error) {
    result.failure = error.message;
    for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) await capture(page, `failure-${index}`).catch(() => {});
    throw error;
  } finally {
    try {
      let current = await request('GET', '/recruiter/profile', recruiterToken);
      if (Object.entries(person).every(([key, value]) => current.recruiter.profile[key] === value)) {
        await request('PATCH', '/recruiter/profile', recruiterToken, { expected_rev: current.recruiter._rev, profile: Object.fromEntries(Object.keys(person).map(key => [key, original.recruiter.profile[key] || ''])) });
      }
      current = await request('GET', '/recruiter/profile', recruiterToken);
      if (uploadedLogo && current.company.logo_asset?.asset_id === uploadedLogo.asset_id) {
        await request('PATCH', '/recruiter/company', recruiterToken, { expected_rev: current.company._rev, company: { name: current.company.name, industry: current.company.industry, logo_asset_id: original.company.logo_asset?.asset_id || null } });
        if (original.company.logo_url && !original.company.logo_asset) {
          current = await request('GET', '/recruiter/profile', recruiterToken);
          await request('PATCH', '/recruiter/company', recruiterToken, { expected_rev: current.company._rev, company: { name: current.company.name, industry: current.company.industry, logo_url: original.company.logo_url } });
        }
      }
      result.test_profile_and_logo_restored = true;
      const after = await primaryInfo(); assert.equal(after.doc_count, before.doc_count); assert.equal(after.update_seq, before.update_seq); result.historical_database_unchanged = true;
      assert.deepEqual(result.runtime_errors, []);
    } catch (error) { result.cleanup_failure = error.message; process.exitCode = 1; }
    await browser.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
