import { z } from 'zod';
import { assetIdSchema } from './upload.schema.js';
import { personNameSchema, phoneSchema, profileText } from './profile-validation.schema.js';

const contact = max => z.string().trim().max(max);
export const safeWebUrl = z.string().trim().max(2048).url().refine(value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Chỉ sử dụng URL http/https không chứa tài khoản.');
export const recruiterContactSchema = z.object({
  full_name: contact(160).optional(), phone: contact(40).optional(),
  location: contact(200).optional(), bio: contact(3000).optional(),
}).strict();
// Keep legacy documents readable; enforce stronger rules on self-service writes.
export const recruiterContactPatchSchema = z.object({
  full_name: personNameSchema(160).optional(), phone: phoneSchema.optional(),
  location: profileText('Địa điểm', 200).optional(), bio: profileText('Giới thiệu', 3000, 0, true).optional(),
}).strict();
export const companyProfilePatchSchema = z.object({
  logo_asset_id: assetIdSchema.nullable().optional(),
  name: profileText('Tên công ty', 200, 2), industry: profileText('Ngành nghề', 120, 2),
  address: profileText('Địa chỉ công ty', 500).nullable().optional(), description: profileText('Giới thiệu công ty', 5000, 0, true).nullable().optional(),
  website: safeWebUrl.nullable().optional(), logo_url: safeWebUrl.nullable().optional(),
}).strict();
export const recruiterProfilePatchSchema = z.object({ expected_rev: z.string().min(1).max(100),
  profile: recruiterContactPatchSchema,
}).strict();
export const recruiterCompanyPatchSchema = z.object({ expected_rev: z.string().min(1).max(100),
  company: companyProfilePatchSchema,
}).strict();
