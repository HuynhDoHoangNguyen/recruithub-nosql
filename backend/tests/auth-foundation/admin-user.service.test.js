import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminUserService } from '../../src/services/admin-user.service.js';

const userId = `user:${'a'.repeat(64)}`;
function user(overrides = {}) {
  return { _id: userId, _rev: '1-rev', type: 'user', email: 'admin@example.invalid', email_normalized: 'admin@example.invalid', role: 'ADMIN', account_status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', password_hash: 'secret-hash-never-return', ...overrides };
}
function makeService({ users = [user()], candidates = [{ _id: 'candidate:1', type: 'candidate' }] } = {}) {
  const repo = {
    users, scans: [],
    async listByIdPrefix({ afterId, limit }) {
      this.scans.push({ afterId, limit });
      const all = this.users.filter((item) => item._id.startsWith('user:')).sort((a, b) => a._id.localeCompare(b._id));
      const offset = afterId ? all.findIndex((item) => item._id === afterId) + 1 : 0;
      const docs = all.slice(offset, offset + limit);
      return { docs, lastId: docs.at(-1)?._id ?? afterId ?? null, hasMore: offset + docs.length < all.length };
    },
    async getById(id) { const found = this.users.find((item) => item._id === id); if (!found) throw Object.assign(new Error('missing'), { code: 'NOT_FOUND' }); return found; },
    async update(document, revision) { const index = this.users.findIndex((item) => item._id === document._id); if (this.users[index]._rev !== revision) throw Object.assign(new Error('conflict'), { code: 'CONFLICT' }); this.users[index] = { ...document, _rev: '2-rev' }; return { rev: '2-rev' }; },
  };
  const candidateRepo = { async listByIdPrefix({ afterId, limit }) { const all = candidates.filter((item) => item.type === 'candidate').sort((a, b) => a._id.localeCompare(b._id)); const offset = afterId ? all.findIndex((item) => item._id === afterId) + 1 : 0; const docs = all.slice(offset, offset + limit); return { docs, lastId: docs.at(-1)?._id ?? afterId ?? null, hasMore: offset + docs.length < all.length }; } };
  return { service: new AdminUserService({ userRepository: repo, candidateRepository: candidateRepo }), repo };
}

test('Admin user listing applies owned filters, paging, and safe DTO projection', async () => {
  const users = [user(), user({ _id: `user:${'b'.repeat(64)}`, email: 'bob@example.invalid', email_normalized: 'bob@example.invalid', role: 'CANDIDATE' }), user({ _id: `user:${'c'.repeat(64)}`, email: 'c@example.invalid', email_normalized: 'c@example.invalid', role: 'CANDIDATE' })];
  const { service, repo } = makeService({ users });
  const page1 = await service.list({ limit: 1, role: 'CANDIDATE' });
  assert.equal(page1.users.length, 1);
  assert.equal(page1.users[0].email, 'bob@example.invalid');
  assert.equal('password_hash' in page1.users[0], false);
  assert.ok(page1.nextCursor);
  assert.equal(repo.scans[0].afterId, undefined);
  assert.equal(repo.scans[0].limit, 250);
  await assert.rejects(() => service.list({ limit: 1, role: 'ADMIN', cursor: page1.nextCursor }), { code: 'INVALID_CURSOR' });
});

test('Admin user listing rejects invalid filters and bounds scans while preserving a resumable cursor', async () => {
  const users = Array.from({ length: 5200 }, (_, index) => user({
    _id: `user:${String(index).padStart(64, '0')}`,
    email: `person${index}@example.invalid`,
    email_normalized: `person${index}@example.invalid`,
    role: 'CANDIDATE',
  }));
  const { service, repo } = makeService({ users });
  await assert.rejects(() => service.list({ search: 'x'.repeat(101) }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => service.list({ role: 'OWNER' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => service.list({ limit: 51 }), { code: 'VALIDATION_ERROR' });

  const first = await service.list({ search: 'no-match' });
  assert.equal(first.users.length, 0);
  assert.ok(first.nextCursor);
  assert.equal(repo.scans.length, 20);
  assert.equal(repo.scans.reduce((sum, scan) => sum + scan.limit, 0), 5000);
  const second = await service.list({ search: 'no-match', cursor: first.nextCursor });
  assert.equal(second.users.length, 0);
  assert.equal(repo.scans.length, 21);
  await assert.rejects(() => service.list({ search: 'different', cursor: first.nextCursor }), { code: 'INVALID_CURSOR' });
});

test('Admin status changes require current revision and cannot activate RESET_REQUIRED users', async () => {
  const { service, repo } = makeService({ users: [user({ role: 'CANDIDATE', account_status: 'RESET_REQUIRED' })] });
  await assert.rejects(() => service.setAccountStatus(userId, 'ACTIVE', '1-rev'), { code: 'RESET_REQUIRED_PROTECTED' });
  assert.equal(repo.users[0].account_status, 'RESET_REQUIRED');
  assert.equal(repo.users[0].password_hash, 'secret-hash-never-return');
});

test('Admin status changes are operator-managed and rejected for Admin accounts', async () => {
  const { service, repo } = makeService({ users: [user()] });
  const attempts = await Promise.allSettled([
    service.setAccountStatus(userId, 'LOCKED', '1-rev'),
    service.setAccountStatus(userId, 'ACTIVE', '1-rev'),
    service.setAccountStatus(userId, 'LOCKED', undefined),
  ]);
  assert.deepEqual(attempts.map((result) => result.status), ['rejected', 'rejected', 'rejected']);
  for (const result of attempts) {
    assert.equal(result.reason.status, 403);
    assert.equal(result.reason.code, 'ADMIN_STATUS_CHANGE_FORBIDDEN');
  }
  assert.equal(repo.users[0].account_status, 'ACTIVE');
  assert.equal(repo.users[0]._rev, '1-rev');
  assert.equal(repo.scans.length, 0);
});

test('concurrent Admin status requests cannot lock or unlock an Admin account', async () => {
  const { service, repo } = makeService({ users: [user()] });
  const outcomes = await Promise.allSettled([
    service.setAccountStatus(userId, 'LOCKED', '1-rev'),
    service.setAccountStatus(userId, 'ACTIVE', '1-rev'),
    service.setAccountStatus(userId, 'LOCKED', '1-rev'),
    service.setAccountStatus(userId, 'ACTIVE', '1-rev'),
  ]);
  assert.ok(outcomes.every((outcome) => outcome.status === 'rejected'));
  assert.ok(outcomes.every((outcome) => outcome.reason.status === 403 && outcome.reason.code === 'ADMIN_STATUS_CHANGE_FORBIDDEN'));
  assert.equal(repo.users[0].account_status, 'ACTIVE');
  assert.equal(repo.users[0]._rev, '1-rev');
});

test('Admin status changes keep ETag preconditions and update eligible accounts with _rev', async () => {
  const admins = makeService({ users: [user()] });
  await assert.rejects(() => admins.service.setAccountStatus(userId, 'LOCKED', 'stale-rev'), { code: 'ADMIN_STATUS_CHANGE_FORBIDDEN' });
  assert.equal(admins.repo.users[0].account_status, 'ACTIVE');
  const accounts = makeService({ users: [user({ role: 'CANDIDATE', account_status: 'ACTIVE' }), user({ _id: `user:${'b'.repeat(64)}`, role: 'RECRUITER', account_status: 'ACTIVE' })] });
  await assert.rejects(() => accounts.service.setAccountStatus(userId, 'LOCKED', undefined), { code: 'PRECONDITION_REQUIRED' });
  await assert.rejects(() => accounts.service.setAccountStatus(userId, 'LOCKED', 'stale-rev'), { code: 'REVISION_CONFLICT' });
  const result = await accounts.service.setAccountStatus(`user:${'b'.repeat(64)}`, 'LOCKED', '1-rev');
  assert.equal(result.user.account_status, 'LOCKED');
  assert.equal(result.revision, '2-rev');
});

test('UC24 permits only ACTIVE to LOCKED and LOCKED to ACTIVE, with no automatic retry', async () => {
  const account = user({ role: 'CANDIDATE', account_status: 'ACTIVE' });
  const { service, repo } = makeService({ users: [account] });
  const locked = await service.setAccountStatus(userId, 'LOCKED', '1-rev');
  assert.equal(locked.user.account_status, 'LOCKED');
  assert.equal(locked.revision, '2-rev');
  const unlocked = await service.setAccountStatus(userId, 'ACTIVE', '2-rev');
  assert.equal(unlocked.user.account_status, 'ACTIVE');
  assert.equal(unlocked.revision, '2-rev');
  await assert.rejects(() => service.setAccountStatus(userId, 'ACTIVE', '2-rev'), { code: 'INVALID_STATUS_TRANSITION' });
  await assert.rejects(() => service.setAccountStatus(userId, 'RESET_REQUIRED', '2-rev'), { code: 'VALIDATION_ERROR' });
  assert.equal(repo.users[0].account_status, 'ACTIVE');
});

test('UC24 rejects missing targets and never retries a write conflict', async () => {
  const missing = makeService({ users: [] });
  await assert.rejects(() => missing.service.setAccountStatus(userId, 'LOCKED', '1-rev'), { code: 'NOT_FOUND' });
  const account = user({ role: 'RECRUITER', account_status: 'ACTIVE' });
  const { service } = makeService({ users: [account] });
  let writes = 0;
  service.users.update = async () => { writes += 1; throw Object.assign(new Error('conflict'), { code: 'CONFLICT' }); };
  await assert.rejects(() => service.setAccountStatus(userId, 'LOCKED', '1-rev'), { code: 'REVISION_CONFLICT' });
  assert.equal(writes, 1);
});
