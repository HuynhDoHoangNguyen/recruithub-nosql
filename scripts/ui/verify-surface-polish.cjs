const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { createHash } = require('node:crypto');
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
const phase = process.argv[2]; assert.ok(['before', 'after', 'pair'].includes(phase), 'Use before, after or pair');
const out = path.resolve('docs/surface-polish-verification'); fs.mkdirSync(path.join(out, phase), { recursive: true });
if (phase === 'pair') for (const folder of ['before-current', 'after-current']) fs.mkdirSync(path.join(out, folder), { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
(async () => {
  const { loadBackendEnvironment } = await import(pathToFileURL(path.resolve('backend/src/config/load-environment.js')));
  const { loadCouchDbConfig } = await import(pathToFileURL(path.resolve('scripts/database/couchdb-client.js')));
  const env = loadBackendEnvironment({ env: {} }), config = loadCouchDbConfig(), origin = 'http://localhost:5173';
  const baseline = phase === 'after' ? JSON.parse(fs.readFileSync(path.join(out, 'before.json'))) : null;
  const result = { phase, checked_at: new Date().toISOString(), mocked: false, business_writes: [], runtime_errors: [], pages: {}, interactions: [] };
  const primary = async () => { const r = await fetch(`${config.url}/${config.database}`, { headers: { Authorization: config.authHeader } }); assert.equal(r.status, 200); const d = await r.json(); return { doc_count: d.doc_count, update_seq: d.update_seq }; };
  const primaryBefore = await primary();
  async function api(route, token) { const response = await fetch(origin + '/api/v1' + route, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); const body = await response.json(); assert.equal(response.status, 200, `${route}: ${body.error?.code}`); return body.data; }
  const auth = async role => { const r = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env[`LOCAL_TEST_${role}_EMAIL`], password: env[`LOCAL_TEST_${role}_PASSWORD`] }) }); const b = await r.json(); assert.equal(r.status, 200); return b.data.accessToken; };
  const recruiterToken = await auth('RECRUITER');
  let applicantsRoute = baseline?.applicants_route || (phase === 'pair' ? JSON.parse(fs.readFileSync(path.join(out, 'before.json'))).applicants_route : null);
  if (!applicantsRoute) {
    const jobs = await api('/recruiter/jobs?limit=50', recruiterToken); assert.ok(jobs.items.length, 'An existing owned Job is needed');
    applicantsRoute = `/recruiter/jobs/${encodeURIComponent(jobs.items[0]._id)}/applicants`;
    for (const job of jobs.items) { const applicants = await api(`/jobs/${encodeURIComponent(job._id)}/applicants?limit=1`, recruiterToken); if (applicants.items.length) { applicantsRoute = `/recruiter/jobs/${encodeURIComponent(job._id)}/applicants`; break; } }
  }
  result.applicants_route = applicantsRoute;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function settle(page) { await page.waitForLoadState('networkidle'); await page.waitForFunction(() => !document.querySelector('main .loading-spinner')); await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0); await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished))); }
  async function interiorHash(page, png) {
    // Exclude the shared one-pixel section boundary from the hero capture.
    return hash(await page.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height - 2;
      canvas.getContext('2d').drawImage(img, 0, 1, img.width, img.height - 2, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL();
    }, 'data:image/png;base64,' + png.toString('base64')));
  }
  async function login(page, role, route) { await page.goto(origin + route); await page.getByLabel('Địa chỉ email', { exact: true }).fill(env[`LOCAL_TEST_${role}_EMAIL`]); await page.getByLabel('Mật khẩu', { exact: true }).fill(env[`LOCAL_TEST_${role}_PASSWORD`]); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(url => url.pathname === route); }
  const snapshots = [
    ['applicants', applicantsRoute, 'RECRUITER'], ['recruiter-dashboard', '/recruiter/dashboard', 'RECRUITER'],
    ['recruiter-profile', '/recruiter/profile', 'RECRUITER'], ['create-job', '/recruiter/jobs/create', 'RECRUITER'],
    ['candidate-dashboard', '/user/dashboard', 'CANDIDATE'], ['featured-jobs', '/', null],
    ['candidate-profile', '/profile', 'CANDIDATE', 'Thông tin chung'],
    ['candidate-profile-skills', '/profile', 'CANDIDATE', 'Kỹ năng & Chuyên môn'],
    ['candidate-profile-experience', '/profile', 'CANDIDATE', 'Kinh nghiệm & Dự án'],
    ['candidate-profile-education', '/profile', 'CANDIDATE', 'Học vấn & Bằng cấp'],
    ['candidate-profile-cv', '/profile', 'CANDIDATE', 'CV Đính Kèm'],
  ];
  try {
    for (const [name, route, role, profileTab] of snapshots) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.on('pageerror', error => result.runtime_errors.push({ page: name, message: error.message }));
      page.on('request', req => { const url = new URL(req.url()); if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && url.pathname !== '/api/v1/auth/login') result.business_writes.push({ page: name, method: req.method(), path: url.pathname }); });
      if (role) await login(page, role, route); else await page.goto(origin);
      await settle(page);
      if (profileTab) { await page.getByRole('tab', { name: profileTab, exact: true }).click(); await settle(page); }
      result.pages[name] = {};
      for (const [size, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
        await page.setViewportSize({ width, height }); await settle(page);
        let sameDataBaseline, sameDataLowerImages;
        const captures = phase === 'pair' ? ['before-current', 'after-current'] : [phase];
        for (const capture of captures) {
          if (phase === 'pair') {
            // Live users may change test records between runs. Compare the same
            // rendered DOM with the new stylesheet disabled/enabled; no API
            // interception, data snapshots, form submissions or database writes.
            await page.evaluate(before => {
              const sheet = [...document.styleSheets].find(s => s.ownerNode?.dataset?.viteDevId?.replaceAll('\\', '/').endsWith('/features/presentation/portalSurfaces.css'));
              if (!sheet) throw new Error('Presentation stylesheet not found');
              sheet.disabled = before;
              if (before) {
                window.__uiOriginalClasses = [];
                const change = (el, oldClass) => { window.__uiOriginalClasses.push([el, el.className]); el.className = oldClass; };
                document.querySelectorAll('.rh-featured-card').forEach(el => change(el, el.className.replace('border-slate-200', '!border-blue-100').replace('hover:border-slate-300', 'hover:!border-blue-300')));
                document.querySelectorAll('.rh-company-name').forEach(el => change(el, el.className.replace('break-words', 'truncate')));
                const allJobs = document.querySelector('#featured-jobs > div a.btn-secondary');
                if (allJobs) change(allJobs, allJobs.className + ' !border-blue-200 !text-blue-700 hover:!border-blue-400');
              } else { for (const [el, value] of window.__uiOriginalClasses || []) el.className = value; delete window.__uiOriginalClasses; }
            }, capture === 'before-current');
            await settle(page);
          }
        const scope = name === 'featured-jobs' ? page.locator('#featured-jobs') : page.locator('main');
        const semantics = await scope.evaluate(root => ({
          headings: [...root.querySelectorAll('h1,h2,h3,h4')].map(el => ({ tag: el.tagName, text: el.textContent.trim() })),
          controls: [...root.querySelectorAll('input,select,textarea,button,summary,a')].map(el => ({ tag: el.tagName, type: el.type || null, name: el.getAttribute('aria-label') || el.name || null, text: el.matches('button,summary,a') ? el.textContent.trim() : null, value: el.matches('input,select,textarea') ? el.value : null, href: el.getAttribute('href'), disabled: el.disabled || false, readOnly: el.readOnly || false, options: el.tagName === 'SELECT' ? [...el.options].map(o => [o.value, o.text]) : undefined })),
          labels: [...root.querySelectorAll('label,th')].map(el => el.textContent.trim()),
          grids: [...root.querySelectorAll('.grid')].map(el => ({ columns: getComputedStyle(el).gridTemplateColumns, width: Math.round(el.getBoundingClientRect().width) })),
          maxWidths: [...root.querySelectorAll('[class*="max-w-"]')].filter(el => !el.matches('td,th')).map(el => getComputedStyle(el).maxWidth),
        }));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${size}: horizontal overflow`);
        await page.screenshot({ path: path.join(out, capture, `${name}-${size}.png`), fullPage: true });
        const state = { semantic_hash: hash(JSON.stringify(semantics)), semantics };
        if (name === 'featured-jobs') {
          const hero = page.locator('main > section').first(); const nav = page.locator('body > #root nav[aria-label="Điều hướng chính"]');
          state.hero_hash = await interiorHash(page, await hero.screenshot({ path: path.join(out, capture, `home-hero-${size}.png`) }));
          state.hero_dom_hash = hash(await hero.evaluate(el => el.outerHTML));
          state.hero_styles_hash = hash(JSON.stringify(await hero.evaluate(root => [root, ...root.querySelectorAll('*')].map(el => { const css = getComputedStyle(el); return Object.fromEntries([...css].map(key => [key, css.getPropertyValue(key)])); }))));
          if (await nav.count()) state.navigation_hash = hash(await nav.screenshot());
          // The section starts at a fractional pixel. Locator screenshots round
          // outward and include one pixel of the preceding (approved) background.
          // Compare the full interior of every lower section, excluding only its
          // rasterized boundary, and compare all their computed styles as well.
          const lowerSections = page.locator('main > section');
          const lowerHashes = [], lowerImages = [];
          for (let index = 2; index < await lowerSections.count(); index++) {
            const lower = lowerSections.nth(index);
            // Align only the capture to an integer document coordinate. Text
            // rasterization must not differ merely because the preceding card
            // has wrapped a company name onto a fractional extra line.
            const originalStyle = await lower.getAttribute('style');
            await lower.evaluate(el => { const y = el.getBoundingClientRect().top + scrollY; el.style.transform = `translateY(${Math.round(y) - y}px)`; });
            try { const png = await lower.screenshot(); lowerHashes.push(hash(png)); lowerImages.push('data:image/png;base64,' + png.toString('base64')); }
            finally { await lower.evaluate((el, original) => original === null ? el.removeAttribute('style') : el.setAttribute('style', original), originalStyle); }
          }
          state.lower_sections_hash = hash(JSON.stringify(lowerHashes));
          state.lower_styles_hash = hash(JSON.stringify(await page.locator('main > section').evaluateAll(sections => sections.slice(2).flatMap(root => [root, ...root.querySelectorAll('*')].map(el => { const css = getComputedStyle(el); return Object.fromEntries([...css].map(key => [key, css.getPropertyValue(key)])); })))));
          state.lower_dom_hash = hash(await page.locator('main > section').evaluateAll(sections => sections.slice(2).map(el => el.outerHTML).join('')));
          if (capture === 'before-current') sameDataLowerImages = lowerImages;
          if (capture === 'after-current') {
            // Chrome dithers gradients by one color level when their document
            // position moves. Permit only that measured raster noise; DOM and
            // every computed style below are still compared exactly.
            state.lower_pixel_comparison = await page.evaluate(async pairs => {
              const decode = async src => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return { width: img.width, height: img.height, pixels: ctx.getImageData(0, 0, img.width, img.height).data }; };
              let maxDelta = 0, dimensionsEqual = true;
              for (const [left, right] of pairs) { const [a, b] = await Promise.all([decode(left), decode(right)]); if (a.width !== b.width || a.height !== b.height) { dimensionsEqual = false; break; } for (let i = 0; i < a.pixels.length; i++) maxDelta = Math.max(maxDelta, Math.abs(a.pixels[i] - b.pixels[i])); }
              return { dimensions_equal: dimensionsEqual, max_channel_delta: maxDelta };
            }, sameDataLowerImages.map((before, index) => [before, lowerImages[index]]));
            assert.ok(state.lower_pixel_comparison.dimensions_equal && state.lower_pixel_comparison.max_channel_delta <= 1, `${size}: lower section changed beyond one-level gradient raster noise`);
          }
        }
        if (capture === 'before-current') sameDataBaseline = state;
        else result.pages[name][size] = state;
        if (baseline) {
          // JSON fixtures omit undefined optional attributes; compare the same
          // serialized DOM representation without dropping meaningful fields.
          assert.deepEqual(JSON.parse(JSON.stringify(semantics)), baseline.pages[name][size].semantics, `${name}/${size}: structure, controls or grid changed`);
          if (name === 'featured-jobs') for (const key of ['hero_hash', 'navigation_hash', 'lower_sections_hash']) assert.equal(state[key], baseline.pages[name][size][key], `${key}/${size}: outside scope changed`);
        }
        if (capture === 'after-current') {
          assert.deepEqual(state.semantics, sameDataBaseline.semantics, `${name}/${size}: same-data DOM structure, controls or grid changed`);
          if (name === 'featured-jobs') for (const key of ['hero_hash', 'hero_dom_hash', 'hero_styles_hash', 'navigation_hash', 'lower_dom_hash', 'lower_styles_hash']) assert.equal(state[key], sameDataBaseline[key], `${key}/${size}: outside scope changed`);
          state.canvas_text_contrast = await page.evaluate(() => {
            const selectors = ['.rh-applicants > div > header h1', '.rh-applicants > div > header p', '.rh-applicants > div > label', '.rh-recruiter-dashboard > p', '.rh-candidate-dashboard > div > section > p', 'main.rh-surface-page > div > nav[aria-label="Đường dẫn"]', 'main.rh-surface-page > div > nav[aria-label="Đường dẫn hồ sơ"]', '.rh-featured-jobs #featured-heading', '.rh-featured-jobs #featured-heading + p'];
            const luminance = rgb => rgb.map(c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
            // Conservative light end of the navy canvas, including radial tint.
            const background = luminance([58, 79, 149]);
            return selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(el => { const color = getComputedStyle(el).color; const foreground = luminance(color.match(/[\d.]+/g).slice(0, 3).map(Number)); return { selector, color, ratio: Number(((foreground + .05) / (background + .05)).toFixed(2)) }; }));
          });
          for (const sample of state.canvas_text_contrast) assert.ok(sample.ratio >= 4.5, `${name}/${size}: canvas text contrast ${sample.ratio}`);
          state.same_data_comparison_passed = true;
        }
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 }); await settle(page);
      if (name === 'applicants' && await page.getByRole('button', { name: 'Xem CV và xử lý', exact: true }).count()) {
        const trigger = page.getByRole('button', { name: 'Xem CV và xử lý', exact: true }).first(); const triggerId = await trigger.getAttribute('id'); await trigger.click(); await page.getByRole('dialog').waitFor(); await settle(page);
        await page.screenshot({ path: path.join(out, phase, 'applicant-dialog-desktop.png'), fullPage: true });
        assert.ok(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))); await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => document.activeElement.id), triggerId);
        result.interactions.push('Existing applicant dialog opens, traps focus and restores trigger focus after Escape');
      }
      if (name === 'recruiter-profile') {
        const location = page.getByLabel('Tỉnh / Thành phố', { exact: true }); const value = await location.inputValue(); await location.fill('UI presentation check — chưa lưu');
        await page.getByRole('tab', { name: 'Thông tin công ty', exact: true }).click(); await page.getByRole('tab', { name: 'Thông tin chung', exact: true }).click(); assert.equal(await location.inputValue(), 'UI presentation check — chưa lưu');
        await page.getByRole('button', { name: 'Hủy', exact: true }).click(); assert.equal(await location.inputValue(), value); result.interactions.push('Company profile retains unsaved fields across tabs and Cancel restores baseline without saving');
      }
      if (name === 'create-job') {
        await page.getByLabel('Tiêu đề công việc *', { exact: true }).fill('Chưa lưu — kiểm tra giao diện');
        await page.getByLabel('Thông tin mức lương', { exact: true }).selectOption('RANGE'); await page.getByLabel('Lương tối thiểu / tháng', { exact: true }).fill('15000000'); await page.getByLabel('Cấp bậc', { exact: true }).selectOption('JUNIOR');
        assert.equal(await page.getByLabel('Tiêu đề công việc *', { exact: true }).inputValue(), 'Chưa lưu — kiểm tra giao diện'); assert.equal(await page.getByLabel('Lương tối thiểu / tháng', { exact: true }).inputValue(), '15000000');
        await page.getByLabel('Ngành nghề *', { exact: true }).focus(); assert.ok(await page.getByLabel('Ngành nghề *', { exact: true }).evaluate(el => el === document.activeElement)); result.interactions.push('Create Job native selects/focus work and entered values persist; no form submission');
      }
      if (name.endsWith('dashboard')) {
        const next = page.getByRole('button', { name: 'Trang sau', exact: true });
        if (await next.isEnabled()) { await next.click(); await settle(page); await page.locator('nav[aria-label="Phân trang"] [aria-current="page"]').filter({ hasText: 'Trang 2' }).waitFor(); await page.getByRole('button', { name: 'Trang trước', exact: true }).click(); await settle(page); }
        if (name === 'candidate-dashboard') { const expand = page.getByRole('button', { name: /Xem chi tiết, CV và lịch sử/ }).first(); if (await expand.count()) { await expand.click(); await page.getByRole('heading', { name: 'CV đã nộp', exact: true }).first().waitFor(); await page.screenshot({ path: path.join(out, phase, 'candidate-history-desktop.png'), fullPage: true }); } }
        result.interactions.push(`${name}: existing pagination/history controls work through read-only API calls`);
      }
      if (phase === 'pair') {
        if (name === 'candidate-profile') {
          const location = page.getByLabel('Tỉnh / Thành phố', { exact: true }); const value = await location.inputValue();
          assert.ok(await location.evaluate(el => el.readOnly));
          await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ', exact: true }).click();
          assert.ok(await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).isDisabled());
          await location.fill('Kiểm tra giao diện — chưa lưu');
          await page.getByRole('tab', { name: 'Kỹ năng & Chuyên môn', exact: true }).click(); await page.getByRole('tab', { name: 'Thông tin chung', exact: true }).click();
          assert.equal(await location.inputValue(), 'Kiểm tra giao diện — chưa lưu');
          await page.screenshot({ path: path.join(out, phase, 'candidate-profile-edit-desktop.png'), fullPage: true });
          await page.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click(); assert.equal(await location.inputValue(), value);
          assert.ok(await location.evaluate(el => el.readOnly)); result.interactions.push('Candidate profile: view/edit fields, disabled Save, tab values and Cancel work without saving/uploading');
        }
        if (name === 'applicants') {
          const filter = page.locator('main select');
          await filter.selectOption('APPLIED'); await settle(page); assert.equal(await filter.inputValue(), 'APPLIED');
          await filter.selectOption(''); await settle(page); result.interactions.push('Applicants stage filter selects and resets through read-only requests');
        }
        if (name === 'recruiter-dashboard') {
          const filter = page.locator('main select');
          await filter.selectOption('DRAFT'); await settle(page); assert.equal(await filter.inputValue(), 'DRAFT');
          await filter.selectOption(''); await settle(page); result.interactions.push('Recruiter status filter selects and resets without mutations');
        }
        if (name === 'candidate-dashboard') {
          const rejected = page.getByRole('button', { name: /^Đã từ chối/ }); await rejected.click(); await settle(page); assert.equal(await rejected.getAttribute('aria-pressed'), 'true');
          await page.getByRole('button', { name: /^Tất cả đơn nộp/ }).click(); await settle(page); result.interactions.push('Candidate status sidebar selects and resets without mutations');
        }
        if (name === 'create-job') {
          await page.emulateMedia({ reducedMotion: 'reduce' });
          assert.equal(await page.locator('main .btn-primary').first().evaluate(el => getComputedStyle(el).transitionDuration), '1e-05s');
          await page.emulateMedia({ reducedMotion: 'no-preference' }); result.interactions.push('Reduced motion removes nonessential transition duration');
        }
        if (role) {
          const menu = page.getByRole('button', { name: 'Menu tài khoản', exact: true }); await menu.click();
          assert.ok(await page.locator('#account-navigation').isVisible()); await page.keyboard.press('Escape');
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Mở menu', exact: true }).click(); assert.ok(await page.locator('#mobile-navigation').isVisible());
        await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: 'Mở menu', exact: true }).getAttribute('aria-expanded'), 'false');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); result.interactions.push(`${name}: desktop/mobile menus remain visible and Escape closes them`);
      }
      await page.close();
    }
    assert.deepEqual(result.business_writes, []); assert.deepEqual(result.runtime_errors, []);
  } catch (error) { result.failure = error.message; throw error; }
  finally { result.primary_before = primaryBefore; result.primary_after = await primary(); result.primary_unchanged = JSON.stringify(primaryBefore) === JSON.stringify(result.primary_after); result.compared_to_baseline = Boolean(baseline); result.same_data_pair_mode = phase === 'pair'; await browser.close(); fs.writeFileSync(path.join(out, `${phase}.json`), JSON.stringify(result, null, 2)); assert.ok(result.primary_unchanged); console.log(JSON.stringify({ phase, failure: result.failure, pages: Object.keys(result.pages), business_writes: result.business_writes.length, runtime_errors: result.runtime_errors.length, primary_unchanged: result.primary_unchanged, same_data_pair_mode: result.same_data_pair_mode }, null, 2)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
