import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { BaseRepository, RepositoryValidationError } from '../../src/repositories/base.repository.js';

function createFakeClient() {
  const calls = [];
  return {
    calls,
    getDocument: async (...args) => (calls.push(['getDocument', ...args]), { _id: args[0] }),
    find: async (...args) => (calls.push(['find', ...args]), { docs: [] }),
    createDocument: async (...args) => (calls.push(['createDocument', ...args]), { ok: true }),
    updateDocument: async (...args) => (calls.push(['updateDocument', ...args]), { ok: true }),
    exists: async (...args) => (calls.push(['exists', ...args]), true),
    getDatabaseInfo: async (...args) => (calls.push(['getDatabaseInfo', ...args]), { doc_count: 1 }),
  };
}

test('repository delegates reads and emits a Mango selector without mutation', async () => {
  const client = createFakeClient();
  const repository = new BaseRepository({ client });
  await repository.getById('user:1');
  await repository.find({ type: 'user' }, { limit: 5 });
  assert.deepEqual(client.calls[0], ['getDocument', 'user:1']);
  assert.deepEqual(client.calls[1], ['find', { limit: 5, selector: { type: 'user' } }]);
});

test('repository validates documents, requires expected revisions, and delegates CRUD', async () => {
  const client = createFakeClient();
  const repository = new BaseRepository({
    client,
    schema: z.object({ _id: z.string(), name: z.string() }).strict(),
  });
  const document = { _id: 'company:1', name: 'Example' };
  await repository.create(document);
  await repository.update(document, '1-old');
  await repository.exists(document._id);
  await repository.getDatabaseInfo();
  assert.deepEqual(client.calls.map(([name]) => name), [
    'createDocument', 'updateDocument', 'exists', 'getDatabaseInfo',
  ]);
  await assert.rejects(repository.update(document), /expectedRev/);
  await assert.rejects(repository.create({ _id: 'company:2' }), RepositoryValidationError);
});

test('repository does not manufacture a document type or id', async () => {
  const client = createFakeClient();
  const repository = new BaseRepository({ client });
  const document = { _id: 'custom:stable-id', name: 'unchanged' };
  await repository.create(document);
  assert.deepEqual(client.calls[0][1], document);
  assert.equal(document.type, undefined);
});
