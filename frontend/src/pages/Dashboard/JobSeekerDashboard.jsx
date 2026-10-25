import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Hourglass, CircleCheck, CircleX } from 'lucide-react';
import { applicationApi } from '../../api/jobApplicationApi';
import AccountHeader from '../../components/AccountHeader';
import CandidateApplicationCard from '../../features/applications/components/CandidateApplicationCard';
import { stageLabels } from '../../features/applications/applicationPresentation';
import { ErrorMessage, Pagination, Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function JobSeekerDashboard() {
  const [stage, setStage] = useState('');
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => applicationApi.mine({ bookmark, limit: 5, ...(stage ? { stage } : {}) }), [bookmark, stage]));
  const stats = useApiResource(useCallback(() => applicationApi.stats(), []));
  const account = useApiResource(useCallback(() => applicationApi.context(), []));
  const items = resource.data?.items || [];
  const byStage = stats.data?.by_stage || {};
  const count = stages => stages.reduce((total, value) => total + (byStage[value] || 0), 0);
  const changed = () => Promise.all([resource.reload(), stats.reload()]);
  return <main className="min-h-screen bg-slate-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <AccountHeader title="Hồ sơ ứng tuyển của tôi" profile={account.data?.candidate} email={account.data?.email} action={<><Link to="/profile" className="btn-secondary text-xs">Cập nhật CV / Profile</Link><Link to="/jobs" className="btn-primary text-xs">Tìm việc mới →</Link></>} />
    <ErrorMessage error={account.error} retry={account.reload} />
    <section aria-label="Thống kê toàn bộ hồ sơ của tôi"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">{[
      ['Tổng đơn ứng tuyển', stats.data?.total_applications, FileText, 'text-blue-600 bg-blue-50'],
      ['Đang xử lý', count(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER']), Hourglass, 'text-amber-600 bg-amber-50'],
      ['Đã tuyển', count(['HIRED']), CircleCheck, 'text-emerald-600 bg-emerald-50'],
      ['Đã kết thúc', count(['REJECTED', 'WITHDRAWN']), CircleX, 'text-rose-600 bg-rose-50'],
    ].map(([label, value, Icon, color]) => <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-4" key={label}><span className={`p-3 rounded-xl ${color}`}><Icon className="h-6 w-6" aria-hidden="true" /></span><div><p className="text-2xl font-extrabold text-slate-900">{stats.loading || stats.error ? '—' : value}</p><p className="text-xs text-slate-500 mt-1">{label}</p></div></div>)}</div><p className="text-xs text-slate-500 mt-3">Hồ sơ hiện hành: {stats.data?.total_applications ?? '—'} · Tổng lần nộp: {stats.data?.total_attempts ?? '—'} · Lần đã lưu lịch sử: {stats.data?.historical_attempts ?? '—'}</p><ErrorMessage error={stats.error} retry={stats.reload} /></section>
    <div className="grid lg:grid-cols-4 gap-6">
      <aside className="lg:col-span-1"><div className="card p-4 lg:sticky lg:top-24"><h2 className="text-xs uppercase font-bold text-slate-400 px-3 mb-4 mt-2">Trạng thái ứng tuyển</h2><div className="space-y-2">
        {[['', 'Tất cả đơn nộp'], ...Object.entries(stageLabels)].map(([value, label]) => <button type="button" key={value} aria-pressed={stage === value} onClick={() => { setStage(value); pager.reset(); }} className={`w-full flex justify-between gap-2 text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${stage === value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><span>{label}</span><span className={`px-2 rounded-full ${stage === value ? 'bg-white/20' : 'bg-slate-100'}`}>{stats.loading || stats.error ? '—' : value ? byStage[value] || 0 : stats.data?.total_applications}</span></button>)}
      </div></div></aside>
      <section className="lg:col-span-3 min-w-0 space-y-4"><div className="card px-5 py-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><h2>Danh sách đơn ứng tuyển ({items.length} trên trang)</h2><span>Lọc theo trạng thái · Trang {pager.page}</span></div>
        <Resource resource={resource} empty={!items.length} emptyMessage="Chưa có hồ sơ ứng tuyển phù hợp.">
          <div className="space-y-4">{items.map(application => <CandidateApplicationCard key={application._id} application={application} onChanged={changed} />)}</div>
        </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading} pageSize={5} itemCount={items.length} noun="hồ sơ" />
      </section>
    </div>
  </div></main>;
}
