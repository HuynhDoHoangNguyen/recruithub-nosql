#!/usr/bin/env node
/**
 * DATA-03.3B: Synthetic Job Lifecycle, Applications & Interviews Generator
 * 
 * Responsibilities:
 * 1. Reads authoritative DATA-03.2 Foundation release via active manifest pointer.
 * 2. Deterministically selects 200 Jobs across 10 industries & 50 companies (top 4 jobs per company) to OPEN.
 * 3. Sets deadline = '2026-11-30T23:59:59Z' and mixed provenance for the 200 OPEN Jobs.
 * 4. Deterministically allocates 1,200 unique Candidate–Job pairs (excluding 75,000 evaluation pairs).
 * 5. Generates valid 12-transition stage histories across 7 Application stages.
 * 6. Generates 350 sequential Interview rounds with realistic scores, feedbacks, and results.
 * 7. Emits 8 business document files into staging directory data/staging_recruitment/.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  APPLICATION_STAGES,
  DOCUMENT_TYPES,
  JOB_STATUSES,
  PROVENANCE_CLASSIFICATIONS,
} from '../../backend/src/constants/document.constants.js';
import { applicationIdFromPair } from '../../backend/src/utils/id.utils.js';
import {
  STAGE_ACTOR_ROLES,
  REJECTION_REASON_CODES,
} from '../../backend/src/utils/application-lifecycle.utils.js';
import {
  interviewIdFromRound,
  APPROVED_INTERVIEW_TYPES,
  INTERVIEW_RESULTS,
} from '../../backend/src/utils/interview-validation.utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

export const GENERATOR_SEED = 'recruithub:data:v1:20261021';
export const GENERATOR_VERSION = 'DATA-03.3B';
export const ALLOCATION_POLICY_VERSION = 'STRATIFIED_COMPANY_TOP4_V1';
export const SCENARIO_BASE_CLOCK = '2026-10-21T00:00:00Z';
export const JOB_OPENING_EFFECTIVE_AT = '2026-10-21T00:00:00Z';
export const JOB_DEADLINE = '2026-11-30T23:59:59Z';
export const SCENARIO_SNAPSHOT_CUTOFF = '2026-11-20T23:59:59Z';

/**
 * Derives a deterministic 64-hex SHA-256 digest from key.
 */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

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
 * Loads the 75,000 evaluation pairs from evaluation matches.
 */
async function loadEvaluationPairs(matchesPath) {
  const pairSet = new Set();
  if (!fs.existsSync(matchesPath)) {
    console.warn(`[WARN] Evaluation matches file not found at ${matchesPath}. Skipping pair exclusion.`);
    return pairSet;
  }
  const stream = fs.createReadStream(matchesPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = JSON.parse(trimmed);
    const candidateDocId = match.candidate_doc_id || `candidate:cms:${match.resume_id}`;
    const jobDocId = match.job_doc_id || `job:cms:${match.job_id}`;
    pairSet.add(`${candidateDocId}|${jobDocId}`);
  }
  return pairSet;
}

/**
 * Main recruitment generation procedure.
 */
export async function generateRecruitmentDemo(options = {}) {
  const manifestsDir = options.manifestsDir || path.resolve(REPO_ROOT, 'data/processed/manifests');
  const foundationManifestPath = options.foundationManifestPath || path.join(manifestsDir, 'foundation-manifest.json');
  const stagingDir = options.stagingDir || path.resolve(REPO_ROOT, 'data/staging_recruitment');
  const matchesPath = options.matchesPath || path.resolve(REPO_ROOT, 'data/processed/evaluation/matches.jsonl');

  console.log('=== DATA-03.3B: SYNTHETIC RECRUITMENT DEMO GENERATOR ===');
  console.log(`Foundation Manifest: ${foundationManifestPath}`);
  console.log(`Staging Dir:         ${stagingDir}\n`);

  if (!fs.existsSync(foundationManifestPath)) {
    throw new Error(`Active foundation manifest pointer not found: ${foundationManifestPath}`);
  }

  const foundationManifest = JSON.parse(fs.readFileSync(foundationManifestPath, 'utf8'));
  const foundationDir = path.resolve(REPO_ROOT, foundationManifest.immutable_release_dir);

  console.log(`1/6 Loading Foundation Release from: ${foundationDir}...`);
  const [candidates, jobs, users, companies, departments, recruiters, evalPairs] = await Promise.all([
    loadJsonl(path.join(foundationDir, 'candidates.jsonl')),
    loadJsonl(path.join(foundationDir, 'jobs.jsonl')),
    loadJsonl(path.join(foundationDir, 'users.jsonl')),
    loadJsonl(path.join(foundationDir, 'companies.jsonl')),
    loadJsonl(path.join(foundationDir, 'departments.jsonl')),
    loadJsonl(path.join(foundationDir, 'recruiters.jsonl')),
    loadEvaluationPairs(matchesPath),
  ]);

  console.log(`  - Candidates:   ${candidates.length}`);
  console.log(`  - Jobs:         ${jobs.length}`);
  console.log(`  - Users:        ${users.length}`);
  console.log(`  - Companies:    ${companies.length}`);
  console.log(`  - Departments:  ${departments.length}`);
  console.log(`  - Recruiters:   ${recruiters.length}`);
  console.log(`  - Eval Pairs:   ${evalPairs.size}\n`);

  if (jobs.length !== 2500) {
    throw new Error(`Expected exactly 2500 jobs, found ${jobs.length}`);
  }
  if (candidates.length !== 10000) {
    throw new Error(`Expected exactly 10000 candidates, found ${candidates.length}`);
  }

  // 2. Select exactly 200 OPEN Jobs via deterministic stratified ranking
  console.log('2/6 Selecting 200 OPEN Jobs (top 4 jobs per company)...');
  const jobsByCompany = new Map();
  for (const job of jobs) {
    if (!jobsByCompany.has(job.company_id)) {
      jobsByCompany.set(job.company_id, []);
    }
    jobsByCompany.get(job.company_id).push(job);
  }

  if (jobsByCompany.size !== 50) {
    throw new Error(`Expected 50 companies with jobs, found ${jobsByCompany.size}`);
  }

  const openJobIdSet = new Set();
  const sortedCompanyIds = Array.from(jobsByCompany.keys()).sort();

  for (const compId of sortedCompanyIds) {
    const compJobs = jobsByCompany.get(compId);
    if (compJobs.length < 4) {
      throw new Error(`Company ${compId} has only ${compJobs.length} jobs (< 4 minimum required)`);
    }

    // Rank jobs deterministically
    const rankedJobs = compJobs.map((job) => {
      const rank = sha256(`${GENERATOR_SEED}:job_opening:${job._id}`);
      return { job, rank };
    });

    rankedJobs.sort((a, b) => {
      if (a.rank < b.rank) return -1;
      if (a.rank > b.rank) return 1;
      return a.job._id.localeCompare(b.job._id);
    });

    for (let i = 0; i < 4; i++) {
      openJobIdSet.add(rankedJobs[i].job._id);
    }
  }

  if (openJobIdSet.size !== 200) {
    throw new Error(`Failed to select exactly 200 OPEN jobs, got ${openJobIdSet.size}`);
  }

  // Build snapshot jobs (200 OPEN, 2300 DRAFT)
  const finalJobs = jobs.map((job) => {
    if (openJobIdSet.has(job._id)) {
      return {
        ...job,
        status: JOB_STATUSES.OPEN,
        deadline: JOB_DEADLINE,
        updated_at: JOB_OPENING_EFFECTIVE_AT,
        provenance: {
          classification: PROVENANCE_CLASSIFICATIONS.MIXED,
          source_dataset: job.provenance.source_dataset,
          source_file: job.provenance.source_file,
          source_ids: job.provenance.source_ids,
          source_hashes: job.provenance.source_hashes,
          source_version: job.provenance.source_version,
          generator_seed: GENERATOR_SEED,
          generator_version: GENERATOR_VERSION,
          field_origins: {
            ...job.provenance.field_origins,
            status: 'synthetic',
            deadline: 'synthetic',
            updated_at: 'synthetic',
          },
        },
      };
    }
    return job;
  });

  finalJobs.sort((a, b) => a._id.localeCompare(b._id));
  const openJobsList = finalJobs.filter((j) => j.status === JOB_STATUSES.OPEN);
  console.log(`  - Total Jobs: 2500 (OPEN: ${openJobsList.length}, DRAFT: ${finalJobs.length - openJobsList.length})\n`);

  // 3. Allocate 1,200 unique Candidate-Job pairs
  console.log('3/6 Allocating 1,200 unique Candidate–Job pairs...');
  // Sort candidates by _id
  candidates.sort((a, b) => a._id.localeCompare(b._id));

  const applicationPairs = [];
  const selectedPairKeys = new Set();

  for (let i = 0; i < openJobsList.length; i++) {
    const job = openJobsList[i];
    // Pattern: 4 to 8 applications per job (mean 6), summing to 1200 across 200 jobs
    const targetAppsForJob = (i % 5) + 4; // 4, 5, 6, 7, 8 -> mean 6. (40 * 30 = 1200)

    // Score candidates for this job
    const candidatesWithScore = [];
    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      const candidate = candidates[cIdx];
      const pairKey = `${candidate._id}|${job._id}`;
      if (evalPairs.has(pairKey)) continue; // Never use evaluation retrieval pairs

      const score = sha256(`${GENERATOR_SEED}:app_pair:${job._id}:${candidate._id}`);
      candidatesWithScore.push({ candidate, score });
    }

    candidatesWithScore.sort((a, b) => {
      if (a.score < b.score) return -1;
      if (a.score > b.score) return 1;
      return a.candidate._id.localeCompare(b.candidate._id);
    });

    let chosenForThisJob = 0;
    for (const { candidate } of candidatesWithScore) {
      const pairKey = `${candidate._id}|${job._id}`;
      if (selectedPairKeys.has(pairKey)) continue;

      selectedPairKeys.add(pairKey);
      applicationPairs.push({
        candidate,
        job,
        pairKey,
        appId: applicationIdFromPair(candidate._id, job._id),
      });

      chosenForThisJob++;
      if (chosenForThisJob === targetAppsForJob) break;
    }

    if (chosenForThisJob !== targetAppsForJob) {
      throw new Error(`Failed to allocate ${targetAppsForJob} candidates for job ${job._id}`);
    }
  }

  if (applicationPairs.length !== 1200) {
    throw new Error(`Expected exactly 1200 application pairs, got ${applicationPairs.length}`);
  }

  // Sort pairs by appId deterministically
  applicationPairs.sort((a, b) => a.appId.localeCompare(b.appId));
  console.log(`  - Allocated ${applicationPairs.length} unique pairs\n`);

  // 4. Assign stage buckets & generate stage histories and interviews
  console.log('4/6 Assigning stage distributions & generating timelines...');

  /**
   * Stage distribution:
   * 0..299:    APPLIED (300)
   * 300..549:  SCREENING (250)
   * 550..669:  INTERVIEW (120) -> 30 with 0 intv, 80 with 1 intv, 10 with 2 intv (100 intv)
   * 670..729:  OFFER (60) -> 60 with 1 completed intv (60 intv)
   * 730..769:  HIRED (40) -> 10 with 1 intv, 30 with 2 intv (70 intv)
   * 770..869:  REJECTED at APPLIED (100) -> 0 intv
   * 870..999:  REJECTED at SCREENING (130) -> 0 intv
   * 1000..1089:REJECTED after INTERVIEW (90) -> 90 with 1 completed intv (90 intv)
   * 1090..1119:REJECTED after OFFER (30) -> 30 with 1 completed intv (30 intv)
   * 1120..1159:WITHDRAWN at APPLIED (40) -> 0 intv
   * 1160..1199:WITHDRAWN at SCREENING (40) -> 0 intv
   */
  const applications = [];
  const interviews = [];

  for (let idx = 0; idx < applicationPairs.length; idx++) {
    const { candidate, job, appId } = applicationPairs[idx];
    const appKey = appId.replace(/^application:pair:/, '');

    // Deterministic applied_at within window 2026-10-22 to 2026-11-03
    const day = 22 + (idx % 12);
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const hour = 8 + (idx % 10);
    const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
    const minute = (idx * 17) % 60;
    const minStr = minute < 10 ? `0${minute}` : `${minute}`;
    const second = (idx * 31) % 60;
    const secStr = second < 10 ? `0${second}` : `${second}`;

    // Adjust month for day > 31
    let appliedAt;
    if (day > 31) {
      const novDay = day - 31;
      const novDayStr = novDay < 10 ? `0${novDay}` : `${novDay}`;
      appliedAt = `2026-11-${novDayStr}T${hourStr}:${minStr}:${secStr}Z`;
    } else {
      appliedAt = `2026-10-${dayStr}T${hourStr}:${minStr}:${secStr}Z`;
    }

    const appliedTime = new Date(appliedAt).getTime();
    const t0 = appliedAt;
    const t1 = new Date(appliedTime + 1 * 86400000 + 2 * 3600000).toISOString().replace('.000Z', 'Z');
    const t2 = new Date(appliedTime + 3 * 86400000 + 3 * 3600000).toISOString().replace('.000Z', 'Z');

    let currentStage;
    const stageHistory = [];
    let updatedAt = t0;

    // Initial event (always present)
    stageHistory.push({
      from_stage: null,
      to_stage: APPLICATION_STAGES.APPLIED,
      timestamp: t0,
      actor_role: STAGE_ACTOR_ROLES.CANDIDATE,
      actor_id: candidate.user_id,
    });

    if (idx < 300) {
      // 1. APPLIED (300)
      currentStage = APPLICATION_STAGES.APPLIED;
      updatedAt = t0;
    } else if (idx < 550) {
      // 2. SCREENING (250)
      currentStage = APPLICATION_STAGES.SCREENING;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      updatedAt = t1;
    } else if (idx < 670) {
      // 3. INTERVIEW (120)
      currentStage = APPLICATION_STAGES.INTERVIEW;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t2,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      updatedAt = t2;

      // Sub-allocation: 30 with 0 intv (550..579), 80 with 1 intv (580..659), 10 with 2 intv (660..669)
      const subIdx = idx - 550;
      if (subIdx >= 30 && subIdx < 110) {
        // 80 apps: 1 interview (50 completed PASSED, 30 scheduled pending)
        const isCompleted = subIdx < 80;
        const schedTime = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
        const compTime = isCompleted
          ? new Date(new Date(schedTime).getTime() + 3600000).toISOString().replace('.000Z', 'Z')
          : undefined;

        interviews.push({
          _id: interviewIdFromRound(appId, 1),
          type: DOCUMENT_TYPES.INTERVIEW,
          application_id: appId,
          candidate_id: candidate._id,
          job_id: job._id,
          interviewer_id: job.recruiter_id,
          round: 1,
          interview_type: APPROVED_INTERVIEW_TYPES[0], // TECHNICAL
          scheduled_at: schedTime,
          completed_at: compTime,
          score: isCompleted ? 78 : undefined,
          feedback: isCompleted ? 'Candidate demonstrated good technical foundation.' : undefined,
          result: isCompleted ? INTERVIEW_RESULTS.PASSED : undefined,
          created_at: t2,
          updated_at: compTime || t2,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        });
      } else if (subIdx >= 110) {
        // 10 apps: 2 interviews (Round 1 completed PASSED, Round 2 scheduled pending)
        const schedTime1 = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
        const compTime1 = new Date(new Date(schedTime1).getTime() + 3600000).toISOString().replace('.000Z', 'Z');
        const schedTime2 = new Date(new Date(compTime1).getTime() + 2 * 86400000).toISOString().replace('.000Z', 'Z');

        interviews.push({
          _id: interviewIdFromRound(appId, 1),
          type: DOCUMENT_TYPES.INTERVIEW,
          application_id: appId,
          candidate_id: candidate._id,
          job_id: job._id,
          interviewer_id: job.recruiter_id,
          round: 1,
          interview_type: APPROVED_INTERVIEW_TYPES[1], // HR_SCREENING
          scheduled_at: schedTime1,
          completed_at: compTime1,
          score: 82,
          feedback: 'Strong communication and culture fit.',
          result: INTERVIEW_RESULTS.PASSED,
          created_at: t2,
          updated_at: compTime1,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        });

        interviews.push({
          _id: interviewIdFromRound(appId, 2),
          type: DOCUMENT_TYPES.INTERVIEW,
          application_id: appId,
          candidate_id: candidate._id,
          job_id: job._id,
          interviewer_id: job.recruiter_id,
          round: 2,
          interview_type: APPROVED_INTERVIEW_TYPES[2], // SYSTEM_DESIGN
          scheduled_at: schedTime2,
          completed_at: undefined,
          score: undefined,
          feedback: undefined,
          result: undefined,
          created_at: compTime1,
          updated_at: compTime1,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        });
      }
    } else if (idx < 730) {
      // 4. OFFER (60) -> 1 completed interview round
      currentStage = APPLICATION_STAGES.OFFER;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t2,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });

      const schedTime = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
      const compTime = new Date(new Date(schedTime).getTime() + 3600000).toISOString().replace('.000Z', 'Z');
      const offerTime = new Date(new Date(compTime).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');

      const invId = interviewIdFromRound(appId, 1);
      interviews.push({
        _id: invId,
        type: DOCUMENT_TYPES.INTERVIEW,
        application_id: appId,
        candidate_id: candidate._id,
        job_id: job._id,
        interviewer_id: job.recruiter_id,
        round: 1,
        interview_type: APPROVED_INTERVIEW_TYPES[0], // TECHNICAL
        scheduled_at: schedTime,
        completed_at: compTime,
        score: 85,
        feedback: 'Excellent problem solving and code quality.',
        result: INTERVIEW_RESULTS.PASSED,
        created_at: t2,
        updated_at: compTime,
        provenance: {
          classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
          generator_seed: GENERATOR_SEED,
          generator_version: GENERATOR_VERSION,
        },
      });

      stageHistory.push({
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: offerTime,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        evidence: {
          interview_id: invId,
          completed_rounds: 1,
          last_round_result: INTERVIEW_RESULTS.PASSED,
        },
      });
      updatedAt = offerTime;
    } else if (idx < 770) {
      // 5. HIRED (40) -> 10 apps 1 round, 30 apps 2 rounds
      currentStage = APPLICATION_STAGES.HIRED;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t2,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });

      const hiredSubIdx = idx - 730;
      let lastCompTime;
      const invId1 = interviewIdFromRound(appId, 1);

      if (hiredSubIdx < 10) {
        // 1 round completed
        const schedTime = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
        lastCompTime = new Date(new Date(schedTime).getTime() + 3600000).toISOString().replace('.000Z', 'Z');

        interviews.push({
          _id: invId1,
          type: DOCUMENT_TYPES.INTERVIEW,
          application_id: appId,
          candidate_id: candidate._id,
          job_id: job._id,
          interviewer_id: job.recruiter_id,
          round: 1,
          interview_type: APPROVED_INTERVIEW_TYPES[0],
          scheduled_at: schedTime,
          completed_at: lastCompTime,
          score: 90,
          feedback: 'Outstanding interview performance.',
          result: INTERVIEW_RESULTS.PASSED,
          created_at: t2,
          updated_at: lastCompTime,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        });
      } else {
        // 2 rounds completed
        const schedTime1 = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
        const compTime1 = new Date(new Date(schedTime1).getTime() + 3600000).toISOString().replace('.000Z', 'Z');
        const schedTime2 = new Date(new Date(compTime1).getTime() + 2 * 86400000).toISOString().replace('.000Z', 'Z');
        lastCompTime = new Date(new Date(schedTime2).getTime() + 3600000).toISOString().replace('.000Z', 'Z');

        interviews.push({
          _id: invId1,
          type: DOCUMENT_TYPES.INTERVIEW,
          application_id: appId,
          candidate_id: candidate._id,
          job_id: job._id,
          interviewer_id: job.recruiter_id,
          round: 1,
          interview_type: APPROVED_INTERVIEW_TYPES[1], // HR_SCREENING
          scheduled_at: schedTime1,
          completed_at: compTime1,
          score: 88,
          feedback: 'Very articulate and well prepared.',
          result: INTERVIEW_RESULTS.PASSED,
          created_at: t2,
          updated_at: compTime1,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        });

        interviews.push({
          _id: interviewIdFromRound(appId, 2),
          type: DOCUMENT_TYPES.INTERVIEW,
          application_id: appId,
          candidate_id: candidate._id,
          job_id: job._id,
          interviewer_id: job.recruiter_id,
          round: 2,
          interview_type: APPROVED_INTERVIEW_TYPES[5], // FINAL_ROUND
          scheduled_at: schedTime2,
          completed_at: lastCompTime,
          score: 92,
          feedback: 'Superb domain mastery and leadership potential.',
          result: INTERVIEW_RESULTS.PASSED,
          created_at: compTime1,
          updated_at: lastCompTime,
          provenance: {
            classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
            generator_seed: GENERATOR_SEED,
            generator_version: GENERATOR_VERSION,
          },
        });
      }

      const offerTime = new Date(new Date(lastCompTime).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
      stageHistory.push({
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: offerTime,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        evidence: {
          interview_id: invId1,
          completed_rounds: hiredSubIdx < 10 ? 1 : 2,
          last_round_result: INTERVIEW_RESULTS.PASSED,
        },
      });

      const acceptTime = new Date(new Date(offerTime).getTime() + 2 * 86400000).toISOString().replace('.000Z', 'Z');
      const hiredTime = new Date(new Date(acceptTime).getTime() + 2 * 3600000).toISOString().replace('.000Z', 'Z');

      stageHistory.push({
        from_stage: APPLICATION_STAGES.OFFER,
        to_stage: APPLICATION_STAGES.HIRED,
        timestamp: hiredTime,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        evidence: {
          accepted_at: acceptTime,
          method: 'ELECTRONIC_SIGNATURE',
          signed_document_id: `doc:offer_acceptance:${appKey}`,
        },
      });
      updatedAt = hiredTime;
    } else if (idx < 870) {
      // 6. REJECTED at APPLIED (100) -> 0 intv
      currentStage = APPLICATION_STAGES.REJECTED;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.REJECTED,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        reason_code: REJECTION_REASON_CODES[5], // QUALIFICATIONS_MISMATCH
      });
      updatedAt = t1;
    } else if (idx < 1000) {
      // 7. REJECTED at SCREENING (130) -> 0 intv
      currentStage = APPLICATION_STAGES.REJECTED;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.REJECTED,
        timestamp: t2,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        reason_code: REJECTION_REASON_CODES[0], // SCREENING_REJECTED
      });
      updatedAt = t2;
    } else if (idx < 1090) {
      // 8. REJECTED after INTERVIEW (90) -> 90 with 1 completed intv (result: FAILED)
      currentStage = APPLICATION_STAGES.REJECTED;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t2,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });

      const schedTime = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
      const compTime = new Date(new Date(schedTime).getTime() + 3600000).toISOString().replace('.000Z', 'Z');
      const rejTime = new Date(new Date(compTime).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');

      interviews.push({
        _id: interviewIdFromRound(appId, 1),
        type: DOCUMENT_TYPES.INTERVIEW,
        application_id: appId,
        candidate_id: candidate._id,
        job_id: job._id,
        interviewer_id: job.recruiter_id,
        round: 1,
        interview_type: APPROVED_INTERVIEW_TYPES[0], // TECHNICAL
        scheduled_at: schedTime,
        completed_at: compTime,
        score: 55,
        feedback: 'Skills did not meet requirements for senior position.',
        result: INTERVIEW_RESULTS.FAILED,
        created_at: t2,
        updated_at: compTime,
        provenance: {
          classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
          generator_seed: GENERATOR_SEED,
          generator_version: GENERATOR_VERSION,
        },
      });

      stageHistory.push({
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.REJECTED,
        timestamp: rejTime,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        reason_code: REJECTION_REASON_CODES[1], // INTERVIEW_FAILED
      });
      updatedAt = rejTime;
    } else if (idx < 1120) {
      // 9. REJECTED after OFFER (30) -> 30 with 1 completed intv (result: PASSED), then OFFER_DECLINED
      currentStage = APPLICATION_STAGES.REJECTED;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t2,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });

      const schedTime = new Date(new Date(t2).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
      const compTime = new Date(new Date(schedTime).getTime() + 3600000).toISOString().replace('.000Z', 'Z');
      const offerTime = new Date(new Date(compTime).getTime() + 1 * 86400000).toISOString().replace('.000Z', 'Z');
      const rejTime = new Date(new Date(offerTime).getTime() + 3 * 86400000).toISOString().replace('.000Z', 'Z');

      const invId = interviewIdFromRound(appId, 1);
      interviews.push({
        _id: invId,
        type: DOCUMENT_TYPES.INTERVIEW,
        application_id: appId,
        candidate_id: candidate._id,
        job_id: job._id,
        interviewer_id: job.recruiter_id,
        round: 1,
        interview_type: APPROVED_INTERVIEW_TYPES[0],
        scheduled_at: schedTime,
        completed_at: compTime,
        score: 86,
        feedback: 'Strong performance, offer extended.',
        result: INTERVIEW_RESULTS.PASSED,
        created_at: t2,
        updated_at: compTime,
        provenance: {
          classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
          generator_seed: GENERATOR_SEED,
          generator_version: GENERATOR_VERSION,
        },
      });

      stageHistory.push({
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: offerTime,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        evidence: {
          interview_id: invId,
          completed_rounds: 1,
          last_round_result: INTERVIEW_RESULTS.PASSED,
        },
      });

      stageHistory.push({
        from_stage: APPLICATION_STAGES.OFFER,
        to_stage: APPLICATION_STAGES.REJECTED,
        timestamp: rejTime,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
        reason_code: REJECTION_REASON_CODES[2], // OFFER_DECLINED
      });
      updatedAt = rejTime;
    } else if (idx < 1160) {
      // 10. WITHDRAWN at APPLIED (40)
      currentStage = APPLICATION_STAGES.WITHDRAWN;
      const withdrawTime = new Date(appliedTime + 12 * 3600000).toISOString().replace('.000Z', 'Z');
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.WITHDRAWN,
        timestamp: withdrawTime,
        actor_role: STAGE_ACTOR_ROLES.CANDIDATE,
        actor_id: candidate.user_id,
      });
      updatedAt = withdrawTime;
    } else {
      // 11. WITHDRAWN at SCREENING (40)
      currentStage = APPLICATION_STAGES.WITHDRAWN;
      stageHistory.push({
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t1,
        actor_role: STAGE_ACTOR_ROLES.RECRUITER,
        actor_id: job.recruiter_id,
      });
      const withdrawTime = new Date(new Date(t1).getTime() + 12 * 3600000).toISOString().replace('.000Z', 'Z');
      stageHistory.push({
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.WITHDRAWN,
        timestamp: withdrawTime,
        actor_role: STAGE_ACTOR_ROLES.CANDIDATE,
        actor_id: candidate.user_id,
      });
      updatedAt = withdrawTime;
    }

    applications.push({
      _id: appId,
      type: DOCUMENT_TYPES.APPLICATION,
      candidate_id: candidate._id,
      job_id: job._id,
      current_stage: currentStage,
      stage_history: stageHistory,
      applied_at: appliedAt,
      updated_at: updatedAt,
      provenance: {
        classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
        generator_seed: GENERATOR_SEED,
        generator_version: GENERATOR_VERSION,
      },
    });
  }

  // Sort applications and interviews by _id
  applications.sort((a, b) => a._id.localeCompare(b._id));
  interviews.sort((a, b) => a._id.localeCompare(b._id));

  console.log(`  - Applications generated: ${applications.length}`);
  console.log(`  - Interviews generated:   ${interviews.length}\n`);

  if (applications.length !== 1200) {
    throw new Error(`Expected exactly 1200 applications, got ${applications.length}`);
  }
  if (interviews.length !== 350) {
    throw new Error(`Expected exactly 350 interviews, got ${interviews.length}`);
  }

  // 5. Emit files to staging directory
  console.log('5/6 Writing 8 JSONL files to staging directory...');
  fs.mkdirSync(stagingDir, { recursive: true });

  const writeJsonl = (fileName, records) => {
    const filePath = path.join(stagingDir, fileName);
    const content = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  - Emitted ${fileName}: ${records.length} records`);
  };

  writeJsonl('candidates.jsonl', candidates);
  writeJsonl('jobs.jsonl', finalJobs);
  writeJsonl('users.jsonl', users);
  writeJsonl('companies.jsonl', companies);
  writeJsonl('departments.jsonl', departments);
  writeJsonl('recruiters.jsonl', recruiters);
  writeJsonl('applications.jsonl', applications);
  writeJsonl('interviews.jsonl', interviews);

  const grandTotal =
    candidates.length +
    finalJobs.length +
    users.length +
    companies.length +
    departments.length +
    recruiters.length +
    applications.length +
    interviews.length;

  console.log(`\n6/6 Staging complete! Total snapshot documents: ${grandTotal}`);

  return {
    success: true,
    stagingDir,
    grandTotal,
    counts: {
      candidates: candidates.length,
      jobs: finalJobs.length,
      openJobs: openJobsList.length,
      draftJobs: finalJobs.length - openJobsList.length,
      users: users.length,
      companies: companies.length,
      departments: departments.length,
      recruiters: recruiters.length,
      applications: applications.length,
      interviews: interviews.length,
    },
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--staging-dir' && args[i + 1]) {
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
  generateRecruitmentDemo(options).catch((err) => {
    console.error('\n[FATAL GENERATOR ERROR]:', err);
    process.exit(1);
  });
}
