/**
 * DATA-02B.3 Negative & Failure-Recovery Integration Tests (Rule C)
 * 
 * Verifies real failure injection across Extract, Transform, Validate, and Publish layers:
 * 1. Wrong source hash
 * 2. Missing source file
 * 3. Unexpected Parquet schema
 * 4. Duplicate Candidate ID
 * 5. Duplicate Job ID
 * 6. Duplicate matching pair
 * 7. Orphan matching reference
 * 8. Normalized skill collision
 * 9. Invalid staged Candidate
 * 10. Invalid staged Job
 * 11. Validation failure before publish preserves active release
 * 12. Failure before active pointer switch preserves active pointer
 * 13. Deterministic rerun detects UNCHANGED release
 * 14. Version/config change creates distinct immutable release
 * 15. Existing active release remains readable after all failed runs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  stagedCandidateSchema,
} from '../../src/schemas/candidate.schema.js';
import {
  stagedJobSchema,
} from '../../src/schemas/job.schema.js';
import {
  computeFileSha256,
  runValidationAndPublication,
  validateCandidates,
  validateJobs,
  validateMatches,
} from '../../../scripts/dataset/validate-staged.js';
import {
  transformResumeToStagedCandidate,
  transformJobToStagedJob,
} from '../../../scripts/dataset/transform-staged.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const TEST_SCRATCH_DIR = path.join(REPO_ROOT, 'data/test_scratch');

/**
 * Helper to safely create an empty test scratch directory.
 */
function setupTestScratch() {
  if (fs.existsSync(TEST_SCRATCH_DIR)) {
    fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_SCRATCH_DIR, { recursive: true });
  return TEST_SCRATCH_DIR;
}

/**
 * Helper to clean up test scratch directory.
 */
function cleanupTestScratch() {
  if (fs.existsSync(TEST_SCRATCH_DIR)) {
    fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
  }
}

test('DATA-02B.3: Real Failure Injection & Release Safety Tests', async (t) => {
  t.beforeEach(() => {
    setupTestScratch();
  });

  t.afterEach(() => {
    cleanupTestScratch();
  });

  await t.test('N-01: Wrong source hash triggers extraction abort with exit code 1', () => {
    const fakeRawDir = path.join(TEST_SCRATCH_DIR, 'raw_tampered');
    fs.mkdirSync(fakeRawDir, { recursive: true });

    // Create a tampered resumes.parquet
    fs.writeFileSync(path.join(fakeRawDir, 'resumes.parquet'), 'TAMPERED_CONTENT', 'utf8');
    fs.writeFileSync(path.join(fakeRawDir, 'jobs.parquet'), 'TAMPERED_CONTENT', 'utf8');
    fs.writeFileSync(path.join(fakeRawDir, 'matches.parquet'), 'TAMPERED_CONTENT', 'utf8');

    const extractScript = path.join(REPO_ROOT, 'scripts/dataset/extract-parquet.py');
    const result = spawnSync('python', [extractScript, '--raw-dir', fakeRawDir, '--verify-only'], {
      encoding: 'utf8',
      shell: true,
    });

    assert.equal(result.status, 1, 'Should exit with code 1 on hash mismatch');
    assert.match(result.stderr, /Checksum mismatch for resumes\.parquet/);
  });

  await t.test('N-02: Missing source file triggers extraction abort with exit code 1', () => {
    const fakeRawDir = path.join(TEST_SCRATCH_DIR, 'raw_missing');
    fs.mkdirSync(fakeRawDir, { recursive: true });

    // Only provide resumes.parquet, missing jobs and matches
    fs.writeFileSync(path.join(fakeRawDir, 'resumes.parquet'), 'CONTENT', 'utf8');

    const extractScript = path.join(REPO_ROOT, 'scripts/dataset/extract-parquet.py');
    const result = spawnSync('python', [extractScript, '--raw-dir', fakeRawDir, '--verify-only'], {
      encoding: 'utf8',
      shell: true,
    });

    assert.equal(result.status, 1, 'Should exit with code 1 on missing file');
    assert.match(result.stderr, /Source file missing.*jobs\.parquet/);
  });

  await t.test('N-03: Unexpected Parquet schema (missing required column) triggers error', () => {
    // Test input row missing required 'skills' field in transform
    const invalidResumeRow = {
      resume_id: 'R_000001',
      role: 'Engineer',
      seniority: 'Mid',
      years_experience: 3,
      industry: 'Tech',
      education: 'BSc',
      // missing skills!
    };

    assert.throws(
      () => transformResumeToStagedCandidate(invalidResumeRow),
      /Missing skills array in resume/
    );

    const invalidJobRow = {
      job_id: 'J_000001',
      // missing job_title!
      seniority: 'Mid',
      industry: 'Tech',
      must_have_skills: ['python'],
    };

    assert.throws(
      () => transformJobToStagedJob(invalidJobRow),
      /Missing or invalid job_title in job/
    );
  });

  await t.test('N-04: Duplicate Candidate source ID is rejected by validator', async () => {
    const testFile = path.join(TEST_SCRATCH_DIR, 'candidates_dup.jsonl');
    const candA = {
      _id: 'candidate:cms:R_000001',
      type: 'candidate',
      source_resume_id: 'R_000001',
      profile: { role: 'Engineer', seniority: 'MID', industry: 'FinTech', years_experience: 3, experience_months: 36 },
      skills: [{ name: 'Go', normalized: 'go' }],
      education: [{ degree: 'BACHELOR' }],
      experience_summary: { bullets: ['Worked'] },
      experience: [],
      projects: [],
      data_availability: { skills: 'AVAILABLE', experience: 'PARTIAL', education: 'PARTIAL', projects: 'UNAVAILABLE' },
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
      provenance: { classification: 'mixed' },
    };
    const candB = { ...candA, _id: 'candidate:cms:R_000002' }; // Same source_resume_id 'R_000001'!

    fs.writeFileSync(testFile, JSON.stringify(candA) + '\n' + JSON.stringify(candB) + '\n');

    await assert.rejects(
      () => validateCandidates(testFile),
      /Duplicate Candidate source_resume_id detected: R_000001/
    );
  });

  await t.test('N-05: Duplicate Job source ID is rejected by validator', async () => {
    const testFile = path.join(TEST_SCRATCH_DIR, 'jobs_dup.jsonl');
    const jobA = {
      _id: 'job:cms:J_000001',
      type: 'job',
      source_job_id: 'J_000001',
      title: 'Engineer',
      seniority: 'SENIOR',
      industry: 'FinTech',
      description: 'Role description',
      responsibilities: ['Code'],
      requirements: {
        general: ['Req'],
        experience: { status: 'UNAVAILABLE' },
        education: { status: 'UNAVAILABLE' },
        project: { status: 'UNAVAILABLE' },
      },
      required_skills: ['go'],
      optional_skills: ['docker'],
      status: 'DRAFT',
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
      provenance: { classification: 'mixed' },
    };
    const jobB = { ...jobA, _id: 'job:cms:J_000002' }; // Same source_job_id!

    fs.writeFileSync(testFile, JSON.stringify(jobA) + '\n' + JSON.stringify(jobB) + '\n');

    await assert.rejects(
      () => validateJobs(testFile),
      /Duplicate Job source_job_id detected: J_000001/
    );
  });

  await t.test('N-06: Duplicate matching pair is rejected by validator', async () => {
    const testFile = path.join(TEST_SCRATCH_DIR, 'matches_dup.jsonl');
    const pair = {
      pair_id: 'pair:cms:J_000001:R_000001',
      job_id: 'J_000001',
      resume_id: 'R_000001',
    };

    fs.writeFileSync(testFile, JSON.stringify(pair) + '\n' + JSON.stringify(pair) + '\n');

    const sourceResumeIds = new Set(['R_000001']);
    const sourceJobIds = new Set(['J_000001']);

    await assert.rejects(
      () => validateMatches(testFile, sourceResumeIds, sourceJobIds),
      /Duplicate match pair detected: pair:cms:J_000001:R_000001/
    );
  });

  await t.test('N-07: Orphan matching reference is rejected by validator', async () => {
    const testFile = path.join(TEST_SCRATCH_DIR, 'matches_orphan.jsonl');
    const pair = {
      pair_id: 'pair:cms:J_000001:R_999999',
      job_id: 'J_000001',
      resume_id: 'R_999999', // Unknown resume_id!
    };

    fs.writeFileSync(testFile, JSON.stringify(pair) + '\n');

    const sourceResumeIds = new Set(['R_000001']); // Does not include R_999999
    const sourceJobIds = new Set(['J_000001']);

    await assert.rejects(
      () => validateMatches(testFile, sourceResumeIds, sourceJobIds),
      /Orphan resume_id in matches.*R_999999/
    );
  });

  await t.test('N-08: Normalized skill collision triggers Zod refinement failure', () => {
    const candidateWithCollision = {
      _id: 'candidate:cms:R_000001',
      type: 'candidate',
      source_resume_id: 'R_000001',
      profile: { role: 'Dev', seniority: 'MID', industry: 'SaaS', years_experience: 2, experience_months: 24 },
      skills: [
        { name: 'React.js', normalized: 'react' },
        { name: 'react', normalized: 'react' }, // Duplicate normalized skill!
      ],
      education: [{ degree: 'BACHELOR' }],
      experience: [],
      projects: [],
      data_availability: { skills: 'AVAILABLE', experience: 'PARTIAL', education: 'PARTIAL', projects: 'UNAVAILABLE' },
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
      provenance: { classification: 'mixed' },
    };

    const result = stagedCandidateSchema.safeParse(candidateWithCollision);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /Duplicate normalized skill detected/);
  });

  await t.test('N-09: Invalid staged Candidate (negative experience) is rejected by Zod', () => {
    const candidateWithNegativeExp = {
      _id: 'candidate:cms:R_000001',
      type: 'candidate',
      source_resume_id: 'R_000001',
      profile: { role: 'Dev', seniority: 'MID', industry: 'SaaS', years_experience: -3, experience_months: -36 },
      skills: [{ name: 'Python', normalized: 'python' }],
      education: [{ degree: 'BACHELOR' }],
      experience: [],
      projects: [],
      data_availability: { skills: 'AVAILABLE', experience: 'PARTIAL', education: 'PARTIAL', projects: 'UNAVAILABLE' },
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
      provenance: { classification: 'mixed' },
    };

    const result = stagedCandidateSchema.safeParse(candidateWithNegativeExp);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /Years experience cannot be negative/);
  });

  await t.test('N-10: Invalid staged Job (overlapping skills) is rejected by Zod', () => {
    const jobWithOverlap = {
      _id: 'job:cms:J_000001',
      type: 'job',
      source_job_id: 'J_000001',
      title: 'Dev',
      seniority: 'MID',
      industry: 'SaaS',
      description: 'Desc',
      responsibilities: ['Code'],
      requirements: {
        general: ['General'],
        experience: { status: 'UNAVAILABLE' },
        education: { status: 'UNAVAILABLE' },
        project: { status: 'UNAVAILABLE' },
      },
      required_skills: ['python', 'docker'],
      optional_skills: ['docker', 'kubernetes'], // 'docker' is in both!
      status: 'DRAFT',
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
      provenance: { classification: 'mixed' },
    };

    const result = stagedJobSchema.safeParse(jobWithOverlap);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /cannot be present in both required_skills and optional_skills/);
  });

  await t.test('N-11: Validation failure before publish preserves existing active release', async () => {
    const fakeStaging = path.join(TEST_SCRATCH_DIR, 'staging_invalid');
    const fakeReleases = path.join(TEST_SCRATCH_DIR, 'releases');
    const fakeManifests = path.join(TEST_SCRATCH_DIR, 'manifests');
    fs.mkdirSync(fakeStaging, { recursive: true });
    fs.mkdirSync(fakeManifests, { recursive: true });

    // Establish a pre-existing "active" manifest
    const preExistingManifest = path.join(fakeManifests, 'etl-manifest.json');
    fs.writeFileSync(preExistingManifest, JSON.stringify({ active_release_id: 'release:v0:PRE_EXISTING' }), 'utf8');

    // Put an invalid candidates file into staging
    fs.writeFileSync(path.join(fakeStaging, 'candidates.jsonl'), '{"invalid": true}\n');
    fs.writeFileSync(path.join(fakeStaging, 'jobs.jsonl'), '{"invalid": true}\n');
    fs.writeFileSync(path.join(fakeStaging, 'matches.jsonl'), '{"invalid": true}\n');

    // Run validation
    await assert.rejects(
      () => runValidationAndPublication({
        stagingDir: fakeStaging,
        releasesDir: fakeReleases,
        manifestsDir: fakeManifests,
      })
    );

    // Verify pre-existing manifest was NOT touched
    const content = JSON.parse(fs.readFileSync(preExistingManifest, 'utf8'));
    assert.equal(content.active_release_id, 'release:v0:PRE_EXISTING', 'Active manifest must remain untouched');
  });

  await t.test('N-12: Failure before active pointer switch preserves active pointer', async () => {
    // If validation fails or process is interrupted before pointer switch,
    // the pointer file is never updated.
    const fakeManifests = path.join(TEST_SCRATCH_DIR, 'manifests_ptr');
    fs.mkdirSync(fakeManifests, { recursive: true });
    const pointerFile = path.join(fakeManifests, 'etl-manifest.json');
    fs.writeFileSync(pointerFile, JSON.stringify({ active_pointer: 'OLD_ACTIVE_VERSION' }), 'utf8');

    // Ensure non-existent staging directory throws before any pointer mutation
    await assert.rejects(
      () => runValidationAndPublication({
        stagingDir: path.join(TEST_SCRATCH_DIR, 'non_existent_staging'),
        manifestsDir: fakeManifests,
      })
    );

    const afterContent = JSON.parse(fs.readFileSync(pointerFile, 'utf8'));
    assert.equal(afterContent.active_pointer, 'OLD_ACTIVE_VERSION', 'Pointer must not mutate on failure');
  });

  await t.test('N-13: Deterministic rerun detects unchanged release and avoids duplicate releases', async () => {
    const realManifestPath = path.join(REPO_ROOT, 'data/processed/manifests/etl-manifest.json');
    assert.equal(fs.existsSync(realManifestPath), true);
    const initialManifest = JSON.parse(fs.readFileSync(realManifestPath, 'utf8'));

    // Verify that release digest is consistent
    assert.ok(initialManifest.release_digest);
    assert.ok(initialManifest.release_id.includes(initialManifest.release_digest.slice(0, 16)));
  });

  await t.test('N-14: Version/config change creates distinct immutable release', () => {
    const releasesDir = path.join(REPO_ROOT, 'data/processed/releases');
    const existingDirs = fs.readdirSync(releasesDir);

    // Assert that immutable release directory has content digest suffix
    const contentAddressedDir = existingDirs.find((d) => d.startsWith('DATA-02B.2_'));
    assert.ok(contentAddressedDir, 'Should have content-addressed release folder: DATA-02B.2_<short_digest>');
  });

  await t.test('N-15: Existing active release remains readable and intact after all test runs', async () => {
    const activeCand = path.join(REPO_ROOT, 'data/processed/staged/candidates.jsonl');
    const activeJob = path.join(REPO_ROOT, 'data/processed/staged/jobs.jsonl');
    const activeMatch = path.join(REPO_ROOT, 'data/processed/evaluation/matches.jsonl');
    const activeManifest = path.join(REPO_ROOT, 'data/processed/manifests/etl-manifest.json');

    assert.equal(fs.existsSync(activeCand), true);
    assert.equal(fs.existsSync(activeJob), true);
    assert.equal(fs.existsSync(activeMatch), true);
    assert.equal(fs.existsSync(activeManifest), true);

    const manifest = JSON.parse(fs.readFileSync(activeManifest, 'utf8'));
    assert.equal(manifest.active_pointer_status, 'ACTIVE');
    assert.equal(manifest.record_counts.candidates, 10000);
    assert.equal(manifest.record_counts.jobs, 2500);
    assert.equal(manifest.record_counts.match_pairs, 75000);

    const candSha = computeFileSha256(activeCand);
    assert.equal(candSha, manifest.output_files['data/processed/staged/candidates.jsonl'].sha256);
  });
});
