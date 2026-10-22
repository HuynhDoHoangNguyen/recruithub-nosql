/**
 * DATA-03.4B: Synthetic Job Requirement Policy Engine
 * 
 * Implements approved deterministic synthetic requirements for RecruiHub:
 * - Stratified 3-tier allocation across 200 OPEN Jobs (50 Companies x 4 Jobs)
 * - 100 Tier 1 Jobs: Experience/Education REQUIRED or NO_MINIMUM, Project NO_REQUIREMENT
 * - 50 Tier 2 Jobs: Experience/Education REQUIRED/NO_MINIMUM, Project REQUIRED
 * - 50 Tier 3 Jobs + 2,300 DRAFT Jobs: Untouched source baseline (UNAVAILABLE)
 * - Versioned, deterministic policy with explicit provenance field origins
 */

import crypto from 'node:crypto';
import {
  CANONICAL_DEGREES,
  PROVENANCE_CLASSIFICATIONS,
  REQUIREMENT_STATUSES,
} from '../../backend/src/constants/document.constants.js';

export const POLICY_SEED = 'recruithub:data:v1:20261021';
export const POLICY_VERSION = 'recruithub-synthetic-requirements-v1';
export const GENERATOR_VERSION = 'DATA-03.4B';

export const TIER_NAMES = Object.freeze({
  TIER_1: 'TIER_1', // Full Evaluation (Complete)
  TIER_2: 'TIER_2', // Project-Gated (Candidate Projects Unavailable -> Incomplete)
  TIER_3: 'TIER_3', // Baseline Unstructured (Job Requirements Unavailable -> Incomplete)
});

/**
 * Derives a deterministic 32-bit unsigned integer from seed and key.
 * 
 * @param {string} key 
 * @param {string} [seed=POLICY_SEED] 
 * @returns {number}
 */
export function hashUint32(key, seed = POLICY_SEED) {
  const hash = crypto.createHash('sha256').update(`${seed}:${key}`).digest();
  return hash.readUInt32BE(0);
}

/**
 * Stratifies and classifies 200 OPEN Jobs across 50 Companies into 3 tiers.
 * 
 * Invariants:
 * - Exactly 50 companies with OPEN jobs.
 * - Every company has exactly 4 OPEN jobs.
 * - Fail-fast if invariants are violated.
 * 
 * @param {Array<Object>} jobs 
 * @returns {Map<string, { tier: string, companyOrdinal: number }>}
 */
export function classifyOpenJobTiers(jobs) {
  const openJobsByCompany = new Map();

  for (const job of jobs) {
    if (job.status === 'OPEN') {
      if (!openJobsByCompany.has(job.company_id)) {
        openJobsByCompany.set(job.company_id, []);
      }
      openJobsByCompany.get(job.company_id).push(job);
    }
  }

  if (openJobsByCompany.size !== 50) {
    throw new Error(
      `[POLICY VIOLATION] Expected exactly 50 companies with OPEN jobs, found ${openJobsByCompany.size}`
    );
  }

  const jobTierMap = new Map();
  let tier1Count = 0;
  let tier2Count = 0;
  let tier3Count = 0;

  // Sort company IDs deterministically
  const sortedCompanyIds = Array.from(openJobsByCompany.keys()).sort();

  for (const compId of sortedCompanyIds) {
    const compJobs = openJobsByCompany.get(compId);
    if (compJobs.length !== 4) {
      throw new Error(
        `[POLICY VIOLATION] Company ${compId} has ${compJobs.length} OPEN jobs, expected exactly 4`
      );
    }

    // Sort job IDs deterministically within each company
    compJobs.sort((a, b) => a._id.localeCompare(b._id));

    // Tier 1: Jobs index 0 & 1 (2 jobs per company = 100 jobs)
    jobTierMap.set(compJobs[0]._id, { tier: TIER_NAMES.TIER_1, companyOrdinal: 0 });
    jobTierMap.set(compJobs[1]._id, { tier: TIER_NAMES.TIER_1, companyOrdinal: 1 });
    tier1Count += 2;

    // Tier 2: Job index 2 (1 job per company = 50 jobs)
    jobTierMap.set(compJobs[2]._id, { tier: TIER_NAMES.TIER_2, companyOrdinal: 2 });
    tier2Count += 1;

    // Tier 3: Job index 3 (1 job per company = 50 jobs)
    jobTierMap.set(compJobs[3]._id, { tier: TIER_NAMES.TIER_3, companyOrdinal: 3 });
    tier3Count += 1;
  }

  if (tier1Count !== 100 || tier2Count !== 50 || tier3Count !== 50) {
    throw new Error(
      `[POLICY VIOLATION] Expected 100 Tier 1, 50 Tier 2, 50 Tier 3 jobs. Found: ${tier1Count}/${tier2Count}/${tier3Count}`
    );
  }

  return jobTierMap;
}

/**
 * Generates deterministic Experience requirement for an enriched Job.
 * 
 * @param {string} jobId 
 * @returns {{ status: string, required_months?: number }}
 */
export function generateExperienceRequirement(jobId) {
  const expOptions = [
    { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 12 },
    { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 24 },
    { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 36 },
    { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 48 },
    { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM },
  ];
  const idx = hashUint32(`${jobId}:experience`) % expOptions.length;
  return { ...expOptions[idx] };
}

/**
 * Generates deterministic Education requirement for an enriched Job.
 * 
 * @param {string} jobId 
 * @returns {{ status: string, minimum_degree?: string }}
 */
export function generateEducationRequirement(jobId) {
  const eduOptions = [
    { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: CANONICAL_DEGREES.HIGH_SCHOOL },
    { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: CANONICAL_DEGREES.BACHELOR },
    { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: CANONICAL_DEGREES.MASTER },
    { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
  ];
  const idx = hashUint32(`${jobId}:education`) % eduOptions.length;
  return { ...eduOptions[idx] };
}

/**
 * Generates deterministic Project requirement for an enriched Job.
 * 
 * @param {Object} job
 * @param {string} tier 
 * @returns {{ status: string, required_technologies?: string[] }}
 */
export function generateProjectRequirement(job, tier) {
  if (tier === TIER_NAMES.TIER_1) {
    return { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT };
  }

  if (tier === TIER_NAMES.TIER_2) {
    // Deterministically pick top 1 to 2 required skills as required project technologies
    const skills = Array.isArray(job.required_skills) ? job.required_skills : [];
    const count = 1 + (hashUint32(`${job._id}:proj_tech_count`) % 2); // 1 or 2 technologies
    const selected = [];
    const seen = new Set();
    for (const s of skills) {
      const lower = s.trim().toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        selected.push(s.trim());
        if (selected.length >= count) break;
      }
    }

    if (selected.length === 0) {
      selected.push('JavaScript'); // Safe fallback compliant with schema
    }

    return {
      status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
      required_technologies: selected,
    };
  }

  // Tier 3: preserve UNAVAILABLE
  return { status: REQUIREMENT_STATUSES.PROJECT.UNAVAILABLE };
}

/**
 * Applies synthetic requirement policy to a Job document.
 * 
 * If the Job is in Tier 1 or Tier 2, applies approved synthetic requirements
 * and updates provenance to classification: 'mixed' with field_origins.
 * If the Job is in Tier 3 or DRAFT, returns a cloned unchanged copy.
 * 
 * @param {Object} job 
 * @param {Map<string, { tier: string, companyOrdinal: number }>} jobTierMap 
 * @returns {Object} Enriched or preserved Job document
 */
export function applyJobRequirementPolicy(job, jobTierMap) {
  const tierInfo = jobTierMap.get(job._id);

  // DRAFT jobs or Tier 3 jobs remain 100% untouched
  if (!tierInfo || tierInfo.tier === TIER_NAMES.TIER_3) {
    return JSON.parse(JSON.stringify(job));
  }

  const enriched = JSON.parse(JSON.stringify(job));

  // 1. Synthesize Requirements
  const expReq = generateExperienceRequirement(job._id);
  const eduReq = generateEducationRequirement(job._id);
  const projReq = generateProjectRequirement(job, tierInfo.tier);

  enriched.requirements = {
    general: enriched.requirements?.general || [
      'Relevant experience and ability to learn quickly',
      'Strong communication and ownership mindset',
      'Comfort working with tools, data, and cross-functional teams',
    ],
    experience: expReq,
    education: eduReq,
    project: projReq,
  };

  // 2. Update Provenance
  const prevOrigins = enriched.provenance?.field_origins || {};
  enriched.provenance = {
    ...enriched.provenance,
    classification: PROVENANCE_CLASSIFICATIONS.MIXED,
    generator_seed: POLICY_SEED,
    generator_version: GENERATOR_VERSION,
    field_origins: {
      ...prevOrigins,
      'requirements.experience': 'synthetic',
      'requirements.education': 'synthetic',
      'requirements.project': 'synthetic',
    },
  };

  return enriched;
}
