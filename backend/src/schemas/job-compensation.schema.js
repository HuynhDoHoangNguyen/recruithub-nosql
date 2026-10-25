import { z } from 'zod';

export const salarySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NEGOTIABLE') }).strict(),
  z.object({ type: z.literal('RANGE'), min: z.number().positive().max(1e12), max: z.number().positive().max(1e12),
    currency: z.enum(['VND', 'USD']), period: z.literal('MONTH') }).strict().refine(value => value.max >= value.min,
    { path: ['max'], message: 'Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.' }),
]);
