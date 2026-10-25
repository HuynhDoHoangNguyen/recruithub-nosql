/**
 * DATA-03.3A Interview Business Document Schema
 * 
 * Defines Zod validation schema for the Interview document:
 * - Deterministic ID: interview:<application-key>:<round>
 * - Copies candidate_id and job_id snapshot from Application
 * - Positive sequential rounds
 * - Approved interview types and completion fields
 * - Strict rejection of unknown / unapproved fields
 */

import { z } from 'zod';
import { DOCUMENT_TYPES } from '../constants/document.constants.js';
import {
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';
import {
  APPROVED_INTERVIEW_TYPES,
  INTERVIEW_RESULTS,
  interviewIdFromRound,
} from '../utils/interview-validation.utils.js';

/**
 * Interview Business Document Schema
 */
export const interviewDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^interview:[a-f0-9]{64}:(?:attempt:[0-9]+:)?[0-9]+$/, 'Invalid Interview _id format'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.INTERVIEW),
    application_attempt: z.number().int().positive().optional(),
    application_id: z
      .string()
      .regex(/^application:pair:[a-f0-9]{64}$/, 'Invalid application_id reference format'),
    candidate_id: z
      .string()
      .regex(/^candidate:(cms:R_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid candidate_id format'),
    job_id: z
      .string()
      .regex(/^job:(cms:J_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid job_id format'),
    interviewer_id: z
      .string()
      .regex(/^(recruiter|user):[a-z0-9_:-]+$/, 'Invalid interviewer_id format'),
    round: z
      .number()
      .int('round must be an integer')
      .positive('round must be a positive integer'),
    interview_type: z.enum([
      APPROVED_INTERVIEW_TYPES[0],
      ...APPROVED_INTERVIEW_TYPES.slice(1),
    ]),
    scheduled_at: isoDateTimeSchema,
    completed_at: isoDateTimeSchema.optional(),
    score: z
      .number()
      .min(0, 'Interview score cannot be negative')
      .max(100, 'Interview score cannot exceed 100')
      .optional(),
    feedback: z.string().trim().min(1).optional(),
    result: z.enum([INTERVIEW_RESULTS.PASSED, INTERVIEW_RESULTS.FAILED]).optional(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((interview, ctx) => {
    // 1. Verify deterministic _id matches interviewIdFromRound(application_id, round)
    if (interview.application_id && interview.round) {
      let expectedId;
      try {
        expectedId = interviewIdFromRound(interview.application_id, interview.round, interview.application_attempt || 1);
      } catch (err) {
        ctx.addIssue({
          code: 'custom',
          message: `Cannot compute Interview _id: ${err.message}`,
          path: ['_id'],
        });
        return;
      }

      if (interview._id !== expectedId) {
        ctx.addIssue({
          code: 'custom',
          message: `Interview _id ("${interview._id}") does not match canonical deterministic ID ("${expectedId}")`,
          path: ['_id'],
        });
      }
    }

    // 2. Monotonic document timestamps: updated_at >= created_at
    if (interview.created_at && interview.updated_at) {
      const createdTime = new Date(interview.created_at).getTime();
      const updatedTime = new Date(interview.updated_at).getTime();
      if (updatedTime < createdTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'updated_at cannot be earlier than created_at',
          path: ['updated_at'],
        });
      }
    }

    // 3. Completion timeline and result requirement
    if (interview.completed_at) {
      const schedTime = new Date(interview.scheduled_at).getTime();
      const compTime = new Date(interview.completed_at).getTime();
      if (compTime < schedTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'completed_at cannot be earlier than scheduled_at',
          path: ['completed_at'],
        });
      }

      if (!interview.result) {
        ctx.addIssue({
          code: 'custom',
          message: 'Completed interview must have a result ("PASSED" or "FAILED")',
          path: ['result'],
        });
      }
    }
  });
