import { backupError, canonicalJson } from '../models/admin-backup.schema.js';
import { documentDigest } from './admin-backup-validation.service.js';

export function normalizedIndex(item) {
  const definition = item.index || item.def;
  return { ddoc: item.ddoc, name: item.name, type: item.type, partitioned: Boolean(item.partitioned),
    index: { ...definition, fields: definition.fields.map(field => typeof field === 'string' ? { [field]: 'asc' } : field) } };
}
export async function ensureIndexes(repository, indexes, signal, createMissing = true) {
  let current = (await repository.indexes(signal)).indexes;
  if (!Array.isArray(current)) throw backupError('RESTORE_VERIFICATION_FAILED');
  for (const index of indexes) {
    const found = current.find(item => item.ddoc === index.ddoc && item.name === index.name);
    if (found) {
      if (canonicalJson(normalizedIndex(found)) !== canonicalJson(normalizedIndex(index))) throw backupError('RESTORE_VERIFICATION_FAILED');
    } else {
      if (!createMissing) throw backupError('RESTORE_VERIFICATION_FAILED');
      await repository.createIndex(index, signal);
    }
  }
  current = (await repository.indexes(signal)).indexes.filter(item => item.type !== 'special');
  const normalized = values => values.map(normalizedIndex).map(canonicalJson).sort();
  if (canonicalJson(normalized(current)) !== canonicalJson(normalized(indexes))) throw backupError('RESTORE_VERIFICATION_FAILED');
}

export async function verifyRestored(repository, validation, signal, progress = async () => {}) {
  await repository.assertPrivate(signal);
  const reader = repository.reader(); const start = await reader.metadata(signal);
  if (start.doc_count !== validation.expected.size) throw backupError('RESTORE_VERIFICATION_FAILED');
  let count = 0; const seen = new Set();
  for await (const doc of reader.documents(signal)) {
    if (seen.has(doc._id) || doc._conflicts?.length || validation.expected.get(doc._id) !== documentDigest(doc)) throw backupError('RESTORE_VERIFICATION_FAILED');
    seen.add(doc._id); count++;
    if (count % 100 === 0) await progress(count);
  }
  if (count !== validation.expected.size) throw backupError('RESTORE_VERIFICATION_FAILED');
  await ensureIndexes(repository, validation.indexes, signal, false);
  const end = await reader.metadata(signal);
  await repository.assertPrivate(signal);
  if (canonicalJson(start.update_seq) !== canonicalJson(end.update_seq)) throw backupError('RESTORE_VERIFICATION_FAILED');
  await progress(count);
  return { verified_documents: count, indexes_verified: true, attachments_verified: true };
}
