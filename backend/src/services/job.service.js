import { createHash, randomUUID } from 'node:crypto';
import { JOB_LOCATIONS, WORK_MODES, SENIORITIES, EMPLOYMENT_TYPES } from '../constants/job-catalog.constants.js';
import { jobDocumentSchema } from '../schemas/job.schema.js';
import { companyDocumentSchema } from '../schemas/company.schema.js';
import { ApiError } from '../middleware/job-application.middleware.js';
import { descendingSort, ownedJob, parseStored, publicJobDto, recruiterScope, requireDocument, runtimeProvenance } from './job-application-scope.service.js';
import { normalizeSkill } from '../utils/normalization.utils.js';
import { companyLogoUrl } from '../schemas/upload.schema.js';

const publicFilterKey = query => createHash('sha256').update(JSON.stringify({
  q: query.q.toLocaleLowerCase(), industry: query.industry.toLocaleLowerCase(), seniority: query.seniority || '', skills: query.skills, location: query.location || '', work_mode: query.work_mode || '',
})).digest('hex');
const encodePublicCursor = (id, filterKey) => Buffer.from(JSON.stringify({ version: 1, id, filterKey })).toString('base64url');

function decodePublicCursor(bookmark, filterKey) {
  if (!bookmark) return undefined;
  try {
    const cursor = JSON.parse(Buffer.from(bookmark, 'base64url').toString('utf8'));
    if (cursor.version !== 1 || cursor.filterKey !== filterKey || typeof cursor.id !== 'string' || !/^job:[a-z0-9:_-]+$/i.test(cursor.id)) throw new Error();
    return cursor.id;
  } catch {
    throw new ApiError(400, 'INVALID_BOOKMARK', 'Con trỏ trang không hợp lệ hoặc không khớp bộ lọc.');
  }
}

function matchesPublicFilters(job, query) {
  if (job.status !== 'OPEN' || job.deleted_at) return false;
  if (query.industry && job.industry.toLocaleLowerCase() !== query.industry.toLocaleLowerCase()) return false;
  if (query.seniority && job.seniority !== query.seniority) return false;
  if (query.location && job.location !== query.location) return false;
  if (query.work_mode && job.work_mode !== query.work_mode) return false;
  const skills = [...(job.required_skills || []), ...(job.optional_skills || [])].map(normalizeSkill);
  if (query.skills.some(skill => !skills.includes(skill))) return false;
  const term = query.q.toLocaleLowerCase();
  if (!term) return true;
  return [job.title, job.industry, job.description, ...(job.responsibilities || []), ...skills]
    .some(value => value.toLocaleLowerCase().includes(term));
}

export function validateWrite(schema, value, { allowLegacyUnavailable = false } = {}) {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.',
    result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
  const isLegacyUpdate = allowLegacyUnavailable && typeof value._rev === 'string' && value._rev.length > 0;
  if (value.provenance?.classification === 'unavailable' && !isLegacyUpdate) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'New documents cannot use unavailable provenance classification.', [
      { field: 'provenance.classification', message: 'Use source, normalized, derived, synthetic, or mixed.' },
    ]);
  }
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
  async create(user, payload, { documentId } = {}) {
    const recruiter = await recruiterScope(this.repo, user);
    const timestamp = this.now().toISOString();
    const document = { ...payload, _id: documentId || `job:${randomUUID()}`, type: 'job',
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
    const page = await this.repo.find({ type: 'job', recruiter_id: recruiter._id, deleted_at: { $exists: false }, ...(query.status ? { status: query.status } : {}) },
      { ...query, index: query.status ? 'recruiter_jobs_status' : 'recruiter_jobs', sort: descendingSort(fields) });
    const company = await requireDocument(this.repo, recruiter.company_id, 'company');
    return { ...page, items: page.items.map(job => ({ ...job, location_label: JOB_LOCATIONS.find(option => option.value === job.location)?.label,
      work_mode_label: WORK_MODES.find(option => option.value === job.work_mode)?.label, company_name: company.name, company_logo_url: companyLogoUrl(company) })) };
  }
  async detail(user, id) { return (await ownedJob(this.repo, user, id)).job; }
  async stats(user) { return this.repo.stats((await recruiterScope(this.repo, user))._id); }
  async update(user, id, payload, statusOnly = false) {
    const { job } = await ownedJob(this.repo, user, id);
    if (job.deleted_at) throw new ApiError(409, 'JOB_DELETED', 'Tin đã xóa không thể sửa hoặc mở lại.');
    if (job._rev !== payload.expected_rev) throw new ApiError(409, 'CONFLICT', 'Tin tuyển dụng đã thay đổi. Vui lòng tải lại.');
    if (job.status === 'CLOSED' && !(statusOnly && payload.status === 'OPEN')) throw new ApiError(409, 'JOB_CLOSED', 'Tin đã đóng chỉ được mở lại bằng hành động mở tin.');
    if (statusOnly && !((job.status === 'DRAFT' && ['OPEN', 'CLOSED'].includes(payload.status)) || (job.status === 'OPEN' && payload.status === 'CLOSED') || (job.status === 'CLOSED' && payload.status === 'OPEN'))) {
      throw new ApiError(400, 'INVALID_JOB_STATUS', 'Thay đổi trạng thái tin không hợp lệ.');
    }
    const { expected_rev, ...changes } = payload;
    const document = { ...job, ...changes, updated_at: new Date(Math.max(this.now().getTime(), Date.parse(job.updated_at) + 1)).toISOString(),
      ...(job.status === 'DRAFT' && changes.status === 'OPEN' ? { published_at: this.now().toISOString() } : {}),
      provenance: { ...job.provenance,
        classification: job.provenance?.classification === 'unavailable' ? 'unavailable' : 'mixed',
        transform_version: 'job-application-v1',
        field_origins: { ...job.provenance.field_origins, ...runtimeProvenance(Object.keys(changes)).field_origins } },
    };
    this.checkOpen(document);
    try {
      return await this.repo.put(validateWrite(jobDocumentSchema, document, {
        allowLegacyUnavailable: job.provenance?.classification === 'unavailable',
      }), { allowLegacyUnavailable: job.provenance?.classification === 'unavailable' });
    }
    catch (error) {
      if (error.status === 409) await ownedJob(this.repo, user, id);
      throw error;
    }
  }
  async remove(user, id, payload) {
    const { job } = await ownedJob(this.repo, user, id);
    if (job.deleted_at) return { _id: id, _rev: job._rev, deleted: true };
    if (job._rev !== payload.expected_rev) throw new ApiError(409, 'CONFLICT', 'Tin đã thay đổi. Vui lòng tải lại trước khi xóa.');
    const timestamp = new Date(Math.max(this.now().getTime(), Date.parse(job.updated_at) + 1)).toISOString();
    const options = { allowLegacyUnavailable: job.provenance?.classification === 'unavailable' };
    const document = validateWrite(jobDocumentSchema, { ...job, status: 'CLOSED', deleted_at: timestamp, updated_at: timestamp }, options);
    const saved = await this.repo.put(document, options);
    return { _id: saved._id, _rev: saved._rev, deleted: true };
  }
  async publicList(query) {
    query = { q: '', industry: '', skills: [], limit: 20, ...query };
    const enrich = async items => {
      const companies = new Map(await Promise.all([...new Set(items.map(job => job.company_id))].map(async id => [id, await this.repo.get(id)])));
      return items.map(job => ({ ...publicJobDto(job),
        ...(companies.get(job.company_id)?.type === 'company' ? { company_name: companies.get(job.company_id).name, company_logo_url: companyLogoUrl(companies.get(job.company_id)) } : {}) }));
    };
    // Preserve the accepted newest-first listing, including historical jobs
    // without published_at. Filtered searches retain dev's literal search/cursor.
    if (!query.q && !query.industry && !query.seniority && !query.location && !query.work_mode && !query.skills.length) {
      const filterKey = publicFilterKey(query);
      let bookmark;
      if (query.bookmark) {
        try {
          const cursor = JSON.parse(Buffer.from(query.bookmark, 'base64url').toString('utf8'));
          if (cursor.version !== 1 || cursor.filterKey !== filterKey || typeof cursor.bookmark !== 'string' || !cursor.bookmark) throw new Error();
          bookmark = cursor.bookmark;
        } catch { throw new ApiError(400, 'INVALID_BOOKMARK', 'Con trỏ trang không hợp lệ hoặc không khớp bộ lọc.'); }
      }
      const page = await this.repo.find({ type: 'job', status: 'OPEN', created_at: { $gte: '' }, _id: { $gte: '' } },
        { ...query, bookmark, index: 'public_jobs_created_v2', sort: descendingSort(['type', 'status', 'created_at', '_id']) });
      return { ...page, bookmark: page.has_more ? Buffer.from(JSON.stringify({ version: 1, bookmark: page.bookmark, filterKey })).toString('base64url') : undefined,
        items: await enrich(page.items) };
    }
    if (typeof this.repo.scanPublicJobs !== 'function') throw new ApiError(503, 'PUBLIC_SEARCH_UNAVAILABLE', 'Kho việc làm chưa hỗ trợ tìm kiếm theo hợp đồng.');
    const filterKey = publicFilterKey(query);
    let afterId = decodePublicCursor(query.bookmark, filterKey);
    const items = [];
    let exhausted = false;
    while (items.length <= query.limit && !exhausted) {
      const batch = await this.repo.scanPublicJobs({ afterId, limit: 100 });
      if (!batch.length) { exhausted = true; break; }
      for (const job of batch) {
        afterId = job._id;
        if (matchesPublicFilters(job, query)) items.push(job);
        if (items.length > query.limit) break;
      }
      if (batch.length < 100 || items.length > query.limit) exhausted = batch.length < 100;
    }
    const hasMore = items.length > query.limit;
    const pageItems = items.slice(0, query.limit);
    return {
      items: await enrich(pageItems),
      has_more: hasMore,
      ...(hasMore && pageItems.length ? { bookmark: encodePublicCursor(pageItems.at(-1)._id, filterKey) } : {}),
    };
  }
  async metadata() {
    const skills = new Set(); const industries = new Set();
    let afterId;
    while (true) {
      const batch = await this.repo.scanPublicJobs({ afterId, limit: 100 });
      for (const job of batch) if (job.status === 'OPEN' && !job.deleted_at) {
        if (job.industry) industries.add(job.industry);
        for (const skill of [...(job.required_skills || []), ...(job.optional_skills || [])]) skills.add(normalizeSkill(skill));
      }
      if (batch.length < 100) break;
      afterId = batch.at(-1)._id;
    }
    return { locations: JOB_LOCATIONS, work_modes: WORK_MODES, employment_types: EMPLOYMENT_TYPES, seniorities: SENIORITIES,
      skills: [...skills].sort(), industries: [...industries].sort(), skills_operator: 'AND' };
  }
  async publicDetail(id) {
    const job = parseStored(jobDocumentSchema, await requireDocument(this.repo, id, 'job'));

    if (job.status !== 'OPEN') throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tin tuyển dụng công khai.');

    let companyDocument = null;
    try {
      companyDocument = await this.repo.get(job.company_id);
    } catch (error) {
      if (error.code !== 'NOT_FOUND' && error.status !== 404) throw error;
    }
    const parsedCompany = companyDocument?._id === job.company_id && companyDocument?.type === 'company'
      ? companyDocumentSchema.safeParse(companyDocument)
      : null;
    let website;
    if (parsedCompany?.success && parsedCompany.data.website) {
      try {
        const parsedUrl = new URL(parsedCompany.data.website);
        if (['http:', 'https:'].includes(parsedUrl.protocol)) website = parsedUrl.toString();
      } catch { /* Omit malformed external links from the public DTO. */ }
    }
    const company = parsedCompany?.success
      ? {
        name: parsedCompany.data.name,
        industry: parsedCompany.data.industry,
        ...(website ? { website } : {}),
      }
      : null;
    const logoUrl = parsedCompany?.success ? companyLogoUrl(parsedCompany.data) : undefined;

    return {
      ...publicJobDto(job),
      ...(job.location ? { location_label: JOB_LOCATIONS.find(option => option.value === job.location)?.label } : {}),
      ...(job.work_mode ? { work_mode_label: WORK_MODES.find(option => option.value === job.work_mode)?.label } : {}),
      company,
      ...(company ? { company_name: company.name } : {}),
      ...(logoUrl ? { company_logo_url: logoUrl } : {}),
    };
  }
}
