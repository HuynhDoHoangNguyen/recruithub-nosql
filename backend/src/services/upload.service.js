import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../middleware/job-application.middleware.js';
import { assetReference } from '../schemas/upload.schema.js';
import { candidateScope, ownedJob, recruiterScope, runtimeProvenance } from './job-application-scope.service.js';
import { validateUpload } from '../utils/upload-validation.js';
import { readDocument } from '../utils/document-reader.js';

export async function resolveOwnedAsset(repository, id, userId, kind, companyId) {
  const asset = await repository.get(id);
  if (!asset || asset.type !== 'uploaded_asset') throw new ApiError(404, 'FILE_NOT_FOUND', 'Không tìm thấy file đã tải lên.');
  if (asset.owner_id !== userId || asset.kind !== kind || (companyId && asset.company_id !== companyId)) throw new ApiError(403, 'FILE_FORBIDDEN', 'File không thuộc tài khoản hoặc không đúng mục đích.');
  return assetReference(asset);
}
export class UploadService {
  constructor(assets, repository, now = () => new Date()) { this.assets = assets; this.repo = repository; this.now = now; }
  async upload(user, kind, bytes, name) {
    let scope;
    if (kind === 'company-logo') scope = { company_id: (await recruiterScope(this.repo, user)).company_id };
    else scope = { candidate_id: (await candidateScope(this.repo, user))._id };
    const file = validateUpload(bytes, name, kind);
    if (file.content_type === 'application/pdf') await readDocument(bytes, 'validate-pdf');
    const asset = { _id: `asset:${randomUUID()}`, type: 'uploaded_asset', owner_id: user._id, kind, ...scope, ...file,
      sha256: createHash('sha256').update(bytes).digest('hex'), created_at: this.now().toISOString(), provenance: runtimeProvenance(['file']),
      _attachments: { content: { content_type: file.content_type, data: bytes.toString('base64') } } };
    await this.assets.put(asset);
    return assetReference(asset);
  }
  async content(id, user, publicLogo = false) {
    const asset = await this.assets.get(id);
    if (!asset || asset.type !== 'uploaded_asset') throw new ApiError(404, 'FILE_NOT_FOUND', 'Không tìm thấy file.');
    if (publicLogo) {
      if (asset.kind !== 'company-logo') throw new ApiError(404, 'FILE_NOT_FOUND', 'Không tìm thấy logo.');
    } else if (asset.owner_id !== user?._id) {
      if (user?.role !== 'RECRUITER' || !await this.recruiterCanRead(user, asset)) throw new ApiError(403, 'FILE_FORBIDDEN', 'Bạn không có quyền tải file này.');
    }
    const bytes = await this.assets.readContent(id);
    if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new ApiError(409, 'FILE_INTEGRITY_ERROR', 'File không khớp dữ liệu đã lưu.');
    return { asset, bytes };
  }
  async recruiterCanRead(user, asset) {
    if (!['resume', 'avatar'].includes(asset.kind)) return false;
    let bookmark;
    while (true) {
      const page = await this.repo.find({ type: 'application', candidate_id: asset.candidate_id }, { index: 'candidate_applications', limit: 100, bookmark });
      for (const app of page.items) {
        const linked = asset.kind === 'avatar' || [app, ...(app.previous_attempts || [])].some(attempt => attempt.submission?.resume_file?.asset_id === asset._id);
        if (!linked) continue;
        try { await ownedJob(this.repo, user, app.job_id); return true; }
        catch (error) { if (![403, 404].includes(error.status)) throw error; }
      }
      if (!page.has_more || !page.bookmark || page.bookmark === bookmark) return false;
      bookmark = page.bookmark;
    }
  }
  async preview(id, user) {
    const { asset, bytes } = await this.content(id, user);
    if (asset.kind !== 'resume' || asset.content_type === 'application/pdf') throw new ApiError(400, 'UNSUPPORTED_PREVIEW', 'Định dạng không hỗ trợ bản xem nội dung Word.');
    validateUpload(bytes, asset.file_name, 'resume');
    const { text, truncated } = await readDocument(bytes, 'word-text');
    return { text, truncated };
  }
}
