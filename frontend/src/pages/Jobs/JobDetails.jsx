import { useCallback, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, Check, ClipboardList, Clock3, ExternalLink, FileCheck2, FileText, FolderKanban, GraduationCap, ListChecks, Send } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { applicationApi } from '../../api/jobApplicationApi';
import { useAuth } from '../../context/useAuth';
import { deadlineIsOpen, degreeLabels, normalizeRole, seniorityLabels, stageLabels } from '../../features/applications/applicationPresentation';
import ApplyModal from '../../features/applications/components/ApplyModal';
import ApplicationTimeline from '../../features/applications/components/ApplicationTimeline';
import WithdrawButton from '../../features/applications/components/WithdrawButton';
import { useApiResource } from '../../features/applications/useApiResource';
import { getPublicJob, isPublicJobsMockMode } from '../../services/publicJobsApi';

const dateLabel = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
};

function Section({ title, icon: Icon, children, className = '' }) {
  return <section className={`rounded-[17px] border border-[#E5F3F8] bg-white p-5 shadow-[0_2px_8px_rgba(15,75,105,0.035)] sm:p-6 ${className}`}>
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#17243B]"><Icon size={19} className="text-[#12A8D8]" aria-hidden="true" />{title}</h2>{children}
  </section>;
}

function LoadingDetail() {
  return <main className="min-h-screen bg-[#CDEAF4] px-4 py-8 sm:px-6"><div className="mx-auto max-w-[1240px] rounded-[22px] border border-white/75 bg-white/90 p-4 shadow-[0_12px_40px_rgba(30,110,145,0.10)] sm:p-6"><div className="animate-pulse space-y-6">
    <div className="h-4 w-40 rounded bg-slate-200" /><div className="rounded-xl border border-[#DFE5EF] bg-white p-7"><div className="h-8 w-2/3 rounded bg-slate-200" /><div className="mt-4 h-4 w-1/3 rounded bg-slate-100" /></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]"><div className="space-y-5"><div className="h-52 rounded-xl bg-white" /><div className="h-40 rounded-xl bg-white" /></div><div className="h-72 rounded-xl bg-white" /></div>
  </div></div></main>;
}

function DetailError({ error, retry }) {
  const notFound = error?.status === 404 || error?.code === 'NOT_FOUND';
  return <main className="min-h-screen bg-[#CDEAF4] px-4 py-16 sm:px-6"><div className="mx-auto max-w-xl rounded-[18px] border border-white bg-white p-8 text-center shadow-[0_12px_36px_rgba(30,110,145,0.10)]">
    <h1 className="text-2xl font-bold text-[#152348]">{notFound ? 'Tin tuyển dụng không khả dụng' : 'Không thể tải tin tuyển dụng'}</h1>
    <p role="alert" className="mt-3 text-[#64748B]">{notFound ? 'Tin này không tồn tại hoặc hiện không còn được công khai.' : (error?.message || 'Đã xảy ra lỗi kết nối. Vui lòng thử lại.')}</p>
    {!notFound && <button onClick={retry} className="mt-6 rounded-lg bg-[#12B5EC] px-5 py-2.5 font-semibold text-white hover:bg-[#079DD7]">Thử lại</button>}
    <Link to="/jobs" className="mt-6 inline-flex items-center gap-2 font-semibold text-[#078FBF]"><ArrowLeft size={17} />Về danh sách việc làm</Link>
  </div></main>;
}

export default function JobDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isCandidate = role === 'CANDIDATE';
  const [showApply, setShowApply] = useState(false);
  const [notice, setNotice] = useState('');
  const resource = useApiResource(useCallback(async () => {
    const job = await getPublicJob(id);
    const applications = job && isCandidate && !isPublicJobsMockMode ? await applicationApi.mine({ job_id: id, limit: 20 }) : { items: [] };
    return { job, application: applications.items?.[0] || null };
  }, [id, isCandidate]));
  const { job, application } = resource.data || {};
  const responsibilities = Array.isArray(job?.responsibilities) ? job.responsibilities.filter(Boolean) : [];
  const requirements = job?.requirements || {};
  const experienceStatus = requirements.experience?.status;
  const educationStatus = requirements.education?.status;
  const projectStatus = requirements.project?.status;
  const hasKnownRequirements = [experienceStatus, educationStatus, projectStatus]
    .some(status => status && status !== 'UNAVAILABLE');
  const requiredSkills = job?.requiredSkills || job?.required_skills || [];
  const optionalSkills = job?.optionalSkills || job?.optional_skills || [];
  const hasRequirements = Boolean(requirements.general?.length || hasKnownRequirements);
  const hasSkills = Boolean(requiredSkills.length || optionalSkills.length);
  const deadline = dateLabel(job?.deadline);
  const canApply = deadlineIsOpen(job);

  if (resource.loading) return <LoadingDetail />;
  if (resource.error) return <DetailError error={resource.error} retry={resource.reload} />;
  if (!job) return <DetailError error={{ status: 404 }} retry={resource.reload} />;

  return <main className="min-h-screen bg-[#CDEAF4] px-4 py-6 text-[#334155] sm:px-6 sm:py-9">
    <div className="mx-auto max-w-[1240px] rounded-[22px] border border-white/75 bg-white/90 p-3 shadow-[0_12px_40px_rgba(30,110,145,0.10)] sm:p-5 lg:p-6">
      <div className="space-y-5">
      <nav aria-label="Điều hướng" className="flex items-center gap-2 text-sm text-[#64748B]"><Link to="/jobs" className="font-semibold text-[#078FBF] hover:underline">Việc làm</Link><span aria-hidden="true">/</span><span>Chi tiết</span></nav>
      {isPublicJobsMockMode && <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Đây là tin minh họa trong chế độ phát triển. Chức năng nộp hồ sơ chỉ hoạt động với tin từ API.</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <header className="rounded-[17px] border border-[#E5F3F8] bg-[#F8FDFF] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4"><div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#E4F7FE] text-[#079DD7] sm:flex"><BriefcaseBusiness size={25} aria-hidden="true" /></div>
            <div className="min-w-0"><p className="mb-1 text-sm font-semibold text-[#078FBF]">{job.company?.name || job.company_name || 'Cơ hội nghề nghiệp'}</p><h1 className="break-words text-2xl font-bold leading-tight text-[#17243B] sm:text-3xl">{job.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#64748B]">
                {job.industry && <span className="inline-flex items-center gap-1.5"><Building2 size={15} />{job.industry}</span>}
                {job.seniority && <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness size={15} />{seniorityLabels[job.seniority] || job.seniority}</span>}
                {deadline && <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />Hạn nộp {deadline}</span>}
              </div>
            </div>
          </div>
          <span className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${canApply ? 'bg-[#E1F9F1] text-[#078B68]' : 'bg-amber-50 text-amber-800'}`}>{canApply ? 'Đang tuyển' : 'Đã hết hạn'}</span>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(285px,0.95fr)] lg:gap-6">
        <div className="space-y-4">
          {job.description?.trim() && <Section title="Mô tả công việc" icon={FileText}><p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-[#42566B]">{job.description}</p></Section>}
          {responsibilities.length > 0 && <Section title="Trách nhiệm chính" icon={ListChecks}><ul className="space-y-3">{responsibilities.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 text-[14px] leading-6 text-[#42566B]"><Check size={17} className="mt-1 shrink-0 text-[#12A8D8]" aria-hidden="true" /><span className="whitespace-pre-wrap">{item}</span></li>)}</ul></Section>}
          {hasRequirements && <Section title="Yêu cầu ứng viên" icon={ClipboardList}>
            {requirements.general?.length > 0 && <ul className="space-y-2.5 text-[14px] leading-6 text-[#42566B]">{requirements.general.map((item, index) => <li key={`${index}-${item}`} className="flex gap-2.5"><Check size={16} className="mt-1 shrink-0 text-[#12A8D8]" aria-hidden="true" /><span>{item}</span></li>)}</ul>}
            {hasKnownRequirements && <dl className={`grid gap-3 sm:grid-cols-2 ${requirements.general?.length ? 'mt-5 border-t border-[#EAF2F5] pt-4' : ''}`}>
              {experienceStatus && experienceStatus !== 'UNAVAILABLE' && <div className="rounded-xl bg-[#F8FDFF] p-3.5"><dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#628095]"><BriefcaseBusiness size={15} className="text-[#12A8D8]" />Kinh nghiệm</dt><dd className="mt-2 text-sm font-semibold text-[#17243B]">{experienceStatus === 'REQUIRED' ? `Tối thiểu ${requirements.experience.required_months} tháng` : 'Không yêu cầu tối thiểu'}</dd></div>}
              {educationStatus && educationStatus !== 'UNAVAILABLE' && <div className="rounded-xl bg-[#F8FDFF] p-3.5"><dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#628095]"><GraduationCap size={15} className="text-[#12A8D8]" />Học vấn</dt><dd className="mt-2 text-sm font-semibold text-[#17243B]">{educationStatus === 'REQUIRED' ? (degreeLabels[requirements.education.minimum_degree] || requirements.education.minimum_degree) : 'Không yêu cầu tối thiểu'}</dd></div>}
              {projectStatus && projectStatus !== 'UNAVAILABLE' && <div className="rounded-xl bg-[#F8FDFF] p-3.5"><dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#628095]"><FolderKanban size={15} className="text-[#12A8D8]" />Dự án</dt><dd className="mt-2 text-sm font-semibold text-[#17243B]">{projectStatus === 'REQUIRED' ? (requirements.project.required_technologies || []).join(', ') : 'Không yêu cầu dự án'}</dd></div>}
            </dl>}
          </Section>}
          {hasSkills && <Section title="Kỹ năng" icon={FileCheck2}>
            {requiredSkills.length > 0 && <div><h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#628095]">Bắt buộc</h3><div className="flex flex-wrap gap-2">{requiredSkills.map(skill => <span key={`required-${skill}`} className="rounded-full border border-[#D7F0FA] bg-[#E8F7FD] px-3 py-1.5 text-sm font-semibold text-[#078FBF]">{skill}</span>)}</div></div>}
            {optionalSkills.length > 0 && <div className={requiredSkills.length ? 'mt-4 border-t border-[#EAF2F5] pt-4' : ''}><h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#628095]">Ưu tiên</h3><div className="flex flex-wrap gap-2">{optionalSkills.map(skill => <span key={`optional-${skill}`} className="rounded-full border border-[#E5F3F8] bg-[#F8FDFF] px-3 py-1.5 text-sm text-[#527488]">{skill}</span>)}</div></div>}
          </Section>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="rounded-[17px] border border-[#E5F3F8] bg-[#F8FDFF] p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#17243B]"><BriefcaseBusiness size={18} className="text-[#12A8D8]" />Tóm tắt công việc</h2>
            <dl className="mt-4 divide-y divide-[#E5F0F4] text-sm">
              {job.industry && <div className="flex items-center justify-between gap-3 py-3"><dt className="inline-flex items-center gap-2 text-[#64748B]"><Building2 size={15} className="text-[#12A8D8]" />Ngành nghề</dt><dd className="text-right font-semibold text-[#17243B]">{job.industry}</dd></div>}
              {job.seniority && <div className="flex items-center justify-between gap-3 py-3"><dt className="inline-flex items-center gap-2 text-[#64748B]"><BriefcaseBusiness size={15} className="text-[#12A8D8]" />Cấp độ</dt><dd className="text-right font-semibold text-[#17243B]">{seniorityLabels[job.seniority] || job.seniority}</dd></div>}
              <div className="flex items-center justify-between gap-3 py-3"><dt className="inline-flex items-center gap-2 text-[#64748B]"><CalendarDays size={15} className="text-[#12A8D8]" />Hạn nộp</dt><dd className="text-right font-semibold text-[#17243B]">{deadline || 'Chưa có thông tin'}</dd></div>
            </dl>
            {application ? <div className="mt-4 space-y-4 border-t border-[#E5F0F4] pt-4"><p className="text-sm font-semibold text-[#17243B]">Hồ sơ của bạn: {stageLabels[application.current_stage] || application.current_stage}</p><ApplicationTimeline application={application} /><WithdrawButton application={application} onChanged={resource.reload} /></div>
              : isPublicJobsMockMode ? <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-[#64748B]">Ứng tuyển khả dụng khi dùng tin tuyển dụng thật từ API.</p>
                : isCandidate ? <><button type="button" disabled={!canApply} onClick={() => setShowApply(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#12B5EC] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#079DD7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-300"><Send size={17} />Nộp hồ sơ ứng tuyển</button>{!canApply && <p className="mt-2 text-sm text-[#64748B]">Tin đã hết hạn nhận hồ sơ.</p>}</>
                  : !user ? <div className="mt-5 space-y-3"><Link className="block rounded-lg bg-[#12B5EC] px-4 py-3 text-center font-semibold text-white hover:bg-[#079DD7]" to="/login" state={{ from: `${location.pathname}${location.search}` }}>Đăng nhập để ứng tuyển</Link><Link className="block text-center text-sm font-semibold text-[#078FBF] hover:underline" to="/register">Đăng ký tài khoản ứng viên</Link></div>
                    : <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-[#64748B]">Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.</p>}
          </section>
          {job.company && <section className="rounded-[17px] border border-[#E5F3F8] bg-[#F8FDFF] p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-[#17243B]"><Building2 size={19} className="text-[#12A8D8]" />Thông tin công ty</h2>
            <p className="mt-4 font-semibold text-[#17243B]">{job.company.name}</p>{job.company.industry && <p className="mt-1 text-sm text-[#64748B]">{job.company.industry}</p>}
            {job.company.website && /^https?:\/\//i.test(job.company.website) && <a href={job.company.website} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#078FBF] hover:underline">Website công ty <ExternalLink size={14} /></a>}
          </section>}
        </aside>
      </div>
      </div>
    </div>
    {showApply && <ApplyModal job={job} onClose={() => setShowApply(false)} onRefresh={resource.reload} onSubmitted={() => { setShowApply(false); setNotice('Đã nộp hồ sơ thành công. Bạn có thể theo dõi tiến trình tại đây.'); toast.success('Đã nộp hồ sơ.'); resource.reload(); }} />}
  </main>;
}
