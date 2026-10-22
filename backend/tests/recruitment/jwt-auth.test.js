import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken, startFixture } from './fixtures.js';

test('JWT adapter verifies signature, expiry, algorithm, subject, issuer and audience', async t => {
  const f = await startFixture(t, { jwtEnv: { JWT_ISSUER: 'test-identity', JWT_AUDIENCE: 'test-web' } });
  const valid = { iss: 'test-identity', aud: 'test-web' };
  const token = signToken(f.jwtEnv, f.users.candidate, valid);
  assert.equal((await f.request('GET', '/applications/context', undefined, null, token)).status, 200);
  for (const [claims, header] of [
    [{ ...valid, exp: 1 }, {}], [{ ...valid, exp: undefined }, {}], [{ ...valid, nbf: Date.now() / 1000 + 3600 }, {}],
    [{ ...valid, sub: 'candidate:one' }, {}], [{ ...valid, user_id: f.users.otherCandidate._id }, {}],
    [{ ...valid, iss: 'bad' }, {}], [{ ...valid, aud: 'bad' }, {}], [valid, { alg: 'none' }], [valid, { alg: 'HS512' }],
  ]) {
    const invalid = signToken(f.jwtEnv, f.users.candidate, claims, header);
    assert.equal((await f.request('GET', '/applications/context', undefined, null, invalid)).status, 401);
  }
  const badSignature = `${token.slice(0, token.lastIndexOf('.') + 1)}AAAA`;
  assert.equal((await f.request('GET', '/applications/context', undefined, null, badSignature)).status, 401);
  assert.equal((await f.request('GET', '/applications/context', undefined, null)).status, 401);
  assert.equal((await f.request('GET', '/applications/context', undefined, null, 'a.b.c')).status, 401);
});

test('Canonical User ACTIVE status and role override untrusted claims', async t => {
  const f = await startFixture(t);
  const forgedRole = signToken(f.jwtEnv, f.users.candidate, { role: 'RECRUITER' });
  assert.equal((await f.request('GET', '/recruiter/jobs', undefined, null, forgedRole)).status, 403);
  for (const state of ['LOCKED', 'RESET_REQUIRED']) {
    f.repo.docs.get(f.users.candidate._id).account_status = state;
    assert.equal((await f.request('GET', '/applications/context')).status, 401);
  }
  f.repo.docs.delete(f.users.candidate._id);
  assert.equal((await f.request('GET', '/applications/context')).status, 401);
});

test('Missing JWT configuration is a controlled dependency error, without secrets', async t => {
  const f = await startFixture(t, { jwtEnv: { JWT_SECRET: '', JWT_ALGORITHM: 'HS256' } });
  const response = await f.request('GET', '/applications/context', undefined, null);
  assert.equal(response.status, 503); assert.equal(response.body.error.code, 'AUTH_NOT_CONFIGURED');
  assert.ok(!JSON.stringify(response.body).includes('stack'));
});
