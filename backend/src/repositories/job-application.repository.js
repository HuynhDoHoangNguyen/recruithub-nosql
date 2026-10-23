import { loadCouchDbConfig } from '../../../scripts/database/couchdb-client.js';
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
  ['public_jobs', ['type', 'status', 'published_at']],
];
export const recruitmentDesign = {
  _id: '_design/job_application', language: 'javascript', views: {
    jobs_by_recruiter: { map: 'function(doc) { if(doc.type === "job") emit([doc.recruiter_id, doc.status], 1); }', reduce: '_count' },
    job_ids_by_recruiter: { map: 'function(doc) { if(doc.type === "job") emit(doc.recruiter_id, null); }' },
    applications_by_job_stage: { map: 'function(doc) { if(doc.type === "application") emit([doc.job_id, doc.current_stage], 1); }', reduce: '_count' },
  },
};

export class JobApplicationRepository {
  constructor(config = loadCouchDbConfig(), request = fetch) {
    this.config = config;
    this.request = request;
  }
  async http(path, method = 'GET', body) {
    let response;
    try {
      response = await this.request(`${this.config.url}/${encodeURIComponent(this.config.database)}/${path}`, {
        method, headers: { Authorization: this.config.authHeader, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
      });
    } catch { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chưa kết nối được cơ sở dữ liệu.'); }
    if (response.status === 404) return null;
    if (response.status === 409) throw new ApiError(409, 'CONFLICT', 'Dữ liệu đã thay đổi. Vui lòng tải lại.');
    if (!response.ok) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể truy vấn cơ sở dữ liệu. Kiểm tra cấu hình và index.');
    return response.json();
  }
  get(id) { return this.http(documentPath(id)); }
  async put(document) {
    const result = await this.http(documentPath(document._id), 'PUT', document);
    if (!result?.ok) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không thể lưu dữ liệu.');
    return { ...document, _rev: result.rev };
  }
  async find(selector, { limit = 20, bookmark, index, sort } = {}) {
    const result = await this.http('_find', 'POST', { selector, limit,
      ...(bookmark ? { bookmark } : {}), ...(index ? { use_index: index } : {}), ...(sort ? { sort } : {}),
    });
    if (!result) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database chưa được thiết lập.');
    return { items: result.docs, bookmark: result.bookmark, has_more: result.docs.length === limit };
  }
  async profile(type, userId) {
    const result = await this.find({ type, user_id: userId }, { limit: 2, index: 'profile_user' });
    if (result.items.length !== 1) throw new ApiError(403, 'PROFILE_REQUIRED', 'Hồ sơ tài khoản chưa được thiết lập hợp lệ.');
    return result.items[0];
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
    const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];
    // Only IDs and reduced counts cross the database boundary; never full candidate collections.
    for (let offset = 0; offset < jobRows.length; offset += 100) {
      const keys = jobRows.slice(offset, offset + 100).flatMap(row => stages.map(stage => [row.id, stage]));
      const counts = await this.view('applications_by_job_stage', { keys, group: true });
      for (const row of counts) byStage[row.key[1]] = (byStage[row.key[1]] || 0) + row.value;
    }
    return { jobs: Object.fromEntries(jobs.rows.map(row => [row.key[1], row.value])), applications: byStage,
      total_applications: Object.values(byStage).reduce((sum, count) => sum + count, 0) };
  }
  async initialize() {
    for (const [name, fields] of recruitmentIndexes) await this.http('_index', 'POST', { index: { fields }, ddoc: name, name, type: 'json' });
    const old = await this.get(recruitmentDesign._id);
    if (!old || JSON.stringify(old.views) !== JSON.stringify(recruitmentDesign.views)) {
      await this.put({ ...recruitmentDesign, ...(old ? { _rev: old._rev } : {}) });
    }
  }
}
