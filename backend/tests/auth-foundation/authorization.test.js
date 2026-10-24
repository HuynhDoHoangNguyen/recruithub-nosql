import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireOwnership, requireScope } from '../../src/middleware/authorize.js';

async function call(middleware, auth, path = '/resource-1?scope=company-1') {
  const app = express();
  app.get('/:id', (req, res, next) => { req.auth = auth; next(); }, middleware, (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('ownership middleware returns 404/403 and attaches only an owned resource', async () => {
  const owned = requireOwnership({ loadResource: async (id) => id === 'missing' ? null : { user_id: `user:${'a'.repeat(64)}` } });
  assert.equal((await call(owned, { sub: `user:${'a'.repeat(64)}` })).status, 200);
  assert.equal((await call(owned, { sub: `user:${'b'.repeat(64)}` })).status, 403);
  const missing = requireOwnership({ loadResource: async () => null });
  assert.equal((await call(missing, { sub: `user:${'a'.repeat(64)}` }, '/missing')).status, 404);
});

test('scope middleware permits only a server-resolved scope', async () => {
  const scope = requireScope({ resolveAllowedScopes: async () => ['company-1'], getRequestedScope: (req) => req.query.scope });
  assert.equal((await call(scope, { sub: 'recruiter:1' })).status, 200);
  const denied = await call(scope, { sub: 'recruiter:1' }, '/resource-1?scope=company-2');
  assert.equal(denied.status, 403);
});
