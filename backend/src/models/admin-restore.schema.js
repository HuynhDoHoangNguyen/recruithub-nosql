import { z } from 'zod';
import { backupError } from './admin-backup.schema.js';

export const restoreRequestSchema = z.object({ validation_id: z.uuid(),
  target_database: z.string().regex(/^recruithub_restore_[a-z0-9_]{1,64}$/), confirm: z.literal(true) }).strict();
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const headerSchema = z.object({ kind: z.literal('header'), format: z.literal('recruithub-backup'), version: z.literal(1),
  backup_id: z.uuid(), created_at: z.iso.datetime(), source_id: z.enum(['business', 'identity', 'audit']),
  source_database: z.string().min(1).max(256), source_update_seq: z.union([z.string(), count]),
  scope: z.literal('single_database_current_state'), signing_key_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/) }).strict();
export const indexSchema = z.object({ ddoc: z.string().regex(/^_design\/.+/), name: z.string().min(1).max(256),
  type: z.literal('json'), index: z.object({ fields: z.array(z.union([z.string().min(1), z.record(z.string(), z.enum(['asc', 'desc']))])).min(1),
    partial_filter_selector: z.record(z.string(), z.unknown()).optional() }).strict(), partitioned: z.boolean() }).strict();
export const indexesSchema = z.object({ kind: z.literal('indexes'), items: z.array(indexSchema) }).strict();
export const footerSchema = z.object({ kind: z.literal('footer'), document_count: count, design_count: count,
  counts_by_type: z.record(z.string(), count), attachment_count: count, attachment_bytes: count,
  attachment_checksums: z.array(z.object({ document_id: z.string(), name: z.string(), size: count,
    sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()), payload_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  signature_hmac_sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export function parseRecord(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw backupError('INVALID_BACKUP', 400);
  return result.data;
}
export function validJson(value, depth = 0) {
  if (depth > 64 || (typeof value === 'number' && !Number.isFinite(value))) throw backupError('INVALID_BACKUP', 400);
  if (value && typeof value === 'object') for (const child of Object.values(value)) validJson(child, depth + 1);
}
export const documentEnvelope = z.object({ kind: z.literal('document'), doc: z.record(z.string(), z.unknown()) }).strict();

export function assertTarget(target, env) {
  if (!restoreRequestSchema.shape.target_database.safeParse(target).success
    || [env.COUCHDB_DATABASE, env.AUTH_COUCHDB_DATABASE, env.AUDIT_COUCHDB_DATABASE, '_users', '_replicator', '_global_changes']
      .some(name => name?.trim().toLowerCase() === target.toLowerCase())) throw backupError('INVALID_TARGET', 400);
}
