import { z } from 'zod';

export const computeScoringRequestSchema = z.object({
  application_id: z
    .string()
    .regex(/^application:pair:[a-f0-9]{64}$/, 'application_id must match application:pair:<64 lowercase hex>'),
}).strict();
