import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationApi } from '../../api/jobApplicationApi';
import { formatDate, jobUrl } from '../../features/applications/applicationPresentation';
import { Page, Pagination, Resource, StageBadge, StageFilter } from '../../features/applications/components/ApplicationUI';
import ApplicationTimeline from '../../features/applications/components/ApplicationTimeline';
import WithdrawButton from '../../features/applications/components/WithdrawButton';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function JobSeekerDashboard() {
  const [stage, setStage] = useState('');
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => applicationApi.mine({ bookmark, limit: 20, ...(stage ? { stage } : {}) }), [bookmark, stage]));
  return <Page title="Hồ sơ ứng tuyển của tôi" subtitle="Theo dõi tiến trình và lịch sử xử lý từng vị trí."
    action={<Link to="/jobs" className="text-sm font-semibold text-indigo-700">Tìm việc làm</Link>}>
    <StageFilter value={stage} onChange={value => { setStage(value); pager.reset(); }} />
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có hồ sơ ứng tuyển phù hợp.">
      <div className="space-y-5">{resource.data?.items.map(application => <article key={application._id} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap justify-between gap-3"><div><Link className="text-lg font-semibold text-indigo-800" to={jobUrl(application.job_id)}>{application.job?.title || 'Tin tuyển dụng không còn khả dụng'}</Link>
          <p className="mt-1 text-sm text-slate-500">Nộp lúc {formatDate(application.applied_at)}</p></div><StageBadge stage={application.current_stage} /></div>
        <ApplicationTimeline application={application} />
        <details><summary className="cursor-pointer text-sm text-indigo-700">CV và thư giới thiệu đã nộp</summary>
          <p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm">{application.submission?.resume_text || 'Hồ sơ lịch sử chưa có CV văn bản.'}</p>
          {application.submission?.cover_letter && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{application.submission.cover_letter}</p>}
        </details><WithdrawButton application={application} onChanged={resource.reload} />
      </article>)}</div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading} />
  </Page>;
}
