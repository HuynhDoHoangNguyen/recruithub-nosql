/**
 * DATA-03.4A Resume Analysis Business Document Schema
 * 
 * Defines Zod validation schema for the Resume Analysis document:
 * - Deterministic single analysis ID: analysis:<application_id>
 * - Strict COMPLETE vs INCOMPLETE invariants
 * - Bounded component details and missing inputs explanations
 * - Strict rejection of unknown / legacy fields
 */

import { z } from 'zod';
import {
  DOCUMENT_TYPES,
} from '../constants/document.constants.js';
import {
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';

export const SCORING_ALGORITHM_VERSION = 'recruithub-scoring-mvp-v1';

export const RECOMMENDATION_LEVELS = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const ANALYSIS_STATUSES = Object.freeze({
  COMPLETE: 'COMPLETE',
  INCOMPLETE: 'INCOMPLETE',
});

export const SCORING_WEIGHTS = Object.freeze({
  SKILL: 0.50,
  EXPERIENCE: 0.25,
  EDUCATION: 0.10,
  PROJECT: 0.15,
});

export const RECOMMENDATION_THRESHOLDS = Object.freeze({
  HIGH: 80.0,
  MEDIUM: 60.0,
});

/**
 * Missing input detail item in missing_inputs[]
 */
export const missingInputItemSchema = z
  .object({
    component: z.enum(['skill', 'experience', 'education', 'project']),
    code: z.string().trim().min(1, 'Missing input code cannot be empty'),
    message: z.string().trim().min(1, 'Missing input message cannot be empty'),
  })
  .strict();

/**
 * Component score details bounded schema
 */
export const componentDetailsSchema = z
  .object({
    skill: z
      .object({
        formula_id: z.literal('SKILL-COV'),
        matched_count: z.number().int().nonnegative(),
        required_count: z.number().int().nonnegative(),
        matched_skills: z.array(z.string().trim().min(1)),
        missing_skills: z.array(z.string().trim().min(1)),
        unrounded_score: z.number().min(0).max(100).nullable(),
      })
      .strict(),
    experience: z
      .object({
        formula_id: z.literal('EXP-A'),
        candidate_months: z.number().int().nonnegative().nullable(),
        required_months: z.number().int().positive().nullable(),
        requirement_status: z.string().trim().min(1),
        unrounded_score: z.number().min(0).max(100).nullable(),
      })
      .strict(),
    education: z
      .object({
        formula_id: z.literal('EDU-B'),
        candidate_degree: z.string().trim().min(1).nullable(),
        candidate_rank: z.number().int().nonnegative().nullable(),
        minimum_degree: z.string().trim().min(1).nullable(),
        minimum_rank: z.number().int().positive().nullable(),
        requirement_status: z.string().trim().min(1),
        unrounded_score: z.number().min(0).max(100).nullable(),
      })
      .strict(),
    project: z
      .object({
        formula_id: z.literal('PROJ-A'),
        candidate_technologies: z.array(z.string().trim().min(1)),
        required_technologies: z.array(z.string().trim().min(1)),
        matched_technologies: z.array(z.string().trim().min(1)),
        missing_technologies: z.array(z.string().trim().min(1)),
        requirement_status: z.string().trim().min(1),
        unrounded_score: z.number().min(0).max(100).nullable(),
      })
      .strict(),
  })
  .strict();

/**
 * Resume Analysis Business Document Schema
 */
export const resumeAnalysisDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^analysis:application:pair:[a-f0-9]{64}$/, 'Invalid Resume Analysis _id. Expected analysis:application:pair:<sha256>'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.RESUME_ANALYSIS),
    application_id: z
      .string()
      .regex(/^application:pair:[a-f0-9]{64}$/, 'Invalid application_id reference format'),
    candidate_id: z
      .string()
      .regex(/^candidate:(cms:R_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid candidate_id reference format'),
    job_id: z
      .string()
      .regex(/^job:(cms:J_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid job_id reference format'),
    analysis_status: z.enum([ANALYSIS_STATUSES.COMPLETE, ANALYSIS_STATUSES.INCOMPLETE]),
    scores: z
      .object({
        skill: z.number().min(0).max(100).nullable(),
        experience: z.number().min(0).max(100).nullable(),
        education: z.number().min(0).max(100).nullable(),
        project: z.number().min(0).max(100).nullable(),
      })
      .strict(),
    matched_skills: z.array(z.string().trim().min(1)),
    missing_skills: z.array(z.string().trim().min(1)),
    component_details: componentDetailsSchema,
    missing_inputs: z.array(missingInputItemSchema),
    total_score: z.number().min(0).max(100).optional(),
    recommendation: z.enum([
      RECOMMENDATION_LEVELS.HIGH,
      RECOMMENDATION_LEVELS.MEDIUM,
      RECOMMENDATION_LEVELS.LOW,
    ]).optional(),
    algorithm_version: z.literal(SCORING_ALGORITHM_VERSION),
    input_fingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'input_fingerprint must be a 64-character lowercase hex digest'),
    analyzed_at: isoDateTimeSchema,
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((analysis, ctx) => {
    // 1. Deterministic _id consistency check
    if (analysis.application_id) {
      const expectedId = `analysis:${analysis.application_id}`;
      if (analysis._id !== expectedId) {
        ctx.addIssue({
          code: 'custom',
          message: `Resume Analysis _id ("${analysis._id}") must equal "${expectedId}"`,
          path: ['_id'],
        });
      }
    }

    // 2. COMPLETE status invariants
    if (analysis.analysis_status === ANALYSIS_STATUSES.COMPLETE) {
      if (
        analysis.scores.skill === null ||
        analysis.scores.experience === null ||
        analysis.scores.education === null ||
        analysis.scores.project === null
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'COMPLETE analysis must have non-null numeric scores for all 4 components (skill, experience, education, project)',
          path: ['scores'],
        });
      }

      if (analysis.total_score === undefined || analysis.total_score === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'COMPLETE analysis requires a valid numeric total_score',
          path: ['total_score'],
        });
      } else {
        // Validate unrounded weighted total formula consistency with tolerance 1e-6
        if (
          analysis.scores.skill !== null &&
          analysis.scores.experience !== null &&
          analysis.scores.education !== null &&
          analysis.scores.project !== null
        ) {
          const expectedTotal =
            SCORING_WEIGHTS.SKILL * analysis.scores.skill +
            SCORING_WEIGHTS.EXPERIENCE * analysis.scores.experience +
            SCORING_WEIGHTS.EDUCATION * analysis.scores.education +
            SCORING_WEIGHTS.PROJECT * analysis.scores.project;

          if (Math.abs(analysis.total_score - expectedTotal) > 1e-6) {
            ctx.addIssue({
              code: 'custom',
              message: `total_score (${analysis.total_score}) does not match expected weighted sum (${expectedTotal})`,
              path: ['total_score'],
            });
          }
        }
      }

      if (!analysis.recommendation) {
        ctx.addIssue({
          code: 'custom',
          message: 'COMPLETE analysis requires recommendation classification (HIGH, MEDIUM, or LOW)',
          path: ['recommendation'],
        });
      } else if (analysis.total_score !== undefined && analysis.total_score !== null) {
        // Validate recommendation threshold alignment
        let expectedRec;
        if (analysis.total_score >= RECOMMENDATION_THRESHOLDS.HIGH) {
          expectedRec = RECOMMENDATION_LEVELS.HIGH;
        } else if (analysis.total_score >= RECOMMENDATION_THRESHOLDS.MEDIUM) {
          expectedRec = RECOMMENDATION_LEVELS.MEDIUM;
        } else {
          expectedRec = RECOMMENDATION_LEVELS.LOW;
        }

        if (analysis.recommendation !== expectedRec) {
          ctx.addIssue({
            code: 'custom',
            message: `recommendation ("${analysis.recommendation}") does not match score ${analysis.total_score} (expected "${expectedRec}")`,
            path: ['recommendation'],
          });
        }
      }

      if (analysis.missing_inputs.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'COMPLETE analysis must have an empty missing_inputs array',
          path: ['missing_inputs'],
        });
      }
    }

    // 3. INCOMPLETE status invariants
    if (analysis.analysis_status === ANALYSIS_STATUSES.INCOMPLETE) {
      if (analysis.total_score !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'INCOMPLETE analysis must omit total_score',
          path: ['total_score'],
        });
      }

      if (analysis.recommendation !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'INCOMPLETE analysis must omit recommendation',
          path: ['recommendation'],
        });
      }

      if (analysis.missing_inputs.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'INCOMPLETE analysis must declare at least one missing input explanation',
          path: ['missing_inputs'],
        });
      }

      const hasNullScore =
        analysis.scores.skill === null ||
        analysis.scores.experience === null ||
        analysis.scores.education === null ||
        analysis.scores.project === null;

      if (!hasNullScore) {
        ctx.addIssue({
          code: 'custom',
          message: 'INCOMPLETE analysis must have at least one component score set to null',
          path: ['scores'],
        });
      }
    }
  });
