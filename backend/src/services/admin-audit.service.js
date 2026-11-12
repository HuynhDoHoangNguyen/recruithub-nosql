import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getAuditDatabaseConfig } from '../config/audit-database.config.js';
import { ApiError } from '../middleware/job-application.middleware.js';
import { AuditEventRepository, auditRepositoryQuerySchema } from '../repositories/audit-event.repository.js';
import { parseAdminAuditQuery } from '../schemas/admin-audit-query.schema.js';

const day = 86400000;
const cursorSchema = z.strictObject({
  version: z.literal(1),
  query: auditRepositoryQuerySchema.refine(query => Boolean(query.after)),
});
const invalidQuery = () => new ApiError(400, 'VALIDATION_ERROR', 'Bộ lọc nhật ký không hợp lệ.');
const invalidCursor = () => new ApiError(400, 'INVALID_CURSOR', 'Con trỏ nhật ký không hợp lệ hoặc không khớp bộ lọc.');
export const auditReadUnavailable = () => new ApiError(503, 'AUDIT_READ_UNAVAILABLE', 'Kho nhật ký hiện không thể truy cập.');

function signature(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function decodeCursor(secret, cursor) {
  try {
    const [payload, mac] = cursor.split('.');
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor)) throw new Error();
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(signature(secret, payload)))) throw new Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))).query;
  } catch {
    throw invalidCursor();
  }
}

export function createAdminAuditService({ repository, secret, now = () => new Date() }) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw auditReadUnavailable();

  return {
    async list(kind, input) {
      const parsed = parseAdminAuditQuery(kind, input);
      if (!parsed.success) throw invalidQuery();
      const { cursor, from, to, limit, action, actor_id, subject_type, subject_id } = parsed.data;
      const filters = {
        ...(from && { from, to }),
        ...(action && { action }),
        ...(actor_id && { actorId: actor_id }),
        ...(subject_type && { subject: { type: subject_type, id: subject_id } }),
      };
      let query;
      if (cursor) {
        const previous = decodeCursor(secret, cursor);
        if (previous.kind !== kind || Object.entries(filters).some(([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(previous[key]))) throw invalidCursor();
        query = { ...previous, ...(limit && { limit }) };
      } else {
        const end = now().getTime();
        query = { kind, from: new Date(end - 7 * day).toISOString(), to: new Date(end).toISOString(),
          ...filters, ...(limit && { limit }) };
      }
      const checked = auditRepositoryQuerySchema.safeParse(query);
      if (!checked.success) throw invalidQuery();

      try {
        const { items, has_more, next_after } = await repository.list(checked.data);
        let next_cursor = null;
        if (has_more) {
          const next = cursorSchema.parse({ version: 1, query: { ...checked.data, after: next_after } });
          const payload = Buffer.from(JSON.stringify(next)).toString('base64url');
          next_cursor = payload + '.' + signature(secret, payload);
        }
        return { items, has_more, next_cursor };
      } catch {
        throw auditReadUnavailable();
      }
    },
  };
}

export function createConfiguredAdminAuditService(environment = process.env) {
  try {
    if (!environment.AUDIT_COUCHDB_READER || !environment.AUDIT_COUCHDB_READER_PASSWORD) {
      throw new Error('Missing reader configuration');
    }
    const config = getAuditDatabaseConfig({
      ...environment,
      AUDIT_COUCHDB_USER: environment.AUDIT_COUCHDB_READER,
      AUDIT_COUCHDB_PASSWORD: environment.AUDIT_COUCHDB_READER_PASSWORD,
    });
    return createAdminAuditService({ repository: new AuditEventRepository(config), secret: environment.AUDIT_CURSOR_SECRET });
  } catch {
    throw auditReadUnavailable();
  }
}
