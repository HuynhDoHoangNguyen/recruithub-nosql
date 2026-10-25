// Real portal/CouchDB verification; reads only, no authentication bypass or API interception.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const{pathToFileURL}=require('node:url');
const{chromium}=require(path.join(os.tmpdir(),'recruithub-browser-checks/node_modules/playwright'));
(async()=>{
 const output=path.join(process.cwd(),'docs/public-jobs-after-merge');fs.mkdirSync(output,{recursive:true});
 const {loadCouchDbConfig}=await import(pathToFileURL(path.join(process.cwd(),'scripts/database/couchdb-client.js')));
 const config=loadCouchDbConfig();
 async function readDb(resource,body){const response=await fetch(config.url+'/'+encodeURIComponent(config.database)+'/'+resource,{method:body?'POST':'GET',headers:{Authorization:config.authHeader,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,200);return response.json();}
 const before=await readDb('');
 const designs=await readDb('_all_docs?'+new URLSearchParams({startkey:JSON.stringify('_design/'),endkey:JSON.stringify('_design/\ufff0')}));
 const jobs=await readDb('_find',{selector:{type:'job'},fields:['_id','status','published_at'],limit:3000});
 const result={checkedAt:new Date().toISOString(),origin:'http://localhost:5173',mocked:false,database:config.database,businessDocuments:before.doc_count-designs.rows.length,docCount:before.doc_count,jobs:jobs.docs.length,statuses:jobs.docs.reduce((out,job)=>({...out,[job.status]:(out[job.status]||0)+1}),{}),openWithoutPublishedAt:jobs.docs.filter(job=>job.status==='OPEN'&&!job.published_at).length,pages:[],browserErrors:[]};
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>result.browserErrors.push(error.message));page.on('response',response=>{if(response.status()>=400)result.browserErrors.push(response.status()+' '+new URL(response.url()).pathname);});
  const ids=[];let bookmark;
  for(let i=0;i<20;i++){const response=await page.request.get(result.origin+'/api/v1/jobs?'+new URLSearchParams({limit:'50',...(bookmark?{bookmark}:{})}));assert.equal(response.status(),200);const data=(await response.json()).data;result.pages.push(data.items.length);ids.push(...data.items.map(job=>job._id));if(!data.has_more)break;assert.notEqual(data.bookmark,bookmark);bookmark=data.bookmark;}
  assert.equal(new Set(ids).size,result.statuses.OPEN);assert.equal(ids.length,new Set(ids).size);result.uniqueOpenJobs=new Set(ids).size;
  const firstResponse=await page.request.get(result.origin+'/api/v1/jobs?limit=20');assert.equal(firstResponse.status(),200);const first=(await firstResponse.json()).data.items[0];const selector=`main a[href="/jobs/${encodeURIComponent(first._id)}"]`;
  await page.goto(result.origin);await page.locator(selector).waitFor();assert.equal(await page.getByRole('alert').count(),0);await page.screenshot({path:path.join(output,'landing.png'),fullPage:true});
  await page.reload();await page.locator(selector).waitFor();result.landingReadback=true;
  await page.goto(result.origin+'/jobs');await page.locator(selector).waitFor();await page.reload();await page.locator(selector).waitFor();await page.screenshot({path:path.join(output,'jobs.png')});result.listReadback=true;
  await page.locator(selector).click();await page.getByRole('heading',{name:first.title,exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:first.title,exact:true}).waitFor();await page.screenshot({path:path.join(output,'detail.png')});result.detailReadback=true;
  const filtered=await page.request.get(result.origin+'/api/v1/jobs?q=python&limit=12');assert.equal(filtered.status(),200);const filteredJobs=(await filtered.json()).data.items;assert.ok(filteredJobs.length>0);await page.goto(result.origin+'/jobs?q=python');await page.locator(`main a[href="/jobs/${encodeURIComponent(filteredJobs[0]._id)}"]`).waitFor();result.filteredSearch=true;
  for(const[width,height,name]of[[768,1024,'tablet'],[390,844,'mobile']]){await page.setViewportSize({width,height});await page.goto(result.origin+'/jobs');await page.locator(selector).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'jobs-'+name+'.png')});}
  result.responsive=true;assert.deepEqual(result.browserErrors,[]);
  const after=await readDb('');assert.equal(after.doc_count,before.doc_count);assert.equal(after.update_seq,before.update_seq);result.databaseUnchanged=true;
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
