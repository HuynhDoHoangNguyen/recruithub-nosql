import { z } from 'zod';
import { jobRequirementsSchema } from './job.schema.js';
import { submissionSchema } from './application.schema.js';
import { APPROVED_TRANSITIONS, REJECTION_REASON_CODES } from '../utils/application-lifecycle.utils.js';
import { normalizeSkill } from '../utils/normalization.utils.js';

const text = max => z.string().trim().min(1, 'Không được để trống.').max(max, `Tối đa ${max} ký tự.`);
export const utcTimestamp = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)), 'Ngày giờ không hợp lệ.')
  .transform(value => new Date(value).toISOString());
export const jobParamsSchema = z.object({ id: z.string().regex(/^job:(cms:J_[0-9]{6}|[a-z0-9_-]+)$/) }).strict();
export const applicationParamsSchema = z.object({ id: z.string().regex(/^application:pair:[a-f0-9]{64}$/) }).strict();
const skillList = z.array(text(120).transform(value => normalizeSkill(value))).max(100);
const jobFields = {
  title: text(200), seniority: z.enum(['JUNIOR', 'MID', 'SENIOR']), industry: text(120),
  description: text(20000), responsibilities: z.array(text(2000)).max(100),
  requirements: jobRequirementsSchema.transform(value => ({ ...value, project: {
    ...value.project, ...(value.project.required_technologies ? { required_technologies: value.project.required_technologies.map(skill => normalizeSkill(skill)) } : {}),
  } })),
  required_skills: skillList.min(1), optional_skills: skillList,
  deadline: utcTimestamp.optional(),
};
export const createJobRequestSchema = z.object({ ...jobFields, status: z.enum(['DRAFT', 'OPEN']) }).strict();
export const editJobRequestSchema = z.object({ ...Object.fromEntries(Object.entries(jobFields).map(([key, value]) => [key, value.optional()])),
  expected_rev: text(100),
}).strict().refine(value => Object.keys(value).length > 1, 'Chưa có nội dung cần sửa.');
export const statusRequestSchema = z.object({ status: z.enum(['OPEN', 'CLOSED']), expected_rev: text(100) }).strict();
export const applyRequestSchema = z.object({ job_id: z.string().regex(/^job:(cms:J_[0-9]{6}|[a-z0-9_-]+)$/),
  submission: submissionSchema.extend({ resume_text: text(50000) }),
}).strict();
const stages = [...new Set(APPROVED_TRANSITIONS.map(item => item.to))];
const concurrency = { expected_stage: z.enum(stages), expected_rev: text(100) };
export const withdrawRequestSchema = z.object(concurrency).strict();
export const acceptanceSchema = z.object({
  accepted_at: utcTimestamp, method: z.enum(['ELECTRONIC_SIGNATURE', 'EMAIL', 'WRITTEN_CONFIRMATION']),
  signed_document_id: text(500).optional(), reference: text(500).optional(),
}).strict();
export const stageRequestSchema = z.object({ ...concurrency, to_stage: z.enum(stages),
  reason_code: z.enum(REJECTION_REASON_CODES).optional(), note: text(2000).optional(), evidence: acceptanceSchema.optional(),
}).strict();
const pagination = { limit: z.coerce.number().int().min(1).max(50).default(20), bookmark: z.string().max(8192).optional() };
export const jobListQuerySchema = z.object({ ...pagination, status: z.enum(['DRAFT', 'OPEN', 'CLOSED']).optional() }).strict();
export const publicJobQuerySchema = z.object(pagination).strict();
export const applicationListQuerySchema = z.object({ ...pagination, stage: z.enum(stages).optional(),
  job_id: applyRequestSchema.shape.job_id.optional(),
}).strict();
export const applicantQuerySchema = z.object({ ...pagination, stage: z.enum(stages).optional() }).strict();
