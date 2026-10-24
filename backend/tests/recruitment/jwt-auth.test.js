import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken, startFixture } from './fixtures.js';

test('Job/Application uses the TV1 HS256 secret, claims, expiry, and canonical active User', async t => {
  const f = await startFixture(t);
  const now = f.now();
  const valid = signToken(f.jwtEnv, f.users.candidate, {}, {}, now);
  assert.equal((await f.request('GET', '/applications/context', undefined, null, valid)).status, 200);
  const forgedRole = signToken(f.jwtEnv, f.users.candidate, { role: 'ADMIN' }, {}, now);
  assert.equal((await f.request('GET', '/applications/context', undefined, null, forgedRole)).status, 200);
  for (const [claims, header] of [
    [{ exp: Math.floor(now / 1000) }, {}], [{ iat: undefined }, {}], [{ sub: 'candidate:one' }, {}],
    [{ iss: 'bad' }, {}], [{ aud: 'bad' }, {}], [{}, { alg: 'none' }], [{}, { alg: 'HS512' }],
  ]) {
    const invalid = signToken(f.jwtEnv, f.users.candidate, claims, header, now);
    assert.equal((await f.request('GET', '/applications/context', undefined, null, invalid)).status, 401);
  }
  const badSignature = `${valid.slice(0, valid.lastIndexOf('.') + 1)}AAAA`;
  assert.equal((await f.request('GET', '/applications/context', undefined, null, badSignature)).status, 401);
  assert.equal((await f.request('GET', '/applications/context', undefined, null)).status, 401);
  assert.equal((await f.request('GET', '/applications/context', undefined, null, 'a.b.c')).status, 401);
});

test('Canonical User role and ACTIVE status override untrusted role claims', async t => {
  const f = await startFixture(t);
  const forgedRole = signToken(f.jwtEnv, f.users.candidate, { role: 'RECRUITER' }, {}, f.now());
  assert.equal((await f.request('GET', '/recruiter/jobs', undefined, null, forgedRole)).status, 403);
  for (const state of ['LOCKED', 'RESET_REQUIRED']) {
    f.repo.docs.get(f.users.candidate._id).account_status = state;
    assert.equal((await f.request('GET', '/applications/context')).status, 401);
  }
  f.repo.docs.delete(f.users.candidate._id);
  assert.equal((await f.request('GET', '/applications/context')).status, 401);
});

test('Missing TV1 JWT configuration is a controlled dependency error', async t => {
  const f = await startFixture(t, { jwtEnv: { JWT_ACCESS_SECRET: '' } });
  const response = await f.request('GET', '/applications/context', undefined, null);
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'AUTH_NOT_CONFIGURED');
  assert.ok(!JSON.stringify(response.body).includes('stack'));
});
