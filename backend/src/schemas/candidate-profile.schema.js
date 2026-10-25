import { z } from 'zod';
import { AVAILABILITY_STATES, CANONICAL_DEGREES, SENIORITY_LEVELS } from '../constants/document.constants.js';
import { employmentItemSchema, experienceSummarySchema, projectItemSchema } from './common.schema.js';
import { normalizeSkill } from '../utils/normalization.utils.js';

const profilePatchSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(120).optional(),
  industry: z.string().trim().min(1).max(80).optional(),
  seniority: z.enum([SENIORITY_LEVELS.JUNIOR, SENIORITY_LEVELS.MID, SENIORITY_LEVELS.SENIOR]).optional(),
  years_experience: z.number().int().min(0).max(80).optional(),
  summary: z.string().trim().min(1).max(4000).optional(),
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
  profile: profilePatchSchema,
  skills: candidateSkillListPatchSchema.optional(),
  education: z.array(z.object({
    degree: z.enum([CANONICAL_DEGREES.HIGH_SCHOOL, CANONICAL_DEGREES.BACHELOR, CANONICAL_DEGREES.MASTER, CANONICAL_DEGREES.DOCTORATE]),
    institution: z.string().trim().min(1).max(200).optional(),
    field_of_study: z.string().trim().min(1).max(200).optional(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).optional(),
  }).strict()).max(30).optional(),
  experience_summary: experienceSummarySchema.optional(),
  experience: z.array(employmentItemSchema).max(50).optional(),
  projects: z.array(projectItemSchema).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one permitted field is required.');

export const candidateAvailabilityStates = AVAILABILITY_STATES;
