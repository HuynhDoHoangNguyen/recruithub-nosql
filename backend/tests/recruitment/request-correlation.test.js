import assert from 'node:assert/strict';
import test from 'node:test';
import { signToken, startFixture } from './fixtures.js';

test('Server correlation is unique, exposed to allowed origins and present on error responses', async t => {
  const origin = 'http://localhost:5173';
  const f = await startFixture(t, { jwtEnv: { FRONTEND_URL: origin } });
  const token = signToken(f.jwtEnv, f.users.candidate, {}, {}, f.now());
  const suppliedId = 'caller-controlled-id';
  const requests = [
    ['/applications/context', { headers: { Authorization: 'Bearer ' + token } }, 200],
    ['/applications/context', {}, 401],
    ['/recruiter/jobs', { headers: { Authorization: 'Bearer ' + token } }, 403],
    ['/missing-route', {}, 404],
    ['/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, 400],
  ];
  const ids = await Promise.all(requests.map(async ([path, options, status]) => {
    const response = await fetch(f.origin + '/api/v1' + path, {
      ...options,
      headers: { Origin: origin, 'X-Request-Id': suppliedId, ...options.headers },
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-expose-headers'), /X-Request-Id/i);
    const id = response.headers.get('x-request-id');
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.notEqual(id, suppliedId);
    await response.arrayBuffer();
    return id;
  }));
  assert.equal(new Set(ids).size, requests.length);
});
