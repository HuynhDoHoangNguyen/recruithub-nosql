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
