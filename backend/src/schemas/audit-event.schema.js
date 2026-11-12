import { z } from 'zod';
import { APPLICATION_STAGES, JOB_STATUSES } from '../constants/document.constants.js';

export const eventKind = z.enum(['audit_trail', 'system_log']);
export const eventId = z.uuid();
export const eventTimestamp = z.iso.datetime({ precision: 3 });
export const subjectType = z.enum(['APPLICATION', 'JOB', 'USER']);
const identifier = prefix => z.string().max(160).regex(new RegExp(`^${prefix}:[A-Za-z0-9:_-]+$`));
export const userId = identifier('user');
export const subjectId = z.union([userId, identifier('application'), identifier('job')]);
const systemActor = z.strictObject({ type: z.literal('SYSTEM') });
const userActor = role => z.strictObject({ type: z.literal('USER'), id: userId, role });
const anyUser = userActor(z.enum(['ADMIN', 'RECRUITER', 'CANDIDATE']));
const subject = (type, prefix) => z.strictObject({ type: z.literal(type), id: identifier(prefix) });
const common = { schema_version: z.literal(1), event_id: eventId, correlation_id: z.uuid(), occurred_at: eventTimestamp };
const audit = { ...common, kind: z.literal('audit_trail'), outcome: z.literal('SUCCEEDED') };
const system = { ...common, kind: z.literal('system_log') };
const component = id => z.strictObject({ type: z.literal('COMPONENT'), id: z.literal(id) });
const change = (field, value) => z.strictObject({ field: z.literal(field), from: value, to: value })
  .refine(value => value.from !== value.to, 'The value must change.');

export const auditActions = ['APPLICATION_STAGE_CHANGED', 'JOB_STATUS_CHANGED', 'USER_ACCOUNT_STATUS_CHANGED'];
export const systemActions = ['DEPENDENCY_WRITE_FAILED', 'AUDIT_DELIVERY_FAILED', 'AUDIT_DELIVERY_RECOVERED'];

export const auditEventSchema = z.discriminatedUnion('action', [
  z.strictObject({
    ...audit, action: z.literal('APPLICATION_STAGE_CHANGED'),
    actor: userActor(z.enum(['CANDIDATE', 'RECRUITER'])), subject: subject('APPLICATION', 'application'),
    change: change('current_stage', z.enum(APPLICATION_STAGES)),
  }),
  z.strictObject({
    ...audit, action: z.literal('JOB_STATUS_CHANGED'), actor: userActor(z.literal('RECRUITER')),
    subject: subject('JOB', 'job'), change: change('status', z.enum(JOB_STATUSES)),
    operation: z.enum(['STATUS_UPDATE', 'SOFT_DELETE']),
  }),
  z.strictObject({
    ...audit, action: z.literal('USER_ACCOUNT_STATUS_CHANGED'), actor: userActor(z.literal('ADMIN')),
    subject: subject('USER', 'user'), change: change('account_status', z.enum(['ACTIVE', 'LOCKED'])),
  }),
  z.strictObject({
    ...system, action: z.literal('DEPENDENCY_WRITE_FAILED'), actor: anyUser,
    subject: z.strictObject({ type: z.literal('COMPONENT'), id: z.enum(['application', 'job', 'admin-user']) }),
    outcome: z.enum(['FAILED', 'UNKNOWN']), code: z.literal('BUSINESS_STORE_UNAVAILABLE'),
  }),
  z.strictObject({
    ...system, action: z.literal('AUDIT_DELIVERY_FAILED'), actor: systemActor, subject: component('audit-delivery'),
    outcome: z.enum(['FAILED', 'UNKNOWN']), code: z.enum(['EVENT_STORE_UNAVAILABLE', 'EVENT_ID_CONFLICT']),
  }),
  z.strictObject({
    ...system, action: z.literal('AUDIT_DELIVERY_RECOVERED'), actor: systemActor, subject: component('audit-delivery'),
    outcome: z.literal('RECOVERED'), code: z.literal('EVENT_DELIVERED'),
  }),
]);
