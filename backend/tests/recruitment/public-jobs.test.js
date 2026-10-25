import test from 'node:test';
import assert from 'node:assert/strict';
import { startFixture } from './fixtures.js';

test('public list includes historical and new OPEN jobs without exposing DRAFT/CLOSED', async t => {
  const f = await startFixture(t);
  for (const [id, doc] of f.repo.docs) if (doc.type === 'job') f.repo.docs.delete(id);
  const jobs = [
    ['job:historic', 'OPEN', false], ['job:modern', 'OPEN', true],
    ['job:draft', 'DRAFT', false], ['job:closed', 'CLOSED', true],
  ];
  for (const [id, status, published] of jobs) {
    const doc = { ...structuredClone(f.job), _id: id, _rev: '1-fixture', status };
    if (!published) delete doc.published_at;
    f.repo.docs.set(id, doc);
  }
  const response = await f.request('GET', '/jobs', undefined, null);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.items.map(j => j._id).sort(), ['job:historic', 'job:modern']);
  assert.equal((await f.request('GET', '/jobs/job:draft', undefined, null)).status, 404);
  const closed = await f.request('GET', '/jobs/job:closed', undefined, null);
  assert.equal(closed.status, 200);
  assert.equal(closed.body.data.status, 'CLOSED');
});

test('public pagination uses required created_at with unique id tie-breaker', async t => {
  const f = await startFixture(t);
  for (const [id, doc] of f.repo.docs) if (doc.type === 'job') f.repo.docs.delete(id);
  for (let n = 1; n <= 5; n++) {
    const doc = { ...structuredClone(f.job), _id: `job:tie-${n}`, _rev: '1-fixture' };
    delete doc.published_at;
    f.repo.docs.set(doc._id, doc);
  }
  const ids = [];
  let bookmark;
  for (let page = 0; page < 7; page++) {
    const response = await f.request('GET', `/jobs?limit=2${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ''}`, undefined, null);
    assert.equal(response.status, 200);
    ids.push(...response.body.data.items.map(j => j._id));
    if (!response.body.data.has_more) break;
    bookmark = response.body.data.bookmark;
  }
  assert.deepEqual(ids, ['job:tie-5', 'job:tie-4', 'job:tie-3', 'job:tie-2', 'job:tie-1']);
  assert.equal(new Set(ids).size, 5);
});
