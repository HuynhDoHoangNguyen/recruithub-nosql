import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const assetIdSchema = z.string().regex(/^asset:[a-f0-9-]{36}$/);
export const assetReferenceSchema = z.object({
  asset_id: assetIdSchema, file_name: z.string().min(1).max(200),
  content_type: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/webp']),
  size: z.number().int().positive().lt(MAX_UPLOAD_BYTES), sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const uploadKindSchema = z.object({ kind: z.enum(['resume', 'avatar', 'company-logo']) }).strict();
export const assetParamsSchema = z.object({ id: assetIdSchema }).strict();
export const uploadNameSchema = z.string().trim().min(1).max(200).refine(name => !/[\x00-\x1f\x7f/\\]/.test(name), 'Tên file không hợp lệ.');

export function assetReference(asset) {
  return { asset_id: asset._id, file_name: asset.file_name, content_type: asset.content_type, size: asset.size, sha256: asset.sha256 };
}
export const companyLogoUrl = company => company?.logo_asset ? `/api/v1/media/company-logos/${encodeURIComponent(company.logo_asset.asset_id)}` : company?.logo_url;
