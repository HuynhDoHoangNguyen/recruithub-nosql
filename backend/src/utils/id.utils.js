/**
 * Deterministic Stable ID Utilities (DATA-02A / DATA-02B.1)
 * 
 * Provides pure functions to generate canonical CouchDB document IDs:
 * - User: user:<sha256(email_normalized)>
 * - Candidate: candidate:cms:<resume_id>
 * - Job: job:cms:<job_id>
 * - Application: application:pair:<sha256(candidate_id + "\n" + job_id)>
 */

import { createHash } from 'node:crypto';
import { ID_PREFIXES } from '../constants/document.constants.js';

/**
 * Normalizes an email address according to DATA-02A Section 4.1:
 * 1. Validate non-empty string and standard email shape.
 * 2. Trim surrounding whitespace.
 * 3. Lowercase using locale-independent rules.
 * 
 * @param {string} email
 * @returns {string} email_normalized
 */
export function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw new TypeError('Email must be a string');
  }

  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error('Email cannot be empty');
  }

  // Basic RFC 5322 compliant-enough structure check: local@domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error(`Invalid email format: "${email}"`);
  }

  return trimmed.toLowerCase();
}

/**
 * Computes deterministic User ID from an email address.
 * ID = user:<sha256(email_normalized)>
 * 
 * @param {string} email
 * @returns {string} User document _id
 */
export function userIdFromEmail(email) {
  const normalized = normalizeEmail(email);
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `${ID_PREFIXES.USER}${digest}`;
}

/**
 * Computes the deterministic Candidate ID for a self-registered canonical User.
 * This namespace is distinct from the imported CMS Candidate namespace.
 * ID = candidate:<sha256(user_id)>
 *
 * @param {string} userId - Canonical User document ID
 * @returns {string} Candidate document _id
 */
export function candidateIdFromUserId(userId) {
  if (typeof userId !== 'string' || !/^user:[a-f0-9]{64}$/.test(userId)) {
    throw new TypeError('User ID must be a canonical user:<sha256> ID');
  }

  const digest = createHash('sha256').update(userId, 'utf8').digest('hex');
  return `candidate:${digest}`;
}

/**
 * Generates or validates candidate ID from source resume ID.
 * Returns candidate:cms:<resume_id>
 * 
 * @param {string} resumeId - Raw ID (e.g. 'R_000001') or full ID ('candidate:cms:R_000001')
 * @returns {string}
 */
export function candidateIdFromResumeId(resumeId) {
  if (typeof resumeId !== 'string' || !resumeId.trim()) {
    throw new TypeError('Resume ID must be a non-empty string');
  }

  const trimmed = resumeId.trim();
  if (trimmed.startsWith(ID_PREFIXES.CANDIDATE)) {
    return trimmed;
  }

  const rawIdPattern = /^R_[0-9]{6}$/;
  if (!rawIdPattern.test(trimmed)) {
    throw new Error(`Invalid source resume_id format: "${resumeId}". Expected R_XXXXXX.`);
  }

  return `${ID_PREFIXES.CANDIDATE}${trimmed}`;
}

/**
 * Generates or validates job ID from source job ID.
 * Returns job:cms:<job_id>
 * 
 * @param {string} jobId - Raw ID (e.g. 'J_000001') or full ID ('job:cms:J_000001')
 * @returns {string}
 */
export function jobIdFromSourceId(jobId) {
  if (typeof jobId !== 'string' || !jobId.trim()) {
    throw new TypeError('Job ID must be a non-empty string');
  }

  const trimmed = jobId.trim();
  if (trimmed.startsWith(ID_PREFIXES.JOB)) {
    return trimmed;
  }

  const rawIdPattern = /^J_[0-9]{6}$/;
  if (!rawIdPattern.test(trimmed)) {
    throw new Error(`Invalid source job_id format: "${jobId}". Expected J_XXXXXX.`);
  }

  return `${ID_PREFIXES.JOB}${trimmed}`;
}

/**
 * Generates deterministic lifetime Application ID for a Candidate–Job pair:
 * application:pair:<sha256(candidate_id + "\n" + job_id)>
 * 
 * @param {string} candidateId - Full candidate document ID
 * @param {string} jobId - Full job document ID
 * @returns {string}
 */
export function applicationIdFromPair(candidateId, jobId) {
  if (typeof candidateId !== 'string' || !candidateId.trim()) {
    throw new TypeError('Candidate ID must be a non-empty string');
  }
  if (typeof jobId !== 'string' || !jobId.trim()) {
    throw new TypeError('Job ID must be a non-empty string');
  }

  const pairKey = `${candidateId.trim()}\n${jobId.trim()}`;
  const digest = createHash('sha256').update(pairKey, 'utf8').digest('hex');
  return `${ID_PREFIXES.APPLICATION}${digest}`;
}
