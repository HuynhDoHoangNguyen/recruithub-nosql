import { randomUUID } from 'node:crypto';
import { jobDocumentSchema } from '../schemas/job.schema.js';
import { ApiError } from '../middleware/job-application.middleware.js';
import { descendingSort, ownedJob, parseStored, publicJobDto, recruiterScope, requireDocument, runtimeProvenance } from './job-application-scope.service.js';

export function validateWrite(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.',
    result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
  return result.data;
}

export class JobService {
  constructor(repository, now = () => new Date()) { this.repo = repository; this.now = now; }
  async context(user) {
    const recruiter = await recruiterScope(this.repo, user);
    const company = await requireDocument(this.repo, recruiter.company_id, 'company');
    const department = await requireDocument(this.repo, recruiter.department_id, 'department');
    return { recruiter_id: recruiter._id, email: user.email,
      company: { _id: company._id, name: company.name, industry: company.industry },
      department: { _id: department._id, name: department.name } };
  }
  checkOpen(job) {
    if (job.status === 'OPEN' && (!job.deadline || !Number.isFinite(Date.parse(job.deadline)) || Date.parse(job.deadline) <= this.now().getTime())) {
      throw new ApiError(400, 'INVALID_DEADLINE', 'Hạn nộp hồ sơ phải sau thời điểm hiện tại.', [{ field: 'deadline', message: 'Chọn hạn nộp trong tương lai.' }]);
    }
  }
  async create(user, payload) {
    const recruiter = await recruiterScope(this.repo, user);
    const timestamp = this.now().toISOString();
    const document = { ...payload, _id: `job:${randomUUID()}`, type: 'job',
      recruiter_id: recruiter._id, company_id: recruiter.company_id, department_id: recruiter.department_id,
      created_at: timestamp, updated_at: timestamp, ...(payload.status === 'OPEN' ? { published_at: timestamp } : {}),
      provenance: runtimeProvenance(Object.keys(payload)),
    };
    this.checkOpen(document);
    return this.repo.put(validateWrite(jobDocumentSchema, document));
  }
  async list(user, query) {
    const recruiter = await recruiterScope(this.repo, user);
    const fields = ['type', 'recruiter_id', ...(query.status ? ['status'] : []), 'updated_at'];
    return this.repo.find({ type: 'job', recruiter_id: recruiter._id, ...(query.status ? { status: query.status } : {}) },
      { ...query, index: query.status ? 'recruiter_jobs_status' : 'recruiter_jobs', sort: descendingSort(fields) });
  }
  async detail(user, id) { return (await ownedJob(this.repo, user, id)).job; }
  async stats(user) { return this.repo.stats((await recruiterScope(this.repo, user))._id); }
  async update(user, id, payload, statusOnly = false) {
    const { job } = await ownedJob(this.repo, user, id);
    if (job._rev !== payload.expected_rev) throw new ApiError(409, 'CONFLICT', 'Tin tuyển dụng đã thay đổi. Vui lòng tải lại.');
    if (job.status === 'CLOSED') throw new ApiError(409, 'JOB_CLOSED', 'Tin đã đóng không thể sửa hoặc mở lại.');
    if (statusOnly && !((job.status === 'DRAFT' && ['OPEN', 'CLOSED'].includes(payload.status)) || (job.status === 'OPEN' && payload.status === 'CLOSED'))) {
      throw new ApiError(400, 'INVALID_JOB_STATUS', 'Thay đổi trạng thái tin không hợp lệ.');
    }
    const { expected_rev, ...changes } = payload;
    const document = { ...job, ...changes, updated_at: new Date(Math.max(this.now().getTime(), Date.parse(job.updated_at) + 1)).toISOString(),
      ...(job.status === 'DRAFT' && changes.status === 'OPEN' ? { published_at: this.now().toISOString() } : {}),
      provenance: { ...job.provenance, classification: 'mixed', transform_version: 'job-application-v1',
        field_origins: { ...job.provenance.field_origins, ...runtimeProvenance(Object.keys(changes)).field_origins } },
    };
    this.checkOpen(document);
    try { return await this.repo.put(validateWrite(jobDocumentSchema, document)); }
    catch (error) {
      if (error.status === 409) await ownedJob(this.repo, user, id);
      throw error;
    }
  }
  async publicList(query) {
    // Historical jobs have no published_at. created_at is required by the schema;
    // _id provides a stable order when several jobs share the same timestamp.
    const page = await this.repo.find({ type: 'job', status: 'OPEN', created_at: { $gte: '' }, _id: { $gte: '' } },
      { ...query, index: 'public_jobs_created_v2', sort: descendingSort(['type', 'status', 'created_at', '_id']) });
    const companies = new Map(await Promise.all([...new Set(page.items.map(job => job.company_id))].map(async id => [id, await this.repo.get(id)])));
    return { ...page, items: page.items.map(job => ({ ...publicJobDto(job),
      ...(companies.get(job.company_id)?.type === 'company' ? { company_name: companies.get(job.company_id).name } : {}) })) };
  }
  async publicDetail(id) {
    const job = parseStored(jobDocumentSchema, await requireDocument(this.repo, id, 'job'));
    if (job.status === 'DRAFT') throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tin tuyển dụng công khai.');
    const company = await requireDocument(this.repo, job.company_id, 'company');
    return { ...publicJobDto(job), company_name: company.name };
  }
}
