import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, jobInput, startFixture } from './fixtures.js';

const salary = { type: 'RANGE', min: 15000000, max: 25000000, currency: 'VND', period: 'MONTH' };
test('create supports four requested seniorities, independent employment type and work mode, and monthly salary', async t => {
  const f = await startFixture(t);
  for (const seniority of ['INTERN', 'FRESHER', 'JUNIOR', 'SENIOR']) {
    const created = await f.request('POST', '/jobs', { ...jobInput, seniority, employment_type: 'PART_TIME', work_mode: 'HYBRID', salary }, 'recruiter');
    assert.equal(created.status, 201);
    const result = await f.request('GET', `/jobs/${created.body.data._id}`, undefined, null);
    assert.equal(result.body.data.seniority, seniority); assert.equal(result.body.data.work_mode, 'HYBRID');
    assert.equal(result.body.data.employment_type, 'PART_TIME'); assert.deepEqual(result.body.data.salary, salary);
  }
  assert.equal((await f.request('GET', `/jobs/${f.job._id}`, undefined, null)).body.data.seniority, 'MID');
});
test('invalid salary/employment payloads do not write and edit preserves precise existing deadline', async t => {
  const f = await startFixture(t); const count = f.repo.writes.length;
  for (const invalid of [{ ...salary, max: 1 }, { ...salary, min: -1 }, { ...salary, currency: 'invalid' }, { ...salary, period: 'YEAR' }, { type: 'NEGOTIABLE', min: 10 }]) {
    assert.equal((await f.request('POST', '/jobs', { ...jobInput, salary: invalid }, 'recruiter')).status, 400);
  }
  assert.equal((await f.request('POST', '/jobs', { ...jobInput, employment_type: 'freelance' }, 'recruiter')).status, 400);
  assert.equal(f.repo.writes.length, count);
  const precise = '2026-10-30T12:00:59.123Z'; f.repo.docs.get(f.job._id).deadline = precise;
  const edited = await f.request('PATCH', `/jobs/${f.job._id}`, { expected_rev: '1-fixture', salary, employment_type: 'CONTRACT' }, 'recruiter');
  assert.equal(edited.status, 200); assert.equal(edited.body.data.deadline, precise);
  const cleared = await f.request('PATCH', `/jobs/${f.job._id}`, { expected_rev: edited.body.data._rev, salary: null, employment_type: null }, 'recruiter');
  assert.equal(cleared.status, 200); assert.equal(cleared.body.data.salary, undefined); assert.equal(cleared.body.data.employment_type, undefined);
});
test('Recruiter own contact profile persists with revisions and cannot change identity or organization scope', async t => {
  const f = await startFixture(t);
  assert.equal((await f.request('GET', '/recruiter/profile')).status, 403);
  const result = await f.request('GET', '/recruiter/profile', undefined, 'recruiter');
  assert.equal(result.status, 200); const dto = result.body.data;
  assert.equal(dto.email, f.users.recruiter.email); assert.equal(dto.company._id, f.company._id);
  assert.equal(JSON.stringify(dto).includes('password_hash'), false);
  const profile = { full_name: 'Nhà tuyển dụng kiểm thử', phone: '+84 901 234 567', location: 'Hà Nội', bio: 'Tuyển dụng kỹ sư phần mềm.' };
  const saved = await f.request('PATCH', '/recruiter/profile', { expected_rev: dto.recruiter._rev, profile }, 'recruiter');
  assert.equal(saved.status, 200);
  const reload = (await f.request('GET', '/recruiter/profile', undefined, 'recruiter')).body.data;
  assert.deepEqual(reload.recruiter.profile, profile); assert.equal(reload.email, dto.email);
  assert.equal((await f.request('PATCH', '/recruiter/profile', { expected_rev: dto.recruiter._rev, profile }, 'recruiter')).status, 409);
  for (const body of [{ expected_rev: reload.recruiter._rev, profile, company_id: f.otherCompany._id }, { expected_rev: reload.recruiter._rev, profile: { email: 'fake@example.invalid' } }]) {
    assert.equal((await f.request('PATCH', '/recruiter/profile', body, 'recruiter')).status, 400);
  }
  assert.deepEqual((await f.repo.get(f.otherRecruiter._id)).profile, undefined);
});
test('own company metadata/logo is saved and propagated to Recruiter/public/applicant DTOs without leaking credentials', async t => {
  const f = await startFixture(t);
  const body = { expected_rev: '1-fixture', company: { name: 'Công ty đã cập nhật', industry: 'Phần mềm', logo_url: 'https://example.invalid/logo.png', website: 'https://example.invalid', address: 'Hà Nội', description: 'Thông tin công ty thật do Recruiter nhập.' } };
  assert.equal((await f.request('PATCH', '/recruiter/company', body, 'recruiter')).status, 200);
  const company = await f.repo.get(f.company._id); assert.equal(company.logo_url, body.company.logo_url);
  assert.equal((await f.repo.get(f.otherCompany._id)).name, 'Công ty khác');
  const list = (await f.request('GET', '/recruiter/jobs', undefined, 'recruiter')).body.data;
  assert.ok(list.items.every(job => job.company_logo_url === company.logo_url && job.company_name === company.name));
  const detail = (await f.request('GET', `/jobs/${f.job._id}`, undefined, null)).body.data; assert.equal(detail.company_logo_url, company.logo_url);
  await apply(f);
  const applicants = (await f.request('GET', `/jobs/${f.job._id}/applicants`, undefined, 'recruiter')).body.data;
  assert.equal(applicants.job._rev, '1-fixture'); assert.equal(applicants.job.company_logo_url, company.logo_url);
  assert.equal((await f.request('PATCH', '/recruiter/company', body, 'recruiter')).status, 409);
  const current = (await f.request('GET', '/recruiter/profile', undefined, 'recruiter')).body.data;
  assert.equal(current.company.name, company.name);
});
test('company update rejects unsafe URLs, malformed URLs and membership fields before writes', async t => {
  const f = await startFixture(t); const count = f.repo.writes.length;
  for (const logo_url of ['invalid', 'javascript:alert(1)', 'data:image/svg+xml,test', 'https://secret:password@example.invalid/logo.png']) {
    const result = await f.request('PATCH', '/recruiter/company', { expected_rev: '1-fixture', company: { name: 'Name', industry: 'IT', logo_url } }, 'recruiter');
    assert.equal(result.status, 400);
  }
  assert.equal((await f.request('PATCH', '/recruiter/company', { expected_rev: '1-fixture', company: { name: 'Name', industry: 'IT', _id: f.otherCompany._id } }, 'recruiter')).status, 400);
  assert.equal(f.repo.writes.length, count);
});
test('delete hides the owned Job, blocks reopen/apply and preserves every existing CV/history', async t => {
  const f = await startFixture(t); const app = (await apply(f)).body.data; const before = await f.repo.get(app._id);
  assert.equal((await f.request('DELETE', `/jobs/${f.job._id}`, { expected_rev: '1-fixture' })).status, 403);
  assert.equal((await f.request('DELETE', `/jobs/${f.job._id}`, { expected_rev: '1-fixture' }, 'otherRecruiter')).status, 403);
  assert.equal((await f.request('DELETE', `/jobs/${f.job._id}`, { expected_rev: 'stale' }, 'recruiter')).status, 409);
  assert.equal((await f.request('DELETE', `/jobs/${f.job._id}`, {}, 'recruiter')).status, 400);
  const deleted = await f.request('DELETE', `/jobs/${f.job._id}`, { expected_rev: '1-fixture' }, 'recruiter');
  assert.equal(deleted.status, 200); const stored = await f.repo.get(f.job._id);
  assert.equal(stored.status, 'CLOSED'); assert.ok(stored.deleted_at); assert.deepEqual(await f.repo.get(app._id), before);
  assert.equal((await f.request('GET', '/recruiter/jobs', undefined, 'recruiter')).body.data.items.length, 0);
  assert.equal((await f.request('GET', '/recruiter/stats', undefined, 'recruiter')).body.data.jobs.CLOSED, undefined);
  assert.equal((await f.request('GET', `/jobs/${f.job._id}`, undefined, null)).status, 404);
  assert.equal((await f.request('GET', `/applications/${app._id}`)).body.data.submission.resume_text, before.submission.resume_text);
  assert.equal((await f.request('GET', `/jobs/${f.job._id}/applicants`, undefined, 'recruiter')).body.data.items.length, 1);
  assert.equal((await f.request('POST', '/applications', { job_id: f.job._id, submission: { resume_text: 'CV khác' } }, 'otherCandidate')).status, 400);
  assert.equal((await f.request('PATCH', `/jobs/${f.job._id}/status`, { expected_rev: stored._rev, status: 'OPEN' }, 'recruiter')).status, 409);
  const count = f.repo.writes.length;
  assert.equal((await f.request('DELETE', `/jobs/${f.job._id}`, { expected_rev: '1-fixture' }, 'recruiter')).status, 200);
  assert.equal(f.repo.writes.length, count);
});
