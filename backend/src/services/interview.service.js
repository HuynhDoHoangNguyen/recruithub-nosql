/**
 * TV3-UC17-001: Interview Domain Service
 *
 * Implements deterministic Interview scheduling domain logic:
 * - RBAC & Job ownership verification
 * - Application stage gate (must be INTERVIEW)
 * - Server-generated stable _id, application_attempt, references, timestamps, provenance
 * - Sequential round enforcement (1..n; next only = n+1)
 * - Idempotency for identical retry; controlled conflict for divergent retry
 * - CouchDB 409 concurrency recovery (re-read, semantic equality check, one retry)
 * - List interviews filtered to current attempt, sorted ascending by round
 * - Recruiter feedback and completion for rounds in the current attempt
 */

import { ApiError } from '../middleware/job-application.middleware.js';
import { applicationDocumentSchema } from '../schemas/application.schema.js';
import { interviewDocumentSchema } from '../schemas/interview.schema.js';
import { APPLICATION_STAGES } from '../constants/document.constants.js';
import {
  interviewIdFromRound,
  validateInterviewTimeline,
  validateInterviewCreationScope,
} from '../utils/interview-validation.utils.js';
import { ownedJob, parseStored, assertActiveRole, requireDocument } from './job-application-scope.service.js';

/** Transform version embedded in every UC17-created interview's provenance. */
const INTERVIEW_TRANSFORM_VERSION = 'interview-scheduling-v1';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps a stored interview document to the safe UC17 DTO.
 * Never returns _rev, provenance, interviewer_id, candidate_id, job_id,
 * score, feedback, result, or completed_at.
 */
function toSafeDto(interview) {
  return {
    _id: interview._id,
    application_id: interview.application_id,
    application_attempt: interview.application_attempt ?? 1,
    round: interview.round,
    interview_type: interview.interview_type,
    scheduled_at: interview.scheduled_at,
    created_at: interview.created_at,
    updated_at: interview.updated_at,
  };
}

function toFeedbackDto(interview) {
  const { _id, round, completed_at, score, feedback, result } = interview;
  return {
    _id,
    round,
    status: completed_at ? 'COMPLETED' : 'PENDING',
    ...(completed_at ? { completed_at, score, feedback, result } : {}),
  };
}

function assertFeedbackReferences(interview, application, recruiter) {
  if (interview.application_id !== application._id || interview.candidate_id !== application.candidate_id ||
      interview.job_id !== application.job_id || ![recruiter._id, recruiter.user_id].includes(interview.interviewer_id)) {
    throw new ApiError(409, 'INVALID_INTERVIEW_REFERENCES', 'Vòng phỏng vấn không khớp hồ sơ hoặc nhà tuyển dụng.');
  }
}

function completedFeedback(interview, { score, feedback, result }) {
  if (interview.completed_at && interview.score === score && interview.feedback === feedback && interview.result === result) {
    return toFeedbackDto(interview);
  }
  throw new ApiError(409, 'INTERVIEW_FEEDBACK_CONFLICT', 'Đánh giá đã thay đổi. Vui lòng tải lại.');
}

/**
 * Extracts the timestamp when the application entered INTERVIEW stage.
 * Returns null if no such event exists in stage_history.
 */
function interviewStageEntryAt(application) {
  const events = application.stage_history ?? [];
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].to_stage === APPLICATION_STAGES.INTERVIEW) {
      return events[i].timestamp;
    }
  }
  return null;
}

/**
 * Checks semantic equality between two interview documents (or shapes),
 * used for idempotency and concurrency recovery.
 *
 * Compares every field that the server authored except _rev.
 */
function semanticEquals(a, b) {
  if (!a || !b) return false;
  return (
    a.type === b.type &&
    a.application_id === b.application_id &&
    (a.application_attempt ?? 1) === (b.application_attempt ?? 1) &&
    a.candidate_id === b.candidate_id &&
    a.job_id === b.job_id &&
    a.interviewer_id === b.interviewer_id &&
    a.round === b.round &&
    a.interview_type === b.interview_type &&
    new Date(a.scheduled_at).toISOString() === new Date(b.scheduled_at).toISOString() &&
    a.provenance?.transform_version === b.provenance?.transform_version
  );
}

/**
 * Builds and Zod-validates the Interview document the server intends to write.
 * Throws a controlled 422 if schema validation fails (should never happen in
 * normal operation – guards against logic regressions).
 */
function buildAndValidateDocument({ stableId, attempt, application, recruiter, job, payload, now }) {
  const nowIso = now().toISOString();
  const doc = {
    _id: stableId,
    type: 'interview',
    application_attempt: attempt,
    application_id: application._id,
    candidate_id: application.candidate_id,
    job_id: application.job_id,
    interviewer_id: recruiter._id,
    round: payload.round,
    interview_type: payload.interview_type,
    scheduled_at: new Date(payload.scheduled_at).toISOString(),
    created_at: nowIso,
    updated_at: nowIso,
    provenance: {
      classification: 'derived',
      generated: false,
      transform_version: INTERVIEW_TRANSFORM_VERSION,
      field_origins: {
        round: 'server_derived',
        application_id: 'user_input',
        interview_type: 'user_input',
        scheduled_at: 'user_input',
      },
    },
  };

  // Validate against the canonical interview schema before writing
  const parsed = interviewDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    throw new ApiError(
      422,
      'DOCUMENT_BUILD_ERROR',
      `Server failed to build a valid Interview document: ${parsed.error.issues.map((i) => i.message).join('; ')}`
    );
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// InterviewService
// ---------------------------------------------------------------------------

export class InterviewService {
  /**
   * @param {Object} repository - Must implement: get, put, profile, allInterviews, requireDocument-compatible get
   * @param {Object} [options]
   * @param {Function} [options.now] - Clock injection; defaults to () => new Date()
   */
  constructor(repository, options = {}) {
    if (!repository || typeof repository !== 'object') {
      throw new Error('InterviewService requires a repository instance.');
    }
    if (typeof repository.get !== 'function') {
      throw new Error('InterviewService requires repository.get(id).');
    }
    if (typeof repository.put !== 'function') {
      throw new Error('InterviewService requires repository.put(doc).');
    }
    if (typeof repository.profile !== 'function') {
      throw new Error('InterviewService requires repository.profile(type, userId).');
    }
    if (typeof repository.allInterviews !== 'function') {
      throw new Error('InterviewService requires repository.allInterviews(applicationId).');
    }
    this.repo = repository;
    this.now = typeof options.now === 'function' ? options.now : () => new Date();
  }

  // -------------------------------------------------------------------------
  // create(user, payload)
  // -------------------------------------------------------------------------

  /**
   * Creates a new Interview or recovers an idempotent identical retry.
   *
   * @param {Object} user - Authenticated user document
   * @param {Object} payload - Validated CreateInterviewRequest
   * @returns {Promise<{ created: boolean, idempotent: boolean, interview: Object }>}
   */
  async create(user, payload) {
    // 1. RBAC – must be active RECRUITER (throws 403 if not)
    assertActiveRole(user, 'RECRUITER');

    // 2. Load and validate Application (throws 404 if missing or wrong type)
    const rawApplication = await this.repo.get(payload.application_id);
    if (!rawApplication || rawApplication.type !== 'application') {
      throw new ApiError(404, 'NOT_FOUND', 'Hồ sơ ứng tuyển không tồn tại.');
    }
    const application = parseStored(applicationDocumentSchema, rawApplication);

    // 3. Verify Recruiter owns the Job on the Application
    const { job, recruiter } = await ownedJob(this.repo, user, application.job_id);

    // 4. Application stage gate – must be INTERVIEW
    if (application.current_stage !== APPLICATION_STAGES.INTERVIEW) {
      throw new ApiError(
        422,
        'INVALID_APPLICATION_STAGE',
        `Chỉ có thể lên lịch phỏng vấn khi hồ sơ đang ở trạng thái INTERVIEW. Trạng thái hiện tại: "${application.current_stage}".`
      );
    }

    // 5. Timeline check: scheduled_at >= INTERVIEW stage entry timestamp
    const interviewStageAt = interviewStageEntryAt(application);
    if (interviewStageAt) {
      const timeline = validateInterviewTimeline({
        scheduledAt: payload.scheduled_at,
        interviewStageAt,
      });
      if (!timeline.valid) {
        throw new ApiError(422, 'INVALID_SCHEDULE_TIMELINE', timeline.errors.join('; '));
      }
    }

    // 6. Determine current attempt
    const attempt = application.attempt_number ?? 1;

    // 7. Compute stable deterministic _id
    const stableId = interviewIdFromRound(application._id, payload.round, attempt);

    // 8. Check whether the stable _id already exists (idempotency / concurrency)
    const existing = await this.repo.get(stableId);
    if (existing) {
      return this.#handleExistingDocument(existing, application, recruiter, job, payload, attempt);
    }

    // 9. Load and validate the full current-attempt interview collection
    //    to enforce sequential round ordering
    await this.#assertRoundSequence(application, attempt, payload.round);

    // 10. Build, validate and write the new Interview document
    const doc = buildAndValidateDocument({ stableId, attempt, application, recruiter, job, payload, now: this.now });

    try {
      const saved = await this.repo.put(doc);
      return { created: true, idempotent: false, interview: toSafeDto(saved) };
    } catch (err) {
      if (err?.status === 409 || err?.code === 'CONFLICT') {
        // CouchDB conflict – re-read the winner and evaluate
        return this.#recoverFromConflict(stableId, doc);
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // list(user, query)
  // -------------------------------------------------------------------------

  /**
   * Lists interviews for an Application belonging to the current-attempt,
   * sorted ascending by round.
   *
   * @param {Object} user
   * @param {Object} query - Validated ListInterviewsQuery { application_id }
   * @returns {Promise<{ application_id, application_attempt, items, next_round, scheduling_required }>}
   */
  async list(user, query) {
    const { application } = await this.#ownedApplication(user, query.application_id);
    const items = await this.#currentRounds(application);
    return {
      application_id: application._id,
      application_attempt: application.attempt_number ?? 1,
      items: items.map(toSafeDto),
      next_round: items.length + 1,
      scheduling_required: items.length === 0,
    };
  }

  async listFeedback(user, { application_id }) {
    const { application, recruiter } = await this.#ownedApplication(user, application_id);
    const items = await this.#currentRounds(application);
    return {
      application_id: application._id,
      application_attempt: application.attempt_number ?? 1,
      items: items.map(interview => {
        assertFeedbackReferences(interview, application, recruiter);
        return toFeedbackDto(interview);
      }),
    };
  }

  async complete(user, id, payload) {
    const { interview, application } = await this.#feedbackContext(user, id);
    const evaluation = { score: payload.rating * 20, feedback: payload.feedback, result: payload.result };
    if (interview.completed_at) return completedFeedback(interview, evaluation);

    if (application.current_stage !== APPLICATION_STAGES.INTERVIEW) {
      throw new ApiError(422, 'INVALID_APPLICATION_STAGE', 'Chỉ có thể đánh giá khi hồ sơ đang ở trạng thái phỏng vấn.');
    }
    const now = this.now();
    const enteredAt = interviewStageEntryAt(application);
    if (now.getTime() < Date.parse(interview.scheduled_at) ||
        (enteredAt && Date.parse(interview.scheduled_at) < Date.parse(enteredAt))) {
      throw new ApiError(422, 'INVALID_INTERVIEW_TIMELINE', 'Thời điểm đánh giá hoặc lịch phỏng vấn không hợp lệ.');
    }
    if (!interview._rev) {
      throw new ApiError(409, 'INVALID_STORED_DOCUMENT', 'Không tìm thấy phiên bản của vòng phỏng vấn.');
    }
    const document = parseStored(interviewDocumentSchema, {
      ...interview,
      ...evaluation,
      completed_at: now.toISOString(),
      updated_at: new Date(Math.max(now.getTime(), Date.parse(interview.updated_at))).toISOString(),
    });
    try {
      const saved = await this.repo.put(document, {
        allowLegacyUnavailable: interview.provenance.classification === 'unavailable',
      });
      return toFeedbackDto(saved);
    } catch (error) {
      if (error?.status !== 409 && error?.code !== 'CONFLICT') throw error;
      const { interview: winner } = await this.#feedbackContext(user, id);
      return completedFeedback(winner, evaluation);
    }
  }

  async #feedbackContext(user, id) {
    assertActiveRole(user, 'RECRUITER');
    const interview = parseStored(interviewDocumentSchema, await requireDocument(this.repo, id, 'interview'));
    const { application, recruiter } = await this.#ownedApplication(user, interview.application_id);
    if ((interview.application_attempt ?? 1) !== (application.attempt_number ?? 1)) {
      throw new ApiError(409, 'STALE_INTERVIEW_ATTEMPT', 'Vòng phỏng vấn thuộc lượt ứng tuyển trước.');
    }
    assertFeedbackReferences(interview, application, recruiter);
    return { interview, application };
  }

  async #ownedApplication(user, applicationId) {
    // 1. RBAC
    assertActiveRole(user, 'RECRUITER');

    // 2. Load & validate Application
    const rawApplication = await this.repo.get(applicationId);
    if (!rawApplication || rawApplication.type !== 'application') {
      throw new ApiError(404, 'NOT_FOUND', 'Hồ sơ ứng tuyển không tồn tại.');
    }
    const application = parseStored(applicationDocumentSchema, rawApplication);

    // 3. Ownership
    const { recruiter } = await ownedJob(this.repo, user, application.job_id);
    return { application, recruiter };
  }

  async #currentRounds(application) {
    // 4. Load all interviews for this application
    const currentAttempt = application.attempt_number ?? 1;
    const allInterviews = await this.repo.allInterviews(application._id);

    // 5. Filter and validate to current attempt only
    const currentAttemptItems = [];
    for (const raw of allInterviews) {
      if (!raw || raw.type !== 'interview') continue;
      const itemAttempt = raw.application_attempt ?? 1;
      if (itemAttempt !== currentAttempt) continue;

      const parsed = interviewDocumentSchema.safeParse(raw);
      if (!parsed.success) {
        // Corrupted stored document in current attempt – controlled error
        throw new ApiError(
          409,
          'CORRUPTED_STORED_INTERVIEW',
          `Interview document "${raw._id}" thuộc attempt hiện tại nhưng không vượt qua schema validation.`
        );
      }
      currentAttemptItems.push(parsed.data);
    }

    // 6. Sort ascending by round
    currentAttemptItems.sort((a, b) => a.round - b.round);

    // 7. Validate round sequence integrity
    const roundSequenceError = this.#checkRoundSequence(currentAttemptItems);
    if (roundSequenceError) {
      throw new ApiError(409, 'INVALID_ROUND_SEQUENCE', roundSequenceError);
    }

    return currentAttemptItems;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Handles the case where the stable _id already exists in the store.
   * Returns idempotent success for semantic-equal docs; conflict for divergent.
   */
  async #handleExistingDocument(existing, application, recruiter, job, payload, attempt) {
    // Validate stored document
    const parsedResult = interviewDocumentSchema.safeParse(existing);
    if (!parsedResult.success) {
      throw new ApiError(
        409,
        'CORRUPTED_STORED_INTERVIEW',
        `Interview "${existing._id}" không vượt qua schema validation: ${parsedResult.error.issues.map((i) => i.message).join('; ')}`
      );
    }
    const stored = parsedResult.data;

    // Check reference integrity
    if (
      stored.application_id !== application._id ||
      stored.candidate_id !== application.candidate_id ||
      stored.job_id !== application.job_id ||
      stored.job_id !== job._id
    ) {
      throw new ApiError(
        409,
        'REFERENCE_MISMATCH',
        `Interview "${stored._id}" có tham chiếu không khớp với Application hoặc Job hiện tại.`
      );
    }

    // Check attempt integrity
    if ((stored.application_attempt ?? 1) !== attempt) {
      throw new ApiError(
        409,
        'ATTEMPT_MISMATCH',
        `Interview "${stored._id}" thuộc attempt ${stored.application_attempt ?? 1} nhưng Application hiện ở attempt ${attempt}.`
      );
    }

    // Build what we intended to write and compare semantically
    const intended = buildAndValidateDocument({
      stableId: stored._id,
      attempt,
      application,
      recruiter,
      job,
      payload,
      now: this.now,
    });

    if (semanticEquals(stored, intended)) {
      return { created: false, idempotent: true, interview: toSafeDto(stored) };
    }

    // Divergent: same stable ID but different content → conflict
    throw new ApiError(
      409,
      'INTERVIEW_CONTENT_CONFLICT',
      `Interview "${stored._id}" đã tồn tại với nội dung khác. Không thể overwrite.`
    );
  }

  /**
   * Recovers from a CouchDB 409 by re-reading the winner document.
   * Identical → idempotent success. Divergent/missing/corrupted → conflict.
   */
  async #recoverFromConflict(stableId, intended) {
    const winner = await this.repo.get(stableId);
    if (!winner) {
      throw new ApiError(
        409,
        'CONFLICT',
        'Xung đột ghi đồng thời – không thể đọc lại document sau conflict.'
      );
    }
    if (semanticEquals(winner, intended)) {
      return { created: false, idempotent: true, interview: toSafeDto(winner) };
    }
    throw new ApiError(
      409,
      'INTERVIEW_CONTENT_CONFLICT',
      `Xung đột ghi đồng thời: Interview "${stableId}" đã được ghi với nội dung khác.`
    );
  }

  /**
   * Loads all interviews for the current attempt and asserts that the
   * requested round equals the number of consecutive completed rounds + 1.
   */
  async #assertRoundSequence(application, attempt, requestedRound) {
    const allInterviews = await this.repo.allInterviews(application._id);

    const currentAttemptItems = [];
    for (const raw of allInterviews) {
      if (!raw || raw.type !== 'interview') continue;
      const itemAttempt = raw.application_attempt ?? 1;
      if (itemAttempt !== attempt) continue;

      const parsed = interviewDocumentSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ApiError(
          409,
          'CORRUPTED_STORED_INTERVIEW',
          `Interview document "${raw._id}" không vượt qua schema validation.`
        );
      }
      currentAttemptItems.push(parsed.data);
    }

    currentAttemptItems.sort((a, b) => a.round - b.round);

    // Validate sequence integrity before using length
    const seqError = this.#checkRoundSequence(currentAttemptItems);
    if (seqError) {
      throw new ApiError(409, 'INVALID_ROUND_SEQUENCE', seqError);
    }

    const expectedNextRound = currentAttemptItems.length + 1;
    if (requestedRound !== expectedNextRound) {
      throw new ApiError(
        422,
        'INVALID_ROUND',
        `Vòng tiếp theo hợp lệ là ${expectedNextRound}. Bạn yêu cầu vòng ${requestedRound}.`
      );
    }
  }

  /**
   * Returns an error message if the sorted list has a duplicate or gap in rounds.
   * Returns null if the sequence is valid (e.g. [], [1], [1,2], [1,2,3]).
   */
  #checkRoundSequence(sortedItems) {
    for (let i = 0; i < sortedItems.length; i++) {
      if (sortedItems[i].round !== i + 1) {
        return `Round sequence bị lỗi: expected round ${i + 1} at index ${i} but found round ${sortedItems[i].round}.`;
      }
    }
    return null;
  }
}

export function createInterviewService(repository, options) {
  return new InterviewService(repository, options);
}
