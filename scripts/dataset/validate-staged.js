#!/usr/bin/env node
/**
 * DATA-02B.2 / DATA-02B.3: Hardened Staged Validation & Content-Addressed Publisher
 * 
 * Validates 100% of generated records from staging against Zod schemas:
 * - stagedCandidateSchema (must pass) & candidateDocumentSchema (must fail)
 * - stagedJobSchema (must pass) & jobDocumentSchema (must fail)
 * - Evaluates ID uniqueness, referential integrity, and unreferenced resume count.
 * 
 * Safely publishes to immutable content-addressed release directory and atomically
 * updates active manifest pointer.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  candidateDocumentSchema,
  stagedCandidateSchema,
} from '../../backend/src/schemas/candidate.schema.js';
import {
  jobDocumentSchema,
  stagedJobSchema,
} from '../../backend/src/schemas/job.schema.js';
import { canonicalHash } from '../../backend/src/utils/normalization.utils.js';
import {
  SCENARIO_CLOCK,
  SOURCE_HASHES,
  TRANSFORM_VERSION,
} from './transform-staged.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

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
 * Atomically writes a file by writing to a temporary file in the same directory
 * and performing an atomic rename.
 * @param {string} destPath 
 * @param {string|Buffer} content 
 */
export function atomicWriteFile(destPath, content) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${destPath}.tmp.${Date.now()}.${Math.floor(Math.random() * 10000)}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, destPath);
}

/**
 * Validates candidates JSONL file.
 */
export async function validateCandidates(filePath) {
  console.log(`Validating Candidates: ${filePath}`);
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const candidateIds = new Set();
  const sourceResumeIds = new Set();
  let count = 0;
  let stagedPassCount = 0;
  let finalFailCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count++;
    const record = JSON.parse(trimmed);

    // 1. Zod Staged Validation (must pass)
    const stagedCheck = stagedCandidateSchema.safeParse(record);
    if (!stagedCheck.success) {
      throw new Error(`[Candidate Validation Failed at line ${count} / ID ${record._id}]: ${JSON.stringify(stagedCheck.error.issues)}`);
    }
    stagedPassCount++;

    // 2. Final boundary check (must fail due to missing user_id)
    const finalCheck = candidateDocumentSchema.safeParse(record);
    if (finalCheck.success) {
      throw new Error(`[Boundary Violation at line ${count} / ID ${record._id}]: Staged candidate should not pass final schema`);
    }
    finalFailCount++;

    // 3. ID uniqueness
    if (candidateIds.has(record._id)) {
      throw new Error(`Duplicate Candidate _id detected: ${record._id}`);
    }
    candidateIds.add(record._id);

    if (sourceResumeIds.has(record.source_resume_id)) {
      throw new Error(`Duplicate Candidate source_resume_id detected: ${record.source_resume_id}`);
    }
    sourceResumeIds.add(record.source_resume_id);
  }

  if (count !== 10000) {
    throw new Error(`Expected exactly 10,000 Candidates, but found ${count}`);
  }

  console.log(`  -> 10,000 / 10,000 Candidates valid (Staged PASS: ${stagedPassCount}, Final FAIL: ${finalFailCount})`);
  return { count, candidateIds, sourceResumeIds };
}

/**
 * Validates jobs JSONL file.
 */
export async function validateJobs(filePath) {
  console.log(`Validating Jobs: ${filePath}`);
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const jobIds = new Set();
  const sourceJobIds = new Set();
  let count = 0;
  let stagedPassCount = 0;
  let finalFailCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count++;
    const record = JSON.parse(trimmed);

    // 1. Zod Staged Validation (must pass)
    const stagedCheck = stagedJobSchema.safeParse(record);
    if (!stagedCheck.success) {
      throw new Error(`[Job Validation Failed at line ${count} / ID ${record._id}]: ${JSON.stringify(stagedCheck.error.issues)}`);
    }
    stagedPassCount++;

    // 2. Final boundary check (must fail due to missing company_id, recruiter_id)
    const finalCheck = jobDocumentSchema.safeParse(record);
    if (finalCheck.success) {
      throw new Error(`[Boundary Violation at line ${count} / ID ${record._id}]: Staged job should not pass final schema`);
    }
    finalFailCount++;

    // 3. ID uniqueness
    if (jobIds.has(record._id)) {
      throw new Error(`Duplicate Job _id detected: ${record._id}`);
    }
    jobIds.add(record._id);

    if (sourceJobIds.has(record.source_job_id)) {
      throw new Error(`Duplicate Job source_job_id detected: ${record.source_job_id}`);
    }
    sourceJobIds.add(record.source_job_id);
  }

  if (count !== 2500) {
    throw new Error(`Expected exactly 2,500 Jobs, but found ${count}`);
  }

  console.log(`  -> 2,500 / 2,500 Jobs valid (Staged PASS: ${stagedPassCount}, Final FAIL: ${finalFailCount})`);
  return { count, jobIds, sourceJobIds };
}

/**
 * Validates evaluation match pairs JSONL file.
 */
export async function validateMatches(filePath, sourceResumeIds, sourceJobIds) {
  console.log(`Validating Evaluation Match Pairs: ${filePath}`);
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const pairIds = new Set();
  const referencedResumes = new Set();
  const referencedJobs = new Set();
  let count = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count++;
    const record = JSON.parse(trimmed);

    if (!record.pair_id || !record.job_id || !record.resume_id) {
      throw new Error(`Malformed match pair at line ${count}: missing required fields`);
    }

    if (pairIds.has(record.pair_id)) {
      throw new Error(`Duplicate match pair detected: ${record.pair_id}`);
    }
    pairIds.add(record.pair_id);

    // Referential integrity check
    if (!sourceResumeIds.has(record.resume_id)) {
      throw new Error(`Orphan resume_id in matches at line ${count}: ${record.resume_id}`);
    }
    referencedResumes.add(record.resume_id);

    if (!sourceJobIds.has(record.job_id)) {
      throw new Error(`Orphan job_id in matches at line ${count}: ${record.job_id}`);
    }
    referencedJobs.add(record.job_id);
  }

  if (count !== 75000) {
    throw new Error(`Expected exactly 75,000 match pairs, but found ${count}`);
  }

  // Count unreferenced resumes (DATA-01 reported exactly 29 resumes without ground truth)
  let unreferencedCount = 0;
  for (const rId of sourceResumeIds) {
    if (!referencedResumes.has(rId)) {
      unreferencedCount++;
    }
  }

  if (unreferencedCount !== 29) {
    console.warn(`[WARN] Unreferenced resumes count is ${unreferencedCount} (DATA-01 baseline was 29)`);
  } else {
    console.log(`  -> Exactly 29 resumes without ground-truth match correctly preserved in Candidate dataset.`);
  }

  console.log(`  -> 75,000 / 75,000 Match Pairs valid and non-orphan.`);
  return { count, pairIds, unreferencedCount };
}

/**
 * Safe Publication and Manifest Creation
 */
export async function runValidationAndPublication(options = {}) {
  const stagingDir = options.stagingDir || path.join(REPO_ROOT, 'data/processed/staging');
  const releasesDir = options.releasesDir || path.join(REPO_ROOT, 'data/processed/releases');
  const manifestsDir = options.manifestsDir || path.join(REPO_ROOT, 'data/processed/manifests');
  const stagedDir = options.stagedDir || path.join(REPO_ROOT, 'data/processed/staged');
  const evalDir = options.evalDir || path.join(REPO_ROOT, 'data/processed/evaluation');
  const noPublish = options.noPublish || false;

  const candFile = path.join(stagingDir, 'candidates.jsonl');
  const jobFile = path.join(stagingDir, 'jobs.jsonl');
  const matchFile = path.join(stagingDir, 'matches.jsonl');

  if (!fs.existsSync(candFile) || !fs.existsSync(jobFile) || !fs.existsSync(matchFile)) {
    throw new Error(`Staging directory missing required output files: ${stagingDir}`);
  }

  console.log('\n--- STARTING 100% CORPUS VALIDATION ---');
  const candStats = await validateCandidates(candFile);
  const jobStats = await validateJobs(jobFile);
  const matchStats = await validateMatches(matchFile, candStats.sourceResumeIds, jobStats.sourceJobIds);

  console.log('\n--- ALL VALIDATION CHECKS PASSED ---');

  if (noPublish) {
    console.log('[Validation Only]: Skipping publication as requested.');
    return { candStats, jobStats, matchStats };
  }

  console.log('Proceeding to Content-Addressed Safe Publication...');

  // Compute checksums of staging output files
  const candSha256 = computeFileSha256(candFile);
  const jobSha256 = computeFileSha256(jobFile);
  const matchSha256 = computeFileSha256(matchFile);

  // Compute canonical release fingerprint
  const releaseFingerprintPayload = {
    transform_version: TRANSFORM_VERSION,
    schema_contract: 'DATA-02A',
    alias_map_version: 'v1',
    scenario_clock: SCENARIO_CLOCK,
    source_hashes: SOURCE_HASHES,
    output_hashes: {
      candidates: candSha256,
      jobs: jobSha256,
      matches: matchSha256,
    },
  };
  const releaseDigest = canonicalHash(releaseFingerprintPayload);
  const shortDigest = releaseDigest.slice(0, 16);
  const releaseId = `release:${TRANSFORM_VERSION}:${shortDigest}`;
  const releaseDirName = `${TRANSFORM_VERSION}_${shortDigest}`;
  const immutableReleaseDir = path.join(releasesDir, releaseDirName);
  const legacyReleaseDir = path.join(releasesDir, TRANSFORM_VERSION);

  fs.mkdirSync(immutableReleaseDir, { recursive: true });
  fs.mkdirSync(legacyReleaseDir, { recursive: true });
  fs.mkdirSync(stagedDir, { recursive: true });
  fs.mkdirSync(evalDir, { recursive: true });
  fs.mkdirSync(manifestsDir, { recursive: true });

  // 1. Immutable release publication
  const relCandPath = path.join(immutableReleaseDir, 'candidates.jsonl');
  const relJobPath = path.join(immutableReleaseDir, 'jobs.jsonl');
  const relMatchPath = path.join(immutableReleaseDir, 'matches.jsonl');

  if (!fs.existsSync(relCandPath)) {
    fs.copyFileSync(candFile, relCandPath);
    fs.copyFileSync(jobFile, relJobPath);
    fs.copyFileSync(matchFile, relMatchPath);
    console.log(`  -> Created immutable release directory: ${immutableReleaseDir}`);
  } else {
    console.log(`  -> Immutable release already exists (UNCHANGED): ${immutableReleaseDir}`);
  }

  // 2. Backward-compatible alias directory publication
  fs.copyFileSync(candFile, path.join(legacyReleaseDir, 'candidates.jsonl'));
  fs.copyFileSync(jobFile, path.join(legacyReleaseDir, 'jobs.jsonl'));
  fs.copyFileSync(matchFile, path.join(legacyReleaseDir, 'matches.jsonl'));

  // 3. Atomic publication of active convenience aliases
  atomicWriteFile(path.join(stagedDir, 'candidates.jsonl'), fs.readFileSync(candFile));
  atomicWriteFile(path.join(stagedDir, 'jobs.jsonl'), fs.readFileSync(jobFile));
  atomicWriteFile(path.join(evalDir, 'matches.jsonl'), fs.readFileSync(matchFile));

  // 4. Construct Release Manifest
  const manifest = {
    release_id: releaseId,
    release_digest: releaseDigest,
    transform_version: TRANSFORM_VERSION,
    scenario_clock: SCENARIO_CLOCK,
    source_dataset: 'michaelozon/candidate-matching-synthetic',
    active_release_dir: path.relative(REPO_ROOT, immutableReleaseDir).replace(/\\/g, '/'),
    active_pointer_status: 'ACTIVE',
    source_files: {
      'resumes.parquet': {
        size_bytes: 277342,
        sha256: '4A25ADD9C3A620C4C396E867063E390FC8084F9B53ED8135DEF049303A29D7A4',
      },
      'jobs.parquet': {
        size_bytes: 56026,
        sha256: 'C13D7C7E0AB510E81117974027DE1364F973A27B3CACC8FABFBD8851C352C871',
      },
      'matches.parquet': {
        size_bytes: 274261,
        sha256: 'DAB24E40948B2DA348C6DF7072B5B5FE3BB6EF8CAB335F88EEF5D5667EE79A92',
      },
    },
    output_files: {
      'data/processed/staged/candidates.jsonl': {
        record_count: candStats.count,
        sha256: candSha256,
      },
      'data/processed/staged/jobs.jsonl': {
        record_count: jobStats.count,
        sha256: jobSha256,
      },
      'data/processed/evaluation/matches.jsonl': {
        record_count: matchStats.count,
        sha256: matchSha256,
      },
    },
    record_counts: {
      candidates: candStats.count,
      jobs: jobStats.count,
      match_pairs: matchStats.count,
    },
    integrity_summary: {
      all_records_valid: true,
      duplicate_candidate_ids: 0,
      duplicate_job_ids: 0,
      duplicate_match_pairs: 0,
      orphan_evaluation_pairs: 0,
      unmatched_resumes_preserved: matchStats.unreferencedCount,
      staged_vs_final_boundary_verified: true,
    },
    transform_rules: {
      skill_normalization: 'lowercase, trim, collapse whitespace, versioned alias map v1',
      degree_normalization: 'approved 4-tier degree mapping table (DATA-02A Section 7)',
      experience_months_derivation: 'years_experience * 12',
      availability_assignment: 'skills: AVAILABLE, experience: PARTIAL, education: PARTIAL, projects: UNAVAILABLE',
      nested_requirements_status: 'experience/education/project status UNAVAILABLE (omitting unapproved thresholds)',
    },
  };

  const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
  manifest.manifest_sha256 = crypto.createHash('sha256').update(manifestJson, 'utf8').digest('hex').toUpperCase();

  // Write immutable release manifest
  fs.writeFileSync(path.join(immutableReleaseDir, 'etl-manifest.json'), manifestJson, 'utf8');
  fs.writeFileSync(path.join(legacyReleaseDir, 'etl-manifest.json'), manifestJson, 'utf8');

  // 5. Atomic pointer switch: manifests/etl-manifest.json (LAST STEP)
  const activePointerPath = path.join(manifestsDir, 'etl-manifest.json');
  atomicWriteFile(activePointerPath, manifestJson);

  console.log(`\nManifest & Active Pointer successfully written:`);
  console.log(`  - Active Pointer:     ${activePointerPath}`);
  console.log(`  - Immutable Release:  ${path.join(immutableReleaseDir, 'etl-manifest.json')}`);
  console.log(`  - Release Digest:     ${releaseDigest}`);

  // 6. Clean up temporary staging directory
  try {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    console.log(`Temporary staging directory cleaned: ${stagingDir}`);
  } catch (e) {
    // Ignore cleanup errors
  }

  console.log('\n=== DATA-02B.3 ETL HARDENED PUBLICATION COMPLETE ===\n');
  return { candStats, jobStats, matchStats, releaseId, releaseDigest };
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
    } else if (args[i] === '--staged-dir' && args[i + 1]) {
      options.stagedDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--eval-dir' && args[i + 1]) {
      options.evalDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--no-publish') {
      options.noPublish = true;
    } else if (!args[i].startsWith('--') && i === 0) {
      options.stagingDir = path.resolve(args[i]);
    }
  }

  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs();

  runValidationAndPublication(options).catch((err) => {
    console.error('\n[FATAL VALIDATION ERROR]:', err.message);
    // On error, remove staging dir to avoid leaving incomplete artifacts
    if (options.stagingDir) {
      try {
        if (fs.existsSync(options.stagingDir)) {
          fs.rmSync(options.stagingDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }
    process.exit(1);
  });
}
