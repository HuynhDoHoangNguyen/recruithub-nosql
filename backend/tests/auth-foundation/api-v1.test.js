import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../../src/app.js';

test('Auth MVP routes are mounted without changing operational health', async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    success: true,
    message: 'RecruiHub Backend is running',
  });

  const invalidRegistration = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', password: 'not-secret' }),
  });
  assert.equal(invalidRegistration.status, 400);
  const validationBody = await invalidRegistration.json();
  assert.equal(validationBody.error.code, 'VALIDATION_ERROR');
  assert.equal(JSON.stringify(validationBody).includes('not-secret'), false);

  const noPrincipal = await fetch(`${base}/api/v1/auth/me`);
  assert.equal(noPrincipal.status, 401);
  assert.equal((await noPrincipal.json()).error.code, 'AUTHENTICATION_FAILED');

  const protectedProfile = await fetch(`${base}/api/v1/candidate/profile/me`);
  assert.equal(protectedProfile.status, 401);
  const protectedAdmin = await fetch(`${base}/api/v1/admin/users`);
  assert.equal(protectedAdmin.status, 401);
});
