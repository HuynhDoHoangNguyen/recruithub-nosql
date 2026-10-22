#!/usr/bin/env node
/**
 * DATA-03.2: Synthetic Identity, Organization & Reference Resolution Generator
 * 
 * Responsibilities:
 * 1. Reads and verifies DATA-02B active release integrity (pointer, manifest, SHA-256).
 * 2. Generates deterministic synthetic Companies (50), Departments (150), and Recruiters (150).
 * 3. Generates deterministic synthetic Recruiter Users (150) and Candidate Users (10.000).
 * 4. Resolves references for Candidates (user_id) and Jobs (company_id, department_id, recruiter_id).
 * 5. Outputs deterministic, sorted JSONL records to staging directory for full corpus validation.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  DOCUMENT_TYPES,
  PROVENANCE_CLASSIFICATIONS,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../../backend/src/constants/document.constants.js';
import {
  normalizeEmail,
  userIdFromEmail,
} from '../../backend/src/utils/id.utils.js';
import {
  companyIdFromKey,
  departmentIdFromKey,
  recruiterIdFromNaturalKey,
  DEFAULT_SYNTHETIC_SEED,
} from '../../backend/src/utils/synthetic-id.utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

export const GENERATOR_SEED = DEFAULT_SYNTHETIC_SEED; // 'recruithub:data:v1:20261021'
export const SCENARIO_CLOCK = '2026-10-21T00:00:00Z';
export const GENERATOR_VERSION = 'DATA-03.2';
export const ALLOCATION_RULE_VERSION = 'JOB_ALLOCATION_V1';

/**
 * Approved 10 industries matching audited dataset distributions.
 */
export const APPROVED_INDUSTRIES = Object.freeze([
  'Retail',
  'EdTech',
  'Travel',
  'Cybersecurity',
  'SaaS',
  'Healthcare',
  'E-commerce',
  'FinTech',
  'Logistics',
  'Gaming',
]);

/**
 * Approved 3 Department keys and display names per company.
 */
export const APPROVED_DEPARTMENTS = Object.freeze([
  { key: 'engineering', name: 'Engineering & Technology' },
  { key: 'product', name: 'Product & Experience' },
  { key: 'operations', name: 'Business Operations' },
]);

/**
 * Prioritized keyword lists for deterministic Job department allocation.
 */
export const DEPARTMENT_ALLOCATION_KEYWORDS = Object.freeze({
  engineering: Object.freeze([
    'engineer',
    'developer',
    'data',
    'security',
    'architect',
    'devops',
    'fullstack',
    'backend',
    'frontend',
    'analyst',
    'scientist',
  ]),
  product: Object.freeze([
    'product',
    'design',
    'ui',
    'ux',
    'creative',
  ]),
});

/**
 * Computes uppercase SHA-256 checksum of a file.
 * @param {string} filePath 
 * @returns {string}
 */
export function computeFileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

/**
 * Reads lines from a JSONL file into an array.
 * @param {string} filePath 
 * @returns {Promise<Array<any>>}
 */
export async function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const items = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) {
      items.push(JSON.parse(trimmed));
    }
  }
  return items;
}

/**
 * Verifies DATA-02B active release integrity (Rule A).
 * @param {string} activeManifestPath 
 * @returns {{ activeReleaseDir: string, manifest: Object }}
 */
export function verifyInputReleaseIntegrity(activeManifestPath) {
  if (!fs.existsSync(activeManifestPath)) {
    throw new Error(`DATA-02B active manifest pointer not found: ${activeManifestPath}`);
  }

  const manifestContent = fs.readFileSync(activeManifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestContent);
  } catch (err) {
    throw new Error(`Invalid JSON in active ETL manifest: ${err.message}`);
  }

  if (!manifest.active_release_dir) {
    throw new Error('Active manifest missing "active_release_dir" property');
  }

  const activeReleaseDir = path.resolve(REPO_ROOT, manifest.active_release_dir);
  if (!fs.existsSync(activeReleaseDir)) {
    throw new Error(`Active release directory does not exist: ${activeReleaseDir}`);
  }

  // Verify input candidate and job checksums
  const candFile = path.join(activeReleaseDir, 'candidates.jsonl');
  const jobFile = path.join(activeReleaseDir, 'jobs.jsonl');

  if (!fs.existsSync(candFile)) {
    throw new Error(`candidates.jsonl not found in active release: ${candFile}`);
  }
  if (!fs.existsSync(jobFile)) {
    throw new Error(`jobs.jsonl not found in active release: ${jobFile}`);
  }

  const candSha = computeFileSha256(candFile);
  const jobSha = computeFileSha256(jobFile);

  const expectedCandSha = manifest.output_files?.['data/processed/staged/candidates.jsonl']?.sha256;
  const expectedJobSha = manifest.output_files?.['data/processed/staged/jobs.jsonl']?.sha256;

  if (expectedCandSha && candSha !== expectedCandSha.toUpperCase()) {
    throw new Error(`Input candidates.jsonl SHA-256 mismatch. Expected ${expectedCandSha}, got ${candSha}`);
  }
  if (expectedJobSha && jobSha !== expectedJobSha.toUpperCase()) {
    throw new Error(`Input jobs.jsonl SHA-256 mismatch. Expected ${expectedJobSha}, got ${jobSha}`);
  }

  return { activeReleaseDir, manifest };
}

/**
 * Generates the 50 Companies, 150 Departments, 150 Recruiters, and 150 Recruiter Users.
 */
export function generateOrganizationEntities() {
  const companies = [];
  const departments = [];
  const recruiters = [];
  const recruiterUsers = [];

  // Indexing maps for rapid allocation lookups
  const companyByIndustryAndOrdinal = new Map(); // `${industry}:${ordinal}` -> company
  const departmentsByCompanyId = new Map(); // companyId -> Map(deptKey -> department)
  const recruiterByCompanyAndDept = new Map(); // `${companyId}:${deptId}` -> recruiter

  for (const industry of APPROVED_INDUSTRIES) {
    for (let ordinal = 0; ordinal < 5; ordinal++) {
      const compId = companyIdFromKey({ seed: GENERATOR_SEED, industry, ordinal });
      const compSlug = `${industry.toLowerCase().replace(/[^a-z0-9]/g, '')}-${String(ordinal + 1).padStart(2, '0')}`;
      const compName = `Demo ${industry} Company ${String(ordinal + 1).padStart(2, '0')}`;

      const companyDoc = {
        _id: compId,
        type: DOCUMENT_TYPES.COMPANY,
        name: compName,
        industry: industry,
        website: `https://${compSlug}.example.invalid`,
        created_at: SCENARIO_CLOCK,
        updated_at: SCENARIO_CLOCK,
        provenance: {
          classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
          generator_seed: GENERATOR_SEED,
          generator_version: GENERATOR_VERSION,
        },
      };

      companies.push(companyDoc);
      companyByIndustryAndOrdinal.set(`${industry}:${ordinal}`, companyDoc);

      const compDepts = new Map();

      for (const deptDef of APPROVED_DEPARTMENTS) {
        const deptId = departmentIdFromKey(compId, deptDef.key);
        const deptDoc = {
          _id: deptId,
          type: DOCUMENT_TYPES.DEPARTMENT,
          company_id: compId,
          name: deptDef.name,
          key: deptDef.key,
          created_at: SCENARIO_CLOCK,
          updated_at: SCENARIO_CLOCK,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        };

        departments.push(deptDoc);
        compDepts.set(deptDef.key, deptDoc);

        // 1 Recruiter and 1 Recruiter User per Department
        const recruiterEmail = `recruiter.${compSlug}.${deptDef.key}.1@example.invalid`;
        const emailNorm = normalizeEmail(recruiterEmail);
        const recruiterUserId = userIdFromEmail(emailNorm);

        const userDoc = {
          _id: recruiterUserId,
          type: DOCUMENT_TYPES.USER,
          email: recruiterEmail,
          email_normalized: emailNorm,
          role: USER_ROLES.RECRUITER,
          account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
          created_at: SCENARIO_CLOCK,
          updated_at: SCENARIO_CLOCK,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        };

        const recId = recruiterIdFromNaturalKey({
          userId: recruiterUserId,
          companyId: compId,
          departmentId: deptId,
        });

        const recruiterDoc = {
          _id: recId,
          type: DOCUMENT_TYPES.RECRUITER,
          user_id: recruiterUserId,
          company_id: compId,
          department_id: deptId,
          created_at: SCENARIO_CLOCK,
          updated_at: SCENARIO_CLOCK,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        };

        recruiterUsers.push(userDoc);
        recruiters.push(recruiterDoc);
        recruiterByCompanyAndDept.set(`${compId}:${deptId}`, recruiterDoc);
      }

      departmentsByCompanyId.set(compId, compDepts);
    }
  }

  return {
    companies,
    departments,
    recruiters,
    recruiterUsers,
    companyByIndustryAndOrdinal,
    departmentsByCompanyId,
    recruiterByCompanyAndDept,
  };
}

/**
 * Determines the department key from a Job's title using prioritized keywords.
 * @param {string} title 
 * @returns {'engineering' | 'product' | 'operations'}
 */
export function determineJobDepartmentKey(title) {
  if (!title || typeof title !== 'string') {
    return 'operations';
  }
  const lower = title.toLowerCase();

  // 1. Check engineering keywords
  for (const kw of DEPARTMENT_ALLOCATION_KEYWORDS.engineering) {
    if (lower.includes(kw)) {
      return 'engineering';
    }
  }

  // 2. Check product keywords
  for (const kw of DEPARTMENT_ALLOCATION_KEYWORDS.product) {
    if (lower.includes(kw)) {
      return 'product';
    }
  }

  // 3. Fallback
  return 'operations';
}

/**
 * Resolves references for a Job document (Rule D).
 */
export function resolveJobReferences(job, orgMaps) {
  const { companyByIndustryAndOrdinal, departmentsByCompanyId, recruiterByCompanyAndDept } = orgMaps;

  if (!APPROVED_INDUSTRIES.includes(job.industry)) {
    throw new Error(`Job ${job._id} has unapproved industry: "${job.industry}"`);
  }

  const rawSourceId = job.source_job_id || job._id.replace(/^job:cms:/, '');
  const jobNum = parseInt(rawSourceId.replace(/^J_/, ''), 10);
  if (Number.isNaN(jobNum)) {
    throw new Error(`Job ${job._id} has unparseable numeric source ID: "${rawSourceId}"`);
  }

  const companyOrdinal = jobNum % 5;
  const company = companyByIndustryAndOrdinal.get(`${job.industry}:${companyOrdinal}`);
  if (!company) {
    throw new Error(`Company not found for industry "${job.industry}", ordinal ${companyOrdinal}`);
  }

  const deptKey = determineJobDepartmentKey(job.title);
  const compDepts = departmentsByCompanyId.get(company._id);
  const department = compDepts?.get(deptKey);
  if (!department) {
    throw new Error(`Department "${deptKey}" not found for company ${company._id}`);
  }

  const recruiter = recruiterByCompanyAndDept.get(`${company._id}:${department._id}`);
  if (!recruiter) {
    throw new Error(`Recruiter not found for company ${company._id}, dept ${department._id}`);
  }

  return {
    ...job,
    company_id: company._id,
    department_id: department._id,
    recruiter_id: recruiter._id,
    provenance: {
      ...job.provenance,
      field_origins: {
        ...(job.provenance?.field_origins || {}),
        company_id: 'synthetic',
        department_id: 'synthetic',
        recruiter_id: 'synthetic',
      },
    },
  };
}

/**
 * Generates synthetic Candidate User and resolves candidate.user_id (Rule B & Rule E).
 */
export function resolveCandidateUser(candidate) {
  const rawResumeId = candidate.source_resume_id || candidate._id.replace(/^candidate:cms:/, '');
  const email = `candidate.${rawResumeId.toLowerCase()}@example.invalid`;
  const emailNorm = normalizeEmail(email);
  const userId = userIdFromEmail(emailNorm);

  const candidateUser = {
    _id: userId,
    type: DOCUMENT_TYPES.USER,
    email: email,
    email_normalized: emailNorm,
    role: USER_ROLES.CANDIDATE,
    account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
    created_at: SCENARIO_CLOCK,
    updated_at: SCENARIO_CLOCK,
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: GENERATOR_SEED,
      generator_version: GENERATOR_VERSION,
      source_ids: { resume_id: rawResumeId },
    },
  };

  const finalCandidate = {
    ...candidate,
    user_id: userId,
    provenance: {
      ...candidate.provenance,
      field_origins: {
        ...(candidate.provenance?.field_origins || {}),
        user_id: 'synthetic',
      },
    },
  };

  return { candidateUser, finalCandidate };
}

/**
 * Writes records to a JSONL file, sorting strictly by _id lexicographically.
 * @param {string} filePath 
 * @param {Array<Object>} records 
 */
export function writeSortedJsonl(filePath, records) {
  const sorted = [...records].sort((a, b) => a._id.localeCompare(b._id));
  const lines = sorted.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines, 'utf8');
}

/**
 * Main execution pipeline for foundation generation.
 */
export async function runFoundationGeneration(options = {}) {
  const activeManifestPath = options.activeManifestPath || path.resolve(REPO_ROOT, 'data/processed/manifests/etl-manifest.json');
  const stagingDir = options.stagingDir || path.resolve(REPO_ROOT, 'data/staging_foundation');

  console.log('=== DATA-03.2: SYNTHETIC IDENTITY & ORGANIZATION GENERATOR ===');
  console.log(`Generator Seed:    ${GENERATOR_SEED}`);
  console.log(`Scenario Clock:    ${SCENARIO_CLOCK}`);
  console.log(`Active Manifest:   ${activeManifestPath}`);
  console.log(`Staging Dir:       ${stagingDir}\n`);

  // 1. Verify Input Release Integrity
  const { activeReleaseDir } = verifyInputReleaseIntegrity(activeManifestPath);
  console.log(`[PASS] Input release integrity verified at: ${activeReleaseDir}`);

  // 2. Generate Organization Entities
  const orgResult = generateOrganizationEntities();
  console.log(`[GENERATED] Organization Entities:`);
  console.log(`  - Companies:       ${orgResult.companies.length}`);
  console.log(`  - Departments:     ${orgResult.departments.length}`);
  console.log(`  - Recruiters:      ${orgResult.recruiters.length}`);
  console.log(`  - Recruiter Users: ${orgResult.recruiterUsers.length}`);

  // 3. Process Candidates & Generate Candidate Users
  const stagedCandFile = path.join(activeReleaseDir, 'candidates.jsonl');
  const stagedCandidates = await readJsonl(stagedCandFile);
  const finalCandidates = [];
  const candidateUsers = [];

  for (const stagedCand of stagedCandidates) {
    const { candidateUser, finalCandidate } = resolveCandidateUser(stagedCand);
    candidateUsers.push(candidateUser);
    finalCandidates.push(finalCandidate);
  }
  console.log(`[GENERATED] Candidates & Candidate Users:`);
  console.log(`  - Final Candidates: ${finalCandidates.length}`);
  console.log(`  - Candidate Users:  ${candidateUsers.length}`);

  // 4. Process Jobs & Resolve Organization References
  const stagedJobFile = path.join(activeReleaseDir, 'jobs.jsonl');
  const stagedJobs = await readJsonl(stagedJobFile);
  const finalJobs = [];

  for (const stagedJob of stagedJobs) {
    const finalJob = resolveJobReferences(stagedJob, orgResult);
    finalJobs.push(finalJob);
  }
  console.log(`[GENERATED] Final Jobs:`);
  console.log(`  - Final Jobs:       ${finalJobs.length}\n`);

  // Combine Users
  const allUsers = [...candidateUsers, ...orgResult.recruiterUsers];
  console.log(`[TOTAL DOCUMENTS GENERATED]:`);
  console.log(`  - Users:            ${allUsers.length} (10.000 Candidate + 150 Recruiter)`);
  console.log(`  - Companies:        ${orgResult.companies.length}`);
  console.log(`  - Departments:      ${orgResult.departments.length}`);
  console.log(`  - Recruiters:       ${orgResult.recruiters.length}`);
  console.log(`  - Candidates:       ${finalCandidates.length}`);
  console.log(`  - Jobs:             ${finalJobs.length}`);
  const totalCount = allUsers.length + orgResult.companies.length + orgResult.departments.length + orgResult.recruiters.length + finalCandidates.length + finalJobs.length;
  console.log(`  - Grand Total:      ${totalCount} (Target: 23.000)\n`);

  if (totalCount !== 23000) {
    throw new Error(`Expected exactly 23,000 final documents, but generated ${totalCount}`);
  }

  // 5. Write Sorted JSONL files to Staging
  fs.mkdirSync(stagingDir, { recursive: true });
  writeSortedJsonl(path.join(stagingDir, 'users.jsonl'), allUsers);
  writeSortedJsonl(path.join(stagingDir, 'companies.jsonl'), orgResult.companies);
  writeSortedJsonl(path.join(stagingDir, 'departments.jsonl'), orgResult.departments);
  writeSortedJsonl(path.join(stagingDir, 'recruiters.jsonl'), orgResult.recruiters);
  writeSortedJsonl(path.join(stagingDir, 'candidates.jsonl'), finalCandidates);
  writeSortedJsonl(path.join(stagingDir, 'jobs.jsonl'), finalJobs);

  console.log(`[SUCCESS] Staged 23,000 documents into: ${stagingDir}`);
  return {
    stagingDir,
    totalCount,
    counts: {
      users: allUsers.length,
      companies: orgResult.companies.length,
      departments: orgResult.departments.length,
      recruiters: orgResult.recruiters.length,
      candidates: finalCandidates.length,
      jobs: finalJobs.length,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFoundationGeneration().catch((err) => {
    console.error('\n[FATAL GENERATION ERROR]:', err.message);
    process.exit(1);
  });
}
