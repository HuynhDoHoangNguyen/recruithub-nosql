/**
 * TV3-UC17-001: Interview Request Validation Schemas
 *
 * Strict Zod schemas for:
 * - Create Interview request (4 client fields; server generates all else)
 * - List Interviews query (application_id only)
 *
 * Explicitly rejects all server-managed, completion, and identity fields
 * to enforce the client / server boundary defined in UC17 contract.
 */

import { z } from 'zod';
import { APPROVED_INTERVIEW_TYPES, INTERVIEW_RESULTS } from '../utils/interview-validation.utils.js';

/** Regex for application:pair:<64-char hex> */
const applicationIdRegex = /^application:pair:[a-f0-9]{64}$/;

/**
 * Scheduled-at: must be an ISO-8601 datetime string with a UTC offset.
 * After validation we normalise to a UTC ISO string so downstream
 * logic always works with a canonical form.
 */
const scheduledAtSchema = z
  .iso.datetime({ offset: true })
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'scheduled_at must be a valid ISO-8601 datetime with a timezone offset (e.g. 2026-10-27T02:30:00.000Z)'
  )
  .transform((val) => new Date(val).toISOString()); // normalise to UTC ISO string

/**
 * Create Interview – client contract.
 *
 * Only four fields are accepted; every other field (including completion,
 * identity and server-managed fields) is rejected by .strict().
 */
export const createInterviewRequestSchema = z
  .object({
    application_id: z
      .string()
      .regex(applicationIdRegex, 'application_id must match application:pair:<64 hex>'),
    round: z
      .number({ invalid_type_error: 'round must be a number' })
      .int('round must be an integer')
      .positive('round must be a positive integer (>= 1)'),
    interview_type: z.enum(
      APPROVED_INTERVIEW_TYPES,
      { errorMap: () => ({ message: `interview_type must be one of: ${APPROVED_INTERVIEW_TYPES.join(', ')}` }) }
    ),
    scheduled_at: scheduledAtSchema,
  })
  .strict(); // reject _id, _rev, application_attempt, candidate_id, job_id,
             // interviewer_id, created_at, updated_at, provenance,
             // score, feedback, result, completed_at and any unknown field

/**
 * List Interviews query – strict: only application_id accepted.
 */
export const listInterviewsQuerySchema = z
  .object({
    application_id: z
      .string()
      .regex(applicationIdRegex, 'application_id must match application:pair:<64 hex>'),
  })
  .strict();

export const interviewFeedbackParamsSchema = z.strictObject({
  id: z.string().regex(/^interview:[a-f0-9]{64}:(?:attempt:[1-9][0-9]*:)?[1-9][0-9]*$/),
});

export const interviewFeedbackRequestSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().min(1).max(2000),
  result: z.enum(INTERVIEW_RESULTS),
});
