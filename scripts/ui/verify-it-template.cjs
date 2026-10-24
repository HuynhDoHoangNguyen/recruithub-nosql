const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const project = process.cwd();
const requireFrontend = createRequire(path.join(project, 'frontend/package.json'));
const { chromium } = require(path.join(os.tmpdir(), 'recruithub-browser-checks/node_modules/playwright'));
const output = path.join(project, 'docs/it-template-verification');
fs.mkdirSync(output, { recursive: true });
// The template uses its own mock adapter. Its browser storage is isolated from
// the production portal; this is a presentation comparison, never Identity proof.
async function compareReference(browser, fixture, candidate, recruiter, base, shot, result, output) {
 const currentJob = [...fixture.repo.docs.values()].find(doc => doc.title === 'Browser verification edited');
 const application = [...fixture.repo.docs.values()].find(doc => doc.type === 'application' && doc.job_id === currentJob._id);
 const referenceUsers = ['candidate', 'recruiter'].map(role => ({ ...fixture.users[role],
  role: role === 'candidate' ? 'job-seeker' : role, name: role === 'candidate' ? fixture.candidate.profile.role : 'Quản lý tuyển dụng',
  skills: [], education: [], projects: [], internships: [], certifications: [], awards: [], clubs: [],
 }));
 const referenceJobs = [...fixture.repo.docs.values()].filter(doc => doc.type === 'job' && doc.status === 'OPEN').map(doc => ({
  _id: doc._id, title: doc.title, description: doc.description, company: 'Công ty kiểm thử',
  skills: doc.required_skills, tags: doc.required_skills, createdAt: doc.created_at, status: 'open',
  createdBy: { _id: fixture.users.recruiter._id, email: fixture.users.recruiter.email },
 }));
 const db = { users: referenceUsers, jobs: referenceJobs, applications: [{ _id: application._id, jobId: currentJob._id,
  applicantId: fixture.users.candidate._id, status: 'pending', createdAt: application.applied_at }] };
 result.comparisons = [];
 for (const [route, name, role, actualPage] of [['/', 'landing', null, null], ['/jobs', 'jobs', null, null],
  ['/recruiter/jobs/create', 'create', 'recruiter', recruiter], ['/user/dashboard', 'candidate', 'candidate', candidate]]) {
  const context = await browser.newContext({ viewport: result.viewport });
  const principal = referenceUsers.find(user => user.role === (role === 'candidate' ? 'job-seeker' : role));
  const token = principal ? 'e30.' + Buffer.from(JSON.stringify({ ...principal, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.reference-only' : null;
  await context.addInitScript(({ db, token }) => { localStorage.setItem('job_portal_mock_db_v2', JSON.stringify(db)); if(token) localStorage.setItem('accessToken', token); }, { db, token });
  const referencePage = await context.newPage();
  await referencePage.goto('http://localhost:5174'+route);
  await referencePage.locator('nav.sticky').waitFor();
  await referencePage.waitForTimeout(500);
  await referencePage.evaluate(() => document.fonts.ready);
  await referencePage.screenshot({path:path.join(output,'reference-'+name+'-desktop.png'),fullPage:true});
  result.screenshots.push('reference-'+name+'-desktop.png');
  const page = actualPage || await browser.newPage({viewport:result.viewport});
  await page.setViewportSize(result.viewport);
  await page.goto(base+route);
  if(name==='create') await page.getByLabel('Tiêu đề công việc *',{exact:true}).waitFor();
  else if(name==='candidate') await page.locator('article').first().waitFor();
  else await page.getByRole('heading',{name:referenceJobs[0].title,exact:true}).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await shot(page,'app-'+name+'-desktop');
  const metrics = async page => page.evaluate(() => ({fontFamily:getComputedStyle(document.body).fontFamily, navbarHeight:document.querySelector('nav.sticky').getBoundingClientRect().height, viewport:innerWidth}));
  result.comparisons.push({ page:name, role:role||'guest', reference:await metrics(referencePage), application:await metrics(page),
   content:'Same fixture Job title/company/skills and one APPLIED application (reference pending). Salary/location absent in application schema; reference legacy fields are not copied.', productionIdentity:false });
  if(!actualPage) await page.close();
  await context.close();
 }
 await recruiter.goto(base+'/recruiter/dashboard');
 await recruiter.getByRole('heading',{name:currentJob.title,exact:true}).waitFor();
}
(async () => {
 const { createServer } = await import(pathToFileURL(requireFrontend.resolve('vite')));
 const { default: react } = await import(pathToFileURL(requireFrontend.resolve('@vitejs/plugin-react')));
 const { createApp } = await import(pathToFileURL(path.join(project,'backend/src/app.js')));
 const { createFixture, signToken } = await import(pathToFileURL(path.join(project,'backend/tests/recruitment/fixtures.js')));
 const fixture = createFixture();
 const jwtEnv = { JWT_ALGORITHM: 'HS256', JWT_SECRET: randomBytes(48).toString('base64url') };
 const api = createApp({ repository: fixture.repo, now: fixture.now, jwtEnv }).listen(0, '127.0.0.1');
 await new Promise(resolve => api.once('listening', resolve));
 const { default: theme } = await import(pathToFileURL(path.join(project, 'frontend/tailwind.config.js')));
 const actual = await createServer({ root: path.join(project,'frontend'), cacheDir: fs.mkdtempSync(path.join(os.tmpdir(),'recruithub-ui-cache-')), configFile: false, plugins: [react()], css: { postcss: { plugins: [requireFrontend('tailwindcss')({content:[path.join(project,'frontend/index.html'),path.join(project,'frontend/src/**/*.{js,jsx}')],theme:theme.theme,plugins:[]}),requireFrontend('autoprefixer')()] } }, server: { host: '127.0.0.1', port: 5181, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}`, changeOrigin: true } } }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') } });
 await actual.listen();
 const reference = {close: async () => {}};
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const failures = [];
 const result = { generatedAt: new Date().toISOString(), referenceOrigin: 'http://localhost:5174', viewport: {width:1286,height:1000}, mode: 'Browser integration with isolated memory repository and signed test JWT; no production login or CouchDB writes', publicLive: [], screenshots: [], checks: [] };
 const base = 'http://127.0.0.1:5181';
 async function pageFor(role, viewport={width:1286,height:1000}) {
   const ctx = await browser.newContext({viewport});
   if (role) {
    const user = fixture.users[role];
    const token = signToken(jwtEnv,user,{email:user.email});
    await ctx.addInitScript(value => localStorage.setItem('accessToken',value),token);
   }
   const page = await ctx.newPage();
   page.on('pageerror',error=>{failures.push(error.message); console.error('Browser runtime error: '+error.message);});
   return page;
 }
 async function shot(page,name) {
   await page.locator('nav.sticky').waitFor({timeout:60000}); console.log('Screenshot '+name); await page.screenshot({path:path.join(output,name+'.png'),fullPage:true}); result.screenshots.push(name+'.png');
   const widths=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:window.innerWidth}));
   assert.ok(widths.document<=widths.viewport,`Overflow on ${name}: ${JSON.stringify(widths)}`);
   assert.equal(await page.locator('nav.sticky').count(),1);
 }
 try {
  const live = await pageFor();
  for (const path of ['/api/health','/api/health/database','/api/v1/jobs']) {
   const response = await live.request.get('http://localhost:5173'+path); assert.equal(response.status(),200);
   result.publicLive.push({path,status:response.status()});
  }
  await live.close();
  const guest = await pageFor();
  await guest.goto(base+'/jobs');
  await guest.route('**/api/v1/jobs?*',route=>route.abort());
  await guest.reload(); await guest.getByRole('alert').waitFor();
  await shot(guest,'app-jobs-network-error');
  await guest.unroute('**/api/v1/jobs?*');
  await guest.getByRole('button',{name:'Thử lại',exact:true}).click();
  await guest.getByRole('alert').waitFor({state:'detached'});
  result.checks.push('Network error preserves filters/navigation; Retry restores API data');
  await guest.setViewportSize({width:390,height:844}); await guest.goto(base+'/jobs');
  await guest.getByRole('button',{name:'Mở menu',exact:true}).click();
  await guest.getByRole('link',{name:'Đăng nhập',exact:true}).last().click();
  await guest.getByRole('heading',{name:'Welcome back'}).waitFor();
  assert.equal(await guest.locator('#mobile-navigation').count(),0);
  await shot(guest,'app-login-mobile'); result.checks.push('Mobile menu opens, navigates and closes');
  await guest.goto(base+'/jobs'); await guest.getByRole('button',{name:'Hiện bộ lọc'}).click();
  await shot(guest,'app-jobs-mobile');
  await guest.setViewportSize({width:768,height:1024}); await shot(guest,'app-jobs-tablet');
  await guest.close();

  const recruiter = await pageFor('recruiter');
  await recruiter.goto(base+'/recruiter/dashboard');
  await recruiter.getByRole('heading',{name:'Quản lý tuyển dụng',exact:true}).waitFor();
  await shot(recruiter,'app-recruiter-desktop');
  await recruiter.setViewportSize({width:390,height:844});
  await recruiter.getByRole('button',{name:'Mở menu',exact:true}).click();
  await recruiter.locator('#mobile-navigation').getByRole('link',{name:'Đăng Tin Tuyển Dụng',exact:true}).click();
  await recruiter.getByLabel('Tiêu đề công việc *',{exact:true}).waitFor();
  await shot(recruiter,'app-create-mobile');
  await recruiter.getByRole('link',{name:'Hủy bỏ',exact:true}).click();
  await recruiter.setViewportSize({width:1286,height:1000});
  await recruiter.getByRole('link',{name:'Đăng Tin Tuyển Dụng',exact:true}).click();
  await recruiter.getByLabel('Tiêu đề công việc *',{exact:true}).waitFor();
  await shot(recruiter,'app-create-desktop');
  await recruiter.getByLabel('Tiêu đề công việc *',{exact:true}).fill('Browser verification job');
  await recruiter.getByLabel('Ngành nghề *',{exact:true}).fill('SaaS');
  await recruiter.getByLabel('Mô tả công việc *',{exact:true}).fill('Browser integration against isolated test API');
  await recruiter.getByLabel('Kỹ năng bắt buộc * (phân cách bằng dấu phẩy)',{exact:true}).fill('JavaScript');
  await recruiter.getByLabel('Trách nhiệm (mỗi dòng một mục)',{exact:true}).fill('Build APIs');
  await recruiter.getByLabel('Yêu cầu chung (mỗi dòng một mục)',{exact:true}).fill('NoSQL');
  await recruiter.getByLabel('Hạn nộp (giờ Việt Nam, UTC+7)',{exact:true}).fill('2026-10-30T20:00');
  await recruiter.getByRole('button',{name:'Tạo tin tuyển dụng',exact:true}).click();
  await recruiter.getByRole('heading',{name:'Browser verification job',exact:true}).waitFor();
  const job = [...fixture.repo.docs.values()].find(doc=>doc.title==='Browser verification job');
  assert.equal(job.status,'DRAFT');
  let card = recruiter.locator('article').filter({has:recruiter.getByRole('heading',{name:job.title,exact:true})});
  await card.getByRole('link',{name:'Chỉnh sửa',exact:true}).click();
  await recruiter.getByLabel('Tiêu đề công việc *',{exact:true}).fill('Browser verification edited');
  await recruiter.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
  await recruiter.getByRole('heading',{name:'Browser verification edited',exact:true}).waitFor();
  card = recruiter.locator('article').filter({has:recruiter.getByRole('heading',{name:'Browser verification edited',exact:true})});
  await card.getByRole('button',{name:'Đăng tuyển',exact:true}).click();
  await card.getByText('Đang tuyển',{exact:true}).waitFor();
  result.checks.push('Recruiter navigation → create DRAFT → edit → publish OPEN');

  const candidate = await pageFor('candidate');
  await candidate.goto(base+'/user/dashboard');
  await candidate.setViewportSize({width:390,height:844});
  await candidate.getByRole('button',{name:'Mở menu',exact:true}).click();
  assert.ok(await candidate.locator('#mobile-navigation').getByRole('link',{name:'Hồ Sơ & CV',exact:true}).isVisible());
  assert.equal(await candidate.locator('#mobile-navigation').getByRole('link',{name:'Đăng Tin Tuyển Dụng',exact:true}).count(),0);
  await candidate.locator('#mobile-navigation').getByRole('link',{name:'Bảng Điều Khiển',exact:true}).click();
  assert.equal(await candidate.locator('#mobile-navigation').count(),0);
  await candidate.setViewportSize({width:1286,height:1000});
  await candidate.getByRole('navigation',{name:'Điều hướng chính'}).getByRole('link',{name:'Việc Làm IT',exact:true}).click();
  await candidate.getByRole('heading',{name:'Browser verification edited',exact:true}).click();
  await candidate.getByRole('button',{name:'Nộp hồ sơ ứng tuyển',exact:true}).click();
  await candidate.getByLabel('CV văn bản *',{exact:true}).fill('Browser submitted JavaScript CV');
  await candidate.getByLabel('Thư giới thiệu (không bắt buộc)',{exact:true}).fill('Browser cover letter');
  await shot(candidate,'app-apply-modal-desktop');
  await candidate.keyboard.press('Tab');
  assert.equal(await candidate.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);
  await candidate.getByRole('button',{name:'Xác nhận nộp hồ sơ',exact:true}).click();
  await candidate.getByText('Bạn đã nộp hồ sơ cho vị trí này.',{exact:true}).waitFor();
  await candidate.reload(); await candidate.getByText('Bạn đã nộp hồ sơ cho vị trí này.',{exact:true}).waitFor();
  await shot(candidate,'app-job-detail-desktop');
  await candidate.getByRole('navigation',{name:'Điều hướng chính'}).getByRole('link',{name:'Bảng Điều Khiển',exact:true}).click();
  await candidate.getByRole('heading',{name:/Danh sách đơn ứng tuyển/}).waitFor();
  assert.ok(await candidate.getByText('Browser submitted JavaScript CV',{exact:true}).count());
  await candidate.setViewportSize({width:390,height:844}); await shot(candidate,'app-candidate-mobile');
  await candidate.setViewportSize({width:1286,height:1000}); await shot(candidate,'app-candidate-desktop');
  await compareReference(browser, fixture, candidate, recruiter, base, shot, result, output);
  result.checks.push('Candidate apply text CV + cover letter → reload → tracker; native dialog focus stays inside');

  await card.getByRole('link',{name:'Xem ứng viên',exact:true}).click();
  await recruiter.getByRole('button',{name:'Xem CV và xử lý',exact:true}).click();
  await recruiter.getByText('Browser submitted JavaScript CV',{exact:true}).waitFor();
  const otherTab = await recruiter.context().newPage(); await otherTab.goto(recruiter.url());
  await otherTab.getByRole('button',{name:'Xem CV và xử lý',exact:true}).click();
  await recruiter.getByLabel('Chuyển trạng thái',{exact:true}).selectOption('SCREENING');
  await recruiter.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).click();
  await recruiter.getByLabel('Chuyển trạng thái',{exact:true}).selectOption('INTERVIEW');
  await recruiter.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).click();
  await recruiter.getByText('Cần lên lịch phỏng vấn.',{exact:false}).waitFor();
  await shot(recruiter,'app-applicant-modal-desktop');
  await otherTab.getByLabel('Chuyển trạng thái',{exact:true}).selectOption('SCREENING');
  await otherTab.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).click();
  await otherTab.getByText('Tiến trình đã thay đổi. Vui lòng tải lại trước khi thao tác.',{exact:true}).waitFor();
  result.checks.push('Recruiter reads persisted CV → SCREENING → INTERVIEW; stale second tab gets 409 and reloads');
  await otherTab.close();
  await recruiter.keyboard.press('Escape');
  assert.equal(await recruiter.locator('dialog').count(),0);
  assert.equal(await recruiter.getByRole('button',{name:'Xem CV và xử lý',exact:true}).evaluate(el=>el===document.activeElement),true);
  result.checks.push('Escape closes native modal and returns focus to triggering button');
  await shot(recruiter,'app-applicants-desktop');
  await recruiter.setViewportSize({width:390,height:844}); await shot(recruiter,'app-applicants-mobile');
  await recruiter.setViewportSize({width:1286,height:1000}); await recruiter.goto(base+'/profile');
  await recruiter.getByRole('alert').waitFor(); await shot(recruiter,'app-profile-unavailable');
  const admin = await pageFor('admin'); await admin.goto(base+'/admin/dashboard');
  await admin.getByRole('alert').waitFor(); await shot(admin,'app-admin-unavailable'); await admin.close();
  await candidate.goto(base+'/user/dashboard');
  candidate.once('dialog',dialog=>dialog.accept());
  const target = candidate.locator('article').filter({has:candidate.getByRole('heading',{name:'Browser verification edited',exact:true})});
  await target.getByRole('button',{name:'Rút đơn ứng tuyển',exact:true}).click();
  await target.getByText('Đã rút đơn',{exact:true}).first().waitFor();
  await candidate.reload();
  await candidate.locator('article').getByText('Đã rút đơn',{exact:true}).first().waitFor();
  await candidate.locator('article > details > summary').click();
  await candidate.getByText('Browser submitted JavaScript CV',{exact:true}).waitFor();
  await shot(candidate,'app-candidate-withdrawn-readback');
  const application = [...fixture.repo.docs.values()].find(doc=>doc.type==='application'&&doc.job_id===job._id);
  assert.equal(application.current_stage,'WITHDRAWN');
  assert.deepEqual(application.stage_history.map(event=>event.to_stage),['APPLIED','SCREENING','INTERVIEW','WITHDRAWN']);
  const response = await candidate.request.post(base+'/api/v1/applications',{headers:{Authorization:'Bearer '+signToken(jwtEnv,fixture.users.candidate)},data:{job_id:job._id,submission:{resume_text:'Duplicate'}}});
  assert.equal(response.status(),409); assert.equal((await response.json()).error.code,'DUPLICATE_APPLICATION');
  result.checks.push('Withdraw from INTERVIEW preserves history and prevents lifetime duplicate after terminal');
  await candidate.close(); await recruiter.close();
  assert.deepEqual(failures,[]);
  result.checks.push('No browser runtime errors in tested application routes');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:true,checks:result.checks,screenshots:result.screenshots.length,publicLive:result.publicLive}));
 } finally {
  await browser.close(); await actual.close(); await reference.close();
  await new Promise(resolve=>api.close(resolve));
 }
})().catch(error=>{ console.error(error.stack); process.exitCode=1; });
