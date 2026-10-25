/**
 * DATA-02A Job Document Schema
 * 
 * Defines Zod validation schemas for:
 * - Job Final Business Document (requires company_id, department_id, recruiter_id)
 * - Job Staged Record (pre-organization resolution)
 * 
 * Enforces canonical requirement paths, conditional requirement validation,
 * disjoint required/optional skills, and strictly rejects legacy/provisional fields.
 */

import { z } from 'zod';
import { JOB_LOCATIONS, WORK_MODES, JOB_SENIORITY_VALUES, EMPLOYMENT_TYPES } from '../constants/job-catalog.constants.js';
import { salarySchema } from './job-compensation.schema.js';
import {
  CANONICAL_DEGREES,
  DOCUMENT_TYPES,
  ID_PREFIXES,
  JOB_STATUSES,
  REQUIREMENT_STATUSES,
} from '../constants/document.constants.js';
import {
  canonicalDegreeSchema,
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';

/**
 * Job Experience Requirement Schema.
 * Conditional: required_months is required only when status === 'REQUIRED'.
 */
export const jobExperienceRequirementSchema = z
  .object({
    status: z.enum([
      REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED,
      REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM,
      REQUIREMENT_STATUSES.EXPERIENCE.UNAVAILABLE,
    ]),
    required_months: z
      .number()
      .int('required_months must be an integer')
      .positive('required_months must be positive')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED) {
      if (data.required_months === undefined || data.required_months === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'required_months is required when experience requirement status is REQUIRED',
          path: ['required_months'],
        });
      }
    } else {
      if (data.required_months !== undefined && data.required_months !== null) {
        ctx.addIssue({
          code: 'custom',
          message: `required_months must not be provided when experience requirement status is ${data.status}`,
          path: ['required_months'],
        });
      }
    }
  });

/**
 * Job Education Requirement Schema.
 * Conditional: minimum_degree is required only when status === 'REQUIRED'.
 */
export const jobEducationRequirementSchema = z
  .object({
    status: z.enum([
      REQUIREMENT_STATUSES.EDUCATION.REQUIRED,
      REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM,
      REQUIREMENT_STATUSES.EDUCATION.UNAVAILABLE,
    ]),
    minimum_degree: canonicalDegreeSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === REQUIREMENT_STATUSES.EDUCATION.REQUIRED) {
      if (!data.minimum_degree) {
        ctx.addIssue({
          code: 'custom',
          message: 'minimum_degree is required when education requirement status is REQUIRED',
          path: ['minimum_degree'],
        });
      }
    } else {
      if (data.minimum_degree !== undefined && data.minimum_degree !== null) {
        ctx.addIssue({
          code: 'custom',
          message: `minimum_degree must not be provided when education requirement status is ${data.status}`,
          path: ['minimum_degree'],
        });
      }
    }
  });

/**
 * Job Project Requirement Schema.
 * Conditional: required_technologies is a non-empty unique array only when status === 'REQUIRED'.
 */
export const jobProjectRequirementSchema = z
  .object({
    status: z.enum([
      REQUIREMENT_STATUSES.PROJECT.REQUIRED,
      REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT,
      REQUIREMENT_STATUSES.PROJECT.UNAVAILABLE,
    ]),
    required_technologies: z
      .array(z.string().trim().min(1, 'Technology name cannot be empty'))
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === REQUIREMENT_STATUSES.PROJECT.REQUIRED) {
      if (!data.required_technologies || data.required_technologies.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'required_technologies array cannot be empty when project requirement status is REQUIRED',
          path: ['required_technologies'],
        });
      } else {
        // Check uniqueness of technologies
        const seen = new Set();
        data.required_technologies.forEach((tech, idx) => {
          const lower = tech.toLowerCase();
          if (seen.has(lower)) {
            ctx.addIssue({
              code: 'custom',
              message: `Duplicate technology in required_technologies: "${tech}"`,
              path: ['required_technologies', idx],
            });
          }
          seen.add(lower);
        });
      }
    } else {
      if (data.required_technologies !== undefined && data.required_technologies !== null) {
        ctx.addIssue({
          code: 'custom',
          message: `required_technologies must not be provided when project requirement status is ${data.status}`,
          path: ['required_technologies'],
        });
      }
    }
  });

/**
 * Canonical Job Requirements Group (DATA-02A Section 7).
 */
export const jobRequirementsSchema = z
  .object({
    general: z.array(z.string().trim().min(1)),
    experience: jobExperienceRequirementSchema,
    education: jobEducationRequirementSchema,
    project: jobProjectRequirementSchema,
  })
  .strict();

/**
 * Shared refinement logic for Job documents.
 */
function refineJobData(job, ctx) {
  if (job.deleted_at && job.status !== 'CLOSED') ctx.addIssue({ code: 'custom', path: ['deleted_at'], message: 'Deleted jobs must remain CLOSED.' });
  // 1. Check duplicate skills within required_skills
  const seenReq = new Set();
  if (Array.isArray(job.required_skills)) {
    job.required_skills.forEach((skill, idx) => {
      const lower = skill.toLowerCase();
      if (seenReq.has(lower)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate skill in required_skills: "${skill}"`,
          path: ['required_skills', idx],
        });
      }
      seenReq.add(lower);
    });
  }

  // 2. Check duplicate skills within optional_skills
  const seenOpt = new Set();
  if (Array.isArray(job.optional_skills)) {
    job.optional_skills.forEach((skill, idx) => {
      const lower = skill.toLowerCase();
      if (seenOpt.has(lower)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate skill in optional_skills: "${skill}"`,
          path: ['optional_skills', idx],
        });
      }
      seenOpt.add(lower);
    });
  }

  // 3. Disjoint check: required_skills and optional_skills must NOT overlap (Rule 9)
  if (Array.isArray(job.optional_skills)) {
    job.optional_skills.forEach((skill, idx) => {
      const lower = skill.toLowerCase();
      if (seenReq.has(lower)) {
        ctx.addIssue({
          code: 'custom',
          message: `Skill "${skill}" cannot be present in both required_skills and optional_skills`,
          path: ['optional_skills', idx],
        });
      }
    });
  }

  // 4. OPEN Job requires deadline (DATA-02A Section 7)
  if (job.status === JOB_STATUSES.OPEN && !job.deadline) {
    ctx.addIssue({
      code: 'custom',
      message: 'An OPEN Job requires a deadline timestamp',
      path: ['deadline'],
    });
  }

  // 5. Monotonic timestamps: updated_at >= created_at
  if (job.created_at && job.updated_at) {
    const createdTime = new Date(job.created_at).getTime();
    const updatedTime = new Date(job.updated_at).getTime();
    if (updatedTime < createdTime) {
      ctx.addIssue({
        code: 'custom',
        message: 'updated_at cannot be earlier than created_at',
        path: ['updated_at'],
      });
    }
  }
}

/**
 * Base Job fields without organization references.
 */
const jobBaseObject = {
  employment_type: z.enum(EMPLOYMENT_TYPES.map(option => option.value)).optional(),
  salary: salarySchema.optional(),
  deleted_at: isoDateTimeSchema.optional(),
  location: z.enum(JOB_LOCATIONS.map(option => option.value)).optional(),
  work_mode: z.enum(WORK_MODES.map(option => option.value)).optional(),
  _id: z
    .string()
    .regex(/^job:(cms:J_[0-9]{6}|[a-z0-9_-]+)$/, 'Invalid Job _id format'),
  _rev: z.string().optional(),
  type: z.literal(DOCUMENT_TYPES.JOB),
  source_job_id: z.string().optional(),
  title: z.string().trim().min(1, 'Job title cannot be empty'),
  seniority: z.enum(JOB_SENIORITY_VALUES),
  industry: z.string().trim().min(1, 'Industry cannot be empty'),
  description: z.string().trim().min(1, 'Description cannot be empty'),
  responsibilities: z.array(z.string().trim().min(1)),
  requirements: jobRequirementsSchema,
  required_skills: z
    .array(z.string().trim().min(1))
    .min(1, 'required_skills must contain at least one skill'),
  optional_skills: z.array(z.string().trim().min(1)),
  status: z.enum([JOB_STATUSES.DRAFT, JOB_STATUSES.OPEN, JOB_STATUSES.CLOSED]),
  deadline: isoDateTimeSchema.optional(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  published_at: isoDateTimeSchema.optional(),
  provenance: provenanceSchema,
};

/**
 * Final Job Business Document Schema
 * Requires valid company_id, department_id, recruiter_id references.
 */
export const jobDocumentSchema = z
  .object({
    ...jobBaseObject,
    company_id: z
      .string()
      .regex(/^company:[a-z0-9_:-]+$/, 'Invalid company_id reference format'),
    department_id: z
      .string()
      .regex(/^department:[a-z0-9_:-]+$/, 'Invalid department_id reference format'),
    recruiter_id: z
      .string()
      .regex(/^recruiter:[a-z0-9_:-]+$/, 'Invalid recruiter_id reference format'),
  })
  .strict()
  .superRefine(refineJobData);

/**
 * Staged Job Schema
 * Allows job staging before Organization & Recruiter reference resolution.
 */
export const stagedJobSchema = z
  .object({
    ...jobBaseObject,
    company_id: z
      .string()
      .regex(/^company:[a-z0-9_:-]+$/)
      .optional(),
    department_id: z
      .string()
      .regex(/^department:[a-z0-9_:-]+$/)
      .optional(),
    recruiter_id: z
      .string()
      .regex(/^recruiter:[a-z0-9_:-]+$/)
      .optional(),
  })
  .strict()
  .superRefine(refineJobData);
