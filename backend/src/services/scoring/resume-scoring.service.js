/**
 * TV3-UC22-001: Runtime Resume Scoring Service
 * 
 * Implements deterministic runtime scoring service for Application documents:
 * - Loads Application, Candidate, and Job documents.
 * - Enforces document type checking and canonical Zod schema validation via parseStored.
 * - Verifies relational integrity (candidate_id and job_id).
 * - Executes pure scoring evaluation using evaluateResumeAnalysis().
 * - Validates generated Resume Analysis with resumeAnalysisDocumentSchema.
 * - Upserts deterministic analysis document (analysis:<application_id>) into repository.
 * - Safely handles CouchDB HTTP 409 revision conflicts with fresh re-evaluation and max 1 retry.
 * - Emits controlled user-safe errors without exposing sensitive information.
 */

import { ApiError } from '../../middleware/job-application.middleware.js';
import { applicationDocumentSchema } from '../../schemas/application.schema.js';
import { candidateDocumentSchema } from '../../schemas/candidate.schema.js';
import { jobDocumentSchema } from '../../schemas/job.schema.js';
import { resumeAnalysisDocumentSchema } from '../../schemas/resume-analysis.schema.js';
import { evaluateResumeAnalysis, isAnalysisFresh } from '../../utils/resume-scoring.utils.js';
import { assertActiveRole, ownedJob, parseStored, requireDocument } from '../job-application-scope.service.js';

export { parseStored };

export class ResumeScoringService {
  /**
   * @param {Object} repository - Repository interface supporting get(id) and put(doc)
   * @param {Object|Function} [clockOrOptions] - Injected clock or options object with now()
   */
  constructor(repository, clockOrOptions = {}) {
    if (!repository || typeof repository.get !== 'function' || typeof repository.put !== 'function') {
      throw new Error('ResumeScoringService requires a repository instance with get and put methods.');
    }
    this.repo = repository;

    if (typeof clockOrOptions === 'function') {
      this.now = clockOrOptions;
    } else if (typeof clockOrOptions?.now === 'function') {
      this.now = clockOrOptions.now;
    } else if (clockOrOptions?.clock?.time !== undefined) {
      this.now = () => new Date(clockOrOptions.clock.time);
    } else {
      this.now = () => new Date();
    }

    this.analyzeApplication = this.analyzeApplication.bind(this);
    this.getAnalysisSummary = this.getAnalysisSummary.bind(this);
    this.analyzeApplicationForRecruiter = this.analyzeApplicationForRecruiter.bind(this);
    this.getResumeAnalysisForRecruiter = this.getResumeAnalysisForRecruiter.bind(this);
  }

  /**
   * Loads and validates Application, Candidate, and Job documents from the repository.
   * Throws controlled ApiError instances on missing, mistyped, invalid, or mismatched references.
   * 
   * @param {string} applicationId 
   * @returns {Promise<{ application: Object, candidate: Object, job: Object }>}
   */
  async #loadAndValidateInputs(applicationId) {
    if (!applicationId || typeof applicationId !== 'string') {
      throw new ApiError(400, 'INVALID_APPLICATION_ID', 'Mã hồ sơ ứng tuyển không hợp lệ.');
    }

    // 1. Tải Application theo applicationId
    const applicationDoc = await this.repo.get(applicationId);
    if (!applicationDoc) {
      throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ ứng tuyển.');
    }

    // 2. Kiểm tra document có type === "application"
    if (applicationDoc.type !== 'application') {
      throw new ApiError(400, 'INVALID_DOCUMENT_TYPE', 'Loại tài liệu hồ sơ ứng tuyển không hợp lệ. Kỳ vọng application.');
    }

    // 3. Parse Application bằng parseStored(applicationDocumentSchema, applicationDocument)
    const application = parseStored(applicationDocumentSchema, applicationDoc);

    // 4. Tải Candidate và Job được Application tham chiếu
    const candidateDoc = await this.repo.get(application.candidate_id);
    if (!candidateDoc) {
      throw new ApiError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy hồ sơ ứng viên tham chiếu.');
    }
    if (candidateDoc.type !== 'candidate') {
      throw new ApiError(400, 'INVALID_DOCUMENT_TYPE', 'Loại tài liệu ứng viên không hợp lệ. Kỳ vọng candidate.');
    }

    const jobDoc = await this.repo.get(application.job_id);
    if (!jobDoc) {
      throw new ApiError(404, 'JOB_NOT_FOUND', 'Không tìm thấy tin tuyển dụng tham chiếu.');
    }
    if (jobDoc.type !== 'job') {
      throw new ApiError(400, 'INVALID_DOCUMENT_TYPE', 'Loại tài liệu tin tuyển dụng không hợp lệ. Kỳ vọng job.');
    }

    // 5. Parse bằng parseStored(candidateDocumentSchema) và parseStored(jobDocumentSchema)
    const candidate = parseStored(candidateDocumentSchema, candidateDoc);
    const job = parseStored(jobDocumentSchema, jobDoc);

    // 6. Kiểm tra tham chiếu chéo
    if (application.candidate_id !== candidate._id) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Tham chiếu ứng viên không khớp với hồ sơ ứng tuyển.');
    }
    if (application.job_id !== job._id) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Tham chiếu tin tuyển dụng không khớp với hồ sơ ứng tuyển.');
    }

    return { application, candidate, job };
  }

  /**
   * Validates existing analysis document if present.
   * If document does not exist, returns null.
   * If document exists:
   * 1. Checks type === 'resume_analysis'. Throws 409 CONFLICT if invalid type.
   * 2. Parses via parseStored(resumeAnalysisDocumentSchema, existingDoc).
   * 3. Checks _id, application_id, candidate_id, job_id match current application/candidate/job.
   *    Throws 409 REFERENCE_MISMATCH if mismatched.
   * 
   * @param {string} analysisId 
   * @param {{ application: Object, candidate: Object, job: Object }} inputs 
   * @returns {Promise<Object|null>} validated existing analysis or null
   */
  async #loadAndValidateExistingAnalysis(analysisId, { application, candidate, job }) {
    const existingDoc = await this.repo.get(analysisId);
    if (!existingDoc) {
      return null;
    }

    // 1. Kiểm tra type === 'resume_analysis'
    if (existingDoc.type !== 'resume_analysis') {
      throw new ApiError(409, 'CONFLICT', 'Tài liệu chiếm giữ định danh phân tích hồ sơ có loại không hợp lệ.');
    }

    // 2. Parse bằng parseStored(resumeAnalysisDocumentSchema, existingDoc)
    const existingAnalysis = parseStored(resumeAnalysisDocumentSchema, existingDoc);

    // 3. Kiểm tra tham chiếu và ID đơn định
    if (existingAnalysis._id !== analysisId || existingAnalysis._id !== `analysis:${application._id}`) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Định danh bản ghi phân tích hồ sơ hiện có không khớp.');
    }
    if (existingAnalysis.application_id !== application._id) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Tham chiếu hồ sơ ứng tuyển trong bản ghi phân tích hiện có không khớp.');
    }
    if (existingAnalysis.candidate_id !== candidate._id) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Tham chiếu ứng viên trong bản ghi phân tích hiện có không khớp.');
    }
    if (existingAnalysis.job_id !== job._id) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Tham chiếu tin tuyển dụng trong bản ghi phân tích hiện có không khớp.');
    }

    return existingAnalysis;
  }

  /**
   * Evaluates and upserts Resume Analysis for an Application.
   * 
   * @param {string} applicationId
   * @param {Object} [options]
   * @param {Object} [options.provenance]
   * @returns {Promise<Object>} Persisted resume analysis document
   */
  async analyzeApplication(applicationId, options = {}) {
    // Attempt 1: Load, validate, score, and persist
    const inputs = await this.#loadAndValidateInputs(applicationId);
    const analysisId = `analysis:${inputs.application._id}`;

    // Validate existing analysis if present before acquiring _rev
    const existingAnalysis = await this.#loadAndValidateExistingAnalysis(analysisId, inputs);

    // 8. Chạy scoring với input đã validate và clock được inject
    const analyzedAt = this.now().toISOString();
    const evaluatedAnalysis = evaluateResumeAnalysis({
      application: inputs.application,
      candidate: inputs.candidate,
      job: inputs.job,
      analyzedAt,
      ...(options.provenance ? { provenance: options.provenance } : {}),
    });

    // 9. Validate kết quả bằng resumeAnalysisDocumentSchema
    const validatedAnalysis = resumeAnalysisDocumentSchema.parse(evaluatedAnalysis);

    // 10-11. Upsert theo ID deterministic: analysis:<application_id>, sử dụng _rev mới nhất nếu tồn tại
    if (existingAnalysis?._rev) {
      validatedAnalysis._rev = existingAnalysis._rev;
    }

    try {
      const saved = await this.repo.put(validatedAnalysis);
      return {
        ...validatedAnalysis,
        _rev: saved?._rev || saved?.rev || validatedAnalysis._rev,
      };
    } catch (putError) {
      const isConflict = putError?.status === 409 || putError?.code === 'CONFLICT';
      if (!isConflict) {
        throw putError;
      }

      // 7. Xử lý xung đột CouchDB (HTTP 409): Fresh re-read, re-evaluation và tối đa 1 lần retry
      return await this.#retryAfterConflict(applicationId, analysisId, options);
    }
  }

  /**
   * Conflict handler: fresh read of Application, Candidate, Job, and analysis;
   * re-evaluates scoring and retries put with latest _rev exactly once.
   * 
   * @param {string} applicationId 
   * @param {string} analysisId 
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async #retryAfterConflict(applicationId, analysisId, options = {}) {
    // 1. Đọc lại Application, Candidate, Job và analysis mới nhất
    // 2. Parse lại toàn bộ document
    // 3. Kiểm tra lại reference
    const freshInputs = await this.#loadAndValidateInputs(applicationId);
    const freshExistingAnalysis = await this.#loadAndValidateExistingAnalysis(analysisId, freshInputs);

    // 4. Chạy lại scoring với input mới nhất
    const freshAnalyzedAt = this.now().toISOString();
    const freshEvaluatedAnalysis = evaluateResumeAnalysis({
      application: freshInputs.application,
      candidate: freshInputs.candidate,
      job: freshInputs.job,
      analyzedAt: freshAnalyzedAt,
      ...(options.provenance ? { provenance: options.provenance } : {}),
    });

    // Validate kết quả
    const freshValidatedAnalysis = resumeAnalysisDocumentSchema.parse(freshEvaluatedAnalysis);

    // 5. Sử dụng _rev mới nhất từ fresh read
    if (freshExistingAnalysis?._rev) {
      freshValidatedAnalysis._rev = freshExistingAnalysis._rev;
    }

    // 6. Retry tối đa một lần
    try {
      const saved = await this.repo.put(freshValidatedAnalysis);
      return {
        ...freshValidatedAnalysis,
        _rev: saved?._rev || saved?.rev || freshValidatedAnalysis._rev,
      };
    } catch (retryError) {
      const isConflict = retryError?.status === 409 || retryError?.code === 'CONFLICT';
      if (isConflict) {
        throw new ApiError(409, 'CONFLICT', 'Xung đột phiên bản tài liệu. Vui lòng thử lại sau.');
      }
      throw retryError;
    }
  }

  /**
   * Retrieves summary of resume analysis status and freshness for an Application.
   * Safe for read flows: strictly read-only, never writes to repository or recomputes.
   * 
   * @param {string|Object} applicationOrId - Application ID or Application document
   * @returns {Promise<{ analysis_status: string, analysis_fresh: boolean }>}
   */
  async getAnalysisSummary(applicationOrId) {
    const applicationId = typeof applicationOrId === 'string'
      ? applicationOrId
      : applicationOrId?._id;

    if (!applicationId || typeof applicationId !== 'string') {
      throw new ApiError(400, 'INVALID_APPLICATION_ID', 'Mã hồ sơ ứng tuyển không hợp lệ.');
    }

    const inputs = await this.#loadAndValidateInputs(applicationId);
    const analysisId = `analysis:${inputs.application._id}`;

    const existingAnalysis = await this.#loadAndValidateExistingAnalysis(analysisId, inputs);
    if (!existingAnalysis) {
      return {
        analysis_status: 'NOT_ANALYZED',
        analysis_fresh: false,
      };
    }

    const fresh = isAnalysisFresh(existingAnalysis, inputs.candidate, inputs.job);
    const summary = {
      analysis_status: existingAnalysis.analysis_status,
      analysis_fresh: fresh,
    };

    if (existingAnalysis.analysis_status === 'COMPLETE' && fresh) {
      summary.analysis_total_score = existingAnalysis.total_score;
      summary.analysis_recommendation = existingAnalysis.recommendation;
    }

    return summary;
  }

  /**
   * Computes or recomputes resume analysis on behalf of a Recruiter.
   * Verifies that:
   * 1. User has active RECRUITER role.
   * 2. Application exists and passes schema validation.
   * 3. Recruiter owns the Job referenced by the Application.
   * 4. Candidate and Job references are valid.
   * 5. Executes deterministic analyzeApplication(applicationId).
   * 
   * @param {Object} user - Authenticated user document
   * @param {string} applicationId - Application ID
   * @returns {Promise<Object>} Stored Resume Analysis document
   */
  async analyzeApplicationForRecruiter(user, applicationId) {
    if (!applicationId || typeof applicationId !== 'string') {
      throw new ApiError(400, 'INVALID_APPLICATION_ID', 'Mã hồ sơ ứng tuyển không hợp lệ.');
    }

    assertActiveRole(user, 'RECRUITER');

    const applicationDoc = await requireDocument(this.repo, applicationId, 'application');
    const application = parseStored(applicationDocumentSchema, applicationDoc);

    await ownedJob(this.repo, user, application.job_id);

    return this.analyzeApplication(application._id);
  }

  /**
   * Retrieves Resume Analysis DTO for an Application on behalf of an owner Recruiter.
   *
   * @param {Object} user - Authenticated user document
   * @param {string} applicationId - Application ID
   * @returns {Promise<Object>} Safe DTO for UC14
   */
  async getResumeAnalysisForRecruiter(user, applicationId) {
    if (!applicationId || typeof applicationId !== 'string') {
      throw new ApiError(400, 'INVALID_APPLICATION_ID', 'Mã hồ sơ ứng tuyển không hợp lệ.');
    }

    assertActiveRole(user, 'RECRUITER');

    const applicationDoc = await requireDocument(this.repo, applicationId, 'application');
    const application = parseStored(applicationDocumentSchema, applicationDoc);

    const { job } = await ownedJob(this.repo, user, application.job_id);

    const candidateDoc = await requireDocument(this.repo, application.candidate_id, 'candidate');
    const candidate = parseStored(candidateDocumentSchema, candidateDoc);

    if (application.candidate_id !== candidate._id || application.job_id !== job._id) {
      throw new ApiError(409, 'REFERENCE_MISMATCH', 'Tham chiếu không khớp với hồ sơ ứng tuyển.');
    }

    const analysisId = `analysis:${application._id}`;
    const existingAnalysis = await this.#loadAndValidateExistingAnalysis(analysisId, { application, candidate, job });

    if (!existingAnalysis) {
      return {
        application_id: application._id,
        analysis_status: 'NOT_ANALYZED',
        analysis_fresh: false,
        candidate: {
          id: candidate._id,
          full_name: candidate.profile?.full_name ?? '',
        },
        job: {
          id: job._id,
          title: job.title,
        },
        analysis: null,
      };
    }

    const fresh = isAnalysisFresh(existingAnalysis, candidate, job);
    const hasMetadata = Boolean(
      existingAnalysis.component_details?.skill?.input_context !== undefined &&
      existingAnalysis.component_details?.experience?.input_context !== undefined &&
      existingAnalysis.component_details?.education?.input_context !== undefined &&
      existingAnalysis.component_details?.project?.input_context !== undefined
    );

    let hasSyntheticEvidence = null;
    if (hasMetadata) {
      const projectEvidence = existingAnalysis.component_details?.project?.input_context?.candidate_project_evidence;
      hasSyntheticEvidence = Array.isArray(projectEvidence)
        ? projectEvidence.some(item => item?.is_synthetic === true)
        : false;
    }

    const analysisDto = {
      scores: {
        skill: existingAnalysis.scores.skill,
        experience: existingAnalysis.scores.experience,
        education: existingAnalysis.scores.education,
        project: existingAnalysis.scores.project,
      },
    };

    if (existingAnalysis.analysis_status === 'COMPLETE') {
      analysisDto.total_score = existingAnalysis.total_score;
      analysisDto.recommendation = existingAnalysis.recommendation;
    }

    analysisDto.matched_skills = existingAnalysis.matched_skills || [];
    analysisDto.missing_skills = existingAnalysis.missing_skills || [];
    analysisDto.project = {
      matched_technologies: existingAnalysis.component_details?.project?.matched_technologies || [],
      missing_technologies: existingAnalysis.component_details?.project?.missing_technologies || [],
    };
    analysisDto.missing_inputs = existingAnalysis.missing_inputs || [];
    analysisDto.algorithm_version = existingAnalysis.algorithm_version;
    analysisDto.analyzed_at = existingAnalysis.analyzed_at;
    analysisDto.evidence_metadata = {
      available: hasMetadata,
      has_synthetic_evidence: hasSyntheticEvidence,
    };

    return {
      application_id: application._id,
      analysis_status: existingAnalysis.analysis_status,
      analysis_fresh: fresh,
      candidate: {
        id: candidate._id,
        full_name: candidate.profile?.full_name ?? '',
      },
      job: {
        id: job._id,
        title: job.title,
      },
      analysis: analysisDto,
    };
  }
}

export function createResumeScoringService(repository, options) {
  return new ResumeScoringService(repository, options);
}
