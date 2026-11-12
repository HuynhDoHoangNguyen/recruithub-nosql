import { randomUUID } from 'node:crypto';
import { getAuditDatabaseConfig } from '../config/audit-database.config.js';
import { AuditEventRepository } from '../repositories/audit-event.repository.js';
import { auditEventSchema, eventId as uuidSchema } from '../schemas/audit-event.schema.js';

const dependencyCodes = new Set([
  'DATABASE_UNAVAILABLE',
  'DATABASE_NOT_FOUND',
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVER_ERROR',
]);
const excludedCodes = new Set(['AUDIT_BACKLOG_FULL', 'CONFLICT', 'REVISION_CONFLICT']);
const components = new Set(['application', 'job', 'admin-user']);

export function isDependencyWriteFailure(error) {
  if (!error || excludedCodes.has(error.code)) return false;
  return dependencyCodes.has(error.code) || [502, 503, 504].includes(error.status);
}

export function writeSystemEventFallback(record, stream = process.stderr) {
  try { stream.write(`${JSON.stringify(record)}\n`); }
  catch { /* A logging failure must not replace the business-store failure. */ }
}

function safeFallback(event, component) {
  return {
    level: 'ERROR',
    kind: 'SYSTEM_LOG_FALLBACK',
    action: 'DEPENDENCY_WRITE_FAILED',
    code: 'BUSINESS_STORE_UNAVAILABLE',
    component: components.has(component) ? component : 'unknown',
    event_id: event.event_id,
    correlation_id: event.correlation_id,
    occurred_at: event.occurred_at,
  };
}

export function createSystemEventReporter({ sink, sinkFactory, now = () => new Date(), fallback = writeSystemEventFallback } = {}) {
  let configuredSink = sink;
  const getSink = () => (configuredSink ??= sinkFactory?.());
  return {
    async dependencyWriteFailed({ actor, component, correlationId } = {}) {
      let timestamp;
      try { timestamp = new Date(now()).toISOString(); }
      catch { timestamp = new Date().toISOString(); }
      const event = {
        schema_version: 1,
        kind: 'system_log',
        event_id: randomUUID(),
        correlation_id: uuidSchema.safeParse(correlationId).success ? correlationId : randomUUID(),
        occurred_at: timestamp,
        action: 'DEPENDENCY_WRITE_FAILED',
        actor: { type: 'USER', id: actor?._id ?? actor?.sub, role: actor?.role },
        subject: { type: 'COMPONENT', id: component },
        outcome: 'UNKNOWN',
        code: 'BUSINESS_STORE_UNAVAILABLE',
      };
      const parsed = auditEventSchema.safeParse(event);
      if (parsed.success) {
        try {
          const result = await getSink()?.append(parsed.data);
          if (result?.event_id === parsed.data.event_id && typeof result.created === 'boolean') {
            return { logged: true, event_id: parsed.data.event_id };
          }
        } catch { /* Use the sanitized operational fallback below. */ }
      }
      try { fallback(safeFallback(event, component)); }
      catch { /* Injected fallback implementations are also best-effort. */ }
      return { logged: false, event_id: event.event_id };
    },
  };
}

export function createConfiguredSystemEventReporter(environment = process.env, options = {}) {
  return createSystemEventReporter({
    ...options,
    sinkFactory: () => new AuditEventRepository(getAuditDatabaseConfig(environment)),
  });
}

export async function reportDependencyWriteFailure(reporter, error, context) {
  if (!reporter || !isDependencyWriteFailure(error)) return false;
  try { await reporter.dependencyWriteFailed(context); }
  catch { /* A custom reporter must not replace the original write error. */ }
  return true;
}

export function auditDeliveryFailedEvent(sourceEvent, incident) {
  return auditEventSchema.parse({
    schema_version: 1,
    kind: 'system_log',
    event_id: incident.failure_event_id,
    correlation_id: sourceEvent.correlation_id,
    occurred_at: incident.first_failed_at,
    action: 'AUDIT_DELIVERY_FAILED',
    actor: { type: 'SYSTEM' },
    subject: { type: 'COMPONENT', id: 'audit-delivery' },
    outcome: incident.code === 'EVENT_ID_CONFLICT' ? 'FAILED' : 'UNKNOWN',
    code: incident.code,
  });
}

export function auditDeliveryRecoveredEvent(sourceEvent, incident) {
  if (incident.code !== 'EVENT_STORE_UNAVAILABLE' || !incident.recovered_at) {
    throw new TypeError('Only a recovered event-store incident can produce a recovery event.');
  }
  return auditEventSchema.parse({
    schema_version: 1,
    kind: 'system_log',
    event_id: incident.recovery_event_id,
    correlation_id: sourceEvent.correlation_id,
    occurred_at: incident.recovered_at,
    action: 'AUDIT_DELIVERY_RECOVERED',
    actor: { type: 'SYSTEM' },
    subject: { type: 'COMPONENT', id: 'audit-delivery' },
    outcome: 'RECOVERED',
    code: 'EVENT_DELIVERED',
  });
}

