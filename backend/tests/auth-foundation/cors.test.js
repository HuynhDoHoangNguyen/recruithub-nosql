import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';

process.env.FRONTEND_URL = 'http://127.0.0.1:5173,http://127.0.0.1:5178';
const { default: app } = await import('../../src/app.js?cors-preflight-test');

async function withServer(run) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('CORS preflight allows configured local origins and auth/revision headers only', async () => {
  await withServer(async (base) => {
    const allowed = await fetch(`${base}/api/v1/candidate/profile/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:5178',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type,if-match',
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5178');
    assert.match(allowed.headers.get('access-control-allow-methods') ?? '', /PATCH/);
    const headers = (allowed.headers.get('access-control-allow-headers') ?? '').toLowerCase();
    assert.match(headers, /authorization/);
    assert.match(headers, /content-type/);
    assert.match(headers, /if-match/);
    assert.match(allowed.headers.get('access-control-expose-headers') ?? '', /ETag/i);

    const denied = await fetch(`${base}/api/v1/auth/me`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://untrusted.invalid', 'Access-Control-Request-Method': 'GET' },
    });
    assert.ok([200, 204].includes(denied.status));
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });
});
