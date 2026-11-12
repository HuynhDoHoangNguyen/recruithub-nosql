import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash, createHmac } from 'node:crypto';
import { validateBackupFile } from '../../src/services/admin-backup-validation.service.js';
import { backupConfiguration, canonicalJson, BACKUP_LIMITS } from '../../src/models/admin-backup.schema.js';
import { environment, temporary } from '../helpers/admin-backup-fixtures.js';
import { archiveFixture } from '../helpers/admin-restore-fixtures.js';

const validate = (file, limits) => validateBackupFile({ file, limits, config: backupConfiguration(environment()), signal: new AbortController().signal });
export function signRecords(records) {
  const footer = records.at(-1); const payload = records.slice(0, -1).map(r => JSON.stringify(r) + '\n').join('');
  footer.payload_sha256 = createHash('sha256').update(payload).digest('hex');
  const { signature_hmac_sha256: _old, ...unsigned } = footer;
  footer.signature_hmac_sha256 = createHmac('sha256', environment().BACKUP_SIGNING_KEY).update(`RHBR1\n${footer.payload_sha256}\n${canonicalJson(unsigned)}`).digest('hex');
  return gzipSync(payload + JSON.stringify(footer) + '\n');
}

test('untrusted validator checks the complete signed document/attachment/index manifest', async t => {
  const binary = Buffer.from([0, 255, 10]);
  const fixture = await archiveFixture(t, [{ _id: 'asset:1', type: 'uploaded_asset', _attachments: {
    'hồ sơ.bin': { content_type: 'application/octet-stream', data: binary.toString('base64') },
  } }, { _id: '_design/by_type', language: 'query', views: {} }],
  [{ ddoc: '_design/by_type', name: 'by_type', type: 'json', def: { fields: [{ type: 'asc' }] } }]);
  const value = await validate(fixture.file);
  assert.equal(value.expected.size, 2); assert.equal(value.totals.attachment_bytes, 3);
  assert.equal(value.indexes.length, 1); assert.match(value.digest, /^[a-f0-9]{64}$/);
});

test('validator rejects tamper, truncation, unknown keys/version, duplicate IDs, metadata, stub and extra records', async t => {
  const fixture = await archiveFixture(t); const original = gunzipSync(fixture.bytes).toString().trim().split('\n').map(JSON.parse);
  const mutations = [
    r => { r[0].version = 2; }, r => { r[0].signing_key_id = 'unknown'; }, r => { r[0].url = 'http://attacker'; },
    r => { r.splice(2, 0, structuredClone(r[1])); }, r => { r[1].doc._rev = '1-forbidden'; },
    r => { r[1].doc._id = '_local/secret'; }, r => { r[1].doc._deleted = true; },
    r => { r[1].doc._attachments = { a: { stub: true } }; },
    r => { r[1].doc._attachments = { a: { content_type: 'x', data: 'bad!' } }; },
    r => { r.at(-1).document_count++; }, r => { r.push(structuredClone(r[1])); },
  ];
  const root = await temporary(t);
  for (let i = 0; i < mutations.length; i++) {
    const records = structuredClone(original); mutations[i](records);
    const file = path.join(root, String(i)); await fs.writeFile(file, gzipSync(records.map(r => JSON.stringify(r) + '\n').join('')));
    await assert.rejects(validate(file), error => ['INVALID_BACKUP', 'CHECKSUM_MISMATCH', 'SIGNATURE_INVALID'].includes(error.code));
  }
  const truncated = path.join(root, 'truncated'); await fs.writeFile(truncated, fixture.bytes.subarray(0, 20)); await assert.rejects(validate(truncated));
  const badSignature = structuredClone(original); badSignature.at(-1).signature_hmac_sha256 = '0'.repeat(64);
  const file = path.join(root, 'signature'); await fs.writeFile(file, gzipSync(badSignature.map(r => JSON.stringify(r) + '\n').join('')));
  await assert.rejects(validate(file), error => error.code === 'SIGNATURE_INVALID');
});

test('even correctly signed manifests must have correct counts and attachment checksums', async t => {
  const fixture = await archiveFixture(t); const records = gunzipSync(fixture.bytes).toString().trim().split('\n').map(JSON.parse);
  records.at(-1).document_count = 99;
  const file = path.join(await temporary(t), 'bad-count'); await fs.writeFile(file, signRecords(records));
  await assert.rejects(validate(file), error => error.code === 'CHECKSUM_MISMATCH');
});

test('validator bounds compressed/decompressed bytes, documents, records and attachments', async t => {
  const fixture = await archiveFixture(t, [{ _id: 'a', _attachments: { content: { content_type: 'x', data: Buffer.alloc(1000).toString('base64') } } }]);
  for (const overrides of [{ compressed: 10 }, { uncompressed: 100 }, { record: 100 }, { documents: 0 }, { attachment: 10 }, { attachmentBytes: 10 }]) {
    await assert.rejects(validate(fixture.file, { ...BACKUP_LIMITS, ...overrides }), error => error.code === 'BACKUP_LIMIT_EXCEEDED');
  }
});
