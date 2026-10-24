import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isPublicJobsMockMode, listPublicJobs } from '../../services/publicJobsApi';

export default function JobList() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [industry, setIndustry] = useState('');
  const [seniority, setSeniority] = useState('');
  const [sort, setSort] = useState('newest');
  const [cursorStack, setCursorStack] = useState([undefined]);
  const [result, setResult] = useState({ jobs: [], total: 0, nextPage: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bookmark = cursorStack[cursorStack.length - 1];
  const page = isPublicJobsMockMode ? cursorStack.length : cursorStack.length;

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    listPublicJobs({ search: params.get('q') || search, industry, seniority, sort, page, bookmark })
      .then(data => { if (active) setResult(data); })
      .catch(requestError => { if (active) setError(requestError.message || 'Không tải được việc làm.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params, search, industry, seniority, sort, page, bookmark]);

  const resetPage = () => setCursorStack([undefined]);
  const submitSearch = event => {
    event.preventDefault(); resetPage();
    setParams(search.trim() ? { q: search.trim() } : {});
  };
  const hasNext = isPublicJobsMockMode ? Boolean(result.nextPage) : Boolean(result.has_more);

  return <main className="min-h-screen bg-blue-50 p-4 md:p-6"><div className="mx-auto max-w-7xl">
    {isPublicJobsMockMode && <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Chế độ xem thử: dữ liệu fixture phát triển; không thể nộp hồ sơ từ tin mẫu.</div>}
    {!isPublicJobsMockMode && <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Tin tuyển dụng được tải từ API Job của TV2. Bộ lọc áp dụng trên trang kết quả hiện tại.</div>}
    <header className="mb-6"><h1 className="text-3xl font-bold text-blue-800">Việc làm đang mở</h1><p className="mt-2 text-gray-600">Chỉ hiển thị tin có trạng thái OPEN.</p></header>
    <form onSubmit={submitSearch} className="mb-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
      <label className="form-label lg:col-span-2">Tìm kiếm<input className="input-field" value={search} onChange={event => setSearch(event.target.value)} placeholder="Vị trí, công ty, kỹ năng" /></label>
      <label className="form-label">Ngành<select className="input-field" value={industry} onChange={event => { setIndustry(event.target.value); resetPage(); }}><option value="">Tất cả</option><option>Technology</option><option>Finance</option><option>Healthcare</option></select></label>
      <label className="form-label">Cấp độ<select className="input-field" value={seniority} onChange={event => { setSeniority(event.target.value); resetPage(); }}><option value="">Tất cả</option><option value="JUNIOR">Junior</option><option value="MID">Mid</option><option value="SENIOR">Senior</option></select></label>
      <label className="form-label">Sắp xếp<select className="input-field" value={sort} onChange={event => { setSort(event.target.value); resetPage(); }}><option value="newest">Mới nhất</option><option value="title">Tên vị trí</option></select></label>
      <button className="btn-primary sm:col-span-2 lg:col-span-5" type="submit">Tìm việc</button>
    </form>
    {loading ? <div role="status" className="py-16 text-center text-blue-700">Đang tải danh sách việc làm…</div> : error ? <div role="alert" className="message-error">{error}</div> : result.jobs.length === 0 ? <div className="rounded-xl bg-white py-16 text-center text-gray-500 shadow-sm">Không có việc làm phù hợp.</div> : <section className="space-y-4" aria-label="Danh sách việc làm">
      <p className="text-sm text-gray-600">{result.total} vị trí phù hợp trong kết quả hiện tại</p>
      {result.jobs.map(job => <Link to={`/jobs/${encodeURIComponent(job.id)}`} key={job.id} className="block rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
        <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="text-xl font-semibold text-blue-800">{job.title}</h2><p className="mt-1 text-gray-600">{job.company.name} · {job.industry}</p></div><span className="h-fit rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">OPEN</span></div>
        <p className="mt-3 line-clamp-2 text-gray-700">{job.description}</p><div className="mt-3 flex flex-wrap gap-2">{job.requiredSkills.map(skill => <span key={skill} className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">{skill}</span>)}</div>
        <p className="mt-3 text-sm text-gray-500">{job.seniority} · Hạn ứng tuyển: {job.deadline ? new Date(job.deadline).toLocaleDateString('vi-VN') : 'Chưa có thông tin'}</p>
      </Link>)}
      <div className="flex justify-center gap-3 pt-3"><button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setCursorStack(items => items.slice(0, -1))}>Trang trước</button><span className="self-center text-sm text-gray-600">Trang {page}</span><button className="btn-secondary" disabled={!hasNext || loading} onClick={() => setCursorStack(items => [...items, result.nextPage])}>Trang tiếp</button></div>
    </section>}
  </div></main>;
}
