import { z } from 'zod';

const fileContent = z.string().min(1).max(256 * 1024);

export const importPreviewRequestSchema = z.object({
  format: z.enum(['csv', 'json']),
  fileName: z.string().trim().min(1).max(160),
  content: fileContent,
}).strict();

export const importConfirmRequestSchema = importPreviewRequestSchema.extend({
  previewToken: z.string().min(40).max(2048),
}).strict();

const dateValue = z.string().date().optional();
export const jobExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED']).optional(),
  q: z.string().trim().max(120).default(''),
  created_from: dateValue,
  created_to: dateValue,
}).strict().refine(value => !value.created_from || !value.created_to || value.created_from <= value.created_to, {
  path: ['created_to'], message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
});

export const jobTemplateQuerySchema = z.object({ format: z.enum(['csv', 'json']).default('csv') }).strict();
