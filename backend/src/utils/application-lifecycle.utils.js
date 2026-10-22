/**
 * Application Lifecycle & State Machine Utilities (DATA-03.3A / Rule C & Rule D)
 * 
 * Enforces the approved DATA-02A 12-transition state machine, terminal state invariants,
 * stage history contiguity, and Job application eligibility checks.
 */

import {
  APPLICATION_STAGES,
  JOB_STATUSES,
  USER_ROLES,
} from '../constants/document.constants.js';

/**
 * Terminal stages from which no further transitions are permitted.
 */
export const TERMINAL_STAGES = Object.freeze([
  APPLICATION_STAGES.HIRED,
  APPLICATION_STAGES.REJECTED,
  APPLICATION_STAGES.WITHDRAWN,
]);

/**
 * Approved Rejection Reason Codes (DATA-02A / Section 5 & 11).
 */
export const REJECTION_REASON_CODES = Object.freeze([
  'SCREENING_REJECTED',
  'INTERVIEW_FAILED',
  'OFFER_DECLINED',
  'OFFER_EXPIRED',
  'POSITION_FILLED',
  'QUALIFICATIONS_MISMATCH',
  'OTHER',
]);

/**
 * Actor Roles permitted in stage transitions.
 */
export const STAGE_ACTOR_ROLES = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  RECRUITER: 'RECRUITER',
  SYSTEM: 'SYSTEM',
});

/**
 * Approved 12 Transitions Matrix (DATA-02A Section 5).
 * Each entry specifies: from_stage, to_stage, permitted_actors, requires_reason, requires_evidence.
 */
export const APPROVED_TRANSITIONS = Object.freeze([
  // 1. Initial Apply: null -> APPLIED
  Object.freeze({
    from: null,
    to: APPLICATION_STAGES.APPLIED,
    actors: Object.freeze([STAGE_ACTOR_ROLES.CANDIDATE, STAGE_ACTOR_ROLES.SYSTEM]),
    requiresReason: false,
    requiresEvidence: false,
    description: 'Initial candidate application',
  }),
  // 2. APPLIED -> SCREENING
  Object.freeze({
    from: APPLICATION_STAGES.APPLIED,
    to: APPLICATION_STAGES.SCREENING,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: false,
    requiresEvidence: false,
    description: 'Recruiter starts screening candidate profile',
  }),
  // 3. APPLIED -> REJECTED
  Object.freeze({
    from: APPLICATION_STAGES.APPLIED,
    to: APPLICATION_STAGES.REJECTED,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: true,
    requiresEvidence: false,
    description: 'Recruiter rejects application during applied stage',
  }),
  // 4. APPLIED -> WITHDRAWN
  Object.freeze({
    from: APPLICATION_STAGES.APPLIED,
    to: APPLICATION_STAGES.WITHDRAWN,
    actors: Object.freeze([STAGE_ACTOR_ROLES.CANDIDATE]),
    requiresReason: false,
    requiresEvidence: false,
    description: 'Candidate withdraws application during applied stage',
  }),
  // 5. SCREENING -> INTERVIEW
  Object.freeze({
    from: APPLICATION_STAGES.SCREENING,
    to: APPLICATION_STAGES.INTERVIEW,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: false,
    requiresEvidence: false,
    description: 'Candidate selected for interview process',
  }),
  // 6. SCREENING -> REJECTED
  Object.freeze({
    from: APPLICATION_STAGES.SCREENING,
    to: APPLICATION_STAGES.REJECTED,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: true,
    requiresEvidence: false,
    description: 'Candidate rejected after screening',
  }),
  // 7. SCREENING -> WITHDRAWN
  Object.freeze({
    from: APPLICATION_STAGES.SCREENING,
    to: APPLICATION_STAGES.WITHDRAWN,
    actors: Object.freeze([STAGE_ACTOR_ROLES.CANDIDATE]),
    requiresReason: false,
    requiresEvidence: false,
    description: 'Candidate withdraws application during screening',
  }),
  // 8. INTERVIEW -> OFFER
  Object.freeze({
    from: APPLICATION_STAGES.INTERVIEW,
    to: APPLICATION_STAGES.OFFER,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: false,
    requiresEvidence: true,
    description: 'Offer issued after completed interview evidence',
  }),
  // 9. INTERVIEW -> REJECTED
  Object.freeze({
    from: APPLICATION_STAGES.INTERVIEW,
    to: APPLICATION_STAGES.REJECTED,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: true,
    requiresEvidence: false,
    description: 'Candidate rejected after interview',
  }),
  // 10. INTERVIEW -> WITHDRAWN
  Object.freeze({
    from: APPLICATION_STAGES.INTERVIEW,
    to: APPLICATION_STAGES.WITHDRAWN,
    actors: Object.freeze([STAGE_ACTOR_ROLES.CANDIDATE]),
    requiresReason: false,
    requiresEvidence: false,
    description: 'Candidate withdraws application during interview process',
  }),
  // 11. OFFER -> HIRED
  Object.freeze({
    from: APPLICATION_STAGES.OFFER,
    to: APPLICATION_STAGES.HIRED,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: false,
    requiresEvidence: true,
    description: 'Offer accepted; candidate hired',
  }),
  // 12. OFFER -> REJECTED
  Object.freeze({
    from: APPLICATION_STAGES.OFFER,
    to: APPLICATION_STAGES.REJECTED,
    actors: Object.freeze([STAGE_ACTOR_ROLES.RECRUITER]),
    requiresReason: true,
    requiresEvidence: false,
    description: 'Offer declined by candidate or expired',
  }),
]);

/**
 * Validates whether a proposed transition is one of the 12 approved transitions.
 * 
 * @param {string|null} fromStage 
 * @param {string} toStage 
 * @param {string} actorRole 
 * @param {Object} [options]
 * @param {string} [options.reasonCode]
 * @param {Object} [options.evidence]
 * @returns {{ valid: boolean, error?: string }}
 */
export function isValidStageTransition(fromStage, toStage, actorRole, options = {}) {
  // 1. Terminal stage restriction: cannot transition out of terminal state
  if (fromStage !== null && TERMINAL_STAGES.includes(fromStage)) {
    return {
      valid: false,
      error: `Cannot transition from terminal stage "${fromStage}". Terminal stages cannot transition further.`,
    };
  }

  // 2. Explicit rule 110: candidate cannot withdraw in OFFER
  if (fromStage === APPLICATION_STAGES.OFFER && toStage === APPLICATION_STAGES.WITHDRAWN) {
    return {
      valid: false,
      error: 'Candidate withdrawal is prohibited in OFFER stage. Outcome must be HIRED or REJECTED.',
    };
  }

  // 3. Match against approved 12 transitions
  const matched = APPROVED_TRANSITIONS.find(
    (t) => t.from === fromStage && t.to === toStage
  );

  if (!matched) {
    return {
      valid: false,
      error: `Forbidden transition: from "${fromStage}" to "${toStage}". Stage skips and backward transitions are not permitted.`,
    };
  }

  // 4. Verify actor permissions
  if (!matched.actors.includes(actorRole)) {
    return {
      valid: false,
      error: `Actor role "${actorRole}" is not permitted to perform transition from "${fromStage}" to "${toStage}". Allowed actors: ${matched.actors.join(', ')}.`,
    };
  }

  // 5. Verify required rejection reason code
  if (matched.requiresReason) {
    if (!options.reasonCode || typeof options.reasonCode !== 'string' || !options.reasonCode.trim()) {
      return {
        valid: false,
        error: `Transition to REJECTED requires a non-empty reason_code.`,
      };
    }
  }

  // 6. Verify required evidence
  if (matched.requiresEvidence) {
    if (!options.evidence || typeof options.evidence !== 'object') {
      return {
        valid: false,
        error: `Transition from "${fromStage}" to "${toStage}" requires valid evidence object.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates an entire stage_history array for contiguity, chronology, and transition validity.
 * 
 * @param {Array<Object>} history 
 * @param {string} appliedAt 
 * @param {string} currentStage 
 * @param {string} updatedAt 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStageHistory(history, appliedAt, currentStage, updatedAt) {
  const errors = [];

  if (!Array.isArray(history) || history.length === 0) {
    return { valid: false, errors: ['stage_history must be a non-empty array of events'] };
  }

  // 1. Initial event checks: null -> APPLIED
  const initialEvent = history[0];
  if (initialEvent.from_stage !== null && initialEvent.from_stage !== undefined) {
    errors.push(`First stage event must have from_stage = null, received "${initialEvent.from_stage}"`);
  }
  if (initialEvent.to_stage !== APPLICATION_STAGES.APPLIED) {
    errors.push(`First stage event must have to_stage = "APPLIED", received "${initialEvent.to_stage}"`);
  }
  if (initialEvent.timestamp !== appliedAt) {
    errors.push(`First stage event timestamp ("${initialEvent.timestamp}") must equal applied_at ("${appliedAt}")`);
  }

  let prevTime = new Date(initialEvent.timestamp).getTime();

  // 2. Validate contiguous transitions and strictly increasing timestamps
  for (let i = 1; i < history.length; i++) {
    const prevEvent = history[i - 1];
    const event = history[i];

    // Adjacent connection
    if (event.from_stage !== prevEvent.to_stage) {
      errors.push(
        `Broken stage history chain at event ${i}: event.from_stage ("${event.from_stage}") does not match previous to_stage ("${prevEvent.to_stage}")`
      );
    }

    // Monotonic strictly increasing timestamps
    const curTime = new Date(event.timestamp).getTime();
    if (curTime <= prevTime) {
      errors.push(
        `Stage history timestamp at event ${i} ("${event.timestamp}") is not strictly greater than previous event ("${prevEvent.timestamp}")`
      );
    }
    prevTime = curTime;

    // Transition validity
    const transitionCheck = isValidStageTransition(
      event.from_stage,
      event.to_stage,
      event.actor_role,
      {
        reasonCode: event.reason_code,
        evidence: event.evidence,
      }
    );
    if (!transitionCheck.valid) {
      errors.push(`Event ${i} invalid transition: ${transitionCheck.error}`);
    }

    // Terminal stage must be the last event
    if (TERMINAL_STAGES.includes(prevEvent.to_stage)) {
      errors.push(
        `Terminal stage "${prevEvent.to_stage}" at event ${i - 1} cannot have subsequent events in stage_history`
      );
    }
  }

  // 3. Final event alignment with current_stage
  const lastEvent = history[history.length - 1];
  if (lastEvent.to_stage !== currentStage) {
    errors.push(
      `Last stage event to_stage ("${lastEvent.to_stage}") does not match application.current_stage ("${currentStage}")`
    );
  }

  // 4. updated_at semantics: updated_at >= last_stage_event.timestamp
  if (updatedAt) {
    const updatedTime = new Date(updatedAt).getTime();
    const lastEventTime = new Date(lastEvent.timestamp).getTime();
    if (updatedTime < lastEventTime) {
      errors.push(
        `application.updated_at ("${updatedAt}") cannot be earlier than the last stage event timestamp ("${lastEvent.timestamp}")`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates whether a Job is eligible to accept a new Application (Rule F).
 * 
 * Criteria:
 * 1. Job must have status === 'OPEN'.
 * 2. Job deadline must be defined and valid ISO-8601 UTC.
 * 3. appliedAt <= job.deadline.
 * 4. Job must have valid organization ownership references (company_id, department_id, recruiter_id).
 * 
 * @param {Object} job 
 * @param {string} appliedAt 
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function isJobEligibleForApplication(job, appliedAt) {
  if (!job || typeof job !== 'object') {
    return { eligible: false, reason: 'Job document must be an object' };
  }

  if (job.status !== JOB_STATUSES.OPEN) {
    return {
      eligible: false,
      reason: `Job is not open for applications. Current status: "${job.status}". Only OPEN jobs can receive applications.`,
    };
  }

  if (!job.deadline) {
    return {
      eligible: false,
      reason: 'OPEN Job requires a deadline timestamp to accept applications.',
    };
  }

  const applyTime = new Date(appliedAt).getTime();
  const deadlineTime = new Date(job.deadline).getTime();

  if (Number.isNaN(applyTime) || Number.isNaN(deadlineTime)) {
    return { eligible: false, reason: 'Invalid appliedAt or job.deadline timestamp format' };
  }

  if (applyTime > deadlineTime) {
    return {
      eligible: false,
      reason: `Application time ("${appliedAt}") is past the job deadline ("${job.deadline}").`,
    };
  }

  if (!job.company_id || !job.department_id || !job.recruiter_id) {
    return {
      eligible: false,
      reason: 'Job lacks required organization ownership references (company_id, department_id, recruiter_id).',
    };
  }

  return { eligible: true };
}

/**
 * Pure cross-document validator for Application creation preconditions (Section 3.1).
 * 
 * @param {Object} params
 * @param {Object} params.candidate - Candidate business document
 * @param {Object} params.job - Job business document
 * @param {Object} params.user - User document of the applicant
 * @param {string} params.appliedAt - Application submission timestamp
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateApplicationCreationScope({ candidate, job, user, appliedAt } = {}) {
  const errors = [];

  if (!candidate) errors.push('Missing required document: candidate');
  if (!job) errors.push('Missing required document: job');
  if (!user) errors.push('Missing required document: user');
  if (!appliedAt) errors.push('Missing required parameter: appliedAt');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 1. Verify candidate ownership
  if (candidate.user_id !== user._id) {
    errors.push(`Candidate ownership mismatch: candidate.user_id ("${candidate.user_id}") !== user._id ("${user._id}")`);
  }
  if (user.role !== USER_ROLES.CANDIDATE) {
    errors.push(`Applicant User role must be CANDIDATE, received "${user.role}"`);
  }

  // 2. Verify Job eligibility
  const eligibility = isJobEligibleForApplication(job, appliedAt);
  if (!eligibility.eligible) {
    errors.push(`Job ineligible for application: ${eligibility.reason}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
