import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { jobApi } from '../../api/jobApplicationApi';
import { formatDate, jobUrl, seniorityLabels } from '../../features/applications/applicationPresentation';
import { Page, Pagination, Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

// Minimal public read adapter for Apply; advanced search belongs to the Public Portal.
export default function JobList() {
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => jobApi.publicList({ bookmark, limit: 20 }), [bookmark]));
  return <Page title="Cơ hội việc làm" subtitle="Các vị trí đang mở tuyển dụng.">
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có tin tuyển dụng đang mở.">
      <div className="grid gap-5 md:grid-cols-2">{resource.data?.items.map(job => <article key={job._id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <Link to={jobUrl(job._id)} className="text-lg font-semibold text-indigo-800">{job.title}</Link><p className="text-sm text-slate-500">{job.industry} · {seniorityLabels[job.seniority]}</p>
        <p className="line-clamp-3 text-sm text-slate-700">{job.description}</p><p className="text-xs text-slate-500">Hạn nộp: {formatDate(job.deadline)}</p>
        <p className="text-sm text-indigo-700">{job.required_skills.join(' · ')}</p>
      </article>)}</div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading} />
  </Page>;
}
