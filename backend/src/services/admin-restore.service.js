import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { backupError } from '../models/admin-backup.schema.js';
import { assertTarget } from '../models/admin-restore.schema.js';
import { getDatabaseConfig } from '../config/database.config.js';
import { RestoreRepository } from '../models/admin-restore.repository.js';
import { validateBackupFile, readBackupRecords, documentDigest, normalizedDocument } from './admin-backup-validation.service.js';
import { ensureIndexes, verifyRestored } from './admin-restore-verification.service.js';

export class AdminRestoreService {
  constructor(backup, repositoryFactory) {
    this.backup = backup; this.store = backup.store; this.limits = backup.limits;
    this.repositoryFactory = repositoryFactory || (target => new RestoreRepository(getDatabaseConfig(backup.env), target, { env: backup.env, limits: this.limits }));
  }
  deadline() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(backupError('JOB_TIMEOUT')), this.limits.timeout); timer.unref();
    return { controller, signal: controller.signal, stop: () => clearTimeout(timer) };
  }
  schedule(job, operation) {
    const work = new Promise(resolve => setImmediate(resolve)).then(operation);
    this.backup.pending.set(job.id, work);
    work.catch(() => {}).finally(() => this.backup.pending.delete(job.id));
    return { job_id: job.id, status: 'QUEUED' };
  }
  async fail(job, error) {
    job.status = 'FAILED'; job.error = this.store.publicError(error);
    if (job.type === 'VALIDATE') { job.result = null; delete job.validation_state; delete job.artifact_digest; }
    try { await this.store.save(job); }
    catch { this.backup.incidents.set(job.id, true); }
  }
  async upload(owner, input) {
    const config = await this.backup.ready();
    const job = await this.store.create(owner, 'upload', { type: 'VALIDATE' });
    const deadline = this.deadline(); const directory = this.store.directory(job.id);
    const aborted = () => deadline.controller.abort(backupError('INVALID_BACKUP', 400));
    input.once('aborted', aborted);
    try {
      job.status = 'RUNNING'; await this.store.save(job);
      let bytes = 0;
      const counter = new Transform({ transform: (chunk, _encoding, done) => {
        bytes += chunk.length;
        done(bytes > this.limits.compressed ? backupError('BACKUP_LIMIT_EXCEEDED', 413) : null, chunk);
      } });
      await pipeline(Readable.from(input.iterator({ destroyOnReturn: false })), counter,
        createWriteStream(path.join(directory, 'upload.partial'), { flags: 'wx', mode: 0o600 }), { signal: deadline.signal });
      await fs.rename(path.join(directory, 'upload.partial'), path.join(directory, 'upload.rhbr.gz'));
      job.phase = 'VALIDATING'; await this.store.save(job);
      return this.schedule(job, async () => {
        try {
          const validation = await validateBackupFile({ file: path.join(directory, 'upload.rhbr.gz'), config,
            signal: deadline.signal, limits: this.limits, progress: async processed => { job.processed = processed; await this.store.save(job); } });
          deadline.signal.throwIfAborted();
          job.status = 'SUCCEEDED'; job.validation_state = 'AVAILABLE'; job.artifact_digest = validation.digest;
          job.result = { validation_id: job.id, source_database: validation.header.source_database,
            scope: validation.header.scope, document_count: validation.totals.document_count,
            design_count: validation.totals.design_count, attachment_count: validation.totals.attachment_count,
            attachment_bytes: validation.totals.attachment_bytes, compressed_bytes: bytes, expires_at: job.expires_at };
          await this.store.save(job);
          deadline.signal.throwIfAborted();
        } catch (error) {
          await this.store.removeArtifact(job.id, 'upload.rhbr.gz').catch(() => { this.backup.incidents.set(job.id, true); });
          await this.fail(job, deadline.signal.aborted ? deadline.signal.reason : error);
        } finally { deadline.stop(); this.store.release(); }
      });
    } catch (error) {
      deadline.stop();
      await this.store.removeArtifact(job.id, 'upload.partial').catch(() => { this.backup.incidents.set(job.id, true); });
      await this.store.removeArtifact(job.id, 'upload.rhbr.gz').catch(() => { this.backup.incidents.set(job.id, true); });
      const failure = deadline.signal.aborted ? deadline.signal.reason : error;
      await this.fail(job, failure); this.store.release(); input.resume(); throw failure;
    } finally { input.removeListener('aborted', aborted); }
  }
  async create(owner, payload) {
    await this.backup.ready(); assertTarget(payload.target_database, this.backup.env);
    const original = await this.store.owned(payload.validation_id, owner);
    if (original.status === 'EXPIRED') throw backupError('ARTIFACT_EXPIRED', 410);
    if (original.type !== 'VALIDATE' || original.status !== 'SUCCEEDED' || original.validation_state !== 'AVAILABLE') throw backupError('VALIDATION_USED', 409);
    const job = await this.store.create(owner, 'validated-upload', { type: 'RESTORE', target_database: payload.target_database, validation_id: payload.validation_id });
    let validation;
    try { validation = await this.store.reserveValidation(payload.validation_id, owner, job.id); }
    catch (error) { await this.fail(job, error); this.store.release(); throw error; }
    return this.schedule(job, () => this.run(job, validation));
  }
  async writeBatch(repository, docs, signal) {
    let pending = docs;
    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      try {
        const rows = await repository.bulk(pending, signal);
        if (!Array.isArray(rows) || rows.length !== pending.length || rows.some((row, i) => !row.ok || row.id !== pending[i]._id)) {
          const failure = backupError('RESTORE_WRITE_FAILED');
          failure.confirmed_count = Array.isArray(rows) ? rows.filter((row, i) => row.ok && row.id === pending[i]?._id).length : 0;
          throw failure;
        }
        return;
      } catch (error) {
        if (error.code !== 'DATABASE_UNAVAILABLE') throw error;
        const missing = [];
        for (const doc of pending) {
          const saved = await repository.get(doc._id, signal);
          if (!saved) missing.push(doc);
          else if (saved._conflicts?.length || documentDigest(saved) !== documentDigest(doc)) throw backupError('RESTORE_WRITE_FAILED');
        }
        if (!missing.length) return;
        pending = missing;
        if (attempt === 2) throw backupError('RESTORE_WRITE_FAILED');
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }
  async run(job, reservation) {
    const deadline = this.deadline(); let repository, consumed = false;
    try {
      job.status = 'RUNNING'; job.phase = 'VALIDATING'; await this.store.save(job);
      const config = await this.backup.ready();
      const file = path.join(await this.store.safeDirectory(reservation.id), 'upload.rhbr.gz');
      const validation = await validateBackupFile({ file, config, signal: deadline.signal, limits: this.limits });
      if (validation.digest !== reservation.artifact_digest) throw backupError('CHECKSUM_MISMATCH', 422);
      assertTarget(job.target_database, this.backup.env);
      repository = this.repositoryFactory(job.target_database);
      job.phase = 'CREATING'; job.total = validation.totals.document_count; await this.store.save(job);
      await repository.createPrivate(deadline.signal);
      job.phase = 'RESTORING'; await this.store.save(job);
      // Read signed archive in two passes; never buffer the database in memory.
      for (const design of [false, true]) {
        let batch = [], size = 0;
        const flush = async () => {
          if (!batch.length) return;
          await repository.assertPrivate(deadline.signal);
          await this.writeBatch(repository, batch, deadline.signal);
          job.processed += batch.length; await this.store.save(job); batch = []; size = 0;
        };
        for await (const { value } of readBackupRecords(file, deadline.signal, this.limits)) {
          if (value.kind !== 'document' || value.doc._id.startsWith('_design/') !== design) continue;
          if (documentDigest(value.doc) !== validation.expected.get(value.doc._id)) throw backupError('CHECKSUM_MISMATCH', 422);
          const bytes = Buffer.byteLength(JSON.stringify(value.doc));
          if (batch.length && (batch.length >= 200 || size + bytes > 5 * 1024 * 1024)) await flush();
          batch.push(normalizedDocument(value.doc)); size += bytes;
        }
        await flush();
      }
      await ensureIndexes(repository, validation.indexes, deadline.signal);
      job.phase = 'VERIFYING'; await this.store.save(job);
      const result = await verifyRestored(repository, validation, deadline.signal);
      deadline.signal.throwIfAborted();
      // Persist one-time consumption before publishing success.
      await this.store.consumeValidation(reservation.id);
      consumed = true;
      job.result = { ...result, target_database: job.target_database, target_incomplete: false, requires_manual_configuration: true };
      job.status = 'SUCCEEDED'; await this.store.save(job);
      deadline.signal.throwIfAborted();
    } catch (error) {
      job.result = { target_database: job.target_database, target_incomplete: Boolean(repository?.creationAttempted),
        completed_batch_documents: job.processed, known_written_documents_minimum: job.processed + (error.confirmed_count || 0),
        write_outcome_may_be_partial: Boolean(repository?.creationAttempted), requires_manual_configuration: true };
      await this.fail(job, deadline.signal.aborted ? deadline.signal.reason : error);
    } finally {
      if (!consumed) await this.store.consumeValidation(reservation.id).catch(() => { this.backup.incidents.set(job.id, true); });
      deadline.stop(); this.store.release();
    }
  }
  async status(owner, id) {
    const job = await this.store.owned(id, owner);
    if (job.type !== 'RESTORE') throw backupError('JOB_NOT_FOUND', 404);
    return this.store.dto(job);
  }
}
