import { z } from 'zod';
import { auditActions, subjectId, subjectType, systemActions, userId } from './audit-event.schema.js';

const timestamp = z.iso.datetime().transform(value => new Date(value).toISOString());
const common = {
  from: timestamp.optional(),
  to: timestamp.optional(),
  limit: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(100)).optional(),
  cursor: z.string().min(1).max(4096).optional(),
};
const validatePairs = query => Boolean(query.from) === Boolean(query.to)
  && Boolean(query.subject_type) === Boolean(query.subject_id)
  && [query.action, query.actor_id, query.subject_type].filter(Boolean).length <= 1;
const schemas = {
  audit_trail: z.strictObject({
    ...common, action: z.enum(auditActions).optional(), actor_id: userId.optional(),
    subject_type: subjectType.optional(), subject_id: subjectId.optional(),
  }).refine(validatePairs),
  system_log: z.strictObject({ ...common, action: z.enum(systemActions).optional() }).refine(validatePairs),
};

export function parseAdminAuditQuery(kind, input) {
  return schemas[kind].safeParse(input);
}
