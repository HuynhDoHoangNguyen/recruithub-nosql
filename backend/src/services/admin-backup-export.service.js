import { createHash, createHmac } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { BACKUP_LIMITS, backupError, canonicalJson } from '../models/admin-backup.schema.js';

export async function exportBackup({ reader, config, job, file, signal, progress, limits = BACKUP_LIMITS }) {
  const start = await reader.metadata(signal);
  if (start.update_seq === undefined || !Number.isSafeInteger(start.doc_count) || start.doc_count < 0) throw backupError('INVALID_BACKUP', 400);
  if (start.doc_count > limits.documents) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
  const totals = { document_count: 0, design_count: 0, counts_by_type: Object.create(null),
    attachment_count: 0, attachment_bytes: 0, attachment_checksums: [] };
  const hash = createHash('sha256'); const ids = new Set();
  let uncompressed = 0, compressed = 0;
  function line(value, payload = true) {
    const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
    uncompressed += bytes.length;
    if (bytes.length > limits.record || uncompressed > limits.uncompressed) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
    if (payload) hash.update(bytes);
    return bytes;
  }
  async function *records() {
    yield line({ kind: 'header', format: 'recruithub-backup', version: 1, backup_id: job.id,
      created_at: job.created_at, source_id: job.source_id, source_database: reader.config.database,
      source_update_seq: start.update_seq, scope: 'single_database_current_state', signing_key_id: config.keyId });
    await progress(0, start.doc_count);
    for await (const original of reader.documents(signal)) {
      signal.throwIfAborted();
      if (original._conflicts?.length || original._deleted_conflicts?.length) throw backupError('SOURCE_CONFLICTS', 409);
      if (!original._id || ids.has(original._id) || original._deleted || original._id.startsWith('_local/')
        || (original._id.startsWith('_') && !original._id.startsWith('_design/'))) throw backupError('INVALID_BACKUP', 400);
      ids.add(original._id);
      if (++totals.document_count > limits.documents) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
      const doc = Object.fromEntries(Object.entries(original).filter(([key]) =>
        !['_rev', '_revisions', '_revs_info', '_conflicts', '_deleted_conflicts', '_local_seq'].includes(key)));
      if (doc._id.startsWith('_design/')) totals.design_count++;
      else { const type = typeof doc.type === 'string' ? doc.type : typeof doc.doc_type === 'string' ? doc.doc_type : 'unknown';
        totals.counts_by_type[type] = (totals.counts_by_type[type] || 0) + 1; }
      if (doc._attachments) {
        doc._attachments = Object.fromEntries(Object.entries(doc._attachments).map(([name, attachment]) => {
          if (attachment.stub || attachment.follows || typeof attachment.data !== 'string'
            || typeof attachment.content_type !== 'string') throw backupError('INVALID_BACKUP', 400);
          const bytes = Buffer.from(attachment.data, 'base64');
          if (bytes.toString('base64') !== attachment.data || (attachment.length !== undefined && attachment.length !== bytes.length)) throw backupError('INVALID_BACKUP', 400);
          totals.attachment_bytes += bytes.length;
          if (bytes.length > limits.attachment || totals.attachment_bytes > limits.attachmentBytes) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
          totals.attachment_count++;
          totals.attachment_checksums.push({ document_id: doc._id, name, size: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex') });
          return [name, { content_type: attachment.content_type, data: attachment.data }];
        }));
      }
      yield line({ kind: 'document', doc });
      if (totals.document_count % 100 === 0) await progress(totals.document_count, start.doc_count);
    }
    const indexes = await reader.indexes(signal);
    if (!Array.isArray(indexes.indexes)) throw backupError('INVALID_BACKUP', 400);
    const items = indexes.indexes.filter(index => !(index.type === 'special' && index.name === '_all_docs')).map(index => {
      if (index.type !== 'json') throw backupError('UNSUPPORTED_INDEX', 415);
      if (!index.ddoc || !ids.has(index.ddoc) || !index.name || !index.def) throw backupError('INVALID_BACKUP', 400);
      return { ddoc: index.ddoc, name: index.name, type: 'json', index: index.def,
        partitioned: Boolean(index.partitioned) };
    });
    yield line({ kind: 'indexes', items });
    const end = await reader.metadata(signal);
    if (canonicalJson(start.update_seq) !== canonicalJson(end.update_seq) || start.doc_count !== end.doc_count
      || start.doc_count !== totals.document_count) throw backupError('SOURCE_CHANGED', 409);
    const footer = { kind: 'footer', ...totals, payload_sha256: hash.digest('hex') };
    const signature = createHmac('sha256', config.key).update(`RHBR1\n${footer.payload_sha256}\n${canonicalJson(footer)}`).digest('hex');
    yield line({ ...footer, signature_hmac_sha256: signature }, false);
    await progress(totals.document_count, start.doc_count);
  }
  const counter = new Transform({ transform(chunk, encoding, done) {
    compressed += chunk.length;
    done(compressed > limits.compressed ? backupError('BACKUP_LIMIT_EXCEEDED', 413) : null, chunk);
  } });
  await pipeline(Readable.from(records()), createGzip(), counter, createWriteStream(file, { flags: 'wx', mode: 0o600 }), { signal });
  return { document_count: totals.document_count, design_count: totals.design_count,
    attachment_count: totals.attachment_count, attachment_bytes: totals.attachment_bytes,
    compressed_bytes: compressed, uncompressed_bytes: uncompressed };
}

/** Read back the completed local export before publication; not an upload validator (BR-003). */
export async function verifyExportFile({ file, config, signal, limits = BACKUP_LIMITS }) {
  const hash = createHash('sha256'); let pending = Buffer.alloc(0), size = 0, docs = 0;
  let header = false, indexes = false, footer = false;
  function consume(bytes) {
    if (bytes.length > limits.record || footer) throw backupError('INVALID_BACKUP', 400);
    const record = JSON.parse(bytes.toString('utf8'));
    if (!header) {
      if (record.kind !== 'header' || record.format !== 'recruithub-backup' || record.version !== 1
        || record.signing_key_id !== config.keyId) throw backupError('INVALID_BACKUP', 400);
      header = true;
    } else if (record.kind === 'document' && !indexes) docs++;
    else if (record.kind === 'indexes' && !indexes) indexes = true;
    else if (record.kind === 'footer' && indexes) {
      const { signature_hmac_sha256: signature, ...unsigned } = record;
      const digest = hash.digest('hex');
      const expected = createHmac('sha256', config.key).update(`RHBR1\n${digest}\n${canonicalJson(unsigned)}`).digest('hex');
      if (record.payload_sha256 !== digest || signature !== expected || record.document_count !== docs) throw backupError('INVALID_BACKUP', 400);
      footer = true; return;
    } else throw backupError('INVALID_BACKUP', 400);
    hash.update(bytes);
  }
  await pipeline(createReadStream(file), createGunzip(), async source => {
    for await (const chunk of source) {
      size += chunk.length;
      if (size > limits.uncompressed) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
      pending = Buffer.concat([pending, chunk]);
      let newline;
      while ((newline = pending.indexOf(10)) !== -1) {
        consume(pending.subarray(0, newline + 1)); pending = pending.subarray(newline + 1);
      }
      if (pending.length > limits.record) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
    }
  }, { signal });
  if (!footer || pending.length) throw backupError('INVALID_BACKUP', 400);
}
