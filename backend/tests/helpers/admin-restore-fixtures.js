import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { exportBackup } from '../../src/services/admin-backup-export.service.js';
import { backupConfiguration } from '../../src/models/admin-backup.schema.js';
import { sourceReader, environment, temporary, exportJob, serviceFixture } from './admin-backup-fixtures.js';

export async function archiveFixture(t, docs = [{ _id: 'job:1', type: 'job', title: 'Tuyển dụng' }], indexes = []) {
  const root = await temporary(t); const file = path.join(root, 'archive.gz'); const reader = sourceReader(docs);
  reader.indexes = async () => ({ indexes: [{ name: '_all_docs', type: 'special' }, ...indexes] });
  await exportBackup({ file, reader, job: exportJob(), config: backupConfiguration(environment()),
    signal: new AbortController().signal, progress: async () => {} });
  return { file, bytes: await fs.readFile(file), docs, indexes };
}
export class MemoryRestoreRepository {
  constructor(target) { this.target = target; this.docs = new Map(); this.savedIndexes = []; this.seq = 0;
    this.created = false; this.creationAttempted = false; this.private = true; this.calls = []; }
  async createPrivate() { this.calls.push('create'); this.creationAttempted = true; this.created = true; }
  async assertPrivate() { if (!this.private) throw Object.assign(new Error(), { code: 'RESTORE_SECURITY_ERROR' }); }
  async bulk(docs) { this.calls.push('bulk'); return docs.map(doc => { this.docs.set(doc._id, structuredClone(doc)); this.seq++; return { ok: true, id: doc._id, rev: '1-memory' }; }); }
  async get(id) { return this.docs.get(id) || null; }
  async indexes() { return { indexes: this.savedIndexes }; }
  async createIndex(index) { this.savedIndexes.push(index); this.seq++; }
  reader() {
    const self = this;
    return { metadata: async () => ({ doc_count: self.docs.size, update_seq: String(self.seq) }),
      async *documents() { for (const doc of self.docs.values()) yield { ...doc, _rev: '1-memory' }; } };
  }
}
export async function restoreFixture(t, options = {}) {
  const fixture = await serviceFixture(t, options);
  const repositories = [];
  fixture.service.restores.repositoryFactory = target => { const repository = new MemoryRestoreRepository(target); repositories.push(repository); return repository; };
  const upload = async bytes => {
    const job = await fixture.service.validateUpload('user:admin', Readable.from([bytes]));
    await fixture.service.pending.get(job.job_id);
    return fixture.service.status('user:admin', job.job_id);
  };
  const restore = async (id, target = 'recruithub_restore_test_memory') => {
    const job = await fixture.service.createRestore('user:admin', { validation_id: id, target_database: target, confirm: true });
    await fixture.service.pending.get(job.job_id);
    return fixture.service.restoreStatus('user:admin', job.job_id);
  };
  return { ...fixture, repositories, upload, restore };
}
