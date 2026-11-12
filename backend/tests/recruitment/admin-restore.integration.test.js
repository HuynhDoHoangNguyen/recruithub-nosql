import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { BackupSourceReader } from '../../src/models/admin-backup-source.repository.js';
import { exportBackup } from '../../src/services/admin-backup-export.service.js';
import { backupConfiguration } from '../../src/models/admin-backup.schema.js';
import { restoreFixture } from '../helpers/admin-restore-fixtures.js';
import { environment, exportJob } from '../helpers/admin-backup-fixtures.js';
import { RestoreRepository } from '../../src/models/admin-restore.repository.js';

test('BR-003 real CouchDB isolated export/upload/restore verifies data, attachments, indexes and private ACL', {
  skip: process.env.BR003_DOCKER_INTEGRATION !== '1', timeout: 90000,
}, async t => {
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const container = `recruithub-br003-test-${randomUUID().slice(0, 8)}`;
  const dockerEnv = { ...process.env, COUCHDB_USER: 'br003_test_admin', COUCHDB_PASSWORD: randomBytes(32).toString('hex') };
  const docker = args => {
    const result = spawnSync('docker', args, { env: dockerEnv, encoding: 'utf8', windowsHide: true, timeout: 20000 });
    if (result.status !== 0) throw new Error(`Isolated Docker command failed: ${args[0]}`);
    return result.stdout.trim();
  };
  docker(['run', '-d', '--name', container, '-p', '127.0.0.1::5984', '--env', 'COUCHDB_USER', '--env', 'COUCHDB_PASSWORD', 'couchdb:3.5.2.1']);
  // Stop, do not remove databases/container: retain only this isolated fixture for review.
  t.after(() => { docker(['stop', container]); t.diagnostic(`Retained stopped test container: ${container}; no database DELETE issued.`); });
  const binding = docker(['port', container, '5984/tcp']).split('\n')[0];
  const url = `http://${binding}`;
  const headers = { Authorization: `Basic ${Buffer.from(`${dockerEnv.COUCHDB_USER}:${dockerEnv.COUCHDB_PASSWORD}`).toString('base64')}`, 'Content-Type': 'application/json' };
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(ready, true, 'Isolated CouchDB must become ready');
  t.diagnostic('Isolated CouchDB ready.');
  const call = async (endpoint, method = 'GET', body) => {
    const r = await fetch(url + endpoint, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    assert.ok(r.ok, `Isolated request failed ${method} ${endpoint}: ${r.status}`); return r.json();
  };
  const source = 'br003_source_fixture';
  await call('/' + source, 'PUT');
  const types = ['user', 'candidate', 'company', 'department', 'recruiter', 'job', 'application', 'interview', 'resume_analysis'];
  const docs = types.map(type => ({ _id: `${type}:test`, type, text: 'Dữ liệu thử nghiệm', fields: [1, false] }));
  docs.push({ _id: 'asset:test', type: 'uploaded_asset', _attachments: { content: { content_type: 'application/octet-stream', data: Buffer.from([0, 255, 1]).toString('base64') } } });
  const rows = await call(`/${source}/_bulk_docs`, 'POST', { docs }); assert.equal(rows.every(row => row.ok), true);
  await call(`/${source}/_design/count`, 'PUT', { views: { count: { map: 'function(doc){emit(doc.type,1)}', reduce: '_sum' } } });
  await call(`/${source}/_index`, 'POST', { ddoc: 'by_type', name: 'by_type', type: 'json', index: { fields: ['type'] } });
  const before = await call('/' + source);
  t.diagnostic('Synthetic source and indexes created.');
  const config = { url, database: source, username: dockerEnv.COUCHDB_USER, password: dockerEnv.COUCHDB_PASSWORD, timeoutMs: 5000 };
  const f = await restoreFixture(t);
  const file = path.join(f.root, 'real-export.gz');
  await exportBackup({ file, reader: new BackupSourceReader(config), config: backupConfiguration(environment()), job: exportJob(),
    signal: new AbortController().signal, progress: async () => {} });
  t.diagnostic('Real source exported.');
  const uploaded = await f.service.validateUpload('user:admin', Readable.from([await fs.readFile(file)])); await f.service.pending.get(uploaded.job_id);
  const validation = await f.service.status('user:admin', uploaded.job_id);
  t.diagnostic('Upload validation completed.');
  assert.equal(validation.status, 'SUCCEEDED', JSON.stringify(validation.error));
  f.service.restores.repositoryFactory = target => new RestoreRepository(config, target, { env: { COUCHDB_DATABASE: source } });
  const target = 'recruithub_restore_test_' + randomUUID().replaceAll('-', '');
  const result = await f.restore(validation.id, target);
  t.diagnostic('Restore job completed.');
  assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result.error));
  assert.equal(result.result.verified_documents, before.doc_count);
  const after = await call('/' + source); assert.equal(after.update_seq, before.update_seq);
  const anonymous = await fetch(`${url}/${target}`); assert.equal(anonymous.status, 401);
  t.diagnostic(`Source=${source}; target=${target}; verified=${result.result.verified_documents}; source sequence unchanged; anonymous denied.`);
});
