/**
 * DATA-03.1 Department Business Document Schema
 * 
 * Defines Zod validation schema for the Department document:
 * - Deterministic ID with prefix department:
 * - Reference to Company (company_id)
 * - Normalized unique key within the company
 * - Monotonic UTC timestamps
 * - Strict rejection of unknown / legacy fields
 */

import { z } from 'zod';
import {
  DOCUMENT_TYPES,
  PROVENANCE_CLASSIFICATIONS,
} from '../constants/document.constants.js';
import {
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';

/**
 * Department Business Document Schema
 */
export const departmentDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^department:[a-z0-9_:-]+$/, 'Invalid Department _id format. Expected prefix "department:"'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.DEPARTMENT),
    company_id: z
      .string()
      .regex(/^company:[a-z0-9_:-]+$/, 'Invalid company_id reference format. Expected prefix "company:"'),
    name: z
      .string()
      .trim()
      .min(1, 'Department name cannot be empty'),
    key: z
      .string()
      .trim()
      .min(1, 'Department key cannot be empty')
      .regex(/^[a-z0-9_-]+$/, 'Department key must be lower-case alphanumeric slug with hyphens or underscores'),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((department, ctx) => {
    // 1. Monotonic timestamps: updated_at >= created_at
    if (department.created_at && department.updated_at) {
      const createdTime = new Date(department.created_at).getTime();
      const updatedTime = new Date(department.updated_at).getTime();
      if (updatedTime < createdTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'updated_at cannot be earlier than created_at',
          path: ['updated_at'],
        });
      }
    }

    // 2. Synthetic Department provenance validation (Rule C)
    if (department.provenance.classification === PROVENANCE_CLASSIFICATIONS.SYNTHETIC) {
      if (!department.provenance.generator_seed || !department.provenance.generator_seed.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic Department provenance must include non-empty generator_seed',
          path: ['provenance', 'generator_seed'],
        });
      }
      if (!department.provenance.generator_version || !department.provenance.generator_version.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic Department provenance must include non-empty generator_version',
          path: ['provenance', 'generator_version'],
        });
      }
    }
  });
