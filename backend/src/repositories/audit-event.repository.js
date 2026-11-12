import { z } from 'zod';
import { assertAuditDatabaseName } from '../config/audit-database.config.js';
import { auditActions, auditEventSchema, eventId, eventKind, eventTimestamp, subjectId, subjectType, systemActions, userId } from '../schemas/audit-event.schema.js';
import { toAuditEventDto } from '../services/audit-event-mapper.js';
import { canonicalHash } from '../utils/normalization.utils.js';

export const auditDesignPath = '_design/recruithub_events_v1';
const day = 86400000;
const retentionDays = { system_log: 30, audit_trail: 180 };
export const auditRepositoryQuerySchema = z.strictObject({
  kind: eventKind, from: eventTimestamp, to: eventTimestamp,
  action: z.enum([...auditActions, ...systemActions]).optional(),
  actorId: userId.optional(),
  subject: z.strictObject({ type: subjectType, id: subjectId }).optional(),
  after: z.strictObject({ occurred_at: eventTimestamp, event_id: eventId }).optional(),
  limit: z.number().int().min(1).max(100).default(25),
}).refine(({ kind, from, to, action, actorId, subject, after }) =>
  from < to && Date.parse(to) - Date.parse(from) <= 30 * day
  && [action, actorId, subject].filter(Boolean).length <= 1
  && (kind === 'audit_trail' || !(actorId || subject))
  && (!action || (kind === 'audit_trail' ? auditActions : systemActions).includes(action))
  && (!after || (after.occurred_at >= from && after.occurred_at < to))
  && (!subject || subject.id.startsWith(subject.type.toLowerCase() + ':')),
'Invalid audit query.');

function storeError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

export function createAuditTransport(config, request = fetch, environment = process.env) {
  assertAuditDatabaseName(config.database, environment);
  const root = config.url + '/' + encodeURIComponent(config.database);
  const authorization = 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64');
  return async (path = '', method = 'GET', body, allowed = []) => {
    try {
      const response = await request(root + (path ? '/' + path : ''), {
        method,
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(config.timeoutMs),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (allowed.includes(response.status)) return { status: response.status };
      if (!response.ok) throw new Error();
      return { status: response.status, data: await response.json() };
    } catch {
      throw storeError('EVENT_STORE_UNAVAILABLE', 'Audit event storage is unavailable.', 503);
    }
  };
}

function viewMap(fields, condition = 'true') {
  return { map: 'function(doc) { if (doc.schema_version === 1 && ' + condition +
    ' && (doc.kind === "audit_trail" || doc.kind === "system_log") && doc._id === "event:" + doc.event_id)' +
    ' emit([' + fields + '], null); }' };
}

export function buildAuditDesign({ writer, pruner }) {
  const suffix = ', doc.occurred_at, doc.event_id';
  return {
    _id: auditDesignPath,
    language: 'javascript',
    audit_store_version: 1,
    views: {
      timeline: viewMap('doc.kind' + suffix),
      by_action: viewMap('doc.kind, doc.action' + suffix),
      by_actor: viewMap('doc.kind, doc.actor.id' + suffix, 'doc.actor && doc.actor.type === "USER"'),
      by_subject: viewMap('doc.kind, doc.subject.type, doc.subject.id' + suffix, 'doc.subject'),
    },
    validate_doc_update: `function(next, old, user) {
      if (next._id.indexOf("_design/") === 0) return;
      if (next._deleted && old && old._id.indexOf("event:") === 0 &&
          user.name === ${JSON.stringify(pruner)}) return;
      if (!old && !next._deleted && user.name === ${JSON.stringify(writer)} &&
          next.schema_version === 1 && next._id === "event:" + next.event_id &&
          (next.kind === "audit_trail" || next.kind === "system_log")) return;
      throw {forbidden: "Audit store write is not permitted."};
    }`,
  };
}

function queryView({ kind, action, actorId, subject }) {
  if (action) return ['by_action', [kind, action]];
  if (actorId) return ['by_actor', [kind, actorId]];
  if (subject) return ['by_subject', [kind, subject.type, subject.id]];
  return ['timeline', [kind]];
}

export class AuditEventRepository {
  constructor(config, request = fetch, environment = process.env) {
    this.http = createAuditTransport(config, request, environment);
  }

  async assertProvisioned() {
    const { data } = await this.http(auditDesignPath);
    if (data?.audit_store_version !== 1) {
      throw storeError('EVENT_STORE_UNAVAILABLE', 'Audit event storage is unavailable.', 503);
    }
  }

  async append(input) {
    const event = auditEventSchema.parse(input);
    await this.assertProvisioned();
    const id = 'event:' + event.event_id;
    const path = encodeURIComponent(id);
    const result = await this.http(path, 'PUT', { ...event, _id: id }, [409]);
    if (result.status !== 409) return { event_id: event.event_id, created: true };
    const { data } = await this.http(path, 'GET', undefined, [404]);
    if (data) {
      const { _id, _rev, ...stored } = data;
      if (canonicalHash(stored) === canonicalHash(event)) return { event_id: event.event_id, created: false };
    }
    throw storeError('EVENT_ID_CONFLICT', 'Audit event ID is already in use.', 409);
  }

  async #readPage(view, prefix, { from, to, after, limit }) {
    const startKey = after ? [...prefix, after.occurred_at, after.event_id] : [...prefix, to];
    const params = new URLSearchParams({
      descending: 'true',
      include_docs: 'true',
      startkey: JSON.stringify(startKey),
      endkey: JSON.stringify(from ? [...prefix, from] : prefix),
      limit: String(limit + (after ? 2 : 1)),
    });
    const { data } = await this.http(auditDesignPath + '/_view/' + view + '?' + params);
    const rows = data.rows.filter(row => !after || row.key.at(-1) !== after.event_id);
    return { rows: rows.slice(0, limit), has_more: rows.length > limit };
  }

  async list(input) {
    const query = auditRepositoryQuerySchema.parse(input);
    const [view, prefix] = queryView(query);
    const { rows, has_more } = await this.#readPage(view, prefix, query);
    const items = rows.map(row => toAuditEventDto(row.doc));
    const last = items.at(-1);
    return {
      items, has_more,
      next_after: has_more ? { occurred_at: last.occurred_at, event_id: last.event_id } : null,
    };
  }

  async #deleteExpired(id, kind, cutoff) {
    const path = encodeURIComponent(id);
    for (let attempt = 0; attempt <= 3; attempt++) {
      const { data } = await this.http(path, 'GET', undefined, [404]);
      if (!data || data.kind !== kind || data.occurred_at >= cutoff) return false;
      const { status } = await this.http(path + '?rev=' + encodeURIComponent(data._rev), 'DELETE', undefined, [404, 409]);
      if (status !== 409) return status !== 404;
    }
    throw storeError('EVENT_RETENTION_CONFLICT', 'Unable to remove an expired audit event.', 409);
  }

  async prune({ now = new Date(), dryRun = true, batchSize = 100 } = {}) {
    z.strictObject({ now: z.date(), dryRun: z.boolean(), batchSize: z.number().int().min(1).max(100) })
      .parse({ now, dryRun, batchSize });
    await this.assertProvisioned();
    const report = {};
    for (const [kind, days] of Object.entries(retentionDays)) {
      const cutoff = new Date(now.getTime() - days * day).toISOString();
      const summary = { cutoff, scanned: 0, deleted: 0, errors: 0 };
      let after;
      let hasMore;
      do {
        const page = await this.#readPage('timeline', [kind], { to: cutoff, after, limit: batchSize });
        for (const row of page.rows) {
          summary.scanned++;
          if (dryRun) continue;
          try {
            if (await this.#deleteExpired(row.id, kind, cutoff)) summary.deleted++;
          } catch {
            summary.errors++;
          }
        }
        const lastKey = page.rows.at(-1)?.key;
        if (lastKey) after = { occurred_at: lastKey.at(-2), event_id: lastKey.at(-1) };
        hasMore = page.has_more;
      } while (hasMore);
      report[kind] = summary;
    }
    return report;
  }
}
