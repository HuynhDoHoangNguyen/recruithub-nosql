// Read-only evidence. Never activates users, signs production tokens or writes business documents.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JobApplicationRepository } from '../../backend/src/repositories/job-application.repository.js';
const repo = new JobApplicationRepository();
const documents = [];
let bookmark;
for (let page = 0; page < 100; page++) {
  const result = await repo.http('_find', 'POST', { selector: { type: { $exists: true } }, limit: 500,
    fields: ['_id', 'type', 'role', 'account_status', 'status', 'published_at', 'deadline', 'recruiter_id', 'company_id', 'department_id', 'user_id', 'candidate_id', 'job_id', 'current_stage'],
    ...(bookmark ? { bookmark } : {}) });
  documents.push(...result.docs);
  if (result.docs.length < 500) break;
  assert.notEqual(result.bookmark, bookmark);
  bookmark = result.bookmark;
}
const counts = {};
for (const doc of documents) counts[doc.type] = (counts[doc.type] || 0) + 1;
const byId = new Map(documents.map(doc => [doc._id, doc]));
const jobs = documents.filter(doc => doc.type === 'job');
const users = documents.filter(doc => doc.type === 'user');
const recruiters = documents.filter(doc => doc.type === 'recruiter');
const applications = documents.filter(doc => doc.type === 'application');
const group = (docs, field) => docs.reduce((counts, doc) => ({ ...counts, [doc[field]]: (counts[doc[field]] || 0) + 1 }), {});
const validScope = recruiter => byId.get(recruiter.user_id)?.role === 'RECRUITER' && byId.get(recruiter.company_id)?.type === 'company' && byId.get(recruiter.department_id)?.company_id === recruiter.company_id;
const invalidRecruiters = recruiters.filter(doc => !validScope(doc));
const invalidJobs = jobs.filter(job => { const recruiter = byId.get(job.recruiter_id); return !recruiter || recruiter.company_id !== job.company_id || recruiter.department_id !== job.department_id; });
const selectedCandidate = documents.find(doc => doc.type === 'candidate' && applications.some(app => app.candidate_id === doc._id));
const actualStats = await repo.candidateStats(selectedCandidate._id);
const scopedApplications = applications.filter(app => app.candidate_id === selectedCandidate._id);
assert.deepEqual(actualStats, { by_stage: group(scopedApplications, 'current_stage'), total_applications: scopedApplications.length });
const design = await repo.get('_design/job_application');
const oldQuery = await repo.find({ type:'job', status:'OPEN', published_at:{$gte:''} }, {limit:1});
const publicIds = [];
const pages = [];
bookmark = undefined;
for (let page = 0; page < 20; page++) {
  const response = await fetch('http://localhost:5173/api/v1/jobs?' + new URLSearchParams({limit:'50',...(bookmark?{bookmark}:{})}));
  assert.equal(response.status,200);
  const body = await response.json();
  assert.equal(body.success,true);
  pages.push(body.data.items.length);
  publicIds.push(...body.data.items.map(job=>job._id));
  if(!body.data.has_more) break;
  assert.notEqual(body.data.bookmark,bookmark);
  bookmark = body.data.bookmark;
}
assert.equal(new Set(publicIds).size, jobs.filter(doc=>doc.status==='OPEN').length);
const endpoints = {};
for (const [method, pathname] of [['POST','/auth/login'], ['GET','/users/me'], ['GET','/recruiter/context'], ['GET','/applications/stats'], ['POST','/interviews']]) {
 const response = await fetch('http://localhost:5173/api/v1'+pathname, {method, ...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
 const body = await response.json(); endpoints[method+' '+pathname] = { status:response.status, code:body.error?.code };
}
const info = await repo.http('');
const result = { checkedAt:new Date().toISOString(), database:'recruitment_db', mode:'Read-only real CouchDB and live Vite/Express; no Identity session',
 businessDocumentCount:documents.length, databaseDocCount:info.doc_count, counts, jobs:{statuses:group(jobs,'status'),openWithoutPublishedAt:jobs.filter(job=>job.status==='OPEN'&&!job.published_at).length,openWithPublishedAt:jobs.filter(job=>job.status==='OPEN'&&job.published_at).length,expiredOpen:jobs.filter(job=>job.status==='OPEN'&&Date.parse(job.deadline)<=Date.now()).length,oldSelectorFirstPage:oldQuery.items.length,publicPages:pages,uniquePublicIds:new Set(publicIds).size},
 users:{byStatus:group(users,'account_status'),byRole:group(users,'role')}, scope:{recruiters:recruiters.length,invalidRecruiters:invalidRecruiters.length,invalidJobs:invalidJobs.length},
 candidateAggregate:{viewInstalled:!!design.views.applications_by_candidate_stage,actual:actualStats,independentReadbackMatches:true}, endpoints, businessWrites:0 };
fs.mkdirSync('docs/it-template-verification',{recursive:true});
fs.writeFileSync('docs/it-template-verification/live-data.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
