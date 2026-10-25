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
  const companyName = job.company?.name || job.company_name;
  const companyMark = companyName?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return (
    <Link to={`/jobs/${encodeURIComponent(job.id)}`} className="group flex gap-3 rounded-[16px] border border-[#E5F3F8] bg-[#F8FDFF] p-3.5 shadow-[0_2px_8px_rgba(15,75,105,0.035)] transition hover:border-[#8EDCF7] hover:bg-white hover:shadow-[0_8px_22px_rgba(15,75,105,0.08)] focus:outline-none focus:ring-[3px] focus:ring-[#11B7F3]/20 sm:gap-4 sm:p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#E4F7FE] text-[#079DD7] sm:h-[58px] sm:w-[58px]">
        {companyMark ? <span className="text-sm font-bold tracking-wide">{companyMark}</span> : <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0"><h2 className="text-[15px] font-bold tracking-tight text-[#17243B] group-hover:text-[#079DD7] sm:text-base">{job.title}</h2>
            {companyName && <p className="mt-1 text-[13px] font-medium text-[#62748A]">{companyName}</p>}</div>
          <div className="flex items-center gap-2"><span className="shrink-0 rounded-full bg-[#E1F9F1] px-2.5 py-1 text-[11px] font-semibold text-[#078B68]">Đang tuyển</span><span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-[#078FBF] group-hover:bg-[#E4F7FE] sm:flex"><ChevronRight className="h-4 w-4" aria-hidden="true" /></span></div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#65758A]">
          {job.industry && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-[#16A9D8]" aria-hidden="true" />{job.industry}</span>}
          {job.seniority && <span className="inline-flex items-center gap-1.5"><ChartNoAxesColumnIncreasing className="h-3.5 w-3.5 text-[#16A9D8]" aria-hidden="true" />{job.seniority}</span>}
          {job.deadline && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#16A9D8]" aria-hidden="true" />Hạn nộp {new Date(job.deadline).toLocaleDateString('vi-VN')}</span>}
        </div>
        {job.description && <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#62748A]">{job.description}</p>}
        {!!skills.length && <div className="mt-3 flex flex-wrap gap-1.5">{skills.slice(0, 4).map(skill => <span key={skill} className="rounded-full bg-[#E8F7FD] px-2.5 py-1 text-[11px] font-semibold text-[#078FBF]">{skill}</span>)}{skills.length > 4 && <span className="rounded-full bg-[#E8F7FD] px-2.5 py-1 text-[11px] font-medium text-[#62748A]">+{skills.length - 4}</span>}</div>}
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
    <main className="min-h-screen bg-[#CDEAF4] px-4 py-6 sm:px-6 lg:py-9">
      <div className="mx-auto w-full max-w-[1240px]">
        {isPublicJobsMockMode && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Đang xem dữ liệu minh họa. Đây không phải tin tuyển dụng thật.</div>}
        <header className="mb-5 px-1 sm:mb-7 sm:px-2">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#168BB5]">Cơ hội nghề nghiệp</p>
          <h1 className="mt-1 text-[30px] font-extrabold tracking-tight text-[#245A75] sm:text-[40px]">Job Search Dashboard</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#527488]">Tìm vai trò phù hợp, khám phá công ty và kỹ năng cần thiết.</p>
        </header>

        <form onSubmit={event => { event.preventDefault(); commitTextFilters(); }} className="mb-4 flex gap-2 rounded-[14px] border border-[#D7E9F0] bg-white p-2 shadow-sm lg:hidden">
          <label className="sr-only" htmlFor="job-search-mobile">Tìm theo vị trí, mô tả hoặc kỹ năng</label>
          <Search className="ml-2 mt-3 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          <input id="job-search-mobile" type="search" autoComplete="off" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Vị trí, mô tả hoặc kỹ năng" className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0" />
          <button type="submit" aria-label="Tìm việc" className="inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] bg-[#12B5EC] px-3 text-sm font-semibold text-white transition hover:bg-[#079DD7] focus:outline-none focus:ring-4 focus:ring-cyan-100"><Search className="h-4 w-4" aria-hidden="true" /></button>
        </form>

        <div className="mb-4 flex items-center justify-between lg:hidden">
          <p className="text-sm font-medium text-slate-700">Bộ lọc tìm kiếm</p>
          <button type="button" onClick={() => setMobileFiltersOpen(open => !open)} aria-expanded={mobileFiltersOpen} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm font-semibold text-[#527488] shadow-sm"><SlidersHorizontal className="h-4 w-4 text-[#12A8D8]" aria-hidden="true" />{mobileFiltersOpen ? 'Ẩn bộ lọc' : 'Mở bộ lọc'}</button>
        </div>

        <div className="rounded-[22px] border border-white/75 bg-white/90 p-3 shadow-[0_12px_40px_rgba(30,110,145,0.10)] backdrop-blur-sm sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
          <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:block`} aria-label="Bộ lọc việc làm">
            <div className="rounded-[17px] border border-[#E5F3F8] bg-[#F8FDFF] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-[#E5F3F8] pb-4">
                <h2 className="font-bold text-[#17243B]">Tìm việc</h2>
                <button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#078FBF] hover:text-[#05749A] disabled:cursor-not-allowed disabled:text-slate-400"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Xóa lọc</button>
              </div>
              <div className="space-y-5 pt-4">
                <form onSubmit={event => { event.preventDefault(); commitTextFilters(); }}>
                  <label htmlFor="job-search" className="mb-1.5 block text-sm font-medium text-slate-700">Từ khóa</label>
                  <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[#D7E9F0] bg-white px-3 transition focus-within:border-[#13B5EC] focus-within:ring-[3px] focus-within:ring-[#13B5EC]/15">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <input id="job-search" type="search" autoComplete="off" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Vị trí, mô tả, kỹ năng" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0" />
                  </div>
                  <button type="submit" className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#12B5EC] px-4 text-sm font-semibold text-white transition hover:bg-[#079DD7] focus:outline-none focus:ring-4 focus:ring-cyan-100"><Search className="h-4 w-4" aria-hidden="true" />Tìm việc</button>
                </form>
                <div>
                  <label htmlFor="job-skills-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Kỹ năng</label>
                  <input id="job-skills-filter" value={skillsDraft} onChange={event => setSkillsDraft(event.target.value)} placeholder="Ví dụ: React, SQL" className="h-10 w-full rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm text-[#334155] placeholder:text-slate-400 focus:border-[#13B5EC] focus:outline-none focus:ring-[3px] focus:ring-[#13B5EC]/15" />
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">Nhập nhiều kỹ năng, cách nhau bằng dấu phẩy.</p>
                </div>
                <div>
                  <label htmlFor="job-industry-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Ngành nghề</label>
                  <input id="job-industry-filter" value={industryDraft} onChange={event => setIndustryDraft(event.target.value)} placeholder="Nhập đúng ngành nghề" className="h-10 w-full rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm text-[#334155] placeholder:text-slate-400 focus:border-[#13B5EC] focus:outline-none focus:ring-[3px] focus:ring-[#13B5EC]/15" />
                </div>
                <div>
                  <label htmlFor="job-seniority-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Cấp độ</label>
                  <select id="job-seniority-filter" value={filterState.seniority} onChange={event => updateFilter('seniority', event.target.value)} className="h-10 w-full rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm text-[#334155] focus:border-[#13B5EC] focus:outline-none focus:ring-[3px] focus:ring-[#13B5EC]/15">
                    <option value="">Tất cả cấp độ</option><option value="JUNIOR">Junior</option><option value="MID">Mid</option><option value="SENIOR">Senior</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <section aria-label="Kết quả việc làm" className="min-w-0 rounded-[17px] border border-[#E7F2F6] bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF2F5] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#17243B] sm:text-lg">Việc làm đang mở</h2>
                <p aria-live="polite" className="mt-0.5 text-sm text-[#64748B]">{loading ? 'Đang cập nhật kết quả…' : `${result.jobs.length} kết quả trên trang này`}</p>
              </div>
              {hasActiveFilters && <button type="button" onClick={resetFilters} className="text-sm font-semibold text-[#078FBF] hover:text-[#05749A]">Xóa tất cả bộ lọc</button>}
            </div>
            {loading ? <LoadingCards /> : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center"><p role="alert" className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-4 rounded-[10px] bg-[#12B5EC] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#079DD7]">Thử tải lại</button></div>
            ) : result.jobs.length === 0 ? (
              <div className="px-4 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F7FD] text-[#078FBF]"><Search className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-4 font-semibold text-[#17243B]">Chưa tìm thấy việc làm phù hợp</h3><p className="mt-1 text-sm text-[#64748B]">Thử đổi từ khóa hoặc bỏ bớt một vài bộ lọc.</p>{hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[#D7E9F0] px-4 py-2 text-sm font-semibold text-[#527488] hover:bg-[#F3FBFE]"><X className="h-4 w-4" aria-hidden="true" />Xóa bộ lọc</button>}</div>
            ) : (
              <>
                <div className="space-y-3">{result.jobs.map(job => <JobCard key={job.id} job={job} />)}</div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F7] pt-4">
                  <p className="text-xs text-[#64748B]">Hiển thị {result.jobs.length} kết quả trên trang {pageIndex + 1}</p>
                  <nav aria-label="Phân trang việc làm" className="flex items-center gap-2">
                    <button type="button" disabled={pageIndex === 0 || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: (current.query === queryString ? current.cursors : [undefined]).slice(0, -1) }))} className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-[#DDECF2] px-3 text-sm font-medium text-[#527488] transition hover:bg-[#F3FBFE] disabled:cursor-not-allowed disabled:text-slate-300"><ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Trước</span></button>
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[9px] bg-[#12B5EC] px-2 text-sm font-semibold text-white" aria-current="page">{pageIndex + 1}</span>
                    <button type="button" disabled={!hasNext || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: [...(current.query === queryString ? current.cursors : [undefined]), result.nextPage] }))} className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-[#DDECF2] px-3 text-sm font-medium text-[#078FBF] transition hover:bg-[#E8F7FD] disabled:cursor-not-allowed disabled:text-slate-300"><span className="hidden sm:inline">Tiếp</span><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                  </nav>
                </div>
              </>
            )}
          </section>
        </div>
        </div>
      </div>
    </main>
  );
}
