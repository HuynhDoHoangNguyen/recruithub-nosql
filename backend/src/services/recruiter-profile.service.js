import { ApiError } from '../middleware/job-application.middleware.js';
import { recruiterDocumentSchema } from '../schemas/recruiter.schema.js';
import { companyDocumentSchema } from '../schemas/company.schema.js';
import { recruiterScope, requireDocument } from './job-application-scope.service.js';
import { validateWrite } from './job.service.js';
import { companyLogoUrl } from '../schemas/upload.schema.js';
import { resolveOwnedAsset } from './upload.service.js';
import { recruiterCompanyPatchSchema, recruiterProfilePatchSchema } from '../schemas/recruiter-profile.schema.js';

const pick = (document, fields) => Object.fromEntries(fields.filter(key => document[key] !== undefined).map(key => [key, document[key]]));
export class RecruiterProfileService {
  constructor(repository, now = () => new Date(), assets = repository) { this.repo = repository; this.now = now; this.assets = assets; }
  async get(user) {
    const recruiter = await recruiterScope(this.repo, user);
    const company = await requireDocument(this.repo, recruiter.company_id, 'company');
    const department = await requireDocument(this.repo, recruiter.department_id, 'department');
    return { email: user.email, recruiter: { ...pick(recruiter, ['_id', '_rev']), profile: recruiter.profile || {} },
      company: { ...pick(company, ['_id', '_rev', 'name', 'industry', 'address', 'website', 'description', 'logo_asset']), logo_url: companyLogoUrl(company) },
      department: pick(department, ['_id', 'name']) };
  }
  async update(user, payload, companyOnly = false) {
    const parsed = (companyOnly ? recruiterCompanyPatchSchema : recruiterProfilePatchSchema).safeParse(payload);
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Kiểm tra lại thông tin hồ sơ.', parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
    payload = parsed.data;
    const recruiter = await recruiterScope(this.repo, user);
    const current = companyOnly ? await requireDocument(this.repo, recruiter.company_id, 'company') : recruiter;
    if (current._rev !== payload.expected_rev) throw new ApiError(409, 'CONFLICT', 'Hồ sơ đã thay đổi. Vui lòng tải lại trước khi lưu.');
    const changes = companyOnly ? payload.company : { profile: { ...recruiter.profile, ...payload.profile } };
    const { logo_asset_id, ...fields } = changes;
    if (companyOnly && logo_asset_id) fields.logo_asset = await resolveOwnedAsset(this.assets, logo_asset_id, user._id, 'company-logo', recruiter.company_id);
    const document = { ...current, ...fields, updated_at: new Date(Math.max(this.now().getTime(), Date.parse(current.updated_at) + 1)).toISOString(),
      provenance: { ...current.provenance, classification: current.provenance.classification === 'unavailable' ? 'unavailable' : 'mixed',
        field_origins: { ...current.provenance.field_origins, ...Object.fromEntries(Object.keys(fields).map(key => [key, 'recruiter_self_service'])) } } };
    for (const key of ['address', 'website', 'description', 'logo_url']) if (document[key] === null || document[key] === '') delete document[key];
    if (companyOnly && logo_asset_id !== undefined) { delete document.logo_url; if (logo_asset_id === null) delete document.logo_asset; }
    const options = { allowLegacyUnavailable: current.provenance.classification === 'unavailable' };
    const validated = validateWrite(companyOnly ? companyDocumentSchema : recruiterDocumentSchema, document, options);
    await this.repo.put(validated, options);
    // No post-write reference validation: references are unchanged and validated by recruiterScope above.
    return { ...(companyOnly ? { company: pick(validated, ['_id', 'name', 'industry', 'address', 'website', 'description', 'logo_url']) } : { profile: validated.profile }), saved: true };
  }
}
