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
    auth: { async authenticate(token) { if (token === 'invalid') throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Invalid session.'); return { user: {}, principal: { sub: 'user:sample', role: token === 'admin' ? 'ADMIN' : token === 'recruiter' ? 'RECRUITER' : 'CANDIDATE' } }; } },
    admin: {
        async list(query) { assert.equal(query.search, 'sample'); assert.equal(query.role, 'CANDIDATE'); return { users: [{ id: 'user:sample', email: 'sample@example.invalid', role: 'CANDIDATE', account_status: 'ACTIVE' }], nextCursor: null }; },
      async setAccountStatus() { throw new AuthServiceError(403, 'ADMIN_STATUS_CHANGE_FORBIDDEN', 'Admin status is operator-managed.'); },
    },
    statistics: { async getStatistics() { return { source: 'couchdb_mapreduce', totalUsers: 1 }; } },
  }) }));
  await withServer(app, async (base) => {
    const statusUrl = `${base}/api/v1/admin/users/${encodeURIComponent(`user:${'a'.repeat(64)}`)}/status`;
    const guestPatch = await fetch(statusUrl, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_status: 'LOCKED' }) });
    assert.equal(guestPatch.status, 401);
    const candidatePatch = await fetch(statusUrl, { method: 'PATCH', headers: { authorization: 'Bearer candidate', 'content-type': 'application/json', 'if-match': '"1-rev"' }, body: JSON.stringify({ account_status: 'LOCKED' }) });
    assert.equal(candidatePatch.status, 403);
    const guest = await fetch(`${base}/api/v1/admin/users`);
    assert.equal(guest.status, 401);
    const invalidSession = await fetch(`${base}/api/v1/admin/users`, { headers: { authorization: 'Bearer invalid' } });
    assert.equal(invalidSession.status, 401);
    const denied = await fetch(`${base}/api/v1/admin/users`, { headers: { authorization: 'Bearer candidate' } });
    assert.equal(denied.status, 403);
    const recruiterDenied = await fetch(`${base}/api/v1/admin/users`, { headers: { authorization: 'Bearer recruiter' } });
    assert.equal(recruiterDenied.status, 403);
    const allowed = await fetch(`${base}/api/v1/admin/users?search=sample&role=CANDIDATE`, { headers: { authorization: 'Bearer admin' } });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.data.users[0].id, 'user:sample');
    assert.equal('password_hash' in body.data.users[0], false);
    const guestStats = await fetch(`${base}/api/v1/admin/stats`);
    assert.equal(guestStats.status, 401);
    const adminStats = await fetch(`${base}/api/v1/admin/stats`, { headers: { authorization: 'Bearer admin' } });
    assert.equal(adminStats.status, 200);
    assert.equal((await adminStats.json()).data.source, 'couchdb_mapreduce');
    const restricted = await fetch(`${base}/api/v1/admin/users/${encodeURIComponent(`user:${'a'.repeat(64)}`)}/status`, {
      method: 'PATCH',
      headers: { authorization: 'Bearer admin', 'content-type': 'application/json', 'if-match': '"1-rev"' },
      body: JSON.stringify({ account_status: 'LOCKED' }),
    });
    assert.equal(restricted.status, 403);
    assert.equal((await restricted.json()).error.code, 'ADMIN_STATUS_CHANGE_FORBIDDEN');
  });
});

test('UC24 status route validates input, requires If-Match, and returns fresh ETags or conflict errors', async () => {
  const userId = `user:${'a'.repeat(64)}`;
  const app = express(); app.use(express.json());
  app.use('/api/v1/admin', createAdminUserRouter({ servicesFactory: () => ({
    auth: { async authenticate() { return { user: {}, principal: { sub: 'user:admin', role: 'ADMIN' } }; } },
    admin: {
      async list() { return { users: [], nextCursor: null }; },
      async setAccountStatus(id, status, revision) {
        if (id === `user:${'b'.repeat(64)}`) throw new AuthServiceError(404, 'USER_NOT_FOUND', 'User was not found.');
        if (!revision) throw new AuthServiceError(428, 'PRECONDITION_REQUIRED', 'If-Match is required.');
        if (revision !== 'rev-1') throw new AuthServiceError(409, 'REVISION_CONFLICT', 'Reload the user.');
        return { user: { id: userId, role: 'CANDIDATE', account_status: status }, revision: 'rev-2' };
      },
    },
    statistics: { async getStatistics() { return { source: 'couchdb_mapreduce', totalUsers: 0, totalCandidates: 0, roles: {}, statuses: {}, jobs: { total: 0, statuses: {} } }; } },
  }) }));
  await withServer(app, async (base) => {
    const endpoint = (id = userId) => `${base}/api/v1/admin/users/${encodeURIComponent(id)}/status`;
    const send = (body, headers = {}, id = userId) => fetch(endpoint(id), { method: 'PATCH', headers: { authorization: 'Bearer admin', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const invalid = await send({ account_status: 'RESET_REQUIRED' }, { 'if-match': '"rev-1"' });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');
    const missing = await send({ account_status: 'LOCKED' });
    assert.equal(missing.status, 428);
    assert.equal((await missing.json()).error.code, 'PRECONDITION_REQUIRED');
    const stale = await send({ account_status: 'LOCKED' }, { 'if-match': '"old-rev"' });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, 'REVISION_CONFLICT');
    const changed = await send({ account_status: 'LOCKED' }, { 'if-match': '"rev-1"' });
    assert.equal(changed.status, 200);
    assert.equal(changed.headers.get('etag'), '"rev-2"');
    assert.equal((await changed.json()).data.user.account_status, 'LOCKED');
    const missingTarget = await send({ account_status: 'LOCKED' }, { 'if-match': '"rev-1"' }, `user:${'b'.repeat(64)}`);
    assert.equal(missingTarget.status, 404);
    assert.equal((await missingTarget.json()).error.code, 'USER_NOT_FOUND');
  });
});
