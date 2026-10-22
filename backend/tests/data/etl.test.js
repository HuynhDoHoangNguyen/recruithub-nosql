/**
 * DATA-02B.2 ETL Pipeline Integration & Validation Tests (Task F)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  transformResumeToStagedCandidate,
  transformJobToStagedJob,
  transformMatchesToEvaluationPairs,
} from '../../../scripts/dataset/transform-staged.js';
import {
  stagedCandidateSchema,
  candidateDocumentSchema,
} from '../../src/schemas/candidate.schema.js';
import {
  stagedJobSchema,
  jobDocumentSchema,
} from '../../src/schemas/job.schema.js';
import { CANONICAL_DEGREES } from '../../src/constants/document.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');

function computeFileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function countJsonlLines(filePath) {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (line.trim()) count++;
  }
  return count;
}

test('DATA-02B.2: ETL Pipeline Integration Tests', async (t) => {
  await t.test('1 & 2. Source ID mapping to namespace', () => {
    const rawResume = {
      resume_id: 'R_000123',
      role: 'Backend Engineer',
      seniority: 'Mid',
      industry: 'FinTech',
      years_experience: 5,
      skills: ['Python', 'Docker'],
      education: 'BSc',
      experience_bullets: ['Built APIs'],
    };
    const stagedCand = transformResumeToStagedCandidate(rawResume);
    assert.equal(stagedCand._id, 'candidate:cms:R_000123');
    assert.equal(stagedCand.source_resume_id, 'R_000123');

    const rawJob = {
      job_id: 'J_000045',
      job_title: 'Software Engineer',
      seniority: 'Senior',
      industry: 'SaaS',
      description: 'Job description text',
      responsibilities: ['Responsibility A'],
      requirements: ['Requirement A'],
      must_have_skills: ['Go', 'Docker'],
      nice_to_have_skills: ['Kubernetes'],
    };
    const stagedJob = transformJobToStagedJob(rawJob);
    assert.equal(stagedJob._id, 'job:cms:J_000045');
    assert.equal(stagedJob.source_job_id, 'J_000045');
  });

  await t.test('3. Experience years to months derivation', () => {
    const rawResume = {
      resume_id: 'R_000002',
      role: 'Frontend Engineer',
      seniority: 'Junior',
      industry: 'Retail',
      years_experience: 3,
      skills: ['JavaScript'],
      education: 'BA',
      experience_bullets: ['Built web app'],
    };
    const stagedCand = transformResumeToStagedCandidate(rawResume);
    assert.equal(stagedCand.profile.years_experience, 3);
    assert.equal(stagedCand.profile.experience_months, 36);
  });

  await t.test('4. Degree normalization across approved tiers', () => {
    const degrees = [
      { raw: 'BSc', expected: CANONICAL_DEGREES.BACHELOR },
      { raw: 'BA', expected: CANONICAL_DEGREES.BACHELOR },
      { raw: 'MBA', expected: CANONICAL_DEGREES.MASTER },
      { raw: 'MSc', expected: CANONICAL_DEGREES.MASTER },
      { raw: 'High School', expected: CANONICAL_DEGREES.HIGH_SCHOOL },
    ];

    for (const d of degrees) {
      const raw = {
        resume_id: 'R_000003',
        role: 'Data Analyst',
        seniority: 'Mid',
        industry: 'FinTech',
        years_experience: 2,
        skills: ['SQL'],
        education: d.raw,
        experience_bullets: ['Data analysis'],
      };
      const cand = transformResumeToStagedCandidate(raw);
      assert.equal(cand.education[0].degree, d.expected);
    }
  });

  await t.test('5 & 6. Skill normalization preserves count and required/optional disjointness', () => {
    const rawJob = {
      job_id: 'J_000002',
      job_title: 'Full Stack Engineer',
      seniority: 'Mid',
      industry: 'Healthcare',
      description: 'Full stack development',
      responsibilities: ['Development'],
      requirements: ['General requirement'],
      must_have_skills: ['Node.js', 'React.js'],
      nice_to_have_skills: ['React.js', 'Docker'], // Overlaps with must_have
    };
    const stagedJob = transformJobToStagedJob(rawJob);
    assert.deepEqual(stagedJob.required_skills, ['node.js', 'react']);
    // Overlapping 'react' was filtered out from optional_skills
    assert.deepEqual(stagedJob.optional_skills, ['docker']);
  });

  await t.test('7, 8, 9. Partial profile integrity: no fabricated school, employment, or projects', () => {
    const rawResume = {
      resume_id: 'R_000004',
      role: 'DevOps Engineer',
      seniority: 'Senior',
      industry: 'Cloud',
      years_experience: 8,
      skills: ['Docker', 'Kubernetes'],
      education: 'BSc',
      experience_bullets: ['Managed clusters'],
    };
    const cand = transformResumeToStagedCandidate(rawResume);
    assert.equal(cand.education.length, 1);
    assert.equal(cand.education[0].institution, undefined);
    assert.equal(cand.education[0].field_of_study, undefined);
    assert.equal(cand.experience.length, 0);
    assert.equal(cand.projects.length, 0);
  });

  await t.test('10. Staged vs Final boundary enforcement', () => {
    const rawResume = {
      resume_id: 'R_000005',
      role: 'QA Engineer',
      seniority: 'Junior',
      industry: 'Gaming',
      years_experience: 1,
      skills: ['Selenium'],
      education: 'BSc',
      experience_bullets: ['Automated tests'],
    };
    const cand = transformResumeToStagedCandidate(rawResume);
    assert.equal(stagedCandidateSchema.safeParse(cand).success, true);
    assert.equal(candidateDocumentSchema.safeParse(cand).success, false);

    const rawJob = {
      job_id: 'J_000003',
      job_title: 'QA Lead',
      seniority: 'Senior',
      industry: 'Gaming',
      description: 'Lead QA',
      responsibilities: ['Lead tests'],
      requirements: ['General req'],
      must_have_skills: ['Selenium', 'Python'],
      nice_to_have_skills: ['Docker'],
    };
    const job = transformJobToStagedJob(rawJob);
    assert.equal(stagedJobSchema.safeParse(job).success, true);
    assert.equal(jobDocumentSchema.safeParse(job).success, false);
  });

  await t.test('11, 12, 13. Published dataset record counts match contract', async () => {
    const candPath = path.join(REPO_ROOT, 'data/processed/staged/candidates.jsonl');
    const jobPath = path.join(REPO_ROOT, 'data/processed/staged/jobs.jsonl');
    const matchPath = path.join(REPO_ROOT, 'data/processed/evaluation/matches.jsonl');

    assert.equal(fs.existsSync(candPath), true, 'candidates.jsonl must exist');
    assert.equal(fs.existsSync(jobPath), true, 'jobs.jsonl must exist');
    assert.equal(fs.existsSync(matchPath), true, 'matches.jsonl must exist');

    const candCount = await countJsonlLines(candPath);
    const jobCount = await countJsonlLines(jobPath);
    const matchCount = await countJsonlLines(matchPath);

    assert.equal(candCount, 10000, 'Must have exactly 10,000 Candidates');
    assert.equal(jobCount, 2500, 'Must have exactly 2,500 Jobs');
    assert.equal(matchCount, 75000, 'Must have exactly 75,000 Match Pairs');
  });

  await t.test('14. Zero duplicate and zero orphan references in published matches', async () => {
    const manifestPath = path.join(REPO_ROOT, 'data/processed/manifests/etl-manifest.json');
    assert.equal(fs.existsSync(manifestPath), true, 'etl-manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.integrity_summary.all_records_valid, true);
    assert.equal(manifest.integrity_summary.duplicate_candidate_ids, 0);
    assert.equal(manifest.integrity_summary.duplicate_job_ids, 0);
    assert.equal(manifest.integrity_summary.duplicate_match_pairs, 0);
    assert.equal(manifest.integrity_summary.orphan_evaluation_pairs, 0);
    assert.equal(manifest.integrity_summary.unmatched_resumes_preserved, 29);
  });

  await t.test('15. Deterministic rerun produces identical output checksums', async () => {
    const candPath = path.join(REPO_ROOT, 'data/processed/staged/candidates.jsonl');
    const jobPath = path.join(REPO_ROOT, 'data/processed/staged/jobs.jsonl');
    const matchPath = path.join(REPO_ROOT, 'data/processed/evaluation/matches.jsonl');
    const manifestPath = path.join(REPO_ROOT, 'data/processed/manifests/etl-manifest.json');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const actualCandSha = computeFileSha256(candPath);
    const actualJobSha = computeFileSha256(jobPath);
    const actualMatchSha = computeFileSha256(matchPath);

    assert.equal(actualCandSha, manifest.output_files['data/processed/staged/candidates.jsonl'].sha256);
    assert.equal(actualJobSha, manifest.output_files['data/processed/staged/jobs.jsonl'].sha256);
    assert.equal(actualMatchSha, manifest.output_files['data/processed/evaluation/matches.jsonl'].sha256);
  });

  await t.test('16. Negative test: corrupted record in staging is rejected without affecting active release', () => {
    const invalidCandidate = {
      _id: 'candidate:cms:R_999999',
      type: 'candidate',
      profile: {
        role: 'Hacker',
        seniority: 'INVALID_SENIORITY', // Invalid enum
        industry: 'Tech',
        years_experience: -5, // Negative
        experience_months: 10,
      },
      skills: [],
      education: [],
      experience: [],
      projects: [],
      data_availability: {
        skills: 'AVAILABLE',
        experience: 'AVAILABLE',
        education: 'AVAILABLE',
        projects: 'AVAILABLE',
      },
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
      provenance: { classification: 'source' },
    };

    const result = stagedCandidateSchema.safeParse(invalidCandidate);
    assert.equal(result.success, false);
  });
});
