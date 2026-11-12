import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BriefcaseBusiness, Users, CalendarDays, CircleCheck, PencilLine, Send, Archive, RotateCcw, MapPin, Banknote, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { jobApi } from '../../api/jobApplicationApi';
import ReopenJobModal from '../../features/jobs/components/ReopenJobModal';
import DeleteJobButton from '../../features/jobs/components/DeleteJobButton';
import CompanyLogo from '../../components/CompanyLogo';
import { dashboardPrimaryButton, dashboardSecondaryButton } from '../../features/applications/dashboardStyles';
import { employmentLabels, salaryLabel } from '../../features/jobs/jobPresentation';
import AccountHeader from '../../components/AccountHeader';
import { formatDate, jobStatusLabels, recruiterJobUrl } from '../../features/applications/applicationPresentation';
import { Button, ErrorMessage, Pagination, Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';
import JobImportExportModal from '../../features/jobs/components/JobImportExportModal';

export default function RecruiterDashboard() {
  const [reopenJob, setReopenJob] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => jobApi.list({ ...(status ? { status } : {}), bookmark, limit: 5 }), [status, bookmark]));
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
  return <main className="rh-surface-page rh-recruiter-dashboard max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-slate-50 min-h-screen relative space-y-6">
    <AccountHeader id="organization" title="Quản lý tuyển dụng" organization={organization.data} action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowImportExport(true)} className="inline-flex items-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">Nhập / xuất</button><Link to="/recruiter/jobs/create" className="btn-primary inline-flex items-center"><Plus className="w-4 h-4 mr-2" />Tạo tin tuyển dụng</Link></div>} />
    <ErrorMessage error={organization.error} retry={organization.reload} />
    <Resource resource={stats}><div className="grid grid-cols-2 lg:grid-cols-4 gap-6">{[
      ['Tin đang tuyển', values?.jobs.OPEN || 0, BriefcaseBusiness], ['Tổng hồ sơ', values?.total_applications || 0, Users],
      ['Đang phỏng vấn', values?.applications.INTERVIEW || 0, CalendarDays], ['Đã tuyển', values?.applications.HIRED || 0, CircleCheck],
    ].map(([label, count, Icon]) => <div key={label} className="rh-stat-card card p-5 flex items-center gap-4"><span className="p-3 bg-blue-50 rounded-xl"><Icon aria-hidden="true" className="w-6 h-6 text-blue-600" /></span><div><p className="text-2xl font-extrabold text-slate-900">{count}</p><p className="text-xs text-slate-500 mt-1">{label}</p></div></div>)}</div></Resource>
    <ErrorMessage error={error} retry={() => { resource.reload(); stats.reload(); }} />
    <p className="text-xs text-slate-500">Hồ sơ hiện hành: {values?.total_applications ?? '—'} · Tổng lần nộp: {values?.total_attempts ?? '—'} · Lần đã lưu lịch sử: {values?.historical_attempts ?? '—'}</p>
    <div className="rh-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div><h2 className="text-xl font-bold text-slate-900">Tin tuyển dụng của tôi</h2><p className="mt-1 text-xs text-slate-400">Quản lý tin và hồ sơ ứng viên · 5 tin mỗi trang</p></div><label className="text-xs font-semibold text-slate-600">Trạng thái tin<select value={status} onChange={event => { setStatus(event.target.value); pager.reset(); }} className="ml-3 rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
      <option value="">Tất cả</option>{Object.entries(jobStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label></div>
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có tin phù hợp. Hãy tạo tin tuyển dụng đầu tiên.">
      <div className="space-y-4">{resource.data?.items.map(job => <article key={job._id} className="rh-job-card relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-white to-blue-50/40 p-5 sm:p-6 shadow-sm hover:border-blue-400 hover:shadow-lg hover:shadow-blue-900/5 transition-all space-y-4 w-full">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500" />
        <div className="flex items-start gap-4"><CompanyLogo name={job.company_name || organization.data?.company.name} src={job.company_logo_url} className="h-16 w-16" /><div className="flex-1 min-w-0"><p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{job.company_name || organization.data?.company.name}</p><h3 className="text-lg sm:text-xl font-extrabold text-slate-900">{job.title}</h3><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-3 py-1 font-semibold ${job.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : job.status === 'DRAFT' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{jobStatusLabels[job.status]}</span><span className="badge-tag">{job.industry}</span>{job.employment_type && <span className="badge-tag">{employmentLabels[job.employment_type]}</span>}</div></div></div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500"><p className="flex gap-2 items-center"><Banknote className="h-4 w-4 text-emerald-600" aria-hidden="true" />{salaryLabel(job.salary)}</p><p className="flex gap-2 items-center"><MapPin className="h-4 w-4 text-blue-500" aria-hidden="true" />{job.location_label || 'Chưa cập nhật'}</p><p className="flex gap-2 items-center"><CalendarDays className="h-4 w-4 text-indigo-500" aria-hidden="true" />Hạn nộp {formatDate(job.deadline)}</p></div>
        <div className="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-4">
          <Link className={dashboardPrimaryButton} to={recruiterJobUrl(job._id, 'applicants')}><Users className="h-4 w-4" aria-hidden="true" />Xem ứng viên</Link>
          {job.status !== 'CLOSED' && <Link className={dashboardSecondaryButton} to={recruiterJobUrl(job._id, 'edit')}><PencilLine className="h-4 w-4" aria-hidden="true" />Chỉnh sửa</Link>}
          {job.status === 'CLOSED' && <Button className="inline-flex items-center gap-2 !text-xs !px-3 !py-2" disabled={busy || resource.loading} onClick={() => setReopenJob(job)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Mở lại tin</Button>}
          {job.status === 'DRAFT' && <Button className="inline-flex items-center gap-2 !text-xs !px-3 !py-2" disabled={busy || resource.loading} onClick={() => changeStatus(job, 'OPEN')}><Send className="h-4 w-4" aria-hidden="true" />Đăng tuyển</Button>}
          {job.status !== 'CLOSED' && <button type="button" className={dashboardSecondaryButton} disabled={busy || resource.loading} onClick={() => changeStatus(job, 'CLOSED')}><Archive className="h-4 w-4" aria-hidden="true" />Đóng tin</button>}
          <DeleteJobButton job={job} disabled={busy || resource.loading} onDeleted={() => { pager.reset(); return Promise.all([resource.reload(), stats.reload()]); }} onConflict={() => Promise.all([resource.reload(), stats.reload()])} />
        </div>
      </article>)}</div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading || busy} pageSize={5} itemCount={resource.data?.items.length || 0} />
    {reopenJob && <ReopenJobModal job={reopenJob} onClose={() => setReopenJob(null)} onChanged={() => Promise.all([resource.reload(), stats.reload()])} />}
    {showImportExport && <JobImportExportModal onClose={() => setShowImportExport(false)} onImported={() => { pager.reset(); return Promise.all([resource.reload(), stats.reload()]); }} />}
  </main>;
}
