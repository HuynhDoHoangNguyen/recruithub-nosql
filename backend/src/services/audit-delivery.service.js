import { randomUUID } from 'node:crypto';
import { deliveryIncidentSchema } from '../schemas/audit-outbox.schema.js';
import { auditEventSchema } from '../schemas/audit-event.schema.js';
import { canonicalHash } from '../utils/normalization.utils.js';
import { auditDeliveryFailedEvent, auditDeliveryRecoveredEvent } from './system-event.service.js';

function isRevisionConflict(error) {
  return error?.status === 409 || error?.code === 'CONFLICT';
}

const same = (left, right) => canonicalHash(left) === canonicalHash(right);

/**
 * Source adapter:
 * listPending(limit) returns committed { sourceRef, event, deliveryIncident?, quarantineCode? } entries.
 * readEntry(sourceRef, eventId) returns the current outbox entry plus revision.
 * updateEntry supports disposition delivered, quarantined, or incident and preserves business fields.
 */
export class AuditDeliveryService {
  constructor({ source, sink, now = () => new Date(), fallback = () => {} }) {
    this.source = source;
    this.sink = sink;
    this.now = now;
    this.fallback = fallback;
  }

  #timestamp() {
    return new Date(this.now()).toISOString();
  }

  #emitFallback(code, event) {
    try {
      this.fallback({
        level: 'ERROR', kind: 'AUDIT_DELIVERY_FALLBACK', action: 'AUDIT_DELIVERY_FAILED', code,
        event_id: event.event_id, correlation_id: event.correlation_id, occurred_at: this.#timestamp(),
      });
    } catch { /* Operational fallback must not crash the worker. */ }
  }

  async #append(event) {
    const result = await this.sink.append(event);
    if (result?.event_id !== event.event_id || typeof result.created !== 'boolean') {
      throw Object.assign(new Error('Invalid audit sink acknowledgement.'), { code: 'EVENT_STORE_UNAVAILABLE' });
    }
    return result;
  }

  async #settle(sourceRef, event, disposition, code) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const current = await this.source.readEntry(sourceRef, event.event_id);
        if (!current || current.state === 'quarantined') return 'already_settled';
        if (!same(current.event, event)) return 'source_changed';
        await this.source.updateEntry({
          sourceRef, eventId: event.event_id, revision: current.revision, disposition, code,
        });
        return disposition;
      } catch (error) {
        if (isRevisionConflict(error) && attempt < 3) continue;
        try {
          const reconciled = await this.source.readEntry(sourceRef, event.event_id);
          if (disposition === 'delivered' && !reconciled) return 'delivered';
          if (disposition === 'quarantined' && reconciled?.state === 'quarantined'
            && reconciled.code === code) return 'quarantined';
        } catch { /* Return the retryable result below. */ }
        return 'source_retryable';
      }
    }
  }

  async #writeIncident(sourceRef, event, change) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      let current;
      try { current = await this.source.readEntry(sourceRef, event.event_id); }
      catch { return { status: 'source_retryable' }; }
      if (!current || current.state === 'quarantined') return { status: 'already_settled' };
      if (!same(current.event, event)) return { status: 'source_changed' };
      let nextIncident;
      try {
        nextIncident = deliveryIncidentSchema.parse(change(current.delivery_incident));
      } catch {
        return { status: 'source_changed' };
      }
      if (current.delivery_incident && same(current.delivery_incident, nextIncident)) {
        return { status: 'incident', incident: current.delivery_incident, created: false };
      }
      try {
        await this.source.updateEntry({
          sourceRef, eventId: event.event_id, revision: current.revision,
          disposition: 'incident', incident: nextIncident,
        });
        return { status: 'incident', incident: nextIncident, created: !current.delivery_incident };
      } catch (error) {
        if (isRevisionConflict(error) && attempt < 3) continue;
        try {
          const reconciled = await this.source.readEntry(sourceRef, event.event_id);
          if (reconciled?.delivery_incident && same(reconciled.delivery_incident, nextIncident)) {
            return { status: 'incident', incident: reconciled.delivery_incident, created: !current.delivery_incident };
          }
        } catch { /* Return the sanitized retryable result below. */ }
        return { status: 'source_retryable' };
      }
    }
    return { status: 'source_retryable' };
  }

  #recordFailure(sourceRef, event, code) {
    const occurredAt = this.#timestamp();
    const candidate = {
      code, failure_event_id: randomUUID(), recovery_event_id: randomUUID(),
      first_failed_at: occurredAt, last_failed_at: occurredAt, attempts: 1,
    };
    return this.#writeIncident(sourceRef, event, current => {
      if (!current) return candidate;
      if (current.recovered_at || current.code !== code) return current;
      return { ...current, last_failed_at: occurredAt < current.last_failed_at ? current.last_failed_at : occurredAt,
        attempts: Math.min(2147483647, current.attempts + 1) };
    });
  }

  #markRecovered(sourceRef, event) {
    const recoveredAt = this.#timestamp();
    return this.#writeIncident(sourceRef, event, current => {
      if (!current) throw new Error('Delivery incident is missing.');
      return current.recovered_at ? current : { ...current, recovered_at: recoveredAt < current.last_failed_at
        ? current.last_failed_at : recoveredAt };
    });
  }

  async #logConflict(sourceRef, event, report) {
    const recorded = await this.#recordFailure(sourceRef, event, 'EVENT_ID_CONFLICT');
    if (recorded.status !== 'incident') {
      report[recorded.status]++;
      if (recorded.status === 'source_retryable') this.#emitFallback('SOURCE_INCIDENT_UNAVAILABLE', event);
      return;
    }
    if (recorded.incident.code !== 'EVENT_ID_CONFLICT') {
      report.source_changed++;
      return;
    }
    if (recorded.created) report.incidents_recorded++;
    try {
      const failure = await this.#append(auditDeliveryFailedEvent(event, recorded.incident));
      if (failure.created) report.failures_logged++;
    } catch {
      report.sink_retryable++;
      return;
    }
    report[await this.#settle(sourceRef, event, 'quarantined', 'EVENT_ID_CONFLICT')]++;
  }

  async #recover(sourceRef, event, report) {
    try { await this.#append(event); }
    catch (error) {
      if (error?.code === 'EVENT_ID_CONFLICT') return this.#logConflict(sourceRef, event, report);
      const repeated = await this.#recordFailure(sourceRef, event, 'EVENT_STORE_UNAVAILABLE');
      if (repeated.status !== 'incident') {
        report[repeated.status]++;
        if (repeated.status === 'source_retryable') this.#emitFallback('SOURCE_INCIDENT_UNAVAILABLE', event);
      } else report.sink_retryable++;
      return;
    }
    const recovered = await this.#markRecovered(sourceRef, event);
    if (recovered.status !== 'incident') {
      report[recovered.status]++;
      if (recovered.status === 'source_retryable') this.#emitFallback('SOURCE_RECOVERY_UNAVAILABLE', event);
      return;
    }
    try {
      const failure = await this.#append(auditDeliveryFailedEvent(event, recovered.incident));
      if (failure.created) report.failures_logged++;
      const recovery = await this.#append(auditDeliveryRecoveredEvent(event, recovered.incident));
      if (recovery.created) report.recoveries_logged++;
    } catch {
      report.sink_retryable++;
      return;
    }
    report[await this.#settle(sourceRef, event, 'delivered')]++;
  }

  async runBatch({ limit = 50 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('Audit delivery batch size must be between 1 and 100.');
    }
    const entries = await this.source.listPending(limit);
    if (!Array.isArray(entries) || entries.length > limit) throw new Error('Invalid audit source batch.');

    const report = {
      scanned: entries.length, delivered: 0, already_settled: 0, quarantined: 0,
      sink_retryable: 0, source_retryable: 0, source_changed: 0, invalid_source: 0,
      incidents_recorded: 0, failures_logged: 0, recoveries_logged: 0,
    };
    for (const { sourceRef, event: input, deliveryIncident, quarantineCode } of entries) {
      const parsed = auditEventSchema.safeParse(input);
      if (!parsed.success) {
        report.invalid_source++;
        continue;
      }
      const event = parsed.data;
      if (quarantineCode === 'EVENT_RETENTION_EXPIRED') {
        report[await this.#settle(sourceRef, event, 'quarantined', quarantineCode)]++;
        continue;
      }
      const incident = deliveryIncident ? deliveryIncidentSchema.safeParse(deliveryIncident) : null;
      if (incident && !incident.success) {
        report.invalid_source++;
        continue;
      }
      if (incident?.data?.code === 'EVENT_ID_CONFLICT') {
        await this.#logConflict(sourceRef, event, report);
        continue;
      }
      if (incident?.data?.code === 'EVENT_STORE_UNAVAILABLE') {
        await this.#recover(sourceRef, event, report);
        continue;
      }
      try { await this.#append(event); }
      catch (error) {
        if (error?.code === 'EVENT_ID_CONFLICT') {
          await this.#logConflict(sourceRef, event, report);
          continue;
        }
        const recorded = await this.#recordFailure(sourceRef, event, 'EVENT_STORE_UNAVAILABLE');
        if (recorded.status !== 'incident') {
          report[recorded.status]++;
          if (recorded.status === 'source_retryable') this.#emitFallback('SOURCE_INCIDENT_UNAVAILABLE', event);
        } else {
          if (recorded.created) report.incidents_recorded++;
          report.sink_retryable++;
        }
        continue;
      }
      report[await this.#settle(sourceRef, event, 'delivered')]++;
    }
    return report;
  }
}
