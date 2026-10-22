/**
 * Normalization & Canonical Hashing Utilities (DATA-02A / DATA-02B.1)
 * 
 * Provides pure deterministic functions:
 * - Skill normalization with alias mapping
 * - Degree normalization against approved tier mappings
 * - Canonical deep hashing with sorted keys
 */

import { createHash } from 'node:crypto';
import {
  CANONICAL_DEGREES,
  DEGREE_MAPPING_TABLE,
  SKILL_ALIAS_MAP_V1,
} from '../constants/document.constants.js';

/**
 * Normalizes a skill string:
 * 1. Trim whitespace
 * 2. Lowercase
 * 3. Collapse multiple whitespace characters into single space
 * 4. Apply versioned alias table
 * 
 * @param {string} skill
 * @param {Record<string, string>} [aliasMap=SKILL_ALIAS_MAP_V1]
 * @returns {string} normalized skill
 */
export function normalizeSkill(skill, aliasMap = SKILL_ALIAS_MAP_V1) {
  if (typeof skill !== 'string') {
    throw new TypeError('Skill must be a string');
  }

  const trimmed = skill.trim();
  if (!trimmed) {
    throw new Error('Skill cannot be empty');
  }

  const collapsed = trimmed.toLowerCase().replace(/\s+/g, ' ');

  if (aliasMap && Object.prototype.hasOwnProperty.call(aliasMap, collapsed)) {
    return aliasMap[collapsed];
  }

  return collapsed;
}

/**
 * Normalizes an educational degree to the approved canonical degree tier:
 * HIGH_SCHOOL, BACHELOR, MASTER, DOCTORATE
 * 
 * @param {string} rawDegree
 * @returns {string} Canonical degree enum string
 */
export function normalizeDegree(rawDegree) {
  if (typeof rawDegree !== 'string') {
    throw new TypeError('Degree must be a string');
  }

  const trimmed = rawDegree.trim();
  if (!trimmed) {
    throw new Error('Degree cannot be empty');
  }

  const lower = trimmed.toLowerCase();

  if (Object.prototype.hasOwnProperty.call(DEGREE_MAPPING_TABLE, lower)) {
    return DEGREE_MAPPING_TABLE[lower];
  }

  // Check if directly passed as an existing canonical enum value
  const upper = trimmed.toUpperCase();
  if (Object.values(CANONICAL_DEGREES).includes(upper)) {
    return upper;
  }

  throw new Error(`Unrecognized degree: "${rawDegree}". Does not map to approved canonical degrees.`);
}

/**
 * Recursively canonicalizes a payload by sorting object keys lexicographically.
 * Arrays preserve their explicit order unless specified.
 * 
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  const sortedObj = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    sortedObj[key] = canonicalizeValue(value[key]);
  }
  return sortedObj;
}

/**
 * Computes a deterministic SHA-256 hash of any JSON-serializable structure.
 * Object keys are sorted recursively to guarantee identical digests regardless of key insertion order.
 * Arrays remain in original order to preserve sequential history / ranked lists.
 * 
 * @param {unknown} payload
 * @returns {string} SHA-256 hex digest
 */
export function canonicalHash(payload) {
  const canonicalObj = canonicalizeValue(payload);
  const jsonString = JSON.stringify(canonicalObj);
  return createHash('sha256').update(jsonString, 'utf8').digest('hex');
}
