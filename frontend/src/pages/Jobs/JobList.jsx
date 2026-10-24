import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { jobApi } from '../../api/jobApplicationApi';
import { seniorityLabels } from '../../features/applications/applicationPresentation';
import { Pagination, Resource } from '../../features/applications/components/ApplicationUI';
import PublicJobCard from '../../features/jobs/components/PublicJobCard';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function JobList() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const [showFilters, setShowFilters] = useState(false);
  const [seniority, setSeniority] = useState('');
  const [skill, setSkill] = useState('');
  const [industry, setIndustry] = useState('');
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => jobApi.publicList({ bookmark, limit: 20 }), [bookmark]));
  const jobs = resource.data?.items || [];
  const skillOptions = [...new Set(jobs.flatMap(job => job.required_skills))].sort();
  const visible = jobs.filter(job => (!search || `${job.title} ${job.description}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) &&
    (!seniority || job.seniority === seniority) && (!skill || job.required_skills.includes(skill)) && (!industry || job.industry.toLocaleLowerCase('vi').includes(industry.toLocaleLowerCase('vi'))));
  function clear() { setSeniority(''); setSkill(''); setIndustry(''); setParams({}); }
  return <main className="min-h-screen bg-slate-50 px-4 sm:px-6 lg:px-8 py-8"><div className="max-w-7xl mx-auto space-y-6">
    <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4"><div><p className="text-xs text-slate-400 mb-2"><Link to="/">Trang chủ</Link> / Việc Làm IT</p><h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tuyển Dụng Việc Làm IT Toàn Quốc</h1></div><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Tìm việc làm trên trang" className="input-field pl-9 sm:w-72" placeholder="Lọc nhanh theo từ khóa…" value={search} onChange={event => setParams(event.target.value ? { q: event.target.value } : {})} /></div></header>
    <div className="md:hidden"><button type="button" aria-controls="job-filters" aria-expanded={showFilters} className="btn-secondary" onClick={() => setShowFilters(value => !value)}>{showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</button></div>
    <div className="grid md:grid-cols-4 gap-6"><aside id="job-filters" className={`${showFilters ? 'block' : 'hidden'} card p-5 space-y-6 md:block self-start`}>
      <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-4"><h2 className="text-sm font-extrabold text-slate-800">🔍 Bộ Lọc Nâng Cao</h2><button type="button" onClick={clear} className="text-xs text-blue-600 font-semibold">Xóa</button></div>
      <p className="text-xs leading-relaxed text-slate-400">Tìm và lọc trong các tin trên trang hiện tại.</p>
      <fieldset><legend className="text-xs uppercase font-bold text-slate-400 mb-3">Cấp bậc & Kinh nghiệm</legend>{[['', 'Tất cả cấp bậc'], ...Object.entries(seniorityLabels)].map(([value, label]) => <label key={value} className={`flex items-center text-xs font-medium mb-2 gap-2 rounded-xl px-2 py-2 ${seniority === value ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}><input type="radio" name="seniority" value={value} checked={seniority === value} onChange={event => setSeniority(event.target.value)} className="accent-blue-600" />{label}</label>)}</fieldset>
      <label className="block text-xs uppercase font-bold text-slate-400">Kỹ năng<select value={skill} onChange={event => setSkill(event.target.value)} className="input-field mt-3"><option value="">Tất cả kỹ năng</option>{skillOptions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-xs uppercase font-bold text-slate-400">Ngành nghề<input value={industry} onChange={event => setIndustry(event.target.value)} placeholder="Nhập ngành nghề" className="input-field mt-3" /></label>
    </aside>
    <section className="md:col-span-3 space-y-4 min-w-0"><div className="card px-4 py-3 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>Hiển thị <strong className="text-slate-700">{visible.length}</strong> việc làm trên trang {pager.page}</span><span>Sắp xếp: Mới tạo nhất</span></div>
      <Resource resource={resource} empty={!visible.length} emptyMessage="Chưa có tin tuyển dụng phù hợp trên trang này.">{visible.map(job => <PublicJobCard job={job} key={job._id} />)}</Resource>
      <Pagination pager={pager} data={resource.data} loading={resource.loading} />
    </section></div>
  </div></main>;
}
