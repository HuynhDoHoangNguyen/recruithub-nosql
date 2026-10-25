import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicJobCatalogService } from '../../src/services/public-job-catalog.service.js';
import { ApiError } from '../../src/middleware/job-application.middleware.js';
const service = ids => ({
  async publicList({ limit, bookmark }) { const start = Number(bookmark || 0); return { items: ids.slice(start, start + limit).map(_id => ({ _id })),
    has_more: start + limit < ids.length, bookmark: String(start + limit) }; },
  async publicDetail(id) { if (!ids.includes(id)) throw new ApiError(404, 'NOT_FOUND', 'Missing'); return { _id: id }; },
});
const query = { limit: 2, q: '', industry: '', skills: [] };
test('catalog fills pages across live and historical sources without skips or duplicates', async () => {
  for (const liveIds of [[], ['live:1'], ['live:1', 'live:2'], ['live:1', 'live:2', 'live:3']]) {
    const catalog = new PublicJobCatalogService({ live: service(liveIds), dataset: service(['old:1', 'old:2', 'old:3']) });
    const items = []; let bookmark;
    for (let n = 0; n < 8; n++) { const page = await catalog.publicList({ ...query, bookmark }); items.push(...page.items);
      assert.ok(page.items.length <= 2); if (!page.has_more) break; bookmark = page.bookmark; }
    assert.deepEqual(items.map(job => job._id), [...liveIds, 'old:1', 'old:2', 'old:3']);
    assert.ok(items.every(job => job.application_available === job._id.startsWith('live:')));
  }
});
test('catalog final full page has no false next page and works before Auth setup', async () => {
  const empty = service([]);
  assert.equal((await new PublicJobCatalogService({ live: service(['a', 'b']), dataset: empty }).publicList(query)).has_more, false);
  const catalog = new PublicJobCatalogService({ live: null, dataset: service(['a', 'b']) });
  const page = await catalog.publicList(query); assert.equal(page.items.length, 2); assert.equal(page.has_more, false);
  assert.ok(page.items.every(job => job.application_available === false));
});
test('catalog rejects malformed and filter-mismatched cursors', async () => {
  const catalog = new PublicJobCatalogService({ live: service(['a', 'b', 'c']), dataset: service([]) });
  const page = await catalog.publicList(query);
  for (const input of [{ ...query, bookmark: 'bad' }, { ...query, bookmark: page.bookmark, q: 'changed' }]) {
    await assert.rejects(() => catalog.publicList(input), error => error.status === 400 && error.code === 'INVALID_BOOKMARK');
  }
});
test('detail resolves actionable jobs from live storage and labels historical detail read-only', async () => {
  const catalog = new PublicJobCatalogService({ live: service(['live']), dataset: service(['old']) });
  assert.equal((await catalog.publicDetail('live')).application_available, true);
  assert.equal((await catalog.publicDetail('old')).application_available, false);
  await assert.rejects(() => catalog.publicDetail('missing'), error => error.status === 404);
  const unavailable = new PublicJobCatalogService({ live: { async publicDetail() { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Unavailable'); } }, dataset: service(['old']) });
  await assert.rejects(() => unavailable.publicDetail('old'), error => error.status === 503);
});
