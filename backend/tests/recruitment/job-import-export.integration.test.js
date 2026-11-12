import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { getDatabaseConfig } from '../../src/config/database.config.js';
import { JobApplicationRepository } from '../../src/repositories/job-application.repository.js';
import { createFixture, signToken } from './fixtures.js';
import { userIdFromEmail } from '../../src/utils/id.utils.js';

const TEST_DATABASE = 'recruithub_import_export_test';
const enabled = process.env.JOB_IMPORT_EXPORT_TEST_DATABASE === TEST_DATABASE;
test('UC27/UC28 isolated CouchDB integration and HTTP round-trip', { skip: !enabled && 'Set JOB_IMPORT_EXPORT_TEST_DATABASE to the exact isolated test database to enable writes.' }, async t => {
  dotenv.config({ path: '../.env' });
  dotenv.config({ path: '.env', override: true });
  const configured = getDatabaseConfig(process.env);
  const host = new URL(configured.url);
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(host.hostname), 'Integration writes require the verified local CouchDB host.');
  assert.notEqual(TEST_DATABASE, 'recruitment_db');
  assert.notEqual(TEST_DATABASE, 'recruithub_auth_demo');
  const authHeader = configured.username && configured.password ? `Basic ${Buffer.from(`${configured.username}:${configured.password}`).toString('base64')}` : undefined;
  const dbResponse = await fetch(`${configured.url}/${TEST_DATABASE}`, { headers: authHeader ? { Authorization: authHeader } : {} });
  assert.equal(dbResponse.status, 200, 'The explicit test database must already exist; this test never creates or deletes databases.');
  const sourceResponse = await fetch(`${configured.url}/recruitment_db`, { headers: authHeader ? { Authorization: authHeader } : {} });
  assert.equal(sourceResponse.status, 200);

  const repository = new JobApplicationRepository({ ...configured, database: TEST_DATABASE, authHeader });
  await repository.initialize();
  const fixture = createFixture();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 20);
  const at = new Date().toISOString();
  const provenance = { classification: 'derived', generated: false, transform_version: 'uc27-uc28-integration-test' };
  const makeUser = (label, role) => {
    const email = `${label}-${suffix}@example.invalid`;
    return { _id: userIdFromEmail(email), type: 'user', email, email_normalized: email, role, account_status: 'ACTIVE',
      password_hash: 'test-only-hash-never-used-for-authentication', created_at: at, updated_at: at, provenance };
  };
  const recruiterUser = makeUser('import-recruiter', 'RECRUITER');
  const secondUser = makeUser('other-recruiter', 'RECRUITER');
  const candidateUser = makeUser('import-candidate', 'CANDIDATE');
  const makeOrganization = (prefix, user) => {
    const company_id = `company:${prefix}`; const department_id = `department:${prefix}`;
    const company = { ...fixture.company, _id: company_id, created_at: at, updated_at: at, provenance };
    const department = { ...fixture.department, _id: department_id, company_id, created_at: at, updated_at: at, provenance };
    const recruiter = { ...fixture.recruiter, _id: `recruiter:${prefix}`, user_id: user._id, company_id, department_id, created_at: at, updated_at: at, provenance };
    return { company, department, recruiter };
  };
  const org1 = makeOrganization(`test_${suffix}`, recruiterUser);
  const org2 = makeOrganization(`other_${suffix}`, secondUser);
  const candidate = { ...fixture.candidate, _id: `candidate:test_${suffix}`, user_id: candidateUser._id, created_at: at, updated_at: at, provenance };
  for (const doc of [recruiterUser, secondUser, candidateUser, ...Object.values(org1), ...Object.values(org2), candidate]) await repository.put(doc);

  const env = { ...process.env, AUTH_COUCHDB_DATABASE: TEST_DATABASE, COUCHDB_DATABASE: TEST_DATABASE,
    AUTH_ALLOW_PRIMARY_DATABASE: 'false', JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'), FRONTEND_URL: 'http://127.0.0.1:5178' };
  const app = createApp({ repository, jwtEnv: env });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}/api/v1`;
  const auth = user => `Bearer ${signToken(env, user)}`;
  const request = async (method, path, user, payload) => {
    const response = await fetch(`${origin}${path}`, { method, headers: { Authorization: auth(user), ...(payload ? { 'Content-Type': 'application/json' } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    return response;
  };
  const row = (title, extra = {}) => ({ title, industry: 'Software', seniority: 'MID', description: 'Imported integration test role.', responsibilities: ['Build platform features'], general: ['Work with product team'], required_skills: ['Node.js'], optional_skills: ['Docker'], ...extra });

  const file = { format: 'json', fileName: 'jobs.json', content: JSON.stringify([row(`UC27 ${suffix}`)]) };
  const previewResponse = await request('POST', '/recruiter/jobs/import/preview', recruiterUser, file);
  assert.equal(previewResponse.status, 200);
  const preview = (await previewResponse.json()).data;
  assert.equal(preview.valid, 1);
  assert.equal((await repository.find({ type: 'job', recruiter_id: org1.recruiter._id }, { limit: 50, index: 'recruiter_jobs' })).items.length, 0, 'Preview must be read-only.');
  const confirmResponse = await request('POST', '/recruiter/jobs/import/confirm', recruiterUser, { ...file, previewToken: preview.previewToken });
  assert.equal(confirmResponse.status, 201);
  const confirmed = (await confirmResponse.json()).data;
  assert.equal(confirmed.created, 1); assert.equal(confirmed.failed, 0);
  const jobId = confirmed.rows[0].id;
  const stored = await repository.get(jobId);
  assert.equal(stored.status, 'DRAFT'); assert.equal(stored.company_id, org1.company._id); assert.match(stored._rev, /^1-/);

  const replay = await (await request('POST', '/recruiter/jobs/import/confirm', recruiterUser, { ...file, previewToken: preview.previewToken })).json();
  assert.equal(replay.data.created, 0); assert.equal(replay.data.skipped, 1);
  assert.equal((await request('POST', '/recruiter/jobs/import/preview', candidateUser, file)).status, 403);
  const otherExport = await request('GET', '/recruiter/jobs/export?format=json', secondUser);
  assert.equal(otherExport.status, 200); assert.deepEqual(JSON.parse(await otherExport.text()).jobs, []);

  const exportedResponse = await request('GET', '/recruiter/jobs/export?format=json', recruiterUser);
  assert.equal(exportedResponse.status, 200);
  const exported = JSON.parse(await exportedResponse.text());
  assert.equal(exported.jobs.length, 1); assert.equal(exported.jobs[0]._id, undefined); assert.equal(exported.jobs[0].company_id, undefined);
  const roundTripFile = { format: 'json', fileName: 'export.json', content: JSON.stringify(exported) };
  const roundTripPreview = (await (await request('POST', '/recruiter/jobs/import/preview', secondUser, roundTripFile)).json()).data;
  assert.equal(roundTripPreview.valid, 1);
  const roundTripResult = (await (await request('POST', '/recruiter/jobs/import/confirm', secondUser, { ...roundTripFile, previewToken: roundTripPreview.previewToken })).json()).data;
  assert.equal(roundTripResult.created, 1);

  const csvContent = `title,industry,seniority,description,responsibilities,general,required_skills,optional_skills\r\n"UC27 CSV ${suffix}",Software,MID,"CSV description, with comma","[""Build APIs""]","[""Teamwork""]","[""Python""]",[]\r\n`;
  const csvFile = { format: 'csv', fileName: 'jobs.csv', content: csvContent };
  const csvPreview = (await (await request('POST', '/recruiter/jobs/import/preview', recruiterUser, csvFile)).json()).data;
  assert.equal(csvPreview.valid, 1);
  const csvConfirm = (await (await request('POST', '/recruiter/jobs/import/confirm', recruiterUser, { ...csvFile, previewToken: csvPreview.previewToken })).json()).data;
  assert.equal(csvConfirm.created, 1);
  assert.equal((await repository.get(csvConfirm.rows[0].id)).status, 'DRAFT');

  const publicBefore = await request('GET', `/jobs?q=${encodeURIComponent(`UC27 ${suffix}`)}`, candidateUser);
  assert.equal(publicBefore.status, 200); assert.equal((await publicBefore.json()).data.items.length, 0, 'DRAFT imports must not be public.');
  const statusResponse = await request('PATCH', `/jobs/${encodeURIComponent(jobId)}/status`, recruiterUser, { status: 'OPEN', expected_rev: stored._rev, deadline: '2030-12-31T00:00:00.000Z' });
  assert.equal(statusResponse.status, 200);
  const publicAfter = await request('GET', `/jobs?q=${encodeURIComponent(`UC27 ${suffix}`)}`, candidateUser);
  assert.equal(publicAfter.status, 200); assert.equal((await publicAfter.json()).data.items.length, 1, 'Published Job must appear in public results.');

  const csvTemplateResponse = await request('GET', '/recruiter/jobs/import/template?format=csv', recruiterUser);
  assert.equal(csvTemplateResponse.status, 200); assert.match(csvTemplateResponse.headers.get('content-type'), /text\/csv/);
  const csvExportResponse = await request('GET', '/recruiter/jobs/export?format=csv', recruiterUser);
  assert.equal(csvExportResponse.status, 200); assert.match(csvExportResponse.headers.get('content-disposition'), /recruithub-jobs-.*\.csv/);
});
