/**
 * DATA-02A Candidate Document Schema
 * 
 * Defines Zod validation schemas for:
 * - Candidate Final Business Document (requires user_id reference)
 * - Candidate Staged Record (pre-user resolution)
 * 
 * Enforces partial profile support, availability consistency,
 * deterministic skill uniqueness, and strictly rejects legacy/invented fields.
 */

import { z } from 'zod';
import { assetReferenceSchema } from './upload.schema.js';
import {
  AVAILABILITY_STATES,
  DOCUMENT_TYPES,
  ID_PREFIXES,
  PROVENANCE_CLASSIFICATIONS,
  SENIORITY_LEVELS,
} from '../constants/document.constants.js';
import {
  dataAvailabilitySchema,
  employmentItemSchema,
  experienceSummarySchema,
  isoDateTimeSchema,
  partialEducationItemSchema,
  projectItemSchema,
  provenanceSchema,
  skillItemSchema,
} from './common.schema.js';
import { normalizeSkill } from '../utils/normalization.utils.js';

/**
 * Candidate profile object schema.
 */
export const candidateProfileSchema = z
  .object({
    role: z.string().trim().min(1, 'Candidate role cannot be empty'),
    seniority: z.enum([
      SENIORITY_LEVELS.JUNIOR,
      SENIORITY_LEVELS.MID,
      SENIORITY_LEVELS.SENIOR,
    ]),
    industry: z.string().trim().min(1, 'Industry cannot be empty'),
    years_experience: z.number().int().nonnegative('Years experience cannot be negative'),
    experience_months: z.number().int().nonnegative('Experience months cannot be negative'),
    summary: z.string().trim().min(1).optional(),
    full_name: z.string().trim().min(1).optional(),
    phone: z.string().trim().max(40).optional(),
    location: z.string().trim().max(160).optional(),
  })
  .strict()
  .superRefine((profile, ctx) => {
    if (profile.experience_months !== profile.years_experience * 12) {
      ctx.addIssue({
        code: 'custom',
        message: `experience_months (${profile.experience_months}) must equal years_experience * 12 (${profile.years_experience * 12})`,
        path: ['experience_months'],
      });
    }
  });

/**
 * Refinement logic shared between final and staged Candidate schemas.
 * Enforces:
 * 1. Normalized skills must be unique (no duplicates).
 * 2. updated_at >= created_at.
 * 3. data_availability consistency with actual array contents.
 */
function refineCandidateData(candidate, ctx) {
  // 1. Skill canonical consistency and uniqueness
  if (Array.isArray(candidate.skills)) {
    const seenSkills = new Set();
    candidate.skills.forEach((skill, index) => {
      if (!skill?.name || !skill?.normalized) return;
      const canonical = normalizeSkill(skill.name);
      if (skill.normalized !== canonical) {
        ctx.addIssue({
          code: 'custom',
          message: `Normalized skill "${skill.normalized}" must equal canonical value "${canonical}" derived from name`,
          path: ['skills', index, 'normalized'],
        });
      }
      if (seenSkills.has(canonical)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate normalized skill detected (canonical collision): "${canonical}"`,
          path: ['skills', index, 'normalized'],
        });
      }
      seenSkills.add(canonical);
    });
  }

  // 2. Monotonic timestamps
  if (candidate.created_at && candidate.updated_at) {
    const createdTime = new Date(candidate.created_at).getTime();
    const updatedTime = new Date(candidate.updated_at).getTime();
    if (updatedTime < createdTime) {
      ctx.addIssue({
        code: 'custom',
        message: 'updated_at cannot be earlier than created_at',
        path: ['updated_at'],
      });
    }
  }

  // 3. Availability consistency (Rule 4 / Rule 12)
  const availability = candidate.data_availability;
  if (availability) {
    // Projects availability checks
    if (
      availability.projects === AVAILABILITY_STATES.NONE_DECLARED &&
      Array.isArray(candidate.projects) &&
      candidate.projects.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'projects array must be empty when data_availability.projects is NONE_DECLARED',
        path: ['projects'],
      });
    }

    if (
      availability.projects === AVAILABILITY_STATES.UNAVAILABLE &&
      Array.isArray(candidate.projects) &&
      candidate.projects.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'projects array must be empty when data_availability.projects is UNAVAILABLE',
        path: ['projects'],
      });
    }

    // Education availability checks
    if (
      availability.education === AVAILABILITY_STATES.NONE_DECLARED &&
      Array.isArray(candidate.education) &&
      candidate.education.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'education array must be empty when data_availability.education is NONE_DECLARED',
        path: ['education'],
      });
    }

    if (
      availability.education === AVAILABILITY_STATES.UNAVAILABLE &&
      Array.isArray(candidate.education) &&
      candidate.education.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'education array must be empty when data_availability.education is UNAVAILABLE',
        path: ['education'],
      });
    }

    // Skills availability checks
    if (
      availability.skills === AVAILABILITY_STATES.NONE_DECLARED &&
      Array.isArray(candidate.skills) &&
      candidate.skills.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'skills array must be empty when data_availability.skills is NONE_DECLARED',
        path: ['skills'],
      });
    }

    if (
      availability.skills === AVAILABILITY_STATES.UNAVAILABLE &&
      Array.isArray(candidate.skills) &&
      candidate.skills.length > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'skills array must be empty when data_availability.skills is UNAVAILABLE',
        path: ['skills'],
      });
    }
  }
}

/**
 * Base candidate object definition without reference constraints.
 */
const candidateBaseObject = {
  resume_file: assetReferenceSchema.optional(),
  avatar: assetReferenceSchema.optional(),
  languages: z.array(z.object({ name: z.string().trim().min(1).max(80), proficiency: z.string().trim().max(120).optional() }).strict()).max(20).optional(),
  _id: z
    .string()
    .regex(/^candidate:(cms:R_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid Candidate _id format'),
  _rev: z.string().optional(),
  type: z.literal(DOCUMENT_TYPES.CANDIDATE),
  source_resume_id: z.string().optional(),
  profile: candidateProfileSchema,
  skills: z.array(skillItemSchema),
  education: z.array(partialEducationItemSchema),
  experience_summary: experienceSummarySchema.optional(),
  experience: z.array(employmentItemSchema),
  projects: z.array(projectItemSchema),
  data_availability: dataAvailabilitySchema,
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  provenance: provenanceSchema,
};

/**
 * Final Candidate Business Document Schema
 * Requires valid user_id reference.
 */
export const candidateDocumentSchema = z
  .object({
    ...candidateBaseObject,
    user_id: z
      .string()
      .regex(/^user:[a-f0-9]{64}$/, 'Invalid user_id reference format. Expected user:<sha256>'),
  })
  .strict()
  .superRefine(refineCandidateData);

/**
 * Staged Candidate Schema
 * Allows candidate data staging before User identity resolution (user_id is optional).
 * Explicitly distinguished from the final import-ready business document.
 */
export const stagedCandidateSchema = z
  .object({
    ...candidateBaseObject,
    user_id: z
      .string()
      .regex(/^user:[a-f0-9]{64}$/, 'Invalid user_id reference format')
      .optional(),
  })
  .strict()
  .superRefine(refineCandidateData);
