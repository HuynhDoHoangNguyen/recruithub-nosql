import { ApiError } from '../middleware/job-application.middleware.js';

const documentPath = id => id.startsWith('_design/')
  ? `_design/${encodeURIComponent(id.slice('_design/'.length))}` : encodeURIComponent(id);

export const recruitmentIndexes = [
  ['recruiter_jobs', ['type', 'recruiter_id', 'updated_at']],
  ['recruiter_jobs_status', ['type', 'recruiter_id', 'status', 'updated_at']],
  ['candidate_applications', ['type', 'candidate_id', 'applied_at']],
  ['candidate_applications_stage', ['type', 'candidate_id', 'current_stage', 'applied_at']],
  ['job_applications', ['type', 'job_id', 'applied_at']],
  ['job_applications_stage', ['type', 'job_id', 'current_stage', 'applied_at']],
  ['profile_user', ['type', 'user_id']],
  ['application_interviews', ['type', 'application_id']],
  ['public_jobs_created_v2', ['type', 'status', 'created_at', '_id']],
];
export const recruitmentDesign = {
  _id: '_design/job_application', language: 'javascript', views: {
    jobs_by_recruiter: { map: 'function(doc) { if(doc.type === "job" && !doc.deleted_at) emit([doc.recruiter_id, doc.status], 1); }', reduce: '_count' },
    job_ids_by_recruiter: { map: 'function(doc) { if(doc.type === "job" && !doc.deleted_at) emit(doc.recruiter_id, null); }' },
    applications_by_job_stage: { map: 'function(doc) { if(doc.type === "application") emit([doc.job_id, doc.current_stage], 1); }', reduce: '_count' },
    attempts_by_job: { map: 'function(doc) { if(doc.type === "application") emit(doc.job_id, doc.attempt_number || 1); }', reduce: '_sum' },
    attempts_by_candidate: { map: 'function(doc) { if(doc.type === "application") emit(doc.candidate_id, doc.attempt_number || 1); }', reduce: '_sum' },
    applications_by_candidate_stage: { map: 'function(doc) { if(doc.type === "application") emit([doc.candidate_id, doc.current_stage], 1); }', reduce: '_count' },
  },
};

export class JobApplicationRepository {
  constructor(config, request = fetch) {
    if (!config || !config.url || !config.database) {
      const error = new ApiError(503, 'AUTH_DATABASE_CONFIGURATION_ERROR', 'Job/Application persistence requires an explicit isolated database configuration.');
      throw error;
    }
    this.config = config;
    this.request = request;
  }
  async http(path, method = 'GET', body) {
    let response;
    try {
      response = await this.request(`${this.config.url}/${encodeURIComponent(this.config.database)}/${path}`, {
        method, headers: { ...(this.config.authHeader ? { Authorization: this.config.authHeader } : {}), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
      });
    } catch { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chưa kết nối được cơ sở dữ liệu.'); }
    if (response.status === 404) return null;
    if (response.status === 409) throw new ApiError(409, 'CONFLICT', 'Dữ liệu đã thay đổi. Vui lòng tải lại.');
    if (!response.ok) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể truy vấn cơ sở dữ liệu. Kiểm tra cấu hình và index.');
    return response.json();
  }
  get(id) { return this.http(documentPath(id)); }
  async put(document, { allowLegacyUnavailable = false } = {}) {
    const isLegacyUpdate = allowLegacyUnavailable && typeof document?._rev === 'string' && document._rev.length > 0;
    if (document?.provenance?.classification === 'unavailable' && !isLegacyUpdate) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'New documents cannot use unavailable provenance classification.');
    }
    const result = await this.http(documentPath(document._id), 'PUT', document);
    if (!result?.ok) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể lưu dữ liệu.');
    return { ...document, _rev: result.rev };
  }
  async find(selector, { limit = 20, bookmark, index, sort } = {}) {
    const result = await this.http('_find', 'POST', { selector, limit,
      ...(bookmark ? { bookmark } : {}), ...(index ? { use_index: index } : {}), ...(sort ? { sort } : {}),
    });
    if (!result) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database chưa được thiết lập.');
    if (result.docs.length < limit) return { items: result.docs, bookmark: result.bookmark, has_more: false };
    if (typeof result.bookmark !== 'string' || !result.bookmark) {
      throw new ApiError(503, 'PAGINATION_CURSOR_UNAVAILABLE', 'CouchDB did not return a pagination cursor.');
    }
    // A full page does not prove another page exists. Probe from the primary
    // query's bookmark and keep that original bookmark for the caller.
    const next = await this.http('_find', 'POST', {
      selector, limit: 1, bookmark: result.bookmark,
      ...(index ? { use_index: index } : {}), ...(sort ? { sort } : {}),
    });
    if (!next) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database is not initialized.');
    return { items: result.docs, bookmark: result.bookmark, has_more: next.docs.length > 0 };
  }
  async scanPublicJobs({ afterId, limit = 100 } = {}) {
    const params = new URLSearchParams({
      include_docs: 'true',
      startkey: JSON.stringify(afterId || 'job:'),
      endkey: JSON.stringify('job:\ufff0'),
      limit: String(limit),
      ...(afterId ? { skip: '1' } : {}),
    });
    const result = await this.http(`_all_docs?${params}`);
    if (!result || !Array.isArray(result.rows)) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể đọc danh sách việc làm.');
    return result.rows.filter(row => row.doc?.type === 'job').map(row => row.doc);
  }
  async profile(type, userId) {
    const result = await this.find({ type, user_id: userId }, { limit: 2, index: 'profile_user' });
    if (result.items.length !== 1) throw new ApiError(403, 'PROFILE_REQUIRED', 'Hồ sơ tài khoản chưa được thiết lập hợp lệ.');
    return result.items[0];
  }
  async allApplicationsForJob(jobId, { pageSize = 100 } = {}) {
    const items = [];
    const seenIds = new Set();
    let bookmark;
    while (true) {
      const page = await this.find(
        { type: 'application', job_id: jobId },
        { limit: pageSize, bookmark, index: 'job_applications' }
      );
      if (!page || !Array.isArray(page.items)) {
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể đọc danh sách hồ sơ ứng tuyển.');
      }
      let newCount = 0;
      for (const item of page.items) {
        if (item && typeof item._id === 'string' && !seenIds.has(item._id)) {
          seenIds.add(item._id);
          items.push(item);
          newCount++;
        }
      }
      if (page.has_more) {
        const nextBookmark = page.bookmark;
        const isStalledBookmark = typeof nextBookmark !== 'string' || !nextBookmark || nextBookmark === bookmark;
        const isStalledPage = page.items.length === 0 || newCount === 0;
        if (isStalledBookmark || isStalledPage) {
          throw new ApiError(
            503,
            'PAGINATION_CURSOR_UNAVAILABLE',
            'CouchDB pagination bookmark không tiến triển hoặc trùng lặp dữ liệu.'
          );
        }
        bookmark = nextBookmark;
      } else {
        break;
      }
    }
    return items;
  }
  async getMany(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return new Map();
    const uniqueIds = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0)));
    if (uniqueIds.length === 0) return new Map();
    const requestedSet = new Set(uniqueIds);
    const map = new Map();
    const chunkSize = 200;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const result = await this.http('_all_docs?include_docs=true', 'POST', { keys: chunk });
      if (!result || !Array.isArray(result.rows)) {
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể đọc dữ liệu hàng loạt.');
      }
      for (const row of result.rows) {
        if (row?.doc && !row.error && !row.value?.deleted && requestedSet.has(row.doc._id)) {
          map.set(row.doc._id, row.doc);
        }
      }
    }
    return map;
  }
  async allInterviews(applicationId) {
    const items = [];
    let bookmark;
    while (true) {
      const page = await this.find({ type: 'interview', application_id: applicationId }, { limit: 100, bookmark, index: 'application_interviews' });
      items.push(...page.items);
      if (!page.has_more || page.bookmark === bookmark) break;
      bookmark = page.bookmark;
    }
    return items;
  }
  async view(name, query) {
    const result = await this.http(`_design/job_application/_view/${name}${query.group ? '?group=true' : ''}`, 'POST', { keys: query.keys });
    if (!result) throw new ApiError(503, 'DATABASE_NOT_INITIALIZED', 'Cần thiết lập index và view cho phân hệ tuyển dụng.');
    return result.rows;
  }
  async stats(recruiterId) {
    const jobs = await this.http(`_design/job_application/_view/jobs_by_recruiter?group=true&startkey=${encodeURIComponent(JSON.stringify([recruiterId]))}&endkey=${encodeURIComponent(JSON.stringify([recruiterId, {}]))}`);
    if (!jobs) throw new ApiError(503, 'DATABASE_NOT_INITIALIZED', 'Cần thiết lập index và view cho phân hệ tuyển dụng.');
    const jobRows = await this.view('job_ids_by_recruiter', { keys: [recruiterId] });
    const byStage = {};
    let total_attempts = 0;
    const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];
    // Only IDs and reduced counts cross the database boundary; never full candidate collections.
    for (let offset = 0; offset < jobRows.length; offset += 100) {
      const keys = jobRows.slice(offset, offset + 100).flatMap(row => stages.map(stage => [row.id, stage]));
      const counts = await this.view('applications_by_job_stage', { keys, group: true });
      const attempts = await this.view('attempts_by_job', { keys: jobRows.slice(offset, offset + 100).map(row => row.id), group: true });
      total_attempts += attempts.reduce((sum, row) => sum + row.value, 0);
      for (const row of counts) byStage[row.key[1]] = (byStage[row.key[1]] || 0) + row.value;
    }
    const total_applications = Object.values(byStage).reduce((sum, count) => sum + count, 0);
    return { jobs: Object.fromEntries(jobs.rows.map(row => [row.key[1], row.value])), applications: byStage,
      total_applications, total_attempts, historical_attempts: total_attempts - total_applications };
  }
  async candidateStats(candidateId) {
    const result = await this.http(`_design/job_application/_view/applications_by_candidate_stage?group=true&startkey=${encodeURIComponent(JSON.stringify([candidateId]))}&endkey=${encodeURIComponent(JSON.stringify([candidateId, {}]))}`);
    if (!result) throw new ApiError(503, 'DATABASE_NOT_INITIALIZED', 'Cần thiết lập view thống kê hồ sơ ứng tuyển.');
    const by_stage = Object.fromEntries(result.rows.map(row => [row.key[1], row.value]));
    const total_applications = Object.values(by_stage).reduce((sum, count) => sum + count, 0);
    const attempts = await this.view('attempts_by_candidate', { group: true, keys: [candidateId] });
    const total_attempts = attempts.reduce((sum, row) => sum + row.value, 0);
    return { by_stage, total_applications, total_attempts, historical_attempts: total_attempts - total_applications };
  }
  async initialize() {
    for (const [name, fields] of recruitmentIndexes) await this.http('_index', 'POST', { index: { fields }, ddoc: name, name, type: 'json' });
    const old = await this.get(recruitmentDesign._id);
    if (!old || JSON.stringify(old.views) !== JSON.stringify(recruitmentDesign.views)) {
      await this.put({ ...recruitmentDesign, ...(old ? { _rev: old._rev } : {}) });
    }
  }
}
