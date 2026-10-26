import test from 'node:test';
import assert from 'node:assert/strict';
import { RecruiterJobImportExportService } from '../../src/services/recruiter-job-import-export.service.js';
import { parseJobImportFile, csvEscape } from '../../src/utils/job-import-export.js';

const env = { JWT_ACCESS_SECRET: 'test-only-secret-longer-than-thirty-two-characters', COUCHDB_DATABASE: 'recruithub_import_export_test' };
const user = { _id: 'user:recruiter-test' };
const valid = (title = 'Platform Engineer') => ({ title, industry: 'Software', seniority: 'MID', description: 'Build and maintain services.', responsibilities: ['Build APIs'], general: ['Communicate clearly'], required_skills: ['Node.js'], optional_skills: ['Docker'] });
function service(jobs = []) {
  const saved = new Map(jobs.map(job => [job._id, job]));
  const jobsService = {
    async list(_user, { bookmark, limit }) { const all = [...saved.values()]; const offset = Number(bookmark || 0); return { items: all.slice(offset, offset + limit), has_more: offset + limit < all.length, bookmark: String(offset + limit) }; },
    async create(_user, payload, { documentId }) { if (saved.has(documentId)) { const error = new Error('exists'); error.status = 409; error.code = 'CONFLICT'; throw error; } const item = { ...payload, _id: documentId, created_at: '2026-10-26T00:00:00.000Z' }; saved.set(documentId, item); return item; },
    async detail(_user, id) { if (!saved.has(id)) throw new Error('not found'); return saved.get(id); },
  };
  return { subject: new RecruiterJobImportExportService(jobsService, { env, now: () => new Date('2026-10-26T12:00:00.000Z') }), saved };
}

test('CSV parser supports BOM, escaped quotes, commas, and embedded newlines', () => {
  const rows = parseJobImportFile('csv', '\uFEFFtitle,industry,seniority,description,required_skills,responsibilities\r\n"Backend, Engineer",Software,MID,"Build ""great"" APIs\nacross teams","[""Node.js""]","[""Build APIs""]"\r\n');
  assert.equal(rows[0].value.title, 'Backend, Engineer');
  assert.match(rows[0].value.description, /across teams/);
});

test('CSV rejects system fields and malformed array cells', () => {
  assert.throws(() => parseJobImportFile('csv', 'title,industry,seniority,description,required_skills,_id\na,b,MID,c,x,job:evil'), error => error.code === 'UNSUPPORTED_IMPORT_FIELDS');
  const parsed = parseJobImportFile('csv', 'title,industry,seniority,description,required_skills\na,b,MID,c,"not-json"');
  assert.equal(parsed[0].errors[0].code, 'INVALID_JSON_ARRAY');
});

test('preview validates schema and confirm creates only DRAFT jobs with idempotent replay', async () => {
  const { subject, saved } = service();
  const content = JSON.stringify([valid()]);
  const request = { format: 'json', fileName: 'jobs.json', content };
  const preview = await subject.preview(user, request);
  assert.equal(preview.valid, 1);
  assert.equal(saved.size, 0, 'preview must not write');
  const result = await subject.confirm(user, { ...request, previewToken: preview.previewToken });
  assert.deepEqual([result.created, result.skipped, result.failed], [1, 0, 0]);
  assert.equal([...saved.values()][0].status, 'DRAFT');
  const replay = await subject.confirm(user, { ...request, previewToken: preview.previewToken });
  assert.equal(replay.created, 0);
  assert.equal(replay.skipped, 1);
  assert.equal(saved.size, 1);
});

test('duplicate rows are reported and malformed rows fail independently', async () => {
  const { subject } = service();
  const content = JSON.stringify([valid(), valid(), { ...valid('Bad'), _id: 'job:injected' }]);
  const preview = await subject.preview(user, { format: 'json', fileName: 'a.json', content });
  assert.deepEqual([preview.valid, preview.skipped, preview.failed], [1, 1, 1]);
});

test('confirm reports partial failures while continuing with valid rows', async () => {
  const { subject, saved } = service();
  const content = JSON.stringify([valid('Valid import'), { ...valid('Rejected import'), company_id: 'company:forged' }]);
  const request = { format: 'json', fileName: 'partial.json', content };
  const preview = await subject.preview(user, request);
  const result = await subject.confirm(user, { ...request, previewToken: preview.previewToken });
  assert.deepEqual([result.created, result.skipped, result.failed], [1, 0, 1]);
  assert.equal(saved.size, 1);
});

test('preview token cannot be reused by another user or with changed file content', async () => {
  const { subject } = service(); const request = { format: 'json', fileName: 'a.json', content: JSON.stringify([valid()]) };
  const preview = await subject.preview(user, request);
  await assert.rejects(subject.confirm({ _id: 'user:other' }, { ...request, previewToken: preview.previewToken }), error => error.code === 'PREVIEW_EXPIRED');
  await assert.rejects(subject.confirm(user, { ...request, content: '[]', previewToken: preview.previewToken }), error => error.code === 'PREVIEW_EXPIRED');
});

test('writes are blocked when configured database is a protected source/demo database', async () => {
  const protectedService = new RecruiterJobImportExportService({ async list() { return { items: [], has_more: false }; } }, { env, databaseName: 'recruitment_db' });
  const content = JSON.stringify([valid()]); const request = { format: 'json', fileName: 'a.json', content };
  const preview = await protectedService.preview(user, request);
  await assert.rejects(protectedService.confirm(user, { ...request, previewToken: preview.previewToken }), error => error.code === 'IMPORT_DATABASE_NOT_ISOLATED');
});

test('live database writes require and honor an explicit per-process opt-in', async () => {
  const { saved } = service();
  const liveService = new RecruiterJobImportExportService({
    async list() { return { items: [], has_more: false }; },
    async create(_user, payload, { documentId }) { saved.set(documentId, payload); return { ...payload, _id: documentId }; },
  }, { env: { ...env, JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE: 'true' }, databaseName: 'recruitment_db', now: () => new Date('2026-10-26T12:00:00.000Z') });
  const content = JSON.stringify([valid('Explicitly allowed live target')]);
  const input = { format: 'json', fileName: 'live.json', content };
  const preview = await liveService.preview(user, input);
  const result = await liveService.confirm(user, { ...input, previewToken: preview.previewToken });
  assert.equal(result.created, 1);
  assert.equal([...saved.values()][0].status, 'DRAFT');
});

test('export uses allowlist, filters date/status/keyword, and CSV neutralizes formulas', async () => {
  const job = { _id: 'job:secret', _rev: '3-secret', type: 'job', recruiter_id: 'recruiter:x', company_id: 'company:x', department_id: 'department:x', title: '=cmd', industry: 'Software', seniority: 'MID', description: 'Build APIs', responsibilities: ['Build'], requirements: { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } }, required_skills: ['Node.js'], optional_skills: [], status: 'DRAFT', created_at: '2026-10-25T00:00:00.000Z', provenance: { classification: 'secret' } };
  const { subject } = service([job]);
  const result = await subject.export(user, { format: 'json', q: 'build', status: 'DRAFT', created_from: '2026-10-25', created_to: '2026-10-25' });
  const payload = JSON.parse(result.content);
  assert.equal(payload.jobs.length, 1);
  assert.equal(payload.jobs[0]._id, undefined);
  assert.equal(payload.jobs[0].provenance, undefined);
  assert.equal(payload.jobs[0].status, 'DRAFT');
  assert.match(csvEscape('=cmd'), /^'=cmd/);
});

test('export follows every recruiter bookmark page instead of returning only the first 50 jobs', async () => {
  const requirements = { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } };
  const jobs = Array.from({ length: 52 }, (_, i) => ({ _id: `job:${i}`, title: `Role ${i}`, industry: 'Software', seniority: 'MID', description: 'Role details', responsibilities: ['Build'], requirements, required_skills: ['Node'], optional_skills: [], status: 'DRAFT', created_at: '2026-10-26T00:00:00.000Z' }));
  const { subject } = service(jobs);
  const file = await subject.export(user, { format: 'json', q: '', status: undefined, created_from: undefined, created_to: undefined });
  assert.equal(JSON.parse(file.content).jobs.length, 52);
});
