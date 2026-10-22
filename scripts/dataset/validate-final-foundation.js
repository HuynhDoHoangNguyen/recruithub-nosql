#!/usr/bin/env node
/**
 * DATA-03.2: Final Foundation Validation & Content-Addressed Release Publisher
 * 
 * Responsibilities:
 * 1. Validates 100% of all 23,000 generated documents against approved Zod schemas.
 * 2. Enforces cross-document referential integrity, scoping invariants, and role consistency.
 * 3. Enforces global _id and email_normalized uniqueness (zero duplicates, zero orphans).
 * 4. Generates an immutable content-addressed release and atomically updates active foundation pointer.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { candidateDocumentSchema } from '../../backend/src/schemas/candidate.schema.js';
import { jobDocumentSchema } from '../../backend/src/schemas/job.schema.js';
import { userDocumentSchema } from '../../backend/src/schemas/user.schema.js';
import { companyDocumentSchema } from '../../backend/src/schemas/company.schema.js';
import { departmentDocumentSchema } from '../../backend/src/schemas/department.schema.js';
import {
  recruiterDocumentSchema,
  validateRecruiterOrganizationScope,
} from '../../backend/src/schemas/recruiter.schema.js';
import {
  USER_ROLES,
  JOB_STATUSES,
} from '../../backend/src/constants/document.constants.js';
import {
  GENERATOR_SEED,
  GENERATOR_VERSION,
  ALLOCATION_RULE_VERSION,
  SCENARIO_CLOCK,
  computeFileSha256,
} from './generate-foundation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

/**
 * Atomically writes content to a file via a temporary sibling file and rename.
 * @param {string} destPath 
 * @param {string|Buffer} content 
 */
export function atomicWriteFile(destPath, content) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${destPath}.tmp.${Date.now()}.${Math.floor(Math.random() * 100000)}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, destPath);
}

/**
 * Streams a JSONL file and validates each line using provided validator.
 * @param {string} filePath 
 * @param {(record: any, lineNum: number) => void} onRecord 
 * @returns {Promise<number>} total lines processed
 */
export async function streamValidateJsonl(filePath, onRecord) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count++;
    const record = JSON.parse(trimmed);
    onRecord(record, count);
  }
  return count;
}

/**
 * Full corpus validation and release publication pipeline.
 */
export async function runFoundationValidationAndPublication(options = {}) {
  const stagingDir = options.stagingDir || path.resolve(REPO_ROOT, 'data/staging_foundation');
  const releasesDir = options.releasesDir || path.resolve(REPO_ROOT, 'data/processed/releases');
  const manifestsDir = options.manifestsDir || path.resolve(REPO_ROOT, 'data/processed/manifests');
  const activePointerPath = options.activePointerPath || path.join(manifestsDir, 'foundation-manifest.json');
  const noPublish = options.noPublish || false;

  console.log('=== DATA-03.2: FINAL CORPUS VALIDATION & PUBLISHER ===');
  console.log(`Staging Dir:      ${stagingDir}`);
  console.log(`Releases Dir:     ${releasesDir}`);
  console.log(`Manifests Dir:    ${manifestsDir}`);
  console.log(`Active Pointer:   ${activePointerPath}\n`);

  if (!fs.existsSync(stagingDir)) {
    throw new Error(`Staging directory does not exist: ${stagingDir}`);
  }

  // Cross-document lookup tables
  const allDocumentIds = new Set();
  const allUserEmails = new Set();
  const userRoleById = new Map(); // userId -> role
  const companyById = new Map(); // compId -> company doc
  const departmentById = new Map(); // deptId -> dept doc
  const recruiterById = new Map(); // recId -> recruiter doc
  const userById = new Map(); // userId -> user doc (for scope check)
  const deptKeysByCompany = new Map(); // compId -> Set(keys)

  // 1. Validate Users (10.150)
  console.log('1/6 Validating Users...');
  const usersPath = path.join(stagingDir, 'users.jsonl');
  let candidateUserCount = 0;
  let recruiterUserCount = 0;

  const totalUsers = await streamValidateJsonl(usersPath, (user, lineNum) => {
    const parsed = userDocumentSchema.safeParse(user);
    if (!parsed.success) {
      throw new Error(`[User Validation Failure line ${lineNum} / ID ${user._id}]: ${JSON.stringify(parsed.error.issues)}`);
    }

    if (allDocumentIds.has(user._id)) {
      throw new Error(`Duplicate _id detected across corpus: ${user._id}`);
    }
    allDocumentIds.add(user._id);

    if (allUserEmails.has(user.email_normalized)) {
      throw new Error(`Duplicate email_normalized detected: ${user.email_normalized}`);
    }
    allUserEmails.add(user.email_normalized);

    userRoleById.set(user._id, user.role);
    userById.set(user._id, user);

    if (user.role === USER_ROLES.CANDIDATE) candidateUserCount++;
    if (user.role === USER_ROLES.RECRUITER) recruiterUserCount++;
  });

  if (totalUsers !== 10150) {
    throw new Error(`Expected exactly 10,150 users, got ${totalUsers}`);
  }
  console.log(`  [PASS] 10,150 Users valid (10,000 Candidate Users + 150 Recruiter Users)`);

  // 2. Validate Companies (50)
  console.log('2/6 Validating Companies...');
  const companiesPath = path.join(stagingDir, 'companies.jsonl');
  const totalCompanies = await streamValidateJsonl(companiesPath, (company, lineNum) => {
    const parsed = companyDocumentSchema.safeParse(company);
    if (!parsed.success) {
      throw new Error(`[Company Validation Failure line ${lineNum} / ID ${company._id}]: ${JSON.stringify(parsed.error.issues)}`);
    }

    if (allDocumentIds.has(company._id)) {
      throw new Error(`Duplicate _id detected across corpus: ${company._id}`);
    }
    allDocumentIds.add(company._id);
    companyById.set(company._id, company);
    deptKeysByCompany.set(company._id, new Set());
  });

  if (totalCompanies !== 50) {
    throw new Error(`Expected exactly 50 companies, got ${totalCompanies}`);
  }
  console.log(`  [PASS] 50 Companies valid`);

  // 3. Validate Departments (150)
  console.log('3/6 Validating Departments...');
  const departmentsPath = path.join(stagingDir, 'departments.jsonl');
  const totalDepartments = await streamValidateJsonl(departmentsPath, (dept, lineNum) => {
    const parsed = departmentDocumentSchema.safeParse(dept);
    if (!parsed.success) {
      throw new Error(`[Department Validation Failure line ${lineNum} / ID ${dept._id}]: ${JSON.stringify(parsed.error.issues)}`);
    }

    if (allDocumentIds.has(dept._id)) {
      throw new Error(`Duplicate _id detected across corpus: ${dept._id}`);
    }
    allDocumentIds.add(dept._id);

    // Foreign reference check
    if (!companyById.has(dept.company_id)) {
      throw new Error(`Orphan Department ${dept._id}: company_id "${dept.company_id}" does not exist`);
    }

    // Key uniqueness within company
    const keys = deptKeysByCompany.get(dept.company_id);
    if (keys.has(dept.key)) {
      throw new Error(`Duplicate Department key "${dept.key}" within company ${dept.company_id}`);
    }
    keys.add(dept.key);

    departmentById.set(dept._id, dept);
  });

  if (totalDepartments !== 150) {
    throw new Error(`Expected exactly 150 departments, got ${totalDepartments}`);
  }
  console.log(`  [PASS] 150 Departments valid (0 orphan companies, unique keys)`);

  // 4. Validate Recruiters (150)
  console.log('4/6 Validating Recruiters...');
  const recruitersPath = path.join(stagingDir, 'recruiters.jsonl');
  const totalRecruiters = await streamValidateJsonl(recruitersPath, (recruiter, lineNum) => {
    const parsed = recruiterDocumentSchema.safeParse(recruiter);
    if (!parsed.success) {
      throw new Error(`[Recruiter Validation Failure line ${lineNum} / ID ${recruiter._id}]: ${JSON.stringify(parsed.error.issues)}`);
    }

    if (allDocumentIds.has(recruiter._id)) {
      throw new Error(`Duplicate _id detected across corpus: ${recruiter._id}`);
    }
    allDocumentIds.add(recruiter._id);

    // Cross-document reference validation
    const user = userById.get(recruiter.user_id);
    const company = companyById.get(recruiter.company_id);
    const department = departmentById.get(recruiter.department_id);

    if (!user) {
      throw new Error(`Orphan Recruiter ${recruiter._id}: user_id "${recruiter.user_id}" does not exist`);
    }
    if (!company) {
      throw new Error(`Orphan Recruiter ${recruiter._id}: company_id "${recruiter.company_id}" does not exist`);
    }
    if (!department) {
      throw new Error(`Orphan Recruiter ${recruiter._id}: department_id "${recruiter.department_id}" does not exist`);
    }

    // Pure cross-document scope validator
    const scopeCheck = validateRecruiterOrganizationScope({ recruiter, company, department, user });
    if (!scopeCheck.valid) {
      throw new Error(`Recruiter ${recruiter._id} failed organization scope validation: ${scopeCheck.errors.join('; ')}`);
    }

    recruiterById.set(recruiter._id, recruiter);
  });

  if (totalRecruiters !== 150) {
    throw new Error(`Expected exactly 150 recruiters, got ${totalRecruiters}`);
  }
  console.log(`  [PASS] 150 Recruiters valid (100% passed organization scope validation)`);

  // 5. Validate Final Candidates (10.000)
  console.log('5/6 Validating Final Candidates...');
  const candidatesPath = path.join(stagingDir, 'candidates.jsonl');
  const candidateUserIdsUsed = new Set();

  const totalCandidates = await streamValidateJsonl(candidatesPath, (candidate, lineNum) => {
    const parsed = candidateDocumentSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`[Candidate Validation Failure line ${lineNum} / ID ${candidate._id}]: ${JSON.stringify(parsed.error.issues)}`);
    }

    if (allDocumentIds.has(candidate._id)) {
      throw new Error(`Duplicate _id detected across corpus: ${candidate._id}`);
    }
    allDocumentIds.add(candidate._id);

    // Verify candidate.user_id
    if (!candidate.user_id) {
      throw new Error(`Final Candidate missing user_id: ${candidate._id}`);
    }
    const userRole = userRoleById.get(candidate.user_id);
    if (!userRole) {
      throw new Error(`Orphan Candidate ${candidate._id}: user_id "${candidate.user_id}" not found`);
    }
    if (userRole !== USER_ROLES.CANDIDATE) {
      throw new Error(`Candidate ${candidate._id} references user with role "${userRole}", expected CANDIDATE`);
    }

    if (candidateUserIdsUsed.has(candidate.user_id)) {
      throw new Error(`Multiple candidates reference same user_id: ${candidate.user_id}`);
    }
    candidateUserIdsUsed.add(candidate.user_id);
  });

  if (totalCandidates !== 10000) {
    throw new Error(`Expected exactly 10,000 final candidates, got ${totalCandidates}`);
  }
  console.log(`  [PASS] 10,000 Final Candidates valid (100% 1-to-1 bound to CANDIDATE Users)`);

  // 6. Validate Final Jobs (2.500)
  console.log('6/6 Validating Final Jobs...');
  const jobsPath = path.join(stagingDir, 'jobs.jsonl');
  const totalJobs = await streamValidateJsonl(jobsPath, (job, lineNum) => {
    const parsed = jobDocumentSchema.safeParse(job);
    if (!parsed.success) {
      throw new Error(`[Job Validation Failure line ${lineNum} / ID ${job._id}]: ${JSON.stringify(parsed.error.issues)}`);
    }

    if (allDocumentIds.has(job._id)) {
      throw new Error(`Duplicate _id detected across corpus: ${job._id}`);
    }
    allDocumentIds.add(job._id);

    // References exist
    const company = companyById.get(job.company_id);
    const department = departmentById.get(job.department_id);
    const recruiter = recruiterById.get(job.recruiter_id);

    if (!company) {
      throw new Error(`Orphan Job ${job._id}: company_id "${job.company_id}" not found`);
    }
    if (!department) {
      throw new Error(`Orphan Job ${job._id}: department_id "${job.department_id}" not found`);
    }
    if (!recruiter) {
      throw new Error(`Orphan Job ${job._id}: recruiter_id "${job.recruiter_id}" not found`);
    }

    // Mutual scoping
    if (department.company_id !== job.company_id) {
      throw new Error(`Job ${job._id} scoping mismatch: department company (${department.company_id}) !== job company (${job.company_id})`);
    }
    if (recruiter.company_id !== job.company_id) {
      throw new Error(`Job ${job._id} scoping mismatch: recruiter company (${recruiter.company_id}) !== job company (${job.company_id})`);
    }
    if (recruiter.department_id !== job.department_id) {
      throw new Error(`Job ${job._id} scoping mismatch: recruiter department (${recruiter.department_id}) !== job department (${job.department_id})`);
    }

    // Source preservation invariants
    if (job.status !== JOB_STATUSES.DRAFT) {
      throw new Error(`Job ${job._id} status mutated: expected DRAFT, got ${job.status}`);
    }
    if (job.requirements?.experience?.status !== 'UNAVAILABLE' ||
        job.requirements?.education?.status !== 'UNAVAILABLE' ||
        job.requirements?.project?.status !== 'UNAVAILABLE') {
      throw new Error(`Job ${job._id} requirements mutated from UNAVAILABLE baseline`);
    }
  });

  if (totalJobs !== 2500) {
    throw new Error(`Expected exactly 2,500 final jobs, got ${totalJobs}`);
  }
  console.log(`  [PASS] 2,500 Final Jobs valid (100% mutually scoped to Company, Department, Recruiter)`);

  const grandTotal = totalUsers + totalCompanies + totalDepartments + totalRecruiters + totalCandidates + totalJobs;
  console.log(`\n======================================================`);
  console.log(`100% CORPUS VALIDATION SUCCESSFUL: ${grandTotal} DOCUMENTS`);
  console.log(`  - 0 Duplicate IDs across entire corpus (${allDocumentIds.size} unique IDs)`);
  console.log(`  - 0 Duplicate Emails across all users (${allUserEmails.size} unique emails)`);
  console.log(`  - 0 Orphan References across all relationships`);
  console.log(`  - 0 Scoping Violations`);
  console.log(`  - Source facts and availability states preserved`);
  console.log(`======================================================\n`);

  if (noPublish) {
    console.log('[DRY-RUN] Validation complete. Publication skipped (--no-publish).');
    return { valid: true, grandTotal, published: false };
  }

  // 7. Compute Checksums & Content-Addressed Release Digest
  const candSha = computeFileSha256(candidatesPath);
  const jobSha = computeFileSha256(jobsPath);
  const userSha = computeFileSha256(usersPath);
  const compSha = computeFileSha256(companiesPath);
  const deptSha = computeFileSha256(departmentsPath);
  const recSha = computeFileSha256(recruitersPath);

  // Deterministic digest over sorted file hashes and config
  const digestPayload = [
    GENERATOR_VERSION,
    ALLOCATION_RULE_VERSION,
    GENERATOR_SEED,
    candSha,
    jobSha,
    userSha,
    compSha,
    deptSha,
    recSha,
  ].join('|');
  const releaseDigest = crypto.createHash('sha256').update(digestPayload, 'utf8').digest('hex');
  const releaseShortDigest = releaseDigest.slice(0, 16);
  const releaseId = `release:DATA-03.2:${releaseShortDigest}`;
  const immutableReleaseDir = path.join(releasesDir, `DATA-03.2_${releaseShortDigest}`);

  // Idempotency check: if release exists and matches
  if (fs.existsSync(immutableReleaseDir)) {
    const existingManifestPath = path.join(immutableReleaseDir, 'foundation-manifest.json');
    if (fs.existsSync(existingManifestPath)) {
      const existingManifest = JSON.parse(fs.readFileSync(existingManifestPath, 'utf8'));
      if (existingManifest.release_digest === releaseDigest) {
        console.log(`[IDEMPOTENT RERUN] Release ${releaseId} already exists and is UNCHANGED.`);
        // Ensure active pointer points to it
        atomicWriteFile(activePointerPath, fs.readFileSync(existingManifestPath, 'utf8'));
        return {
          valid: true,
          grandTotal,
          releaseId,
          releaseDigest,
          immutableReleaseDir,
          status: 'UNCHANGED',
        };
      }
    }
  }

  fs.mkdirSync(immutableReleaseDir, { recursive: true });

  // Copy files to immutable release directory
  fs.copyFileSync(candidatesPath, path.join(immutableReleaseDir, 'candidates.jsonl'));
  fs.copyFileSync(jobsPath, path.join(immutableReleaseDir, 'jobs.jsonl'));
  fs.copyFileSync(usersPath, path.join(immutableReleaseDir, 'users.jsonl'));
  fs.copyFileSync(companiesPath, path.join(immutableReleaseDir, 'companies.jsonl'));
  fs.copyFileSync(departmentsPath, path.join(immutableReleaseDir, 'departments.jsonl'));
  fs.copyFileSync(recruitersPath, path.join(immutableReleaseDir, 'recruiters.jsonl'));

  const manifest = {
    release_id: releaseId,
    release_digest: releaseDigest,
    transform_version: GENERATOR_VERSION,
    allocation_rule_version: ALLOCATION_RULE_VERSION,
    generator_seed: GENERATOR_SEED,
    scenario_clock: SCENARIO_CLOCK,
    immutable_release_dir: `data/processed/releases/DATA-03.2_${releaseShortDigest}`,
    active_pointer_status: 'ACTIVE',
    output_files: {
      'candidates.jsonl': { record_count: totalCandidates, sha256: candSha },
      'jobs.jsonl': { record_count: totalJobs, sha256: jobSha },
      'users.jsonl': { record_count: totalUsers, sha256: userSha },
      'companies.jsonl': { record_count: totalCompanies, sha256: compSha },
      'departments.jsonl': { record_count: totalDepartments, sha256: deptSha },
      'recruiters.jsonl': { record_count: totalRecruiters, sha256: recSha },
    },
    record_counts: {
      candidates: totalCandidates,
      jobs: totalJobs,
      users: totalUsers,
      candidate_users: candidateUserCount,
      recruiter_users: recruiterUserCount,
      companies: totalCompanies,
      departments: totalDepartments,
      recruiters: totalRecruiters,
      total_documents: grandTotal,
    },
    integrity_summary: {
      all_records_valid: true,
      duplicate_ids: 0,
      duplicate_emails: 0,
      orphan_references: 0,
      scoping_violations: 0,
      role_invariant_violations: 0,
      source_facts_preserved: true,
    },
  };

  const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(path.join(immutableReleaseDir, 'foundation-manifest.json'), manifestJson, 'utf8');

  // 8. Atomic Pointer Switch (Last Step)
  atomicWriteFile(activePointerPath, manifestJson);

  console.log(`[PUBLISHED] Foundation Release Successfully Published:`);
  console.log(`  - Release ID:         ${releaseId}`);
  console.log(`  - Release Directory:  ${immutableReleaseDir}`);
  console.log(`  - Active Pointer:     ${activePointerPath}\n`);

  // Clean up temporary staging directory
  try {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    console.log(`Temporary staging directory cleaned: ${stagingDir}`);
  } catch (_) {}

  return {
    valid: true,
    grandTotal,
    releaseId,
    releaseDigest,
    immutableReleaseDir,
    status: 'PUBLISHED',
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--staging-dir' && args[i + 1]) {
      options.stagingDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--releases-dir' && args[i + 1]) {
      options.releasesDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--manifests-dir' && args[i + 1]) {
      options.manifestsDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--no-publish') {
      options.noPublish = true;
    }
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs();
  runFoundationValidationAndPublication(options).catch((err) => {
    console.error('\n[FATAL FOUNDATION VALIDATION ERROR]:', err.message);
    process.exit(1);
  });
}
