/**
 * DATA-03.1 Company Business Document Schema
 * 
 * Defines Zod validation schema for the Company document:
 * - Deterministic ID with prefix company:
 * - Canonical industry and fictional company name
 * - Seeded-data provenance requirement with generator_seed and generator_version
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
 * Company Business Document Schema
 */
export const companyDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^company:[a-z0-9_:-]+$/, 'Invalid Company _id format. Expected prefix "company:"'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.COMPANY),
    name: z
      .string()
      .trim()
      .min(1, 'Company name cannot be empty'),
    industry: z
      .string()
      .trim()
      .min(1, 'Company industry cannot be empty'),
    website: z
      .string()
      .trim()
      .url('Invalid company website URL')
      .optional(),
    address: z
      .string()
      .trim()
      .min(1, 'Company address cannot be empty if provided')
      .optional(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((company, ctx) => {
    // 1. Monotonic timestamps: updated_at >= created_at
    if (company.created_at && company.updated_at) {
      const createdTime = new Date(company.created_at).getTime();
      const updatedTime = new Date(company.updated_at).getTime();
      if (updatedTime < createdTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'updated_at cannot be earlier than created_at',
          path: ['updated_at'],
        });
      }
    }

    // 2. Synthetic Company provenance validation (Rule C)
    if (company.provenance.classification === PROVENANCE_CLASSIFICATIONS.SYNTHETIC) {
      if (!company.provenance.generator_seed || !company.provenance.generator_seed.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic Company provenance must include non-empty generator_seed',
          path: ['provenance', 'generator_seed'],
        });
      }
      if (!company.provenance.generator_version || !company.provenance.generator_version.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic Company provenance must include non-empty generator_version',
          path: ['provenance', 'generator_version'],
        });
      }
    }
  });
