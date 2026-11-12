import { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { JobApplicationRepository } from './job-application.repository.js';
import { ApiError } from '../middleware/job-application.middleware.js';
import { canonicalHash } from '../utils/normalization.utils.js';
import { deliveryIncidentSchema } from '../schemas/audit-outbox.schema.js';

export const auditSourceDesignPath = '_design/job_application_audit_v1';

function sourceView(includeUsers) {
  const userFilter = includeUsers ? " && doc.type !== 'user'" : '';
  return { map: `function(doc) {
        if (doc.type !== 'application' && doc.type !== 'job'${userFilter}) return;
        (doc.audit_outbox || []).forEach(function(entry) {
          if (entry.state === 'pending') emit([entry.event.occurred_at, entry.event.event_id, doc._id], null);
        });
      }` };
}

export function buildAuditSourceDesignV1(worker, { includeUsers = true } = {}) {
  const userFilter = includeUsers ? " && doc.type !== 'user'" : '';
  const userGuard = includeUsers ? " && old.type !== 'user'" : '';
  return {
    _id: auditSourceDesignPath, language: 'javascript', worker,
    views: { pending: sourceView(includeUsers) },
    validate_doc_update: `function(next, old, user) {
      if (user.name !== ${JSON.stringify(worker)}) return;
      var deny = function() { throw {forbidden: 'Audit source worker may only settle one pending event.'}; };
      var same = function(a, b) {
        if (a === b) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object' ||
            Array.isArray(a) !== Array.isArray(b)) return false;
        var keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(function(key) {
          return Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]);
        });
      };
      if (!old || next._deleted || (old.type !== 'application' && old.type !== 'job'${userGuard})) deny();
      var fields = function(doc) {
        var result = {};
        Object.keys(doc).forEach(function(key) {
          if (key !== '_rev' && key !== '_revisions' && key !== 'audit_outbox') result[key] = doc[key];
        });
        return result;
      };
      if (!same(fields(old), fields(next))) deny();
      var before = old.audit_outbox || [];
      var after = next.audit_outbox || [];
      if (!Array.isArray(after)) deny();
      var allowed = before.some(function(entry, index) {
        if (entry.state !== 'pending') return false;
        var remaining = before.slice();
        remaining.splice(index, 1);
        if (same(remaining, after)) return true;
        var candidate = after[index];
        if (!candidate || ['EVENT_ID_CONFLICT', 'EVENT_RETENTION_EXPIRED'].indexOf(candidate.code) < 0) return false;
        remaining.splice(index, 0, {state: 'quarantined', event: entry.event, code: candidate.code});
        return same(remaining, after);
      });
      if (!allowed) deny();
    }`,
  };
}

export function buildAuditSourceDesign(worker, { includeUsers = true } = {}) {
  const userGuard = includeUsers ? " && old.type !== 'user'" : '';
  return {
    _id: auditSourceDesignPath, language: 'javascript', worker, audit_source_version: 2,
    views: { pending: sourceView(includeUsers) },
    validate_doc_update: `function(next, old, user) {
      if (user.name !== ${JSON.stringify(worker)}) return;
      var deny = function() { throw {forbidden: 'Audit source worker may only update one pending event.'}; };
      var same = function(a, b) {
        if (a === b) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object' ||
            Array.isArray(a) !== Array.isArray(b)) return false;
        var keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(function(key) {
          return Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]);
        });
      };
      var uuid = function(value) { return typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); };
      var timestamp = function(value) { return typeof value === 'string' &&
        /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(value); };
      var validIncident = function(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        var keys = Object.keys(value).sort().join(',');
        if (keys !== (value.recovered_at ?
            'attempts,code,failure_event_id,first_failed_at,last_failed_at,recovered_at,recovery_event_id' :
            'attempts,code,failure_event_id,first_failed_at,last_failed_at,recovery_event_id')) return false;
        return ['EVENT_STORE_UNAVAILABLE', 'EVENT_ID_CONFLICT'].indexOf(value.code) >= 0 &&
          uuid(value.failure_event_id) && uuid(value.recovery_event_id) &&
          timestamp(value.first_failed_at) && timestamp(value.last_failed_at) &&
          typeof value.attempts === 'number' && value.attempts % 1 === 0 &&
          value.attempts >= 1 && value.attempts <= 2147483647 &&
          value.first_failed_at <= value.last_failed_at &&
          (!value.recovered_at || (timestamp(value.recovered_at) &&
            value.recovered_at >= value.last_failed_at && value.code !== 'EVENT_ID_CONFLICT'));
      };
      var incidentChange = function(before, after) {
        if (!validIncident(after)) return false;
        if (!before) return after.attempts === 1 && !after.recovered_at;
        if (!validIncident(before) || before.recovered_at || before.code !== after.code ||
            before.failure_event_id !== after.failure_event_id ||
            before.recovery_event_id !== after.recovery_event_id ||
            before.first_failed_at !== after.first_failed_at) return false;
        if (after.recovered_at) return after.attempts === before.attempts &&
          after.last_failed_at === before.last_failed_at;
        return after.attempts === before.attempts + 1 && after.last_failed_at >= before.last_failed_at;
      };
      if (!old || next._deleted || (old.type !== 'application' && old.type !== 'job'${userGuard})) deny();
      var fields = function(doc) {
        var result = {};
        Object.keys(doc).forEach(function(key) {
          if (key !== '_rev' && key !== '_revisions' && key !== 'audit_outbox') result[key] = doc[key];
        });
        return result;
      };
      if (!same(fields(old), fields(next))) deny();
      var before = old.audit_outbox || [];
      var after = next.audit_outbox || [];
      if (!Array.isArray(after)) deny();
      var allowed = before.some(function(entry, index) {
        if (entry.state !== 'pending') return false;
        var remaining = before.slice();
        remaining.splice(index, 1);
        if (same(remaining, after)) return true;
        var candidate = after[index];
        if (candidate && candidate.state === 'quarantined' &&
            ['EVENT_ID_CONFLICT', 'EVENT_RETENTION_EXPIRED'].indexOf(candidate.code) >= 0) {
          remaining.splice(index, 0, {state: 'quarantined', event: entry.event, code: candidate.code});
          if (same(remaining, after)) return true;
          remaining.splice(index, 1);
        }
        if (candidate && candidate.state === 'pending' && same(candidate.event, entry.event) &&
            incidentChange(entry.delivery_incident, candidate.delivery_incident)) {
          remaining.splice(index, 0, candidate);
          return same(remaining, after);
        }
        return false;
      });
      if (!allowed) deny();
    }`,
  };
}

export class JobApplicationAuditSource {
  constructor(repository, { worker, now = () => new Date() }) {
    this.repository = repository;
    this.worker = worker;
    this.now = now;
  }

  async listPending(limit) {
    const design = await this.repository.get(auditSourceDesignPath);
    const { _rev, ...storedDesign } = design ?? {};
    if (canonicalHash(storedDesign) !== canonicalHash(buildAuditSourceDesign(this.worker))) {
      throw new Error('Audit source guard is not provisioned for this worker.');
    }
    const result = await this.repository.http(auditSourceDesignPath + '/_view/pending?limit=' + limit + '&include_docs=true');
    if (!result) throw new Error('Application/Job audit source view is unavailable.');
    const cutoff = this.now().getTime() - 180 * 86400000;
    return result.rows.flatMap(row => {
      const entry = row.doc?.audit_outbox?.find(item => item.event.event_id === row.key[1] && item.state === 'pending');
      if (!entry) return [];
      return [{
        sourceRef: row.id, event: entry.event,
        ...(entry.delivery_incident && { deliveryIncident: entry.delivery_incident }),
        ...(Date.parse(entry.event.occurred_at) < cutoff && { quarantineCode: 'EVENT_RETENTION_EXPIRED' }),
      }];
    });
  }

  async readEntry(sourceRef, eventId) {
    const document = await this.repository.get(sourceRef);
    const entry = document?.audit_outbox?.find(item => item.event.event_id === eventId);
    return entry ? { ...entry, revision: document._rev } : null;
  }

  async updateEntry({ sourceRef, eventId, revision, disposition, code, incident }) {
    const document = await this.repository.get(sourceRef);
    if (!document || document._rev !== revision) {
      throw new ApiError(409, 'CONFLICT', 'Audit source revision changed.');
    }
    const audit_outbox = document.audit_outbox.flatMap(entry => {
      if (entry.event.event_id !== eventId) return [entry];
      if (disposition === 'quarantined') return [{ state: 'quarantined', event: entry.event, code }];
      if (disposition === 'incident') {
        const parsed = deliveryIncidentSchema.parse(incident);
        return [{ state: 'pending', event: entry.event, delivery_incident: parsed }];
      }
      return [];
    });
    const saved = await this.repository.put({ ...document, audit_outbox }, {
      allowLegacyUnavailable: document.provenance?.classification === 'unavailable',
    });
    const entry = saved.audit_outbox?.find(item => item.event.event_id === eventId);
    return entry ? { ...entry, revision: saved._rev } : null;
  }
}

export async function provisionAuditSource(repository, worker) {
  const design = buildAuditSourceDesign(worker);
  const existing = await repository.get(auditSourceDesignPath);
  if (!existing) {
    await repository.put(design);
    return;
  }
  const { _rev, ...stored } = existing;
  const hash = canonicalHash(stored);
  if (hash === canonicalHash(design)) return;
  const knownPolicies = [
    buildAuditSourceDesignV1(worker),
    buildAuditSourceDesignV1(worker, { includeUsers: false }),
    buildAuditSourceDesign(worker, { includeUsers: false }),
  ].map(policy => canonicalHash(policy));
  if (!knownPolicies.includes(hash)) {
    throw new Error('Existing audit source design differs from requested policy.');
  }
  await repository.put({ ...design, _rev });
}

export function createAuditSource(environment) {
  const worker = environment.AUDIT_SOURCE_COUCHDB_USER;
  const password = environment.AUDIT_SOURCE_COUCHDB_PASSWORD;
  if (!worker || !password || worker === environment.COUCHDB_USER) {
    throw new Error('Explicit, separate Application/Job audit source worker credentials are required.');
  }
  const config = getAuthDatabaseConfig({ ...environment, COUCHDB_USER: worker, COUCHDB_PASSWORD: password });
  const authHeader = 'Basic ' + Buffer.from(worker + ':' + password).toString('base64');
  return new JobApplicationAuditSource(new JobApplicationRepository({ ...config, authHeader }), { worker });
}
