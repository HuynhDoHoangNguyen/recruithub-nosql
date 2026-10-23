import { z } from 'zod';
import { SENIORITY_LEVELS } from '../constants/document.constants.js';

const emailSchema = z.string().trim().email().max(254);
const passwordInputSchema = z.string().min(1).max(128);

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordInputSchema,
}).strict();

export const candidateRegistrationRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(128)
    .refine((value) => /[A-Z]/.test(value) && /\d/.test(value), {
      message: 'Password must include an uppercase letter and a number.',
    }),
  full_name: z.string().trim().min(1).max(160),
  candidate_role: z.string().trim().min(1).max(120),
  industry: z.string().trim().min(1).max(120),
  seniority: z.enum([
    SENIORITY_LEVELS.JUNIOR,
    SENIORITY_LEVELS.MID,
    SENIORITY_LEVELS.SENIOR,
  ]),
  years_experience: z.number().int().min(0).max(80),
}).strict();

export function validateAuthRequest(schema, input) {
  return schema.safeParse(input);
}
