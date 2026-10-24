import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { jobApi } from '../../api/jobApplicationApi';
import { formatDate, jobStatusLabels, recruiterJobUrl } from '../../features/applications/applicationPresentation';
import { Button, ErrorMessage, Page, Pagination, Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function RecruiterDashboard() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => jobApi.list({ ...(status ? { status } : {}), bookmark, limit: 20 }), [status, bookmark]));
  const stats = useApiResource(useCallback(() => jobApi.stats(), []));
  async function changeStatus(job, next) {
    if (next === 'CLOSED' && !window.confirm(`Đóng tin “${job.title}”? Ứng viên sẽ không thể nộp hồ sơ mới.`)) return;
    setBusy(true); setError(null);
    try { await jobApi.status(job._id, next, job._rev); toast.success('Đã cập nhật tin tuyển dụng.'); }
    catch (failure) { setError(failure); }
    finally { await Promise.all([resource.reload(), stats.reload()]); setBusy(false); }
  }
  const values = stats.data;
  return <Page title="Quản lý tuyển dụng" subtitle="Theo dõi các tin và hồ sơ trong phạm vi của bạn."
    action={<Link to="/recruiter/jobs/create" className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">+ Tạo tin tuyển dụng</Link>}>
    <Resource resource={stats}><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[
      ['Tin đang tuyển', values?.jobs.OPEN || 0], ['Tổng hồ sơ', values?.total_applications || 0],
      ['Đang phỏng vấn', values?.applications.INTERVIEW || 0], ['Đã tuyển', values?.applications.HIRED || 0],
    ].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{count}</p></div>)}</div></Resource>
    <ErrorMessage error={error} retry={() => { resource.reload(); stats.reload(); }} />
    <label className="block text-sm font-medium text-slate-700">Trạng thái tin<select value={status} onChange={event => { setStatus(event.target.value); pager.reset(); }} className="ml-3 rounded-lg border border-slate-300 bg-white p-2">
      <option value="">Tất cả</option>{Object.entries(jobStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có tin phù hợp. Hãy tạo tin tuyển dụng đầu tiên.">
      <div className="space-y-4">{resource.data?.items.map(job => <article key={job._id} className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{job.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{job.industry} · {jobStatusLabels[job.status]} · Tạo {formatDate(job.created_at)}</p></div>
          <div className="flex flex-wrap gap-2"><Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-indigo-700" to={recruiterJobUrl(job._id, 'applicants')}>Xem ứng viên</Link>
            {job.status !== 'CLOSED' && <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm" to={recruiterJobUrl(job._id, 'edit')}>Chỉnh sửa</Link>}
            {job.status === 'DRAFT' && <Button disabled={busy || resource.loading} onClick={() => changeStatus(job, 'OPEN')}>Đăng tuyển</Button>}
            {job.status !== 'CLOSED' && <Button secondary disabled={busy || resource.loading} onClick={() => changeStatus(job, 'CLOSED')}>Đóng tin</Button>}
          </div></div>
      </article>)}</div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading || busy} />
  </Page>;
}
