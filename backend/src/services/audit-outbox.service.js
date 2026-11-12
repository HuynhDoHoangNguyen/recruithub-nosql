import { ApiError } from '../middleware/job-application.middleware.js';
import { auditEventSchema } from '../schemas/audit-event.schema.js';
import { outboxMaxBytes, outboxMaxEntries } from '../schemas/audit-outbox.schema.js';

export function appendAuditOutbox(document, input) {
  const event = auditEventSchema.parse(input);
  const outbox = [...(document.audit_outbox ?? []), { state: 'pending', event }];
  if (outbox.length > outboxMaxEntries || Buffer.byteLength(JSON.stringify(outbox)) > outboxMaxBytes) {
    throw new ApiError(503, 'AUDIT_BACKLOG_FULL', 'Hàng chờ kiểm toán đã đầy. Vui lòng thử lại sau.');
  }
  return { ...document, audit_outbox: outbox };
}
