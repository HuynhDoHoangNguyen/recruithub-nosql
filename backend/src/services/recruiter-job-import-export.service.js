import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../middleware/job-application.middleware.js';
import { createJobRequestSchema } from '../schemas/job-application-request.schema.js';
import { parseJobImportFile, serializeJobsCsv, jsonTemplate, csvTemplate, JOB_IMPORT_FIELDS } from '../utils/job-import-export.js';

const MAX_EXPORT = 5000;
const tokenSecret = env => {
  if (typeof env.JWT_ACCESS_SECRET !== 'string' || env.JWT_ACCESS_SECRET.length < 32) throw new ApiError(503, 'IMPORT_EXPORT_NOT_CONFIGURED', 'Import/export chưa được cấu hình.');
  return env.JWT_ACCESS_SECRET;
};
const digest = (format, fileName, content) => createHash('sha256').update(`${format}\0${fileName}\0${content}`).digest('hex');
const duplicateKey = job => `${job.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\0${job.industry.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
const sign = (payload, secret) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};
function verify(token, secret, userId, fileDigest, now) {
  try {
    const [encoded, signature] = token.split('.');
    const expected = createHmac('sha256', secret).update(encoded).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (payload.userId !== userId || payload.digest !== fileDigest || payload.expiresAt <= now) throw new Error();
    return payload;
  } catch { throw new ApiError(409, 'PREVIEW_EXPIRED', 'Bản xem trước không còn hợp lệ. Hãy tải và xem trước file lại.'); }
}

function toCreatePayload(row) {
  const value = row.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { errors: [{ field: 'job', code: 'INVALID_JOB', message: 'Mỗi phần tử JSON phải là một đối tượng công việc.' }] };
  const allowed = new Set(JOB_IMPORT_FIELDS);
  const unsupported = Object.keys(value || {}).filter(key => !allowed.has(key));
  if (unsupported.length) return { errors: unsupported.map(field => ({ field, code: 'UNSUPPORTED_FIELD', message: 'Trường này không được phép nhập.' })) };
  const fieldErrors = [];
  if (value.salary_type && !['NEGOTIABLE', 'RANGE'].includes(value.salary_type)) fieldErrors.push({ field: 'salary_type', code: 'INVALID_SALARY_TYPE', message: 'Loại lương phải là NEGOTIABLE hoặc RANGE.' });
  if (value.salary_type !== 'RANGE' && ['salary_min', 'salary_max', 'salary_currency'].some(field => value[field] !== undefined)) fieldErrors.push({ field: 'salary_type', code: 'SALARY_TYPE_REQUIRED', message: 'Chỉ nhập các trường lương min/max/currency khi salary_type là RANGE.' });
  if ((value.experience_status || 'NO_MINIMUM') !== 'REQUIRED' && value.required_months !== undefined) fieldErrors.push({ field: 'required_months', code: 'FIELD_NOT_APPLICABLE', message: 'required_months chỉ dùng khi experience_status là REQUIRED.' });
  if ((value.education_status || 'NO_MINIMUM') !== 'REQUIRED' && value.minimum_degree !== undefined) fieldErrors.push({ field: 'minimum_degree', code: 'FIELD_NOT_APPLICABLE', message: 'minimum_degree chỉ dùng khi education_status là REQUIRED.' });
  if ((value.project_status || 'NO_REQUIREMENT') !== 'REQUIRED' && value.required_technologies !== undefined) fieldErrors.push({ field: 'required_technologies', code: 'FIELD_NOT_APPLICABLE', message: 'required_technologies chỉ dùng khi project_status là REQUIRED.' });
  if (fieldErrors.length) return { errors: fieldErrors };
  const experienceStatus = value.experience_status || 'NO_MINIMUM';
  const educationStatus = value.education_status || 'NO_MINIMUM';
  const projectStatus = value.project_status || 'NO_REQUIREMENT';
  const requirements = {
    general: value.general || [],
    experience: { status: experienceStatus, ...(experienceStatus === 'REQUIRED' && value.required_months !== undefined ? { required_months: value.required_months } : {}) },
    education: { status: educationStatus, ...(educationStatus === 'REQUIRED' && value.minimum_degree ? { minimum_degree: value.minimum_degree } : {}) },
    project: { status: projectStatus, ...(projectStatus === 'REQUIRED' && value.required_technologies ? { required_technologies: value.required_technologies } : {}) },
  };
  const salary = value.salary_type === 'NEGOTIABLE' ? { type: 'NEGOTIABLE' }
    : value.salary_type === 'RANGE' ? { type: 'RANGE', min: value.salary_min, max: value.salary_max, currency: value.salary_currency || 'VND', period: 'MONTH' }
      : undefined;
  const payload = {
    title: value.title, industry: value.industry, seniority: value.seniority, description: value.description,
    responsibilities: value.responsibilities || [], requirements, required_skills: value.required_skills || [],
    optional_skills: value.optional_skills || [], status: 'DRAFT',
    ...(salary ? { salary } : {}), ...(['location', 'work_mode', 'employment_type', 'deadline'].filter(key => value[key] !== undefined).map(key => [key, value[key]])).reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
  };
  const parsed = createJobRequestSchema.safeParse(payload);
  if (!parsed.success) return { errors: parsed.error.issues.map(issue => ({ field: issue.path.join('.') || 'job', code: 'SCHEMA_VALIDATION', message: issue.message })) };
  const warnings = value.status && value.status !== 'DRAFT' ? [{ field: 'status', code: 'STATUS_IGNORED', message: 'Trạng thái trong file bị bỏ qua; Job nhập vào luôn ở DRAFT.' }] : [];
  return { payload: parsed.data, warnings };
}

function exportRecord(job) {
  const r = job.requirements || {};
  return Object.fromEntries([
    ['title', job.title], ['industry', job.industry], ['seniority', job.seniority], ['location', job.location], ['work_mode', job.work_mode], ['employment_type', job.employment_type],
    ['salary_type', job.salary?.type], ['salary_min', job.salary?.type === 'RANGE' ? job.salary.min : undefined], ['salary_max', job.salary?.type === 'RANGE' ? job.salary.max : undefined], ['salary_currency', job.salary?.type === 'RANGE' ? job.salary.currency : undefined],
    ['description', job.description], ['responsibilities', job.responsibilities], ['general', r.general], ['required_skills', job.required_skills], ['optional_skills', job.optional_skills],
    ['experience_status', r.experience?.status], ['required_months', r.experience?.required_months], ['education_status', r.education?.status], ['minimum_degree', r.education?.minimum_degree], ['project_status', r.project?.status], ['required_technologies', r.project?.required_technologies],
    ['deadline', job.deadline], ['status', job.status],
  ].filter(([, value]) => value !== undefined));
}

export class RecruiterJobImportExportService {
  constructor(jobs, { env = process.env, databaseName = env.AUTH_COUCHDB_DATABASE || env.COUCHDB_DATABASE || 'recruitment_db', now = () => new Date() } = {}) {
    this.jobs = jobs; this.env = env; this.databaseName = databaseName; this.now = now;
  }
  async recruiterJobs(user) {
    const items = []; let bookmark;
    do {
      const page = await this.jobs.list(user, { limit: 50, ...(bookmark ? { bookmark } : {}) });
      items.push(...page.items);
      if (!page.has_more) break;
      if (!page.bookmark || page.bookmark === bookmark || items.length > MAX_EXPORT) throw new ApiError(413, 'EXPORT_LIMIT_EXCEEDED', `Chỉ hỗ trợ tối đa ${MAX_EXPORT} tin mỗi lần xuất.`);
      bookmark = page.bookmark;
    } while (true);
    if (items.length > MAX_EXPORT) throw new ApiError(413, 'EXPORT_LIMIT_EXCEEDED', `Chỉ hỗ trợ tối đa ${MAX_EXPORT} tin mỗi lần xuất.`);
    return items;
  }
  async preview(user, input) {
    tokenSecret(this.env);
    const rows = parseJobImportFile(input.format, input.content);
    const known = new Set((await this.recruiterJobs(user)).map(duplicateKey));
    const seen = new Set();
    let valid = 0; let invalid = 0; let skipped = 0;
    const previewRows = rows.map(row => {
      const mapped = row.errors.length ? { errors: row.errors } : toCreatePayload(row);
      if (mapped.errors) { invalid += 1; return { row: row.row, status: 'FAILED', errors: mapped.errors }; }
      const key = duplicateKey(mapped.payload);
      if (seen.has(key) || known.has(key)) { skipped += 1; return { row: row.row, status: 'SKIPPED', errors: [{ field: 'title', code: 'DUPLICATE_JOB', message: 'Đã có tin cùng tiêu đề và ngành nghề trong tài khoản này.' }] }; }
      seen.add(key); valid += 1;
      return { row: row.row, status: 'READY', job: mapped.payload, warnings: mapped.warnings || [] };
    });
    const batchId = randomUUID();
    const expiresAt = this.now().getTime() + 15 * 60 * 1000;
    const previewToken = sign({ batchId, userId: user._id, digest: digest(input.format, input.fileName, input.content), expiresAt }, tokenSecret(this.env));
    return { previewToken, expiresAt: new Date(expiresAt).toISOString(), total: rows.length, valid, skipped, failed: invalid, rows: previewRows };
  }
  async confirm(user, input) {
    const target = String(this.databaseName).toLowerCase();
    if (target === 'recruithub_auth_demo' || (target === 'recruitment_db' && this.env.JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE !== 'true')) {
      throw new ApiError(403, 'IMPORT_DATABASE_NOT_ISOLATED', 'Import vào database thật cần bật JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE=true sau khi được chủ sở hữu cho phép.');
    }
    const secret = tokenSecret(this.env);
    const payload = verify(input.previewToken, secret, user._id, digest(input.format, input.fileName, input.content), this.now().getTime());
    const rows = parseJobImportFile(input.format, input.content);
    const existing = await this.recruiterJobs(user);
    const known = new Set(existing.map(duplicateKey)); const seen = new Set();
    const results = { total: rows.length, created: 0, skipped: 0, failed: 0, rows: [] };
    for (const row of rows) {
      const mapped = row.errors.length ? { errors: row.errors } : toCreatePayload(row);
      if (mapped.errors) { results.failed += 1; results.rows.push({ row: row.row, status: 'FAILED', errors: mapped.errors }); continue; }
      const key = duplicateKey(mapped.payload);
      if (known.has(key) || seen.has(key)) { results.skipped += 1; results.rows.push({ row: row.row, status: 'SKIPPED', reason: 'DUPLICATE_JOB' }); continue; }
      seen.add(key);
      // Duplicate keys map to one deterministic CouchDB ID per authenticated user,
      // closing the race between simultaneous previews/confirmations.
      const documentId = `job:${createHash('sha256').update(`${user._id}\0${key}`).digest('hex').slice(0, 32)}`;
      try {
        const saved = await this.jobs.create(user, { ...mapped.payload, status: 'DRAFT' }, { documentId });
        known.add(key); results.created += 1; results.rows.push({ row: row.row, status: 'CREATED', id: saved._id });
      } catch (error) {
        if (error.status === 409 || error.code === 'CONFLICT') {
          try {
            const saved = await this.jobs.detail(user, documentId);
            if (saved.status === 'DRAFT') { known.add(key); results.skipped += 1; results.rows.push({ row: row.row, status: 'SKIPPED', reason: 'IDEMPOTENT_REPLAY' }); continue; }
          } catch { /* Preserve the per-row write error below. */ }
        }
        results.failed += 1; results.rows.push({ row: row.row, status: 'FAILED', errors: [{ code: error.code || 'CREATE_FAILED', message: error.message || 'Không thể tạo tin.' }] });
      }
    }
    return results;
  }
  async export(user, query) {
    const jobs = await this.recruiterJobs(user);
    const from = query.created_from ? Date.parse(`${query.created_from}T00:00:00.000Z`) : -Infinity;
    const to = query.created_to ? Date.parse(`${query.created_to}T23:59:59.999Z`) : Infinity;
    const term = query.q.toLocaleLowerCase();
    const records = jobs.filter(job => (!query.status || job.status === query.status)
      && Date.parse(job.created_at) >= from && Date.parse(job.created_at) <= to
      && (!term || [job.title, job.industry, job.description, ...job.required_skills].some(value => String(value).toLocaleLowerCase().includes(term))))
      .map(exportRecord);
    const date = this.now().toISOString().slice(0, 10);
    if (query.format === 'json') return { fileName: `recruithub-jobs-${date}.json`, contentType: 'application/json; charset=utf-8', content: JSON.stringify({ schema_version: 1, exported_at: this.now().toISOString(), jobs: records }, null, 2) };
    return { fileName: `recruithub-jobs-${date}.csv`, contentType: 'text/csv; charset=utf-8', content: serializeJobsCsv(records) };
  }
  template(format) { return { fileName: `recruithub-jobs-template.${format}`, contentType: format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8', content: format === 'json' ? jsonTemplate() : csvTemplate() }; }
}
