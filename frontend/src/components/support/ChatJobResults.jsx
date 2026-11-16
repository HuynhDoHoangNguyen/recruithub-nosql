import { Link } from 'react-router-dom';

export default function ChatJobResults({ result, onNavigate }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-slate-600">Bộ lọc đã hiểu: {result.filter_labels.join(' · ') || 'Tất cả tin đang nhận hồ sơ'}.</p>
    {result.jobs.map(job => <article key={job.id} className="rounded-xl border border-blue-100 bg-white p-3">
      <Link to={`/jobs/${encodeURIComponent(job.id)}`} onClick={onNavigate} className="block break-words font-bold text-blue-800 hover:underline">{job.title}</Link>
      <p className="mt-1 break-words text-xs font-semibold text-slate-700">{job.company_name}</p>
      <p className="mt-1 text-xs text-slate-600">{job.location_label} · {job.work_mode_label} · {job.seniority}</p>
      <p className="mt-2 break-words text-xs text-slate-600">Kỹ năng yêu cầu: {job.required_skills.join(', ') || 'Chưa cập nhật'}</p>
      <p className="mt-1 text-xs text-slate-500">Hạn nộp: {new Date(job.deadline).toLocaleString('vi-VN')}</p>
    </article>)}
    {result.partial && <p className="text-xs text-amber-800">Đã chạm giới hạn tra cứu; kết quả chưa bao phủ toàn bộ dữ liệu.</p>}
    {result.has_more && <p className="text-xs text-slate-600">Còn tin phù hợp; đang hiển thị tối đa 5 tin.</p>}
    <p className="text-[11px] leading-4 text-slate-500">{result.searched ? `Dữ liệu CouchDB lúc ${new Date(result.checked_at).toLocaleString('vi-VN')}. Trạng thái có thể thay đổi khi bạn mở tin.` : 'Chưa truy vấn dữ liệu do tiêu chí chưa được hỗ trợ.'}</p>
    <Link to={result.search_url} onClick={onNavigate} className="inline-flex rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">Mở trang việc làm với bộ lọc này</Link>
  </div>;
}
