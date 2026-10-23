import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAuthRouter, getAuthDatabaseConfig } from '../../src/routes/auth.routes.js';
import { requireRole } from '../../src/middleware/authenticate.js';

const validRegistration = {
  email: 'candidate@example.test',
  password: 'StrongPass1',
  full_name: 'Candidate Example',
  candidate_role: 'Designer',
  industry: 'Technology',
  seniority: 'MID',
  years_experience: 4,
};
const safeUser = {
  id: `user:${'a'.repeat(64)}`,
  email: validRegistration.email,
  role: 'CANDIDATE',
  account_status: 'ACTIVE',
};

test('auth persistence requires a separate database and refuses recruitment_db', () => {
  assert.throws(() => getAuthDatabaseConfig({}), (error) => error.code === 'AUTH_DATABASE_CONFIGURATION_ERROR');
  assert.throws(() => getAuthDatabaseConfig({ AUTH_COUCHDB_DATABASE: 'recruitment_db' }), (error) => error.code === 'AUTH_DATABASE_CONFIGURATION_ERROR');
  const config = getAuthDatabaseConfig({
    AUTH_COUCHDB_DATABASE: 'recruitment_auth_test',
    COUCHDB_URL: 'http://127.0.0.1:5984',
  });
  assert.equal(config.database, 'recruitment_auth_test');
});

test('register → login → me uses the existing router contract and safe user DTO', async (t) => {
  let registered = false;
  const service = {
    async register(input) {
      assert.equal(input.role, undefined);
      registered = true;
      return { user: safeUser };
    },
    async login(input) {
      assert.equal(registered, true);
      assert.equal(input.password, validRegistration.password);
      return { accessToken: 'test-token', user: safeUser };
    },
    async authenticate(token) {
      assert.equal(token, 'test-token');
      return { user: safeUser, principal: { sub: safeUser.id, role: safeUser.role } };
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', createAuthRouter({ serviceFactory: () => service }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;

  const registration = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validRegistration),
  });
  assert.equal(registration.status, 201);
  assert.equal((await registration.json()).data.user.role, 'CANDIDATE');

  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: validRegistration.email, password: validRegistration.password }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(loginBody.data.accessToken, 'test-token');
  assert.equal(JSON.stringify(loginBody).includes('password_hash'), false);

  const me = await fetch(`${base}/me`, { headers: { authorization: 'Bearer test-token' } });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).data.user, safeUser);
});

test('basic RBAC checks server principal role', async (t) => {
  const app = express();
  app.get('/admin-only', (req, res, next) => {
    req.auth = { role: 'CANDIDATE' };
    next();
  }, requireRole('ADMIN'), (_req, res) => res.sendStatus(204));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/admin-only`);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');
});
