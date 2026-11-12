import { auditEventSchema } from '../schemas/audit-event.schema.js';

export function toAuditEventDto(record) {
  const { actor, subject, change } = record;
  const result = auditEventSchema.safeParse({
    schema_version: record.schema_version,
    kind: record.kind,
    event_id: record.event_id,
    correlation_id: record.correlation_id,
    occurred_at: record.occurred_at,
    action: record.action,
    actor: { type: actor?.type, ...(actor?.type === 'USER' && { id: actor.id, role: actor.role }) },
    subject: { type: subject?.type, id: subject?.id },
    outcome: record.outcome,
    ...(change && { change: { field: change.field, from: change.from, to: change.to } }),
    ...(record.code !== undefined && { code: record.code }),
    ...(record.operation !== undefined && { operation: record.operation }),
  });
  if (!result.success) throw Object.assign(new Error('Invalid stored audit event.'), { code: 'INVALID_STORED_AUDIT_EVENT' });
  return result.data;
}
