/**
 * Unit tests for DATA-03.3B: Synthetic Recruitment Demo Generator & Release Publication
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  APPLICATION_STAGES,
  DOCUMENT_TYPES,
  JOB_STATUSES,
  USER_ROLES,
  PROVENANCE_CLASSIFICATIONS,
} from '../../src/constants/document.constants.js';
import {
  SCENARIO_BASE_CLOCK,
  JOB_OPENING_EFFECTIVE_AT,
  JOB_DEADLINE,
  SCENARIO_SNAPSHOT_CUTOFF,
} from '../../../scripts/dataset/generate-recruitment-demo.js';
import {
  runRecruitmentValidationAndPublication,
  atomicWriteFile,
} from '../../../scripts/dataset/validate-recruitment-demo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');

/**
 * Helper to stream-read JSONL records into memory
 */
async function readJsonlRecords(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const records = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    records.push(JSON.parse(trimmed));
  }
  return records;
}

test('DATA-03.3B: Recruitment Acceptance & Verification Tests', async (t) => {
  const recruitmentManifestPath = path.resolve(REPO_ROOT, 'data/processed/manifests/recruitment-manifest.json');
  const foundationManifestPath = path.resolve(REPO_ROOT, 'data/processed/manifests/foundation-manifest.json');

  assert.equal(fs.existsSync(recruitmentManifestPath), true, 'recruitment-manifest.json must exist');
  assert.equal(fs.existsSync(foundationManifestPath), true, 'foundation-manifest.json must exist');

  const recruitmentManifest = JSON.parse(fs.readFileSync(recruitmentManifestPath, 'utf8'));
  const foundationManifest = JSON.parse(fs.readFileSync(foundationManifestPath, 'utf8'));
  const releaseDir = path.resolve(REPO_ROOT, recruitmentManifest.immutable_release_dir);

  const [candidates, jobs, users, companies, departments, recruiters, applications, interviews] = await Promise.all([
    readJsonlRecords(path.join(releaseDir, 'candidates.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'jobs.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'users.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'companies.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'departments.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'recruiters.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'applications.jsonl')),
    readJsonlRecords(path.join(releaseDir, 'interviews.jsonl')),
  ]);

  const jobsById = new Map(jobs.map((j) => [j._id, j]));
  const appsById = new Map(applications.map((a) => [a._id, a]));
  const interviewsByAppId = new Map();
  for (const inv of interviews) {
    if (!interviewsByAppId.has(inv.application_id)) {
      interviewsByAppId.set(inv.application_id, []);
    }
    interviewsByAppId.get(inv.application_id).push(inv);
  }

  await t.test('1 & 2. Record counts match contract: 24,550 total documents across 8 types', () => {
    assert.equal(candidates.length, 10000);
    assert.equal(jobs.length, 2500);
    assert.equal(users.length, 10150);
    assert.equal(companies.length, 50);
    assert.equal(departments.length, 150);
    assert.equal(recruiters.length, 150);
    assert.equal(applications.length, 1200);
    assert.equal(interviews.length, 350);

    const grandTotal =
      candidates.length +
      jobs.length +
      users.length +
      companies.length +
      departments.length +
      recruiters.length +
      applications.length +
      interviews.length;
    assert.equal(grandTotal, 24550);
  });

  await t.test('3. Exactly 200 OPEN Jobs and 2,300 DRAFT Jobs', () => {
    const openJobs = jobs.filter((j) => j.status === JOB_STATUSES.OPEN);
    const draftJobs = jobs.filter((j) => j.status === JOB_STATUSES.DRAFT);
    assert.equal(openJobs.length, 200);
    assert.equal(draftJobs.length, 2300);

    for (const job of openJobs) {
      assert.equal(job.deadline, JOB_DEADLINE);
      assert.equal(job.provenance.classification, PROVENANCE_CLASSIFICATIONS.MIXED);
      assert.equal(job.provenance.field_origins.status, 'synthetic');
      assert.equal(job.provenance.field_origins.deadline, 'synthetic');
      assert.equal(job.published_at, undefined, 'Must not contain unapproved published_at field');
    }
  });

  await t.test('4. Correct stage distribution across all 7 Application stages', () => {
    const stageCounts = {
      [APPLICATION_STAGES.APPLIED]: 0,
      [APPLICATION_STAGES.SCREENING]: 0,
      [APPLICATION_STAGES.INTERVIEW]: 0,
      [APPLICATION_STAGES.OFFER]: 0,
      [APPLICATION_STAGES.HIRED]: 0,
      [APPLICATION_STAGES.REJECTED]: 0,
      [APPLICATION_STAGES.WITHDRAWN]: 0,
    };

    for (const app of applications) {
      stageCounts[app.current_stage]++;
    }

    assert.equal(stageCounts[APPLICATION_STAGES.APPLIED], 300);
    assert.equal(stageCounts[APPLICATION_STAGES.SCREENING], 250);
    assert.equal(stageCounts[APPLICATION_STAGES.INTERVIEW], 120);
    assert.equal(stageCounts[APPLICATION_STAGES.OFFER], 60);
    assert.equal(stageCounts[APPLICATION_STAGES.HIRED], 40);
    assert.equal(stageCounts[APPLICATION_STAGES.REJECTED], 350);
    assert.equal(stageCounts[APPLICATION_STAGES.WITHDRAWN], 80);
  });

  await t.test('5. INTERVIEW bucket adheres to Rule A mandatory fix: 30 / 80 / 10', () => {
    let with0 = 0, with1 = 0, with2 = 0;
    for (const app of applications) {
      if (app.current_stage === APPLICATION_STAGES.INTERVIEW) {
        const cnt = (interviewsByAppId.get(app._id) || []).length;
        if (cnt === 0) with0++;
        else if (cnt === 1) with1++;
        else if (cnt === 2) with2++;
      }
    }

    assert.equal(with0, 30, 'Expected 30 applications with 0 interviews');
    assert.equal(with1, 80, 'Expected 80 applications with 1 interview');
    assert.equal(with2, 10, 'Expected 10 applications with 2 interviews');
    assert.equal(with0 + with1 + with2, 120);
  });

  await t.test('6. Zero duplicate Candidate–Job pairs across all 1,200 applications', () => {
    const pairSet = new Set();
    for (const app of applications) {
      const pairKey = `${app.candidate_id}|${app.job_id}`;
      assert.equal(pairSet.has(pairKey), false, `Duplicate pair: ${pairKey}`);
      pairSet.add(pairKey);
    }
    assert.equal(pairSet.size, 1200);
  });

  await t.test('7. Zero Applications submitted to DRAFT/CLOSED Jobs; only 200 OPEN Jobs receive applications', () => {
    const jobAppCounts = new Map();
    for (const app of applications) {
      const job = jobsById.get(app.job_id);
      assert.ok(job, `Job ${app.job_id} must exist`);
      assert.equal(job.status, JOB_STATUSES.OPEN, `Application ${app._id} points to non-OPEN job`);
      jobAppCounts.set(app.job_id, (jobAppCounts.get(app.job_id) || 0) + 1);
    }
    assert.equal(jobAppCounts.size, 200, 'Applications must be spread across all 200 OPEN jobs');
  });

  await t.test('8. Application submission timing: job_opening_effective_at <= applied_at <= job.deadline', () => {
    const openTime = new Date(JOB_OPENING_EFFECTIVE_AT).getTime();
    const deadlineTime = new Date(JOB_DEADLINE).getTime();

    for (const app of applications) {
      const appliedTime = new Date(app.applied_at).getTime();
      assert.ok(appliedTime >= openTime, `applied_at ${app.applied_at} earlier than job opening`);
      assert.ok(appliedTime <= deadlineTime, `applied_at ${app.applied_at} past job deadline`);
    }
  });

  await t.test('9 & 10. Valid 12 transitions & actor permissions throughout all stage histories', () => {
    for (const app of applications) {
      assert.ok(app.stage_history.length >= 1);
      const initial = app.stage_history[0];
      assert.equal(initial.from_stage, null);
      assert.equal(initial.to_stage, APPLICATION_STAGES.APPLIED);
      assert.equal(initial.timestamp, app.applied_at);
      assert.equal(initial.actor_role, 'CANDIDATE');

      let prevTime = new Date(initial.timestamp).getTime();
      for (let i = 1; i < app.stage_history.length; i++) {
        const prev = app.stage_history[i - 1];
        const cur = app.stage_history[i];
        assert.equal(cur.from_stage, prev.to_stage, 'Broken stage chain');
        const curTime = new Date(cur.timestamp).getTime();
        assert.ok(curTime > prevTime, 'Stage history timestamps must be strictly monotonic');
        prevTime = curTime;

        if (cur.to_stage === APPLICATION_STAGES.REJECTED) {
          assert.ok(cur.reason_code, 'Rejection must have reason_code');
        }
        if (cur.to_stage === APPLICATION_STAGES.WITHDRAWN) {
          assert.equal(cur.actor_role, 'CANDIDATE', 'Withdrawal must be performed by CANDIDATE');
          assert.notEqual(cur.from_stage, APPLICATION_STAGES.OFFER, 'Withdrawal prohibited in OFFER stage');
        }
      }

      const last = app.stage_history[app.stage_history.length - 1];
      assert.equal(last.to_stage, app.current_stage);
      assert.ok(new Date(app.updated_at).getTime() >= new Date(last.timestamp).getTime());
    }
  });

  await t.test('11 & 12. Exactly 130 applications traversed OFFER and 100% have completed interview evidence', () => {
    let traversedOffer = 0;
    for (const app of applications) {
      const offerEvent = app.stage_history.find((e) => e.to_stage === APPLICATION_STAGES.OFFER);
      if (offerEvent) {
        traversedOffer++;
        assert.ok(offerEvent.evidence, 'OFFER transition must have evidence');
        assert.ok(offerEvent.evidence.interview_id, 'OFFER transition must have interview_id');

        const appInterviews = interviewsByAppId.get(app._id) || [];
        assert.ok(appInterviews.length >= 1, `Application ${app._id} has 0 interviews`);

        const offerTime = new Date(offerEvent.timestamp).getTime();
        for (const inv of appInterviews) {
          assert.ok(inv.completed_at, `Interview ${inv._id} is pending at time of OFFER`);
          const compTime = new Date(inv.completed_at).getTime();
          assert.ok(compTime < offerTime, `Interview ${inv._id} completed after OFFER transition`);
        }
      }
    }
    assert.equal(traversedOffer, 130, 'Expected exactly 130 applications to traverse OFFER (60 OFFER + 40 HIRED + 30 REJECTED)');
  });

  await t.test('13. 100% of HIRED applications have valid offer acceptance evidence', () => {
    const hiredApps = applications.filter((a) => a.current_stage === APPLICATION_STAGES.HIRED);
    assert.equal(hiredApps.length, 40);

    for (const app of hiredApps) {
      const offerEvent = app.stage_history.find((e) => e.to_stage === APPLICATION_STAGES.OFFER);
      const hiredEvent = app.stage_history.find((e) => e.to_stage === APPLICATION_STAGES.HIRED);

      assert.ok(offerEvent && hiredEvent);
      assert.ok(hiredEvent.evidence && hiredEvent.evidence.accepted_at);
      assert.equal(hiredEvent.evidence.method, 'ELECTRONIC_SIGNATURE');

      const offerTime = new Date(offerEvent.timestamp).getTime();
      const acceptTime = new Date(hiredEvent.evidence.accepted_at).getTime();
      const hiredTime = new Date(hiredEvent.timestamp).getTime();

      assert.ok(acceptTime >= offerTime && acceptTime <= hiredTime, 'Accepted time must be between OFFER and HIRED');
    }
  });

  await t.test('14. Historical interview rounds sequential starting at 1 with matching references', () => {
    for (const [appId, appInvs] of interviewsByAppId.entries()) {
      const app = appsById.get(appId);
      assert.ok(app);
      appInvs.sort((a, b) => a.round - b.round);
      appInvs.forEach((inv, idx) => {
        assert.equal(inv.round, idx + 1);
        assert.equal(inv._id, `interview:${appId.replace(/^application:pair:/, '')}:${inv.round}`);
        assert.equal(inv.candidate_id, app.candidate_id);
        assert.equal(inv.job_id, app.job_id);
      });
    }
  });

  await t.test('15. Zero orphan references among all 8 document types', () => {
    const candSet = new Set(candidates.map((c) => c._id));
    const jobSet = new Set(jobs.map((j) => j._id));
    const recSet = new Set(recruiters.map((r) => r._id));

    for (const app of applications) {
      assert.ok(candSet.has(app.candidate_id));
      assert.ok(jobSet.has(app.job_id));
    }
    for (const inv of interviews) {
      assert.ok(appsById.has(inv.application_id));
      assert.ok(candSet.has(inv.candidate_id));
      assert.ok(jobSet.has(inv.job_id));
      assert.ok(recSet.has(inv.interviewer_id));
    }
  });

  await t.test('16. Source facts preserved: Candidate facts identical to DATA-03.2 release', () => {
    const fCandFile = path.join(path.resolve(REPO_ROOT, foundationManifest.immutable_release_dir), 'candidates.jsonl');
    const fCandSha = recruitmentManifest.output_files['candidates.jsonl'].sha256;
    const foundationCandSha = foundationManifest.output_files['candidates.jsonl'].sha256;
    assert.equal(fCandSha, foundationCandSha, 'Candidate checksum must match DATA-03.2 foundation checksum');
  });

  await t.test('17. Evaluation pairs (75,000 matches) are NOT reused as Applications', async () => {
    const matchesPath = path.resolve(REPO_ROOT, 'data/processed/evaluation/matches.jsonl');
    if (!fs.existsSync(matchesPath)) return;
    const evalPairs = new Set();
    const stream = fs.createReadStream(matchesPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = JSON.parse(trimmed);
      const cDoc = match.candidate_doc_id || `candidate:cms:${match.resume_id}`;
      const jDoc = match.job_doc_id || `job:cms:${match.job_id}`;
      evalPairs.add(`${cDoc}|${jDoc}`);
    }

    for (const app of applications) {
      const pairKey = `${app.candidate_id}|${app.job_id}`;
      assert.equal(evalPairs.has(pairKey), false, `Evaluation match pair reused as Application: ${pairKey}`);
    }
  });

  await t.test('18. All events within scenario snapshot cutoff (2026-11-20T23:59:59Z)', () => {
    const cutoff = new Date(SCENARIO_SNAPSHOT_CUTOFF).getTime();
    for (const app of applications) {
      assert.ok(new Date(app.applied_at).getTime() <= cutoff);
      assert.ok(new Date(app.updated_at).getTime() <= cutoff);
      for (const ev of app.stage_history) {
        assert.ok(new Date(ev.timestamp).getTime() <= cutoff);
      }
    }
    for (const inv of interviews) {
      assert.ok(new Date(inv.scheduled_at).getTime() <= cutoff);
      if (inv.completed_at) {
        assert.ok(new Date(inv.completed_at).getTime() <= cutoff);
      }
    }
  });

  await t.test('19. Identical rerun returns UNCHANGED without mutating release directory', async () => {
    const result = await runRecruitmentValidationAndPublication({
      manifestsDir: path.resolve(REPO_ROOT, 'data/processed/manifests'),
      releasesDir: path.resolve(REPO_ROOT, 'data/processed/releases'),
      stagingDir: releaseDir, // Validate the release dir itself
    });
    assert.equal(result.status, 'UNCHANGED');
  });

  await t.test('20. DATA-03.2 Foundation release and pointer remain completely untouched', () => {
    assert.equal(fs.existsSync(foundationManifestPath), true);
    const postManifest = JSON.parse(fs.readFileSync(foundationManifestPath, 'utf8'));
    assert.equal(postManifest.release_id, foundationManifest.release_id);
    assert.equal(postManifest.release_digest, foundationManifest.release_digest);
  });
});
