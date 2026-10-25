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
import { resolveOwnedAsset } from './upload.service.js';
import { companyLogoUrl } from '../schemas/upload.schema.js';

const archiveAttempt = application => ({
  attempt_number: application.attempt_number || 1,
  ...Object.fromEntries(['current_stage', 'stage_history', 'applied_at', 'updated_at', 'submission', 'recruiter_note', 'request_id']
    .filter(key => application[key] !== undefined).map(key => [key, application[key]])),
});
const submissionIntent = submission => JSON.stringify({ resume_text: submission?.resume_text, cover_letter: submission?.cover_letter,
  resume_file_id: submission?.resume_file_id || submission?.resume_file?.asset_id });

export class ApplicationService {
  constructor(repository, { now = () => new Date(), analyzeApplication, assets = repository } = {}) {
    this.repo = repository; this.now = now; this.analyzeApplication = analyzeApplication; this.assets = assets;
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
    const existingValue = await this.repo.get(id);
    const existing = existingValue ? parseStored(applicationDocumentSchema, existingValue) : null;
    // Recover a committed request before checking current Job eligibility. This
    // also prevents a delayed retry after a later withdrawal creating an attempt.
    if (existing && payload.request_id === existing.request_id && payload.request_id) {
      if (submissionIntent(existing.submission) !== submissionIntent(payload.submission)) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Mã yêu cầu này đã dùng cho một CV khác. Vui lòng tải lại.');
      return this.dto(existing, 'CANDIDATE');
    }
    if (existing?.previous_attempts?.some(attempt => attempt.request_id === payload.request_id && payload.request_id)) {
      throw new ApiError(409, 'REQUEST_ALREADY_PROCESSED', 'Lần nộp này đã được xử lý. Vui lòng tải lại hồ sơ.');
    }
    if (existing && existing.current_stage !== 'WITHDRAWN') throw new ApiError(409, 'DUPLICATE_APPLICATION', 'Bạn đã có hồ sơ cho vị trí này. Chỉ hồ sơ đã rút mới được nộp lại.');
    if (existing && (!payload.request_id || payload.expected_rev !== existing._rev)) throw new ApiError(409, 'CONFLICT', 'Hồ sơ đã thay đổi. Vui lòng tải lại trước khi nộp lại.');
    const job = await requireDocument(this.repo, payload.job_id, 'job');
    await validateJobReferences(this.repo, job);
    const appliedAt = new Date(Math.max(this.now().getTime(), existing ? Date.parse(existing.updated_at) + 1 : 0)).toISOString();
    const check = validateApplicationCreationScope({ candidate, job, user, appliedAt });
    if (!check.valid) throw new ApiError(400, 'JOB_NOT_ELIGIBLE', 'Tin chưa mở, đã đóng hoặc đã quá hạn nộp hồ sơ.');
    const { resume_file_id, ...submission } = payload.submission;
    if (resume_file_id) submission.resume_file = await resolveOwnedAsset(this.assets, resume_file_id, user._id, 'resume');
    const document = validateWrite(applicationDocumentSchema, {
      _id: id, type: 'application', candidate_id: candidate._id, job_id: job._id,
      current_stage: 'APPLIED', applied_at: appliedAt, updated_at: appliedAt, submission,
      stage_history: [{ from_stage: null, to_stage: 'APPLIED', timestamp: appliedAt, actor_role: 'CANDIDATE', actor_id: user._id }],
      provenance: runtimeProvenance(['submission']),
      ...(payload.request_id ? { request_id: payload.request_id } : {}),
      ...(existing ? { _rev: existing._rev, attempt_number: (existing.attempt_number || 1) + 1,
        previous_attempts: [...(existing.previous_attempts || []), archiveAttempt(existing)] } : {}),
    });
    const response = await this.dto(document, 'CANDIDATE');
    let saved;
    try { saved = await this.repo.put(document); }
    catch (error) {
      if (error.status === 409) {
        const winner = await this.repo.get(id);
        if (payload.request_id && winner?.request_id === payload.request_id && submissionIntent(winner.submission) === submissionIntent(payload.submission)) return this.dto(parseStored(applicationDocumentSchema, winner), 'CANDIDATE');
        throw new ApiError(409, 'DUPLICATE_APPLICATION', 'Hồ sơ đã được cập nhật bởi một yêu cầu khác. Vui lòng tải lại.');
      }
      throw error;
    }
    let analysisStatus = 'NOT_ANALYZED';
    if (this.analyzeApplication) {
      try { await this.analyzeApplication(saved._id, { attempt_number: document.attempt_number || 1, submission: document.submission }); analysisStatus = 'REQUESTED'; }
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
    const company = await requireDocument(this.repo, job.company_id, 'company');
    return { ...page, job: { ...publicJobDto(job), _rev: job._rev, company_name: company.name, company_logo_url: companyLogoUrl(company) }, items: await Promise.all(page.items.map(application => this.dto(application, 'RECRUITER'))) };
  }
  async dto(application, role) {
    const fields = ['_id', '_rev', 'candidate_id', 'job_id', 'current_stage', 'applied_at', 'updated_at', 'submission'];
    const result = Object.fromEntries(fields.filter(key => application[key] !== undefined).map(key => [key, application[key]]));
    const job = await this.repo.get(application.job_id);
    result.job = job?.type === 'job' ? publicJobDto(job) : null;
    if (result.job) {
      const company = await this.repo.get(job.company_id);
      if (company?.type === 'company') { result.job.company_name = company.name; result.job.company_logo_url = companyLogoUrl(company); }
    }
    result.stage_history = application.stage_history.map(event => role === 'RECRUITER' ? event : {
      from_stage: event.from_stage, to_stage: event.to_stage, timestamp: event.timestamp, actor_role: event.actor_role,
    });
    result.attempt_number = application.attempt_number || 1;
    result.previous_attempts = (application.previous_attempts || []).map(attempt => ({
      attempt_number: attempt.attempt_number, current_stage: attempt.current_stage,
      applied_at: attempt.applied_at, updated_at: attempt.updated_at, submission: attempt.submission,
      ...(role === 'RECRUITER' && attempt.recruiter_note ? { recruiter_note: attempt.recruiter_note } : {}),
      stage_history: attempt.stage_history.map(event => role === 'RECRUITER' ? event : {
        from_stage: event.from_stage, to_stage: event.to_stage, timestamp: event.timestamp, actor_role: event.actor_role,
      }),
    }));
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
        const { interviews, valid } = await this.offerEvidence(application, job ? await this.repo.get(job.recruiter_id) : null);
        result.interview_status = interviews.length ? 'RECORDED' : 'SCHEDULING_REQUIRED';
        result.offer_eligible = valid;
        if (!valid) result.offer_blocker = 'Cần hoàn tất các vòng phỏng vấn hợp lệ của lần ứng tuyển hiện tại trước khi gửi đề nghị.';
      }
    }
    return result;
  }
  async currentInterviews(application) {
    const attempt = application.attempt_number || 1;
    return (await this.repo.allInterviews(application._id)).filter(interview => (interview.application_attempt || 1) === attempt);
  }
  async offerEvidence(application, recruiter, timestamp = this.now().toISOString()) {
    const interviews = await this.currentInterviews(application);
    const enteredAt = application.stage_history.find(event => event.to_stage === 'INTERVIEW')?.timestamp;
    const valid = !!recruiter && validateInterviewEvidenceForOffer({ interviews, applicationId: application._id, applicationAttempt: application.attempt_number || 1 }).valid && interviews.every(interview =>
      interviewDocumentSchema.safeParse(interview).success && interview.candidate_id === application.candidate_id && interview.job_id === application.job_id &&
      [recruiter._id, recruiter.user_id].includes(interview.interviewer_id) && Date.parse(interview.completed_at) <= Date.parse(timestamp) &&
      validateInterviewTimeline({ scheduledAt: interview.scheduled_at, completedAt: interview.completed_at, interviewStageAt: enteredAt }).valid);
    return { interviews, valid };
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
      const { interviews, valid } = await this.offerEvidence(application, recruiter, timestamp);
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
