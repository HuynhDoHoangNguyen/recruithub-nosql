import fs from 'node:fs/promises';
import path from 'node:path';
import { BACKUP_LIMITS, backupConfiguration, backupError } from '../models/admin-backup.schema.js';
import { BackupSourceReader } from '../models/admin-backup-source.repository.js';
import { BackupSourceRegistry } from './admin-backup-source.service.js';
import { BackupJobStore } from './admin-backup-job.service.js';
import { exportBackup, verifyExportFile } from './admin-backup-export.service.js';
import { AdminRestoreService } from './admin-restore.service.js';

export class AdminBackupService {
  constructor({ env = process.env, store = new BackupJobStore(), registry = new BackupSourceRegistry(env),
    readerFactory = config => new BackupSourceReader(config), restoreRepositoryFactory, limits = BACKUP_LIMITS } = {}) {
    Object.assign(this, { env, store, registry, readerFactory, limits });
    this.pending = new Map(); this.incidents = new Map();
    this.restores = new AdminRestoreService(this, restoreRepositoryFactory);
  }
  async ready() {
    if (this.incidents.size) throw backupError('BACKUP_CONFIGURATION_ERROR');
    const config = backupConfiguration(this.env);
    await this.store.initialize();
    return config;
  }
  async sources() { await this.ready(); return { sources: this.registry.list(), limits: this.limits }; }
  async create(owner, source) {
    const config = await this.ready();
    const reader = this.readerFactory(this.registry.resolve(source));
    const job = await this.store.create(owner, source);
    // Schedule after admission, retaining a catch handler before the response is sent.
    const completion = new Promise(resolve => setImmediate(resolve)).then(() => this.run(job, reader, config));
    this.pending.set(job.id, completion);
    completion.catch(() => {}).finally(() => this.pending.delete(job.id));
    return { job_id: job.id, status: 'QUEUED' };
  }
  async run(job, reader, config) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(backupError('JOB_TIMEOUT')), this.limits.timeout);
    timer.unref();
    const directory = this.store.directory(job.id);
    try {
      job.status = 'RUNNING'; await this.store.save(job);
      const result = await exportBackup({ reader, config, job, file: path.join(directory, 'backup.partial'),
        signal: controller.signal, limits: this.limits, progress: async (processed, total) => {
          controller.signal.throwIfAborted(); Object.assign(job, { processed, total }); await this.store.save(job);
        } });
      controller.signal.throwIfAborted();
      job.phase = 'VERIFYING'; await this.store.save(job);
      await verifyExportFile({ file: path.join(directory, 'backup.partial'), config, signal: controller.signal, limits: this.limits });
      await fs.rename(path.join(directory, 'backup.partial'), path.join(directory, 'backup.rhbr.gz'));
      job.status = 'SUCCEEDED'; job.result = result; await this.store.save(job);
    } catch (error) {
      controller.abort(error);
      job.status = 'FAILED'; job.result = null;
      job.error = this.store.publicError(controller.signal.reason?.code === 'JOB_TIMEOUT' ? controller.signal.reason : error);
      try {
        await this.store.removeArtifact(job.id, 'backup.partial'); await this.store.removeArtifact(job.id, 'backup.rhbr.gz');
        await this.store.save(job);
      } catch {
        // Fail closed for this process. Startup marks stale RUNNING records interrupted.
        this.incidents.set(job.id, true);
      }
    } finally { clearTimeout(timer); this.store.release(); }
  }
  async status(owner, id) {
    await this.ready();
    if (this.incidents.has(id)) throw backupError('BACKUP_CONFIGURATION_ERROR');
    const job = await this.store.owned(id, owner);
    if (job.type === 'RESTORE') throw backupError('JOB_NOT_FOUND', 404);
    return this.store.dto(job);
  }
  validateUpload(owner, input) { return this.restores.upload(owner, input); }
  createRestore(owner, payload) { return this.restores.create(owner, payload); }
  async restoreStatus(owner, id) { await this.ready(); return this.restores.status(owner, id); }
  async download(owner, id) {
    await this.ready();
    if (this.incidents.has(id)) throw backupError('BACKUP_CONFIGURATION_ERROR');
    return this.store.download(id, owner);
  }
}
