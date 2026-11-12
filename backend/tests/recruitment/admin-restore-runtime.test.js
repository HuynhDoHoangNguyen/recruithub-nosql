import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { archiveFixture, restoreFixture, MemoryRestoreRepository } from '../helpers/admin-restore-fixtures.js';
import { backupError, BACKUP_LIMITS } from '../../src/models/admin-backup.schema.js';
import { BackupJobStore } from '../../src/services/admin-backup-job.service.js';

test('backup/upload/validate/restore round-trip preserves documents and binary attachments; validation is one-time', async t => {
  const archive = await archiveFixture(t, [{ _id: 'candidate:1', type: 'candidate', arbitrary: ['Tiếng Việt', 1],
    _attachments: { content: { content_type: 'application/octet-stream', data: Buffer.from([0, 255]).toString('base64') } } }]);
  const f = await restoreFixture(t); const validation = await f.upload(archive.bytes);
  assert.equal(validation.status, 'SUCCEEDED'); assert.equal(validation.validation_state, 'AVAILABLE');
  const result = await f.restore(validation.id);
  assert.equal(result.status, 'SUCCEEDED'); assert.equal(result.result.verified_documents, 1);
  assert.deepEqual(f.repositories[0].docs.get('candidate:1'), archive.docs[0]);
  assert.equal((await f.service.status('user:admin', validation.id)).validation_state, 'CONSUMED');
  await assert.rejects(f.restore(validation.id), e => e.code === 'VALIDATION_USED');
});

test('tampered validated file never creates target and is consumed after attempted restore', async t => {
  const f = await restoreFixture(t); const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
  await fs.writeFile(path.join(f.store.directory(validation.id), 'upload.rhbr.gz'), 'corrupt');
  const result = await f.restore(validation.id);
  assert.equal(result.status, 'FAILED'); assert.equal(f.repositories.length, 0);
  assert.equal(result.result.target_incomplete, false);
});

test('protected/existing target, TTL and ownership checks prevent unsafe restore', async t => {
  let now = Date.now(); const f = await restoreFixture(t, { now: () => now });
  const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
  await assert.rejects(f.restore(validation.id, 'recruitment_db'), e => e.code === 'INVALID_TARGET');
  await assert.rejects(f.service.createRestore('user:other', { validation_id: validation.id, target_database: 'recruithub_restore_test_other' }), e => e.code === 'JOB_NOT_FOUND');
  now += BACKUP_LIMITS.ttl + 1;
  await assert.rejects(f.restore(validation.id), e => e.code === 'ARTIFACT_EXPIRED');
  assert.equal(f.repositories.length, 0);
});

test('partial bulk errors fail target without retrying conflicts or claiming rollback', async t => {
  const f = await restoreFixture(t); const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
  f.service.restores.repositoryFactory = target => {
    const repo = new MemoryRestoreRepository(target); f.repositories.push(repo);
    repo.bulk = async () => [{ id: 'job:1', error: 'conflict' }]; return repo;
  };
  const result = await f.restore(validation.id);
  assert.equal(result.status, 'FAILED'); assert.equal(result.error.code, 'RESTORE_WRITE_FAILED');
  assert.equal(result.result.target_incomplete, true);
});

test('ambiguous bulk response is reconciled by content; different saved content fails closed', async t => {
  for (const corrupt of [false, true]) {
    const f = await restoreFixture(t); const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
    f.service.restores.repositoryFactory = target => {
      const repo = new MemoryRestoreRepository(target); const bulk = repo.bulk.bind(repo);
      repo.bulk = async docs => { await bulk(docs); if (corrupt) repo.docs.get('job:1').title = 'different'; throw backupError('DATABASE_UNAVAILABLE'); };
      return repo;
    };
    assert.equal((await f.restore(validation.id)).status, corrupt ? 'FAILED' : 'SUCCEEDED');
  }
});

test('restart consumes RESERVED validation and fails interrupted restore without resuming', async t => {
  const f = await restoreFixture(t); const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
  const restore = await f.store.create('user:admin', 'upload', { type: 'RESTORE', validation_id: validation.id, target_database: 'recruithub_restore_test_restart' });
  await f.store.reserveValidation(validation.id, 'user:admin', restore.id); f.store.release(); f.store.close();
  const restarted = new BackupJobStore({ root: f.store.root }); t.after(() => restarted.close()); await restarted.initialize();
  assert.equal((await restarted.read(validation.id)).validation_state, 'CONSUMED');
  const result = await restarted.read(restore.id); assert.equal(result.status, 'FAILED'); assert.equal(result.result.target_incomplete, true);
});

test('concurrent restore submissions share the backup lock and cannot consume validation twice', async t => {
  const f = await restoreFixture(t); const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
  let release; const gate = new Promise(resolve => { release = resolve; });
  f.service.restores.repositoryFactory = target => { const repo = new MemoryRestoreRepository(target); const create = repo.createPrivate.bind(repo);
    repo.createPrivate = async () => { await gate; await create(); }; return repo; };
  const first = await f.service.createRestore('user:admin', { validation_id: validation.id, target_database: 'recruithub_restore_test_first' });
  await assert.rejects(f.service.createRestore('user:admin', { validation_id: validation.id, target_database: 'recruithub_restore_test_second' }), e => ['VALIDATION_USED', 'JOB_BUSY'].includes(e.code));
  await assert.rejects(f.service.create('user:admin', 'business'), e => e.code === 'JOB_BUSY');
  release(); await f.service.pending.get(first.job_id);
  assert.equal((await f.service.restoreStatus('user:admin', first.job_id)).status, 'SUCCEEDED');
});

test('restore deadline aborts target I/O, consumes validation and never reports success', async t => {
  const f = await restoreFixture(t, { limits: { ...BACKUP_LIMITS, timeout: 100 } });
  const archive = await archiveFixture(t); const validation = await f.upload(archive.bytes);
  f.service.restores.repositoryFactory = target => {
    const repo = new MemoryRestoreRepository(target);
    repo.createPrivate = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    return repo;
  };
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const result = await f.restore(validation.id);
  assert.equal(result.status, 'FAILED'); assert.equal(result.error.code, 'JOB_TIMEOUT');
  assert.equal((await f.service.status('user:admin', validation.id)).validation_state, 'CONSUMED');
});
