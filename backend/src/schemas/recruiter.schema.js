/**
 * DATA-03.1 Recruiter Business Document Schema & Scope Validation
 * 
 * Defines Zod validation schema for the Recruiter document:
 * - Deterministic ID with prefix recruiter:
 * - Required references to user_id, company_id, and department_id
 * - Monotonic UTC timestamps
 * - Strict rejection of unknown / legacy fields (including email, jobs, and full_name at root)
 * - Pure Cross-Document Validator for Recruiter Organization Scope (Rule E)
 */

import { z } from 'zod';
import {
  DOCUMENT_TYPES,
  PROVENANCE_CLASSIFICATIONS,
  USER_ROLES,
} from '../constants/document.constants.js';
import {
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';
import { companyDocumentSchema } from './company.schema.js';
import { departmentDocumentSchema } from './department.schema.js';
import { userDocumentSchema } from './user.schema.js';
import { recruiterContactSchema } from './recruiter-profile.schema.js';

/**
 * Recruiter Business Document Schema
 */
export const recruiterDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^recruiter:[a-z0-9_:-]+$/, 'Invalid Recruiter _id format. Expected prefix "recruiter:"'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.RECRUITER),
    profile: recruiterContactSchema.optional(),
    user_id: z
      .string()
      .regex(/^user:[a-f0-9]{64}$/, 'Invalid user_id reference format. Expected user:<sha256>'),
    company_id: z
      .string()
      .regex(/^company:[a-z0-9_:-]+$/, 'Invalid company_id reference format. Expected prefix "company:"'),
    department_id: z
      .string()
      .regex(/^department:[a-z0-9_:-]+$/, 'Invalid department_id reference format. Expected prefix "department:"'),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((recruiter, ctx) => {
    // 1. Monotonic timestamps: updated_at >= created_at
    if (recruiter.created_at && recruiter.updated_at) {
      const createdTime = new Date(recruiter.created_at).getTime();
      const updatedTime = new Date(recruiter.updated_at).getTime();
      if (updatedTime < createdTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'updated_at cannot be earlier than created_at',
          path: ['updated_at'],
        });
      }
    }

    // 2. Synthetic Recruiter provenance validation (Rule C)
    if (recruiter.provenance.classification === PROVENANCE_CLASSIFICATIONS.SYNTHETIC) {
      if (!recruiter.provenance.generator_seed || !recruiter.provenance.generator_seed.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic Recruiter provenance must include non-empty generator_seed',
          path: ['provenance', 'generator_seed'],
        });
      }
      if (!recruiter.provenance.generator_version || !recruiter.provenance.generator_version.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic Recruiter provenance must include non-empty generator_version',
          path: ['provenance', 'generator_version'],
        });
      }
    }
  });

/**
 * Pure Cross-Document Validator for Recruiter Organization Scope (Rule E).
 * Verifies invariants across four related documents:
 * 1. recruiter.user_id === user._id
 * 2. recruiter.company_id === company._id
 * 3. recruiter.department_id === department._id
 * 4. department.company_id === company._id
 * 5. user.role === "RECRUITER"
 * 
 * Validates individual document shapes before checking reference equality.
 * Does NOT access CouchDB or assume database-level foreign key constraints.
 * 
 * @param {Object} documents
 * @param {Object} documents.recruiter - Recruiter business document
 * @param {Object} documents.company - Company business document
 * @param {Object} documents.department - Department business document
 * @param {Object} documents.user - User business document
 * @param {Object} [options]
 * @param {boolean} [options.throwOnError=false] - Whether to throw an Error on validation failure
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRecruiterOrganizationScope({ recruiter, company, department, user } = {}, options = {}) {
  const { throwOnError = false } = options;
  const errors = [];

  if (!recruiter) errors.push('Missing required document: recruiter');
  if (!company) errors.push('Missing required document: company');
  if (!department) errors.push('Missing required document: department');
  if (!user) errors.push('Missing required document: user');

  if (errors.length > 0) {
    if (throwOnError) {
      throw new Error(`Recruiter organization scope validation failed: ${errors.join('; ')}`);
    }
    return { valid: false, errors };
  }

  // 1. Validate document shapes first
  const recruiterShape = recruiterDocumentSchema.safeParse(recruiter);
  if (!recruiterShape.success) {
    errors.push(`Invalid recruiter shape: ${recruiterShape.error.issues.map((i) => i.message).join(', ')}`);
  }

  const companyShape = companyDocumentSchema.safeParse(company);
  if (!companyShape.success) {
    errors.push(`Invalid company shape: ${companyShape.error.issues.map((i) => i.message).join(', ')}`);
  }

  const departmentShape = departmentDocumentSchema.safeParse(department);
  if (!departmentShape.success) {
    errors.push(`Invalid department shape: ${departmentShape.error.issues.map((i) => i.message).join(', ')}`);
  }

  const userShape = userDocumentSchema.safeParse(user);
  if (!userShape.success) {
    errors.push(`Invalid user shape: ${userShape.error.issues.map((i) => i.message).join(', ')}`);
  }

  if (errors.length > 0) {
    if (throwOnError) {
      throw new Error(`Recruiter organization scope validation failed: ${errors.join('; ')}`);
    }
    return { valid: false, errors };
  }

  // 2. Verify reference equality and scoping invariants
  if (recruiter.user_id !== user._id) {
    errors.push(`Reference mismatch: recruiter.user_id ("${recruiter.user_id}") !== user._id ("${user._id}")`);
  }

  if (recruiter.company_id !== company._id) {
    errors.push(`Reference mismatch: recruiter.company_id ("${recruiter.company_id}") !== company._id ("${company._id}")`);
  }

  if (recruiter.department_id !== department._id) {
    errors.push(`Reference mismatch: recruiter.department_id ("${recruiter.department_id}") !== department._id ("${department._id}")`);
  }

  if (department.company_id !== company._id) {
    errors.push(`Scoping violation: department.company_id ("${department.company_id}") does not match company._id ("${company._id}")`);
  }

  if (user.role !== USER_ROLES.RECRUITER) {
    errors.push(`Role invariant violated: referenced User role must be RECRUITER, received "${user.role}"`);
  }

  const valid = errors.length === 0;
  if (!valid && throwOnError) {
    throw new Error(`Recruiter organization scope validation failed: ${errors.join('; ')}`);
  }

  return { valid, errors };
}
