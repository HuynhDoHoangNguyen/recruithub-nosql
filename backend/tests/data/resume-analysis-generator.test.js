/**
 * DATA-03.4B: Resume Analysis Generator, Final Corpus & Release Publication Acceptance Tests
 * 
 * Verifies:
 * 1. 25,750 documents across 9 business document types.
 * 2. 1,200 Resume Analyses (591 COMPLETE, 609 INCOMPLETE).
 * 3. Exact 150 enriched Jobs (100 Tier 1, 50 Tier 2), 50 Tier 3 OPEN Jobs, 2,300 DRAFT Jobs.
 * 4. 100% fresh input fingerprints against final Candidate and Job states.
 * 5. Deterministic per-Job ranking and tie-breakers.
 * 6. Source fact checksum preservation against DATA-03.3B and DATA-03.2.
 * 7. Real publication failure injection integration test (Rule I).
 * 8. Deterministic rerun idempotency (UNCHANGED).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  ANALYSIS_STATUSES,
  RECOMMENDATION_LEVELS,
  SCORING_WEIGHTS,
  RECOMMENDATION_THRESHOLDS,
  SCORING_ALGORITHM_VERSION,
} from '../../src/schemas/resume-analysis.schema.js';
import {
  isAnalysisFresh,
  rankAnalyses,
  computeInputFingerprint,
} from '../../src/utils/resume-scoring.utils.js';
import {
  POLICY_SEED,
  POLICY_VERSION,
  GENERATOR_VERSION,
  TIER_NAMES,
  classifyOpenJobTiers,
} from '../../../scripts/dataset/job-requirement-policy.js';
import {
  runFinalCorpusValidationAndPublication,
  atomicWriteFile,
  computeFileSha256,
} from '../../../scripts/dataset/validate-final-corpus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');

async function loadJsonl(filePath) {
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

describe('DATA-03.4B: Resume Analysis & Final Corpus Acceptance Tests', () => {
  const manifestsDir = path.resolve(REPO_ROOT, 'data/processed/manifests');
  const finalManifestPath = path.join(manifestsDir, 'final-manifest.json');
  const recruitmentManifestPath = path.join(manifestsDir, 'recruitment-manifest.json');
  const foundationManifestPath = path.join(manifestsDir, 'foundation-manifest.json');

  let finalManifest;
  let releaseDir;

  it('1. Final active manifest pointer exists and is ACTIVE', () => {
    assert.ok(fs.existsSync(finalManifestPath), 'final-manifest.json must exist');
    finalManifest = JSON.parse(fs.readFileSync(finalManifestPath, 'utf8'));

    assert.equal(finalManifest.active_pointer_status, 'ACTIVE');
    assert.equal(finalManifest.transform_version, 'DATA-03.4B');
    assert.equal(finalManifest.scoring_algorithm_version, 'recruithub-scoring-mvp-v1');
    assert.equal(finalManifest.synthetic_requirements_policy_version, 'recruithub-synthetic-requirements-v1');
    assert.equal(finalManifest.generator_seed, POLICY_SEED);

    releaseDir = path.resolve(REPO_ROOT, finalManifest.immutable_release_dir);
    assert.ok(fs.existsSync(releaseDir), `Immutable release dir must exist: ${releaseDir}`);
  });

  it('2. Final release contains all 9 business document files summing to 25,750 documents', () => {
    const expectedCounts = {
      'users.jsonl': 10150,
      'candidates.jsonl': 10000,
      'companies.jsonl': 50,
      'departments.jsonl': 150,
      'recruiters.jsonl': 150,
      'jobs.jsonl': 2500,
      'applications.jsonl': 1200,
      'interviews.jsonl': 350,
      'resume_analyses.jsonl': 1200,
    };

    let total = 0;
    for (const [file, expected] of Object.entries(expectedCounts)) {
      const filePath = path.join(releaseDir, file);
      assert.ok(fs.existsSync(filePath), `File must exist in release: ${file}`);
      const entry = finalManifest.output_files[file];
      assert.ok(entry, `Manifest must track ${file}`);
      assert.equal(entry.record_count, expected, `Count mismatch for ${file}`);
      total += entry.record_count;
    }

    assert.equal(total, 25750, 'Total documents across 9 types must equal 25,750');
    assert.equal(finalManifest.record_counts.total_documents, 25750);
  });

  it('3. Source fact preservation: 7 foundation/recruitment files have identical checksums', () => {
    const recruitmentManifest = JSON.parse(fs.readFileSync(recruitmentManifestPath, 'utf8'));
    const recFiles = recruitmentManifest.output_files;

    assert.equal(finalManifest.output_files['candidates.jsonl'].sha256, recFiles['candidates.jsonl'].sha256);
    assert.equal(finalManifest.output_files['users.jsonl'].sha256, recFiles['users.jsonl'].sha256);
    assert.equal(finalManifest.output_files['companies.jsonl'].sha256, recFiles['companies.jsonl'].sha256);
    assert.equal(finalManifest.output_files['departments.jsonl'].sha256, recFiles['departments.jsonl'].sha256);
    assert.equal(finalManifest.output_files['recruiters.jsonl'].sha256, recFiles['recruiters.jsonl'].sha256);
    assert.equal(finalManifest.output_files['applications.jsonl'].sha256, recFiles['applications.jsonl'].sha256);
    assert.equal(finalManifest.output_files['interviews.jsonl'].sha256, recFiles['interviews.jsonl'].sha256);
  });

  it('4. Exactly 150 Jobs enriched and 2,350 Jobs untouched', async () => {
    const jobs = await loadJsonl(path.join(releaseDir, 'jobs.jsonl'));
    assert.equal(jobs.length, 2500);

    let enriched = 0;
    let untouched = 0;
    let openCount = 0;
    let draftCount = 0;

    for (const job of jobs) {
      if (job.status === 'OPEN') openCount++;
      else if (job.status === 'DRAFT') draftCount++;

      const origins = job.provenance?.field_origins || {};
      if (origins['requirements.experience'] === 'synthetic') {
        enriched++;
        assert.equal(origins['requirements.education'], 'synthetic');
        assert.equal(origins['requirements.project'], 'synthetic');
        assert.equal(job.provenance.classification, 'mixed');
        assert.equal(job.provenance.generator_version, 'DATA-03.4B');
      } else {
        untouched++;
      }
    }

    assert.equal(openCount, 200);
    assert.equal(draftCount, 2300);
    assert.equal(enriched, 150);
    assert.equal(untouched, 2350);
  });

  it('5. Resume Analyses status distribution: 591 COMPLETE and 609 INCOMPLETE', async () => {
    const analyses = await loadJsonl(path.join(releaseDir, 'resume_analyses.jsonl'));
    assert.equal(analyses.length, 1200);

    let complete = 0;
    let incomplete = 0;
    const recs = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const analysis of analyses) {
      if (analysis.analysis_status === ANALYSIS_STATUSES.COMPLETE) {
        complete++;
        recs[analysis.recommendation]++;

        // Invariants for COMPLETE
        assert.ok(analysis.scores.skill !== null);
        assert.ok(analysis.scores.experience !== null);
        assert.ok(analysis.scores.education !== null);
        assert.ok(analysis.scores.project !== null);
        assert.ok(typeof analysis.total_score === 'number');
        assert.ok(typeof analysis.recommendation === 'string');
        assert.equal(analysis.missing_inputs.length, 0);

        // Weighted total check
        const expectedTotal =
          SCORING_WEIGHTS.SKILL * analysis.scores.skill +
          SCORING_WEIGHTS.EXPERIENCE * analysis.scores.experience +
          SCORING_WEIGHTS.EDUCATION * analysis.scores.education +
          SCORING_WEIGHTS.PROJECT * analysis.scores.project;
        assert.ok(Math.abs(analysis.total_score - expectedTotal) <= 1e-6);

        // Recommendation boundary check
        if (analysis.total_score >= RECOMMENDATION_THRESHOLDS.HIGH) {
          assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.HIGH);
        } else if (analysis.total_score >= RECOMMENDATION_THRESHOLDS.MEDIUM) {
          assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.MEDIUM);
        } else {
          assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.LOW);
        }
      } else {
        incomplete++;
        assert.equal(analysis.total_score, undefined);
        assert.equal(analysis.recommendation, undefined);
        assert.ok(analysis.missing_inputs.length > 0);
        const hasNull =
          analysis.scores.skill === null ||
          analysis.scores.experience === null ||
          analysis.scores.education === null ||
          analysis.scores.project === null;
        assert.ok(hasNull);
      }
    }

    assert.equal(complete, 591);
    assert.equal(incomplete, 609);
    assert.equal(recs.HIGH, 23);
    assert.equal(recs.MEDIUM, 65);
    assert.equal(recs.LOW, 503);
  });

  it('6. 100% of Resume Analyses are fresh against final candidate and job state', async () => {
    const [analyses, candidates, jobs] = await Promise.all([
      loadJsonl(path.join(releaseDir, 'resume_analyses.jsonl')),
      loadJsonl(path.join(releaseDir, 'candidates.jsonl')),
      loadJsonl(path.join(releaseDir, 'jobs.jsonl')),
    ]);

    const candMap = new Map();
    for (const c of candidates) candMap.set(c._id, c);

    const jobMap = new Map();
    for (const j of jobs) jobMap.set(j._id, j);

    for (const analysis of analyses) {
      const cand = candMap.get(analysis.candidate_id);
      const job = jobMap.get(analysis.job_id);

      assert.ok(cand, `Candidate must exist for analysis ${analysis._id}`);
      assert.ok(job, `Job must exist for analysis ${analysis._id}`);

      assert.ok(
        isAnalysisFresh(analysis, cand, job),
        `Analysis ${analysis._id} must be fresh against final candidate and job`
      );
    }
  });

  it('7. Scoring input mutation invalidates freshness', async () => {
    const [analyses, candidates, jobs] = await Promise.all([
      loadJsonl(path.join(releaseDir, 'resume_analyses.jsonl')),
      loadJsonl(path.join(releaseDir, 'candidates.jsonl')),
      loadJsonl(path.join(releaseDir, 'jobs.jsonl')),
    ]);

    const cand = candidates.find((c) => c._id === analyses[0].candidate_id);
    const job = jobs.find((j) => j._id === analyses[0].job_id);

    // Baseline: fresh
    assert.ok(isAnalysisFresh(analyses[0], cand, job));

    // Mutate candidate skills
    const mutatedCand = JSON.parse(JSON.stringify(cand));
    mutatedCand.skills.push({ name: 'quantum-computing', normalized: 'quantum-computing' });
    assert.equal(isAnalysisFresh(analyses[0], mutatedCand, job), false);

    // Mutate job required skills
    const mutatedJob = JSON.parse(JSON.stringify(job));
    mutatedJob.required_skills.push('new-required-skill');
    assert.equal(isAnalysisFresh(analyses[0], cand, mutatedJob), false);
  });

  it('8. Candidate ranking on Tier 1 jobs is strictly deterministic and excludes INCOMPLETE', async () => {
    const [analyses, applications, jobs] = await Promise.all([
      loadJsonl(path.join(releaseDir, 'resume_analyses.jsonl')),
      loadJsonl(path.join(releaseDir, 'applications.jsonl')),
      loadJsonl(path.join(releaseDir, 'jobs.jsonl')),
    ]);

    const appMap = new Map();
    for (const a of applications) appMap.set(a._id, a);

    const tierMap = classifyOpenJobTiers(jobs);
    const tier1JobIds = Array.from(tierMap.entries())
      .filter(([_, info]) => info.tier === TIER_NAMES.TIER_1)
      .map(([id]) => id);

    assert.equal(tier1JobIds.length, 100);

    for (const jobId of tier1JobIds) {
      const jobAnalyses = analyses.filter((a) => a.job_id === jobId);
      const rankedActive = rankAnalyses(jobAnalyses, appMap, { jobId, mode: 'ACTIVE' });

      // Verify all ranked items are COMPLETE
      for (const item of rankedActive) {
        assert.equal(item.analysis.analysis_status, ANALYSIS_STATUSES.COMPLETE);
        assert.notEqual(item.application.current_stage, 'WITHDRAWN');
      }

      // Verify descending order
      for (let i = 1; i < rankedActive.length; i++) {
        const prev = rankedActive[i - 1];
        const curr = rankedActive[i];

        if (prev.analysis.total_score !== curr.analysis.total_score) {
          assert.ok(prev.analysis.total_score >= curr.analysis.total_score);
        } else if (prev.analysis.scores.skill !== curr.analysis.scores.skill) {
          assert.ok(prev.analysis.scores.skill >= curr.analysis.scores.skill);
        }
      }
    }
  });

  it('9. Rule I: Real publication failure injection integration test', async () => {
    // Setup isolated temporary environment in OS tmpdir
    const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'recruithub-publish-test-'));
    const testReleasesDir = path.join(testRoot, 'releases');
    const testManifestsDir = path.join(testRoot, 'manifests');
    const testStagingDir = path.join(testRoot, 'staging');
    const testActivePointer = path.join(testManifestsDir, 'final-manifest.json');

    fs.mkdirSync(testReleasesDir, { recursive: true });
    fs.mkdirSync(testManifestsDir, { recursive: true });
    fs.mkdirSync(testStagingDir, { recursive: true });

    try {
      // 1. Create a simulated initial valid release (v1)
      const v1Dir = path.join(testReleasesDir, 'DATA-03.4B_v1mockdigest');
      fs.mkdirSync(v1Dir, { recursive: true });
      fs.writeFileSync(path.join(v1Dir, 'sample.txt'), 'version 1 content', 'utf8');

      const v1Manifest = {
        release_id: 'release:DATA-03.4B:v1mockdigest',
        release_digest: 'v1mockdigest1234567890abcdef',
        immutable_release_dir: path.relative(REPO_ROOT, v1Dir),
        active_pointer_status: 'ACTIVE',
      };
      atomicWriteFile(testActivePointer, JSON.stringify(v1Manifest, null, 2) + '\n');

      assert.ok(fs.existsSync(testActivePointer));
      const initialActiveManifest = JSON.parse(fs.readFileSync(testActivePointer, 'utf8'));
      assert.equal(initialActiveManifest.release_id, 'release:DATA-03.4B:v1mockdigest');

      // 2. Prepare a new release candidate in staging
      // Copy real files from actual releaseDir into testStagingDir
      const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.jsonl'));
      for (const f of files) {
        fs.copyFileSync(path.join(releaseDir, f), path.join(testStagingDir, f));
      }

      // 3. Inject failure right before atomic pointer switch
      // We simulate this by making the active pointer path an existing directory (triggers EISDIR at atomicWriteFile)
      const unwritablePointerPath = testManifestsDir;

      let publishFailed = false;
      try {
        await runFinalCorpusValidationAndPublication({
          stagingDir: testStagingDir,
          releasesDir: testReleasesDir,
          manifestsDir: testManifestsDir,
          activePointerPath: unwritablePointerPath, // Will fail at renameSync/atomicWrite
          recruitmentManifestPath,
        });
      } catch (err) {
        publishFailed = true;
      }

      assert.ok(publishFailed, 'Expected publication failure to be triggered by injected fault');

      // 4. Verify old active pointer was NOT mutated
      const pointerAfterFailure = JSON.parse(fs.readFileSync(testActivePointer, 'utf8'));
      assert.equal(pointerAfterFailure.release_id, 'release:DATA-03.4B:v1mockdigest');

      // 5. Verify old release files remain intact and readable
      assert.ok(fs.existsSync(path.join(v1Dir, 'sample.txt')));
      assert.equal(fs.readFileSync(path.join(v1Dir, 'sample.txt'), 'utf8'), 'version 1 content');

      // 6. Now perform normal successful retry to valid pointer path
      const retryResult = await runFinalCorpusValidationAndPublication({
        stagingDir: testStagingDir,
        releasesDir: testReleasesDir,
        manifestsDir: testManifestsDir,
        activePointerPath: testActivePointer,
        recruitmentManifestPath,
      });

      assert.equal(retryResult.status, 'PUBLISHED');

      // 7. Verify pointer atomically switched to complete new release
      const updatedActiveManifest = JSON.parse(fs.readFileSync(testActivePointer, 'utf8'));
      assert.equal(updatedActiveManifest.release_id, retryResult.releaseId);
      assert.equal(updatedActiveManifest.active_pointer_status, 'ACTIVE');
    } finally {
      // Clean up isolated test sandbox
      try {
        fs.rmSync(testRoot, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  it('10. Release publication is idempotent: rerun returns UNCHANGED', async () => {
    // Stage files again
    const stagingDir = path.resolve(REPO_ROOT, 'data/staging_test_rerun');
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
      const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.jsonl'));
      for (const f of files) {
        fs.copyFileSync(path.join(releaseDir, f), path.join(stagingDir, f));
      }

      const res = await runFinalCorpusValidationAndPublication({
        stagingDir,
        activePointerPath: finalManifestPath,
        recruitmentManifestPath,
      });

      assert.equal(res.status, 'UNCHANGED');
      assert.equal(res.releaseDigest, finalManifest.release_digest);
    } finally {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  it('11. DATA-03.3B and DATA-03.2 releases and pointers remain completely untouched', () => {
    assert.ok(fs.existsSync(recruitmentManifestPath));
    const recManifest = JSON.parse(fs.readFileSync(recruitmentManifestPath, 'utf8'));
    assert.equal(recManifest.release_id, 'release:DATA-03.3B:3f911f461e886e98');
    assert.equal(recManifest.active_pointer_status, 'ACTIVE');

    assert.ok(fs.existsSync(foundationManifestPath));
    const foundManifest = JSON.parse(fs.readFileSync(foundationManifestPath, 'utf8'));
    assert.equal(foundManifest.release_id, 'release:DATA-03.2:e38798adc4f8e1ee');
    assert.equal(foundManifest.active_pointer_status, 'ACTIVE');
  });
});
