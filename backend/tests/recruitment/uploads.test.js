import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, signToken, startFixture } from './fixtures.js';
import { UploadService } from '../../src/services/upload.service.js';
import { ApplicationService } from '../../src/services/application.service.js';
import { CandidateProfileService } from '../../src/services/candidate-profile.service.js';
import { RecruiterProfileService } from '../../src/services/recruiter-profile.service.js';
import { validateUpload } from '../../src/utils/upload-validation.js';
import { MAX_UPLOAD_BYTES } from '../../src/schemas/upload.schema.js';
import { docxFixture, pdfFixture, pngFixture, zipFixture } from '../helpers/upload-fixtures.js';
import { PDFDocument } from 'pdf-lib';

test('CV validation accepts real PDF/DOCX signatures, rejects wrong extension/content, empty, corrupt and exact 5 MiB', () => {
  assert.equal(validateUpload(pdfFixture(), 'CV.PDF', 'resume').content_type, 'application/pdf');
  assert.equal(validateUpload(docxFixture(), 'Ứng viên.docx', 'resume').content_type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  for (const [bytes, name] of [[Buffer.alloc(0), 'a.pdf'], [Buffer.from('fake PDF'), 'a.pdf'], [pdfFixture(), 'a.exe'], [pdfFixture(), '../a.pdf'], [pngFixture, 'a.doc'], [zipFixture({ 'word/other.xml': 'fake' }), 'a.docx'], [docxFixture().subarray(0, 50), 'a.docx']]) assert.throws(() => validateUpload(bytes, name, 'resume'), error => error.status === 400);
  assert.throws(() => validateUpload(Buffer.alloc(MAX_UPLOAD_BYTES), 'large.pdf', 'resume'), error => error.status === 413);
  const near = Buffer.alloc(MAX_UPLOAD_BYTES - 1, 32); near.write('%PDF-1.4'); near.write('%%EOF', near.length - 5);
  assert.equal(validateUpload(near, 'near.pdf', 'resume').size, MAX_UPLOAD_BYTES - 1);
});
test('legacy DOC requires an OLE Word stream, image signatures are checked and SVG is rejected', () => {
  const doc = Buffer.alloc(1024); Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(doc); doc.writeUInt16LE(0xfffe, 28); doc.writeUInt16LE(9, 30); Buffer.from('WordDocument\0', 'utf16le').copy(doc, 512); doc.writeUInt16LE(26, 576); doc[578] = 2;
  assert.equal(validateUpload(doc, 'CV.doc', 'resume').content_type, 'application/msword');
  assert.equal(validateUpload(pngFixture, 'logo.png', 'company-logo').content_type, 'image/png');
  assert.throws(() => validateUpload(pdfFixture(), 'fake.png', 'avatar'), error => error.code === 'INVALID_FILE');
  assert.throws(() => validateUpload(Buffer.from('<svg/>'), 'a.svg', 'avatar'), error => error.code === 'UNSUPPORTED_FILE_TYPE');
});
test('binary HTTP endpoint bounds file size and role; content is exact and private except company logos', async t => {
  const f = await startFixture(t); const token = who => signToken(f.jwtEnv, f.users[who], {}, {}, f.now());
  const upload = (kind, name, bytes, who = 'candidate') => fetch(`${f.origin}/api/v1/uploads/${kind}`, { method: 'POST', headers: { Authorization: `Bearer ${token(who)}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) }, body: bytes });
  assert.equal((await upload('resume', 'empty.pdf', Buffer.alloc(0))).status, 400);
  assert.equal((await upload('resume', 'large.pdf', Buffer.alloc(MAX_UPLOAD_BYTES))).status, 413);
  assert.equal((await upload('resume', 'large.pdf', Buffer.alloc(MAX_UPLOAD_BYTES + 1))).status, 413);
  assert.equal((await upload('resume', 'a.pdf', pdfFixture(), 'recruiter')).status, 403);
  assert.equal((await upload('company-logo', 'a.png', pngFixture)).status, 403);
  const response = await upload('resume', 'Ứng viên.pdf', pdfFixture()); assert.equal(response.status, 201); const asset = (await response.json()).data;
  assert.equal((await fetch(`${f.origin}/api/v1/uploads/${encodeURIComponent(asset.asset_id)}/content`)).status, 401);
  const read = await fetch(`${f.origin}/api/v1/uploads/${encodeURIComponent(asset.asset_id)}/content`, { headers: { Authorization: `Bearer ${token('candidate')}` } });
  assert.equal(read.status, 200); assert.match(read.headers.get('content-disposition'), /attachment/); assert.equal(read.headers.get('cache-control'), 'private, no-store'); assert.deepEqual(Buffer.from(await read.arrayBuffer()), pdfFixture());
  assert.equal((await fetch(`${f.origin}/api/v1/media/company-logos/${encodeURIComponent(asset.asset_id)}`)).status, 404);
  const logo = (await (await upload('company-logo', 'logo.png', pngFixture, 'recruiter')).json()).data;
  const image = await fetch(`${f.origin}/api/v1/media/company-logos/${encodeURIComponent(logo.asset_id)}`); assert.equal(image.status, 200); assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
});
test('CV snapshot authorizes only the matching Recruiter, remains after profile replacement and is archived on reapply', async () => {
  const f = createFixture(), upload = new UploadService(f.repo, f.repo, f.now), apps = new ApplicationService(f.repo, { now: f.now });
  const old = await upload.upload(f.users.candidate, 'resume', pdfFixture(), 'CV một.pdf');
  await assert.rejects(upload.content(old.asset_id, f.users.recruiter), error => error.status === 403);
  const payload = { job_id: f.job._id, request_id: randomUUID(), submission: { resume_file_id: old.asset_id } };
  let app = await apps.create(f.users.candidate, payload); assert.equal(app.submission.resume_file.file_name, 'CV một.pdf');
  assert.deepEqual((await upload.content(old.asset_id, f.users.recruiter)).bytes, pdfFixture());
  for (const user of [f.users.otherCandidate, f.users.otherRecruiter, f.users.admin]) await assert.rejects(upload.content(old.asset_id, user), error => error.status === 403);
  const otherFile = await upload.upload(f.users.otherCandidate, 'resume', pdfFixture(), 'Khác.pdf');
  await assert.rejects(apps.create(f.users.candidate, { job_id: f.otherJob._id, submission: { resume_file_id: otherFile.asset_id } }), error => error.status === 403);
  app = await apps.transition(f.users.candidate, app._id, { expected_rev: app._rev, expected_stage: 'APPLIED' }, true);
  const newer = await upload.upload(f.users.candidate, 'resume', docxFixture(), 'CV mới.docx');
  const nextPayload = { job_id: f.job._id, request_id: randomUUID(), expected_rev: app._rev, submission: { resume_file_id: newer.asset_id } };
  const next = await apps.create(f.users.candidate, nextPayload); assert.equal(next.previous_attempts[0].submission.resume_file.asset_id, old.asset_id); assert.equal(next.submission.resume_file.asset_id, newer.asset_id);
  assert.equal((await apps.create(f.users.candidate, nextPayload))._rev, next._rev);
  assert.deepEqual((await upload.content(old.asset_id, f.users.recruiter)).bytes, pdfFixture());
});
test('Candidate profile attaches/removes owned CV/avatar by revision without changing old application submissions', async () => {
  const f = createFixture(), upload = new UploadService(f.repo, f.repo, f.now);
  const candidateRepository = { findByUserId: async id => ({ docs: [...f.repo.docs.values()].filter(doc => doc.type === 'candidate' && doc.user_id === id).map(doc => structuredClone(doc)) }), update: async doc => ({ rev: (await f.repo.put(doc))._rev }) };
  const profile = new CandidateProfileService({ candidateRepository, assets: f.repo, now: () => f.now().getTime() + 100 });
  const cv = await upload.upload(f.users.candidate, 'resume', pdfFixture(), 'CV.pdf'); const avatar = await upload.upload(f.users.candidate, 'avatar', pngFixture, 'Ảnh.png');
  const saved = await profile.updateMyProfile(f.users.candidate._id, { resume_file_id: cv.asset_id, avatar_asset_id: avatar.asset_id }, '1-fixture');
  assert.equal(saved.profile.resume_file.asset_id, cv.asset_id); assert.equal(saved.profile.avatar.asset_id, avatar.asset_id);
  await assert.rejects(profile.updateMyProfile(f.users.candidate._id, { resume_file_id: avatar.asset_id }, saved.revision), error => error.status === 403);
  await assert.rejects(profile.updateMyProfile(f.users.candidate._id, { resume_file_id: null }, 'stale'), error => error.status === 409);
  const cleared = await profile.updateMyProfile(f.users.candidate._id, { resume_file_id: null, avatar_asset_id: null }, saved.revision); assert.equal(cleared.profile.resume_file, undefined); assert.equal(cleared.profile.avatar, undefined);
});
test('uploaded company logo is bound to its uploader/company and is propagated without persisting an external URL', async () => {
  const f = createFixture(), upload = new UploadService(f.repo, f.repo, f.now), profile = new RecruiterProfileService(f.repo, f.now, f.repo);
  const logo = await upload.upload(f.users.recruiter, 'company-logo', pngFixture, 'logo.png');
  await profile.update(f.users.recruiter, { expected_rev: '1-fixture', company: { name: f.company.name, industry: f.company.industry, logo_asset_id: logo.asset_id } }, true);
  const company = await f.repo.get(f.company._id); assert.equal(company.logo_asset.asset_id, logo.asset_id); assert.equal(company.logo_url, undefined);
  assert.match((await profile.get(f.users.recruiter)).company.logo_url, /^\/api\/v1\/media\/company-logos\//);
  await assert.rejects(profile.update(f.users.otherRecruiter, { expected_rev: '1-fixture', company: { name: f.otherCompany.name, industry: f.otherCompany.industry, logo_asset_id: logo.asset_id } }, true), error => error.status === 403);
  const cv = await upload.upload(f.users.candidate, 'resume', pdfFixture(), 'a.pdf');
  await assert.rejects(profile.update(f.users.recruiter, { expected_rev: company._rev, company: { name: company.name, industry: company.industry, logo_asset_id: cv.asset_id } }, true), error => error.status === 403);
});
test('attachment integrity mismatch is rejected rather than delivering altered content', async () => {
  const f = createFixture(), upload = new UploadService(f.repo, f.repo, f.now);
  const cv = await upload.upload(f.users.candidate, 'resume', pdfFixture(), 'CV.pdf');
  f.repo.docs.get(cv.asset_id)._attachments.content.data = Buffer.from('altered').toString('base64');
  await assert.rejects(upload.content(cv.asset_id, f.users.candidate), error => error.code === 'FILE_INTEGRITY_ERROR');
});

test('PDF upload accepts BOM/preamble, trailing padding and modern object streams, preserving original bytes', async () => {
  const f = createFixture(), upload = new UploadService(f.repo, f.repo, f.now);
  const modern = await PDFDocument.create(); modern.addPage();
  const samples = [Buffer.concat([Buffer.from('\ufeff\n'), pdfFixture(), Buffer.alloc(4096, 32)]), Buffer.from(await modern.save({ useObjectStreams: true }))];
  for (const bytes of samples) {
    const file = await upload.upload(f.users.candidate, 'resume', bytes, 'CV.PDF');
    assert.deepEqual((await upload.content(file.asset_id, f.users.candidate)).bytes, bytes);
  }
  const count = f.repo.docs.size;
  await assert.rejects(upload.upload(f.users.candidate, 'resume', Buffer.from('%PDF-1.4\ninvalid document\n%%EOF'), 'fake.pdf'), error => error.code === 'INVALID_FILE');
  assert.equal(f.repo.docs.size, count);
});

test('Word preview is authenticated, scoped to the matching application and returns text without HTML execution', async t => {
  const f = await startFixture(t), service = new UploadService(f.repo, f.repo, f.now);
  const file = await service.upload(f.users.candidate, 'resume', docxFixture(), 'CV.docx');
  const route = `${f.origin}/api/v1/uploads/${encodeURIComponent(file.asset_id)}/preview`;
  const headers = who => ({ Authorization: `Bearer ${signToken(f.jwtEnv, f.users[who], {}, {}, f.now())}` });
  assert.equal((await fetch(route)).status, 401);
  assert.equal((await fetch(route, { headers: headers('recruiter') })).status, 403);
  await new ApplicationService(f.repo, { now: f.now }).create(f.users.candidate, { job_id: f.job._id, submission: { resume_file_id: file.asset_id } });
  for (const who of ['candidate', 'recruiter']) {
    const response = await fetch(route, { headers: headers(who) });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match((await response.json()).data.text, /RecruiHub upload test/);
  }
  for (const who of ['otherCandidate', 'otherRecruiter', 'admin']) assert.equal((await fetch(route, { headers: headers(who) })).status, 403);
});

test('Candidate contact/languages persist with ETag and do not alter scoring fields', async () => {
  const f = createFixture();
  const candidates = { findByUserId: async id => ({ docs: [...f.repo.docs.values()].filter(doc => doc.type === 'candidate' && doc.user_id === id).map(doc => structuredClone(doc)) }), update: async doc => ({ rev: (await f.repo.put(doc))._rev }) };
  const service = new CandidateProfileService({ candidateRepository: candidates, now: () => f.now().getTime() });
  const before = await service.getMyProfile(f.users.candidate._id);
  const patch = { profile: { phone: '+84 912345678', location: 'Hà Nội' }, languages: [{ name: 'English', proficiency: 'IELTS 7.0' }] };
  const saved = await service.updateMyProfile(f.users.candidate._id, patch, before.revision);
  assert.equal(saved.profile.profile.phone, patch.profile.phone); assert.deepEqual(saved.profile.languages, patch.languages);
  for (const key of ['skills', 'education', 'projects', 'experience', 'data_availability']) assert.deepEqual(saved.profile[key], before.profile[key]);
  await assert.rejects(service.updateMyProfile(f.users.candidate._id, patch, before.revision), error => error.status === 409);
});
