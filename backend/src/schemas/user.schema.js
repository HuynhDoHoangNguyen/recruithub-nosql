/**
 * DATA-03.1 User Business Document Schema
 * 
 * Defines Zod validation schema for the User document:
 * - ID derived deterministically from SHA-256 of email_normalized (Rule B)
 * - Canonical email ownership exclusively on User
 * - Rejection of plaintext/shared passwords
 * - Enforcement of example.invalid domain and generator provenance for synthetic users
 * - Requirement that seeded users without credentials have account_status RESET_REQUIRED
 */

import { z } from 'zod';
import {
  DOCUMENT_TYPES,
  ID_PREFIXES,
  PROVENANCE_CLASSIFICATIONS,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../constants/document.constants.js';
import {
  isoDateTimeSchema,
  provenanceSchema,
} from './common.schema.js';
import {
  normalizeEmail,
  userIdFromEmail,
} from '../utils/id.utils.js';

/**
 * User Business Document Schema
 */
export const userDocumentSchema = z
  .object({
    _id: z
      .string()
      .regex(/^user:[a-f0-9]{64}$/, 'Invalid user _id format. Expected user:<sha256>'),
    _rev: z.string().optional(),
    type: z.literal(DOCUMENT_TYPES.USER),
    email: z
      .string()
      .trim()
      .email('Invalid email address format'),
    email_normalized: z
      .string()
      .trim()
      .email('Invalid email_normalized format'),
    password_hash: z
      .string()
      .min(10, 'password_hash must be a valid non-empty hash string')
      .optional(),
    role: z.enum([
      USER_ROLES.CANDIDATE,
      USER_ROLES.RECRUITER,
      USER_ROLES.ADMIN,
    ]),
    account_status: z.enum([
      USER_ACCOUNT_STATUSES.ACTIVE,
      USER_ACCOUNT_STATUSES.LOCKED,
      USER_ACCOUNT_STATUSES.RESET_REQUIRED,
    ]),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    provenance: provenanceSchema.optional(),
  })
  .strict()
  .superRefine((user, ctx) => {
    // 1. Validate email_normalized against normalizeEmail(user.email)
    let computedNormalized;
    try {
      computedNormalized = normalizeEmail(user.email);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: `Email "${user.email}" cannot be normalized`,
        path: ['email'],
      });
      return;
    }

    if (user.email_normalized !== computedNormalized) {
      ctx.addIssue({
        code: 'custom',
        message: `email_normalized ("${user.email_normalized}") does not match canonical normalized email ("${computedNormalized}")`,
        path: ['email_normalized'],
      });
    }

    // 2. Validate _id consistency with userIdFromEmail(email_normalized)
    const expectedId = userIdFromEmail(user.email_normalized);
    if (user._id !== expectedId) {
      ctx.addIssue({
        code: 'custom',
        message: `User _id ("${user._id}") does not match SHA-256 of email_normalized ("${expectedId}")`,
        path: ['_id'],
      });
    }

    // 3. Monotonic timestamps: updated_at >= created_at
    if (user.created_at && user.updated_at) {
      const createdTime = new Date(user.created_at).getTime();
      const updatedTime = new Date(user.updated_at).getTime();
      if (updatedTime < createdTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'updated_at cannot be earlier than created_at',
          path: ['updated_at'],
        });
      }
    }

    // 4. Synthetic User provenance and domain validation (Rule B & Rule C)
    const isSynthetic = user.provenance?.classification === PROVENANCE_CLASSIFICATIONS.SYNTHETIC;
    if (isSynthetic) {
      if (!user.provenance.generator_seed || !user.provenance.generator_seed.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic User provenance must include non-empty generator_seed',
          path: ['provenance', 'generator_seed'],
        });
      }
      if (!user.provenance.generator_version || !user.provenance.generator_version.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Synthetic User provenance must include non-empty generator_version',
          path: ['provenance', 'generator_version'],
        });
      }
      if (!user.email_normalized.endsWith('@example.invalid')) {
        ctx.addIssue({
          code: 'custom',
          message: `Synthetic User email must use domain "example.invalid". Received: "${user.email}"`,
          path: ['email'],
        });
      }
    }

    // 5. Seeded User credentials safety (Rule B)
    // Seeded accounts without credentials must be in RESET_REQUIRED and cannot be ACTIVE
    const isSeeded = isSynthetic || user.provenance?.classification === PROVENANCE_CLASSIFICATIONS.SOURCE;
    if (isSeeded && !user.password_hash && user.account_status === USER_ACCOUNT_STATUSES.ACTIVE) {
      ctx.addIssue({
        code: 'custom',
        message: 'Seeded User without credentials cannot have account_status ACTIVE; must be RESET_REQUIRED',
        path: ['account_status'],
      });
    }

    // 6. Reject obvious plaintext password values inside password_hash
    if (user.password_hash) {
      const lower = user.password_hash.toLowerCase();
      if (
        lower === 'password' ||
        lower === 'password123' ||
        lower === 'admin' ||
        lower === '123456' ||
        lower.length < 20 // Secure digests/hashes (bcrypt, argon2, SHA-256) are >= 20 characters
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'password_hash must be a secure hash, not a plaintext password',
          path: ['password_hash'],
        });
      }
    }
  });
