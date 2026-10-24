import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { applicationApi } from '../../api/jobApplicationApi';
import { useAuth } from '../../context/useAuth';
import { deadlineIsOpen, degreeLabels, formatDate, jobStatusLabels, normalizeRole, seniorityLabels } from '../../features/applications/applicationPresentation';
import { Button, Page, Resource, StageBadge } from '../../features/applications/components/ApplicationUI';
import ApplyModal from '../../features/applications/components/ApplyModal';
import ApplicationTimeline from '../../features/applications/components/ApplicationTimeline';
import WithdrawButton from '../../features/applications/components/WithdrawButton';
import { useApiResource } from '../../features/applications/useApiResource';
import { getPublicJob, isPublicJobsMockMode } from '../../services/publicJobsApi';

export default function JobDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const isCandidate = normalizeRole(user?.role) === 'CANDIDATE';
  const [showApply, setShowApply] = useState(false);
  const [notice, setNotice] = useState('');
  const resource = useApiResource(useCallback(async () => {
    const job = await getPublicJob(id);
    const applications = job && isCandidate && !isPublicJobsMockMode ? await applicationApi.mine({ job_id: id, limit: 20 }) : { items: [] };
    return { job, application: applications.items?.[0] || null };
  }, [id, isCandidate]));
  const { job, application } = resource.data || {};
  const responsibilities = job?.responsibilities || [];
  const requirements = job?.requirements || { general: [], experience: {}, education: {}, project: {} };
  const requiredSkills = job?.requiredSkills || job?.required_skills || [];
  const optionalSkills = job?.optionalSkills || job?.optional_skills || [];
  const deadlineOpen = deadlineIsOpen(job);

  return <Page title={job?.title || 'Chi tiết việc làm'} subtitle={job?.company?.name || job?.company_name}
    action={<Link to="/jobs" className="text-sm font-semibold text-blue-700">Về danh sách việc làm</Link>}>
    {isPublicJobsMockMode && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Đây là tin fixture phát triển; không thể nộp hồ sơ vào dữ liệu mẫu.</div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    <Resource resource={resource}>
      {!job ? <div className="rounded-xl bg-white p-6 text-gray-600">Không tìm thấy tin tuyển dụng đang mở.</div> : <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap gap-3 text-sm text-slate-600"><span>{job.industry}</span><span>{seniorityLabels[job.seniority] || job.seniority}</span><span>{jobStatusLabels[job.status] || job.status}</span><span>Hạn nộp: {formatDate(job.deadline)}</span></div>
        <section><h2 className="mb-2 text-lg font-semibold">Mô tả công việc</h2><p className="whitespace-pre-wrap text-slate-700">{job.description}</p></section>
        {!!responsibilities.length && <section><h2 className="mb-2 text-lg font-semibold">Trách nhiệm</h2><ul className="list-disc space-y-1 pl-5 text-slate-700">{responsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
        {!!requirements.general?.length && <section><h2 className="mb-2 text-lg font-semibold">Yêu cầu chung</h2><ul className="list-disc space-y-1 pl-5 text-slate-700">{requirements.general.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
        <section><h2 className="mb-2 text-lg font-semibold">Kỹ năng bắt buộc</h2><div className="flex flex-wrap gap-2">{requiredSkills.map(skill => <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">{skill}</span>)}</div>
          {!!optionalSkills.length && <p className="mt-3 text-sm text-slate-600">Ưu tiên: {optionalSkills.join(', ')}</p>}</section>
        {requirements.experience?.status && <section className="space-y-1 text-sm text-slate-700"><h2 className="mb-2 text-lg font-semibold">Yêu cầu chuyên môn</h2>
          <p>Kinh nghiệm: {requirements.experience.status === 'REQUIRED' ? `Tối thiểu ${requirements.experience.required_months} tháng` : requirements.experience.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa có thông tin'}</p>
          <p>Học vấn: {requirements.education?.status === 'REQUIRED' ? degreeLabels[requirements.education.minimum_degree] : requirements.education?.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa có thông tin'}</p>
          <p>Dự án: {requirements.project?.status === 'REQUIRED' ? requirements.project.required_technologies?.join(', ') : requirements.project?.status === 'NO_REQUIREMENT' ? 'Không yêu cầu' : 'Chưa có thông tin'}</p>
        </section>}
        {application ? <section className="space-y-4 border-t border-slate-200 pt-5"><p className="text-sm text-slate-600">Bạn đã nộp hồ sơ cho vị trí này.</p><StageBadge stage={application.current_stage} /><ApplicationTimeline application={application} /><WithdrawButton application={application} onChanged={resource.reload} /></section>
          : isPublicJobsMockMode ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Ứng tuyển sẽ khả dụng khi mở tin tuyển dụng thật từ API.</p>
          : isCandidate ? <div className="space-y-2"><Button disabled={!deadlineOpen} onClick={() => setShowApply(true)}>Nộp hồ sơ ứng tuyển</Button>{!deadlineOpen && <p className="text-sm text-slate-500">Tin đã đóng hoặc đã hết hạn nộp hồ sơ.</p>}</div>
          : !user ? <div className="flex flex-wrap gap-3"><Link className="btn-primary" to="/login">Đăng nhập để ứng tuyển</Link><Link className="btn-secondary" to="/register">Đăng ký ứng viên</Link></div>
          : <p className="text-sm text-slate-600">Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.</p>}
      </article>}
    </Resource>
    {showApply && job && <ApplyModal job={job} onClose={() => setShowApply(false)} onRefresh={resource.reload} onSubmitted={() => {
      setShowApply(false); setNotice('Đã nộp hồ sơ thành công. Bạn có thể theo dõi tiến trình trong trang hồ sơ ứng tuyển.');
      toast.success('Đã nộp hồ sơ.'); resource.reload();
    }} />}
  </Page>;
}
