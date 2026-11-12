import { z } from 'zod';
import { assetIdSchema } from './upload.schema.js';
import { AVAILABILITY_STATES, CANONICAL_DEGREES, SENIORITY_LEVELS } from '../constants/document.constants.js';
import { employmentItemSchema, experienceSummarySchema, projectItemSchema } from './common.schema.js';
import { normalizeSkill } from '../utils/normalization.utils.js';
import { personNameSchema, phoneSchema, profileText } from './profile-validation.schema.js';

const profilePatchSchema = z.object({
  full_name: personNameSchema(120).optional(),
  role: profileText('Vị trí mong muốn', 120, 2).optional(),
  industry: profileText('Ngành nghề', 80, 2).optional(),
  seniority: z.enum([SENIORITY_LEVELS.JUNIOR, SENIORITY_LEVELS.MID, SENIORITY_LEVELS.SENIOR]).optional(),
  years_experience: z.number().int().min(0).max(80).optional(),
  summary: profileText('Giới thiệu', 4000, 1, true).optional(),
  phone: phoneSchema.optional(),
  location: profileText('Địa điểm', 160).optional(),
}).strict().optional();

const candidateSkillPatchSchema = z.object({
  name: z.string().trim().min(1, 'Skill name cannot be empty'),
  normalized: z.string().trim().min(1, 'Normalized skill cannot be empty').optional(),
}).strict().transform((skill) => ({
  ...skill,
  normalized: normalizeSkill(skill.name),
}));

const candidateSkillListPatchSchema = z.array(candidateSkillPatchSchema).max(100).superRefine((skills, ctx) => {
  const seen = new Set();
  skills.forEach((skill, index) => {
    if (seen.has(skill.normalized)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate canonical skill detected: "${skill.normalized}"`,
        path: [index, 'normalized'],
      });
    }
    seen.add(skill.normalized);
  });
});

export const candidateProfilePatchSchema = z.object({
  resume_file_id: assetIdSchema.nullable().optional(),
  avatar_asset_id: assetIdSchema.nullable().optional(),
  languages: z.array(z.object({ name: profileText('Ngoại ngữ', 80, 1), proficiency: profileText('Trình độ ngoại ngữ', 120).optional() }).strict()).max(20).optional(),
  profile: profilePatchSchema,
  skills: candidateSkillListPatchSchema.optional(),
  education: z.array(z.object({
    degree: z.enum([CANONICAL_DEGREES.HIGH_SCHOOL, CANONICAL_DEGREES.BACHELOR, CANONICAL_DEGREES.MASTER, CANONICAL_DEGREES.DOCTORATE]),
    institution: profileText('Tên trường', 200, 1).optional(),
    field_of_study: profileText('Chuyên ngành', 200, 1).optional(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).optional(),
  }).strict()).max(30).optional(),
  experience_summary: experienceSummarySchema.optional(),
  experience: z.array(employmentItemSchema.extend({ employer: profileText('Đơn vị làm việc', 200, 1).optional(), role: profileText('Chức danh', 200, 1).optional(), description: profileText('Mô tả kinh nghiệm', 4000, 1, true).optional() })).max(50).optional(),
  projects: z.array(projectItemSchema.safeExtend({ name: profileText('Tên dự án', 200, 1), role: profileText('Vai trò dự án', 200, 1).optional(), description: profileText('Mô tả dự án', 4000, 1, true).optional(), technologies: z.array(profileText('Công nghệ', 120, 1)).max(100) })).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one permitted field is required.').superRefine((value, ctx) => {
  for (const [key, field] of [['skills', 'normalized'], ['languages', 'name']]) {
    const seen = new Set();
    (value[key] || []).forEach((item, index) => {
      const normalized = item[field].normalize('NFKC').trim().toLowerCase();
      if (seen.has(normalized)) ctx.addIssue({ code: 'custom', path: [key, index, field], message: key === 'skills' ? 'Kỹ năng không được trùng nhau.' : 'Ngoại ngữ không được trùng nhau.' });
      seen.add(normalized);
    });
  }
});

export const candidateAvailabilityStates = AVAILABILITY_STATES;
