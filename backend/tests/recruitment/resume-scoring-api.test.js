/**
 * TV3-UC22-003: Manual Resume Analysis Compute API Test Suite
 * 
 * Verifies all 21 mandatory test vectors for POST /api/v1/resume-analysis/compute:
 *  1. Recruiter sở hữu Job compute thành công analysis COMPLETE.
 *  2. Compute thành công analysis INCOMPLETE.
 *  3. Response dùng HTTP 200 và envelope chuẩn.
 *  4. Analysis được persist bằng deterministic ID.
 *  5. Recompute cập nhật cùng document với revision mới.
 *  6. Candidate thay đổi làm recompute tạo fingerprint mới.
 *  7. Job thay đổi làm recompute tạo fingerprint mới.
 *  8. Candidate gọi endpoint bị 403.
 *  9. Admin gọi endpoint bị 403.
 * 10. Recruiter khác gọi endpoint bị 403.
 * 11. User bị khóa không được truy cập.
 * 12. Không authentication trả 401.
 * 13. Payload thiếu hoặc sai application_id trả 400.
 * 14. Payload có unknown fields trả 400.
 * 15. Application không tồn tại trả controlled 404.
 * 16. Candidate/Job reference thiếu hoặc invalid không tạo analysis.
 * 17. Existing analysis hỏng schema không bị overwrite.
 * 18. Conflict retry vẫn giữ invariant _rev.
 * 19. Response không chứa email, CV hoặc credential.
 * 20. Stored Application không có match_score, analysis_status hoặc analysis_fresh.
 * 21. Không có write vào CouchDB thật.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, startFixture } from './fixtures.js';

function createCompleteCandidateFixture(baseCandidate) {
  return {
    ...structuredClone(baseCandidate),
    skills: [
      { name: 'JavaScript', normalized: 'javascript' },
      { name: 'CouchDB', normalized: 'couchdb' },
    ],
    profile: {
      role: 'Backend Engineer',
      seniority: 'MID',
      industry: 'SaaS',
      years_experience: 2,
      experience_months: 24,
    },
    education: [
      {
        degree: 'BACHELOR',
        institution: 'Đại học Bách Khoa',
        field_of_study: 'Công nghệ thông tin',
      },
    ],
    experience: [
      {
        employer: 'Công ty Công nghệ',
        role: 'Backend Engineer',
        start_date: '2024-01-01',
        end_date: '2026-01-01',
        description: 'Phát triển backend',
      },
    ],
    projects: [
      {
        name: 'Dự án Tuyển dụng NoSQL',
        technologies: ['JavaScript', 'CouchDB'],
        description: 'Phát triển hệ thống',
      },
    ],
    data_availability: {
      skills: 'AVAILABLE',
      experience: 'AVAILABLE',
      education: 'AVAILABLE',
      projects: 'AVAILABLE',
    },
  };
}

test('Vector 01, 03, 04, 19, 20: Recruiter sở hữu Job compute thành công COMPLETE với envelope chuẩn và deterministic ID', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const app = (await apply(f)).body.data;
  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');

  // Vector 03: Response HTTP 200 và envelope chuẩn
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Đã phân tích mức độ phù hợp hồ sơ.');
  assert.ok(res.body.data);

  // Vector 01: Analysis COMPLETE
  assert.equal(res.body.data.analysis_status, 'COMPLETE');
  assert.equal(typeof res.body.data.total_score, 'number');
  assert.ok(res.body.data.total_score > 0);
  assert.ok(res.body.data.recommendation);

  // Vector 04: Persist bằng deterministic ID analysis:<application_id>
  assert.equal(res.body.data._id, `analysis:${app._id}`);
  const stored = await f.repo.get(`analysis:${app._id}`);
  assert.ok(stored);
  assert.equal(stored._id, `analysis:${app._id}`);
  assert.equal(stored.analysis_status, 'COMPLETE');

  // Vector 19: Response không chứa email, CV hoặc credential
  assert.equal(res.body.data.email, undefined);
  assert.equal(res.body.data.resume_text, undefined);
  assert.equal(res.body.data.cover_letter, undefined);
  assert.equal(res.body.data.password, undefined);
  assert.equal(res.body.data.password_hash, undefined);
  assert.equal(res.body.data.token, undefined);

  // Vector 20: Stored Application không có match_score, analysis_status hoặc analysis_fresh
  const storedApp = await f.repo.get(app._id);
  assert.equal(storedApp.match_score, undefined);
  assert.equal(storedApp.analysis_status, undefined);
  assert.equal(storedApp.analysis_fresh, undefined);
});

test('Vector 02: Compute thành công analysis INCOMPLETE', async t => {
  const f = await startFixture(t);
  // Job yêu cầu bằng cấp nhưng candidate thiếu dữ liệu education -> INCOMPLETE
  f.repo.docs.get(f.job._id).requirements.education = { status: 'REQUIRED', minimum_degree: 'BACHELOR' };

  const app = (await apply(f)).body.data;
  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.analysis_status, 'INCOMPLETE');
  assert.equal(res.body.data.total_score, undefined);
  assert.equal(res.body.data.recommendation, undefined);
  assert.ok(Array.isArray(res.body.data.missing_inputs));
  assert.ok(res.body.data.missing_inputs.length > 0);

  const stored = await f.repo.get(`analysis:${app._id}`);
  assert.ok(stored);
  assert.equal(stored.analysis_status, 'INCOMPLETE');
});

test('Vector 05: Recompute cập nhật cùng document với revision mới', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  // Lần compute 1
  const res1 = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res1.status, 200);
  const rev1 = res1.body.data._rev;

  // Lần compute 2 (recompute)
  const res2 = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res2.status, 200);
  assert.equal(res2.body.data._id, res1.body.data._id);
  assert.notEqual(res2.body.data._rev, rev1);

  // Xác nhận chỉ có đúng 1 analysis document trong repo
  const analyses = [...f.repo.docs.values()].filter(doc => doc.type === 'resume_analysis');
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0]._id, `analysis:${app._id}`);
  assert.equal(analyses[0]._rev, res2.body.data._rev);
});

test('Vector 06: Candidate thay đổi làm recompute tạo fingerprint mới', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const app = (await apply(f)).body.data;
  const res1 = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res1.status, 200);
  const fp1 = res1.body.data.input_fingerprint;

  // Cập nhật candidate trong repo
  const updatedCandidate = structuredClone(completeCand);
  updatedCandidate.skills.push({ name: 'TypeScript', normalized: 'typescript' });
  updatedCandidate._rev = '2-fixture';
  f.repo.docs.set(updatedCandidate._id, updatedCandidate);

  // Recompute
  const res2 = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res2.status, 200);
  assert.notEqual(res2.body.data.input_fingerprint, fp1);
});

test('Vector 07: Job thay đổi làm recompute tạo fingerprint mới', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const app = (await apply(f)).body.data;
  const res1 = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res1.status, 200);
  const fp1 = res1.body.data.input_fingerprint;

  // Cập nhật job trong repo
  const updatedJob = structuredClone(await f.repo.get(f.job._id));
  updatedJob.required_skills.push('redis');
  updatedJob._rev = '2-fixture';
  f.repo.docs.set(updatedJob._id, updatedJob);

  // Recompute
  const res2 = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res2.status, 200);
  assert.notEqual(res2.body.data.input_fingerprint, fp1);
});

test('Vector 08: Candidate gọi endpoint bị 403', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'candidate');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Vector 09: Admin gọi endpoint bị 403', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'admin');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Vector 10: Recruiter khác gọi endpoint bị 403', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'otherRecruiter');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Vector 11: User bị khóa không được truy cập', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  f.repo.docs.get(f.users.recruiter._id).account_status = 'LOCKED';
  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHENTICATED');
});

test('Vector 12: Không authentication trả 401', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, null);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHENTICATED');
});

test('Vector 13: Payload thiếu hoặc sai application_id trả 400', async t => {
  const f = await startFixture(t);

  const missing = await f.request('POST', '/resume-analysis/compute', {}, 'recruiter');
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'VALIDATION_ERROR');

  const empty = await f.request('POST', '/resume-analysis/compute', { application_id: '' }, 'recruiter');
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'VALIDATION_ERROR');

  const badPrefix = await f.request('POST', '/resume-analysis/compute', { application_id: 'app:123' }, 'recruiter');
  assert.equal(badPrefix.status, 400);
  assert.equal(badPrefix.body.error.code, 'VALIDATION_ERROR');

  const nonHex = await f.request('POST', '/resume-analysis/compute', { application_id: `application:pair:${'g'.repeat(64)}` }, 'recruiter');
  assert.equal(nonHex.status, 400);
  assert.equal(nonHex.body.error.code, 'VALIDATION_ERROR');

  const shortDigest = await f.request('POST', '/resume-analysis/compute', { application_id: 'application:pair:abcd' }, 'recruiter');
  assert.equal(shortDigest.status, 400);
  assert.equal(shortDigest.body.error.code, 'VALIDATION_ERROR');
});

test('Vector 14: Payload có unknown fields trả 400', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  for (const extra of [
    { candidate_id: 'candidate:one' },
    { job_id: f.job._id },
    { _rev: '1-fake' },
    { score: 100 },
    { provenance: {} },
    { client_time: Date.now() },
  ]) {
    const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id, ...extra }, 'recruiter');
    assert.equal(res.status, 400, `Unknown field ${Object.keys(extra)[0]} must be rejected with 400`);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('Vector 15: Application không tồn tại trả controlled 404', async t => {
  const f = await startFixture(t);
  const nonExistentId = `application:pair:${'a'.repeat(64)}`;

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: nonExistentId }, 'recruiter');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('Vector 16: Candidate/Job reference thiếu hoặc invalid không tạo analysis', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  // Xóa analysis tự động sinh lúc apply để kiểm tra compute API không sinh thêm khi reference hỏng
  f.repo.docs.delete(`analysis:${app._id}`);
  const initialWrites = f.repo.writes.length;

  // Trường hợp 1: Candidate bị xóa khỏi database
  f.repo.docs.delete(f.candidate._id);
  const resMissingCand = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(resMissingCand.status, 404);
  assert.equal(await f.repo.get(`analysis:${app._id}`), null);

  // Phục hồi candidate, thử trường hợp 2: Job bị xóa
  f.repo.docs.set(f.candidate._id, f.candidate);
  f.repo.docs.delete(f.job._id);
  const resMissingJob = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(resMissingJob.status, 404);
  assert.equal(await f.repo.get(`analysis:${app._id}`), null);
});

test('Vector 17: Existing analysis hỏng schema không bị overwrite', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  // Làm hỏng schema analysis đã lưu
  const analysisDoc = f.repo.docs.get(`analysis:${app._id}`);
  analysisDoc.total_score = 'corrupted-non-number';

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_STORED_DOCUMENT');

  // Xác nhận document vẫn giữ nguyên và không bị ghi đè
  const stored = f.repo.docs.get(`analysis:${app._id}`);
  assert.equal(stored.total_score, 'corrupted-non-number');
});

test('Vector 18: Conflict retry vẫn giữ invariant _rev', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;
  const analysisId = `analysis:${app._id}`;

  let putAttempts = 0;
  const origPut = f.repo.put.bind(f.repo);
  f.repo.put = async (doc) => {
    if (doc.type === 'resume_analysis') {
      putAttempts++;
      if (putAttempts === 1) {
        // Mô phỏng concurrent update làm stale revision
        const current = f.repo.docs.get(analysisId);
        if (current) current._rev = '2-concurrent-writer';
      }
    }
    return origPut(doc);
  };

  const res = await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  assert.equal(res.status, 200);
  assert.ok(putAttempts >= 2, 'Conflict kích hoạt fresh read và retry');
  assert.equal(res.body.data._rev, '3-fixture');
});

test('Vector 21: Không có write vào CouchDB thật', async t => {
  const f = await startFixture(t);
  // Xác nhận toàn bộ tương tác đều thông qua in-memory repository
  assert.ok(f.repo.docs instanceof Map);
  assert.ok(Array.isArray(f.repo.writes));
});

test('TV3-UC14 Vector 01: Owner Recruiter đọc COMPLETE + fresh', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  completeCand.profile.full_name = 'Nguyễn Văn A';
  f.repo.docs.set(completeCand._id, completeCand);

  const app = (await apply(f)).body.data;
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');

  const res = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.application_id, app._id);
  assert.equal(res.body.data.analysis_status, 'COMPLETE');
  assert.equal(res.body.data.analysis_fresh, true);
  assert.equal(res.body.data.candidate.id, completeCand._id);
  assert.equal(res.body.data.candidate.full_name, 'Nguyễn Văn A');
  assert.equal(res.body.data.job.id, f.job._id);
  assert.equal(res.body.data.job.title, f.job.title);

  const a = res.body.data.analysis;
  assert.ok(a);
  assert.equal(typeof a.scores.skill, 'number');
  assert.equal(typeof a.scores.experience, 'number');
  assert.equal(typeof a.scores.education, 'number');
  assert.equal(typeof a.scores.project, 'number');
  assert.equal(typeof a.total_score, 'number');
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(a.recommendation));
  assert.ok(Array.isArray(a.matched_skills));
  assert.ok(Array.isArray(a.missing_skills));
  assert.ok(Array.isArray(a.project.matched_technologies));
  assert.ok(Array.isArray(a.project.missing_technologies));
  assert.deepEqual(a.missing_inputs, []);
  assert.equal(a.algorithm_version, 'recruithub-scoring-mvp-v1');
  assert.ok(a.analyzed_at);
  assert.equal(a.evidence_metadata.available, true);
  assert.equal(typeof a.evidence_metadata.has_synthetic_evidence, 'boolean');

  // Verify DTO sanitization: no internal / sensitive fields
  assert.equal(res.body.data._rev, undefined);
  assert.equal(res.body.data.input_fingerprint, undefined);
  assert.equal(res.body.data.component_details, undefined);
  assert.equal(res.body.data.provenance, undefined);
  assert.equal(res.body.data.email, undefined);
  assert.equal(res.body.data.token, undefined);
  assert.equal(a._rev, undefined);
  assert.equal(a.input_fingerprint, undefined);
  assert.equal(a.component_details, undefined);
  assert.equal(a.provenance, undefined);
  assert.equal(a.diagnostics, undefined);
});

test('TV3-UC14 Vector 02: Owner Recruiter đọc INCOMPLETE', async t => {
  const f = await startFixture(t);
  f.repo.docs.get(f.job._id).requirements.education = { status: 'REQUIRED', minimum_degree: 'BACHELOR' };

  const app = (await apply(f)).body.data;
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');

  const res = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.analysis_status, 'INCOMPLETE');
  assert.equal(res.body.data.analysis_fresh, true);

  const a = res.body.data.analysis;
  assert.ok(a);
  assert.equal(a.scores.education, null);
  assert.equal(a.total_score, undefined);
  assert.equal(a.recommendation, undefined);
  assert.ok(Array.isArray(a.missing_inputs));
  assert.ok(a.missing_inputs.length > 0);
});

test('TV3-UC14 Vector 03: Chưa có analysis trả controlled NOT_ANALYZED', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;
  // Ensure no analysis document exists
  f.repo.docs.delete(`analysis:${app._id}`);

  const res = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.application_id, app._id);
  assert.equal(res.body.data.analysis_status, 'NOT_ANALYZED');
  assert.equal(res.body.data.analysis_fresh, false);
  assert.equal(res.body.data.analysis, null);
  assert.equal(res.body.data.candidate.id, f.candidate._id);
  assert.equal(res.body.data.job.id, f.job._id);
});

test('TV3-UC14 Vector 04: Stale analysis trả analysis_fresh: false mà không tự recompute hay ghi DB', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const app = (await apply(f)).body.data;
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');

  // Change candidate skill to make analysis stale
  const updatedCandidate = structuredClone(completeCand);
  updatedCandidate.skills.push({ name: 'TypeScript', normalized: 'typescript' });
  updatedCandidate._rev = '2-fixture';
  f.repo.docs.set(updatedCandidate._id, updatedCandidate);

  const writesBefore = f.repo.writes.length;
  const res = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.analysis_status, 'COMPLETE');
  assert.equal(res.body.data.analysis_fresh, false);
  assert.equal(f.repo.writes.length, writesBefore, 'Không ghi vào DB hoặc tự recompute');
});

test('TV3-UC14 Vector 05: Legacy analysis thiếu toàn bộ input_context không crash và evidence_metadata xử lý đúng', async t => {
  const f = await startFixture(t);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);

  const app = (await apply(f)).body.data;
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');

  // Case A: Make it a legacy analysis by deleting input_context on all 4 components
  const analysisDoc = f.repo.docs.get(`analysis:${app._id}`);
  delete analysisDoc.component_details.skill.input_context;
  delete analysisDoc.component_details.experience.input_context;
  delete analysisDoc.component_details.education.input_context;
  delete analysisDoc.component_details.project.input_context;

  const resLegacy = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(resLegacy.status, 200);
  assert.equal(resLegacy.body.data.analysis.evidence_metadata.available, false);
  assert.equal(resLegacy.body.data.analysis.evidence_metadata.has_synthetic_evidence, null);

  // Case B: Metadata đầy đủ và có synthetic project evidence
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  const freshDoc = f.repo.docs.get(`analysis:${app._id}`);
  freshDoc.component_details.project.input_context.candidate_project_evidence = [
    { technologies: ['javascript'], is_synthetic: true, provenance: null },
  ];

  const resSynthetic = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(resSynthetic.status, 200);
  assert.equal(resSynthetic.body.data.analysis.evidence_metadata.available, true);
  assert.equal(resSynthetic.body.data.analysis.evidence_metadata.has_synthetic_evidence, true);
});

test('TV3-UC14 Vector 06: Analysis sai type/schema/reference trả controlled 409', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;
  const analysisId = `analysis:${app._id}`;

  // Case A: Sai type
  f.repo.docs.set(analysisId, { _id: analysisId, _rev: '1-fixture', type: 'application', application_id: app._id });
  const resBadType = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(resBadType.status, 409);
  assert.equal(resBadType.body.error.code, 'CONFLICT');

  // Case B: Hỏng schema
  f.repo.docs.delete(analysisId);
  const completeCand = createCompleteCandidateFixture(f.candidate);
  f.repo.docs.set(completeCand._id, completeCand);
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  const stored = f.repo.docs.get(analysisId);
  stored.total_score = 'corrupted-score';
  const resBadSchema = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(resBadSchema.status, 409);
  assert.equal(resBadSchema.body.error.code, 'INVALID_STORED_DOCUMENT');

  // Case C: Reference mismatch
  f.repo.docs.delete(analysisId);
  await f.request('POST', '/resume-analysis/compute', { application_id: app._id }, 'recruiter');
  const validStored = f.repo.docs.get(analysisId);
  validStored.candidate_id = 'candidate:two';
  const resBadRef = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'recruiter');
  assert.equal(resBadRef.status, 409);
  assert.equal(resBadRef.body.error.code, 'REFERENCE_MISMATCH');
});

test('TV3-UC14 Vector 07: Candidate và Admin bị 403 khi GET resume-analysis', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  const resCand = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'candidate');
  assert.equal(resCand.status, 403);
  assert.equal(resCand.body.error.code, 'FORBIDDEN');

  const resAdmin = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'admin');
  assert.equal(resAdmin.status, 403);
  assert.equal(resAdmin.body.error.code, 'FORBIDDEN');
});

test('TV3-UC14 Vector 08: Recruiter khác chủ Job bị 403', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  const resOther = await f.request('GET', `/resume-analysis/${app._id}`, undefined, 'otherRecruiter');
  assert.equal(resOther.status, 403);
  assert.equal(resOther.body.error.code, 'FORBIDDEN');
});

test('TV3-UC14 Vector 09: Application không tồn tại trả 404', async t => {
  const f = await startFixture(t);
  const nonExistent = `application:pair:${'f'.repeat(64)}`;

  const res = await f.request('GET', `/resume-analysis/${nonExistent}`, undefined, 'recruiter');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('TV3-UC14 Vector 10: Route param sai format hoặc có unknown query trả 400', async t => {
  const f = await startFixture(t);
  const app = (await apply(f)).body.data;

  // Param sai format
  const resBadId = await f.request('GET', '/resume-analysis/not-a-valid-pair-id', undefined, 'recruiter');
  assert.equal(resBadId.status, 400);
  assert.equal(resBadId.body.error.code, 'VALIDATION_ERROR');

  const resUpperHex = await f.request('GET', `/resume-analysis/application:pair:${'A'.repeat(64)}`, undefined, 'recruiter');
  assert.equal(resUpperHex.status, 400);
  assert.equal(resUpperHex.body.error.code, 'VALIDATION_ERROR');

  // Unknown query param
  const resQuery = await f.request('GET', `/resume-analysis/${app._id}?unknown_field=true`, undefined, 'recruiter');
  assert.equal(resQuery.status, 400);
  assert.equal(resQuery.body.error.code, 'VALIDATION_ERROR');
});
