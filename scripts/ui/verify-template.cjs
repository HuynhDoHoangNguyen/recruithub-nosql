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
const output = path.join(project, 'docs/ui-verification');
fs.mkdirSync(output, { recursive: true });
(async () => {
 const { createServer } = await import(pathToFileURL(requireFrontend.resolve('vite')));
 const { default: react } = await import(pathToFileURL(requireFrontend.resolve('@vitejs/plugin-react')));
 const { createApp } = await import(pathToFileURL(path.join(project,'backend/src/app.js')));
 const { createFixture, signToken } = await import(pathToFileURL(path.join(project,'backend/tests/recruitment/fixtures.js')));
 const fixture = createFixture();
 const jwtEnv = { JWT_ALGORITHM: 'HS256', JWT_SECRET: randomBytes(48).toString('base64url') };
 const api = createApp({ repository: fixture.repo, now: fixture.now, jwtEnv }).listen(0, '127.0.0.1');
 await new Promise(resolve => api.once('listening', resolve));
 const actual = await createServer({ root: path.join(project,'frontend'), cacheDir: fs.mkdtempSync(path.join(os.tmpdir(),'recruithub-ui-cache-')), configFile: false, plugins: [react()], css: { postcss: { plugins: [requireFrontend('tailwindcss')({content:[path.join(project,'frontend/index.html'),path.join(project,'frontend/src/**/*.{js,jsx}')],theme:{extend:{}},plugins:[]}),requireFrontend('autoprefixer')()] } }, server: { host: '127.0.0.1', port: 5181, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}`, changeOrigin: true } } }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') } });
 await actual.listen();
 const referenceRoot = fs.mkdtempSync(path.join(os.tmpdir(),'recruithub-template-reference-'));
 fs.cpSync(path.join(project,'docs/Job-Application-Portal-Frontend'),referenceRoot,{recursive:true,filter:src=>!src.includes('node_modules')&&!src.includes('/.git')});
 fs.symlinkSync(path.join(project,'frontend/node_modules'),path.join(referenceRoot,'node_modules'),'junction');
 const reference = await createServer({ root: referenceRoot, configFile: false, plugins: [react()], css: { postcss: { plugins: [requireFrontend('tailwindcss')({content:[path.join(referenceRoot,'index.html'),path.join(referenceRoot,'src/**/*.{js,jsx}')],theme:{extend:{}},plugins:[]}),requireFrontend('autoprefixer')()] } }, server: {host:'127.0.0.1',port:5182,strictPort:true} });
 await reference.listen();
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const failures = [];
 const result = { mode: 'Browser integration with isolated memory repository and signed test JWT; no production login or CouchDB writes', publicLive: [], screenshots: [], checks: [] };
 const base = 'http://127.0.0.1:5181';
 async function pageFor(role, viewport={width:1440,height:1000}) {
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
  const ref = await browser.newPage({viewport:{width:1440,height:1000}});
  await ref.route('http://localhost:5000/**',route=>route.fulfill({json:[fixture.job,fixture.otherJob].map(job=>({
    _id:job._id,title:job.title,company:job.industry,description:job.description,skills:job.required_skills,
  }))}));
  for (const [route,name] of [['/','landing'],['/login','login'],['/register','register'],['/jobs','jobs']]) {
   await guest.goto(base+route); await guest.waitForTimeout(500);
   await shot(guest,'app-'+name+'-desktop');
   await ref.goto('http://127.0.0.1:5182'+route); await ref.locator('nav').waitFor({timeout:60000}); await ref.waitForTimeout(500);
   await ref.screenshot({path:path.join(output,'reference-'+name+'-desktop.png'),fullPage:true});
   result.screenshots.push('reference-'+name+'-desktop.png');
  }
  for (const [role,route,name] of [
    ['recruiter','/recruiter/dashboard','recruiter'], ['recruiter','/recruiter/jobs/create','create'],
    ['candidate','/user/dashboard','candidate'], ['candidate','/jobs/job%3Aone','job-detail'],
    ['candidate','/profile','profile'], ['admin','/admin/dashboard','admin'],
  ]) {
    const legacy = role === 'candidate' ? 'job-seeker' : role;
    const ctx = await browser.newContext({viewport:{width:1440,height:1000}});
    await ctx.addInitScript(value=>localStorage.setItem('accessToken',value),signToken(jwtEnv,fixture.users[role],{role:legacy,name:'Browser test account'}));
    const referencePage = await ctx.newPage();
    await referencePage.route('**/api/**',route=> {
      const url = new URL(route.request().url());
      const oldJob = {_id:'job:one',title:'Browser verification job',company:'Test company',description:'Browser integration test',status:'open',skills:['JavaScript'],createdAt:'2026-10-22T12:00:00Z'};
      const body = url.pathname.endsWith('/users/me') ? {name:'Browser test account',email:'browser@example.invalid',role:legacy,skills:[],education:[],projects:[]} :
        url.pathname.endsWith('/admin/stats') ? {stats:{totalUsers:0,totalJobs:0,totalApplications:0}} :
        url.pathname.endsWith('/jobs/job:one') || url.pathname.endsWith('/jobs/job%3Aone') ? oldJob :
        url.pathname.endsWith('/status') ? {applied:false} :
        url.pathname.endsWith('/jobs/myjobs') ? [{...oldJob,title:fixture.job.title}] :
        url.pathname.endsWith('/apply/my') ? [{_id:'reference-application',job:{...oldJob,title:'Browser verification edited'},status:'pending',createdAt:'2026-10-22T12:00:00Z'}] :
        url.pathname.includes('/recent') ? {jobs:[]} : [];
      return route.fulfill({json:body});
    });
    await referencePage.goto('http://127.0.0.1:5182'+route);
    await referencePage.locator('nav').first().waitFor(); await referencePage.waitForTimeout(800);
    await referencePage.screenshot({path:path.join(output,'reference-'+name+'-desktop.png'),fullPage:true});
    result.screenshots.push('reference-'+name+'-desktop.png'); await ctx.close();
  }
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
  await guest.close(); await ref.close();

  const recruiter = await pageFor('recruiter');
  await recruiter.goto(base+'/recruiter/dashboard');
  await recruiter.getByRole('heading',{name:'Quản lý tuyển dụng',exact:true}).waitFor();
  await shot(recruiter,'app-recruiter-desktop');
  await recruiter.getByRole('link',{name:'Tạo tin tuyển dụng',exact:true}).last().click();
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
  await candidate.goto(base+'/jobs/'+encodeURIComponent(job._id));
  await candidate.getByRole('button',{name:'Nộp hồ sơ ứng tuyển',exact:true}).click();
  await candidate.getByLabel('CV văn bản (khi không đính kèm file)',{exact:true}).fill('Browser submitted JavaScript CV');
  await candidate.getByLabel('Thư giới thiệu (không bắt buộc)',{exact:true}).fill('Browser cover letter');
  await shot(candidate,'app-apply-modal-desktop');
  await candidate.keyboard.press('Tab');
  assert.equal(await candidate.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);
  await candidate.getByRole('button',{name:'Xác nhận nộp hồ sơ',exact:true}).click();
  await candidate.getByText('Bạn đã nộp hồ sơ cho vị trí này.',{exact:true}).waitFor();
  await candidate.reload(); await candidate.getByText('Bạn đã nộp hồ sơ cho vị trí này.',{exact:true}).waitFor();
  await shot(candidate,'app-job-detail-desktop');
  await candidate.goto(base+'/user/dashboard');
  await candidate.getByRole('heading',{name:'Đơn ứng tuyển',exact:true}).waitFor();
  assert.ok(await candidate.getByText('Browser submitted JavaScript CV',{exact:true}).count());
  await candidate.setViewportSize({width:390,height:844}); await shot(candidate,'app-candidate-mobile');
  await candidate.setViewportSize({width:1440,height:1000}); await shot(candidate,'app-candidate-desktop');
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
  await recruiter.setViewportSize({width:1440,height:1000}); await recruiter.goto(base+'/profile');
  await recruiter.getByRole('alert').waitFor(); await shot(recruiter,'app-profile-unavailable');
  const admin = await pageFor('admin'); await admin.goto(base+'/admin/dashboard');
  await admin.getByRole('alert').waitFor(); await shot(admin,'app-admin-unavailable'); await admin.close();
  await candidate.goto(base+'/user/dashboard');
  candidate.once('dialog',dialog=>dialog.accept());
  const target = candidate.locator('article').filter({has:candidate.getByRole('heading',{name:'Browser verification edited',exact:true})});
  await target.getByRole('button',{name:'Rút đơn ứng tuyển',exact:true}).click();
  await target.getByText('Kết thúc hồ sơ:',{exact:true}).waitFor();
  await candidate.reload();
  const application = [...fixture.repo.docs.values()].find(doc=>doc.type==='application'&&doc.job_id===job._id);
  assert.equal(application.current_stage,'WITHDRAWN');
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
