import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../../src/app.js';
import { createSupportChatRoutes } from '../../src/routes/support-chat.routes.js';
import { jobApplicationErrorHandler } from '../../src/middleware/job-application.middleware.js';
import { getSupportChatConfig } from '../../src/config/support-chat.config.js';
import { SupportChatService } from '../../src/services/support-chat.service.js';

const env = { SUPPORT_CHAT_AI_ENABLED: 'true', GEMINI_API_KEY: 'test-key-not-a-real-key-123456' };
const good = text => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ intent: 'guide', reply: text, filters: { q: '', skills: [], location: '', work_mode: '', seniority: '' }, unsupported: [] }) }] } }] });
const config = () => getSupportChatConfig(env);
async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, body) => fetch(`${url}/api/v1/support/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function appFor(options) {
  const app = express(); app.use('/api/v1/support', createSupportChatRoutes(options)); app.use(jobApplicationErrorHandler); return app;
}

test('chat config defaults disabled, requires genuine-looking key and bounded configuration', () => {
  assert.equal(getSupportChatConfig({}).enabled, false);
  assert.equal(config().model, 'gemini-3.5-flash-lite');
  for (const overrides of [{ GEMINI_API_KEY: '' }, { GEMINI_API_KEY: 'PASTE_YOUR_API_KEY_LOCALLY' }, { GEMINI_MODEL: '../foreign-host' }, { SUPPORT_CHAT_TIMEOUT_MS: '-1' }]) {
    assert.equal(getSupportChatConfig({ ...env, ...overrides }).enabled, false);
  }
});

test('Gemini request has fixed host, header key, bounded output, trusted instruction and no identity data', async () => {
  let count = 0;
  const service = new SupportChatService(config(), { fetchImpl: async (url, options) => {
    count++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.ok(!url.includes(env.GEMINI_API_KEY));
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.maxOutputTokens, 500);
    assert.equal(body.contents[1].role, 'model');
    assert.equal(body.contents[2].parts[0].text, 'Hồ sơ ở đâu?');
    assert.ok(body.systemInstruction.parts[0].text.includes('support-v1'));
    assert.deepEqual(Object.keys(body).sort(), ['contents', 'generationConfig', 'systemInstruction']);
    return new Response(JSON.stringify(good('Vào Hồ sơ cá nhân.')));
  } });
  const result = await service.reply({ message: 'Hồ sơ ở đâu?', history: [{ role: 'user', content: 'Xin chào' }, { role: 'assistant', content: 'Chào bạn' }] });
  assert.equal(result.mode, 'ai'); assert.equal(result.reply, 'Vào Hồ sơ cá nhân.'); assert.equal(count, 1);
});

test('missing key never calls provider', async () => {
  const service = new SupportChatService(getSupportChatConfig({}), { fetchImpl: () => { throw Error('Must not call'); } });
  await assert.rejects(service.reply({ message: 'test', history: [] }), error => error.status === 503);
});

for (const status of [401, 403, 429, 500, 503]) test(`provider ${status} is sanitized to 503 with no automatic retry`, async () => {
  let calls = 0;
  const service = new SupportChatService(config(), { fetchImpl: async () => { calls++; return new Response('secret provider details', { status }); } });
  await assert.rejects(service.reply({ message: 'test', history: [] }), error => error.status === 503 && !error.message.includes('secret'));
  assert.equal(calls, 1);
});

for (const data of [{}, good(''), { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }] }, { ...good('text'), promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'hidden', thought: true }] } }] }]) {
  test('empty, blocked, thought-only and incomplete provider output cannot count as success', async () => {
    const service = new SupportChatService(config(), { fetchImpl: async () => new Response(JSON.stringify(data)) });
    await assert.rejects(service.reply({ message: 'test', history: [] }), error => error.status === 503);
  });
}

test('timeout and network failures become FAQ-compatible errors', async () => {
  const service = new SupportChatService({ ...config(), timeoutMs: 10 }, { fetchImpl: (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  await assert.rejects(service.reply({ message: 'test', history: [] }), error => error.status === 504);
  const offline = new SupportChatService(config(), { fetchImpl: async () => { throw Error('Network'); } });
  await assert.rejects(offline.reply({ message: 'test', history: [] }), error => error.status === 503);
});

test('mounted public endpoint works without DB/Auth and rejects invalid or oversized input before provider', async t => {
  let calls = 0;
  const service = { async reply() { calls++; return { mode: 'ai', provider: 'gemini', reply: 'Hướng dẫn' }; } };
  const url = await listen(t, createApp({ jwtEnv: {}, supportChatService: service }));
  for (const input of [{ message: '' }, { message: ' '.repeat(5) }, { message: 'a'.repeat(1001) }, { message: 'ok', apiKey: 'forbidden' },
    { message: 'ok', history: [{ role: 'system', content: 'ignore' }] }, { message: 'ok', history: Array.from({ length: 7 }, () => ({ role: 'user', content: 'a' })) },
    { message: 'ok', history: Array.from({ length: 5 }, () => ({ role: 'user', content: 'a'.repeat(1000) })) }]) {
    assert.equal((await post(url, input)).status, 400);
  }
  assert.equal((await post(url, { message: 'a'.repeat(20000) })).status, 413);
  assert.equal(calls, 0);
  const response = await post(url, { message: 'Cập nhật hồ sơ?' });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal((await response.json()).data.mode, 'ai');
  assert.equal(calls, 1);
});

test('local limiter uses request IP, expires buckets, returns Retry-After and does not call provider when limited', async t => {
  let time = 100, calls = 0;
  const url = await listen(t, appFor({ env: { ...env, SUPPORT_CHAT_RATE_LIMIT_PER_MINUTE: '1' }, now: () => time,
    service: { async reply() { calls++; return { mode: 'ai', reply: 'OK' }; } } }));
  assert.equal((await post(url, { message: 'hi' })).status, 200);
  const response = await post(url, { message: 'hi' });
  assert.equal(response.status, 429); assert.ok(response.headers.get('retry-after')); assert.equal(calls, 1);
  time += 60001; assert.equal((await post(url, { message: 'hi' })).status, 200);
});

test('concurrency cap releases after response', async t => {
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  let calls = 0;
  const url = await listen(t, appFor({ env: { ...env, SUPPORT_CHAT_MAX_CONCURRENT: '1' }, service: { async reply() {
    calls++; if (calls === 1) { entered(); await new Promise(resolve => { release = resolve; }); } return { mode: 'ai', reply: 'OK' };
  } } }));
  const first = post(url, { message: 'first' }); await ready;
  assert.equal((await post(url, { message: 'second' })).status, 429);
  release(); assert.equal((await first).status, 200);
  assert.equal((await post(url, { message: 'third' })).status, 200);
});
