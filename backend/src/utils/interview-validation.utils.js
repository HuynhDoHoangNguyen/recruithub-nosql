/**
 * Interview Validation & Deterministic ID Utilities (DATA-03.3A / Rule E & Rule G)
 * 
 * Provides pure functions for:
 * - Deterministic Interview ID generation: interview:<application-key>:<round>
 * - Interview timeline and sequential round consistency
 * - Interview evidence validation for transition into OFFER stage
 * - Pure cross-document reference and scoping verification
 */

import {
  APPLICATION_STAGES,
  DOCUMENT_TYPES,
} from '../constants/document.constants.js';

/**
 * Approved Interview Types (DATA-02A Section 9).
 */
export const APPROVED_INTERVIEW_TYPES = Object.freeze([
  'HR_SCREENING',
  'TECHNICAL',
  'SYSTEM_DESIGN',
  'BEHAVIORAL',
  'CULTURE_FIT',
  'FINAL_ROUND',
]);

/**
 * Approved Interview Results.
 */
export const INTERVIEW_RESULTS = Object.freeze({
  PASSED: 'PASSED',
  FAILED: 'FAILED',
});

/**
 * Computes deterministic Interview document ID:
 * interview:<application-key>:<round>
 * 
 * application-key is the pair hash of the Application ID.
 * 
 * @param {string} applicationId - e.g. "application:pair:e3b0c442..."
 * @param {number} round - positive integer 1, 2, 3...
 * @returns {string} interview:<digest>:<round>
 */
export function interviewIdFromRound(applicationId, round) {
  if (typeof applicationId !== 'string' || !applicationId.trim()) {
    throw new TypeError('applicationId must be a non-empty string');
  }

  const trimmedAppId = applicationId.trim();
  const pairPrefix = 'application:pair:';
  let appKey;

  if (trimmedAppId.startsWith(pairPrefix)) {
    appKey = trimmedAppId.slice(pairPrefix.length);
  } else if (trimmedAppId.startsWith('application:')) {
    appKey = trimmedAppId.slice('application:'.length);
  } else {
    throw new Error(`Invalid applicationId format: "${applicationId}". Expected prefix "application:pair:"`);
  }

  if (!/^[a-f0-9]{64}$/.test(appKey)) {
    throw new Error(`Invalid application key digest: "${appKey}". Expected 64-character hex digest.`);
  }

  if (typeof round !== 'number' || !Number.isInteger(round) || round < 1) {
    throw new TypeError(`round must be a positive integer, received ${round}`);
  }

  return `interview:${appKey}:${round}`;
}

/**
 * Validates interview schedule and completion timeline against application interview stage.
 * 
 * @param {Object} params
 * @param {string} params.scheduledAt 
 * @param {string} [params.completedAt] 
 * @param {string} [params.interviewStageAt] - Timestamp when application entered INTERVIEW
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInterviewTimeline({ scheduledAt, completedAt, interviewStageAt } = {}) {
  const errors = [];

  const schedTime = new Date(scheduledAt).getTime();
  if (Number.isNaN(schedTime)) {
    errors.push(`Invalid scheduledAt timestamp: "${scheduledAt}"`);
    return { valid: false, errors };
  }

  // 1. scheduled_at cannot be earlier than the application entering INTERVIEW
  if (interviewStageAt) {
    const stageTime = new Date(interviewStageAt).getTime();
    if (!Number.isNaN(stageTime) && schedTime < stageTime) {
      errors.push(`Interview scheduled_at ("${scheduledAt}") cannot be earlier than application entering INTERVIEW ("${interviewStageAt}")`);
    }
  }

  // 2. completed_at >= scheduled_at
  if (completedAt) {
    const compTime = new Date(completedAt).getTime();
    if (Number.isNaN(compTime)) {
      errors.push(`Invalid completedAt timestamp: "${completedAt}"`);
    } else if (compTime < schedTime) {
      errors.push(`Interview completed_at ("${completedAt}") cannot be earlier than scheduled_at ("${scheduledAt}")`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that completed interview evidence exists for transition into OFFER stage (Rule E).
 * 
 * Invariants:
 * 1. At least one interview round exists for this application.
 * 2. All scheduled interview rounds must be completed (have completed_at).
 * 3. No pending / uncompleted interview rounds.
 * 
 * @param {Object} params
 * @param {Array<Object>} params.interviews - List of interview documents
 * @param {string} params.applicationId - Application ID
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInterviewEvidenceForOffer({ interviews, applicationId } = {}) {
  const errors = [];

  if (!Array.isArray(interviews) || interviews.length === 0) {
    errors.push(`Cannot transition to OFFER: No interview records found for application "${applicationId}". At least one completed interview required.`);
    return { valid: false, errors };
  }

  const appInterviews = interviews.filter((inv) => inv.application_id === applicationId);

  if (appInterviews.length === 0) {
    errors.push(`Cannot transition to OFFER: No interview records associated with application "${applicationId}".`);
    return { valid: false, errors };
  }

  // Verify all rounds are completed
  for (const inv of appInterviews) {
    if (!inv.completed_at) {
      errors.push(`Unresolved interview round: Round ${inv.round} (${inv._id}) is still pending and has not been completed.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Pure cross-document validator for Interview creation preconditions (Section 8).
 * 
 * Invariants:
 * 1. Application must be currently in 'INTERVIEW' stage.
 * 2. Copied candidate_id and job_id must strictly match Application.
 * 3. Interviewer must be authorized / scoped to the Job (recruiter_id or user_id).
 * 
 * @param {Object} params
 * @param {Object} params.interview - Interview document
 * @param {Object} params.application - Referenced Application document
 * @param {Object} params.job - Referenced Job document
 * @param {Object} [params.recruiter] - Optional Recruiter document
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInterviewCreationScope({ interview, application, job, recruiter } = {}) {
  const errors = [];

  if (!interview) errors.push('Missing required document: interview');
  if (!application) errors.push('Missing required document: application');
  if (!job) errors.push('Missing required document: job');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 1. Application must be in INTERVIEW stage
  if (application.current_stage !== APPLICATION_STAGES.INTERVIEW) {
    errors.push(`Interview can only be created when Application current_stage is "INTERVIEW", current stage is "${application.current_stage}"`);
  }

  // 2. Reference consistency
  if (interview.application_id !== application._id) {
    errors.push(`Interview application_id ("${interview.application_id}") does not match application._id ("${application._id}")`);
  }
  if (interview.candidate_id !== application.candidate_id) {
    errors.push(`Interview candidate_id ("${interview.candidate_id}") does not match application.candidate_id ("${application.candidate_id}")`);
  }
  if (interview.job_id !== application.job_id) {
    errors.push(`Interview job_id ("${interview.job_id}") does not match application.job_id ("${application.job_id}")`);
  }
  if (interview.job_id !== job._id) {
    errors.push(`Interview job_id ("${interview.job_id}") does not match job._id ("${job._id}")`);
  }

  // 3. Interviewer scoping
  if (recruiter) {
    const isAuthorized = interview.interviewer_id === recruiter._id || interview.interviewer_id === recruiter.user_id;
    if (!isAuthorized) {
      errors.push(`Interviewer "${interview.interviewer_id}" does not match assigned recruiter ("${recruiter._id}")`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
