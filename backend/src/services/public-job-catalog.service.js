import { createHash } from 'node:crypto';
import { ApiError } from '../middleware/job-application.middleware.js';

const filterKey = query => createHash('sha256').update(JSON.stringify({ q: query.q || '', industry: query.industry || '',
  seniority: query.seniority || '', skills: query.skills || [], location: query.location || '', work_mode: query.work_mode || '' })).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

// Live jobs are actionable; historical jobs remain browsable without copying
// candidates/accounts or historical applications into the writable database.
export class PublicJobCatalogService {
  constructor({ live, dataset }) { this.live = live; this.dataset = dataset; }
  async publicList(query) {
    const key = filterKey(query);
    let source = this.live ? 'live' : 'dataset';
    let bookmark;
    if (query.bookmark) {
      try {
        const cursor = JSON.parse(Buffer.from(query.bookmark, 'base64url').toString('utf8'));
        if (cursor.version !== 1 || cursor.kind !== 'catalog' || cursor.filterKey !== key
          || !['live', 'dataset'].includes(cursor.source) || (cursor.source === 'live' && !this.live)
          || (cursor.bookmark !== undefined && typeof cursor.bookmark !== 'string')) throw new Error();
        source = cursor.source; bookmark = cursor.bookmark;
      } catch { throw new ApiError(400, 'INVALID_BOOKMARK', 'Con trỏ trang không hợp lệ hoặc không khớp bộ lọc.'); }
    }
    const items = [];
    const next = (source, bookmark) => ({ items, has_more: true,
      bookmark: encode({ version: 1, kind: 'catalog', source, bookmark, filterKey: key }) });
    while (true) {
      const service = source === 'live' ? this.live : this.dataset;
      const page = await service.publicList({ ...query, limit: query.limit - items.length, bookmark });
      items.push(...page.items.map(job => ({ ...job, catalog_source: source, application_available: source === 'live' })));
      if (page.has_more) return next(source, page.bookmark);
      if (source === 'dataset') return { items, has_more: false };
      source = 'dataset'; bookmark = undefined;
      if (items.length === query.limit) {
        const probe = await this.dataset.publicList({ ...query, limit: 1, bookmark: undefined });
        return probe.items.length ? next('dataset', undefined) : { items, has_more: false };
      }
    }
  }
  async metadata() {
    const sources = await Promise.all([this.dataset.metadata(), ...(this.live ? [this.live.metadata()] : [])]);
    return { ...sources[0], skills: [...new Set(sources.flatMap(source => source.skills))].sort(),
      industries: [...new Set(sources.flatMap(source => source.industries))].sort() };
  }
  async publicDetail(id) {
    if (this.live) {
      try { return { ...await this.live.publicDetail(id), catalog_source: 'live', application_available: true }; }
      catch (error) { if (error.status !== 404) throw error; }
    }
    return { ...await this.dataset.publicDetail(id), catalog_source: 'dataset', application_available: false };
  }
}
