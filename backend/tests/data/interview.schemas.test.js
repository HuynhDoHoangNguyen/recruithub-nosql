/**
 * Unit tests for Interview Schema & Interview Validation Utilities (DATA-03.3A)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { interviewDocumentSchema } from '../../src/schemas/interview.schema.js';
import {
  DOCUMENT_TYPES,
  APPLICATION_STAGES,
  PROVENANCE_CLASSIFICATIONS,
} from '../../src/constants/document.constants.js';
import {
  interviewIdFromRound,
  validateInterviewTimeline,
  validateInterviewEvidenceForOffer,
  validateInterviewCreationScope,
  APPROVED_INTERVIEW_TYPES,
  INTERVIEW_RESULTS,
} from '../../src/utils/interview-validation.utils.js';

/**
 * Fixture generator for a valid Interview document
 */
function createValidInterviewFixture(overrides = {}) {
  const applicationId = 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const round = 1;
  const _id = interviewIdFromRound(applicationId, round);

  return {
    _id,
    type: DOCUMENT_TYPES.INTERVIEW,
    application_id: applicationId,
    candidate_id: 'candidate:cms:R_000001',
    job_id: 'job:cms:J_000001',
    interviewer_id: 'recruiter:syn:cccccccccccccccccccccccc',
    round,
    interview_type: 'TECHNICAL',
    scheduled_at: '2026-10-21T12:00:00Z',
    created_at: '2026-10-21T11:00:00Z',
    updated_at: '2026-10-21T11:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: 'recruithub:data:v1:20261021',
      generator_version: 'DATA-03.3A',
    },
    ...overrides,
  };
}

test('DATA-03.3A: Interview Schema Acceptance Tests', async (t) => {
  await t.test('1. Valid scheduled Interview passes schema validation', () => {
    const fixture = createValidInterviewFixture();
    const result = interviewDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('2. Valid completed Interview with score, feedback, and result passes', () => {
    const completedFixture = createValidInterviewFixture({
      completed_at: '2026-10-21T13:00:00Z',
      score: 85,
      feedback: 'Candidate demonstrated deep knowledge of distributed databases.',
      result: INTERVIEW_RESULTS.PASSED,
      updated_at: '2026-10-21T13:00:00Z',
    });
    const result = interviewDocumentSchema.safeParse(completedFixture);
    assert.equal(result.success, true);
  });

  await t.test('3. Interview _id mismatch with application_id and round is rejected', () => {
    const badId = createValidInterviewFixture({
      _id: 'interview:0000000000000000000000000000000000000000000000000000000000000000:1',
    });
    const result = interviewDocumentSchema.safeParse(badId);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /does not match canonical deterministic ID/);
  });

  await t.test('4. Non-positive or non-integer round is rejected', () => {
    const appId = 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    assert.throws(() => interviewIdFromRound(appId, 0), /must be a positive integer/);
    assert.throws(() => interviewIdFromRound(appId, -1), /must be a positive integer/);
    assert.throws(() => interviewIdFromRound(appId, 1.5), /must be a positive integer/);
  });

  await t.test('5. Unapproved interview_type is rejected', () => {
    const badType = createValidInterviewFixture({
      interview_type: 'COFFEE_CHAT_UNAPPROVED',
    });
    const result = interviewDocumentSchema.safeParse(badType);
    assert.equal(result.success, false);
  });

  await t.test('6. Completed interview with completed_at earlier than scheduled_at is rejected', () => {
    const badTimeline = createValidInterviewFixture({
      scheduled_at: '2026-10-21T14:00:00Z',
      completed_at: '2026-10-21T13:00:00Z', // Completed before scheduled!
      result: INTERVIEW_RESULTS.PASSED,
    });
    const result = interviewDocumentSchema.safeParse(badTimeline);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /completed_at cannot be earlier than scheduled_at/);
  });

  await t.test('7. Completed interview missing result is rejected', () => {
    const missingResult = createValidInterviewFixture({
      completed_at: '2026-10-21T13:00:00Z',
      result: undefined, // Must have PASSED or FAILED
    });
    const result = interviewDocumentSchema.safeParse(missingResult);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /Completed interview must have a result/);
  });

  await t.test('8. Unknown/legacy fields are rejected by .strict() mode', () => {
    const extraField = createValidInterviewFixture({
      video_recording_url: 'https://cdn.example.com/recording.mp4',
    });
    const result = interviewDocumentSchema.safeParse(extraField);
    assert.equal(result.success, false);
  });
});

test('DATA-03.3A: Interview ID & Timeline Utilities Acceptance Tests', async (t) => {
  const appId = 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  await t.test('9. Deterministic ID format: interview:<application-key>:<round>', () => {
    const id1 = interviewIdFromRound(appId, 1);
    const id2 = interviewIdFromRound(appId, 2);

    assert.equal(id1, 'interview:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:1');
    assert.equal(id2, 'interview:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:2');
    assert.match(id1, /^interview:[a-f0-9]{64}:1$/);
  });

  await t.test('10. Interview timeline validation: scheduled_at earlier than INTERVIEW stage transition is rejected', () => {
    const interviewStageAt = '2026-10-21T12:00:00Z';
    const badSched = validateInterviewTimeline({
      scheduledAt: '2026-10-21T11:00:00Z', // Before application entered INTERVIEW!
      interviewStageAt,
    });
    assert.equal(badSched.valid, false);
    assert.match(badSched.errors[0], /cannot be earlier than application entering INTERVIEW/);

    const goodSched = validateInterviewTimeline({
      scheduledAt: '2026-10-21T13:00:00Z',
      interviewStageAt,
    });
    assert.equal(goodSched.valid, true);
  });
});

test('DATA-03.3A: Interview Evidence & Scope Acceptance Tests (Rule E & Rule G)', async (t) => {
  const appId = 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  await t.test('11. Transition to OFFER requires completed interview evidence', () => {
    // No interviews
    const noInterviews = validateInterviewEvidenceForOffer({ interviews: [], applicationId: appId });
    assert.equal(noInterviews.valid, false);
    assert.match(noInterviews.errors[0], /No interview records found/);

    // Pending interview (not completed)
    const pendingInterviews = [
      {
        _id: interviewIdFromRound(appId, 1),
        application_id: appId,
        round: 1,
        scheduled_at: '2026-10-21T12:00:00Z',
        completed_at: undefined, // Pending!
      },
    ];
    const pendingRes = validateInterviewEvidenceForOffer({ interviews: pendingInterviews, applicationId: appId });
    assert.equal(pendingRes.valid, false);
    assert.match(pendingRes.errors[0], /is still pending and has not been completed/);

    // Completed interview
    const completedInterviews = [
      {
        _id: interviewIdFromRound(appId, 1),
        application_id: appId,
        round: 1,
        scheduled_at: '2026-10-21T12:00:00Z',
        completed_at: '2026-10-21T13:00:00Z',
        result: INTERVIEW_RESULTS.PASSED,
      },
    ];
    const completedRes = validateInterviewEvidenceForOffer({ interviews: completedInterviews, applicationId: appId });
    assert.equal(completedRes.valid, true);
  });

  await t.test('12. Rule E: Completed interview evidence accepted without unapproved all-PASSED policy', () => {
    // Contract requires completed interview evidence, does not block on specific grade if business decides
    const completedRounds = [
      {
        _id: interviewIdFromRound(appId, 1),
        application_id: appId,
        round: 1,
        completed_at: '2026-10-21T13:00:00Z',
        result: INTERVIEW_RESULTS.PASSED,
      },
      {
        _id: interviewIdFromRound(appId, 2),
        application_id: appId,
        round: 2,
        completed_at: '2026-10-21T15:00:00Z',
        result: INTERVIEW_RESULTS.PASSED,
      },
    ];
    const res = validateInterviewEvidenceForOffer({ interviews: completedRounds, applicationId: appId });
    assert.equal(res.valid, true);
  });

  await t.test('13. Cross-document creation validator checks Application stage is INTERVIEW', () => {
    const interview = createValidInterviewFixture();
    const job = { _id: interview.job_id, recruiter_id: interview.interviewer_id };

    // Application currently in SCREENING (cannot create Interview yet!)
    const screeningApp = {
      _id: interview.application_id,
      candidate_id: interview.candidate_id,
      job_id: interview.job_id,
      current_stage: APPLICATION_STAGES.SCREENING,
    };
    const resScreening = validateInterviewCreationScope({ interview, application: screeningApp, job });
    assert.equal(resScreening.valid, false);
    assert.match(resScreening.errors[0], /Interview can only be created when Application current_stage is "INTERVIEW"/);

    // Application in INTERVIEW stage -> valid!
    const interviewApp = {
      ...screeningApp,
      current_stage: APPLICATION_STAGES.INTERVIEW,
    };
    const resInterview = validateInterviewCreationScope({ interview, application: interviewApp, job });
    assert.equal(resInterview.valid, true);
  });

  await t.test('14. Cross-document creation validator rejects candidate/job reference mismatch', () => {
    const interview = createValidInterviewFixture();
    const job = { _id: interview.job_id, recruiter_id: interview.interviewer_id };
    const application = {
      _id: interview.application_id,
      candidate_id: 'candidate:cms:R_999999', // Mismatched!
      job_id: interview.job_id,
      current_stage: APPLICATION_STAGES.INTERVIEW,
    };

    const res = validateInterviewCreationScope({ interview, application, job });
    assert.equal(res.valid, false);
    assert.match(res.errors[0], /Interview candidate_id .* does not match application\.candidate_id/);
  });
});
