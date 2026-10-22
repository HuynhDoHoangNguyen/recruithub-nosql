/**
 * Deterministic Stable Synthetic ID Utilities (DATA-03.1 / Rule A)
 * 
 * Implements the approved DATA-01 / DATA-02A synthetic ID derivation policy:
 * 
 * digest = first_24_hex(
 *   SHA256(
 *     "recruithub:data:v1"
 *     + "|"
 *     + entity_type
 *     + "|"
 *     + canonical_natural_key
 *   )
 * )
 * 
 * _id = entity_type + ":syn:" + digest
 * 
 * Natural keys:
 * - Company: seed + industry + company ordinal
 * - Department: company_id + normalized department key
 * - Recruiter: user_id + company_id + department_id
 */

import { createHash } from 'node:crypto';
import { DOCUMENT_TYPES, ID_PREFIXES } from '../constants/document.constants.js';

/**
 * Default agreed synthetic generator seed (Rule A).
 */
export const DEFAULT_SYNTHETIC_SEED = 'recruithub:data:v1:20261021';

/**
 * Computes deterministic 24-character hexadecimal SHA-256 digest
 * for a given entity type and canonical natural key serialization.
 * 
 * @param {string} entityType - e.g. 'company', 'department', 'recruiter'
 * @param {string} canonicalNaturalKey - Canonical JSON serialized string
 * @returns {string} 24-char hex digest
 */
export function computeSyntheticDigest(entityType, canonicalNaturalKey) {
  if (typeof entityType !== 'string' || !entityType.trim()) {
    throw new TypeError('entityType must be a non-empty string');
  }
  if (typeof canonicalNaturalKey !== 'string') {
    throw new TypeError('canonicalNaturalKey must be a string');
  }

  const payload = `recruithub:data:v1|${entityType.trim()}|${canonicalNaturalKey}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
}

/**
 * Derives a deterministic Company ID from natural key:
 * seed + industry + company ordinal
 * 
 * Canonical natural key serialization: JSON.stringify([seed, industry, ordinal])
 * Output format: company:syn:<first_24_hex>
 * 
 * @param {Object|string} params - { seed, industry, ordinal } or industry string
 * @param {number} [maybeOrdinal] - Ordinal when using positional args
 * @param {string} [maybeSeed] - Seed when using positional args
 * @returns {string} company:syn:<digest>
 */
export function companyIdFromKey(params, maybeOrdinal, maybeSeed) {
  let seed = DEFAULT_SYNTHETIC_SEED;
  let industry;
  let ordinal;

  if (typeof params === 'object' && params !== null) {
    industry = params.industry;
    ordinal = params.ordinal ?? params.company_ordinal;
    seed = params.seed ?? DEFAULT_SYNTHETIC_SEED;
  } else if (typeof params === 'string' && maybeOrdinal !== undefined) {
    industry = params;
    ordinal = maybeOrdinal;
    if (maybeSeed !== undefined) seed = maybeSeed;
  } else if (typeof params === 'string' && maybeOrdinal === undefined) {
    // Single string natural key / slug e.g. "techcorp"
    const normalizedKey = params.trim().toLowerCase();
    if (!normalizedKey) {
      throw new Error('Company natural key cannot be empty');
    }
    const canonicalKey = JSON.stringify([seed, normalizedKey, 0]);
    const digest = computeSyntheticDigest(DOCUMENT_TYPES.COMPANY, canonicalKey);
    return `${ID_PREFIXES.COMPANY}syn:${digest}`;
  } else {
    throw new TypeError('Invalid arguments for companyIdFromKey');
  }

  if (typeof industry !== 'string' || !industry.trim()) {
    throw new TypeError('Company industry must be a non-empty string');
  }
  if (typeof ordinal !== 'number' || !Number.isInteger(ordinal) || ordinal < 0) {
    throw new TypeError('Company ordinal must be a non-negative integer');
  }
  if (typeof seed !== 'string' || !seed.trim()) {
    throw new TypeError('Company seed must be a non-empty string');
  }

  const canonicalKey = JSON.stringify([
    seed.trim(),
    industry.trim().toLowerCase(),
    ordinal,
  ]);

  const digest = computeSyntheticDigest(DOCUMENT_TYPES.COMPANY, canonicalKey);
  return `${ID_PREFIXES.COMPANY}syn:${digest}`;
}

/**
 * Alias for companyIdFromKey for natural-key object semantics.
 */
export function companyIdFromNaturalKey(params) {
  return companyIdFromKey(params);
}

/**
 * Derives a deterministic Department ID from natural key:
 * company_id + normalized department key
 * 
 * Canonical natural key serialization: JSON.stringify([company_id, normalized_department_key])
 * Output format: department:syn:<first_24_hex>
 * 
 * @param {string|Object} companyIdOrObj - Company ID string or { companyId, departmentKey }
 * @param {string} [departmentKey] - Normalized department key
 * @returns {string} department:syn:<digest>
 */
export function departmentIdFromKey(companyIdOrObj, departmentKey) {
  let companyId;
  let depKey;

  if (typeof companyIdOrObj === 'object' && companyIdOrObj !== null) {
    companyId = companyIdOrObj.companyId ?? companyIdOrObj.company_id;
    depKey = companyIdOrObj.departmentKey ?? companyIdOrObj.department_key ?? companyIdOrObj.key;
  } else {
    companyId = companyIdOrObj;
    depKey = departmentKey;
  }

  if (typeof companyId !== 'string' || !companyId.trim()) {
    throw new TypeError('companyId must be a non-empty string');
  }
  if (!companyId.startsWith(ID_PREFIXES.COMPANY)) {
    throw new Error(`Invalid companyId format: "${companyId}". Expected prefix "${ID_PREFIXES.COMPANY}"`);
  }
  if (typeof depKey !== 'string' || !depKey.trim()) {
    throw new TypeError('departmentKey must be a non-empty string');
  }

  const canonicalKey = JSON.stringify([
    companyId.trim(),
    depKey.trim().toLowerCase(),
  ]);

  const digest = computeSyntheticDigest(DOCUMENT_TYPES.DEPARTMENT, canonicalKey);
  return `${ID_PREFIXES.DEPARTMENT}syn:${digest}`;
}

/**
 * Alias for departmentIdFromKey for natural-key object semantics.
 */
export function departmentIdFromNaturalKey(params) {
  return departmentIdFromKey(params);
}

/**
 * Derives a deterministic Recruiter ID from natural key:
 * user_id + company_id + department_id
 * 
 * Canonical natural key serialization: JSON.stringify([user_id, company_id, department_id])
 * Output format: recruiter:syn:<first_24_hex>
 * 
 * @param {Object|string} params - { userId, companyId, departmentId } or userId string
 * @param {string} [maybeCompanyId]
 * @param {string} [maybeDepartmentId]
 * @returns {string} recruiter:syn:<digest>
 */
export function recruiterIdFromNaturalKey(params, maybeCompanyId, maybeDepartmentId) {
  let userId;
  let companyId;
  let departmentId;

  if (typeof params === 'object' && params !== null) {
    userId = params.userId ?? params.user_id;
    companyId = params.companyId ?? params.company_id;
    departmentId = params.departmentId ?? params.department_id;
  } else {
    userId = params;
    companyId = maybeCompanyId;
    departmentId = maybeDepartmentId;
  }

  if (typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('userId must be a non-empty string');
  }
  if (!userId.startsWith(ID_PREFIXES.USER)) {
    throw new Error(`Invalid userId format: "${userId}". Expected prefix "${ID_PREFIXES.USER}"`);
  }
  if (typeof companyId !== 'string' || !companyId.trim()) {
    throw new TypeError('companyId must be a non-empty string');
  }
  if (!companyId.startsWith(ID_PREFIXES.COMPANY)) {
    throw new Error(`Invalid companyId format: "${companyId}". Expected prefix "${ID_PREFIXES.COMPANY}"`);
  }
  if (typeof departmentId !== 'string' || !departmentId.trim()) {
    throw new TypeError('departmentId must be a non-empty string');
  }
  if (!departmentId.startsWith(ID_PREFIXES.DEPARTMENT)) {
    throw new Error(`Invalid departmentId format: "${departmentId}". Expected prefix "${ID_PREFIXES.DEPARTMENT}"`);
  }

  const canonicalKey = JSON.stringify([
    userId.trim(),
    companyId.trim(),
    departmentId.trim(),
  ]);

  const digest = computeSyntheticDigest(DOCUMENT_TYPES.RECRUITER, canonicalKey);
  return `${ID_PREFIXES.RECRUITER}syn:${digest}`;
}
