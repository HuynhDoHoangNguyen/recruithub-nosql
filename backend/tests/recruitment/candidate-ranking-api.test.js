/**
 * TV3-UC15-002: Candidate Ranking API Test Suite
 *
 * Verifies all 22 required test vectors for GET /api/v1/jobs/:id/applicant-ranking:
 *  1. Owner Recruiter nhận 200 với envelope chính xác.
 *  2. Route thực là /jobs/:id/applicant-ranking.
 *  3. Candidate nhận 403.
 *  4. Admin nhận 403.
 *  5. Recruiter khác nhận 403.
 *  6. Không authentication nhận 401.
 *  7. Job ID sai format nhận 400 VALIDATION_ERROR.
 *  8. Unknown query nhận 400 VALIDATION_ERROR.
 *  9. page=0, limit=0, limit=51, decimal hoặc non-number nhận 400.
 * 10. Job hợp lệ nhưng không tồn tại nhận controlled 404.
 * 11. Không có Application trả summary rỗng và pagination 0.
 * 12. Application chưa có Analysis: tăng NOT_ANALYZED, không trả ID.
 * 13. COMPLETE + fresh xuất hiện trong items.
 * 14. analysis_total_score giữ nguyên raw decimal, không làm tròn.
 * 15. Safe DTO không chứa forbidden fields (_rev, email, cv, submission, fingerprint, ...).
 * 16. Candidate skills đúng shape { name, normalized }.
 * 17. Pagination diễn ra sau global ranking (page=2, limit=1 giữ rank: 2).
 * 18. Đảo thứ tự repository source không làm thay đổi thứ hạng.
 * 19. Excluded applicants không xuất hiện dưới dạng danh sách hay ID.
 * 20. GET ranking không gọi put() và không thay đổi stored docs.
 * 21. Endpoint UC14 vẫn hoạt động (GET và POST resume-analysis).
 * 22. Khởi tạo createApp() với configured repository proxy không fail.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baseTime, startFixture, apply } from './fixtures.js';
import { createApp } from '../../src/app.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';
import { evaluateResumeAnalysis } from '../../src/utils/resume-scoring.utils.js';
import { resumeAnalysisDocumentSchema } from '../../src/schemas/resume-analysis.schema.js';
import { APPLICATION_STAGES } from '../../src/constants/document.constants.js';

function makeCandidateDoc(id, { name = 'Nguyễn Văn A', skills = ['javascript', 'couchdb'], experience_months = 24 } = {}) {
  const userHex = createHash('sha256').update(id).digest('hex');
  const years = Math.floor(experience_months / 12);
  const months = years * 12;
  return {
    _id: id,
    type: 'candidate',
    user_id: `user:${userHex}`,
    profile: {
      role: 'Backend Engineer',
      seniority: 'MID',
      industry: 'SaaS',
      years_experience: years,
      experience_months: months,
      full_name: name,
    },
    skills: skills.map((s) => ({ name: s, normalized: s.toLowerCase() })),
    education: [],
    experience: [],
    projects: [],
    data_availability: {
      skills: skills.length > 0 ? 'AVAILABLE' : 'NONE_DECLARED',
      experience: 'PARTIAL',
      education: 'UNAVAILABLE',
      projects: 'UNAVAILABLE',
    },
    created_at: baseTime,
    updated_at: baseTime,
    provenance: {
      classification: 'derived',
      generated: false,
      transform_version: 'test-fixture',
    },
  };
}

function makeApplicationDoc(candidateId, jobId, { stage = APPLICATION_STAGES.APPLIED, timestamp = baseTime } = {}) {
  const id = applicationIdFromPair(candidateId, jobId);
  const baseMs = Date.parse(timestamp);

  const t1 = new Date(baseMs).toISOString();
  const t2 = new Date(baseMs + 1000).toISOString();
  const t3 = new Date(baseMs + 2000).toISOString();
  const t4 = new Date(baseMs + 3000).toISOString();
  const t5 = new Date(baseMs + 4000).toISOString();

  let stage_history = [
    {
      from_stage: null,
      to_stage: APPLICATION_STAGES.APPLIED,
      timestamp: t1,
      actor_role: 'CANDIDATE',
    },
  ];

  let updatedAt = t1;
  if (stage === APPLICATION_STAGES.SCREENING) {
    updatedAt = t2;
    stage_history.push({
      from_stage: APPLICATION_STAGES.APPLIED,
      to_stage: APPLICATION_STAGES.SCREENING,
      timestamp: t2,
      actor_role: 'RECRUITER',
    });
  } else if (stage === APPLICATION_STAGES.INTERVIEW) {
    updatedAt = t3;
    stage_history.push(
      {
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t2,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t3,
        actor_role: 'RECRUITER',
      }
    );
  } else if (stage === APPLICATION_STAGES.OFFER) {
    updatedAt = t4;
    stage_history.push(
      {
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t2,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t3,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: t4,
        actor_role: 'RECRUITER',
        evidence: { interview_completed: true },
      }
    );
  } else if (stage === APPLICATION_STAGES.HIRED) {
    updatedAt = t5;
    stage_history.push(
      {
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t2,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t3,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: t4,
        actor_role: 'RECRUITER',
        evidence: { interview_completed: true },
      },
      {
        from_stage: APPLICATION_STAGES.OFFER,
        to_stage: APPLICATION_STAGES.HIRED,
        timestamp: t5,
        actor_role: 'RECRUITER',
      }
    );
  }

  return {
    _id: id,
    type: 'application',
    candidate_id: candidateId,
    job_id: jobId,
    current_stage: stage,
    applied_at: t1,
    updated_at: updatedAt,
    submission: {
      resume_text: 'Kỹ sư phần mềm kinh nghiệm về JavaScript và CouchDB.',
    },
    stage_history,
    provenance: {
      classification: 'derived',
      generated: false,
      transform_version: 'test-fixture',
    },
  };
}

function makeAnalysisDoc(application, candidate, job, { overrideTotal, overrideSkill, overrideExperience, overrideEducation, overrideProject } = {}) {
  const analysis = evaluateResumeAnalysis({
    application,
    candidate,
    job,
    analyzedAt: baseTime,
  });

  if (overrideSkill !== undefined) analysis.scores.skill = overrideSkill;
  if (overrideExperience !== undefined) analysis.scores.experience = overrideExperience;
  if (overrideEducation !== undefined) analysis.scores.education = overrideEducation;
  if (overrideProject !== undefined) analysis.scores.project = overrideProject;

  const expectedTotal =
    0.5 * analysis.scores.skill +
    0.25 * analysis.scores.experience +
    0.1 * analysis.scores.education +
    0.15 * analysis.scores.project;

  analysis.total_score = overrideTotal !== undefined ? overrideTotal : expectedTotal;
  analysis.recommendation = analysis.total_score >= 80 ? 'HIGH' : (analysis.total_score >= 60 ? 'MEDIUM' : 'LOW');

  return analysis;
}

test('TV3-UC15-002 Candidate Ranking API Test Suite', async (t) => {
  await t.test('Vector 01 & 02: Owner Recruiter nhận 200 với envelope chính xác tại /jobs/:id/applicant-ranking', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v1');
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);

    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Đã tải bảng xếp hạng ứng viên.');
    assert.ok(res.body.data);
    assert.deepEqual(res.body.data.job, {
      id: fixture.job._id,
      title: fixture.job.title,
    });
    assert.equal(res.body.data.summary.total_applications, 1);
    assert.equal(res.body.data.summary.eligible_applications, 1);
    assert.equal(res.body.data.summary.excluded_applications, 0);
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.pagination.page, 1);
    assert.equal(res.body.data.pagination.limit, 20);
    assert.equal(res.body.data.pagination.total_items, 1);
    assert.equal(res.body.data.pagination.total_pages, 1);
  });

  await t.test('Vector 03: Candidate nhận 403', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'candidate'
    );
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  await t.test('Vector 04: Admin nhận 403', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'admin'
    );
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  await t.test('Vector 05: Recruiter khác nhận 403', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'otherRecruiter'
    );
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  await t.test('Vector 06: Không authentication nhận 401', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      null
    );
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });

  await t.test('Vector 07: Job ID sai format nhận 400 VALIDATION_ERROR', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      '/jobs/invalid_job_format/applicant-ranking',
      undefined,
      'recruiter'
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('Vector 08: Unknown query nhận 400 VALIDATION_ERROR', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking?stage=APPLIED`,
      undefined,
      'recruiter'
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('Vector 09: page=0, limit=0, limit=51, decimal hoặc non-number nhận 400', async () => {
    const fixture = await startFixture(t);
    const queries = ['page=0', 'limit=0', 'limit=51', 'page=1.5', 'page=abc'];
    for (const q of queries) {
      const res = await fixture.request(
        'GET',
        `/jobs/${fixture.job._id}/applicant-ranking?${q}`,
        undefined,
        'recruiter'
      );
      assert.equal(res.status, 400, `Query ${q} must return 400`);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  await t.test('Vector 10: Job hợp lệ nhưng không tồn tại nhận controlled 404', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      '/jobs/job:nonexistent/applicant-ranking',
      undefined,
      'recruiter'
    );
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  await t.test('Vector 11: Không có Application trả summary rỗng và pagination 0', async () => {
    const fixture = await startFixture(t);
    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.summary, {
      total_applications: 0,
      eligible_applications: 0,
      excluded_applications: 0,
      exclusions_by_reason: {},
    });
    assert.deepEqual(res.body.data.items, []);
    assert.deepEqual(res.body.data.pagination, {
      page: 1,
      limit: 20,
      total_items: 0,
      total_pages: 0,
    });
  });

  await t.test('Vector 12: Application chưa có Analysis: NOT_ANALYZED tăng đúng 1 và không lộ ID', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v12');
    const app = makeApplicationDoc(cand._id, fixture.job._id);

    await fixture.repo.put(cand);
    await fixture.repo.put(app);

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.total_applications, 1);
    assert.equal(res.body.data.summary.eligible_applications, 0);
    assert.equal(res.body.data.summary.excluded_applications, 1);
    assert.equal(res.body.data.summary.exclusions_by_reason.NOT_ANALYZED, 1);
    assert.equal(res.body.data.items.length, 0);

    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes(cand._id), false, 'Excluded candidate ID must not be leaked');
    assert.equal(serialized.includes(app._id), false, 'Excluded application ID must not be leaked');
  });

  await t.test('Vector 13: COMPLETE + fresh xuất hiện trong items', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v13');
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);

    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.items.length, 1);
    const item = res.body.data.items[0];
    assert.equal(item.rank, 1);
    assert.equal(item.application_id, app._id);
    assert.equal(item.analysis_status, 'COMPLETE');
    assert.equal(item.analysis_fresh, true);
  });

  await t.test('Vector 14: analysis_total_score giữ nguyên raw decimal, không làm tròn', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v14', { skills: ['javascript'] });
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    // Use fractional skill score: 50.666666666
    // Expected total: 0.50 * 50.666666666 + 0.25 * 100 + 0.10 * 100 + 0.15 * 100 = 75.333333333
    const analysis = makeAnalysisDoc(app, cand, fixture.job, { overrideSkill: 50.666666666 });

    assert.equal(
      resumeAnalysisDocumentSchema.safeParse(analysis).success,
      true,
      'Analysis document must pass schema validation'
    );
    assert.equal(Number.isInteger(analysis.total_score), false, 'analysis.total_score must be a fractional number');

    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.items.length, 1);
    const item = res.body.data.items[0];
    assert.equal(item.analysis_total_score, analysis.total_score);
    assert.equal(item.analysis_total_score, 75.333333333);
    assert.equal(Number.isInteger(item.analysis_total_score), false);
    assert.notEqual(item.analysis_total_score, Math.round(analysis.total_score));
    assert.equal(item.analysis_recommendation, 'MEDIUM');
  });

  await t.test('Vector 15: Safe DTO không chứa forbidden fields', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v15');
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);

    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    const item = res.body.data.items[0];

    const allowedRowKeys = [
      'rank',
      'application_id',
      'current_stage',
      'applied_at',
      'candidate',
      'analysis_status',
      'analysis_fresh',
      'analysis_total_score',
      'analysis_recommendation',
    ].sort();
    assert.deepEqual(Object.keys(item).sort(), allowedRowKeys);

    const allowedCandidateKeys = ['id', 'profile', 'skills'].sort();
    assert.deepEqual(Object.keys(item.candidate).sort(), allowedCandidateKeys);

    const allowedProfileKeys = ['full_name', 'role', 'seniority'].sort();
    assert.deepEqual(Object.keys(item.candidate.profile).sort(), allowedProfileKeys);

    const forbiddenFields = [
      '_rev',
      'email',
      'resume_file',
      'resume_text',
      'submission',
      'stage_history',
      'input_fingerprint',
      'provenance',
      'component_details',
      'missing_inputs',
      'matched_skills',
      'missing_skills',
      'analyzed_at',
    ];

    const serialized = JSON.stringify(res.body);
    for (const forbidden of forbiddenFields) {
      assert.equal(
        serialized.includes(`"${forbidden}"`),
        false,
        `DTO must not contain forbidden field: ${forbidden}`
      );
    }
  });

  await t.test('Vector 16: Candidate skills đúng shape { name, normalized }', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v16', { skills: ['JavaScript', 'CouchDB'] });
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);

    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    const skills = res.body.data.items[0].candidate.skills;
    assert.ok(Array.isArray(skills));
    assert.equal(skills.length, 2);
    for (const s of skills) {
      assert.deepEqual(Object.keys(s).sort(), ['name', 'normalized']);
      assert.equal(typeof s.name, 'string');
      assert.equal(typeof s.normalized, 'string');
    }
  });

  await t.test('Vector 17: Pagination diễn ra sau global ranking (page=2, limit=1 giữ rank: 2)', async () => {
    const fixture = await startFixture(t);

    // 3 eligible applications with distinct scores:
    // Cand 1: skill 100, exp 100, edu 100, proj 100 -> total 100
    const cand1 = makeCandidateDoc('candidate:api_v17_1', { skills: ['javascript', 'couchdb'] });
    const app1 = makeApplicationDoc(cand1._id, fixture.job._id);
    const analysis1 = makeAnalysisDoc(app1, cand1, fixture.job, { overrideSkill: 100, overrideTotal: 100 });

    // Cand 2: skill 80, exp 80, edu 80, proj 80 -> total 80
    const cand2 = makeCandidateDoc('candidate:api_v17_2', { skills: ['javascript'] });
    const app2 = makeApplicationDoc(cand2._id, fixture.job._id);
    const analysis2 = makeAnalysisDoc(app2, cand2, fixture.job, {
      overrideSkill: 80,
      overrideExperience: 80,
      overrideEducation: 80,
      overrideProject: 80,
      overrideTotal: 80,
    });

    // Cand 3: skill 60, exp 60, edu 60, proj 60 -> total 60
    const cand3 = makeCandidateDoc('candidate:api_v17_3', { skills: [] });
    const app3 = makeApplicationDoc(cand3._id, fixture.job._id);
    const analysis3 = makeAnalysisDoc(app3, cand3, fixture.job, {
      overrideSkill: 60,
      overrideExperience: 60,
      overrideEducation: 60,
      overrideProject: 60,
      overrideTotal: 60,
    });

    for (const doc of [cand1, app1, analysis1, cand2, app2, analysis2, cand3, app3, analysis3]) {
      await fixture.repo.put(doc);
    }

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking?page=2&limit=1`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.total_applications, 3);
    assert.equal(res.body.data.summary.eligible_applications, 3);
    assert.equal(res.body.data.pagination.page, 2);
    assert.equal(res.body.data.pagination.limit, 1);
    assert.equal(res.body.data.pagination.total_items, 3);
    assert.equal(res.body.data.pagination.total_pages, 3);

    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].rank, 2, 'Rank must remain 2 on page 2');
    assert.equal(res.body.data.items[0].application_id, app2._id);
  });

  await t.test('Vector 18: Đảo thứ tự repository source không làm thay đổi thứ hạng', async () => {
    const fixture1 = await startFixture(t);
    const fixture2 = await startFixture(t);

    // Cand 1: matches javascript + couchdb (100% skill match -> total 100)
    const cand1 = makeCandidateDoc('candidate:api_v18_1', { skills: ['javascript', 'couchdb'] });
    const app1_f1 = makeApplicationDoc(cand1._id, fixture1.job._id);
    const app1_f2 = makeApplicationDoc(cand1._id, fixture2.job._id);
    const analysis1_f1 = makeAnalysisDoc(app1_f1, cand1, fixture1.job);
    const analysis1_f2 = makeAnalysisDoc(app1_f2, cand1, fixture2.job);

    // Cand 2: matches javascript only (50% skill match -> total 75)
    const cand2 = makeCandidateDoc('candidate:api_v18_2', { skills: ['javascript'] });
    const app2_f1 = makeApplicationDoc(cand2._id, fixture1.job._id);
    const app2_f2 = makeApplicationDoc(cand2._id, fixture2.job._id);
    const analysis2_f1 = makeAnalysisDoc(app2_f1, cand2, fixture1.job);
    const analysis2_f2 = makeAnalysisDoc(app2_f2, cand2, fixture2.job);

    // Verify all Analysis documents pass schema validation
    assert.equal(resumeAnalysisDocumentSchema.safeParse(analysis1_f1).success, true);
    assert.equal(resumeAnalysisDocumentSchema.safeParse(analysis1_f2).success, true);
    assert.equal(resumeAnalysisDocumentSchema.safeParse(analysis2_f1).success, true);
    assert.equal(resumeAnalysisDocumentSchema.safeParse(analysis2_f2).success, true);

    // Fixture 1 puts: cand1, app1, analysis1 then cand2, app2, analysis2
    await fixture1.repo.put(cand1);
    await fixture1.repo.put(app1_f1);
    await fixture1.repo.put(analysis1_f1);
    await fixture1.repo.put(cand2);
    await fixture1.repo.put(app2_f1);
    await fixture1.repo.put(analysis2_f1);

    // Fixture 2 puts in reverse order: cand2, app2, analysis2 first, then cand1, app1, analysis1
    await fixture2.repo.put(cand2);
    await fixture2.repo.put(app2_f2);
    await fixture2.repo.put(analysis2_f2);
    await fixture2.repo.put(cand1);
    await fixture2.repo.put(app1_f2);
    await fixture2.repo.put(analysis1_f2);

    const res1 = await fixture1.request(
      'GET',
      `/jobs/${fixture1.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );
    const res2 = await fixture2.request(
      'GET',
      `/jobs/${fixture2.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    // Non-vacuous assertions: both responses must have real data
    assert.equal(res1.body.data.summary.eligible_applications, 2);
    assert.equal(res2.body.data.summary.eligible_applications, 2);
    assert.equal(res1.body.data.summary.excluded_applications, 0);
    assert.equal(res2.body.data.summary.excluded_applications, 0);
    assert.equal(res1.body.data.items.length, 2);
    assert.equal(res2.body.data.items.length, 2);

    // Verify candidate order, application order, and ranks [1, 2] are identical
    assert.deepEqual(
      res1.body.data.items.map((i) => i.candidate.id),
      [cand1._id, cand2._id]
    );
    assert.deepEqual(
      res2.body.data.items.map((i) => i.candidate.id),
      [cand1._id, cand2._id]
    );
    assert.deepEqual(
      res1.body.data.items.map((i) => i.application_id),
      [app1_f1._id, app2_f1._id]
    );
    assert.deepEqual(
      res2.body.data.items.map((i) => i.application_id),
      [app1_f2._id, app2_f2._id]
    );
    assert.deepEqual(
      res1.body.data.items.map((i) => i.rank),
      [1, 2]
    );
    assert.deepEqual(
      res2.body.data.items.map((i) => i.rank),
      [1, 2]
    );
  });

  await t.test('Vector 19: Excluded applicants không xuất hiện dưới dạng danh sách hay ID', async () => {
    const fixture = await startFixture(t);

    // Eligible
    const candEligible = makeCandidateDoc('candidate:api_v19_ok');
    const appEligible = makeApplicationDoc(candEligible._id, fixture.job._id);
    const analysisEligible = makeAnalysisDoc(appEligible, candEligible, fixture.job);

    // Excluded: HIRED
    const candHired = makeCandidateDoc('candidate:api_v19_hired');
    const appHired = makeApplicationDoc(candHired._id, fixture.job._id, { stage: APPLICATION_STAGES.HIRED });

    // Excluded: NOT_ANALYZED
    const candNoAnalysis = makeCandidateDoc('candidate:api_v19_no_analysis');
    const appNoAnalysis = makeApplicationDoc(candNoAnalysis._id, fixture.job._id);

    for (const doc of [candEligible, appEligible, analysisEligible, candHired, appHired, candNoAnalysis, appNoAnalysis]) {
      await fixture.repo.put(doc);
    }

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.total_applications, 3);
    assert.equal(res.body.data.summary.eligible_applications, 1);
    assert.equal(res.body.data.summary.excluded_applications, 2);
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].candidate.id, candEligible._id);

    const bodyString = JSON.stringify(res.body);
    assert.equal(bodyString.includes(candHired._id), false);
    assert.equal(bodyString.includes(appHired._id), false);
    assert.equal(bodyString.includes(candNoAnalysis._id), false);
    assert.equal(bodyString.includes(appNoAnalysis._id), false);
  });

  await t.test('Vector 20: GET ranking không gọi put() và không thay đổi stored docs', async () => {
    const fixture = await startFixture(t);
    const cand = makeCandidateDoc('candidate:api_v20');
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);

    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    const writesBefore = fixture.repo.writes.length;

    const res = await fixture.request(
      'GET',
      `/jobs/${fixture.job._id}/applicant-ranking`,
      undefined,
      'recruiter'
    );

    assert.equal(res.status, 200);
    const writesAfter = fixture.repo.writes.length;
    assert.equal(writesBefore, writesAfter, 'No writes must occur during ranking fetch');
  });

  await t.test('Vector 21: Endpoint UC14 vẫn hoạt động (GET và POST resume-analysis)', async () => {
    const fixture = await startFixture(t);
    const applyRes = await apply(fixture);
    assert.equal(applyRes.status, 201);
    const applicationId = applyRes.body.data._id || applyRes.body.data.id;

    // POST /api/v1/resume-analysis/compute
    const computeRes = await fixture.request(
      'POST',
      '/resume-analysis/compute',
      { application_id: applicationId },
      'recruiter'
    );
    assert.equal(computeRes.status, 200);
    assert.equal(computeRes.body.success, true);
    assert.equal(computeRes.body.data.analysis_status, 'COMPLETE');

    // GET /api/v1/resume-analysis/:applicationId
    const getRes = await fixture.request(
      'GET',
      `/resume-analysis/${encodeURIComponent(applicationId)}`,
      undefined,
      'recruiter'
    );
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.success, true);
    assert.equal(getRes.body.data.application_id, applicationId);
  });

  await t.test('Vector 22: Khởi tạo createApp() với configured repository proxy không fail', () => {
    const app = createApp({
      jwtEnv: {
        AUTH_COUCHDB_URL: 'http://couch.test:5984',
        AUTH_COUCHDB_DATABASE: 'recruitment_test_isolated',
        JWT_ACCESS_SECRET: 'x'.repeat(48),
      },
    });
    assert.ok(app, 'createApp with configured proxy repository should construct cleanly');
  });
});
