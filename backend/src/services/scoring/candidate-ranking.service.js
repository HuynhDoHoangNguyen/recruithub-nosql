/**
 * TV3-UC15-001: Deterministic Candidate Ranking Service
 *
 * Implements deterministic ranking core and batch data access for candidate applications:
 * - RBAC & Job ownership verification prior to collection reads
 * - Full application collection pagination via allApplicationsForJob
 * - Batch retrieval of Candidate and Resume Analysis documents via getMany
 * - Controlled per-application exclusions (schema errors, stale analysis, inactive stages)
 * - Pure deterministic sorting on raw unrounded values:
 *     1. total_score DESC
 *     2. scores.skill DESC
 *     3. application.applied_at ASC
 *     4. application._id ASC
 * - Zero persistence / zero database mutations
 */

import { ApiError } from '../../middleware/job-application.middleware.js';
import { applicationDocumentSchema } from '../../schemas/application.schema.js';
import { candidateDocumentSchema } from '../../schemas/candidate.schema.js';
import { resumeAnalysisDocumentSchema } from '../../schemas/resume-analysis.schema.js';
import { ANALYSIS_STATUSES } from '../../schemas/resume-analysis.schema.js';
import { APPLICATION_STAGES } from '../../constants/document.constants.js';
import { compareRankedItems, isAnalysisFresh } from '../../utils/resume-scoring.utils.js';
import { ownedJob } from '../job-application-scope.service.js';

export const RANKING_EXCLUSION_REASONS = Object.freeze({
  NOT_ANALYZED: 'NOT_ANALYZED',
  INCOMPLETE: 'INCOMPLETE',
  STALE: 'STALE',
  INVALID_ANALYSIS: 'INVALID_ANALYSIS',
  REFERENCE_MISMATCH: 'REFERENCE_MISMATCH',
  INVALID_APPLICATION: 'INVALID_APPLICATION',
  INVALID_CANDIDATE: 'INVALID_CANDIDATE',
  INACTIVE_STAGE: 'INACTIVE_STAGE',
});

const ACTIVE_APPLICATION_STAGES = new Set([
  APPLICATION_STAGES.APPLIED,
  APPLICATION_STAGES.SCREENING,
  APPLICATION_STAGES.INTERVIEW,
  APPLICATION_STAGES.OFFER,
]);

export class CandidateRankingService {
  /**
   * @param {Object} repository - Repository interface supporting allApplicationsForJob, getMany, get, profile
   * @param {Object} [options]
   */
  constructor(repository, options = {}) {
    if (!repository || typeof repository !== 'object') {
      throw new Error('CandidateRankingService requires a repository instance.');
    }
    if (typeof repository.get !== 'function') {
      throw new Error('CandidateRankingService requires repository to implement get(id).');
    }
    if (typeof repository.profile !== 'function') {
      throw new Error('CandidateRankingService requires repository to implement profile(type, userId).');
    }
    if (typeof repository.allApplicationsForJob !== 'function') {
      throw new Error('CandidateRankingService requires repository to implement allApplicationsForJob(jobId, options).');
    }
    if (typeof repository.getMany !== 'function') {
      throw new Error('CandidateRankingService requires repository to implement getMany(ids).');
    }
    this.repo = repository;
    this.options = options;
    this.rankForRecruiter = this.rankForRecruiter.bind(this);
    this.getRankingForRecruiter = this.getRankingForRecruiter.bind(this);
  }

  /**
   * Deterministically ranks eligible candidate applications for a Job owned by a Recruiter.
   *
   * @param {Object} user - Authenticated user document
   * @param {string} jobId - Job ID
   * @param {Object} [callOptions]
   * @param {number} [callOptions.pageSize=100]
   * @returns {Promise<{ job: Object, totalApplications: number, rankedItems: Array<Object>, exclusions: Object }>}
   */
  async rankForRecruiter(user, jobId, callOptions = {}) {
    if (!jobId || typeof jobId !== 'string') {
      throw new ApiError(400, 'INVALID_JOB_ID', 'Mã tin tuyển dụng không hợp lệ.');
    }

    // 1. Enforce RBAC & Job ownership before loading collections
    const { job } = await ownedJob(this.repo, user, jobId);

    // 2. Load all applications for this job
    const pageSize = callOptions.pageSize || this.options.pageSize || 100;
    const rawApplications = await this.repo.allApplicationsForJob(job._id, { pageSize });
    if (!Array.isArray(rawApplications)) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể đọc danh sách hồ sơ ứng tuyển từ cơ sở dữ liệu.');
    }

    const totalApplications = rawApplications.length;

    const exclusions = {
      total: 0,
      byReason: {},
    };

    const recordExclusion = (reason) => {
      exclusions.total += 1;
      exclusions.byReason[reason] = (exclusions.byReason[reason] || 0) + 1;
    };

    if (totalApplications === 0) {
      return {
        job,
        totalApplications: 0,
        rankedItems: [],
        exclusions,
      };
    }

    // 3. Pre-validate applications and filter active stages
    const activeValidApplications = [];

    for (const rawApp of rawApplications) {
      if (!rawApp || typeof rawApp !== 'object' || rawApp.type !== 'application') {
        recordExclusion(RANKING_EXCLUSION_REASONS.INVALID_APPLICATION);
        continue;
      }

      const parsedApp = applicationDocumentSchema.safeParse(rawApp);
      if (!parsedApp.success) {
        recordExclusion(RANKING_EXCLUSION_REASONS.INVALID_APPLICATION);
        continue;
      }

      const app = parsedApp.data;
      if (app.job_id !== job._id) {
        recordExclusion(RANKING_EXCLUSION_REASONS.REFERENCE_MISMATCH);
        continue;
      }

      if (!ACTIVE_APPLICATION_STAGES.has(app.current_stage)) {
        recordExclusion(RANKING_EXCLUSION_REASONS.INACTIVE_STAGE);
        continue;
      }

      activeValidApplications.push(app);
    }

    if (activeValidApplications.length === 0) {
      return {
        job,
        totalApplications,
        rankedItems: [],
        exclusions,
      };
    }

    // 4. Batch fetch Candidates and Resume Analyses via getMany to avoid N+1
    const candidateIds = activeValidApplications.map((app) => app.candidate_id);
    const analysisIds = activeValidApplications.map((app) => `analysis:${app._id}`);
    const allDocIdsToFetch = Array.from(new Set([...candidateIds, ...analysisIds]));

    const docsMap = await this.repo.getMany(allDocIdsToFetch);
    if (!(docsMap instanceof Map)) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Repository getMany must return a Map instance.');
    }

    // 5. Evaluate eligibility and partition into eligible items or controlled exclusions
    const eligibleItems = [];

    for (const app of activeValidApplications) {
      // 5.1 Candidate validation
      const rawCandidate = docsMap.get(app.candidate_id);
      if (!rawCandidate || rawCandidate.type !== 'candidate') {
        recordExclusion(RANKING_EXCLUSION_REASONS.INVALID_CANDIDATE);
        continue;
      }

      const parsedCandidate = candidateDocumentSchema.safeParse(rawCandidate);
      if (!parsedCandidate.success) {
        recordExclusion(RANKING_EXCLUSION_REASONS.INVALID_CANDIDATE);
        continue;
      }

      const candidate = parsedCandidate.data;
      if (candidate._id !== app.candidate_id) {
        recordExclusion(RANKING_EXCLUSION_REASONS.REFERENCE_MISMATCH);
        continue;
      }

      // 5.2 Analysis presence check
      const expectedAnalysisId = `analysis:${app._id}`;
      const rawAnalysis = docsMap.get(expectedAnalysisId);
      if (!rawAnalysis) {
        recordExclusion(RANKING_EXCLUSION_REASONS.NOT_ANALYZED);
        continue;
      }

      // 5.3 Analysis type and schema check
      if (rawAnalysis.type !== 'resume_analysis') {
        recordExclusion(RANKING_EXCLUSION_REASONS.INVALID_ANALYSIS);
        continue;
      }

      const parsedAnalysis = resumeAnalysisDocumentSchema.safeParse(rawAnalysis);
      if (!parsedAnalysis.success) {
        recordExclusion(RANKING_EXCLUSION_REASONS.INVALID_ANALYSIS);
        continue;
      }

      const analysis = parsedAnalysis.data;

      // 5.4 Strict reference integrity checks
      if (
        analysis._id !== expectedAnalysisId ||
        analysis.application_id !== app._id ||
        analysis.candidate_id !== app.candidate_id ||
        analysis.job_id !== app.job_id ||
        analysis.job_id !== job._id
      ) {
        recordExclusion(RANKING_EXCLUSION_REASONS.REFERENCE_MISMATCH);
        continue;
      }

      // 5.5 Completeness check
      if (analysis.analysis_status !== ANALYSIS_STATUSES.COMPLETE) {
        recordExclusion(RANKING_EXCLUSION_REASONS.INCOMPLETE);
        continue;
      }

      // 5.6 Freshness validation
      if (!isAnalysisFresh(analysis, candidate, job)) {
        recordExclusion(RANKING_EXCLUSION_REASONS.STALE);
        continue;
      }

      // Eligible for deterministic ranking
      eligibleItems.push({
        application: app,
        candidate,
        analysis,
      });
    }

    // 6. Deterministic sorting on raw unrounded values
    eligibleItems.sort(compareRankedItems);

    // 7. Assign sequential rank from 1
    const rankedItems = eligibleItems.map((item, index) => ({
      rank: index + 1,
      application: item.application,
      candidate: item.candidate,
      analysis: item.analysis,
    }));

    return {
      job,
      totalApplications,
      rankedItems,
      exclusions,
    };
  }

  /**
   * Public API-facing method to retrieve paginated, safe candidate ranking DTO for a Recruiter.
   *
   * @param {Object} user - Authenticated Recruiter document
   * @param {string} jobId - Job ID
   * @param {Object} [query={}] - Validated query containing { page, limit }
   * @returns {Promise<Object>} Safe DTO
   */
  async getRankingForRecruiter(user, jobId, query = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    // 1. Run complete deterministic ranking core (loads all applications, batches documents, applies global ranking)
    const result = await this.rankForRecruiter(user, jobId);

    const eligibleCount = result.rankedItems.length;
    const totalPages = eligibleCount === 0 ? 0 : Math.ceil(eligibleCount / limit);

    // 2. Paginate AFTER global ranking is done
    const startIndex = (page - 1) * limit;
    const pagedRankedItems = result.rankedItems.slice(startIndex, startIndex + limit);

    // 3. Map to safe DTO allowlist explicitly (never using spread operator on internal docs)
    const items = pagedRankedItems.map((item) => ({
      rank: item.rank,
      application_id: item.application._id,
      current_stage: item.application.current_stage,
      applied_at: item.application.applied_at,
      candidate: {
        id: item.candidate._id,
        profile: {
          full_name: item.candidate.profile?.full_name || '',
          role: item.candidate.profile?.role || '',
          seniority: item.candidate.profile?.seniority || '',
        },
        skills: Array.isArray(item.candidate.skills)
          ? item.candidate.skills.map((skill) => ({
              name: skill.name,
              normalized: skill.normalized,
            }))
          : [],
      },
      analysis_status: item.analysis.analysis_status,
      analysis_fresh: true,
      analysis_total_score: item.analysis.total_score,
      analysis_recommendation: item.analysis.recommendation,
    }));

    return {
      job: {
        id: result.job._id,
        title: result.job.title,
      },
      summary: {
        total_applications: result.totalApplications,
        eligible_applications: eligibleCount,
        excluded_applications: result.exclusions.total,
        exclusions_by_reason: { ...result.exclusions.byReason },
      },
      items,
      pagination: {
        page,
        limit,
        total_items: eligibleCount,
        total_pages: totalPages,
      },
    };
  }
}

export function createCandidateRankingService(repository, options) {
  return new CandidateRankingService(repository, options);
}
