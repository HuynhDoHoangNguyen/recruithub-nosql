import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import PublicJobCard from '../../features/jobs/components/PublicJobCard';
import { seniorityLabels } from '../../features/applications/applicationPresentation';
import { Link, useSearchParams } from 'react-router-dom';
import { isPublicJobsMockMode, listPublicJobs } from '../../services/publicJobsApi';

const PAGE_SIZE = 12;

function setOrDelete(params, key, value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized) params.set(key, normalized);
  else params.delete(key);
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

  return <main className="min-h-screen bg-slate-50 px-4 sm:px-6 lg:px-8 py-8"><div className="max-w-7xl mx-auto space-y-6">
    {isPublicJobsMockMode && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Đang xem dữ liệu minh họa. Đây không phải tin tuyển dụng thật.</div>}
    <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4"><div><p className="text-xs text-slate-400 mb-2"><Link to="/">Trang chủ</Link> / Việc Làm IT</p><h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tuyển Dụng Việc Làm IT Toàn Quốc</h1></div><form onSubmit={event => { event.preventDefault(); commitTextFilters(); }} className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Tìm theo vị trí, mô tả, ngành nghề hoặc kỹ năng" className="input-field pl-9 sm:w-72" placeholder="Lọc nhanh theo từ khóa…" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} /></form></header>
    <div className="md:hidden"><button type="button" aria-controls="job-filters" aria-expanded={mobileFiltersOpen} className="btn-secondary" onClick={() => setMobileFiltersOpen(value => !value)}>{mobileFiltersOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</button></div>
    <div className="grid md:grid-cols-4 gap-6"><aside id="job-filters" aria-label="Bộ lọc việc làm" className={`${mobileFiltersOpen ? 'block' : 'hidden'} card p-5 space-y-6 md:block self-start`}>
      <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-4"><h2 className="text-sm font-extrabold text-slate-800">🔍 Bộ Lọc Nâng Cao</h2><button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="text-xs text-blue-600 font-semibold disabled:text-slate-400">Xóa lọc</button></div>
      <p className="text-xs leading-relaxed text-slate-400">Tìm kiếm và lọc trên toàn bộ tin đang mở tuyển.</p>
      <label className="block text-xs uppercase font-bold text-slate-400">Cấp độ<select value={filterState.seniority} onChange={event => updateFilter('seniority', event.target.value)} className="input-field mt-3"><option value="">Tất cả cấp bậc</option>{Object.entries(seniorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-xs uppercase font-bold text-slate-400">Kỹ năng<input value={skillsDraft} onChange={event => setSkillsDraft(event.target.value)} placeholder="VD: React, JavaScript" className="input-field mt-3" /></label>
      <label className="block text-xs uppercase font-bold text-slate-400">Ngành nghề<input value={industryDraft} onChange={event => setIndustryDraft(event.target.value)} placeholder="Nhập ngành nghề" className="input-field mt-3" /></label>
    </aside>
    <section aria-label="Kết quả việc làm" className="md:col-span-3 space-y-4 min-w-0"><div className="card px-4 py-3 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{loading ? 'Đang tải…' : `${result.jobs.length} việc làm trên trang ${pageIndex + 1}`}</span><span>{hasActiveFilters ? 'Kết quả theo bộ lọc' : 'Sắp xếp: Mới tạo nhất'}</span></div>
      {loading ? <div role="status" className="card p-8 text-center text-slate-500"><span className="loading-spinner mr-3" />Đang tải tin tuyển dụng…</div> : error ? <div role="alert" className="message-error"><p>{error}</p><button className="btn-secondary mt-3" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : !result.jobs.length ? <div className="card p-10 text-center"><h2 className="font-bold text-slate-800">Chưa tìm thấy việc làm phù hợp</h2><p className="text-sm text-slate-500 mt-2">Thử đổi từ khóa hoặc bỏ bớt bộ lọc.</p></div> : result.jobs.map(job => <PublicJobCard key={job.id} job={{ ...job, _id: job.id, company_name: job.company?.name, required_skills: job.requiredSkills || [] }} />)}
      <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-end gap-3"><button type="button" className="btn-secondary text-sm" disabled={pageIndex === 0 || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: (current.query === queryString ? current.cursors : [undefined]).slice(0, -1) }))}>Trang trước</button><span className="text-sm text-slate-500">Trang {pageIndex + 1}</span><button type="button" className="btn-secondary text-sm" disabled={!hasNext || loading} onClick={() => setPagination(current => ({ query: queryString, cursors: [...(current.query === queryString ? current.cursors : [undefined]), result.nextPage] }))}>Trang sau</button></nav>
    </section></div>
  </div></main>;
}