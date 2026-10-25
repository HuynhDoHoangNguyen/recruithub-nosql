import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, MapPin, Send, Layers, Building2, Banknote, Clock3 } from 'lucide-react';
import CompanyLogo from '../../components/CompanyLogo';
import ViewAssetButton from '../../components/uploads/ViewAssetButton';
import { employmentLabels, salaryLabel } from '../../features/jobs/jobPresentation';
import { applicationApi, jobApi } from '../../api/jobApplicationApi';
import { useAuth } from '../../context/useAuth';
import { deadlineIsOpen, degreeLabels, formatDate, jobStatusLabels, normalizeRole, seniorityLabels } from '../../features/applications/applicationPresentation';
import { Resource, StageBadge } from '../../features/applications/components/ApplicationUI';
import ApplyModal from '../../features/applications/components/ApplyModal';
import ApplicationTimeline from '../../features/applications/components/ApplicationTimeline';
import ApplicationAttempts from '../../features/applications/components/ApplicationAttempts';
import WithdrawButton from '../../features/applications/components/WithdrawButton';
import { useApiResource } from '../../features/applications/useApiResource';

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const heading = 'font-extrabold text-slate-900 flex items-center gap-2 mb-4';
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
  const canApply = !application || application.current_stage === 'WITHDRAWN';
  const eligible = job && deadlineIsOpen(job) && job.application_available !== false;
  const industry = job?.industry;
  const related = useApiResource(useCallback(async () => {
    if (!industry) return { items: [] };
    return jobApi.publicList({ industry, limit: 4 });
  }, [industry]));
  const cta = candidate && canApply ? <button type="button" disabled={!eligible} onClick={() => setShowApply(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-bold text-sm text-white shadow-lg shadow-blue-600/15 disabled:opacity-50 disabled:shadow-none hover:from-blue-700 hover:to-indigo-700"><Send className="h-4 w-4" aria-hidden="true" />{application ? 'Ứng tuyển lại' : 'Ứng tuyển ngay'}</button>
    : !user ? <Link to="/login" className="btn-primary inline-flex gap-2 items-center"><Send className="h-4 w-4" aria-hidden="true" />Đăng nhập để ứng tuyển</Link> : candidate ? <a href="#application" className="btn-secondary">Xem hồ sơ đã nộp ↓</a> : <span className="text-xs text-slate-400">Chế độ nhà tuyển dụng</span>;
  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6 sm:py-10"><div className="max-w-6xl mx-auto space-y-6">
    <nav aria-label="Đường dẫn" className="text-xs text-slate-400 flex gap-2 flex-wrap"><Link to="/">Trang chủ</Link><span>/</span><Link to="/jobs">Việc Làm IT</Link>{job && <><span>/</span><span className="text-slate-600">{job.title}</span></>}</nav>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    <Resource resource={resource}>{job && <>
      <header className={`${card} overflow-hidden`}><div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" /><div className="p-5 sm:p-8 flex flex-col sm:flex-row gap-5 sm:items-center">
        <CompanyLogo name={job.company_name || 'Doanh nghiệp'} src={job.company_logo_url} className="h-20 w-20" />
        <div className="flex-1 min-w-0"><p className="text-sm text-slate-500 mb-2">{job.company_name || 'Doanh nghiệp chưa cập nhật'}</p><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-slate-900">{job.title}</h1><div className="flex flex-wrap items-center gap-2 mt-3 text-xs"><span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 border border-emerald-100">{jobStatusLabels[job.status]}</span><span className="badge-tag">{job.location_label || 'Chưa cập nhật'}</span><span className="badge-tag">{job.work_mode_label || 'Chưa cập nhật'}</span></div></div><div className="shrink-0">{cta}</div>
      </div></header>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[[MapPin, 'Địa điểm', job.location_label || 'Chưa cập nhật'], [Layers, 'Hình thức', job.work_mode_label || 'Chưa cập nhật'], [BriefcaseBusiness, 'Cấp bậc', seniorityLabels[job.seniority]], [Banknote, 'Mức lương', salaryLabel(job.salary)], [Clock3, 'Loại hình', employmentLabels[job.employment_type] || 'Chưa cập nhật'], [CalendarDays, 'Hạn nộp', formatDate(job.deadline)]].map(([Icon, label, value]) => <div key={label} className={`${card} p-4 flex gap-3 items-start`}><span className="rounded-xl p-2 bg-blue-50 text-blue-600"><Icon className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-[11px] text-slate-400">{label}</p><p className="text-xs font-bold text-slate-700 mt-1">{value}</p></div></div>)}</div>
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0"><article className={`${card} p-6 sm:p-8 space-y-7 text-sm leading-7 text-slate-600`}>
          <section><h2 className={heading}>📝 Mô tả chi tiết công việc</h2><p className="whitespace-pre-wrap break-words">{job.description}</p></section>
          {!!job.responsibilities.length && <section className="border-t border-slate-100 pt-6"><h2 className={heading}>Trách nhiệm</h2><ul className="list-disc marker:text-blue-500 pl-5 space-y-2">{job.responsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
          {!!job.requirements.general.length && <section className="border-t border-slate-100 pt-6"><h2 className={heading}>Yêu cầu ứng viên</h2><ul className="list-disc marker:text-blue-500 pl-5 space-y-2">{job.requirements.general.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
          <section className="border-t border-slate-100 pt-6"><h2 className={heading}>🛠 Kỹ năng & chuyên môn</h2><p className="text-xs text-slate-400 mb-2">Kỹ năng bắt buộc</p><div className="flex flex-wrap gap-2">{job.required_skills.map(skill => <span key={skill} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-1">{skill}</span>)}</div>
            {!!job.optional_skills.length && <p className="mt-4 text-xs">Ưu tiên: {job.optional_skills.join(', ')}</p>}
            <div className="mt-5 rounded-xl bg-slate-50 p-4 space-y-2 text-xs"><p>Kinh nghiệm: {job.requirements.experience.status === 'REQUIRED' ? `Tối thiểu ${job.requirements.experience.required_months} tháng` : job.requirements.experience.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa cập nhật'}</p><p>Học vấn: {job.requirements.education.status === 'REQUIRED' ? degreeLabels[job.requirements.education.minimum_degree] : job.requirements.education.status === 'NO_MINIMUM' ? 'Không yêu cầu tối thiểu' : 'Chưa cập nhật'}</p><p>Dự án: {job.requirements.project.status === 'REQUIRED' ? job.requirements.project.required_technologies.join(', ') : job.requirements.project.status === 'NO_REQUIREMENT' ? 'Không yêu cầu' : 'Chưa cập nhật'}</p></div>
          </section>
        </article>
        {candidate && application && <section id="application" className={`${card} p-6 space-y-5 scroll-mt-24`}><div className="flex flex-wrap justify-between gap-3"><h2 className={heading}>Hồ sơ ứng tuyển · Lần {application.attempt_number || 1}</h2><StageBadge stage={application.current_stage} /></div><p className="text-xs text-slate-500">Nộp ngày: {formatDate(application.applied_at)}</p>
          <details><summary className="text-sm text-blue-600 font-semibold cursor-pointer">Xem CV và thư giới thiệu đã nộp</summary><div className="mt-3"><ViewAssetButton asset={application.submission?.resume_file} /></div><pre className="mt-3 whitespace-pre-wrap break-words bg-slate-50 p-4 rounded-xl font-sans text-sm max-h-72 overflow-auto">{application.submission?.resume_text || (application.submission?.resume_file ? 'CV đã được đính kèm dưới dạng file.' : 'Hồ sơ lịch sử chưa có CV văn bản.')}</pre>{application.submission?.cover_letter && <p className="mt-3 text-sm whitespace-pre-wrap">{application.submission.cover_letter}</p>}</details>
          <ApplicationTimeline application={application} /><WithdrawButton application={application} onChanged={resource.reload} /><ApplicationAttempts application={application} />
        </section>}
        </div>
        <aside className="space-y-5"><section className={`${card} p-6`}><h2 className="uppercase text-xs text-slate-400 font-bold border-b border-slate-100 pb-3 mb-4">Thông tin doanh nghiệp</h2><p className="font-bold flex gap-2 text-slate-800"><Building2 className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />{job.company_name || 'Chưa cập nhật'}</p><dl className="mt-5 text-xs space-y-3"><div className="flex justify-between gap-4"><dt className="text-slate-400">Ngành nghề</dt><dd className="font-semibold text-right">{job.industry}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Địa điểm vị trí</dt><dd className="font-semibold text-right">{job.location_label || 'Chưa cập nhật'}</dd></div></dl></section>
          <section className={`${card} p-5 space-y-3`}>{cta}{job.application_available === false && <p className="text-xs leading-6 text-slate-500">Tin tham khảo từ bộ dữ liệu. Chọn tin có nhãn “Đang nhận hồ sơ” để ứng tuyển.</p>}{!deadlineIsOpen(job) && <p className="text-xs leading-6 text-slate-500">Tin đã đóng, thiếu hạn nộp hoặc đã hết hạn.</p>}</section>
          {related.loading ? <p role="status" className="text-xs text-slate-400">Đang tải việc làm cùng ngành…</p> : related.error ? <p className="text-xs text-slate-500">Chưa tải được việc làm cùng ngành.</p> : !!related.data?.items.filter(item => item._id !== job._id).length && <section className={`${card} p-6`}><h2 className="uppercase text-xs text-slate-400 font-bold border-b border-slate-100 pb-3">Việc làm cùng ngành</h2>{related.data.items.filter(item => item._id !== job._id).slice(0, 3).map(item => <Link key={item._id} to={`/jobs/${encodeURIComponent(item._id)}`} className="block py-4 border-b last:border-0 border-slate-100"><p className="font-bold text-xs text-slate-700 leading-5">{item.title} <ArrowUpRight className="inline h-3 w-3 text-blue-600" /></p><p className="text-[11px] text-slate-400 mt-2">{item.company_name || item.industry}</p></Link>)}</section>}
        </aside>
      </div>
    </>}</Resource>
    {showApply && job && <ApplyModal job={job} previousApplication={application} onClose={() => setShowApply(false)} onRefresh={resource.reload} onSubmitted={() => {
      setShowApply(false); setMessage('Đã nộp hồ sơ thành công. Bạn có thể theo dõi tiến trình trong trang hồ sơ ứng tuyển.'); toast.success('Đã nộp hồ sơ.'); resource.reload();
    }} />}
  </div></main>;
}
