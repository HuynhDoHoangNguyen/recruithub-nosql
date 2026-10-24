import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesColumnIncreasing, ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { isPublicJobsMockMode, listPublicJobs } from '../../services/publicJobsApi';

const PAGE_SIZE = 12;

function setOrDelete(params, key, value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized) params.set(key, normalized);
  else params.delete(key);
}

function JobCard({ job }) {
  const skills = job.requiredSkills || [];
  return (
    <Link to={`/jobs/${encodeURIComponent(job.id)}`} className="group flex gap-3 rounded-[14px] border border-[#DFE5EF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition hover:border-[#CBD5E1] hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-[3px] focus:ring-[#2454D6]/15 sm:gap-3.5 sm:p-5">
      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#F1F5F9] text-[#64748B] sm:flex">
        <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-[#152348] group-hover:text-[#2454D6] sm:text-base">{job.title}</h2>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-[#059669]">Đang tuyển</span>
        </div>
        {(job.company?.name || job.company_name) && <p className="mt-1 text-[13px] text-[#64748B]">{job.company?.name || job.company_name}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#475569]">
          {job.industry && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />{job.industry}</span>}
          {job.seniority && <span className="inline-flex items-center gap-1.5"><ChartNoAxesColumnIncreasing className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />{job.seniority}</span>}
          {job.deadline && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />Hạn nộp {new Date(job.deadline).toLocaleDateString('vi-VN')}</span>}
        </div>
        {job.description && <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#475569]">{job.description}</p>}
        {!!skills.length && <div className="mt-3 flex flex-wrap gap-1.5">{skills.slice(0, 4).map(skill => <span key={skill} className="rounded-md bg-[#F1F5F9] px-2 py-1 text-[11px] font-medium text-[#334155]">{skill}</span>)}{skills.length > 4 && <span className="rounded-md bg-[#F1F5F9] px-2 py-1 text-[11px] font-medium text-[#64748B]">+{skills.length - 4}</span>}</div>}
      </div>
    </Link>
  );
}

function LoadingCards() {
  return <div role="status" aria-live="polite" aria-label="Đang tải tin tuyển dụng" className="space-y-4">{[1, 2, 3].map(item => <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"><div className="h-5 w-2/5 rounded bg-slate-200" /><div className="mt-4 h-4 w-1/3 rounded bg-slate-100" /><div className="mt-5 h-4 w-full rounded bg-slate-100" /><div className="mt-2 h-4 w-4/5 rounded bg-slate-100" /></div>)}</div>;
}

export default function JobList() {
  const [params, setParams] = useSearchParams();
  const queryString = params.toString();
  const [searchDraft, setSearchDraft] = useState(params.get('q') || '');
  const [skillsDraft, setSkillsDraft] = useState(params.get('skills') || '');
  const [industryDraft, setIndustryDraft] = useState(params.get('industry') || '');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [pagination, setPagination] = useState({ query: '', cursors: [undefined] });
  const [result, setResult] = useState({ jobs: [], total: null, nextPage: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);
  const filterState = useMemo(() => {
    const current = new URLSearchParams(queryString);
    return { search: current.get('q') || '', skills: current.get('skills') || '', industry: current.get('industry') || '', seniority: current.get('seniority') || '' };
  }, [queryString]);
  const pageCursors = pagination.query === queryString ? pagination.cursors : [undefined];
  const pageIndex = pageCursors.length - 1;
  const bookmark = pageCursors[pageIndex];

  useEffect(() => {
    const current = new URLSearchParams(queryString);
    setSearchDraft(current.get('q') || '');
    setSkillsDraft(current.get('skills') || '');
    setIndustryDraft(current.get('industry') || '');
  }, [queryString]);

  const commitTextFilters = useCallback(() => {
    setParams(current => {
      const next = new URLSearchParams(current);
      setOrDelete(next, 'q', searchDraft);
      setOrDelete(next, 'skills', skillsDraft);
      setOrDelete(next, 'industry', industryDraft);
      next.delete('bookmark');
      return next;
    }, { replace: true });
  }, [industryDraft, searchDraft, setParams, skillsDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new URLSearchParams(queryString);
      if ((current.get('q') || '') !== searchDraft.trim()
        || (current.get('skills') || '') !== skillsDraft.trim()
        || (current.get('industry') || '') !== industryDraft.trim()) commitTextFilters();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [commitTextFilters, industryDraft, queryString, searchDraft, skillsDraft]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listPublicJobs({ ...filterState, page: pageIndex + 1, pageSize: PAGE_SIZE, bookmark, signal: controller.signal })
      .then(data => { if (sequence === requestSequence.current) setResult(data); })
      .catch(requestError => {
        if (sequence === requestSequence.current && requestError.name !== 'CanceledError' && requestError.name !== 'AbortError') setError(requestError.message || 'Không tải được danh sách việc làm.');
      })
      .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
    return () => controller.abort();
  }, [bookmark, filterState, pageIndex, retry]);

  const updateFilter = (key, value) => {
    setParams(current => {
      const next = new URLSearchParams(current);
      setOrDelete(next, key, value);
      next.delete('bookmark');
      return next;
    });
  };

  const resetFilters = () => {
    setSearchDraft(''); setSkillsDraft(''); setIndustryDraft('');
    setParams({}, { replace: true });
  };

  const hasActiveFilters = Boolean(filterState.search || filterState.skills || filterState.industry || filterState.seniority);
  const hasNext = Boolean(result.nextPage);

  return (
    <main className="min-h-screen bg-[#F5F7FB] px-4 py-7 sm:px-6 lg:py-10">
      <div className="mx-auto w-full max-w-[1200px]">
        {isPublicJobsMockMode && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Đang xem dữ liệu minh họa. Đây không phải tin tuyển dụng thật.</div>}
        <header className="mb-6">
          <p className="text-sm font-semibold text-blue-700">Cơ hội nghề nghiệp</p>
          <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#152348] sm:text-[32px]">Tìm công việc phù hợp</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Khám phá các vị trí đang tuyển và thu hẹp kết quả theo kỹ năng, ngành nghề hoặc cấp độ.</p>
        </header>

        <form onSubmit={event => { event.preventDefault(); commitTextFilters(); }} className="mb-4 flex gap-2 rounded-[14px] border border-[#DFE5EF] bg-white p-2 shadow-sm lg:hidden">
          <label className="sr-only" htmlFor="job-search-mobile">Tìm theo vị trí, mô tả hoặc kỹ năng</label>
          <Search className="ml-2 mt-3 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          <input id="job-search-mobile" type="search" autoComplete="off" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Vị trí, mô tả hoặc kỹ năng" className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0" />
          <button type="submit" aria-label="Tìm việc" className="inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] bg-[#2454D6] px-3 text-sm font-semibold text-white transition hover:bg-[#1D46BA] focus:outline-none focus:ring-4 focus:ring-blue-100"><Search className="h-4 w-4" aria-hidden="true" /></button>
        </form>

        <div className="mb-4 flex items-center justify-between lg:hidden">
          <p className="text-sm font-medium text-slate-700">Bộ lọc tìm kiếm</p>
          <button type="button" onClick={() => setMobileFiltersOpen(open => !open)} aria-expanded={mobileFiltersOpen} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#CBD5E1] bg-white px-3 text-sm font-semibold text-[#334155] shadow-sm"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{mobileFiltersOpen ? 'Ẩn bộ lọc' : 'Mở bộ lọc'}</button>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
          <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:block`} aria-label="Bộ lọc việc làm">
            <div className="rounded-[14px] border border-[#DFE5EF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.035)] sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="font-semibold text-slate-900">Tìm việc</h2>
                <button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Xóa lọc</button>
              </div>
              <div className="space-y-5 pt-4">
                <form onSubmit={event => { event.preventDefault(); commitTextFilters(); }}>
                  <label htmlFor="job-search" className="mb-1.5 block text-sm font-medium text-slate-700">Từ khóa</label>
                  <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[#CBD5E1] bg-white px-3 transition focus-within:border-[#2454D6] focus-within:ring-[3px] focus-within:ring-[#2454D6]/15">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <input id="job-search" type="search" autoComplete="off" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Vị trí, mô tả, kỹ năng" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0" />
                  </div>
                  <button type="submit" className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#2454D6] px-4 text-sm font-semibold text-white transition hover:bg-[#1D46BA] focus:outline-none focus:ring-4 focus:ring-blue-100"><Search className="h-4 w-4" aria-hidden="true" />Tìm việc</button>
                </form>
                <div>
                  <label htmlFor="job-skills-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Kỹ năng</label>
                  <input id="job-skills-filter" value={skillsDraft} onChange={event => setSkillsDraft(event.target.value)} placeholder="Ví dụ: React, SQL" className="h-10 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] placeholder:text-slate-400 focus:border-[#2454D6] focus:outline-none focus:ring-[3px] focus:ring-[#2454D6]/15" />
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">Nhập nhiều kỹ năng, cách nhau bằng dấu phẩy.</p>
                </div>
                <div>
                  <label htmlFor="job-industry-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Ngành nghề</label>
                  <input id="job-industry-filter" value={industryDraft} onChange={event => setIndustryDraft(event.target.value)} placeholder="Nhập đúng ngành nghề" className="h-10 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] placeholder:text-slate-400 focus:border-[#2454D6] focus:outline-none focus:ring-[3px] focus:ring-[#2454D6]/15" />
                </div>
                <div>
                  <label htmlFor="job-seniority-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Cấp độ</label>
                  <select id="job-seniority-filter" value={filterState.seniority} onChange={event => updateFilter('seniority', event.target.value)} className="h-10 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] focus:border-[#2454D6] focus:outline-none focus:ring-[3px] focus:ring-[#2454D6]/15">
                    <option value="">Tất cả cấp độ</option><option value="JUNIOR">Junior</option><option value="MID">Mid</option><option value="SENIOR">Senior</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <section aria-label="Kết quả việc làm" className="min-w-0 rounded-[14px] border border-[#DFE5EF] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.035)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2F7] pb-4">
              <div>
                <h2 className="text-base font-semibold text-[#152348] sm:text-lg">Việc làm đang mở</h2>
                <p aria-live="polite" className="mt-0.5 text-sm text-[#64748B]">{loading ? 'Đang cập nhật kết quả…' : `${result.jobs.length} kết quả trên trang này`}</p>
              </div>
              {hasActiveFilters && <button type="button" onClick={resetFilters} className="text-sm font-medium text-[#2454D6] hover:text-[#1D46BA]">Xóa tất cả bộ lọc</button>}
            </div>
            {loading ? <LoadingCards /> : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center"><p role="alert" className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-4 rounded-[10px] bg-[#2454D6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D46BA]">Thử tải lại</button></div>
            ) : result.jobs.length === 0 ? (
              <div className="px-4 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]"><Search className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-4 font-semibold text-[#152348]">Chưa tìm thấy việc làm phù hợp</h3><p className="mt-1 text-sm text-[#64748B]">Thử đổi từ khóa hoặc bỏ bớt một vài bộ lọc.</p>{hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[#CBD5E1] px-4 py-2 text-sm font-semibold text-[#334155] hover:bg-slate-50"><X className="h-4 w-4" aria-hidden="true" />Xóa bộ lọc</button>}</div>
            ) : (
              <>
                <div className="space-y-3">{result.jobs.map(job => <JobCard key={job.id} job={job} />)}</div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F7] pt-4">
                  <p className="text-xs text-[#64748B]">Hiển thị {result.jobs.length} kết quả trên trang {pageIndex + 1}</p>
                  <nav aria-label="Phân trang việc làm" className="flex items-center gap-2">
                    <button type="button" disabled={pageIndex === 0 || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: (current.query === queryString ? current.cursors : [undefined]).slice(0, -1) }))} className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-[#DFE5EF] px-3 text-sm font-medium text-[#334155] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"><ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Trước</span></button>
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[9px] bg-[#2454D6] px-2 text-sm font-semibold text-white" aria-current="page">{pageIndex + 1}</span>
                    <button type="button" disabled={!hasNext || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: [...(current.query === queryString ? current.cursors : [undefined]), result.nextPage] }))} className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-[#DFE5EF] px-3 text-sm font-medium text-[#2454D6] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300"><span className="hidden sm:inline">Tiếp</span><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                  </nav>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
