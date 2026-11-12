import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AuditDeliveryService } from '../../src/services/audit-delivery.service.js';

function event() {
  return {
    schema_version: 1, kind: 'audit_trail', event_id: randomUUID(), correlation_id: randomUUID(),
    occurred_at: '2026-11-12T12:00:00.000Z', outcome: 'SUCCEEDED', action: 'APPLICATION_STAGE_CHANGED',
    actor: { type: 'USER', id: 'user:demo', role: 'RECRUITER' },
    subject: { type: 'APPLICATION', id: 'application:demo' },
    change: { field: 'current_stage', from: 'SCREENING', to: 'INTERVIEW' },
  };
}

function fixture(...events) {
  let revision = 1;
  const pending = new Map(events.map(event => [event.event_id, { event, state: 'pending' }]));
  const records = new Map();
  const source = {
    async listPending(limit) {
      return [...pending.values()].filter(entry => entry.state === 'pending').slice(0, limit)
        .map(({ event, delivery_incident }) => ({ sourceRef: 'application:demo', event: structuredClone(event),
          ...(delivery_incident && { deliveryIncident: structuredClone(delivery_incident) }) }));
    },
    async readEntry(_sourceRef, id) {
      const entry = pending.get(id);
      return entry ? { ...structuredClone(entry), revision } : null;
    },
    async updateEntry(update) {
      if (update.revision !== revision) throw Object.assign(new Error(), { status: 409 });
      if (update.disposition === 'delivered') pending.delete(update.eventId);
      else if (update.disposition === 'quarantined') Object.assign(pending.get(update.eventId), { state: 'quarantined', code: update.code });
      else pending.get(update.eventId).delivery_incident = structuredClone(update.incident);
      revision++;
      const entry = pending.get(update.eventId);
      return entry ? { ...structuredClone(entry), revision } : null;
    },
  };
  const sink = {
    async append(event) {
      const stored = records.get(event.event_id);
      if (stored && JSON.stringify(stored) !== JSON.stringify(event)) {
        throw Object.assign(new Error('private detail'), { code: 'EVENT_ID_CONFLICT' });
      }
      records.set(event.event_id, structuredClone(event));
      return { event_id: event.event_id, created: !stored };
    },
  };
  return { source, sink, pending, records, worker: () => new AuditDeliveryService({ source, sink }) };
}

test('Sink outage and lost response preserve pending, restart delivers the same event only once', async () => {
  const input = event();
  const f = fixture(input);
  const append = f.sink.append;
  f.sink.append = async () => { throw new Error('offline'); };
  assert.equal((await f.worker().runBatch()).sink_retryable, 1);
  assert.equal(f.records.size, 0);
  assert.equal(f.pending.size, 1);
  const incident = structuredClone(f.pending.get(input.event_id).delivery_incident);
  assert.equal(incident.attempts, 1);
  f.sink.append = async value => { await append(value); throw new Error('response lost'); };
  assert.equal((await f.worker().runBatch()).sink_retryable, 1);
  assert.equal(f.records.size, 1);
  assert.equal(f.pending.size, 1);
  assert.equal(f.pending.get(input.event_id).delivery_incident.failure_event_id, incident.failure_event_id);
  assert.equal(f.pending.get(input.event_id).delivery_incident.attempts, 2);
  f.sink.append = append;
  const recovery = await f.worker().runBatch();
  assert.equal(recovery.delivered, 1);
  assert.equal(recovery.failures_logged, 1);
  assert.equal(recovery.recoveries_logged, 1);
  assert.equal(f.pending.size, 0);
  assert.deepEqual(f.records.get(input.event_id), input);
  assert.equal(f.records.get(incident.failure_event_id).action, 'AUDIT_DELIVERY_FAILED');
  assert.equal(f.records.get(incident.recovery_event_id).action, 'AUDIT_DELIVERY_RECOVERED');
});

test('Overlapping workers reconcile an ack conflict without removing other pending events', async () => {
  const first = event();
  const second = event();
  const f = fixture(first, second);
  const reports = await Promise.all([f.worker().runBatch({ limit: 1 }), f.worker().runBatch({ limit: 1 })]);
  assert.equal(reports.reduce((sum, report) => sum + report.delivered, 0), 1);
  assert.equal(reports.reduce((sum, report) => sum + report.already_settled, 0), 1);
  assert.deepEqual([...f.pending.keys()], [second.event_id]);
  assert.equal(f.records.size, 1);
});

test('Revision retries are bounded and a changed source entry is preserved', async () => {
  const first = event();
  const f = fixture(first);
  let attempts = 0;
  f.source.updateEntry = async () => { attempts++; throw Object.assign(new Error(), { status: 409 }); };
  assert.equal((await f.worker().runBatch()).source_retryable, 1);
  assert.equal(attempts, 4);
  assert.equal(f.pending.size, 1);
  const read = f.source.readEntry;
  f.source.readEntry = async (...args) => {
    const current = await read(...args);
    current.event.correlation_id = randomUUID();
    return current;
  };
  assert.equal((await f.worker().runBatch()).source_changed, 1);
  assert.equal(attempts, 4);
});

test('Integrity conflict is quarantined and later valid events in the batch are delivered', async () => {
  const bad = event();
  const good = event();
  const f = fixture(bad, good);
  f.records.set(bad.event_id, { ...bad, correlation_id: randomUUID() });
  const report = await f.worker().runBatch();
  assert.equal(report.quarantined, 1);
  assert.equal(report.delivered, 1);
  assert.equal(report.failures_logged, 1);
  assert.equal(f.pending.get(bad.event_id).state, 'quarantined');
  assert.equal(f.pending.get(bad.event_id).code, 'EVENT_ID_CONFLICT');
  assert.doesNotMatch(JSON.stringify(report), /private detail|user:demo/);
  assert.equal((await f.worker().runBatch()).scanned, 0);
});

for (const lostKind of ['failure_event_id', 'recovery_event_id']) {
  test(`Lost response for ${lostKind} is reconciled with the persisted incident IDs`, async () => {
    const input = event();
    const f = fixture(input);
    const append = f.sink.append.bind(f.sink);
    f.sink.append = async () => { throw Object.assign(new Error('offline'), { code: 'EVENT_STORE_UNAVAILABLE' }); };
    assert.equal((await f.worker().runBatch()).sink_retryable, 1);
    const incident = structuredClone(f.pending.get(input.event_id).delivery_incident);
    let lost = false;
    f.sink.append = async value => {
      const result = await append(value);
      if (!lost && value.event_id === incident[lostKind]) {
        lost = true;
        throw Object.assign(new Error('response lost'), { code: 'EVENT_STORE_UNAVAILABLE' });
      }
      return result;
    };
    assert.equal((await f.worker().runBatch()).sink_retryable, 1);
    assert.equal(f.pending.size, 1);
    assert.equal(f.pending.get(input.event_id).delivery_incident.failure_event_id, incident.failure_event_id);
    assert.equal(f.pending.get(input.event_id).delivery_incident.recovery_event_id, incident.recovery_event_id);
    f.sink.append = append;
    assert.equal((await f.worker().runBatch()).delivered, 1);
    assert.equal(f.pending.size, 0);
    assert.equal(f.records.get(incident.failure_event_id).action, 'AUDIT_DELIVERY_FAILED');
    assert.equal(f.records.get(incident.recovery_event_id).action, 'AUDIT_DELIVERY_RECOVERED');
  });
}

test('A lost source response reconciles committed incident metadata without changing IDs', async () => {
  const input = event();
  const f = fixture(input);
  f.sink.append = async () => { throw Object.assign(new Error('offline'), { code: 'EVENT_STORE_UNAVAILABLE' }); };
  const update = f.source.updateEntry.bind(f.source);
  let lost = false;
  f.source.updateEntry = async value => {
    const result = await update(value);
    if (!lost && value.disposition === 'incident') {
      lost = true;
      throw new Error('source response lost');
    }
    return result;
  };
  const report = await f.worker().runBatch();
  assert.equal(report.sink_retryable, 1);
  assert.equal(report.incidents_recorded, 1);
  assert.ok(f.pending.get(input.event_id).delivery_incident.failure_event_id);
});

test('A lost source response after settle is reconciled as delivered', async () => {
  const input = event();
  const f = fixture(input);
  const update = f.source.updateEntry.bind(f.source);
  f.source.updateEntry = async value => {
    const result = await update(value);
    if (value.disposition === 'delivered') throw new Error('source response lost');
    return result;
  };
  const report = await f.worker().runBatch();
  assert.equal(report.delivered, 1);
  assert.equal(report.source_retryable, 0);
  assert.equal(f.pending.size, 0);
});

test('Source incident outage emits only a sanitized fallback and keeps the pending event', async () => {
  const input = event();
  const f = fixture(input);
  const fallback = [];
  f.sink.append = async () => { throw new Error('private sink endpoint'); };
  f.source.updateEntry = async () => { throw new Error('private source credentials'); };
  const report = await new AuditDeliveryService({
    source: f.source, sink: f.sink, fallback: record => fallback.push(record),
  }).runBatch();
  assert.equal(report.source_retryable, 1);
  assert.equal(report.sink_retryable, 0);
  assert.equal(f.pending.size, 1);
  assert.equal(f.pending.get(input.event_id).delivery_incident, undefined);
  assert.equal(fallback.length, 1);
  assert.deepEqual(Object.keys(fallback[0]).sort(), [
    'action', 'code', 'correlation_id', 'event_id', 'kind', 'level', 'occurred_at',
  ]);
  assert.doesNotMatch(JSON.stringify(fallback), /private|credentials|endpoint|user:demo/i);
});

test('Malformed or mismatched incident state is preserved instead of crashing or quarantining', async () => {
  const malformedEvent = event();
  const malformed = fixture(malformedEvent);
  malformed.pending.get(malformedEvent.event_id).delivery_incident = { code: 'EVENT_STORE_UNAVAILABLE' };
  const malformedReport = await malformed.worker().runBatch();
  assert.equal(malformedReport.invalid_source, 1);
  assert.equal(malformed.pending.get(malformedEvent.event_id).state, 'pending');

  const mismatchedEvent = event();
  const mismatched = fixture(mismatchedEvent);
  mismatched.sink.append = async () => { throw new Error('offline'); };
  await mismatched.worker().runBatch();
  mismatched.sink.append = async () => {
    throw Object.assign(new Error('conflict'), { code: 'EVENT_ID_CONFLICT' });
  };
  const mismatchedReport = await mismatched.worker().runBatch();
  assert.equal(mismatchedReport.source_changed, 1);
  assert.equal(mismatchedReport.quarantined, 0);
  assert.equal(mismatched.pending.get(mismatchedEvent.event_id).state, 'pending');
});
