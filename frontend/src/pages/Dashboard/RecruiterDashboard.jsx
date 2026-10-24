import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BriefcaseBusiness, Users, CalendarDays, CircleCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { jobApi } from '../../api/jobApplicationApi';
import AccountHeader from '../../components/AccountHeader';
import { formatDate, jobStatusLabels, recruiterJobUrl } from '../../features/applications/applicationPresentation';
import { Button, ErrorMessage, Pagination, Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function RecruiterDashboard() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => jobApi.list({ ...(status ? { status } : {}), bookmark, limit: 20 }), [status, bookmark]));
  const stats = useApiResource(useCallback(() => jobApi.stats(), []));
  const organization = useApiResource(useCallback(() => jobApi.context(), []));
  async function changeStatus(job, next) {
    if (next === 'CLOSED' && !window.confirm(`Đóng tin “${job.title}”? Ứng viên sẽ không thể nộp hồ sơ mới.`)) return;
    setBusy(true); setError(null);
    try { await jobApi.status(job._id, next, job._rev); toast.success('Đã cập nhật tin tuyển dụng.'); }
    catch (failure) { setError(failure); }
    finally { await Promise.all([resource.reload(), stats.reload()]); setBusy(false); }
  }
  const values = stats.data;
  return <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-slate-50 min-h-screen relative space-y-6">
    <AccountHeader id="organization" title="Quản lý tuyển dụng" organization={organization.data} action={<Link to="/recruiter/jobs/create" className="btn-primary inline-flex items-center"><Plus className="w-4 h-4 mr-2" />Tạo tin tuyển dụng</Link>} />
    <ErrorMessage error={organization.error} retry={organization.reload} />
    <Resource resource={stats}><div className="grid grid-cols-2 lg:grid-cols-4 gap-6">{[
      ['Tin đang tuyển', values?.jobs.OPEN || 0, BriefcaseBusiness], ['Tổng hồ sơ', values?.total_applications || 0, Users],
      ['Đang phỏng vấn', values?.applications.INTERVIEW || 0, CalendarDays], ['Đã tuyển', values?.applications.HIRED || 0, CircleCheck],
    ].map(([label, count, Icon]) => <div key={label} className="card p-5 flex items-center gap-4"><span className="p-3 bg-blue-50 rounded-xl"><Icon aria-hidden="true" className="w-6 h-6 text-blue-600" /></span><div><p className="text-2xl font-extrabold text-slate-900">{count}</p><p className="text-xs text-slate-500 mt-1">{label}</p></div></div>)}</div></Resource>
    <ErrorMessage error={error} retry={() => { resource.reload(); stats.reload(); }} />
    <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-bold text-gray-800">Tin tuyển dụng của tôi</h2><label className="text-sm font-medium text-gray-700">Trạng thái tin<select value={status} onChange={event => { setStatus(event.target.value); pager.reset(); }} className="ml-3 border p-2 rounded bg-white">
      <option value="">Tất cả</option>{Object.entries(jobStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label></div>
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có tin phù hợp. Hãy tạo tin tuyển dụng đầu tiên.">
      <div className="space-y-4">{resource.data?.items.map(job => <article key={job._id} className="card card-hover p-5 sm:p-6 space-y-4 w-full">
        <h3 className="text-xl font-semibold text-gray-800">{job.title}</h3>
        <p className="text-sm text-gray-500 flex items-center gap-2"><BriefcaseBusiness className="w-4 h-4" aria-hidden="true" />{job.industry}</p>
        <p className="text-sm text-gray-500">Tạo {formatDate(job.created_at)} · Hạn nộp {formatDate(job.deadline)}</p>
        <p className="text-sm font-medium">Trạng thái: <span className={job.status === 'OPEN' ? 'text-green-600' : job.status === 'DRAFT' ? 'text-yellow-700' : 'text-red-600'}>{jobStatusLabels[job.status]}</span></p>
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
          <Link className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded text-sm font-medium text-center" to={recruiterJobUrl(job._id, 'applicants')}>Xem ứng viên</Link>
          <div className="flex flex-wrap gap-2">{job.status !== 'CLOSED' && <Link className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-3 py-2 rounded text-sm font-medium" to={recruiterJobUrl(job._id, 'edit')}>Chỉnh sửa</Link>}
            {job.status === 'DRAFT' && <Button disabled={busy || resource.loading} onClick={() => changeStatus(job, 'OPEN')}>Đăng tuyển</Button>}
            {job.status !== 'CLOSED' && <Button secondary disabled={busy || resource.loading} onClick={() => changeStatus(job, 'CLOSED')}>Đóng tin</Button>}
          </div>
        </div>
      </article>)}</div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading || busy} />
  </main>;
}
