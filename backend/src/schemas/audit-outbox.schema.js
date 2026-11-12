import { z } from 'zod';
import { auditEventSchema, eventId, eventTimestamp } from './audit-event.schema.js';

export const outboxMaxEntries = 32;
export const outboxMaxBytes = 32 * 1024;

export const deliveryIncidentSchema = z.strictObject({
  code: z.enum(['EVENT_STORE_UNAVAILABLE', 'EVENT_ID_CONFLICT']),
  failure_event_id: eventId,
  recovery_event_id: eventId,
  first_failed_at: eventTimestamp,
  last_failed_at: eventTimestamp,
  attempts: z.number().int().min(1).max(2147483647),
  recovered_at: eventTimestamp.optional(),
}).refine(incident => incident.first_failed_at <= incident.last_failed_at
  && (!incident.recovered_at || incident.recovered_at >= incident.last_failed_at)
  && !(incident.code === 'EVENT_ID_CONFLICT' && incident.recovered_at),
'Delivery incident timestamps are invalid.');

function outboxSchema(actions) {
  const event = auditEventSchema.refine(event => actions.includes(event.action));
  return z.array(z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('pending'), event, delivery_incident: deliveryIncidentSchema.optional() }),
    z.strictObject({
      state: z.literal('quarantined'), event,
      code: z.enum(['EVENT_ID_CONFLICT', 'EVENT_RETENTION_EXPIRED']),
    }),
  ])).max(outboxMaxEntries).refine(entries =>
    new Set(entries.map(entry => entry.event.event_id)).size === entries.length,
  'Outbox event IDs must be unique.');
}

export const auditOutboxSchema = outboxSchema(['APPLICATION_STAGE_CHANGED', 'JOB_STATUS_CHANGED']);
export const userAuditOutboxSchema = outboxSchema(['USER_ACCOUNT_STATUS_CHANGED']);
