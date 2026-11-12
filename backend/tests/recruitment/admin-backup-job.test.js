import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BackupJobStore } from '../../src/services/admin-backup-job.service.js';
import { BACKUP_LIMITS } from '../../src/models/admin-backup.schema.js';
import { serviceFixture, sourceReader, temporary } from '../helpers/admin-backup-fixtures.js';

test('job admission serializes tasks; success is durable and artifacts are owner-only', async t => {
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const reader = sourceReader([{ _id: 'job:1', type: 'job' }]);
  const original = reader.documents;
  reader.documents = async function *() { await gate; yield* original(); };
  const { service, store, complete } = await serviceFixture(t, { reader });
  const first = await service.create('user:admin', 'business');
  await assert.rejects(service.create('user:admin', 'business'), e => e.code === 'JOB_BUSY');
  await assert.rejects(service.download('user:admin', first.job_id), e => e.code === 'ARTIFACT_NOT_READY');
  await assert.rejects(service.status('user:other-admin', first.job_id), e => e.code === 'JOB_NOT_FOUND');
  resume();
  const status = await complete(first.job_id);
  assert.equal(status.status, 'SUCCEEDED'); assert.equal(status.processed, 1);
  assert.equal('owner_id' in status, false);
  assert.equal((await store.read(first.job_id)).status, 'SUCCEEDED');
  const download = await service.download('user:admin', first.job_id);
  assert.ok(download.size > 0); download.stream.destroy(); await download.handle.close();
});

test('expired artifacts are removed; running jobs survive cleanup; retained metadata eventually expires', async t => {
  let now = Date.now();
  const { service, store, complete } = await serviceFixture(t, { now: () => now });
  const created = await service.create('user:admin', 'business'); await complete(created.job_id);
  now += BACKUP_LIMITS.ttl + 1;
  await assert.rejects(service.download('user:admin', created.job_id), e => e.code === 'ARTIFACT_EXPIRED');
  assert.equal((await service.status('user:admin', created.job_id)).status, 'EXPIRED');
  await assert.rejects(fs.stat(path.join(store.directory(created.job_id), 'backup.rhbr.gz')));
  const running = await store.create('user:admin', 'business'); now += BACKUP_LIMITS.ttl + 1;
  await store.cleanup(); assert.equal((await store.read(running.id)).status, 'QUEUED');
  running.status = 'FAILED'; await store.save(running); store.release();
  now += BACKUP_LIMITS.retention + 1; await store.cleanup();
  await assert.rejects(store.read(created.job_id), e => e.code === 'JOB_NOT_FOUND');
});

test('restart fails stale jobs, removes partial artifacts and never resumes source work', async t => {
  const { store } = await serviceFixture(t);
  const job = await store.create('user:admin', 'business');
  await fs.writeFile(path.join(store.directory(job.id), 'backup.partial'), 'partial');
  store.release(); store.close();
  const restarted = new BackupJobStore({ root: store.root }); t.after(() => restarted.close());
  await restarted.initialize();
  const result = await restarted.read(job.id);
  assert.equal(result.status, 'FAILED'); assert.equal(result.error.code, 'JOB_INTERRUPTED');
  await assert.rejects(fs.stat(path.join(store.directory(job.id), 'backup.partial')));
});

test('quota and insecure/symlink spool fail closed without following paths', async t => {
  const { service } = await serviceFixture(t, { limits: { ...BACKUP_LIMITS, jobs: 0 } });
  await assert.rejects(service.create('user:admin', 'business'), e => e.code === 'BACKUP_LIMIT_EXCEEDED');
  const root = await temporary(t); const real = path.join(root, 'real'); const link = path.join(root, 'link');
  await fs.mkdir(real); await fs.symlink(real, link, process.platform === 'win32' ? 'junction' : 'dir');
  const unsafe = new BackupJobStore({ root: link });
  await assert.rejects(unsafe.initialize(), e => e.code === 'BACKUP_CONFIGURATION_ERROR');
  assert.throws(() => unsafe.directory('../escape'), e => e.code === 'JOB_NOT_FOUND');
});

test('failed export removes partial output and sanitizes error details', async t => {
  const reader = sourceReader(); reader.documents = async function *() { throw new Error('secret-password-token'); };
  const { service, store, complete } = await serviceFixture(t, { reader });
  const created = await service.create('user:admin', 'business'); const status = await complete(created.job_id);
  assert.equal(status.status, 'FAILED'); assert.equal(JSON.stringify(status).includes('secret-password'), false);
  assert.deepEqual(await fs.readdir(store.directory(created.job_id)), ['job.json']);
});

test('job timeout aborts source I/O and prevents publishing artifact', async t => {
  const reader = sourceReader(); reader.metadata = signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const { service, complete } = await serviceFixture(t, { reader, limits: { ...BACKUP_LIMITS, timeout: 50 } });
  // Keep event loop alive like an HTTP server while the production deadline is unref'ed.
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const created = await service.create('user:admin', 'business'); const status = await complete(created.job_id);
  assert.equal(status.status, 'FAILED'); assert.equal(status.error.code, 'JOB_TIMEOUT');
});

test('metadata write failures stop publication and further admission instead of reporting success', async t => {
  const { service, store } = await serviceFixture(t);
  const save = store.save.bind(store);
  store.save = job => job.status === 'QUEUED' ? save(job) : Promise.reject(new Error('private-disk-error'));
  const created = await service.create('user:admin', 'business'); await service.pending.get(created.job_id);
  await assert.rejects(service.status('user:admin', created.job_id), e => e.code === 'BACKUP_CONFIGURATION_ERROR');
  await assert.rejects(service.create('user:admin', 'business'), e => e.code === 'BACKUP_CONFIGURATION_ERROR');
  assert.equal((await store.read(created.job_id)).status, 'QUEUED');
});
