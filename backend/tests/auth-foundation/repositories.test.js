import test from 'node:test';
import assert from 'node:assert/strict';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { CandidateRepository } from '../../src/repositories/candidate.repository.js';
import { userIdFromEmail } from '../../src/utils/id.utils.js';

test('UserRepository resolves canonical email to deterministic ID without Mango lookup', async () => {
  let requestedId;
  const repo = new UserRepository({
    client: {
      async getDocument(id) { requestedId = id; return { _id: id, type: 'user' }; },
      async find() { assert.fail('email lookup must not use Mango'); },
    },
  });

  await repo.getByEmail(' Person@Example.com ');
  assert.equal(requestedId, userIdFromEmail('person@example.com'));
});

test('CandidateRepository constrains lookup by type and canonical user ID', async () => {
  let query;
  const repo = new CandidateRepository({
    client: { async find(value) { query = value; return { docs: [] }; } },
  });
  const userId = userIdFromEmail('person@example.com');

  await repo.findByUserId(userId);
  assert.deepEqual(query, {
    selector: { type: 'candidate', user_id: userId },
    limit: 2,
  });
  assert.throws(() => repo.findByUserId('user:not-canonical'), /canonical User/);
});
