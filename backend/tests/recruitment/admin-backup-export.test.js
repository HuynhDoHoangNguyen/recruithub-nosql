import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { once } from 'node:events';
import http from 'node:http';
import { exportBackup, verifyExportFile } from '../../src/services/admin-backup-export.service.js';
import { BackupSourceReader } from '../../src/models/admin-backup-source.repository.js';
import { BACKUP_LIMITS, backupConfiguration } from '../../src/models/admin-backup.schema.js';
import { environment, exportJob, sourceReader, temporary } from '../helpers/admin-backup-fixtures.js';

const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
async function write(t, reader, limits = BACKUP_LIMITS) {
  const file = path.join(await temporary(t), 'backup.gz');
  const result = await exportBackup({ file, reader, job: exportJob(), config: backupConfiguration(environment()),
    signal: new AbortController().signal, progress: async () => {}, limits });
  return { bytes: gunzipSync(await fs.readFile(file)), result };
}

test('RHBR export round-trip independently verifies 9 types, arbitrary fields, design/index and binary attachment HMAC', async t => {
  const binary = Buffer.from([0, 255, 128, 65, 0]);
  const types = ['user', 'company', 'department', 'recruiter', 'candidate', 'job', 'application', 'interview', 'resume_analysis'];
  const docs = types.map(type => ({ _id: `${type}:1`, _rev: '2-r', type, arbitrary: { text: 'Tiếng Việt', list: [1, false] } }));
  docs[0]._attachments = { 'hồ sơ.bin': { content_type: 'application/octet-stream', data: binary.toString('base64'), length: binary.length } };
  docs.push({ _id: '_design/view', _rev: '1-r', views: { count: { map: 'function(doc){emit(doc.type,1)}', reduce: '_sum' } } });
  const reader = sourceReader(docs);
  reader.indexes = async () => ({ indexes: [{ name: '_all_docs', type: 'special' },
    { name: 'by_type', ddoc: '_design/view', type: 'json', def: { fields: [{ type: 'asc' }] } }] });
  const { bytes, result } = await write(t, reader);
  const lines = bytes.toString().trimEnd().split('\n'); const records = lines.map(line => JSON.parse(line));
  const footer = records.at(-1); const { signature_hmac_sha256: signature, ...unsigned } = footer;
  const payload = lines.slice(0, -1).join('\n') + '\n';
  assert.equal(createHash('sha256').update(payload).digest('hex'), footer.payload_sha256);
  assert.equal(createHmac('sha256', environment().BACKUP_SIGNING_KEY)
    .update(`RHBR1\n${footer.payload_sha256}\n${JSON.stringify(sorted(unsigned))}`).digest('hex'), signature);
  const restored = records.filter(r => r.kind === 'document').map(r => r.doc);
  assert.equal(restored.length, 10); assert.equal(restored.some(d => '_rev' in d), false);
  assert.deepEqual(restored[0].arbitrary, docs[0].arbitrary);
  assert.deepEqual(Buffer.from(restored[0]._attachments['hồ sơ.bin'].data, 'base64'), binary);
  assert.equal(footer.attachment_checksums[0].sha256, createHash('sha256').update(binary).digest('hex'));
  assert.equal(footer.document_count, result.document_count); assert.equal(footer.design_count, 1);
  assert.equal(Object.keys(footer.counts_by_type).length, 9);
  assert.equal(records.at(-2).items[0].name, 'by_type');
});

test('empty database exports header/indexes/footer and no fake documents', async t => {
  const { bytes, result } = await write(t, sourceReader());
  assert.equal(result.document_count, 0); assert.equal(result.attachment_count, 0);
  assert.deepEqual(bytes.toString().trim().split('\n').map(line => JSON.parse(line).kind), ['header', 'indexes', 'footer']);
});

test('readback verification detects altered payload/footer and truncated gzip before publication', async t => {
  const { bytes } = await write(t, sourceReader([{ _id: 'a', type: 'job' }]));
  const root = await temporary(t);
  for (const [name, content] of [
    ['payload', gzipSync(bytes.toString().replace('"type":"job"', '"type":"bad"'))],
    ['footer', gzipSync(bytes.toString().replace('"document_count":1', '"document_count":2'))],
    ['truncated', gzipSync(bytes).subarray(0, 20)],
  ]) {
    const file = path.join(root, name); await fs.writeFile(file, content);
    await assert.rejects(verifyExportFile({ file, config: backupConfiguration(environment()), signal: new AbortController().signal }));
  }
});

test('export rejects changed sequence, conflicts, duplicate IDs, unsupported indexes and incomplete attachment', async t => {
  for (const scenario of ['sequence', 'conflict', 'duplicate', 'index', 'attachment', 'base64']) {
    const doc = { _id: 'candidate:1', _rev: '1-r', type: 'candidate' };
    if (scenario === 'conflict') doc._conflicts = ['2-other'];
    if (scenario === 'attachment') doc._attachments = { a: { stub: true } };
    if (scenario === 'base64') doc._attachments = { a: { data: 'bad!', content_type: 'x' } };
    const reader = sourceReader(scenario === 'duplicate' ? [doc, doc] : [doc]);
    if (scenario === 'sequence') { let calls = 0; reader.metadata = async () => ({ doc_count: 1, update_seq: String(calls++) }); }
    if (scenario === 'index') reader.indexes = async () => ({ indexes: [{ type: 'text' }] });
    await assert.rejects(write(t, reader), error => ['SOURCE_CHANGED', 'SOURCE_CONFLICTS', 'INVALID_BACKUP', 'UNSUPPORTED_INDEX'].includes(error.code), scenario);
  }
});

test('streaming export enforces document, record, attachment, total and compressed limits', async t => {
  const doc = { _id: 'asset:1', _attachments: { a: { data: Buffer.alloc(200).toString('base64'), content_type: 'x' } } };
  for (const override of [{ documents: 0 }, { record: 100 }, { attachment: 10 }, { attachmentBytes: 10 }, { uncompressed: 100 }, { compressed: 10 }]) {
    await assert.rejects(write(t, sourceReader([doc]), { ...BACKUP_LIMITS, ...override }), error => error.code === 'BACKUP_LIMIT_EXCEEDED');
  }
});

test('CouchDB reader performs only GET, pages by key and retrieves exact attachment revision', async t => {
  const requests = []; const docs = ['a', 'b', '_design/c'].map(_id => ({ _id, _rev: '1-r', type: 'job' }));
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.accept, 'application/json');
    const url = new URL(req.url, 'http://fixture'); requests.push({ method: req.method, path: url.pathname, params: url.searchParams });
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/fixture/_all_docs') {
      const offset = url.searchParams.has('startkey') ? 2 : 0;
      return res.end(JSON.stringify({ rows: docs.slice(offset, offset + 2).map(doc => ({ id: doc._id, value: { rev: doc._rev } })) }));
    }
    const doc = docs.find(d => url.pathname === `/fixture/${d._id}`);
    res.end(JSON.stringify(doc));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const reader = new BackupSourceReader({ database: 'fixture', url: `http://127.0.0.1:${server.address().port}` }, { limits: { ...BACKUP_LIMITS, page: 2 } });
  const found = []; for await (const doc of reader.documents(new AbortController().signal)) found.push(doc._id);
  assert.deepEqual(found, ['a', 'b', '_design/c']); assert.equal(requests.every(r => r.method === 'GET'), true);
  assert.equal(requests.filter(r => r.path.endsWith('_all_docs'))[1].params.get('startkey'), '"b"');
  for (const r of requests.filter(r => !r.path.endsWith('_all_docs'))) {
    assert.equal(r.params.get('rev'), '1-r'); assert.equal(r.params.get('attachments'), 'true');
  }
});

test('reader sanitizes upstream failures, bounds responses and honors abort without retrying writes', async () => {
  for (const request of [async () => { throw new Error('private-connection-secret'); },
    async () => new Response('private-upstream-error', { status: 401 }),
    async () => new Response('x'.repeat(100))]) {
    const reader = new BackupSourceReader({ url: 'http://fixture', database: 'fixture' }, { request, limits: { ...BACKUP_LIMITS, record: 20 } });
    await assert.rejects(reader.metadata(new AbortController().signal), e => ['DATABASE_UNAVAILABLE', 'BACKUP_LIMIT_EXCEEDED'].includes(e.code)
      && !e.message.includes('private-'));
  }
});
