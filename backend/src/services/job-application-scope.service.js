import { ApiError } from '../middleware/job-application.middleware.js';
import { candidateDocumentSchema } from '../schemas/candidate.schema.js';
import { jobDocumentSchema } from '../schemas/job.schema.js';
import { validateRecruiterOrganizationScope } from '../schemas/recruiter.schema.js';

export function parseStored(schema, doc) {
  const parsed = schema.safeParse(doc);
  if (!parsed.success) throw new ApiError(409, 'INVALID_STORED_DOCUMENT', 'Dữ liệu lưu trữ không đúng hợp đồng. Cần kiểm tra tham chiếu.');
  return parsed.data;
}
export async function requireDocument(repo, id, type) {
  const doc = await repo.get(id);
  if (!doc || doc.type !== type) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
  return doc;
}
export function assertActiveRole(user, role) {
  if (user?.account_status !== 'ACTIVE' || user?.role !== role) throw new ApiError(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.');
}
export async function candidateScope(repo, user) {
  assertActiveRole(user, 'CANDIDATE');
  const candidate = parseStored(candidateDocumentSchema, await repo.profile('candidate', user._id));
  if (candidate.user_id !== user._id) throw new ApiError(403, 'FORBIDDEN', 'Hồ sơ không thuộc tài khoản.');
  return candidate;
}
export async function recruiterScope(repo, user) {
  assertActiveRole(user, 'RECRUITER');
  const recruiter = await repo.profile('recruiter', user._id);
  await validateOrganization(repo, recruiter, user);
  return recruiter;
}
async function validateOrganization(repo, recruiter, user) {
  const [company, department] = await Promise.all([
    requireDocument(repo, recruiter.company_id, 'company'), requireDocument(repo, recruiter.department_id, 'department'),
  ]);
  if (!validateRecruiterOrganizationScope({ recruiter, company, department, user }).valid) {
    throw new ApiError(403, 'INVALID_SCOPE', 'Tham chiếu công ty, phòng ban hoặc nhà tuyển dụng không hợp lệ.');
  }
}
export async function validateJobReferences(repo, job) {
  parseStored(jobDocumentSchema, job);
  const recruiter = await requireDocument(repo, job.recruiter_id, 'recruiter');
  const user = await requireDocument(repo, recruiter.user_id, 'user');
  await validateOrganization(repo, recruiter, user);
  if (recruiter.company_id !== job.company_id || recruiter.department_id !== job.department_id) {
    throw new ApiError(409, 'INVALID_SCOPE', 'Tin tuyển dụng không khớp phạm vi nhà tuyển dụng.');
  }
}
export async function ownedJob(repo, user, id) {
  const recruiter = await recruiterScope(repo, user);
  const job = parseStored(jobDocumentSchema, await requireDocument(repo, id, 'job'));
  if (job.recruiter_id !== recruiter._id || job.company_id !== recruiter.company_id || job.department_id !== recruiter.department_id) {
    throw new ApiError(403, 'FORBIDDEN', 'Tin tuyển dụng không thuộc phạm vi của bạn.');
  }
  return { job, recruiter };
}
export function candidateDto(candidate) {
  return Object.fromEntries(['_id', 'profile', 'skills', 'education', 'experience_summary', 'experience', 'projects', 'data_availability']
    .filter(key => candidate[key] !== undefined).map(key => [key, candidate[key]]));
}
export function publicJobDto(job) {
  return Object.fromEntries(['_id', 'title', 'seniority', 'industry', 'description', 'responsibilities', 'requirements', 'required_skills',
    'optional_skills', 'status', 'deadline', 'published_at', 'created_at', 'updated_at'].filter(key => job[key] !== undefined).map(key => [key, job[key]]));
}
export const runtimeProvenance = fields => ({ classification: 'derived', generated: false,
  transform_version: 'job-application-v1', field_origins: Object.fromEntries(fields.map(field => [field, 'user_input'])) });
export const descendingSort = fields => fields.map(field => ({ [field]: 'desc' }));
