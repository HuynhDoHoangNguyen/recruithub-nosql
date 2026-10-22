#!/usr/bin/env node
/**
 * DATA-03.4B: Resume Analysis Generator & Final Corpus Assembler
 * 
 * Responsibilities:
 * 1. Reads authoritative DATA-03.3B recruitment release via active manifest pointer.
 * 2. In SYNTHETIC_DEMO scenario (default): enriches 150 OPEN Jobs according to approved 3-tier policy.
 *    In SOURCE_ONLY scenario: preserves 100% untouched jobs.
 * 3. Evaluates exactly 1,200 Resume Analyses using approved pure scoring engine.
 * 4. Statically verifies input fingerprints and freshness.
 * 5. Emits all 9 business document JSONL files into staging directory data/staging_final_corpus/.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  DOCUMENT_TYPES,
  PROVENANCE_CLASSIFICATIONS,
} from '../../backend/src/constants/document.constants.js';
import {
  SCORING_ALGORITHM_VERSION,
  ANALYSIS_STATUSES,
  RECOMMENDATION_LEVELS,
} from '../../backend/src/schemas/resume-analysis.schema.js';
import {
  evaluateResumeAnalysis,
  computeInputFingerprint,
  isAnalysisFresh,
} from '../../backend/src/utils/resume-scoring.utils.js';
import {
  POLICY_SEED,
  POLICY_VERSION,
  GENERATOR_VERSION,
  TIER_NAMES,
  classifyOpenJobTiers,
  applyJobRequirementPolicy,
} from './job-requirement-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

export const SCENARIO_TYPES = Object.freeze({
  SYNTHETIC_DEMO: 'SYNTHETIC_DEMO',
  SOURCE_ONLY: 'SOURCE_ONLY',
});

/**
 * Streams a JSONL file and returns an array of parsed objects.
 */
async function loadJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const docs = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    docs.push(JSON.parse(trimmed));
  }
  return docs;
}

/**
 * Main generator procedure for DATA-03.4B.
 */
export async function generateResumeAnalyses(options = {}) {
  const scenario = options.scenario || SCENARIO_TYPES.SYNTHETIC_DEMO;
  const manifestsDir = options.manifestsDir || path.resolve(REPO_ROOT, 'data/processed/manifests');
  const recruitmentManifestPath = options.recruitmentManifestPath || path.join(manifestsDir, 'recruitment-manifest.json');
  const stagingDir = options.stagingDir || path.resolve(REPO_ROOT, 'data/staging_final_corpus');

  console.log('=== DATA-03.4B: RESUME ANALYSIS GENERATOR ===');
  console.log(`Scenario:             ${scenario}`);
  console.log(`Recruitment Manifest: ${recruitmentManifestPath}`);
  console.log(`Staging Directory:    ${stagingDir}\n`);

  if (!fs.existsSync(recruitmentManifestPath)) {
    throw new Error(`Active recruitment manifest pointer not found: ${recruitmentManifestPath}`);
  }

  const recruitmentManifest = JSON.parse(fs.readFileSync(recruitmentManifestPath, 'utf8'));
  const recruitmentDir = path.resolve(REPO_ROOT, recruitmentManifest.immutable_release_dir);

  console.log(`1/5 Loading input dataset from DATA-03.3B (${recruitmentDir})...`);
  const [candidates, jobs, users, companies, departments, recruiters, applications, interviews] = await Promise.all([
    loadJsonl(path.join(recruitmentDir, 'candidates.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'jobs.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'users.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'companies.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'departments.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'recruiters.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'applications.jsonl')),
    loadJsonl(path.join(recruitmentDir, 'interviews.jsonl')),
  ]);

  console.log(`  - Candidates:   ${candidates.length}`);
  console.log(`  - Jobs:         ${jobs.length}`);
  console.log(`  - Users:        ${users.length}`);
  console.log(`  - Companies:    ${companies.length}`);
  console.log(`  - Departments:  ${departments.length}`);
  console.log(`  - Recruiters:   ${recruiters.length}`);
  console.log(`  - Applications: ${applications.length}`);
  console.log(`  - Interviews:   ${interviews.length}\n`);

  if (candidates.length !== 10000 || jobs.length !== 2500 || applications.length !== 1200) {
    throw new Error(`Unexpected record count in input recruitment release`);
  }

  // 2. Prepare final Jobs snapshot
  console.log('2/5 Preparing authoritative Jobs snapshot...');
  let finalJobs;
  let tierMap;

  if (scenario === SCENARIO_TYPES.SYNTHETIC_DEMO) {
    tierMap = classifyOpenJobTiers(jobs);
    let enrichedCount = 0;
    let untouchedCount = 0;

    finalJobs = jobs.map((job) => {
      const enriched = applyJobRequirementPolicy(job, tierMap);
      const tierInfo = tierMap.get(job._id);
      if (tierInfo && tierInfo.tier !== TIER_NAMES.TIER_3) {
        enrichedCount++;
      } else {
        untouchedCount++;
      }
      return enriched;
    });

    console.log(`  - Enriched OPEN Jobs:   ${enrichedCount} (100 Tier 1 + 50 Tier 2)`);
    console.log(`  - Untouched Jobs:       ${untouchedCount} (50 Tier 3 + 2,300 DRAFT)\n`);
  } else {
    // SOURCE_ONLY
    finalJobs = jobs.map((j) => JSON.parse(JSON.stringify(j)));
    console.log('  - SOURCE_ONLY scenario: 100% of 2,500 jobs kept untouched (UNAVAILABLE requirements)\n');
  }

  // Index candidates and jobs by _id
  const candidateById = new Map();
  for (const c of candidates) candidateById.set(c._id, c);

  const jobById = new Map();
  for (const j of finalJobs) jobById.set(j._id, j);

  // 3. Generate 1,200 Resume Analyses
  console.log('3/5 Generating 1,200 Resume Analyses via pure scoring engine...');
  const analyses = [];
  let completeCount = 0;
  let incompleteCount = 0;
  const recommendationCounts = {
    [RECOMMENDATION_LEVELS.HIGH]: 0,
    [RECOMMENDATION_LEVELS.MEDIUM]: 0,
    [RECOMMENDATION_LEVELS.LOW]: 0,
  };
  const missingReasonCounts = {};

  for (const app of applications) {
    const candidate = candidateById.get(app.candidate_id);
    const job = jobById.get(app.job_id);

    if (!candidate) {
      throw new Error(`Candidate not found for application ${app._id}: ${app.candidate_id}`);
    }
    if (!job) {
      throw new Error(`Job not found for application ${app._id}: ${app.job_id}`);
    }

    const analysisProvenance = {
      classification: PROVENANCE_CLASSIFICATIONS.DERIVED,
      source_dataset: 'michaelozon/candidate-matching-synthetic',
      generator_seed: POLICY_SEED,
      generator_version: SCORING_ALGORITHM_VERSION,
    };

    const analysis = evaluateResumeAnalysis({
      application: app,
      candidate,
      job,
      analyzedAt: app.applied_at,
      provenance: analysisProvenance,
    });

    // Invariant check: input fingerprint freshness
    if (!isAnalysisFresh(analysis, candidate, job)) {
      throw new Error(`[FRESHNESS ERROR] Analysis ${analysis._id} failed freshness check against inputs`);
    }

    if (analysis.analysis_status === ANALYSIS_STATUSES.COMPLETE) {
      completeCount++;
      recommendationCounts[analysis.recommendation]++;
    } else {
      incompleteCount++;
      for (const item of analysis.missing_inputs) {
        missingReasonCounts[item.code] = (missingReasonCounts[item.code] || 0) + 1;
      }
    }

    analyses.push(analysis);
  }

  console.log(`  - Total Analyses Generated: ${analyses.length}`);
  console.log(`  - COMPLETE Analyses:        ${completeCount} (${((completeCount / analyses.length) * 100).toFixed(2)}%)`);
  if (completeCount > 0) {
    console.log(`    * HIGH   (>= 80):         ${recommendationCounts[RECOMMENDATION_LEVELS.HIGH]}`);
    console.log(`    * MEDIUM (60 - <80):      ${recommendationCounts[RECOMMENDATION_LEVELS.MEDIUM]}`);
    console.log(`    * LOW    (< 60):          ${recommendationCounts[RECOMMENDATION_LEVELS.LOW]}`);
  }
  console.log(`  - INCOMPLETE Analyses:      ${incompleteCount} (${((incompleteCount / analyses.length) * 100).toFixed(2)}%)`);
  console.log('  - Missing Reason Breakdown:', missingReasonCounts, '\n');

  // 4. Staging Output Files
  console.log(`4/5 Emitting 9 business document files to staging directory (${stagingDir})...`);
  fs.mkdirSync(stagingDir, { recursive: true });

  const writeJsonl = (filePath, docs) => {
    const lines = docs.map((d) => JSON.stringify(d)).join('\n') + '\n';
    fs.writeFileSync(filePath, lines, 'utf8');
  };

  writeJsonl(path.join(stagingDir, 'users.jsonl'), users);
  writeJsonl(path.join(stagingDir, 'candidates.jsonl'), candidates);
  writeJsonl(path.join(stagingDir, 'companies.jsonl'), companies);
  writeJsonl(path.join(stagingDir, 'departments.jsonl'), departments);
  writeJsonl(path.join(stagingDir, 'recruiters.jsonl'), recruiters);
  writeJsonl(path.join(stagingDir, 'jobs.jsonl'), finalJobs);
  writeJsonl(path.join(stagingDir, 'applications.jsonl'), applications);
  writeJsonl(path.join(stagingDir, 'interviews.jsonl'), interviews);
  writeJsonl(path.join(stagingDir, 'resume_analyses.jsonl'), analyses);

  const grandTotal =
    users.length +
    candidates.length +
    companies.length +
    departments.length +
    recruiters.length +
    finalJobs.length +
    applications.length +
    interviews.length +
    analyses.length;

  console.log('5/5 Generation completed successfully.');
  console.log(`  - Grand Total Documents: ${grandTotal} across 9 types\n`);

  return {
    scenario,
    grandTotal,
    completeCount,
    incompleteCount,
    recommendationCounts,
    missingReasonCounts,
    stagingDir,
    documentCounts: {
      users: users.length,
      candidates: candidates.length,
      companies: companies.length,
      departments: departments.length,
      recruiters: recruiters.length,
      jobs: finalJobs.length,
      applications: applications.length,
      interviews: interviews.length,
      resume_analyses: analyses.length,
    },
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      options.scenario = args[i + 1];
      i++;
    } else if (args[i] === '--staging-dir' && args[i + 1]) {
      options.stagingDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--manifests-dir' && args[i + 1]) {
      options.manifestsDir = path.resolve(args[i + 1]);
      i++;
    }
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs();
  generateResumeAnalyses(options).catch((err) => {
    console.error('\n[FATAL GENERATOR ERROR]:', err);
    process.exit(1);
  });
}
