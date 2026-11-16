import { ApiError } from '../middleware/job-application.middleware.js';
import { jobDocumentSchema } from '../schemas/job.schema.js';
import { matchesPublicFilters } from './job.service.js';
import { normalizeSkill } from '../utils/normalization.utils.js';
import { JOB_LOCATIONS, WORK_MODES, SENIORITIES } from '../constants/job-catalog.constants.js';

const unavailable = () => new ApiError(503, 'CHAT_SEARCH_UNAVAILABLE', 'Chưa thể đọc việc làm. Bạn hãy thử lại hoặc mở trang Việc làm.');
const unsupportedLabels = { salary: 'mức lương', experience_years: 'số năm kinh nghiệm', company: 'công ty cụ thể', other: 'tiêu chí ngoài bộ lọc hiện có' };
export function supportSearchUrl(filters) {
  const params = new URLSearchParams();
  for (const name of ['q', 'location', 'work_mode', 'seniority']) if (filters[name]) params.set(name, filters[name]);
  if (filters.skills.length) params.set('skills', filters.skills.join(','));
  return `/jobs${params.size ? `?${params}` : ''}`;
}

// Only scan/get capabilities are supplied. The AI never receives documents or a repository.
export class SupportJobSearchService {
  constructor(reader, { now = () => new Date(), maxPages = 30, budgetMs = 4000 } = {}) {
    this.reader = reader; this.now = now; this.maxPages = maxPages; this.budgetMs = budgetMs;
  }
  async search(intent, { signal } = {}) {
    const filters = { ...intent.filters, skills: [...new Set(intent.filters.skills.map(skill => normalizeSkill(skill)))].sort() };
    const filterLabels = [filters.q, ...filters.skills,
      JOB_LOCATIONS.find(item => item.value === filters.location)?.label,
      WORK_MODES.find(item => item.value === filters.work_mode)?.label,
      SENIORITIES.find(item => item.value === filters.seniority)?.label].filter(Boolean);
    const base = { mode: 'jobs', provider: 'gemini', filters, filter_labels: filterLabels, search_url: supportSearchUrl(filters), jobs: [],
      checked_at: this.now().toISOString(), searched: false, partial: false, has_more: false };
    if (intent.unsupported.length) return { ...base, unsupported: intent.unsupported,
      reply: `Chưa hỗ trợ lọc tự động theo ${intent.unsupported.map(key => unsupportedLabels[key]).join(', ')}. Bạn hãy tìm theo chức danh, kỹ năng, địa điểm, hình thức làm việc hoặc cấp bậc.` };
    if (!this.reader) throw unavailable();
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const stopped = new Promise((resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(unavailable()), { once: true });
      if (controller.signal.aborted) reject(unavailable());
    });
    const timer = setTimeout(abort, this.budgetMs);
    try { return await Promise.race([this.collect(filters, base, controller.signal), stopped]); }
    catch { throw unavailable(); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async collect(filters, base, signal) {
    let afterId, exhausted = false;
    const matches = [], seen = new Set();
    const query = { ...filters, industry: '' };
    for (let page = 0; page < this.maxPages && matches.length < 6; page++) {
      if (signal.aborted) throw unavailable();
      const batch = await this.reader.scanPublicJobs({ afterId, limit: 100 });
      if (signal.aborted) throw unavailable();
      if (!Array.isArray(batch) || batch.length > 100) throw unavailable();
      if (!batch.length) { exhausted = true; break; }
      let advanced = false;
      for (const raw of batch) {
        if (typeof raw?._id !== 'string' || (afterId && raw._id <= afterId) || seen.has(raw._id)) throw unavailable();
        afterId = raw._id; advanced = true; seen.add(raw._id);
        const parsed = jobDocumentSchema.safeParse(raw);
        if (!parsed.success) continue;
        const job = parsed.data;
        if (!/^job:[a-z0-9:_-]+$/i.test(job._id) || !matchesPublicFilters(job, query)
          || !job.deadline || Date.parse(job.deadline) <= this.now().getTime()) continue;
        matches.push(job);
        if (matches.length === 6) break;
      }
      if (!advanced) throw unavailable();
      if (batch.length < 100) { exhausted = matches.length < 6; break; }
    }
    const partial = !exhausted && matches.length < 6;
    const companies = new Map(), jobs = [];
    for (const job of matches.slice(0, 5)) {
      if (signal.aborted) throw unavailable();
      if (!companies.has(job.company_id)) companies.set(job.company_id, await this.reader.get(job.company_id));
      if (signal.aborted) throw unavailable();
      const company = companies.get(job.company_id);
      jobs.push({ id: job._id, title: job.title,
        company_name: company?.type === 'company' && typeof company.name === 'string' ? company.name.slice(0, 300) : 'Chưa cập nhật công ty',
        location_label: JOB_LOCATIONS.find(item => item.value === job.location)?.label || 'Chưa cập nhật địa điểm',
        work_mode_label: WORK_MODES.find(item => item.value === job.work_mode)?.label || 'Chưa cập nhật hình thức',
        seniority: job.seniority, required_skills: job.required_skills.slice(0, 8), deadline: job.deadline });
    }
    const reply = jobs.length
      ? `Dưới đây là ${jobs.length} tin phù hợp với bộ lọc đã hiểu, đang mở và còn hạn tại thời điểm tra cứu. Đây là kết quả lọc, chưa phải xếp hạng mức phù hợp CV.`
      : partial ? 'Chưa tìm thấy tin phù hợp trong phạm vi đã kiểm tra. Bạn có thể mở trang Việc làm hoặc đổi bộ lọc.'
        : 'Chưa có tin đang mở và còn hạn khớp bộ lọc này. Bạn có thể bỏ bớt kỹ năng hoặc đổi địa điểm.';
    return { ...base, reply, jobs, searched: true, partial, has_more: matches.length > 5 };
  }
}
