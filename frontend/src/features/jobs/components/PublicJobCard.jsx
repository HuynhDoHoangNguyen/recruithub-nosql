import { Link } from 'react-router-dom';
import { formatDate, jobUrl, seniorityLabels } from '../../applications/applicationPresentation';

export default function PublicJobCard({ job, compact = false }) {
  return <Link to={jobUrl(job._id)} className="card card-hover block p-5 sm:p-6 group">
    <div className="flex items-start gap-4"><span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center">{(job.company_name || 'IT').slice(0, 3).toUpperCase()}</span>
      <div className="flex-1 min-w-0"><p className="text-xs text-slate-500 mb-1.5">{job.company_name || job.industry}</p><h2 className={`${compact ? 'text-base' : 'text-lg'} font-extrabold tracking-tight text-slate-900 group-hover:text-blue-600`}>{job.title}</h2><div className="flex flex-wrap items-center gap-2 mt-2"><span className="badge-tag">{seniorityLabels[job.seniority]}</span><span className="text-xs text-slate-500">{job.industry}</span></div></div>
    </div>
    <div className="flex flex-wrap gap-2 border-t border-slate-100 mt-4 pt-4">{job.required_skills.slice(0, compact ? 3 : 8).map(skill => <span key={skill} className="badge-tag">{skill}</span>)}</div>
    <div className="flex flex-wrap justify-between gap-2 mt-4 text-[11px]"><span className="text-slate-400">Hạn nộp {formatDate(job.deadline)}</span><span className="font-bold text-blue-600">Xem chi tiết →</span></div>
  </Link>;
}
