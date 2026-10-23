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

test('Admin statistics are calculated from repository pages, not hardcoded', async () => {
  const { service } = makeService({
    users: [user(), user({ _id: `user:${'b'.repeat(64)}`, role: 'CANDIDATE', account_status: 'LOCKED' })],
    candidates: [{ _id: 'candidate:1', type: 'candidate' }, { _id: 'candidate:2', type: 'candidate' }],
  });
  const stats = await service.getStatistics();
  assert.equal(stats.totalUsers, 2);
  assert.equal(stats.totalCandidates, 2);
  assert.equal(stats.roles.ADMIN, 1);
  assert.equal(stats.statuses.LOCKED, 1);
});
