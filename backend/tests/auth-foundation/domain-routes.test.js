import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCandidateProfileRouter } from '../../src/routes/candidate-profile.routes.js';
import { createAdminUserRouter } from '../../src/routes/admin-user.routes.js';
import { AuthServiceError } from '../../src/services/auth.service.js';

async function withServer(app, run) {
  const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('Candidate profile routes require a verified Candidate principal and use ETag revisions', async () => {
  const app = express(); app.use(express.json());
  app.use('/api/v1/candidate/profile', createCandidateProfileRouter({ servicesFactory: () => ({
    auth: { async authenticate(token) { return { user: {}, principal: { sub: `user:${'a'.repeat(64)}`, role: token === 'recruiter' ? 'RECRUITER' : 'CANDIDATE' } }; } },
    profile: {
      async getMyProfile(id) { assert.equal(id, `user:${'a'.repeat(64)}`); return { profile: { profile: { full_name: 'Candidate' } }, revision: '1-profile' }; },
      async updateMyProfile(_id, _body, rev) { assert.equal(rev, '1-profile'); return { profile: { profile: { full_name: 'Updated' } }, revision: '2-profile' }; },
    },
  }) }));
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/v1/candidate/profile/me`, { headers: { authorization: 'Bearer candidate' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('etag'), '"1-profile"');
    const denied = await fetch(`${base}/api/v1/candidate/profile/me`, { headers: { authorization: 'Bearer recruiter' } });
    assert.equal(denied.status, 403);
    const update = await fetch(`${base}/api/v1/candidate/profile/me`, { method: 'PATCH', headers: { authorization: 'Bearer candidate', 'content-type': 'application/json', 'if-match': '"1-profile"' }, body: JSON.stringify({ profile: { full_name: 'Updated' } }) });
    assert.equal(update.status, 200);
    assert.equal(update.headers.get('etag'), '"2-profile"');
  });
});

test('Admin user routes reject non-Admin principals and expose no mutation to role fields', async () => {
  const app = express(); app.use(express.json());
  app.use('/api/v1/admin', createAdminUserRouter({ servicesFactory: () => ({
    auth: { async authenticate(token) { return { user: {}, principal: { sub: 'user:sample', role: token === 'admin' ? 'ADMIN' : 'CANDIDATE' } }; } },
    admin: {
      async list() { return { users: [{ id: 'user:sample', email: 'sample@example.invalid' }], nextCursor: null }; },
      async getStatistics() { return { totalUsers: 1 }; },
      async setAccountStatus() { throw new AuthServiceError(403, 'ADMIN_STATUS_CHANGE_FORBIDDEN', 'Admin status is operator-managed.'); },
    },
  }) }));
  await withServer(app, async (base) => {
    const denied = await fetch(`${base}/api/v1/admin/users`, { headers: { authorization: 'Bearer candidate' } });
    assert.equal(denied.status, 403);
    const allowed = await fetch(`${base}/api/v1/admin/users`, { headers: { authorization: 'Bearer admin' } });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.data.users[0].id, 'user:sample');
    const restricted = await fetch(`${base}/api/v1/admin/users/${encodeURIComponent(`user:${'a'.repeat(64)}`)}/status`, {
      method: 'PATCH',
      headers: { authorization: 'Bearer admin', 'content-type': 'application/json', 'if-match': '"1-rev"' },
      body: JSON.stringify({ account_status: 'LOCKED' }),
    });
    assert.equal(restricted.status, 403);
    assert.equal((await restricted.json()).error.code, 'ADMIN_STATUS_CHANGE_FORBIDDEN');
  });
});
