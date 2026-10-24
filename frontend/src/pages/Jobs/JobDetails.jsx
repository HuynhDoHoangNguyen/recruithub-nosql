import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { BriefcaseBusiness, Clock, GraduationCap } from 'lucide-react';
import { applicationApi, jobApi } from '../../api/jobApplicationApi';
import { useAuth } from '../../context/useAuth';
import { deadlineIsOpen, degreeLabels, formatDate, jobStatusLabels, normalizeRole, seniorityLabels } from '../../features/applications/applicationPresentation';
import { Button, Resource, StageBadge } from '../../features/applications/components/ApplicationUI';
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
  return <main className="min-h-screen bg-blue-50 p-4 sm:p-6"><div className="max-w-4xl mx-auto space-y-4">
    <Link to="/jobs" className="inline-block text-sm font-medium text-blue-700 hover:underline">← Về danh sách việc làm</Link>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    <Resource resource={resource}>{job && <article className="bg-white rounded-lg shadow-md p-6 sm:p-8 relative space-y-6">
      <div><h1 className="text-3xl font-bold text-blue-800 mb-2">{job.title}</h1><div className="text-gray-600 flex flex-wrap items-center gap-4 mb-4">
        <p className="flex items-center gap-2"><BriefcaseBusiness className="w-4 h-4" aria-hidden="true" />{job.company_name || job.industry}</p>
        <p className="flex items-center gap-2"><GraduationCap className="w-4 h-4" aria-hidden="true" />{seniorityLabels[job.seniority]}</p>
        <p className="flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden="true" />{formatDate(job.deadline)}</p>
      </div></div>
      <div className="flex flex-wrap gap-3 text-sm text-gray-600"><span>{job.industry}</span><span>{seniorityLabels[job.seniority]}</span><span>{jobStatusLabels[job.status]}</span><span>Hạn nộp: {formatDate(job.deadline)}</span></div>
      <section><h2 className="mb-2 text-lg font-semibold">Mô tả công việc</h2><p className="whitespace-pre-wrap text-gray-700">{job.description}</p></section>
      <section><h2 className="mb-2 text-lg font-semibold">Trách nhiệm</h2><ul className="list-disc space-y-1 pl-5 text-gray-700">{job.responsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
      <section><h2 className="mb-2 text-lg font-semibold">Yêu cầu chung</h2><ul className="list-disc space-y-1 pl-5 text-gray-700">{job.requirements.general.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
      <section><h2 className="mb-2 text-lg font-semibold">Kỹ năng bắt buộc</h2><div className="flex flex-wrap gap-2">{job.required_skills.map(skill => <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">{skill}</span>)}</div>
        {!!job.optional_skills.length && <p className="mt-3 text-sm text-gray-600">Ưu tiên: {job.optional_skills.join(', ')}</p>}</section>
      <section className="space-y-1 text-sm text-gray-700"><h2 className="mb-2 text-lg font-semibold">Yêu cầu chuyên môn</h2>
        <p>Kinh nghiệm: {job.requirements.experience.status === 'REQUIRED' ? `Tối thiểu ${job.requirements.experience.required_months} tháng` : job.requirements.experience.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa có thông tin'}</p>
        <p>Học vấn: {job.requirements.education.status === 'REQUIRED' ? degreeLabels[job.requirements.education.minimum_degree] : job.requirements.education.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa có thông tin'}</p>
        <p>Dự án: {job.requirements.project.status === 'REQUIRED' ? job.requirements.project.required_technologies.join(', ') : job.requirements.project.status === 'NO_REQUIREMENT' ? 'Không yêu cầu' : 'Chưa có thông tin'}</p>
      </section>
      {application ? <section className="space-y-4 border-t border-gray-200 pt-5"><p className="text-sm text-gray-600">Bạn đã nộp hồ sơ cho vị trí này.</p><StageBadge stage={application.current_stage} />
        <ApplicationTimeline application={application} /><WithdrawButton application={application} onChanged={resource.reload} /></section> : candidate ? <div className="space-y-2">
          <Button disabled={!deadlineIsOpen(job)} onClick={() => setShowApply(true)}>Nộp hồ sơ ứng tuyển</Button>
          {!deadlineIsOpen(job) && <p className="text-sm text-gray-500">Tin đã đóng hoặc đã hết hạn nộp hồ sơ.</p>}</div> : !user && <Link className="text-blue-700 underline" to="/login">Đăng nhập để ứng tuyển</Link>}
    </article>}</Resource>
    {showApply && job && <ApplyModal job={job} onClose={() => setShowApply(false)} onRefresh={resource.reload} onSubmitted={() => {
      setShowApply(false); setMessage('Đã nộp hồ sơ thành công. Bạn có thể theo dõi tiến trình trong trang hồ sơ ứng tuyển.'); toast.success('Đã nộp hồ sơ.'); resource.reload();
    }} />}
  </div></main>;
}
