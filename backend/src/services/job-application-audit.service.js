import { randomUUID } from 'node:crypto';
import { appendAuditOutbox } from './audit-outbox.service.js';

export function appendJobApplicationAudit(document, user, correlationId, { field, from, to, operation }) {
  if (from === to) return document;
  const application = document.type === 'application';
  return appendAuditOutbox(document, {
    schema_version: 1, kind: 'audit_trail', event_id: randomUUID(),
    correlation_id: correlationId ?? randomUUID(), occurred_at: new Date(document.updated_at).toISOString(),
    action: application ? 'APPLICATION_STAGE_CHANGED' : 'JOB_STATUS_CHANGED',
    actor: { type: 'USER', id: user._id, role: user.role },
    subject: { type: application ? 'APPLICATION' : 'JOB', id: document._id },
    outcome: 'SUCCEEDED', change: { field, from, to },
    ...(operation && { operation }),
  });
}

export function withoutAuditOutbox({ audit_outbox, ...document }) {
  return document;
}
