#!/usr/bin/env node
/**
 * DATA-02B.2 / DATA-02B.3: Hardened Staged Transformation Script
 * 
 * Transforms raw interim records from interim directory into standardized
 * Staged Candidate, Staged Job, and Evaluation Match Pair records.
 * Outputs to staging directory with fail-fast input validation and CLI options.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  AVAILABILITY_STATES,
  DOCUMENT_TYPES,
  JOB_STATUSES,
  PROVENANCE_CLASSIFICATIONS,
  REQUIREMENT_STATUSES,
  SENIORITY_LEVELS,
} from '../../backend/src/constants/document.constants.js';
import {
  candidateIdFromResumeId,
  jobIdFromSourceId,
} from '../../backend/src/utils/id.utils.js';
import {
  normalizeDegree,
  normalizeSkill,
} from '../../backend/src/utils/normalization.utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

// Canonical Scenario Clock (Deterministic)
export const SCENARIO_CLOCK = '2026-10-21T00:00:00Z';
export const TRANSFORM_VERSION = 'DATA-02B.2';
export const SOURCE_DATASET = 'michaelozon/candidate-matching-synthetic';

export const SOURCE_HASHES = Object.freeze({
  resumes: '4a25add9c3a620c4c396e867063e390fc8084f9b53ed8135def049303a29d7a4',
  jobs: 'c13d7c7e0ab510e81117974027de1364f973a27b3cacc8fabfbd8851c352c871',
  matches: 'dab24e40948b2da348c6df7072b5b5fe3bb6ef8cab335f88eeF5d5667ee79a92'.toLowerCase(),
});

/**
 * Reads lines from a JSONL file.
 * @param {string} filePath 
 * @returns {Promise<Array<any>>}
 */
async function readJsonl(filePath) {
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
 * Transforms a raw Resume record into a Staged Candidate document.
 */
export function transformResumeToStagedCandidate(row) {
  if (!row || typeof row !== 'object') {
    throw new TypeError('Invalid resume row: must be an object');
  }
  if (!row.resume_id || typeof row.resume_id !== 'string') {
    throw new Error('Missing or invalid resume_id in raw resume record');
  }
  if (!row.role || typeof row.role !== 'string') {
    throw new Error(`Missing or invalid role in resume: ${row.resume_id}`);
  }
  if (row.years_experience === undefined || row.years_experience === null || Number.isNaN(Number(row.years_experience))) {
    throw new Error(`Missing or invalid years_experience in resume: ${row.resume_id}`);
  }
  if (!Array.isArray(row.skills)) {
    throw new Error(`Missing skills array in resume: ${row.resume_id}`);
  }

  const resumeId = row.resume_id.trim();
  const candidateId = candidateIdFromResumeId(resumeId);
  const yearsExp = Number(row.years_experience);
  const monthsExp = yearsExp * 12;

  // Normalize seniority to standard enum
  const rawSeniority = (row.seniority || '').trim().toUpperCase();
  const seniority = Object.values(SENIORITY_LEVELS).includes(rawSeniority)
    ? rawSeniority
    : SENIORITY_LEVELS.MID;

  // Normalize skills without duplicate loss
  const seenSkills = new Set();
  const skills = [];
  for (const s of row.skills) {
    const rawName = String(s).trim();
    const normalized = normalizeSkill(rawName);
    if (!seenSkills.has(normalized)) {
      seenSkills.add(normalized);
      skills.push({ name: rawName, normalized });
    }
  }

  // Normalize education
  const canonicalDegree = normalizeDegree(String(row.education || ''));

  // Bullets
  const bullets = (row.experience_bullets || []).map((b) => String(b).trim());

  return {
    _id: candidateId,
    type: DOCUMENT_TYPES.CANDIDATE,
    source_resume_id: resumeId,
    profile: {
      role: row.role.trim(),
      seniority,
      industry: (row.industry || '').trim(),
      years_experience: yearsExp,
      experience_months: monthsExp,
      summary: row.summary ? row.summary.trim() : undefined,
    },
    skills,
    education: [
      {
        degree: canonicalDegree,
      },
    ],
    experience_summary: {
      bullets,
    },
    experience: [],
    projects: [],
    data_availability: {
      skills: AVAILABILITY_STATES.AVAILABLE,
      experience: AVAILABILITY_STATES.PARTIAL,
      education: AVAILABILITY_STATES.PARTIAL,
      projects: AVAILABILITY_STATES.UNAVAILABLE,
    },
    created_at: SCENARIO_CLOCK,
    updated_at: SCENARIO_CLOCK,
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.MIXED,
      source_dataset: SOURCE_DATASET,
      source_file: 'resumes.parquet',
      source_ids: { resume_id: resumeId },
      source_hashes: { 'resumes.parquet': SOURCE_HASHES.resumes },
      transform_version: TRANSFORM_VERSION,
      field_origins: {
        'profile.role': 'source',
        'profile.seniority': 'normalized',
        'profile.industry': 'source',
        'profile.years_experience': 'source',
        'profile.experience_months': 'derived',
        'profile.summary': 'source',
        skills: 'normalized',
        education: 'normalized',
        experience_summary: 'source',
        experience: 'unavailable',
        projects: 'unavailable',
        created_at: 'synthetic',
        updated_at: 'synthetic',
      },
    },
  };
}

/**
 * Transforms a raw Job record into a Staged Job document.
 */
export function transformJobToStagedJob(row) {
  if (!row || typeof row !== 'object') {
    throw new TypeError('Invalid job row: must be an object');
  }
  if (!row.job_id || typeof row.job_id !== 'string') {
    throw new Error('Missing or invalid job_id in raw job record');
  }
  if (!row.job_title || typeof row.job_title !== 'string') {
    throw new Error(`Missing or invalid job_title in job: ${row.job_id}`);
  }
  if (!Array.isArray(row.must_have_skills)) {
    throw new Error(`Missing must_have_skills array in job: ${row.job_id}`);
  }

  const jobId = row.job_id.trim();
  const jobDocId = jobIdFromSourceId(jobId);

  const rawSeniority = (row.seniority || '').trim().toUpperCase();
  const seniority = Object.values(SENIORITY_LEVELS).includes(rawSeniority)
    ? rawSeniority
    : SENIORITY_LEVELS.MID;

  // Normalize required skills (must_have_skills)
  const seenReq = new Set();
  const requiredSkills = [];
  for (const s of row.must_have_skills || []) {
    const norm = normalizeSkill(String(s));
    if (!seenReq.has(norm)) {
      seenReq.add(norm);
      requiredSkills.push(norm);
    }
  }

  // Normalize optional skills (nice_to_have_skills), ensuring disjoint set
  const seenOpt = new Set();
  const optionalSkills = [];
  for (const s of row.nice_to_have_skills || []) {
    const norm = normalizeSkill(String(s));
    if (!seenReq.has(norm) && !seenOpt.has(norm)) {
      seenOpt.add(norm);
      optionalSkills.push(norm);
    }
  }

  return {
    _id: jobDocId,
    type: DOCUMENT_TYPES.JOB,
    source_job_id: jobId,
    title: row.job_title.trim(),
    seniority,
    industry: (row.industry || '').trim(),
    description: (row.description || '').trim(),
    responsibilities: (row.responsibilities || []).map((r) => String(r).trim()),
    requirements: {
      general: (row.requirements || []).map((req) => String(req).trim()),
      experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.UNAVAILABLE },
      education: { status: REQUIREMENT_STATUSES.EDUCATION.UNAVAILABLE },
      project: { status: REQUIREMENT_STATUSES.PROJECT.UNAVAILABLE },
    },
    required_skills: requiredSkills,
    optional_skills: optionalSkills,
    status: JOB_STATUSES.DRAFT,
    created_at: SCENARIO_CLOCK,
    updated_at: SCENARIO_CLOCK,
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.MIXED,
      source_dataset: SOURCE_DATASET,
      source_file: 'jobs.parquet',
      source_ids: { job_id: jobId },
      source_hashes: { 'jobs.parquet': SOURCE_HASHES.jobs },
      transform_version: TRANSFORM_VERSION,
      field_origins: {
        title: 'source',
        seniority: 'normalized',
        industry: 'source',
        description: 'source',
        responsibilities: 'source',
        'requirements.general': 'source',
        'requirements.experience': 'unavailable',
        'requirements.education': 'unavailable',
        'requirements.project': 'unavailable',
        required_skills: 'normalized',
        optional_skills: 'normalized',
        status: 'synthetic',
        created_at: 'synthetic',
        updated_at: 'synthetic',
      },
    },
  };
}

/**
 * Transforms raw Match records into flattened evaluation ground-truth pairs.
 */
export function transformMatchesToEvaluationPairs(rawMatches) {
  if (!Array.isArray(rawMatches)) {
    throw new TypeError('rawMatches must be an array');
  }

  const pairs = [];
  for (const row of rawMatches) {
    if (!row || typeof row !== 'object') continue;
    const jobId = String(row.job_id || '').trim();
    if (!jobId) throw new Error('Missing job_id in raw match record');
    const resumeIds = row.relevant_resume_ids || [];
    for (const resId of resumeIds) {
      const resumeId = String(resId).trim();
      pairs.push({
        pair_id: `pair:cms:${jobId}:${resumeId}`,
        job_id: jobId,
        resume_id: resumeId,
        job_doc_id: `job:cms:${jobId}`,
        candidate_doc_id: `candidate:cms:${resumeId}`,
        provenance: {
          classification: 'source',
          source_dataset: SOURCE_DATASET,
          source_file: 'matches.parquet',
          selection_basis: 'ground_truth_retrieval_pair',
        },
      });
    }
  }

  // Stable sort by job_id ASC, resume_id ASC
  pairs.sort((a, b) => {
    const jobCmp = a.job_id.localeCompare(b.job_id);
    if (jobCmp !== 0) return jobCmp;
    return a.resume_id.localeCompare(b.resume_id);
  });

  return pairs;
}

/**
 * Main execution flow
 */
export async function runTransform(interimDir, stagingDir) {
  console.log(`\nTransforming raw records from: ${interimDir}`);
  console.log(`Output staging directory:     ${stagingDir}`);

  fs.mkdirSync(stagingDir, { recursive: true });

  // 1. Transform Candidates
  const rawResumes = await readJsonl(path.join(interimDir, 'raw-resumes.jsonl'));
  rawResumes.sort((a, b) => a.resume_id.localeCompare(b.resume_id));
  const stagedCandidates = rawResumes.map(transformResumeToStagedCandidate);

  const candOut = path.join(stagingDir, 'candidates.jsonl');
  const candLines = stagedCandidates.map((c) => JSON.stringify(c)).join('\n') + '\n';
  fs.writeFileSync(candOut, candLines, 'utf8');
  console.log(`  -> Transformed ${stagedCandidates.length} Candidates to ${candOut}`);

  // 2. Transform Jobs
  const rawJobs = await readJsonl(path.join(interimDir, 'raw-jobs.jsonl'));
  rawJobs.sort((a, b) => a.job_id.localeCompare(b.job_id));
  const stagedJobs = rawJobs.map(transformJobToStagedJob);

  const jobOut = path.join(stagingDir, 'jobs.jsonl');
  const jobLines = stagedJobs.map((j) => JSON.stringify(j)).join('\n') + '\n';
  fs.writeFileSync(jobOut, jobLines, 'utf8');
  console.log(`  -> Transformed ${stagedJobs.length} Jobs to ${jobOut}`);

  // 3. Transform Matches
  const rawMatches = await readJsonl(path.join(interimDir, 'raw-matches.jsonl'));
  const evaluationPairs = transformMatchesToEvaluationPairs(rawMatches);

  const matchOut = path.join(stagingDir, 'matches.jsonl');
  const matchLines = evaluationPairs.map((p) => JSON.stringify(p)).join('\n') + '\n';
  fs.writeFileSync(matchOut, matchLines, 'utf8');
  console.log(`  -> Transformed ${evaluationPairs.length} Evaluation Pairs to ${matchOut}`);

  console.log('\nTransformation to staging directory completed successfully.');
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let interimDir = path.join(REPO_ROOT, 'data/interim');
  let stagingDir = path.join(REPO_ROOT, 'data/processed/staging');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--interim-dir' && args[i + 1]) {
      interimDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--staging-dir' && args[i + 1]) {
      stagingDir = path.resolve(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('--') && i === 0) {
      stagingDir = path.resolve(args[i]);
    }
  }

  return { interimDir, stagingDir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { interimDir, stagingDir } = parseCliArgs();

  runTransform(interimDir, stagingDir).catch((err) => {
    console.error('[FATAL] Transformation failed:', err);
    process.exit(1);
  });
}
