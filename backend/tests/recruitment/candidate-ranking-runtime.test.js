/**
 * TV3-UC15-001: Deterministic Candidate Ranking Runtime Test Suite
 *
 * Verifies all 30 test vectors for deterministic candidate ranking & batch access:
 *  1. Owner Recruiter rank thành công.
 *  2. Candidate bị 403.
 *  3. Admin bị 403.
 *  4. Recruiter khác bị 403.
 *  5. Ownership được kiểm tra trước collection reads.
 *  6. total_score DESC.
 *  7. scores.skill DESC khi total bằng tuyệt đối.
 *  8. applied_at ASC khi total và skill bằng.
 *  9. application._id ASC khi ba khóa trước bằng.
 * 10. Hai raw total khác nhau dưới 1e-9 vẫn xếp đúng theo total.
 * 11. Hai raw skill khác nhau dưới 1e-9 vẫn xếp đúng theo skill.
 * 12. Input Applications đảo thứ tự vẫn cho kết quả giống nhau.
 * 13. Nguồn Applications có nhiều Mango pages vẫn tạo ranking toàn cục.
 * 14. Rank được đánh sau sort và liên tục từ 1.
 * 15. INCOMPLETE bị loại.
 * 16. NOT_ANALYZED bị loại.
 * 17. Stale bị loại bằng isAnalysisFresh().
 * 18. HIRED bị loại.
 * 19. REJECTED bị loại.
 * 20. WITHDRAWN bị loại.
 * 21. Analysis sai type/schema bị controlled exclusion, không fail toàn ranking.
 * 22. Analysis sai application/candidate/job reference bị exclusion.
 * 23. Candidate thiếu hoặc hỏng bị exclusion.
 * 24. Application hỏng bị exclusion.
 * 25. Analysis của Job khác không lọt vào ranking.
 * 26. getMany() được dùng theo batch; không có một get() cho mỗi Analysis/Candidate.
 * 27. Ranking không gọi put().
 * 28. Application và Analysis stored documents không có field rank.
 * 29. Không mutate input documents.
 * 30. Exclusion counts khớp chính xác tổng Applications.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baseTime, createFixture } from './fixtures.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';
import { evaluateResumeAnalysis } from '../../src/utils/resume-scoring.utils.js';
import {
  CandidateRankingService,
  createCandidateRankingService,
  RANKING_EXCLUSION_REASONS,
} from '../../src/services/scoring/candidate-ranking.service.js';
import { APPLICATION_STAGES } from '../../src/constants/document.constants.js';
import { JobApplicationRepository } from '../../src/repositories/job-application.repository.js';
import { ApiError } from '../../src/middleware/job-application.middleware.js';

function makeCandidateDoc(id, { name = 'Ứng viên Kiểm thử', skills = ['javascript', 'couchdb'], experience_months = 24 } = {}) {
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
        evidence: { offer_signed: true },
      }
    );
  } else if (stage === APPLICATION_STAGES.REJECTED) {
    updatedAt = t2;
    stage_history.push({
      from_stage: APPLICATION_STAGES.APPLIED,
      to_stage: APPLICATION_STAGES.REJECTED,
      timestamp: t2,
      actor_role: 'RECRUITER',
      reason_code: 'SCREENING_REJECTED',
    });
  } else if (stage === APPLICATION_STAGES.WITHDRAWN) {
    updatedAt = t2;
    stage_history.push({
      from_stage: APPLICATION_STAGES.APPLIED,
      to_stage: APPLICATION_STAGES.WITHDRAWN,
      timestamp: t2,
      actor_role: 'CANDIDATE',
    });
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

test('TV3-UC15-001 Deterministic Candidate Ranking Runtime Test Suite', async (t) => {
  await t.test('Vector 01: Owner Recruiter rank thành công', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t1', { skills: ['javascript', 'couchdb'] });
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.job._id, fixture.job._id);
    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 1);
    assert.equal(result.rankedItems[0].rank, 1);
    assert.equal(result.rankedItems[0].application._id, appA._id);
    assert.equal(result.rankedItems[0].candidate._id, candA._id);
    assert.equal(result.rankedItems[0].analysis._id, analysisA._id);
    assert.equal(result.exclusions.total, 0);
  });

  await t.test('Vector 02: Candidate bị 403', async () => {
    const fixture = createFixture();
    const service = createCandidateRankingService(fixture.repo);

    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.candidate, fixture.job._id),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('Vector 03: Admin bị 403', async () => {
    const fixture = createFixture();
    const service = createCandidateRankingService(fixture.repo);

    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.admin, fixture.job._id),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('Vector 04: Recruiter khác bị 403', async () => {
    const fixture = createFixture();
    const service = createCandidateRankingService(fixture.repo);

    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.otherRecruiter, fixture.job._id),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('Vector 05: Ownership được kiểm tra trước collection reads', async () => {
    const fixture = createFixture();
    let allApplicationsCalled = false;
    let getManyCalled = false;

    fixture.repo.allApplicationsForJob = async () => {
      allApplicationsCalled = true;
      return [];
    };
    fixture.repo.getMany = async () => {
      getManyCalled = true;
      return new Map();
    };

    const service = createCandidateRankingService(fixture.repo);

    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.otherRecruiter, fixture.job._id),
      (err) => err.status === 403
    );

    assert.equal(allApplicationsCalled, false, 'allApplicationsForJob must not be called when unauthorized');
    assert.equal(getManyCalled, false, 'getMany must not be called when unauthorized');
  });

  await t.test('Vector 06: total_score DESC', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t6_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t6_b', { skills: ['javascript'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job); // total: 100
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job); // total: 75

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    assert.equal(result.rankedItems[0].application._id, appA._id);
    assert.equal(result.rankedItems[0].rank, 1);
    assert.equal(result.rankedItems[1].application._id, appB._id);
    assert.equal(result.rankedItems[1].rank, 2);
    assert.ok(result.rankedItems[0].analysis.total_score > result.rankedItems[1].analysis.total_score);
  });

  await t.test('Vector 07: scores.skill DESC khi total bằng tuyệt đối', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t7_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t7_b', { skills: ['javascript'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    // Both total_score = 80.0, but candA has skill = 80, exp = 60; candB has skill = 60, exp = 100
    // Total for A = 0.5*80 + 0.25*60 + 0.1*100 + 0.15*100 = 40 + 15 + 10 + 15 = 80.0
    // Total for B = 0.5*60 + 0.25*100 + 0.1*100 + 0.15*100 = 30 + 25 + 10 + 15 = 80.0
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job, { overrideSkill: 80, overrideExperience: 60 });
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job, { overrideSkill: 60, overrideExperience: 100 });

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    assert.equal(result.rankedItems[0].application._id, appA._id);
    assert.equal(result.rankedItems[1].application._id, appB._id);
    assert.equal(result.rankedItems[0].analysis.total_score, result.rankedItems[1].analysis.total_score);
    assert.ok(result.rankedItems[0].analysis.scores.skill > result.rankedItems[1].analysis.scores.skill);
  });

  await t.test('Vector 08: applied_at ASC khi total và skill bằng', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t8_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t8_b', { skills: ['javascript', 'couchdb'] });

    const earlierTime = '2026-10-22T10:00:00.000Z';
    const laterTime = '2026-10-22T12:00:00.000Z';

    const appA = makeApplicationDoc(candA._id, fixture.job._id, { timestamp: laterTime });
    const appB = makeApplicationDoc(candB._id, fixture.job._id, { timestamp: earlierTime });

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    assert.equal(result.rankedItems[0].application._id, appB._id, 'Earlier applied_at must rank higher');
    assert.equal(result.rankedItems[1].application._id, appA._id);
  });

  await t.test('Vector 09: application._id ASC khi ba khóa trước bằng', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t9_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t9_b', { skills: ['javascript', 'couchdb'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id, { timestamp: baseTime });
    const appB = makeApplicationDoc(candB._id, fixture.job._id, { timestamp: baseTime });

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    const expectedFirstAppId = appA._id < appB._id ? appA._id : appB._id;
    const expectedSecondAppId = appA._id < appB._id ? appB._id : appA._id;

    assert.equal(result.rankedItems[0].application._id, expectedFirstAppId);
    assert.equal(result.rankedItems[1].application._id, expectedSecondAppId);
  });

  await t.test('Vector 10: Hai raw total khác nhau dưới 1e-9 vẫn xếp đúng theo total', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t10_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t10_b', { skills: ['javascript', 'couchdb'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    // Higher has total 80.0000000002 with lower skill 60, exp 100 (expectedTotal 80.0, diff 2e-10 <= 1e-6)
    // Lower has total 80.0000000001 with higher skill 80, exp 60 (expectedTotal 80.0, diff 1e-10 <= 1e-6)
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job, { overrideSkill: 60, overrideExperience: 100, overrideTotal: 80.0000000002 });
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job, { overrideSkill: 80, overrideExperience: 60, overrideTotal: 80.0000000001 });

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    assert.equal(result.rankedItems[0].application._id, appA._id, 'Higher raw total must rank first regardless of skill');
    assert.equal(result.rankedItems[1].application._id, appB._id);
  });

  await t.test('Vector 11: Hai raw skill khác nhau dưới 1e-9 vẫn xếp đúng theo skill', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t11_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t11_b', { skills: ['javascript', 'couchdb'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    // Identical total 80.0, but candA has skill 60.0000000002, candB has skill 60.0000000001
    // expectedTotal is within 1e-6 tolerance of 80.0
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job, { overrideSkill: 60.0000000002, overrideExperience: 100, overrideTotal: 80.0 });
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job, { overrideSkill: 60.0000000001, overrideExperience: 100, overrideTotal: 80.0 });

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    assert.equal(result.rankedItems[0].application._id, appA._id, 'Higher raw skill must rank first when totals are identical');
    assert.equal(result.rankedItems[1].application._id, appB._id);
  });

  await t.test('Vector 12: Input Applications đảo thứ tự vẫn cho kết quả giống nhau', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t12_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t12_b', { skills: ['javascript'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const forwardResult = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    // Reverse application order in repository retrieval
    const originalAll = fixture.repo.allApplicationsForJob.bind(fixture.repo);
    fixture.repo.allApplicationsForJob = async (id, opts) => {
      const items = await originalAll(id, opts);
      return items.reverse();
    };

    const reverseResult = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(forwardResult.rankedItems.length, reverseResult.rankedItems.length);
    assert.equal(forwardResult.rankedItems[0].application._id, reverseResult.rankedItems[0].application._id);
    assert.equal(forwardResult.rankedItems[1].application._id, reverseResult.rankedItems[1].application._id);
  });

  await t.test('Vector 13: Nguồn Applications có nhiều Mango pages vẫn tạo ranking toàn cục', async () => {
    const fixture = createFixture();
    const candidates = [];
    const applications = [];
    const analyses = [];

    // Create 5 applications with descending skills
    for (let i = 1; i <= 5; i++) {
      const cand = makeCandidateDoc(`candidate:t13_${i}`, {
        skills: i === 1 ? ['javascript', 'couchdb'] : (i === 2 ? ['javascript'] : []),
      });
      const app = makeApplicationDoc(cand._id, fixture.job._id, {
        timestamp: `2026-10-22T1${i}:00:00.000Z`,
      });
      const analysis = makeAnalysisDoc(app, cand, fixture.job);

      candidates.push(cand);
      applications.push(app);
      analyses.push(analysis);

      await fixture.repo.put(cand);
      await fixture.repo.put(app);
      await fixture.repo.put(analysis);
    }

    const service = createCandidateRankingService(fixture.repo, { pageSize: 2 });
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id, { pageSize: 2 });

    assert.equal(result.totalApplications, 5, 'Must page through all Mango bookmarks to retrieve all 5 applications');
    assert.equal(result.rankedItems.length, 5);
    for (let i = 0; i < 5; i++) {
      assert.equal(result.rankedItems[i].rank, i + 1);
    }
  });

  await t.test('Vector 14: Rank được đánh sau sort và liên tục từ 1', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t14_a', { skills: ['javascript', 'couchdb'] });
    const candB = makeCandidateDoc('candidate:t14_b', { skills: ['javascript'] });

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems[0].rank, 1);
    assert.equal(result.rankedItems[1].rank, 2);
  });

  await t.test('Vector 15: INCOMPLETE bị loại', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t15');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);

    // Analysis with INCOMPLETE status
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    analysisA.analysis_status = 'INCOMPLETE';
    analysisA.scores.skill = null;
    delete analysisA.total_score;
    delete analysisA.recommendation;
    analysisA.missing_inputs = [{ component: 'skill', code: 'TEST_MISSING', message: 'Missing skill' }];

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INCOMPLETE], 1);
  });

  await t.test('Vector 16: NOT_ANALYZED bị loại', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t16');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);

    // No analysis put in repo
    await fixture.repo.put(candA);
    await fixture.repo.put(appA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.NOT_ANALYZED], 1);
  });

  await t.test('Vector 17: Stale bị loại bằng isAnalysisFresh()', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t17', { skills: ['javascript'] });
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    const savedCand = await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    // Candidate skills update in repo making stored analysis fingerprint stale
    const updatedCand = {
      ...candA,
      _rev: savedCand._rev,
      skills: [{ name: 'JavaScript', normalized: 'javascript' }, { name: 'CouchDB', normalized: 'couchdb' }],
    };
    await fixture.repo.put(updatedCand);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.STALE], 1);
  });

  await t.test('Vector 18: HIRED bị loại', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t18');
    const appA = makeApplicationDoc(candA._id, fixture.job._id, { stage: APPLICATION_STAGES.HIRED });
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INACTIVE_STAGE], 1);
  });

  await t.test('Vector 19: REJECTED bị loại', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t19');
    const appA = makeApplicationDoc(candA._id, fixture.job._id, { stage: APPLICATION_STAGES.REJECTED });
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INACTIVE_STAGE], 1);
  });

  await t.test('Vector 20: WITHDRAWN bị loại', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t20');
    const appA = makeApplicationDoc(candA._id, fixture.job._id, { stage: APPLICATION_STAGES.WITHDRAWN });
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INACTIVE_STAGE], 1);
  });

  await t.test('Vector 21: Analysis sai type/schema bị controlled exclusion, không fail toàn ranking', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t21_a');
    const candB = makeCandidateDoc('candidate:t21_b');

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    // Malformed analysis for appB
    const badAnalysisB = {
      _id: `analysis:${appB._id}`,
      type: 'invalid_type',
      scores: {},
    };

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(badAnalysisB);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 2);
    assert.equal(result.rankedItems.length, 1);
    assert.equal(result.rankedItems[0].application._id, appA._id);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INVALID_ANALYSIS], 1);
  });

  await t.test('Vector 22: Analysis sai application/candidate/job reference bị exclusion', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t22');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    analysisA.candidate_id = 'candidate:other_cand'; // Mismatched candidate reference

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.REFERENCE_MISMATCH], 1);
  });

  await t.test('Vector 23: Candidate thiếu hoặc hỏng bị exclusion', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t23');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    // Missing candidate in repository
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INVALID_CANDIDATE], 1);
  });

  await t.test('Vector 24: Application hỏng bị exclusion', async () => {
    const fixture = createFixture();
    // Application document with type: application matching selector, but invalid schema (empty stage_history)
    const brokenApp = {
      _id: `application:pair:${'e'.repeat(64)}`,
      type: 'application',
      job_id: fixture.job._id,
      candidate_id: 'candidate:t24',
      current_stage: 'APPLIED',
      applied_at: baseTime,
      updated_at: baseTime,
      stage_history: [], // Invalid: schema requires min 1
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'test-fixture',
      },
    };

    await fixture.repo.put(brokenApp);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INVALID_APPLICATION], 1);
  });

  await t.test('Vector 25: Analysis của Job khác không lọt vào ranking', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t25');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    analysisA.job_id = 'job:cms:J_999999'; // Pointing to a different job

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 1);
    assert.equal(result.rankedItems.length, 0);
    assert.equal(result.exclusions.total, 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.REFERENCE_MISMATCH], 1);
  });

  await t.test('Vector 26: getMany() được dùng theo batch; không có một get() cho mỗi Analysis/Candidate', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t26_a');
    const candB = makeCandidateDoc('candidate:t26_b');

    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const appB = makeApplicationDoc(candB._id, fixture.job._id);

    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    const analysisB = makeAnalysisDoc(appB, candB, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(candB);
    await fixture.repo.put(appA);
    await fixture.repo.put(appB);
    await fixture.repo.put(analysisA);
    await fixture.repo.put(analysisB);

    let getManyCalls = 0;
    const originalGetMany = fixture.repo.getMany.bind(fixture.repo);
    fixture.repo.getMany = async (ids) => {
      getManyCalls++;
      return originalGetMany(ids);
    };

    let getIndividualCalls = 0;
    const originalGet = fixture.repo.get.bind(fixture.repo);
    fixture.repo.get = async (id) => {
      if (id.startsWith('candidate:') || id.startsWith('analysis:')) {
        getIndividualCalls++;
      }
      return originalGet(id);
    };

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems.length, 2);
    assert.equal(getManyCalls, 1, 'getMany must be called once in batch');
    assert.equal(getIndividualCalls, 0, 'No individual get() calls for candidate or analysis documents');
  });

  await t.test('Vector 27: Ranking không gọi put()', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t27');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    let putCalls = 0;
    const originalPut = fixture.repo.put.bind(fixture.repo);
    fixture.repo.put = async (doc) => {
      putCalls++;
      return originalPut(doc);
    };

    const service = createCandidateRankingService(fixture.repo);
    await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(putCalls, 0, 'Ranking must perform zero writes (put calls)');
  });

  await t.test('Vector 28: Application và Analysis stored documents không có field rank', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t28');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.rankedItems[0].rank, 1);
    assert.equal(result.rankedItems[0].application.rank, undefined);
    assert.equal(result.rankedItems[0].analysis.rank, undefined);

    const storedApp = await fixture.repo.get(appA._id);
    const storedAnalysis = await fixture.repo.get(analysisA._id);

    assert.equal(storedApp.rank, undefined);
    assert.equal(storedAnalysis.rank, undefined);
  });

  await t.test('Vector 29: Không mutate input documents', async () => {
    const fixture = createFixture();
    const candA = makeCandidateDoc('candidate:t29');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);

    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    const snapshotBefore = new Map(
      [...fixture.repo.docs.entries()].map(([k, v]) => [k, structuredClone(v)])
    );

    const service = createCandidateRankingService(fixture.repo);
    await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(fixture.repo.docs.size, snapshotBefore.size);
    for (const [id, docBefore] of snapshotBefore.entries()) {
      const docAfter = fixture.repo.docs.get(id);
      assert.deepEqual(docAfter, docBefore, `Document ${id} must not be mutated`);
    }
  });

  await t.test('Vector 30: Exclusion counts khớp chính xác tổng Applications', async () => {
    const fixture = createFixture();

    // 1. Valid ranked application
    const candA = makeCandidateDoc('candidate:t30_valid');
    const appA = makeApplicationDoc(candA._id, fixture.job._id);
    const analysisA = makeAnalysisDoc(appA, candA, fixture.job);
    await fixture.repo.put(candA);
    await fixture.repo.put(appA);
    await fixture.repo.put(analysisA);

    // 2. NOT_ANALYZED
    const candB = makeCandidateDoc('candidate:t30_no_analysis');
    const appB = makeApplicationDoc(candB._id, fixture.job._id);
    await fixture.repo.put(candB);
    await fixture.repo.put(appB);

    // 3. INCOMPLETE
    const candC = makeCandidateDoc('candidate:t30_incomplete');
    const appC = makeApplicationDoc(candC._id, fixture.job._id);
    const analysisC = makeAnalysisDoc(appC, candC, fixture.job);
    analysisC.analysis_status = 'INCOMPLETE';
    analysisC.scores.skill = null;
    delete analysisC.total_score;
    delete analysisC.recommendation;
    analysisC.missing_inputs = [{ component: 'skill', code: 'TEST', message: 'Incomplete' }];
    await fixture.repo.put(candC);
    await fixture.repo.put(appC);
    await fixture.repo.put(analysisC);

    // 4. STALE
    const candD = makeCandidateDoc('candidate:t30_stale', { skills: ['javascript'] });
    const appD = makeApplicationDoc(candD._id, fixture.job._id);
    const analysisD = makeAnalysisDoc(appD, candD, fixture.job);
    const savedCandD = await fixture.repo.put(candD);
    await fixture.repo.put(appD);
    await fixture.repo.put(analysisD);
    // Put updated candidate with different skills to invalidate fingerprint
    const updatedCandD = { ...candD, _rev: savedCandD._rev, skills: [{ name: 'JavaScript', normalized: 'javascript' }, { name: 'CouchDB', normalized: 'couchdb' }] };
    await fixture.repo.put(updatedCandD);

    // 5. INACTIVE_STAGE (HIRED)
    const candE = makeCandidateDoc('candidate:t30_hired');
    const appE = makeApplicationDoc(candE._id, fixture.job._id, { stage: APPLICATION_STAGES.HIRED });
    await fixture.repo.put(candE);
    await fixture.repo.put(appE);

    // 6. INVALID_ANALYSIS
    const candF = makeCandidateDoc('candidate:t30_bad_analysis');
    const appF = makeApplicationDoc(candF._id, fixture.job._id);
    const badAnalysisF = { _id: `analysis:${appF._id}`, type: 'broken_type' };
    await fixture.repo.put(candF);
    await fixture.repo.put(appF);
    await fixture.repo.put(badAnalysisF);

    // 7. REFERENCE_MISMATCH
    const candG = makeCandidateDoc('candidate:t30_ref_mismatch');
    const appG = makeApplicationDoc(candG._id, fixture.job._id);
    const analysisG = makeAnalysisDoc(appG, candG, fixture.job);
    analysisG.candidate_id = 'candidate:other_cand_wrong';
    await fixture.repo.put(candG);
    await fixture.repo.put(appG);
    await fixture.repo.put(analysisG);

    // 8. INVALID_CANDIDATE
    const candH = makeCandidateDoc('candidate:t30_broken_cand');
    const appH = makeApplicationDoc(candH._id, fixture.job._id);
    const analysisH = makeAnalysisDoc(appH, candH, fixture.job);
    await fixture.repo.put(appH);
    await fixture.repo.put(analysisH);
    // Put corrupted candidate
    await fixture.repo.put({ _id: candH._id, type: 'corrupted' });

    // 9. INVALID_APPLICATION (type application for selector, but empty stage_history)
    const brokenApp = {
      _id: `application:pair:${'f'.repeat(64)}`,
      type: 'application',
      job_id: fixture.job._id,
      candidate_id: 'candidate:t30_broken_app',
      current_stage: 'APPLIED',
      applied_at: baseTime,
      updated_at: baseTime,
      stage_history: [],
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'test-fixture',
      },
    };
    await fixture.repo.put(brokenApp);

    const service = createCandidateRankingService(fixture.repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 9, 'Total applications must equal 9');
    assert.equal(result.rankedItems.length, 1, 'Only 1 valid application ranked');
    assert.equal(result.exclusions.total, 8, '8 applications excluded');

    const sumByReason = Object.values(result.exclusions.byReason).reduce((sum, count) => sum + count, 0);
    assert.equal(sumByReason, result.exclusions.total, 'Sum of byReason counts must match exclusions.total');
    assert.equal(result.totalApplications, result.rankedItems.length + result.exclusions.total);

    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.NOT_ANALYZED], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INCOMPLETE], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.STALE], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INACTIVE_STAGE], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INVALID_ANALYSIS], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.REFERENCE_MISMATCH], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INVALID_CANDIDATE], 1);
    assert.equal(result.exclusions.byReason[RANKING_EXCLUSION_REASONS.INVALID_APPLICATION], 1);
  });
});

test('TV3-UC15-001-FIX-01: Pagination Integrity & Production Repository Contract', async (t) => {
  const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const testConfig = {
    url: 'http://couch.test:5984',
    database: 'isolated_test_db',
    authHeader: 'Basic test-auth',
  };

  await t.test('Vector FIX-01-01: JobApplicationRepository.allApplicationsForJob() đọc nhiều page bình thường, không thiếu hoặc trùng ID', async () => {
    const fixture = createFixture();
    const cand1 = makeCandidateDoc('candidate:fix_01_a');
    const app1 = makeApplicationDoc(cand1._id, fixture.job._id);
    const cand2 = makeCandidateDoc('candidate:fix_01_b');
    const app2 = makeApplicationDoc(cand2._id, fixture.job._id);
    const cand3 = makeCandidateDoc('candidate:fix_01_c');
    const app3 = makeApplicationDoc(cand3._id, fixture.job._id);

    const repo = new JobApplicationRepository(testConfig, async () => jsonResponse({}));
    let callIndex = 0;
    repo.find = async (selector, options) => {
      callIndex++;
      if (callIndex === 1) {
        assert.equal(options.bookmark, undefined);
        return { items: [app1, app2], bookmark: 'bm:page_1', has_more: true };
      }
      if (callIndex === 2) {
        assert.equal(options.bookmark, 'bm:page_1');
        // Overlap app2 to verify deduplication across pages
        return { items: [app2, app3], bookmark: 'bm:page_2', has_more: false };
      }
      throw new Error(`Unexpected find call: ${callIndex}`);
    };

    const apps = await repo.allApplicationsForJob(fixture.job._id, { pageSize: 2 });
    assert.equal(apps.length, 3, 'Should have 3 unique applications without duplicates');
    assert.deepEqual(
      apps.map((a) => a._id),
      [app1._id, app2._id, app3._id]
    );
  });

  await t.test('Vector FIX-01-02: Bookmark đứng yên trong khi has_more: true → controlled 503', async () => {
    const fixture = createFixture();
    const candidate = makeCandidateDoc('candidate:fix_01_stall_bm');
    const application = makeApplicationDoc(candidate._id, fixture.job._id);
    const analysis = makeAnalysisDoc(application, candidate, fixture.job);
    assert.ok(analysis);

    const repo = new JobApplicationRepository(testConfig, async () => jsonResponse({}));
    repo.find = async () => ({
      items: [application],
      bookmark: 'bookmark:same',
      has_more: true,
    });

    await assert.rejects(
      () => repo.allApplicationsForJob(fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'PAGINATION_CURSOR_UNAVAILABLE');
        return true;
      }
    );

    // Also test empty string bookmark
    repo.find = async () => ({
      items: [application],
      bookmark: '',
      has_more: true,
    });

    await assert.rejects(
      () => repo.allApplicationsForJob(fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'PAGINATION_CURSOR_UNAVAILABLE');
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-03: Page rỗng nhưng has_more: true → controlled 503', async () => {
    const fixture = createFixture();
    const candidate = makeCandidateDoc('candidate:fix_01_empty_page');
    const application = makeApplicationDoc(candidate._id, fixture.job._id);
    const analysis = makeAnalysisDoc(application, candidate, fixture.job);
    assert.ok(analysis);

    const repo = new JobApplicationRepository(testConfig, async () => jsonResponse({}));
    repo.find = async () => ({
      items: [],
      bookmark: 'bookmark:advanced',
      has_more: true,
    });

    await assert.rejects(
      () => repo.allApplicationsForJob(fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'PAGINATION_CURSOR_UNAVAILABLE');
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-04: Bookmark tiến lên nhưng page chỉ chứa ID đã đọc → controlled 503', async () => {
    const fixture = createFixture();
    const candidate = makeCandidateDoc('candidate:fix_01_loop_ids');
    const application = makeApplicationDoc(candidate._id, fixture.job._id);
    const analysis = makeAnalysisDoc(application, candidate, fixture.job);
    assert.ok(analysis);

    const repo = new JobApplicationRepository(testConfig, async () => jsonResponse({}));
    let step = 0;
    repo.find = async () => {
      step++;
      if (step === 1) {
        return {
          items: [application],
          bookmark: 'bookmark:step_1',
          has_more: true,
        };
      }
      return {
        items: [application],
        bookmark: 'bookmark:step_2',
        has_more: true,
      };
    };

    await assert.rejects(
      () => repo.allApplicationsForJob(fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'PAGINATION_CURSOR_UNAVAILABLE');
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-05: Constructor từ chối repository thiếu profile', () => {
    assert.throws(
      () =>
        new CandidateRankingService({
          get: async () => null,
          allApplicationsForJob: async () => [],
          getMany: async () => new Map(),
        }),
      (err) => {
        assert.ok(err.message.includes('profile'));
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-06: Constructor từ chối repository thiếu allApplicationsForJob', () => {
    assert.throws(
      () =>
        new CandidateRankingService({
          get: async () => null,
          profile: async () => ({}),
          getMany: async () => new Map(),
        }),
      (err) => {
        assert.ok(err.message.includes('allApplicationsForJob'));
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-07: Constructor từ chối repository thiếu getMany hoặc get', () => {
    assert.throws(
      () =>
        new CandidateRankingService({
          get: async () => null,
          profile: async () => ({}),
          allApplicationsForJob: async () => [],
        }),
      (err) => {
        assert.ok(err.message.includes('getMany'));
        return true;
      }
    );

    assert.throws(
      () =>
        new CandidateRankingService({
          profile: async () => ({}),
          allApplicationsForJob: async () => [],
          getMany: async () => new Map(),
        }),
      (err) => {
        assert.ok(err.message.includes('get(id)'));
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-08: Chứng minh không còn fallback find(...limit: 1000)', async () => {
    const fixture = createFixture();
    const cand = makeCandidateDoc('candidate:fix_01_nofind');
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);
    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    // Explicitly construct repo without any .find method
    const repoWithoutFind = {
      get: (id) => fixture.repo.get(id),
      profile: (type, userId) => fixture.repo.profile(type, userId),
      allApplicationsForJob: (jobId, opts) => fixture.repo.allApplicationsForJob(jobId, opts),
      getMany: (ids) => fixture.repo.getMany(ids),
    };
    assert.equal(repoWithoutFind.find, undefined, 'repo must not expose find');

    const service = new CandidateRankingService(repoWithoutFind);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);
    assert.equal(result.rankedItems.length, 1);
    assert.equal(result.rankedItems[0].application._id, app._id);
  });

  await t.test('Vector FIX-01-09: Chứng minh không còn fallback new Map()', async () => {
    const fixture = createFixture();
    const cand = makeCandidateDoc('candidate:fix_01_nogetmany');
    const app = makeApplicationDoc(cand._id, fixture.job._id);
    const analysis = makeAnalysisDoc(app, cand, fixture.job);
    await fixture.repo.put(cand);
    await fixture.repo.put(app);
    await fixture.repo.put(analysis);

    // Mock getMany returning null / non-Map
    const repoBadMap = {
      get: (id) => fixture.repo.get(id),
      profile: (type, userId) => fixture.repo.profile(type, userId),
      allApplicationsForJob: (jobId, opts) => fixture.repo.allApplicationsForJob(jobId, opts),
      getMany: async () => null,
    };

    const service = new CandidateRankingService(repoBadMap);
    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.recruiter, fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'DATABASE_UNAVAILABLE');
        return true;
      }
    );
  });

  await t.test('Vector FIX-01-10: Production getMany() deduplicate IDs, use _all_docs, filter deleted/missing, return Map', async () => {
    const capturedRequests = [];
    const repo = new JobApplicationRepository(testConfig, async (url, init) => {
      capturedRequests.push({ url, ...init });
      return jsonResponse({
        rows: [
          {
            id: 'candidate:fix_10_1',
            key: 'candidate:fix_10_1',
            value: { rev: '1-a' },
            doc: { _id: 'candidate:fix_10_1', type: 'candidate' },
          },
          {
            id: 'candidate:fix_10_missing',
            key: 'candidate:fix_10_missing',
            error: 'not_found',
          },
          {
            id: 'candidate:fix_10_deleted',
            key: 'candidate:fix_10_deleted',
            value: { rev: '2-b', deleted: true },
            doc: null,
          },
        ],
      });
    });

    const inputIds = [
      'candidate:fix_10_1',
      'candidate:fix_10_1', // Duplicate ID
      'candidate:fix_10_missing',
      'candidate:fix_10_deleted',
    ];

    const map = await repo.getMany(inputIds);

    // Check 1: Used _all_docs?include_docs=true via POST
    assert.equal(capturedRequests.length, 1);
    assert.ok(capturedRequests[0].url.endsWith('/_all_docs?include_docs=true'));
    assert.equal(capturedRequests[0].method, 'POST');

    // Check 2: Deduplicated input IDs in payload keys
    const body = JSON.parse(capturedRequests[0].body);
    assert.deepEqual(body.keys, [
      'candidate:fix_10_1',
      'candidate:fix_10_missing',
      'candidate:fix_10_deleted',
    ]);

    // Check 3: Missing and deleted rows omitted
    assert.ok(map instanceof Map);
    assert.equal(map.size, 1);
    assert.ok(map.has('candidate:fix_10_1'));
    assert.equal(map.get('candidate:fix_10_1')._id, 'candidate:fix_10_1');
    assert.equal(map.has('candidate:fix_10_missing'), false);
    assert.equal(map.has('candidate:fix_10_deleted'), false);
  });
});

test('TV3-UC15-001-FIX-02: Chặn empty ranking giả khi repository trả sai contract', async (t) => {
  await t.test('Vector FIX-02-01 & 03: allApplicationsForJob() trả null → 503 DATABASE_UNAVAILABLE và không gọi getMany()', async () => {
    const fixture = createFixture();
    let getManyCalled = false;
    const repo = {
      get: (id) => fixture.repo.get(id),
      profile: (type, userId) => fixture.repo.profile(type, userId),
      allApplicationsForJob: async () => null,
      getMany: async (ids) => {
        getManyCalled = true;
        return fixture.repo.getMany(ids);
      },
    };

    const service = new CandidateRankingService(repo);
    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.recruiter, fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'DATABASE_UNAVAILABLE');
        return true;
      }
    );
    assert.equal(getManyCalled, false, 'getMany() không được gọi khi allApplicationsForJob trả null');
  });

  await t.test('Vector FIX-02-02 & 03: allApplicationsForJob() trả object non-array → 503 DATABASE_UNAVAILABLE và không gọi getMany()', async () => {
    const fixture = createFixture();
    let getManyCalled = false;
    const repo = {
      get: (id) => fixture.repo.get(id),
      profile: (type, userId) => fixture.repo.profile(type, userId),
      allApplicationsForJob: async () => ({ status: 'error', items: [] }),
      getMany: async (ids) => {
        getManyCalled = true;
        return fixture.repo.getMany(ids);
      },
    };

    const service = new CandidateRankingService(repo);
    await assert.rejects(
      () => service.rankForRecruiter(fixture.users.recruiter, fixture.job._id),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'DATABASE_UNAVAILABLE');
        return true;
      }
    );
    assert.equal(getManyCalled, false, 'getMany() không được gọi khi allApplicationsForJob trả non-array object');
  });

  await t.test('Vector FIX-02-04: allApplicationsForJob() trả [] → response empty hợp lệ', async () => {
    const fixture = createFixture();
    const candidate = makeCandidateDoc('candidate:fix_02');
    const application = makeApplicationDoc(candidate._id, fixture.job._id);
    assert.ok(application);

    let getManyCalled = false;
    const repo = {
      get: (id) => fixture.repo.get(id),
      profile: (type, userId) => fixture.repo.profile(type, userId),
      allApplicationsForJob: async () => [],
      getMany: async (ids) => {
        getManyCalled = true;
        return fixture.repo.getMany(ids);
      },
    };

    const service = new CandidateRankingService(repo);
    const result = await service.rankForRecruiter(fixture.users.recruiter, fixture.job._id);

    assert.equal(result.totalApplications, 0);
    assert.deepEqual(result.rankedItems, []);
    assert.deepEqual(result.exclusions, {
      total: 0,
      byReason: {},
    });
    assert.equal(getManyCalled, false, 'getMany() không được gọi khi job không có application nào');
  });
});
