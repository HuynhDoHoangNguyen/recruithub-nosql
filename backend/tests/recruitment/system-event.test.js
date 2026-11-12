import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ApiError } from '../../src/middleware/job-application.middleware.js';
import { auditEventSchema } from '../../src/schemas/audit-event.schema.js';
import {
  createConfiguredSystemEventReporter,
  createSystemEventReporter,
  isDependencyWriteFailure,
  writeSystemEventFallback,
} from '../../src/services/system-event.service.js';
import { advance, apply, jobInput, startFixture } from './fixtures.js';

test('Dependency write classifier includes infrastructure failures and excludes conflicts and audit backlog', () => {
  for (const code of ['DATABASE_UNAVAILABLE', 'DATABASE_NOT_FOUND', 'NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR']) {
    assert.equal(isDependencyWriteFailure({ code }), true, code);
  }
  assert.equal(isDependencyWriteFailure({ status: 502, code: 'UPSTREAM_ERROR' }), true);
  assert.equal(isDependencyWriteFailure({ status: 503, code: 'AUDIT_BACKLOG_FULL' }), false);
  assert.equal(isDependencyWriteFailure({ status: 409, code: 'CONFLICT' }), false);
  assert.equal(isDependencyWriteFailure(new Error('programming defect')), false);
});

test('System reporter appends one strict allowlisted dependency event with server identifiers', async () => {
  const stored = [];
  const correlationId = randomUUID();
  const reporter = createSystemEventReporter({
    sink: { async append(event) { stored.push(structuredClone(event)); return { event_id: event.event_id, created: true }; } },
    now: () => new Date('2026-11-12T12:34:56.789Z'),
  });
  const result = await reporter.dependencyWriteFailed({
    actor: { _id: 'user:actor', role: 'RECRUITER', email: 'private@example.invalid' },
    component: 'job', correlationId,
  });
  assert.equal(result.logged, true);
  assert.equal(stored.length, 1);
  assert.deepEqual(auditEventSchema.parse(stored[0]), stored[0]);
  assert.equal(stored[0].correlation_id, correlationId);
  assert.deepEqual(stored[0].actor, { type: 'USER', id: 'user:actor', role: 'RECRUITER' });
  assert.deepEqual(stored[0].subject, { type: 'COMPONENT', id: 'job' });
  assert.equal(stored[0].outcome, 'UNKNOWN');
  assert.doesNotMatch(JSON.stringify(stored), /private@example|password|token|url/i);
});

test('Unavailable or invalid audit configuration emits one sanitized fallback and never throws', async () => {
  const fallback = [];
  const reporter = createConfiguredSystemEventReporter({}, {
    now: () => new Date('2026-11-12T12:34:56.789Z'),
    fallback: record => fallback.push(record),
  });
  const result = await reporter.dependencyWriteFailed({
    actor: { _id: 'user:actor', role: 'RECRUITER', password: 'never-print' },
    component: 'application', correlationId: randomUUID(),
  });
  assert.equal(result.logged, false);
  assert.equal(fallback.length, 1);
  assert.deepEqual(Object.keys(fallback[0]).sort(), [
    'action', 'code', 'component', 'correlation_id', 'event_id', 'kind', 'level', 'occurred_at',
  ]);
  assert.doesNotMatch(JSON.stringify(fallback), /never-print|credential|localhost|stack/i);

  const invalidFallback = [];
  const invalid = createSystemEventReporter({ fallback: record => invalidFallback.push(record) });
  await assert.doesNotReject(() => invalid.dependencyWriteFailed({
    actor: {}, component: 'secret-component', correlationId: 'Bearer private-token',
  }));
  assert.equal(invalidFallback[0].component, 'unknown');
  assert.notEqual(invalidFallback[0].correlation_id, 'Bearer private-token');
  assert.doesNotMatch(JSON.stringify(invalidFallback), /private-token|secret-component/);

  const brokenFallback = createSystemEventReporter({ fallback: () => { throw new Error('stderr unavailable'); } });
  await assert.doesNotReject(() => brokenFallback.dependencyWriteFailed({ actor: {}, component: 'application' }));
});

test('Default fallback writes one JSON line and suppresses stream failures', () => {
  let output = '';
  const record = { action: 'DEPENDENCY_WRITE_FAILED', code: 'BUSINESS_STORE_UNAVAILABLE' };
  writeSystemEventFallback(record, { write(value) { output += value; } });
  assert.deepEqual(JSON.parse(output), record);
  assert.doesNotThrow(() => writeSystemEventFallback(record, { write() { throw new Error('closed'); } }));
});

test('Application and Job write failures preserve the original API error and report each covered component', async t => {
  const calls = [];
  const systemEvents = { async dependencyWriteFailed(context) { calls.push(structuredClone(context)); } };
  const f = await startFixture(t, { systemEvents, analyzeApplication: async () => {} });
  const outage = () => { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Fixture storage unavailable.'); };

  f.repo.beforePut = outage;
  const jobCreate = await f.request('POST', '/jobs', { ...jobInput, status: 'DRAFT' }, 'recruiter');
  assert.equal(jobCreate.status, 503);
  assert.equal(jobCreate.body.error.code, 'DATABASE_UNAVAILABLE');

  const applicationCreate = await apply(f);
  assert.equal(applicationCreate.status, 503);
  assert.equal(applicationCreate.body.error.code, 'DATABASE_UNAVAILABLE');

  f.repo.beforePut = null;
  const application = (await apply(f)).body.data;
  f.repo.beforePut = outage;
  const transition = await advance(f, application, 'SCREENING');
  assert.equal(transition.status, 503);
  assert.equal(transition.body.error.code, 'DATABASE_UNAVAILABLE');

  const job = await f.repo.get(f.job._id);
  const update = await f.request('PATCH', `/jobs/${job._id}`, { title: 'Không lưu được', expected_rev: job._rev }, 'recruiter');
  assert.equal(update.status, 503);
  const remove = await f.request('DELETE', `/jobs/${job._id}`, { expected_rev: job._rev }, 'recruiter');
  assert.equal(remove.status, 503);

  assert.deepEqual(calls.map(call => call.component), ['job', 'application', 'application', 'job', 'job']);
  assert.ok(calls.every(call => /^[0-9a-f-]{36}$/.test(call.correlationId)));
  assert.deepEqual(calls.map(call => call.actor.role), ['RECRUITER', 'CANDIDATE', 'RECRUITER', 'RECRUITER', 'RECRUITER']);
});

test('Conflict responses do not emit dependency events', async t => {
  const calls = [];
  const f = await startFixture(t, { systemEvents: { async dependencyWriteFailed(value) { calls.push(value); } } });
  f.repo.beforePut = () => { throw new ApiError(409, 'CONFLICT', 'Fixture conflict.'); };
  const response = await f.request('POST', '/jobs', { ...jobInput, status: 'DRAFT' }, 'recruiter');
  assert.equal(response.status, 409);
  assert.equal(calls.length, 0);
});

