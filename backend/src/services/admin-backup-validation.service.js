import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { BACKUP_LIMITS, backupError, canonicalJson } from '../models/admin-backup.schema.js';
import { headerSchema, indexesSchema, footerSchema, documentEnvelope, parseRecord, validJson } from '../models/admin-restore.schema.js';

export async function *readBackupRecords(file, signal, limits = BACKUP_LIMITS) {
  let compressed = 0, expanded = 0, pending = Buffer.alloc(0);
  const counter = new Transform({ transform(chunk, _encoding, done) {
    compressed += chunk.length;
    done(compressed > limits.compressed ? backupError('BACKUP_LIMIT_EXCEEDED', 413) : null, chunk);
  } });
  const input = createReadStream(file), decoder = createGunzip();
  // Keep error observers until disposal, including when a consumer rejects a record early.
  for (const part of [input, counter, decoder]) part.on('error', () => {});
  const stream = decoder;
  let pumpError;
  const closed = pipeline(input, counter, decoder, { signal }).catch(error => { pumpError = error; });
  try {
    for await (const chunk of stream) {
      signal.throwIfAborted(); expanded += chunk.length;
      if (expanded > limits.uncompressed) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
      pending = Buffer.concat([pending, chunk]);
      let newline;
      while ((newline = pending.indexOf(10)) !== -1) {
        const bytes = pending.subarray(0, newline + 1); pending = pending.subarray(newline + 1);
        if (bytes.length > limits.record) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
        validJson(value);
        yield { value, bytes };
      }
      if (pending.length > limits.record) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
    }
    await closed;
    if (pumpError) throw pumpError;
    if (pending.length) throw backupError('INVALID_BACKUP', 400);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error?.code === 'BACKUP_LIMIT_EXCEEDED') throw error;
    throw backupError('INVALID_BACKUP', 400);
  } finally { input.destroy(); counter.destroy(); decoder.destroy(); await closed; }
}

export function normalizedDocument(doc) {
  const result = Object.fromEntries(Object.entries(doc).filter(([key]) =>
    !['_rev', '_revisions', '_revs_info', '_conflicts', '_deleted_conflicts', '_local_seq'].includes(key)));
  if (result._attachments) {
    result._attachments = Object.fromEntries(Object.entries(result._attachments).map(([name, value]) =>
      [name, { content_type: value.content_type, data: value.data }]));
    if (!Object.keys(result._attachments).length) delete result._attachments;
  }
  return result;
}
export const documentDigest = doc => createHash('sha256').update(canonicalJson(normalizedDocument(doc))).digest('hex');

export async function fileDigest(file, signal) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
  return hash.digest('hex');
}

export async function validateBackupFile({ file, config, signal, limits = BACKUP_LIMITS, progress = async () => {} }) {
  let header, indexes, footer;
  const expected = new Map(), designs = new Set(); const hash = createHash('sha256');
  const totals = { document_count: 0, design_count: 0, counts_by_type: Object.create(null),
    attachment_count: 0, attachment_bytes: 0, attachment_checksums: [] };
  for await (const { value, bytes } of readBackupRecords(file, signal, limits)) {
    if (footer) throw backupError('INVALID_BACKUP', 400);
    if (!header) {
      header = parseRecord(headerSchema, value);
      if (header.signing_key_id !== config.keyId) throw backupError('SIGNATURE_INVALID', 422);
    } else if (value.kind === 'document' && !indexes) {
      const { doc } = parseRecord(documentEnvelope, value);
      if (typeof doc._id !== 'string' || !doc._id || Buffer.byteLength(doc._id) > 1024 || expected.has(doc._id)
        || Object.keys(doc).some(key => key.startsWith('_') && !['_id', '_attachments'].includes(key))
        || (doc._id.startsWith('_') && !/^_design\/.+/.test(doc._id))) throw backupError('INVALID_BACKUP', 400);
      if (++totals.document_count > limits.documents) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
      if (doc._id.startsWith('_design/')) { designs.add(doc._id); totals.design_count++; }
      else { const type = typeof doc.type === 'string' ? doc.type : typeof doc.doc_type === 'string' ? doc.doc_type : 'unknown';
        totals.counts_by_type[type] = (totals.counts_by_type[type] || 0) + 1; }
      if ('_attachments' in doc) {
        if (!doc._attachments || typeof doc._attachments !== 'object' || Array.isArray(doc._attachments)) throw backupError('INVALID_BACKUP', 400);
        for (const [name, attachment] of Object.entries(doc._attachments)) {
          if (!name || !attachment || Object.keys(attachment).sort().join(',') !== 'content_type,data'
            || typeof attachment.content_type !== 'string' || !attachment.content_type || attachment.content_type.length > 256
            || typeof attachment.data !== 'string') throw backupError('INVALID_BACKUP', 400);
          const content = Buffer.from(attachment.data, 'base64');
          if (content.toString('base64') !== attachment.data) throw backupError('INVALID_BACKUP', 400);
          totals.attachment_bytes += content.length; totals.attachment_count++;
          if (content.length > limits.attachment || totals.attachment_bytes > limits.attachmentBytes) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
          totals.attachment_checksums.push({ document_id: doc._id, name, size: content.length,
            sha256: createHash('sha256').update(content).digest('hex') });
        }
      }
      expected.set(doc._id, documentDigest(doc));
      if (totals.document_count % 100 === 0) await progress(totals.document_count);
    } else if (value.kind === 'indexes' && !indexes) {
      indexes = parseRecord(indexesSchema, value).items; const names = new Set();
      for (const index of indexes) {
        const identity = `${index.ddoc}/${index.name}`;
        if (index.partitioned) throw backupError('UNSUPPORTED_INDEX', 415);
        if (!designs.has(index.ddoc) || names.has(identity)) throw backupError('INVALID_BACKUP', 400);
        names.add(identity);
        for (const field of index.index.fields) if (typeof field === 'object' && Object.keys(field).length !== 1) throw backupError('INVALID_BACKUP', 400);
      }
    } else if (value.kind === 'footer' && indexes) {
      footer = parseRecord(footerSchema, value);
      const { signature_hmac_sha256: signature, payload_sha256: digest, kind: _kind, ...manifest } = footer;
      if (hash.digest('hex') !== digest || canonicalJson(manifest) !== canonicalJson(totals)) throw backupError('CHECKSUM_MISMATCH', 422);
      const { signature_hmac_sha256: _signature, ...unsigned } = footer;
      const computed = createHmac('sha256', config.key).update(`RHBR1\n${digest}\n${canonicalJson(unsigned)}`).digest();
      if (!timingSafeEqual(Buffer.from(signature, 'hex'), computed)) throw backupError('SIGNATURE_INVALID', 422);
      continue;
    } else throw backupError('INVALID_BACKUP', 400);
    hash.update(bytes);
  }
  if (!footer) throw backupError('INVALID_BACKUP', 400);
  await progress(totals.document_count);
  return { header, indexes, expected, totals, digest: await fileDigest(file, signal) };
}
