/**
 * TV3-UC22-001: Runtime Resume Scoring Service Unit & Acceptance Test Suite
 * 
 * Verifies all 17 mandatory test vectors for runtime scoring:
 *  1. Tạo thành công analysis COMPLETE.
 *  2. Tạo và persist analysis INCOMPLETE.
 *  3. INCOMPLETE không có total_score và recommendation.
 *  4. Recompute cập nhật cùng deterministic document, không tạo document thứ hai.
 *  5. Existing analysis sử dụng _rev mới nhất.
 *  6. Cùng scoring input tạo cùng fingerprint.
 *  7. Candidate scoring input thay đổi làm fingerprint thay đổi.
 *  8. Job scoring input thay đổi làm fingerprint thay đổi.
 *  9. Application invalid bị chặn trước scoring và trước write.
 * 10. Candidate invalid bị chặn trước scoring và trước write.
 * 11. Job invalid bị chặn trước scoring và trước write.
 * 12. Thiếu reference không tạo analysis.
 * 13. Reference mismatch không tạo analysis.
 * 14. 409 lần đầu kích hoạt fresh read, re-evaluation và một lần retry.
 * 15. 409 lần thứ hai trả controlled conflict.
 * 16. Conflict retry không ghi bằng stale revision.
 * 17. Các input document không bị mutate.
 * 
 * Additional checks:
 * - Wrong document types rejected with 400.
 * - Injected clock used in analyzed_at.
 * - Zero CouchDB mutations to real database (in-memory repository only).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, baseTime, MemoryRepository } from './fixtures.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';
import { ResumeScoringService, createResumeScoringService } from '../../src/services/scoring/resume-scoring.service.js';
import { SCORING_ALGORITHM_VERSION } from '../../src/schemas/resume-analysis.schema.js';

function createCompleteCandidate(baseCandidate) {
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
        institution: 'Đại học Khoa học Tự nhiên',
        field_of_study: 'Công nghệ thông tin',
      },
    ],
    experience: [
      {
        employer: 'Công ty Công nghệ',
        role: 'Backend Engineer',
        start_date: '2022-01-01',
        end_date: '2024-01-01',
      },
    ],
    projects: [
      {
        name: 'Hệ thống tuyển dụng NoSQL',
        description: 'Xây dựng core backend',
        technologies: ['javascript', 'couchdb'],
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

function createCompleteJob(baseJob) {
  return {
    ...structuredClone(baseJob),
    required_skills: ['javascript', 'couchdb'],
    optional_skills: ['docker'],
    requirements: {
      general: ['Kỹ năng giải quyết vấn đề'],
      experience: { status: 'REQUIRED', required_months: 24 },
      education: { status: 'REQUIRED', minimum_degree: 'BACHELOR' },
      project: { status: 'REQUIRED', required_technologies: ['javascript'] },
    },
  };
}

function createApplicationDoc(candidateId, jobId, timestamp = baseTime) {
  const id = applicationIdFromPair(candidateId, jobId);
  return {
    _id: id,
    type: 'application',
    candidate_id: candidateId,
    job_id: jobId,
    current_stage: 'APPLIED',
    applied_at: timestamp,
    updated_at: timestamp,
    submission: {
      resume_text: 'Kỹ sư backend có kinh nghiệm với JavaScript và CouchDB.',
    },
    stage_history: [
      {
        from_stage: null,
        to_stage: 'APPLIED',
        timestamp,
        actor_role: 'CANDIDATE',
      },
    ],
    provenance: {
      classification: 'derived',
      generated: false,
      transform_version: 'test-fixture',
    },
  };
}

function setupTestEnvironment() {
  const f = createFixture();
  const completeCandidate = createCompleteCandidate(f.candidate);
  const completeJob = createCompleteJob(f.job);
  const application = createApplicationDoc(completeCandidate._id, completeJob._id);

  f.repo.docs.set(completeCandidate._id, { ...completeCandidate, _rev: '1-fixture' });
  f.repo.docs.set(completeJob._id, { ...completeJob, _rev: '1-fixture' });
  f.repo.docs.set(application._id, { ...application, _rev: '1-fixture' });

  const service = new ResumeScoringService(f.repo, { now: f.now });
  return { ...f, completeCandidate, completeJob, application, service };
}

test('Vector 01: Tạo thành công analysis COMPLETE', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const result = await env.service.analyzeApplication(appId);

  // Deterministic ID & type
  assert.equal(result._id, `analysis:${appId}`);
  assert.equal(result.type, 'resume_analysis');
  assert.equal(result.application_id, appId);
  assert.equal(result.candidate_id, env.completeCandidate._id);
  assert.equal(result.job_id, env.completeJob._id);

  // COMPLETE invariants
  assert.equal(result.analysis_status, 'COMPLETE');
  assert.equal(typeof result.total_score, 'number');
  assert.ok(result.total_score >= 0 && result.total_score <= 100);
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(result.recommendation));
  assert.deepEqual(result.missing_inputs, []);

  // Component numeric scores
  assert.equal(typeof result.scores.skill, 'number');
  assert.equal(typeof result.scores.experience, 'number');
  assert.equal(typeof result.scores.education, 'number');
  assert.equal(typeof result.scores.project, 'number');
  assert.equal(result.algorithm_version, SCORING_ALGORITHM_VERSION);
  assert.match(result.input_fingerprint, /^[a-f0-9]{64}$/);

  // Verified persistence
  const stored = await env.repo.get(result._id);
  assert.ok(stored);
  assert.equal(stored._id, result._id);
  assert.equal(stored.analysis_status, 'COMPLETE');
  assert.equal(stored.total_score, result.total_score);
});

test('Vector 02 & 03: Tạo và persist analysis INCOMPLETE không có total_score và recommendation', async () => {
  const env = setupTestEnvironment();
  // Set candidate education to UNAVAILABLE
  const incompleteCandidate = {
    ...env.completeCandidate,
    education: [],
    data_availability: {
      ...env.completeCandidate.data_availability,
      education: 'UNAVAILABLE',
    },
  };
  env.repo.docs.set(incompleteCandidate._id, { ...incompleteCandidate, _rev: '2-fixture' });

  const result = await env.service.analyzeApplication(env.application._id);

  // Status & Missing inputs
  assert.equal(result.analysis_status, 'INCOMPLETE');
  assert.equal(result.total_score, undefined);
  assert.equal(result.recommendation, undefined);
  assert.equal(result.scores.education, null);
  assert.ok(result.missing_inputs.length > 0);
  assert.ok(result.missing_inputs.some(m => m.component === 'education'));

  // Persisted in repo correctly
  const stored = await env.repo.get(result._id);
  assert.ok(stored);
  assert.equal(stored.analysis_status, 'INCOMPLETE');
  assert.equal(stored.total_score, undefined);
  assert.equal(stored.recommendation, undefined);
  assert.equal(stored.scores.education, null);
});

test('Vector 04: Recompute cập nhật cùng deterministic document, không tạo document thứ hai', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const firstRun = await env.service.analyzeApplication(appId);
  const secondRun = await env.service.analyzeApplication(appId);

  assert.equal(firstRun._id, secondRun._id);
  assert.equal(firstRun._id, `analysis:${appId}`);

  // Count how many analysis documents exist for this application
  const allAnalysisDocs = [...env.repo.docs.values()].filter(d => d.type === 'resume_analysis');
  assert.equal(allAnalysisDocs.length, 1);
  assert.equal(allAnalysisDocs[0]._id, `analysis:${appId}`);
});

test('Vector 05: Existing analysis sử dụng _rev mới nhất', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const first = await env.service.analyzeApplication(appId);
  assert.equal(first._rev, '1-fixture');

  const second = await env.service.analyzeApplication(appId);
  assert.equal(second._rev, '2-fixture');

  // Verify write history recorded expected revision
  const lastWrite = env.repo.writes.at(-1);
  assert.equal(lastWrite._id, `analysis:${appId}`);
  assert.equal(lastWrite._rev, '2-fixture');
});

test('Vector 06: Cùng scoring input tạo cùng fingerprint', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const first = await env.service.analyzeApplication(appId);
  const second = await env.service.analyzeApplication(appId);

  assert.equal(first.input_fingerprint, second.input_fingerprint);
});

test('Vector 07: Candidate scoring input thay đổi làm fingerprint thay đổi', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const initial = await env.service.analyzeApplication(appId);

  // Update candidate profile experience
  const updatedCandidate = {
    ...env.completeCandidate,
    profile: {
      ...env.completeCandidate.profile,
      years_experience: 5,
      experience_months: 60,
    },
    updated_at: new Date(Date.parse(baseTime) + 1000).toISOString(),
  };
  env.repo.docs.set(updatedCandidate._id, { ...updatedCandidate, _rev: '2-fixture' });

  const updated = await env.service.analyzeApplication(appId);
  assert.notEqual(initial.input_fingerprint, updated.input_fingerprint);
});

test('Vector 08: Job scoring input thay đổi làm fingerprint thay đổi', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const initial = await env.service.analyzeApplication(appId);

  // Update job requirements
  const updatedJob = {
    ...env.completeJob,
    requirements: {
      ...env.completeJob.requirements,
      experience: { status: 'REQUIRED', required_months: 60 },
    },
    updated_at: new Date(Date.parse(baseTime) + 1000).toISOString(),
  };
  env.repo.docs.set(updatedJob._id, { ...updatedJob, _rev: '2-fixture' });

  const updated = await env.service.analyzeApplication(appId);
  assert.notEqual(initial.input_fingerprint, updated.input_fingerprint);
});

test('Vector 09: Application invalid bị chặn trước scoring và trước write', async () => {
  const env = setupTestEnvironment();
  const writesBefore = env.repo.writes.length;

  // Corrupt application document (invalid current_stage)
  env.repo.docs.get(env.application._id).current_stage = 'INVALID_STAGE';

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'INVALID_STORED_DOCUMENT'
  );

  // No write occurred
  assert.equal(env.repo.writes.length, writesBefore);
});

test('Vector 10: Candidate invalid bị chặn trước scoring và trước write', async () => {
  const env = setupTestEnvironment();
  const writesBefore = env.repo.writes.length;

  // Corrupt candidate document (experience_months mismatch)
  env.repo.docs.get(env.completeCandidate._id).profile.experience_months = 999;

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'INVALID_STORED_DOCUMENT'
  );

  assert.equal(env.repo.writes.length, writesBefore);
});

test('Vector 11: Job invalid bị chặn trước scoring và trước write', async () => {
  const env = setupTestEnvironment();
  const writesBefore = env.repo.writes.length;

  // Corrupt job document (empty required_skills array)
  env.repo.docs.get(env.completeJob._id).required_skills = [];

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'INVALID_STORED_DOCUMENT'
  );

  assert.equal(env.repo.writes.length, writesBefore);
});

test('Vector 12: Thiếu reference không tạo analysis', async () => {
  // 1. Candidate missing
  const env1 = setupTestEnvironment();
  env1.repo.docs.delete(env1.completeCandidate._id);
  const writes1 = env1.repo.writes.length;
  await assert.rejects(
    env1.service.analyzeApplication(env1.application._id),
    error => error.status === 404 && error.code === 'CANDIDATE_NOT_FOUND'
  );
  assert.equal(env1.repo.writes.length, writes1);

  // 2. Job missing
  const env2 = setupTestEnvironment();
  env2.repo.docs.delete(env2.completeJob._id);
  const writes2 = env2.repo.writes.length;
  await assert.rejects(
    env2.service.analyzeApplication(env2.application._id),
    error => error.status === 404 && error.code === 'JOB_NOT_FOUND'
  );
  assert.equal(env2.repo.writes.length, writes2);

  // 3. Application missing
  const env3 = setupTestEnvironment();
  env3.repo.docs.delete(env3.application._id);
  const writes3 = env3.repo.writes.length;
  await assert.rejects(
    env3.service.analyzeApplication(env3.application._id),
    error => error.status === 404 && error.code === 'APPLICATION_NOT_FOUND'
  );
  assert.equal(env3.repo.writes.length, writes3);
});

test('Vector 13: Reference mismatch không tạo analysis', async () => {
  // 1. Candidate mismatch
  const env1 = setupTestEnvironment();
  const altCandidate = {
    ...env1.completeCandidate,
    _id: 'candidate:mismatched',
  };
  env1.repo.docs.delete(env1.completeCandidate._id);
  env1.repo.docs.set(altCandidate._id, altCandidate);
  const writes1 = env1.repo.writes.length;

  await assert.rejects(
    env1.service.analyzeApplication(env1.application._id),
    error => error.status === 404 && error.code === 'CANDIDATE_NOT_FOUND'
  );
  assert.equal(env1.repo.writes.length, writes1);

  // 2. Candidate ID mismatch where document exists under key but has wrong _id
  const env2 = setupTestEnvironment();
  const mismatchedCandidate = { ...env2.completeCandidate, _id: 'candidate:divergent' };
  env2.repo.docs.set(env2.completeCandidate._id, mismatchedCandidate);
  const writes2 = env2.repo.writes.length;

  await assert.rejects(
    env2.service.analyzeApplication(env2.application._id),
    error => error.status === 409 && error.code === 'REFERENCE_MISMATCH'
  );
  assert.equal(env2.repo.writes.length, writes2);

  // 3. Job ID mismatch where document exists under key but has wrong _id
  const env3 = setupTestEnvironment();
  const mismatchedJob = { ...env3.completeJob, _id: 'job:divergent' };
  env3.repo.docs.set(env3.completeJob._id, mismatchedJob);
  const writes3 = env3.repo.writes.length;

  await assert.rejects(
    env3.service.analyzeApplication(env3.application._id),
    error => error.status === 409 && error.code === 'REFERENCE_MISMATCH'
  );
  assert.equal(env3.repo.writes.length, writes3);
});

test('Vector 14: 409 lần đầu kích hoạt fresh read, re-evaluation và một lần retry', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  // Seed an existing analysis at revision 1-fixture
  const initial = await env.service.analyzeApplication(appId);
  assert.equal(initial._rev, '1-fixture');

  let putAttempts = 0;
  const originalPut = env.repo.put.bind(env.repo);

  // Simulate concurrent write by another actor before our put:
  // On our first put call, someone else has updated repo.docs to 2-fixture.
  env.repo.put = async (doc) => {
    putAttempts++;
    if (putAttempts === 1) {
      // Simulate concurrent update on analysis document
      const current = env.repo.docs.get(analysisId);
      current._rev = '2-fixture';
      // Now attempt put with stale revision -> triggers 409
      return originalPut(doc);
    }
    return originalPut(doc);
  };

  const result = await env.service.analyzeApplication(appId);

  // Retry succeeded: 2 put attempts were made
  assert.equal(putAttempts, 2);
  assert.equal(result._rev, '3-fixture');
  assert.equal(result._id, analysisId);
});

test('Vector 15: 409 lần thứ hai trả controlled conflict', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  // Seed existing analysis
  await env.service.analyzeApplication(appId);

  let putAttempts = 0;
  const originalPut = env.repo.put.bind(env.repo);

  // Always simulate a conflict on put
  env.repo.put = async (doc) => {
    putAttempts++;
    const current = env.repo.docs.get(analysisId);
    current._rev = `${Number(current._rev.split('-')[0]) + 1}-fixture`;
    return originalPut(doc);
  };

  await assert.rejects(
    env.service.analyzeApplication(appId),
    error => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'CONFLICT');
      assert.match(error.message, /Xung đột phiên bản/);
      return true;
    }
  );

  // Stopped after 1 retry (exactly 2 attempts total)
  assert.equal(putAttempts, 2);
});

test('Vector 16: Conflict retry không ghi bằng stale revision', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  await env.service.analyzeApplication(appId); // Rev 1-fixture

  const putRevisions = [];
  const originalPut = env.repo.put.bind(env.repo);

  env.repo.put = async (doc) => {
    putRevisions.push(doc._rev);
    if (putRevisions.length === 1) {
      // Stale write triggered by external advance to 2-fixture
      const current = env.repo.docs.get(analysisId);
      current._rev = '2-fixture';
      return originalPut(doc);
    }
    return originalPut(doc);
  };

  const result = await env.service.analyzeApplication(appId);

  assert.equal(putRevisions.length, 2);
  assert.equal(putRevisions[0], '1-fixture'); // First attempt used initial rev
  assert.equal(putRevisions[1], '2-fixture'); // Retry used fresh rev from re-read, NOT stale 1-fixture
  assert.equal(result._rev, '3-fixture');
});

test('Vector 17: Các input document không bị mutate', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;

  const appBefore = structuredClone(await env.repo.get(appId));
  const candidateBefore = structuredClone(await env.repo.get(env.completeCandidate._id));
  const jobBefore = structuredClone(await env.repo.get(env.completeJob._id));

  // Freeze input objects to guarantee runtime immutability
  Object.freeze(appBefore);
  Object.freeze(candidateBefore);
  Object.freeze(jobBefore);

  await env.service.analyzeApplication(appId);

  const appAfter = await env.repo.get(appId);
  const candidateAfter = await env.repo.get(env.completeCandidate._id);
  const jobAfter = await env.repo.get(env.completeJob._id);

  assert.deepEqual(appAfter, appBefore);
  assert.deepEqual(candidateAfter, candidateBefore);
  assert.deepEqual(jobAfter, jobBefore);
});

test('Controlled error: Document có sai type bị từ chối với 400', async () => {
  // Application wrong type
  const env1 = setupTestEnvironment();
  env1.repo.docs.get(env1.application._id).type = 'not_application';
  await assert.rejects(
    env1.service.analyzeApplication(env1.application._id),
    error => error.status === 400 && error.code === 'INVALID_DOCUMENT_TYPE'
  );

  // Candidate wrong type
  const env2 = setupTestEnvironment();
  env2.repo.docs.get(env2.completeCandidate._id).type = 'not_candidate';
  await assert.rejects(
    env2.service.analyzeApplication(env2.application._id),
    error => error.status === 400 && error.code === 'INVALID_DOCUMENT_TYPE'
  );

  // Job wrong type
  const env3 = setupTestEnvironment();
  env3.repo.docs.get(env3.completeJob._id).type = 'not_job';
  await assert.rejects(
    env3.service.analyzeApplication(env3.application._id),
    error => error.status === 400 && error.code === 'INVALID_DOCUMENT_TYPE'
  );
});

test('Controlled error: Invalid application ID parameter bị từ chối với 400', async () => {
  const env = setupTestEnvironment();

  await assert.rejects(
    env.service.analyzeApplication(''),
    error => error.status === 400 && error.code === 'INVALID_APPLICATION_ID'
  );

  await assert.rejects(
    env.service.analyzeApplication(null),
    error => error.status === 400 && error.code === 'INVALID_APPLICATION_ID'
  );
});

test('Dependency Injection: Injected clock được sử dụng trong analyzed_at', async () => {
  const f = createFixture();
  const completeCandidate = createCompleteCandidate(f.candidate);
  const completeJob = createCompleteJob(f.job);
  const application = createApplicationDoc(completeCandidate._id, completeJob._id);

  f.repo.docs.set(completeCandidate._id, { ...completeCandidate, _rev: '1-fixture' });
  f.repo.docs.set(completeJob._id, { ...completeJob, _rev: '1-fixture' });
  f.repo.docs.set(application._id, { ...application, _rev: '1-fixture' });

  const customTime = '2026-10-25T15:30:00.000Z';
  const customClock = () => new Date(customTime);

  const service = createResumeScoringService(f.repo, { now: customClock });
  const result = await service.analyzeApplication(application._id);

  assert.equal(result.analyzed_at, customTime);
});

test('REVIEW-01: Existing analysis sai type bị từ chối với 409 CONFLICT và không có write', async () => {
  const env = setupTestEnvironment();
  const analysisId = `analysis:${env.application._id}`;

  env.repo.docs.set(analysisId, {
    _id: analysisId,
    type: 'wrong_document_type',
    _rev: '1-fixture',
  });

  const writesBefore = env.repo.writes.length;

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'CONFLICT'
  );

  assert.equal(env.repo.writes.length, writesBefore);
});

test('REVIEW-02: Existing analysis hỏng schema bị từ chối với 409 INVALID_STORED_DOCUMENT và không có write', async () => {
  const env = setupTestEnvironment();
  const analysisId = `analysis:${env.application._id}`;

  // Pre-seed an analysis with corrupted schema (invalid score type)
  env.repo.docs.set(analysisId, {
    _id: analysisId,
    type: 'resume_analysis',
    application_id: env.application._id,
    candidate_id: env.completeCandidate._id,
    job_id: env.completeJob._id,
    analysis_status: 'COMPLETE',
    scores: {
      skill: 'not_a_number',
      experience: 100,
      education: 100,
      project: 100,
    },
    matched_skills: [],
    missing_skills: [],
    component_details: {},
    missing_inputs: [],
    algorithm_version: SCORING_ALGORITHM_VERSION,
    input_fingerprint: 'a'.repeat(64),
    analyzed_at: baseTime,
    provenance: { classification: 'derived' },
    _rev: '1-fixture',
  });

  const writesBefore = env.repo.writes.length;

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'INVALID_STORED_DOCUMENT'
  );

  assert.equal(env.repo.writes.length, writesBefore);
});

test('REVIEW-03: Existing analysis có candidate_id sai bị từ chối với 409 REFERENCE_MISMATCH và không có write', async () => {
  const env = setupTestEnvironment();
  const analysisId = `analysis:${env.application._id}`;

  // Valid analysis document but pointing to mismatched candidate
  const initial = await env.service.analyzeApplication(env.application._id);
  const mismatchedCandidateAnalysis = {
    ...structuredClone(initial),
    candidate_id: 'candidate:cms:R_999999',
    _rev: '1-fixture',
  };
  env.repo.docs.set(analysisId, mismatchedCandidateAnalysis);

  const writesBefore = env.repo.writes.length;

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'REFERENCE_MISMATCH'
  );

  assert.equal(env.repo.writes.length, writesBefore);
});

test('REVIEW-04: Existing analysis có job_id sai bị từ chối với 409 REFERENCE_MISMATCH và không có write', async () => {
  const env = setupTestEnvironment();
  const analysisId = `analysis:${env.application._id}`;

  const initial = await env.service.analyzeApplication(env.application._id);
  const mismatchedJobAnalysis = {
    ...structuredClone(initial),
    job_id: 'job:cms:J_999999',
    _rev: '1-fixture',
  };
  env.repo.docs.set(analysisId, mismatchedJobAnalysis);

  const writesBefore = env.repo.writes.length;

  await assert.rejects(
    env.service.analyzeApplication(env.application._id),
    error => error.status === 409 && error.code === 'REFERENCE_MISMATCH'
  );

  assert.equal(env.repo.writes.length, writesBefore);
});

test('REVIEW-05: Legacy analysis hợp lệ, thiếu toàn bộ input_context, được recompute thành công', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  // Initial computation
  const initial = await env.service.analyzeApplication(appId);

  // Strip all 4 input_context fields to represent a schema-valid legacy analysis
  const legacyAnalysis = structuredClone(initial);
  delete legacyAnalysis.component_details.skill.input_context;
  delete legacyAnalysis.component_details.experience.input_context;
  delete legacyAnalysis.component_details.education.input_context;
  delete legacyAnalysis.component_details.project.input_context;
  legacyAnalysis._rev = '1-legacy';
  env.repo.docs.set(analysisId, legacyAnalysis);

  // Recompute
  const recomputed = await env.service.analyzeApplication(appId);

  // Assert recompute succeeded, updated same document and incremented revision
  assert.equal(recomputed._id, analysisId);
  assert.equal(recomputed._rev, '2-fixture');

  // New analysis has all 4 input_contexts fully populated
  assert.ok(recomputed.component_details.skill.input_context);
  assert.ok(recomputed.component_details.experience.input_context);
  assert.ok(recomputed.component_details.education.input_context);
  assert.ok(recomputed.component_details.project.input_context);
});

test('REVIEW-06: Sau conflict lần đầu, concurrent analysis sai type không bị overwrite', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  await env.service.analyzeApplication(appId); // Rev 1-fixture

  let putCount = 0;
  const originalPut = env.repo.put.bind(env.repo);

  env.repo.put = async (doc) => {
    putCount++;
    if (putCount === 1) {
      // Simulate concurrent writer placing wrong type document at analysisId
      env.repo.docs.set(analysisId, {
        _id: analysisId,
        type: 'corrupted_foreign_type',
        _rev: '2-fixture',
      });
      // Stale put will fail with 409
      return originalPut(doc);
    }
    return originalPut(doc);
  };

  await assert.rejects(
    env.service.analyzeApplication(appId),
    error => error.status === 409 && error.code === 'CONFLICT'
  );

  // Verify concurrent document was not overwritten
  assert.equal(env.repo.docs.get(analysisId).type, 'corrupted_foreign_type');
});

test('REVIEW-07: Sau conflict lần đầu, concurrent analysis hỏng schema không bị overwrite', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  const initial = await env.service.analyzeApplication(appId);

  let putCount = 0;
  const originalPut = env.repo.put.bind(env.repo);

  env.repo.put = async (doc) => {
    putCount++;
    if (putCount === 1) {
      // Corrupt schema concurrently
      const corrupted = structuredClone(initial);
      corrupted._rev = '2-fixture';
      corrupted.algorithm_version = 'unapproved_v999';
      env.repo.docs.set(analysisId, corrupted);
      return originalPut(doc);
    }
    return originalPut(doc);
  };

  await assert.rejects(
    env.service.analyzeApplication(appId),
    error => error.status === 409 && error.code === 'INVALID_STORED_DOCUMENT'
  );

  // Verify corrupted document was not overwritten
  assert.equal(env.repo.docs.get(analysisId).algorithm_version, 'unapproved_v999');
});

test('REVIEW-08: Sau conflict lần đầu, concurrent analysis sai reference không bị overwrite', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  const initial = await env.service.analyzeApplication(appId);

  let putCount = 0;
  const originalPut = env.repo.put.bind(env.repo);

  env.repo.put = async (doc) => {
    putCount++;
    if (putCount === 1) {
      // Mismatch candidate_id concurrently
      const mismatched = structuredClone(initial);
      mismatched._rev = '2-fixture';
      mismatched.candidate_id = 'candidate:cms:R_000999';
      env.repo.docs.set(analysisId, mismatched);
      return originalPut(doc);
    }
    return originalPut(doc);
  };

  await assert.rejects(
    env.service.analyzeApplication(appId),
    error => error.status === 409 && error.code === 'REFERENCE_MISMATCH'
  );

  // Verify mismatched document was not overwritten
  assert.equal(env.repo.docs.get(analysisId).candidate_id, 'candidate:cms:R_000999');
});

test('REVIEW-09: Conflict retry với existing analysis hợp lệ vẫn sử dụng _rev mới nhất và PASS', async () => {
  const env = setupTestEnvironment();
  const appId = env.application._id;
  const analysisId = `analysis:${appId}`;

  const initial = await env.service.analyzeApplication(appId); // 1-fixture

  let putCount = 0;
  const originalPut = env.repo.put.bind(env.repo);

  env.repo.put = async (doc) => {
    putCount++;
    if (putCount === 1) {
      // Advance to 2-fixture concurrently with valid analysis
      const updated = structuredClone(initial);
      updated._rev = '2-fixture';
      env.repo.docs.set(analysisId, updated);
      return originalPut(doc);
    }
    return originalPut(doc);
  };

  const result = await env.service.analyzeApplication(appId);

  assert.equal(putCount, 2);
  assert.equal(result._rev, '3-fixture');
  assert.equal(result._id, analysisId);
});
