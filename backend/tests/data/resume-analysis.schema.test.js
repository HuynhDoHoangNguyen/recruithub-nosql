/**
 * Unit tests for DATA-03.4A: Resume Analysis Document Schema (Zod Validation)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resumeAnalysisDocumentSchema,
  SCORING_ALGORITHM_VERSION,
  ANALYSIS_STATUSES,
  RECOMMENDATION_LEVELS,
} from '../../src/schemas/resume-analysis.schema.js';
import {
  DOCUMENT_TYPES,
} from '../../src/constants/document.constants.js';

/**
 * Fixture generator for a valid COMPLETE resume_analysis document
 */
function createValidCompleteAnalysisFixture(overrides = {}) {
  const applicationId = 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const _id = `analysis:${applicationId}`;

  return {
    _id,
    type: DOCUMENT_TYPES.RESUME_ANALYSIS,
    application_id: applicationId,
    candidate_id: 'candidate:cms:R_000001',
    job_id: 'job:cms:J_000001',
    analysis_status: ANALYSIS_STATUSES.COMPLETE,
    scores: {
      skill: 100,
      experience: 80,
      education: 100,
      project: 100,
    },
    matched_skills: ['python', 'sql'],
    missing_skills: [],
    component_details: {
      skill: {
        formula_id: 'SKILL-COV',
        matched_count: 2,
        required_count: 2,
        matched_skills: ['python', 'sql'],
        missing_skills: [],
        unrounded_score: 100,
      },
      experience: {
        formula_id: 'EXP-A',
        candidate_months: 40,
        required_months: 50,
        requirement_status: 'REQUIRED',
        unrounded_score: 80,
      },
      education: {
        formula_id: 'EDU-B',
        candidate_degree: 'MASTER',
        candidate_rank: 3,
        minimum_degree: 'BACHELOR',
        minimum_rank: 2,
        requirement_status: 'REQUIRED',
        unrounded_score: 100,
      },
      project: {
        formula_id: 'PROJ-A',
        candidate_technologies: ['node.js'],
        required_technologies: ['node.js'],
        matched_technologies: ['node.js'],
        missing_technologies: [],
        requirement_status: 'REQUIRED',
        unrounded_score: 100,
      },
    },
    missing_inputs: [],
    // 0.50*100 + 0.25*80 + 0.10*100 + 0.15*100 = 50 + 20 + 10 + 15 = 95
    total_score: 95.0,
    recommendation: RECOMMENDATION_LEVELS.HIGH,
    algorithm_version: SCORING_ALGORITHM_VERSION,
    input_fingerprint: '1111111111111111111111111111111111111111111111111111111111111111',
    analyzed_at: '2026-10-22T10:00:00Z',
    provenance: {
      classification: 'derived',
      generator_version: SCORING_ALGORITHM_VERSION,
    },
    ...overrides,
  };
}

/**
 * Fixture generator for a valid INCOMPLETE resume_analysis document
 */
function createValidIncompleteAnalysisFixture(overrides = {}) {
  const applicationId = 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const _id = `analysis:${applicationId}`;

  return {
    _id,
    type: DOCUMENT_TYPES.RESUME_ANALYSIS,
    application_id: applicationId,
    candidate_id: 'candidate:cms:R_000001',
    job_id: 'job:cms:J_000001',
    analysis_status: ANALYSIS_STATUSES.INCOMPLETE,
    scores: {
      skill: 100,
      experience: null, // missing!
      education: 100,
      project: null, // missing!
    },
    matched_skills: ['python'],
    missing_skills: [],
    component_details: {
      skill: {
        formula_id: 'SKILL-COV',
        matched_count: 1,
        required_count: 1,
        matched_skills: ['python'],
        missing_skills: [],
        unrounded_score: 100,
      },
      experience: {
        formula_id: 'EXP-A',
        candidate_months: 24,
        required_months: null,
        requirement_status: 'UNAVAILABLE',
        unrounded_score: null,
      },
      education: {
        formula_id: 'EDU-B',
        candidate_degree: 'BACHELOR',
        candidate_rank: 2,
        minimum_degree: null,
        minimum_rank: null,
        requirement_status: 'NO_MINIMUM',
        unrounded_score: 100,
      },
      project: {
        formula_id: 'PROJ-A',
        candidate_technologies: [],
        required_technologies: [],
        matched_technologies: [],
        missing_technologies: [],
        requirement_status: 'UNAVAILABLE',
        unrounded_score: null,
      },
    },
    missing_inputs: [
      {
        component: 'experience',
        code: 'MISSING_JOB_EXPERIENCE_REQUIREMENT',
        message: 'Job experience requirement is UNAVAILABLE',
      },
      {
        component: 'project',
        code: 'MISSING_JOB_PROJECT_REQUIREMENT',
        message: 'Job project requirement is UNAVAILABLE',
      },
    ],
    algorithm_version: SCORING_ALGORITHM_VERSION,
    input_fingerprint: '2222222222222222222222222222222222222222222222222222222222222222',
    analyzed_at: '2026-10-22T10:00:00Z',
    provenance: {
      classification: 'derived',
      generator_version: SCORING_ALGORITHM_VERSION,
    },
    ...overrides,
  };
}

test('DATA-03.4A: Resume Analysis Schema Acceptance Tests', async (t) => {
  await t.test('1. Valid COMPLETE analysis passes schema validation', () => {
    const fixture = createValidCompleteAnalysisFixture();
    const result = resumeAnalysisDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('2. Valid INCOMPLETE analysis passes schema validation', () => {
    const fixture = createValidIncompleteAnalysisFixture();
    const result = resumeAnalysisDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('3. _id mismatch with analysis:<application_id> is rejected', () => {
    const badId = createValidCompleteAnalysisFixture({
      _id: 'analysis:application:pair:0000000000000000000000000000000000000000000000000000000000000000',
    });
    const result = resumeAnalysisDocumentSchema.safeParse(badId);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /must equal/);
  });

  await t.test('4. COMPLETE analysis missing any component score is rejected', () => {
    const missingScore = createValidCompleteAnalysisFixture({
      scores: {
        skill: 100,
        experience: null, // Error!
        education: 100,
        project: 100,
      },
    });
    const result = resumeAnalysisDocumentSchema.safeParse(missingScore);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /COMPLETE analysis must have non-null numeric scores/);
  });

  await t.test('5. COMPLETE analysis missing total_score or recommendation is rejected', () => {
    const noTotal = createValidCompleteAnalysisFixture({
      total_score: undefined,
    });
    assert.equal(resumeAnalysisDocumentSchema.safeParse(noTotal).success, false);

    const noRec = createValidCompleteAnalysisFixture({
      recommendation: undefined,
    });
    assert.equal(resumeAnalysisDocumentSchema.safeParse(noRec).success, false);
  });

  await t.test('6. COMPLETE analysis with mismatched total_score is rejected', () => {
    const badTotal = createValidCompleteAnalysisFixture({
      total_score: 50.0, // Should be 95.0
    });
    const result = resumeAnalysisDocumentSchema.safeParse(badTotal);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /does not match expected weighted sum/);
  });

  await t.test('7. COMPLETE analysis with mismatched recommendation threshold is rejected', () => {
    const badRec = createValidCompleteAnalysisFixture({
      // total_score is 95.0 -> must be HIGH, not LOW
      recommendation: RECOMMENDATION_LEVELS.LOW,
    });
    const result = resumeAnalysisDocumentSchema.safeParse(badRec);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /does not match score/);
  });

  await t.test('8. COMPLETE analysis declaring missing_inputs is rejected', () => {
    const invalidComplete = createValidCompleteAnalysisFixture({
      missing_inputs: [{ component: 'skill', code: 'TEST', message: 'Test error' }],
    });
    const result = resumeAnalysisDocumentSchema.safeParse(invalidComplete);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /COMPLETE analysis must have an empty missing_inputs array/);
  });

  await t.test('9. INCOMPLETE analysis containing total_score or recommendation is rejected', () => {
    const withTotal = createValidIncompleteAnalysisFixture({
      total_score: 50.0,
    });
    assert.equal(resumeAnalysisDocumentSchema.safeParse(withTotal).success, false);

    const withRec = createValidIncompleteAnalysisFixture({
      recommendation: RECOMMENDATION_LEVELS.MEDIUM,
    });
    assert.equal(resumeAnalysisDocumentSchema.safeParse(withRec).success, false);
  });

  await t.test('10. INCOMPLETE analysis with empty missing_inputs is rejected', () => {
    const emptyMissing = createValidIncompleteAnalysisFixture({
      missing_inputs: [],
    });
    const result = resumeAnalysisDocumentSchema.safeParse(emptyMissing);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /INCOMPLETE analysis must declare at least one missing input/);
  });

  await t.test('11. Unknown/unapproved fields are rejected by .strict() mode', () => {
    const extraField = createValidCompleteAnalysisFixture({
      llm_summary: 'AI generated narrative analysis',
    });
    const result = resumeAnalysisDocumentSchema.safeParse(extraField);
    assert.equal(result.success, false);
  });

  await t.test('12. Invalid algorithm_version or input_fingerprint format is rejected', () => {
    const badAlgo = createValidCompleteAnalysisFixture({
      algorithm_version: 'recruithub-scoring-v2-unapproved',
    });
    assert.equal(resumeAnalysisDocumentSchema.safeParse(badAlgo).success, false);

    const badFp = createValidCompleteAnalysisFixture({
      input_fingerprint: 'not-a-64-hex-digest',
    });
    assert.equal(resumeAnalysisDocumentSchema.safeParse(badFp).success, false);
  });
});
