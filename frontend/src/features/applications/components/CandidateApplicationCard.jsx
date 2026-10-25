import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, ChevronDown, ChevronUp, FileText, MapPin } from 'lucide-react';
import CompanyLogo from '../../../components/CompanyLogo';
import ViewAssetButton from '../../../components/uploads/ViewAssetButton';
import { salaryLabel } from '../../jobs/jobPresentation';
import { formatDate, jobUrl, mainStages, stageLabels } from '../applicationPresentation';
import { StageBadge } from './ApplicationUI';
import ApplicationAttempts from './ApplicationAttempts';
import ApplicationTimeline from './ApplicationTimeline';
import WithdrawButton from './WithdrawButton';
import { dashboardSecondaryButton } from '../dashboardStyles';

export default function CandidateApplicationCard({ application, onChanged }) {
  const [expanded, setExpanded] = useState(false), detailsId = useId();
  const job = application.job, index = mainStages.indexOf(application.current_stage);
  const skills = job?.required_skills || [];
  return <article className="rh-job-card relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-white to-blue-50/40 shadow-sm transition hover:border-blue-400 hover:shadow-lg hover:shadow-blue-900/5"><div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 via-indigo-500 to-emerald-400" />
    <div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 flex-1 gap-4"><CompanyLogo name={job?.company_name || 'Doanh nghiệp'} src={job?.company_logo_url} /><div className="min-w-0"><p className="mb-1 text-xs font-medium text-slate-500">{job?.company_name || job?.industry || 'Chưa có thông tin doanh nghiệp'}</p><Link to={jobUrl(application.job_id)} className="hover:text-blue-600"><h3 className="break-words text-base font-bold leading-6 text-slate-900 sm:text-lg">{job?.title || 'Tin tuyển dụng không còn khả dụng'}</h3></Link><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">{job?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />{job.location_label || job.location}</span>}{job?.salary && <span className="font-semibold text-emerald-700">{salaryLabel(job.salary)}</span>}</div></div></div><StageBadge stage={application.current_stage} /></div>
      {!!skills.length && <div className="mt-4 flex flex-wrap gap-2">{skills.slice(0, 5).map(skill => <span key={skill} className="badge-tag">{skill}</span>)}{skills.length > 5 && <span className="badge-tag">+{skills.length - 5} kỹ năng</span>}</div>}
      {index >= 0 && <div aria-label="Tiến trình ứng tuyển" className="mt-5 flex items-center gap-1.5">{mainStages.map((stage, step) => <span key={stage} title={stageLabels[stage]} className={`h-1.5 flex-1 rounded-full ${step <= index ? 'bg-blue-500' : 'bg-slate-100'}`} />)}</div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Đã nộp vào ngày: <strong className="font-medium text-slate-600">{formatDate(application.applied_at)}</strong></span><div className="flex flex-wrap items-center gap-2"><Link className={dashboardSecondaryButton} to={jobUrl(application.job_id)}>{application.current_stage === 'WITHDRAWN' ? 'Ứng tuyển lại' : 'Xem việc làm'}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link><WithdrawButton application={application} onChanged={onChanged} /></div></div>
    </div>
    <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(current => !current)} className="flex w-full items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 text-left text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-600"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" aria-hidden="true" />{expanded ? 'Thu gọn chi tiết' : 'Xem chi tiết, CV và lịch sử'}{application.previous_attempts?.length ? <span className="rounded-full bg-white px-2 py-0.5 text-slate-400">{application.previous_attempts.length + 1} lần nộp</span> : null}</span>{expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}</button>
    {expanded && <div id={detailsId} className="space-y-5 border-t border-slate-100 p-5 sm:p-6"><ApplicationTimeline application={application} /><section className="space-y-3"><h4 className="text-sm font-bold text-slate-800">CV đã nộp</h4><ViewAssetButton asset={application.submission?.resume_file} />{application.submission?.resume_text ? <p className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm">{application.submission.resume_text}</p> : !application.submission?.resume_file && <p className="text-xs text-slate-400">Hồ sơ lịch sử chưa có CV đính kèm.</p>}{application.submission?.cover_letter && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{application.submission.cover_letter}</p>}</section><ApplicationAttempts application={application} /></div>}
  </article>;
}
