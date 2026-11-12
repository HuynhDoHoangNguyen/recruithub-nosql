import test from 'node:test';
import assert from 'node:assert/strict';
import { RestoreRepository, PRIVATE_SECURITY } from '../../src/models/admin-restore.repository.js';
import { documentDigest } from '../../src/services/admin-backup-validation.service.js';
import { verifyRestored } from '../../src/services/admin-restore-verification.service.js';
import { MemoryRestoreRepository } from '../helpers/admin-restore-fixtures.js';

function serverRequest({ exists = false, privacy = 'admin_only', security = PRIVATE_SECURITY, race = false } = {}) {
  const calls = [];
  return { calls, request: async (url, options) => {
    const u = new URL(url); calls.push([options.method, u.pathname]);
    const reply = (body, status = 200) => new Response(options.method === 'HEAD' ? null : JSON.stringify(body), { status });
    if (u.pathname === '/') return reply({ version: '3.5.2' });
    if (u.pathname === '/_session') return reply({ userCtx: { roles: ['_admin'] } });
    if (u.pathname === '/_membership') return reply({ all_nodes: ['node@host'], cluster_nodes: ['node@host'] });
    if (u.pathname.includes('/_config/')) return reply({ default_security: privacy });
    if (options.method === 'HEAD') return reply(null, exists ? 200 : 404);
    if (options.method === 'PUT' && !u.pathname.endsWith('/_security')) return reply({ ok: !race }, race ? 412 : 201);
    if (u.pathname.endsWith('/_security')) return reply(options.method === 'GET' ? security : { ok: true });
    throw new Error('Unexpected fixture request');
  } };
}

test('target adapter preflights private defaults, rejects existing/racing target and never writes source', async () => {
  for (const mode of ['private', 'existing', 'public', 'race']) {
    const f = serverRequest({ exists: mode === 'existing', privacy: mode === 'public' ? 'everyone' : 'admin_only', race: mode === 'race' });
    const repo = new RestoreRepository({ url: 'http://fixture', username: 'admin', password: 'test' }, 'recruithub_restore_test_new', { request: f.request, env: { COUCHDB_DATABASE: 'recruitment_db' } });
    if (mode === 'private') { await repo.createPrivate(new AbortController().signal); assert.equal(repo.created, true); }
    else await assert.rejects(repo.createPrivate(new AbortController().signal), e => ['TARGET_EXISTS', 'RESTORE_SECURITY_ERROR'].includes(e.code));
    if (mode === 'existing' || mode === 'public') assert.equal(f.calls.some(([method]) => method === 'PUT'), false);
    assert.equal(f.calls.some(([, endpoint]) => endpoint.includes('recruitment_db')), false);
    assert.equal(f.calls.some(([method]) => method === 'DELETE'), false);
  }
  assert.throws(() => new RestoreRepository({ url: 'http://fixture' }, 'recruithub_restore_test_source', { env: { COUCHDB_DATABASE: 'recruithub_restore_test_source' } }));
});

test('verification detects missing/extra docs, wrong fields/attachments, indexes and concurrent changes', async () => {
  const original = { _id: 'asset:1', type: 'uploaded_asset', _attachments: { content: { content_type: 'x', data: 'AA==' } } };
  for (const mode of ['valid', 'missing', 'extra', 'field', 'attachment', 'index', 'concurrent', 'security']) {
    const repo = new MemoryRestoreRepository('recruithub_restore_test_verify'); repo.created = true;
    repo.docs.set(original._id, structuredClone(original));
    if (mode === 'missing') repo.docs.clear();
    if (mode === 'extra') repo.docs.set('extra', { _id: 'extra' });
    if (mode === 'field') repo.docs.get(original._id).unexpected = true;
    if (mode === 'attachment') repo.docs.get(original._id)._attachments.content.data = 'AQ==';
    if (mode === 'index') repo.savedIndexes.push({ ddoc: '_design/unexpected', name: 'unexpected', type: 'json', index: { fields: ['type'] } });
    if (mode === 'security') repo.private = false;
    if (mode === 'concurrent') { const reader = repo.reader.bind(repo); repo.reader = () => {
      const r = reader(); let calls = 0; r.metadata = async () => ({ doc_count: 1, update_seq: String(calls++) }); return r;
    }; }
    const validation = { expected: new Map([[original._id, documentDigest(original)]]), indexes: [] };
    if (mode === 'valid') assert.equal((await verifyRestored(repo, validation, new AbortController().signal)).verified_documents, 1);
    else await assert.rejects(verifyRestored(repo, validation, new AbortController().signal));
  }
});
