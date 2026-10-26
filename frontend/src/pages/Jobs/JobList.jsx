import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, MapPin, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import CompanyLogo from '../../components/CompanyLogo';
import { salaryLabel } from '../../features/jobs/jobPresentation';
import { seniorityLabels } from '../../features/applications/applicationPresentation';
import { useJobMetadata } from '../../features/jobs/useJobMetadata';
import { Link, useSearchParams } from 'react-router-dom';
import { isPublicJobsMockMode, listPublicJobs } from '../../services/publicJobsApi';

const PAGE_SIZE = 12;
const normalizedSkills = value => value.split(',').map(skill => skill.trim()).filter(Boolean).join(',');

function setOrDelete(params, key, value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized) params.set(key, normalized);
  else params.delete(key);
}



function JobCard({ job }) {
  const skills = job.requiredSkills || [];
  const companyName = job.company?.name || job.company_name || job.industry;
  const companyMark = companyName?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const seniority = seniorityLabels[job.seniority] || job.seniority;
  return (
    <Link to={'/jobs/' + encodeURIComponent(job.id)} className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-blue-100 bg-white p-5 shadow-[0_12px_28px_-16px_rgba(15,45,105,0.35)] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_34px_-16px_rgba(30,64,175,0.35)] focus:outline-none focus:ring-[3px] focus:ring-blue-400/30">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-600 to-indigo-600" />
      <div className="flex items-start gap-3 pt-1">
        {job.company_logo_url ? <CompanyLogo name={companyName} src={job.company_logo_url} className="h-12 w-12 shrink-0 rounded-2xl sm:h-14 sm:w-14" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-[0_8px_18px_-9px_rgba(37,99,235,0.9)] sm:h-14 sm:w-14">{companyMark ? <span className="text-sm font-bold tracking-wide">{companyMark}</span> : <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />}</div>}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-semibold text-slate-800">{companyName || 'C\u00f4ng ty'}</p>
          {job.industry && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Building2 className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />{job.industry}</p>}
        </div>
        {seniority && <span className="shrink-0 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">{seniority}</span>}
      </div>
      <h2 className="mt-5 min-h-12 text-[17px] font-bold leading-6 tracking-tight text-slate-900 transition group-hover:text-blue-700">{job.title}</h2>
      {job.salary && <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-[#F0F8F4] px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm"><Banknote className="h-4 w-4" aria-hidden="true" /></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">{'M\u1ee9c l\u01b0\u01a1ng'}</p><p className="mt-0.5 text-xs font-semibold text-slate-800">{salaryLabel(job.salary)}</p></div>
      </div>}
      {(job.location_label || job.location || job.work_mode_label || job.work_mode) && <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-slate-500"><MapPin className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" /><span className="truncate">{job.location_label || job.location}{(job.work_mode_label || job.work_mode) && <> {'\u00b7'} {job.work_mode_label || job.work_mode}</>}</span></div>}
      {!!skills.length && <div className="mt-3 flex flex-wrap gap-1.5">{skills.slice(0, 3).map(skill => <span key={skill} className="rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-1 text-[10px] font-medium text-slate-600">{skill}</span>)}{skills.length > 3 && <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">+{skills.length - 3}</span>}</div>}
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="min-w-0 text-[11px] text-slate-500">{job.deadline ? <><span className="block font-medium">H\u1ea1n n\u1ed9p</span><span>{new Date(job.deadline).toLocaleDateString('vi-VN')}</span></> : <span>{job.application_available === false ? 'Tin tham kh\u1ea3o' : 'C\u01a1 h\u1ed9i \u0111ang m\u1edf'}</span>}</div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition group-hover:border-blue-200 group-hover:bg-blue-600 group-hover:text-white">{'Xem chi ti\u1ebft'} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
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
  const metadata = useJobMetadata();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [pagination, setPagination] = useState({ query: '', cursors: [undefined] });
  const [result, setResult] = useState({ jobs: [], total: null, nextPage: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);
  const filterState = useMemo(() => {
    const current = new URLSearchParams(queryString);
    return { search: current.get('q') || '', skills: (current.get('skills') || '').split(',').map(skill => skill.trim()).filter(Boolean).join(','), industry: current.get('industry') || '', seniority: current.get('seniority') || '', location: current.get('location') || '', work_mode: current.get('work_mode') || '' };
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
      setOrDelete(next, 'skills', normalizedSkills(skillsDraft));
      setOrDelete(next, 'industry', industryDraft);
      next.delete('bookmark');
      return next;
    }, { replace: true });
  }, [searchDraft, skillsDraft, industryDraft, setParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new URLSearchParams(queryString);
      if ((current.get('q') || '') !== searchDraft.trim() || (current.get('skills') || '') !== normalizedSkills(skillsDraft) || (current.get('industry') || '') !== industryDraft.trim()) commitTextFilters();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [commitTextFilters, queryString, searchDraft, skillsDraft, industryDraft]);

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
      setOrDelete(next, 'q', searchDraft);
      setOrDelete(next, 'skills', normalizedSkills(skillsDraft));
      setOrDelete(next, 'industry', industryDraft);
      setOrDelete(next, key, value);
      next.delete('bookmark');
      return next;
    });
  };

  const resetFilters = () => {
    setSearchDraft('');
    setSkillsDraft('');
    setIndustryDraft('');
    setParams({}, { replace: true });
  };

  const hasActiveFilters = Boolean(filterState.search || filterState.skills || filterState.industry || filterState.seniority || filterState.location || filterState.work_mode);
  const hasNext = Boolean(result.nextPage);
  const filterSuggestions = useMemo(() => {
    const currentJobs = result.jobs || [];
    const skillFallback = [...new Set(currentJobs.flatMap(job => job.requiredSkills || []))].sort();
    const industryFallback = [...new Set(currentJobs.map(job => job.industry).filter(Boolean))].sort();
    return {
      skills: metadata.data?.skills?.length ? metadata.data.skills : skillFallback,
      industries: metadata.data?.industries?.length ? metadata.data.industries : industryFallback,
      seniorities: metadata.data?.seniorities || [],
    };
  }, [metadata.data, result.jobs]);



  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:py-9">
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

        <div className="rounded-[26px] border border-blue-950/10 bg-gradient-to-br from-[#31539D] via-[#23447F] to-[#18315F] p-3 shadow-[0_20px_50px_-24px_rgba(22,48,100,0.55)] sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
          <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:block`} aria-label="Bộ lọc việc làm">
            <div className="rounded-[17px] border border-[#E5F3F8] bg-[#F8FDFF] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-[#E5F3F8] pb-4">
                <h2 className="font-bold text-[#17243B]">Tìm việc</h2>
                <button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#078FBF] hover:text-[#05749A] disabled:cursor-not-allowed disabled:text-slate-400"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Xóa lọc</button>
              </div>
              <div className="space-y-5 pt-4">
                {metadata.loading && <p role="status" className="text-xs text-[#64748B]">Đang tải danh mục bộ lọc…</p>}
                {metadata.error && <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">Gợi ý đầy đủ chưa tải được; đang dùng thông tin từ các tin đang hiển thị. Bạn vẫn có thể nhập tay.</p>}
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
                  <input id="job-skills-filter" list="job-skills-options" value={skillsDraft} onChange={event => setSkillsDraft(event.target.value)} placeholder="Ví dụ: React, SQL" className="h-10 w-full rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm text-[#334155] placeholder:text-slate-400 focus:border-[#13B5EC] focus:outline-none focus:ring-[3px] focus:ring-[#13B5EC]/15" />
                  <datalist id="job-skills-options">{filterSuggestions.skills?.map(skill => <option key={skill} value={skill} />)}</datalist>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">Khớp tất cả kỹ năng, tối đa 8, cách nhau bằng dấu phẩy.</p>
                </div>
                <div>
                  <label htmlFor="job-industry-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Ngành nghề</label>
                  <input id="job-industry-filter" list="job-industry-options" value={industryDraft} onChange={event => setIndustryDraft(event.target.value)} placeholder="Nhập đúng ngành nghề" className="h-10 w-full rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm text-[#334155] placeholder:text-slate-400 focus:border-[#13B5EC] focus:outline-none focus:ring-[3px] focus:ring-[#13B5EC]/15" />
                  <datalist id="job-industry-options">{filterSuggestions.industries?.map(industry => <option key={industry} value={industry} />)}</datalist>
                </div>
                <div>
                  <label htmlFor="job-seniority-filter" className="mb-1.5 block text-sm font-medium text-slate-700">Cấp độ</label>
                  <select id="job-seniority-filter" value={filterState.seniority} onChange={event => updateFilter('seniority', event.target.value)} className="h-10 w-full rounded-[10px] border border-[#D7E9F0] bg-white px-3 text-sm text-[#334155] focus:border-[#13B5EC] focus:outline-none focus:ring-[3px] focus:ring-[#13B5EC]/15">
                    <option value="">Tất cả cấp độ</option>{(filterSuggestions.seniorities?.length ? metadata.data.seniorities : Object.entries(seniorityLabels).map(([value, label]) => ({ value, label }))).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </aside>

          <section aria-label="Kết quả việc làm" className="min-w-0 p-1 text-white sm:p-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
              <div>
                <h2 className="text-base font-bold text-white sm:text-lg">Việc làm đang mở</h2>
                <p aria-live="polite" className="mt-0.5 text-sm text-blue-100/80">{loading ? 'Đang cập nhật kết quả…' : `${result.jobs.length} kết quả trên trang này`}</p>
              </div>
              {hasActiveFilters && <button type="button" onClick={resetFilters} className="text-sm font-semibold text-sky-200 hover:text-white">Xóa tất cả bộ lọc</button>}
            </div>
            {loading ? <LoadingCards /> : error ? (
              <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-[0_12px_28px_-20px_rgba(15,45,105,0.45)]"><p role="alert" className="text-sm font-medium text-slate-700">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/15 transition hover:from-sky-600 hover:to-blue-700">Thử tải lại</button></div>
            ) : result.jobs.length === 0 ? (
              <div className="rounded-2xl border border-blue-100 bg-white px-4 py-12 text-center shadow-[0_12px_28px_-20px_rgba(15,45,105,0.45)]"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F7FD] text-[#078FBF]"><Search className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-4 font-semibold text-[#17243B]">Chưa tìm thấy việc làm phù hợp</h3><p className="mt-1 text-sm text-[#64748B]">Thử đổi từ khóa hoặc bỏ bớt một vài bộ lọc.</p>{hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[#D7E9F0] px-4 py-2 text-sm font-semibold text-[#527488] hover:bg-[#F3FBFE]"><X className="h-4 w-4" aria-hidden="true" />Xóa bộ lọc</button>}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{result.jobs.map(job => <JobCard key={job.id} job={job} />)}</div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
                  <p className="text-xs text-blue-100/80">Hiển thị {result.jobs.length} kết quả trên trang {pageIndex + 1}</p>
                  <nav aria-label="Phân trang việc làm" className="flex items-center gap-2">
                    <button type="button" aria-label="Trang trước" disabled={pageIndex === 0 || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: (current.query === queryString ? current.cursors : [undefined]).slice(0, -1) }))} className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-white/20 px-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-blue-200/50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Trước</span></button>
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[9px] bg-[#12B5EC] px-2 text-sm font-semibold text-white" aria-current="page">{pageIndex + 1}</span>
                    <button type="button" aria-label="Trang sau" disabled={!hasNext || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: [...(current.query === queryString ? current.cursors : [undefined]), result.nextPage] }))} className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-white/20 px-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-300"><span className="hidden sm:inline">Tiếp</span><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
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
