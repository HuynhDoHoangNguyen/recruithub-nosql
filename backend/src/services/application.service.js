import { applicationDocumentSchema } from '../schemas/application.schema.js';
import { candidateDocumentSchema } from '../schemas/candidate.schema.js';
import { interviewDocumentSchema } from '../schemas/interview.schema.js';
import { ApiError } from '../middleware/job-application.middleware.js';
import { applicationIdFromPair } from '../utils/id.utils.js';
import { APPROVED_TRANSITIONS, isValidStageTransition, validateApplicationCreationScope, validateStageHistory } from '../utils/application-lifecycle.utils.js';
import { validateInterviewEvidenceForOffer, validateInterviewTimeline } from '../utils/interview-validation.utils.js';
import { acceptanceSchema } from '../schemas/job-application-request.schema.js';
import { candidateDto, candidateScope, descendingSort, ownedJob, parseStored, publicJobDto, requireDocument, runtimeProvenance, validateJobReferences } from './job-application-scope.service.js';
import { validateWrite } from './job.service.js';

export class ApplicationService {
  constructor(repository, { now = () => new Date(), analyzeApplication } = {}) {
    this.repo = repository; this.now = now; this.analyzeApplication = analyzeApplication;
  }
  async context(user) {
    return { candidate: candidateDto(await candidateScope(this.repo, user)), email: user.email };
  }
  async stats(user) {
    const candidate = await candidateScope(this.repo, user);
    return this.repo.candidateStats(candidate._id);
  }
  async create(user, payload) {
    const candidate = await candidateScope(this.repo, user);
    const id = applicationIdFromPair(candidate._id, payload.job_id);
    // Direct deterministic lookup supports response-loss recovery even after the job closes.
    if (await this.repo.get(id)) throw new ApiError(409, 'DUPLICATE_APPLICATION', 'Bạn đã nộp hồ sơ cho vị trí này. Không thể nộp lại.');
    const job = await requireDocument(this.repo, payload.job_id, 'job');
    await validateJobReferences(this.repo, job);
    const appliedAt = this.now().toISOString();
    const check = validateApplicationCreationScope({ candidate, job, user, appliedAt });
    if (!check.valid) throw new ApiError(400, 'JOB_NOT_ELIGIBLE', 'Tin chưa mở, đã đóng hoặc đã quá hạn nộp hồ sơ.');
    const document = validateWrite(applicationDocumentSchema, {
      _id: id, type: 'application', candidate_id: candidate._id, job_id: job._id,
      current_stage: 'APPLIED', applied_at: appliedAt, updated_at: appliedAt, submission: payload.submission,
      stage_history: [{ from_stage: null, to_stage: 'APPLIED', timestamp: appliedAt, actor_role: 'CANDIDATE', actor_id: user._id }],
      provenance: runtimeProvenance(['submission']),
    });
    const response = await this.dto(document, 'CANDIDATE');
    let saved;
    try { saved = await this.repo.put(document); }
    catch (error) {
      if (error.status === 409 && await this.repo.get(id)) throw new ApiError(409, 'DUPLICATE_APPLICATION', 'Bạn đã nộp hồ sơ cho vị trí này. Không thể nộp lại.');
      throw error;
    }
    let analysisStatus = 'NOT_ANALYZED';
    if (this.analyzeApplication) {
      try { await this.analyzeApplication(saved._id); analysisStatus = 'REQUESTED'; }
      catch { analysisStatus = 'PENDING_RETRY'; }
    }
    return { ...response, _rev: saved._rev, analysis_status: analysisStatus };
  }
  async authorize(user, id) {
    const application = parseStored(applicationDocumentSchema, await requireDocument(this.repo, id, 'application'));
    if (user.role === 'CANDIDATE') {
      const candidate = await candidateScope(this.repo, user);
      if (candidate._id !== application.candidate_id) throw new ApiError(403, 'FORBIDDEN', 'Đơn ứng tuyển không thuộc tài khoản.');
      return { application };
    }
    const scope = await ownedJob(this.repo, user, application.job_id);
    return { application, ...scope };
  }
  async detail(user, id) {
    return this.dto((await this.authorize(user, id)).application, user.role);
  }
  async mine(user, query) {
    const candidate = await candidateScope(this.repo, user);
    if (query.job_id) {
      const application = await this.repo.get(applicationIdFromPair(candidate._id, query.job_id));
      return { items: application && (!query.stage || application.current_stage === query.stage) ? [await this.dto(application, user.role)] : [], has_more: false, bookmark: null };
    }
    const fields = ['type', 'candidate_id', ...(query.stage ? ['current_stage'] : []), 'applied_at'];
    const page = await this.repo.find({ type: 'application', candidate_id: candidate._id, ...(query.stage ? { current_stage: query.stage } : {}) },
      { ...query, index: query.stage ? 'candidate_applications_stage' : 'candidate_applications', sort: descendingSort(fields) });
    return { ...page, items: await Promise.all(page.items.map(application => this.dto(application, user.role))) };
  }
  async applicants(user, id, query) {
    const { job } = await ownedJob(this.repo, user, id);
    const fields = ['type', 'job_id', ...(query.stage ? ['current_stage'] : []), 'applied_at'];
    const page = await this.repo.find({ type: 'application', job_id: id, ...(query.stage ? { current_stage: query.stage } : {}) },
      { ...query, index: query.stage ? 'job_applications_stage' : 'job_applications', sort: descendingSort(fields) });
    return { ...page, job: publicJobDto(job), items: await Promise.all(page.items.map(application => this.dto(application, 'RECRUITER'))) };
  }
  async dto(application, role) {
    const fields = ['_id', '_rev', 'candidate_id', 'job_id', 'current_stage', 'applied_at', 'updated_at', 'submission'];
    const result = Object.fromEntries(fields.filter(key => application[key] !== undefined).map(key => [key, application[key]]));
    const job = await this.repo.get(application.job_id);
    result.job = job?.type === 'job' ? publicJobDto(job) : null;
    if (result.job) {
      const company = await this.repo.get(job.company_id);
      if (company?.type === 'company') result.job.company_name = company.name;
    }
    result.stage_history = application.stage_history.map(event => role === 'RECRUITER' ? event : {
      from_stage: event.from_stage, to_stage: event.to_stage, timestamp: event.timestamp, actor_role: event.actor_role,
    });
    result.allowed_transitions = APPROVED_TRANSITIONS.filter(rule => rule.from === application.current_stage && rule.actors.includes(role)).map(rule => rule.to);
    result.analysis_status = 'NOT_ANALYZED'; // Scoring service integration is deliberately explicit.
    if (role === 'RECRUITER') {
      const candidate = parseStored(candidateDocumentSchema, await requireDocument(this.repo, application.candidate_id, 'candidate'));
      const user = await requireDocument(this.repo, candidate.user_id, 'user');
      if (user.role !== 'CANDIDATE') throw new ApiError(409, 'INVALID_SCOPE', 'Tham chiếu ứng viên không hợp lệ.');
      result.candidate = candidateDto(candidate);
      result.email = user.email;
      if (application.recruiter_note) result.recruiter_note = application.recruiter_note;
      if (application.current_stage === 'INTERVIEW') {
        const interviews = await this.repo.allInterviews(application._id);
        result.interview_status = interviews.length ? 'RECORDED' : 'SCHEDULING_REQUIRED';
      }
    }
    return result;
  }
  async transition(user, id, payload, withdraw = false) {
    const { application, recruiter } = await this.authorize(user, id);
    if ((withdraw && user.role !== 'CANDIDATE') || (!withdraw && user.role !== 'RECRUITER')) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
    if (application._rev !== payload.expected_rev || application.current_stage !== payload.expected_stage) {
      throw new ApiError(409, 'CONFLICT', 'Tiến trình đã thay đổi. Vui lòng tải lại trước khi thao tác.');
    }
    const toStage = withdraw ? 'WITHDRAWN' : payload.to_stage;
    const timestamp = new Date(Math.max(this.now().getTime(), Date.parse(application.updated_at) + 1,
      Date.parse(application.stage_history.at(-1).timestamp) + 1)).toISOString();
    let evidence = payload.evidence;
    if (toStage === 'OFFER' && application.current_stage === 'INTERVIEW') {
      const interviews = await this.repo.allInterviews(id);
      const enteredAt = application.stage_history.find(event => event.to_stage === 'INTERVIEW').timestamp;
      const valid = validateInterviewEvidenceForOffer({ interviews, applicationId: id }).valid && interviews.every(interview =>
        interviewDocumentSchema.safeParse(interview).success && interview.candidate_id === application.candidate_id && interview.job_id === application.job_id &&
        [recruiter._id, recruiter.user_id].includes(interview.interviewer_id) && Date.parse(interview.completed_at) <= Date.parse(timestamp) &&
        validateInterviewTimeline({ scheduledAt: interview.scheduled_at, completedAt: interview.completed_at, interviewStageAt: enteredAt }).valid);
      if (!valid) throw new ApiError(400, 'INTERVIEW_EVIDENCE_REQUIRED', 'Cần hoàn tất các vòng phỏng vấn thực tế trước khi gửi đề nghị.');
      evidence = { interview_ids: interviews.map(interview => interview._id).sort() };
    } else if (toStage === 'HIRED' && application.current_stage === 'OFFER') {
      const parsed = acceptanceSchema.safeParse(evidence);
      if (!parsed.success || Date.parse(evidence.accepted_at) < Date.parse(application.stage_history.at(-1).timestamp) || Date.parse(evidence.accepted_at) > this.now().getTime()) {
        throw new ApiError(400, 'OFFER_ACCEPTANCE_REQUIRED', 'Cần bằng chứng chấp nhận offer với thời điểm hợp lệ.');
      }
      evidence = parsed.data;
    } else if (evidence) throw new ApiError(400, 'INVALID_EVIDENCE', 'Thao tác này không nhận bằng chứng từ client.');
    if (toStage === 'REJECTED' && application.current_stage === 'OFFER' && !['OFFER_DECLINED', 'OFFER_EXPIRED'].includes(payload.reason_code)) {
      throw new ApiError(400, 'INVALID_REASON', 'Từ chối tại OFFER cần lý do từ chối hoặc hết hạn offer.');
    }
    if (toStage === 'REJECTED' && application.current_stage !== 'OFFER' && ['OFFER_DECLINED', 'OFFER_EXPIRED'].includes(payload.reason_code)) {
      throw new ApiError(400, 'INVALID_REASON', 'Lý do này chỉ áp dụng tại bước offer.');
    }
    const check = isValidStageTransition(application.current_stage, toStage, user.role, { reasonCode: payload.reason_code, evidence });
    if (!check.valid) throw new ApiError(400, 'INVALID_TRANSITION', 'Không được chuyển tới trạng thái này hoặc còn thiếu lý do/bằng chứng.');
    const event = { from_stage: application.current_stage, to_stage: toStage, timestamp, actor_role: user.role,
      actor_id: recruiter?._id || user._id,
      ...(payload.reason_code ? { reason_code: payload.reason_code } : {}), ...(payload.note ? { note: payload.note } : {}), ...(evidence ? { evidence } : {}),
    };
    const document = { ...application, current_stage: toStage, updated_at: timestamp, stage_history: [...application.stage_history, event] };
    if (!validateStageHistory(document.stage_history, document.applied_at, document.current_stage, timestamp).valid) throw new ApiError(409, 'INVALID_HISTORY', 'Lịch sử hồ sơ không hợp lệ.');
    const validated = validateWrite(applicationDocumentSchema, document, {
      allowLegacyUnavailable: application.provenance?.classification === 'unavailable',
    });
    // Resolve response references before committing; a successful write must not
    // be followed by the first business validation of Candidate/User references.
    const response = await this.dto(validated, user.role);
    let saved;
    try {
      saved = await this.repo.put(validated, {
        allowLegacyUnavailable: application.provenance?.classification === 'unavailable',
      });
    }
    catch (error) {
      if (error.status === 409) await this.authorize(user, id); // Re-read scope; never overwrite the winning history.
      throw error;
    }
    return { ...response, _rev: saved._rev };
  }
}
