import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { jobApi } from '../api/jobApplicationApi';
import { Resource } from '../features/applications/components/ApplicationUI';
import PublicJobCard from '../features/jobs/components/PublicJobCard';
import { useApiResource } from '../features/applications/useApiResource';

export default function Landing() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const jobs = useApiResource(useCallback(() => jobApi.publicList({ limit: 6 }), []));
  return <main className="bg-slate-50 min-h-screen">
    <section className="relative overflow-hidden bg-slate-900 text-white"><div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-900/60" /><div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
      <span className="inline-flex gap-2 items-center bg-slate-800 border border-slate-700 text-blue-200 rounded-full px-4 py-1 text-[10px] font-bold"><span className="h-1.5 w-1.5 bg-emerald-400 rounded-full" />Cổng thông tin tuyển dụng IT</span>
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mt-8">Khám Phá Cơ Hội Việc Làm IT<span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Lương Cao & Đãi Ngộ Hàng Đầu</span></h1>
      <p className="mt-4 max-w-2xl mx-auto text-blue-200 text-sm sm:text-base">Tìm vị trí phù hợp với kỹ năng của bạn. Nộp CV và theo dõi từng bước trong hành trình ứng tuyển.</p>
      <form onSubmit={event => { event.preventDefault(); navigate(query.trim() ? `/jobs?q=${encodeURIComponent(query.trim())}` : '/jobs'); }} className="bg-white rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-3 mt-8 max-w-4xl mx-auto shadow-xl"><div className="flex gap-3 px-2 w-full items-center"><Search className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" /><input aria-label="Tìm công việc" value={query} onChange={event => setQuery(event.target.value)} className="w-full py-2 text-sm text-slate-800 outline-none" placeholder="Tên công việc, kỹ năng (React, Node, DevOps…)" /></div><button className="btn-primary whitespace-nowrap flex gap-2 items-center" type="submit">Tìm Kiếm <ArrowRight className="w-4 h-4" aria-hidden="true" /></button></form>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center mt-10 pt-7 border-t border-white/10 max-w-3xl mx-auto">{[['CV', 'Nộp hồ sơ văn bản'], ['7', 'Trạng thái ứng tuyển'], ['Tiến trình', 'Theo dõi lịch sử'], ['Tuyển dụng', 'Quản lý tin và ứng viên']].map(([value, label]) => <div key={value}><p className="text-xl sm:text-2xl font-extrabold text-blue-200">{value}</p><p className="text-[10px] text-slate-400 mt-1">{label}</p></div>)}</div>
    </div></section>
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"><span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-600">⭐ Cơ Hội Mới Nhất</span><div className="flex flex-wrap justify-between items-end gap-4 mt-3 mb-7"><div><h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Việc Làm IT Tiêu Biểu</h2><p className="text-xs text-slate-500 mt-1">Các vị trí đang mở tuyển trên hệ thống</p></div><Link to="/jobs" className="text-sm font-bold text-blue-600">Xem tất cả →</Link></div>
      <Resource resource={jobs} empty={!jobs.data?.items.length} emptyMessage="Chưa có tin tuyển dụng đang mở."><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{jobs.data?.items.map(job => <PublicJobCard compact key={job._id} job={job} />)}</div></Resource>
    </section>
    <section className="bg-white border-t border-slate-100 py-14"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><h2 className="text-2xl font-extrabold text-center tracking-tight">Tại Sao Lập Trình Viên Chọn JobPortal IT?</h2><p className="text-center text-xs text-slate-400 mt-2">Kết nối cơ hội việc làm và quản lý hành trình ứng tuyển</p><div className="grid sm:grid-cols-3 gap-6 mt-10">{[['🎯', 'Việc Làm IT', 'Khám phá vị trí theo kỹ năng, ngành nghề và cấp bậc.'], ['⚡', 'Ứng Tuyển Với CV', 'Gửi CV văn bản và thư giới thiệu cho vị trí phù hợp.'], ['🚀', 'Bảng Điều Khiển', 'Theo dõi hồ sơ, xem lịch sử và quản lý ứng viên.']].map(([icon, title, text]) => <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6" key={title}><span className="text-2xl">{icon}</span><h3 className="text-sm font-extrabold mt-4">{title}</h3><p className="text-xs text-slate-500 leading-relaxed mt-2">{text}</p></article>)}</div></div></section>
    <section className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-wrap justify-between gap-6 items-center"><div><h2 className="text-xl font-extrabold">Bạn là Doanh nghiệp muốn tuyển dụng nhân tài IT?</h2><p className="text-xs text-blue-200 mt-2">Đăng tin và theo dõi hồ sơ ứng viên trong bảng điều khiển tuyển dụng.</p></div><Link to="/recruiter/jobs/create" className="bg-white rounded-xl text-blue-600 px-5 py-3 text-xs font-bold">Đăng Tin Tuyển Dụng</Link></div></section>
  </main>;
}
