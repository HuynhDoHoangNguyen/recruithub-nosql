import test from 'node:test';
import assert from 'node:assert/strict';
import { SupportJobSearchService } from '../../src/services/support-job-search.service.js';
import { SupportChatService } from '../../src/services/support-chat.service.js';
import { getSupportChatConfig } from '../../src/config/support-chat.config.js';
import { supportChatIntentSchema } from '../../src/schemas/support-chat-intent.schema.js';
import { createFixture } from './fixtures.js';
import express from 'express';
import { createApp } from '../../src/app.js';

const now = () => new Date('2026-11-16T06:00:00Z');
const filters = { q: '', skills: [], location: '', work_mode: '', seniority: '' };
const intent = (extra = {}) => ({ intent: 'search_jobs', reply: '', filters: { ...filters, ...extra }, unsupported: [] });
function job(id, changes = {}) {
  return { ...structuredClone(createFixture().job), _id: `job:${id}`, title: `Backend ${id}`, location: 'VN-HN', work_mode: 'HYBRID', seniority: 'JUNIOR',
    required_skills: ['JavaScript', 'CouchDB'], optional_skills: ['Docker'], deadline: '2026-12-30T00:00:00Z', ...changes };
}
function reader(jobs) {
  const calls = [];
  return { calls,
    async scanPublicJobs({ afterId, limit }) { calls.push(['scan', afterId, limit]); return jobs.filter(item => !afterId || item._id > afterId).slice(0, limit); },
    async get(id) { calls.push(['get', id]); return { _id: id, type: 'company', name: 'Công ty có thật trong fixture', private_field: 'must not leak' }; },
  };
}

test('search combines exact filters and normalized skills, excludes closed/draft/deleted/expired/malformed jobs', async () => {
  const data = [job('01'), job('02', { status: 'CLOSED' }), job('03', { status: 'DRAFT' }), job('04', { deleted_at: '2026-11-15T00:00:00Z' }),
    job('05', { deadline: now().toISOString() }), job('06', { location: 'VN-SG' }), job('07', { work_mode: 'REMOTE' }), job('08', { seniority: 'SENIOR' }),
    job('09', { required_skills: ['Python'], optional_skills: [] }), job('10', { title: 123 }), job('11', { deadline: undefined })];
  const source = reader(data);
  const search = new SupportJobSearchService(source, { now });
  const result = await search.search(intent({ skills: ['JS', 'couchdb'], location: 'VN-HN', work_mode: 'HYBRID', seniority: 'JUNIOR' }));
  assert.deepEqual(result.jobs.map(item => item.id), ['job:01']);
  assert.deepEqual(result.filters.skills, ['couchdb', 'javascript']);
  assert.equal(result.jobs[0].company_name, 'Công ty có thật trong fixture');
  assert.equal(result.searched, true); assert.equal(result.partial, false);
  assert.ok(!JSON.stringify(result).includes('private_field'));
  assert.ok(!JSON.stringify(result).includes('recruiter_id'));
  assert.equal(result.search_url, '/jobs?location=VN-HN&work_mode=HYBRID&seniority=JUNIOR&skills=couchdb%2Cjavascript');
});

test('skill matching is AND; query punctuation is literal rather than a regex or Mango operator', async () => {
  const search = new SupportJobSearchService(reader([job('01', { title: 'C++ [backend]' }), job('02')]), { now });
  assert.equal((await search.search(intent({ q: '[backend]' }))).jobs.length, 1);
  assert.equal((await search.search(intent({ skills: ['javascript', 'python'] }))).jobs.length, 0);
  assert.equal((await search.search(intent({ q: '.*' }))).jobs.length, 0);
});

test('five cards and has_more are bounded, and companies are fetched once', async () => {
  const source = reader(Array.from({ length: 9 }, (_, i) => job(String(i).padStart(2, '0'))));
  const result = await new SupportJobSearchService(source, { now }).search(intent());
  assert.equal(result.jobs.length, 5); assert.equal(result.has_more, true);
  assert.equal(source.calls.filter(call => call[0] === 'get').length, 1);
});

test('search advances pages beyond the first 100 jobs', async () => {
  const data = Array.from({ length: 102 }, (_, i) => job(String(i).padStart(3, '0'), { title: i === 101 ? 'Target' : 'Other' }));
  const source = reader(data);
  const result = await new SupportJobSearchService(source, { now }).search(intent({ q: 'Target' }));
  assert.deepEqual(result.jobs.map(item => item.id), ['job:101']);
  assert.equal(source.calls.filter(call => call[0] === 'scan').length, 2);
});

test('scan cap produces partial, not a false global zero', async () => {
  const data = Array.from({ length: 101 }, (_, i) => job(String(i).padStart(3, '0')));
  const result = await new SupportJobSearchService(reader(data), { now, maxPages: 1 }).search(intent({ q: 'not found' }));
  assert.equal(result.partial, true); assert.match(result.reply, /phạm vi đã kiểm tra/);
});

test('unsupported criteria are explicit and never silently dropped or queried', async () => {
  const source = reader([job('01')]);
  const result = await new SupportJobSearchService(source, { now }).search({ ...intent(), unsupported: ['salary'] });
  assert.equal(result.searched, false); assert.equal(result.jobs.length, 0); assert.match(result.reply, /mức lương/);
  assert.equal(source.calls.length, 0);
});

test('DB failures, stalled cursors, abort and read timeout cannot masquerade as no matching jobs', async () => {
  for (const source of [null, { async scanPublicJobs() { throw Error('database password'); } },
    { async scanPublicJobs() { return Array.from({ length: 100 }, () => job('same')); } }]) {
    await assert.rejects(new SupportJobSearchService(source, { now }).search(intent()), error => error.code === 'CHAT_SEARCH_UNAVAILABLE' && !error.message.includes('password'));
  }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new SupportJobSearchService(reader([]), { now }).search(intent(), { signal: controller.signal }), error => error.status === 503);
  const delayed = { scanPublicJobs: () => new Promise(resolve => setTimeout(() => resolve([]), 30)) };
  await assert.rejects(new SupportJobSearchService(delayed, { now, budgetMs: 5 }).search(intent()), error => error.status === 503);
});

test('Gemini intent is validated before search; fabricated result IDs/URLs and invalid filters are rejected', async () => {
  const config = getSupportChatConfig({ SUPPORT_CHAT_AI_ENABLED: 'true', GEMINI_API_KEY: 'test-key-not-a-real-key-123456' });
  let searches = 0;
  const jobSearch = { async search(value) { searches++; assert.equal(value.filters.location, 'VN-HN'); return { mode: 'jobs', reply: 'Trusted DB result', jobs: [] }; } };
  const serviceFor = data => new SupportChatService(config, { jobSearch, fetchImpl: async (url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(!JSON.stringify(body).includes('Công ty có thật'));
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data) }] } }] }));
  } });
  const valid = intent({ location: 'VN-HN' });
  assert.equal((await serviceFor(valid).reply({ message: 'Tìm việc ở Hà Nội', history: [] })).mode, 'jobs');
  assert.equal(searches, 1);
  for (const invalid of [{ ...valid, jobs: [{ id: 'made-up' }] }, { ...valid, filters: { ...filters, location: 'javascript:alert(1)' } },
    { ...valid, filters: { ...filters, selector: { type: 'user' } } }]) {
    await assert.rejects(serviceFor(invalid).reply({ message: 'test', history: [] }), error => error.status === 503);
  }
  assert.equal(searches, 1); assert.equal(supportChatIntentSchema.safeParse(valid).success, true);
});

test('HTTP chat → Gemini intent → real repository HTTP reads → detail link uses only CouchDB GET, without writes', async t => {
  async function listen(app) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return `http://127.0.0.1:${server.address().port}`;
  }
  const requests = [], fixture = createFixture(), document = job('actual-db-id');
  const couch = express();
  couch.use((req, res, next) => { requests.push([req.method, req.path]); next(); });
  couch.get('/recruithub_chat_test/_all_docs', (req, res) => res.json({ rows: [{ doc: document }] }));
  couch.get('/recruithub_chat_test/:id', (req, res) => {
    if (req.params.id === document._id) return res.json(document);
    if (req.params.id === document.company_id) return res.json(fixture.repo.docs.get(document.company_id));
    res.status(404).json({ error: 'not_found' });
  });
  const couchUrl = await listen(couch);
  const apiUrl = await listen(createApp({ now, jwtEnv: { SUPPORT_CHAT_AI_ENABLED: 'true', GEMINI_API_KEY: 'test-key-not-a-real-key-123456',
    COUCHDB_URL: couchUrl, COUCHDB_DATABASE: 'recruithub_chat_test', AUTH_COUCHDB_DATABASE: 'recruithub_chat_test' },
    supportChatFetch: async (url, request) => {
      assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
      assert.ok(!request.body.includes('actual-db-id'));
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(intent({ skills: ['JavaScript'], location: 'VN-HN' })) }] } }] }));
    },
  }));
  const response = await fetch(`${apiUrl}/api/v1/support/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Tìm việc JavaScript ở Hà Nội' }) });
  assert.equal(response.status, 200);
  const result = (await response.json()).data;
  assert.equal(result.jobs[0].id, document._id);
  const detail = await fetch(`${apiUrl}/api/v1/jobs/${encodeURIComponent(result.jobs[0].id)}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.title, result.jobs[0].title);
  assert.ok(requests.length >= 3);
  assert.ok(requests.every(([method, path]) => method === 'GET' && path.startsWith('/recruithub_chat_test/')));
});
