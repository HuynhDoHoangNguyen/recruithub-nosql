import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { applicationApi, jobApi } from '../../api/jobApplicationApi';
import { useAuth } from '../../context/AuthContext';
import { deadlineIsOpen, degreeLabels, formatDate, jobStatusLabels, normalizeRole, seniorityLabels } from '../../features/applications/applicationPresentation';
import { Button, Page, Resource, StageBadge } from '../../features/applications/components/ApplicationUI';
import ApplyModal from '../../features/applications/components/ApplyModal';
import ApplicationTimeline from '../../features/applications/components/ApplicationTimeline';
import WithdrawButton from '../../features/applications/components/WithdrawButton';
import { useApiResource } from '../../features/applications/useApiResource';

export default function JobDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const candidate = normalizeRole(user?.role) === 'CANDIDATE';
  const [showApply, setShowApply] = useState(false);
  const [message, setMessage] = useState('');
  const resource = useApiResource(useCallback(async () => {
    const job = await jobApi.publicDetail(id);
    const applications = candidate ? await applicationApi.mine({ job_id: id }) : { items: [] };
    return { job, application: applications.items[0] };
  }, [id, candidate]));
  const { job, application } = resource.data || {};
  return <Page title={job?.title || 'Chi tiết việc làm'} subtitle={job?.company_name}
    action={<Link to="/jobs" className="text-sm font-semibold text-indigo-700">Về danh sách việc làm</Link>}>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    <Resource resource={resource}>{job && <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap gap-3 text-sm text-slate-600"><span>{job.industry}</span><span>{seniorityLabels[job.seniority]}</span><span>{jobStatusLabels[job.status]}</span><span>Hạn nộp: {formatDate(job.deadline)}</span></div>
      <section><h2 className="mb-2 text-lg font-semibold">Mô tả công việc</h2><p className="whitespace-pre-wrap text-slate-700">{job.description}</p></section>
      <section><h2 className="mb-2 text-lg font-semibold">Trách nhiệm</h2><ul className="list-disc space-y-1 pl-5 text-slate-700">{job.responsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
      <section><h2 className="mb-2 text-lg font-semibold">Yêu cầu chung</h2><ul className="list-disc space-y-1 pl-5 text-slate-700">{job.requirements.general.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
      <section><h2 className="mb-2 text-lg font-semibold">Kỹ năng bắt buộc</h2><div className="flex flex-wrap gap-2">{job.required_skills.map(skill => <span key={skill} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-800">{skill}</span>)}</div>
        {!!job.optional_skills.length && <p className="mt-3 text-sm text-slate-600">Ưu tiên: {job.optional_skills.join(', ')}</p>}</section>
      <section className="space-y-1 text-sm text-slate-700"><h2 className="mb-2 text-lg font-semibold">Yêu cầu chuyên môn</h2>
        <p>Kinh nghiệm: {job.requirements.experience.status === 'REQUIRED' ? `Tối thiểu ${job.requirements.experience.required_months} tháng` : job.requirements.experience.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa có thông tin'}</p>
        <p>Học vấn: {job.requirements.education.status === 'REQUIRED' ? degreeLabels[job.requirements.education.minimum_degree] : job.requirements.education.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa có thông tin'}</p>
        <p>Dự án: {job.requirements.project.status === 'REQUIRED' ? job.requirements.project.required_technologies.join(', ') : job.requirements.project.status === 'NO_REQUIREMENT' ? 'Không yêu cầu' : 'Chưa có thông tin'}</p>
      </section>
      {application ? <section className="space-y-4 border-t border-slate-200 pt-5"><p className="text-sm text-slate-600">Bạn đã nộp hồ sơ cho vị trí này.</p><StageBadge stage={application.current_stage} />
        <ApplicationTimeline application={application} /><WithdrawButton application={application} onChanged={resource.reload} /></section> : candidate ? <div className="space-y-2">
          <Button disabled={!deadlineIsOpen(job)} onClick={() => setShowApply(true)}>Nộp hồ sơ ứng tuyển</Button>
          {!deadlineIsOpen(job) && <p className="text-sm text-slate-500">Tin đã đóng hoặc đã hết hạn nộp hồ sơ.</p>}</div> : !user && <Link className="text-indigo-700 underline" to="/login">Đăng nhập để ứng tuyển</Link>}
    </article>}</Resource>
    {showApply && job && <ApplyModal job={job} onClose={() => setShowApply(false)} onRefresh={resource.reload} onSubmitted={() => {
      setShowApply(false); setMessage('Đã nộp hồ sơ thành công. Bạn có thể theo dõi tiến trình trong trang hồ sơ ứng tuyển.'); toast.success('Đã nộp hồ sơ.'); resource.reload();
    }} />}
  </Page>;
}
