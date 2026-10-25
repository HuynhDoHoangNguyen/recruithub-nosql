/**
 * DATA-03.3A Application Business Document Schema
 * 
 * Defines Zod validation schema for the Application document:
 * - Deterministic Candidate–Job pair ID: application:pair:<sha256(candidate_id + "\n" + job_id)>
 * - Top-level current attempt, with immutable terminal snapshots in previous_attempts
 * - Ordered append-only stage_history enforcing the approved 12 transitions
 * - Strict rejection of legacy fields (status, match_score) and unknown fields
 */

import { z } from 'zod';
import { assetReferenceSchema } from './upload.schema.js';
import {
  APPLICATION_STAGES,
  DOCUMENT_TYPES,
} from '../constants/document.constants.js';
import {
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';
import { applicationIdFromPair } from '../utils/id.utils.js';
import {
  STAGE_ACTOR_ROLES,
  validateStageHistory,
} from '../utils/application-lifecycle.utils.js';

/**
 * Stage Event Item in stage_history[]
 */
export const stageEventSchema = z
  .object({
    from_stage: z
      .enum([
        APPLICATION_STAGES.APPLIED,
        APPLICATION_STAGES.SCREENING,
        APPLICATION_STAGES.INTERVIEW,
        APPLICATION_STAGES.OFFER,
        APPLICATION_STAGES.HIRED,
        APPLICATION_STAGES.REJECTED,
        APPLICATION_STAGES.WITHDRAWN,
      ])
      .nullable(),
    to_stage: z.enum([
      APPLICATION_STAGES.APPLIED,
      APPLICATION_STAGES.SCREENING,
      APPLICATION_STAGES.INTERVIEW,
      APPLICATION_STAGES.OFFER,
      APPLICATION_STAGES.HIRED,
      APPLICATION_STAGES.REJECTED,
      APPLICATION_STAGES.WITHDRAWN,
    ]),
    timestamp: isoDateTimeSchema,
    actor_role: z.enum([
      STAGE_ACTOR_ROLES.CANDIDATE,
      STAGE_ACTOR_ROLES.RECRUITER,
      STAGE_ACTOR_ROLES.SYSTEM,
    ]),
    actor_id: z
      .string()
      .regex(/^(user|recruiter):[a-z0-9_:-]+$/, 'Invalid actor_id format')
      .optional(),
    reason_code: z.string().trim().min(1).optional(),
    note: z.string().trim().min(1).optional(),
    evidence: z.record(z.string(), z.any()).optional(),
  })
  .strict();

/**
 * Application Business Document Schema
 */
export const submissionSchema = z.object({
  resume_file: assetReferenceSchema.optional(),
  resume_text: z.string().trim().min(1).max(50000).optional(),
  cover_letter: z.string().trim().min(1).max(10000).optional(),
}).strict();

// Historical documents without attempt fields represent attempt 1. A terminal
// history remains immutable within its attempt; reapplying starts a new history.
export const previousAttemptSchema = z.object({
  attempt_number: z.number().int().positive(),
  request_id: z.string().uuid().optional(),
  current_stage: z.literal('WITHDRAWN'),
  stage_history: z.array(stageEventSchema).min(1),
  applied_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  submission: submissionSchema.optional(),
  recruiter_note: z.string().trim().min(1).optional(),
}).strict();

export const applicationDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^application:pair:[a-f0-9]{64}$/, 'Invalid Application _id format. Expected application:pair:<sha256>'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.APPLICATION),
    candidate_id: z
      .string()
      .regex(/^candidate:(cms:R_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid candidate_id format'),
    job_id: z
      .string()
      .regex(/^job:(cms:J_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid job_id format'),
    current_stage: z.enum([
      APPLICATION_STAGES.APPLIED,
      APPLICATION_STAGES.SCREENING,
      APPLICATION_STAGES.INTERVIEW,
      APPLICATION_STAGES.OFFER,
      APPLICATION_STAGES.HIRED,
      APPLICATION_STAGES.REJECTED,
      APPLICATION_STAGES.WITHDRAWN,
    ]),
    stage_history: z
      .array(stageEventSchema)
      .min(1, 'stage_history must contain at least the initial event'),
    applied_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    recruiter_note: z.string().trim().min(1).optional(),
    submission: submissionSchema.optional(),
    attempt_number: z.number().int().positive().optional(),
    request_id: z.string().uuid().optional(),
    previous_attempts: z.array(previousAttemptSchema).optional(),
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((app, ctx) => {
    const previous = app.previous_attempts || [];
    if ((app.attempt_number || 1) !== previous.length + 1) {
      ctx.addIssue({ code: 'custom', path: ['attempt_number'], message: 'Attempt sequence must be contiguous.' });
    }
    const keys = [app.request_id, ...previous.map(attempt => attempt.request_id)].filter(Boolean);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['request_id'], message: 'Request IDs must be unique across attempts.' });
    previous.forEach((attempt, index) => {
      const check = validateStageHistory(attempt.stage_history, attempt.applied_at, attempt.current_stage, attempt.updated_at);
      const next = previous[index + 1] || app;
      if (attempt.attempt_number !== index + 1 || !check.valid || Date.parse(attempt.updated_at) >= Date.parse(next.applied_at)) {
        ctx.addIssue({ code: 'custom', path: ['previous_attempts', index], message: 'Invalid archived attempt sequence or history.' });
      }
    });
    // 1. Validate _id derivation from candidate_id and job_id
    if (app.candidate_id && app.job_id) {
      let expectedId;
      try {
        expectedId = applicationIdFromPair(app.candidate_id, app.job_id);
      } catch (err) {
        ctx.addIssue({
          code: 'custom',
          message: `Cannot compute Application _id: ${err.message}`,
          path: ['_id'],
        });
        return;
      }

      if (app._id !== expectedId) {
        ctx.addIssue({
          code: 'custom',
          message: `Application _id ("${app._id}") does not match canonical pair hash ("${expectedId}")`,
          path: ['_id'],
        });
      }
    }

    // 2. Validate entire stage_history progression
    const historyCheck = validateStageHistory(
      app.stage_history,
      app.applied_at,
      app.current_stage,
      app.updated_at
    );

    if (!historyCheck.valid) {
      for (const err of historyCheck.errors) {
        ctx.addIssue({
          code: 'custom',
          message: err,
          path: ['stage_history'],
        });
      }
    }
  });
