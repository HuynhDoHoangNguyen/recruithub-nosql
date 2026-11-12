import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BACKUP_LIMITS } from '../../src/models/admin-backup.schema.js';
import { BackupJobStore } from '../../src/services/admin-backup-job.service.js';
import { AdminBackupService } from '../../src/services/admin-backup.service.js';

export const environment = () => ({ BACKUP_SIGNING_KEY: 'backup-fixture-secret-with-48-characters-for-tests-only', BACKUP_SIGNING_KEY_ID: 'test-v1' });
export function sourceReader(docs = []) {
  return { config: { database: 'fixture' }, async metadata() { return { doc_count: docs.length, update_seq: 'opaque-1' }; },
    async *documents() { for (const doc of docs) yield structuredClone(doc); },
    async indexes() { return { indexes: [{ name: '_all_docs', type: 'special' }] }; } };
}
export async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rhbr-test-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.match(path.basename(resolved), /^rhbr-test-/);
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return root;
}
export async function serviceFixture(t, { reader = sourceReader(), limits = BACKUP_LIMITS, now } = {}) {
  const root = await temporary(t);
  const store = new BackupJobStore({ root: path.join(root, 'spool'), limits, now });
  t.after(() => store.close());
  const service = new AdminBackupService({ env: environment(), store, limits,
    registry: { list: () => [{ id: 'business', available: true }], resolve: () => reader.config }, readerFactory: () => reader });
  const complete = async id => { await service.pending.get(id); return service.status('user:admin', id); };
  return { root, store, service, complete };
}
export const exportJob = () => ({ id: randomUUID(), source_id: 'business', created_at: '2026-11-12T10:00:00.000Z' });
