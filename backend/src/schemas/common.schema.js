/**
 * DATA-02A Common Zod Schemas
 * 
 * Provides base validation schemas for timestamps, provenance, availability,
 * skills, partial education, experience summary, and project items.
 */

import { z } from 'zod';
import {
  AVAILABILITY_STATES,
  CANONICAL_DEGREES,
  PROVENANCE_CLASSIFICATIONS,
} from '../constants/document.constants.js';

/**
 * ISO-8601 UTC timestamp format.
 */
export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'Invalid ISO-8601 UTC timestamp format'
  );

/**
 * Approved Provenance Schema (DATA-02A Section 3.2).
 */
export const provenanceSchema = z
  .object({
    classification: z.enum([
      PROVENANCE_CLASSIFICATIONS.SOURCE,
      PROVENANCE_CLASSIFICATIONS.NORMALIZED,
      PROVENANCE_CLASSIFICATIONS.DERIVED,
      PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      PROVENANCE_CLASSIFICATIONS.MIXED,
      PROVENANCE_CLASSIFICATIONS.UNAVAILABLE,
    ]),
    source_dataset: z.string().trim().min(1).optional(),
    source_ids: z.record(z.string(), z.string()).optional(),
    source_hashes: z.record(z.string(), z.string()).optional(),
    source_file: z.string().trim().min(1).optional(),
    source_version: z.string().trim().min(1).optional(),
    generator_seed: z.string().trim().min(1).optional(),
    generator_version: z.string().trim().min(1).optional(),
    transform_version: z.string().trim().min(1).optional(),
    field_origins: z.record(z.string(), z.string()).optional(),
    selection_basis: z.string().trim().min(1).optional(),
    generated: z.boolean().optional(),
  })
  .strict();

/** Provenance contract for newly created documents; unavailable is legacy-only. */
export const newDocumentProvenanceSchema = provenanceSchema.refine(
  (provenance) => provenance.classification !== PROVENANCE_CLASSIFICATIONS.UNAVAILABLE,
  { message: 'New documents cannot use unavailable provenance classification.', path: ['classification'] },
);

/**
 * Availability state enumeration schema (DATA-02A Section 3.3).
 */
export const availabilityStateSchema = z.enum([
  AVAILABILITY_STATES.AVAILABLE,
  AVAILABILITY_STATES.PARTIAL,
  AVAILABILITY_STATES.NONE_DECLARED,
  AVAILABILITY_STATES.SYNTHETIC,
  AVAILABILITY_STATES.UNAVAILABLE,
]);

/**
 * Canonical Degree tier enumeration schema (DATA-02A Section 7).
 */
export const canonicalDegreeSchema = z.enum([
  CANONICAL_DEGREES.HIGH_SCHOOL,
  CANONICAL_DEGREES.BACHELOR,
  CANONICAL_DEGREES.MASTER,
  CANONICAL_DEGREES.DOCTORATE,
]);

/**
 * Skill item representation embedded in Candidate.
 */
export const skillItemSchema = z
  .object({
    name: z.string().trim().min(1, 'Skill name cannot be empty'),
    normalized: z.string().trim().min(1, 'Normalized skill cannot be empty'),
  })
  .strict();

/**
 * Partial Education Item (DATA-02A Section 5 & Rule 4).
 * Degree is required when item exists; school, field, dates are optional.
 */
export const partialEducationItemSchema = z
  .object({
    degree: canonicalDegreeSchema,
    institution: z.string().trim().min(1).optional(),
    field_of_study: z.string().trim().min(1).optional(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Experience Summary containing source bullets.
 */
export const experienceSummarySchema = z
  .object({
    bullets: z.array(z.string().trim().min(1)),
    total_months: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * Employment detail item for experience[] array (empty for audited dataset).
 */
export const employmentItemSchema = z
  .object({
    employer: z.string().trim().min(1).optional(),
    role: z.string().trim().min(1).optional(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Structured project item with item-level provenance for synthetic inputs (Rule 4 / Rule 13).
 */
export const projectItemSchema = z
  .object({
    name: z.string().trim().min(1, 'Project name cannot be empty'),
    description: z.string().trim().min(1).optional(),
    technologies: z.array(z.string().trim().min(1)),
    role: z.string().trim().min(1).optional(),
    is_synthetic: z.boolean().optional(),
    provenance: provenanceSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // If project is marked synthetic, it must carry synthetic provenance
    if (data.is_synthetic === true) {
      if (!data.provenance || data.provenance.classification !== PROVENANCE_CLASSIFICATIONS.SYNTHETIC) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic project items must include item-level provenance with classification="synthetic"',
          path: ['provenance'],
        });
      }
    }
  });

/**
 * Availability state for all 4 score-bearing groups.
 */
export const dataAvailabilitySchema = z
  .object({
    skills: availabilityStateSchema,
    experience: availabilityStateSchema,
    education: availabilityStateSchema,
    projects: availabilityStateSchema,
  })
  .strict();
