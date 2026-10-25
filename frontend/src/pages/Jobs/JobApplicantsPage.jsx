import { useCallback, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, FileSearch, MessageSquare, Send, UserCheck, Users, X } from 'lucide-react';
import CompanyLogo from '../../components/CompanyLogo';
import DeleteJobButton from '../../features/jobs/components/DeleteJobButton';
import { applicationApi } from '../../api/jobApplicationApi';
import { formatDate } from '../../features/applications/applicationPresentation';
import { Button, Page, Pagination, Resource, StageBadge, StageFilter } from '../../features/applications/components/ApplicationUI';
import ApplicantDetailModal from '../../features/applications/components/ApplicantDetailModal';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function JobApplicantsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState(null);
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => applicationApi.applicants(id, { bookmark, limit: 20, ...(stage ? { stage } : {}) }), [id, bookmark, stage]));
  return <Page className="rh-surface-page rh-applicants" title="Hồ sơ ứng viên" subtitle={resource.data?.job.title}
    action={<div className="flex flex-wrap items-start gap-2"><Link to="/recruiter/dashboard" className="btn-secondary inline-flex gap-2 items-center text-xs"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Về quản lý tuyển dụng</Link>{resource.data?.job && <DeleteJobButton job={resource.data.job} onDeleted={() => navigate('/recruiter/dashboard')} onConflict={resource.reload} />}</div>}>
    {resource.data?.job && <div className="rh-panel rh-summary-card rounded-2xl border border-blue-100 bg-gradient-to-r from-white to-blue-50/50 p-5 flex items-center gap-4 shadow-sm"><CompanyLogo name={resource.data.job.company_name} src={resource.data.job.company_logo_url} /><div><p className="text-xs text-slate-500 mb-1">{resource.data.job.company_name}</p><h2 className="font-extrabold text-slate-800">{resource.data.job.title}</h2><p className="text-xs text-slate-400 mt-2 flex gap-2 items-center"><Users className="h-4 w-4" aria-hidden="true" />Danh sách ứng viên đã nộp hồ sơ</p></div></div>}
    <StageFilter value={stage} onChange={value => { setStage(value); pager.reset(); }} />
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có ứng viên ở trạng thái này.">
      <div className="rh-applicant-table overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-blue-50/70 text-slate-500"><tr>
        {['Ứng viên', 'Ngày nộp', 'Kỹ năng', 'Trạng thái', 'Thao tác'].map(label => <th key={label} className="p-4 font-semibold">{label}</th>)}
      </tr></thead><tbody>{resource.data?.items.map(application => <tr key={application._id} className="border-t border-gray-100">
        <td className="p-4"><p className="font-semibold text-gray-800">{application.candidate.profile.full_name || 'Chưa cung cấp họ tên'}</p><p className="text-xs text-gray-500">{application.email}</p>
          <p className="mt-1 text-xs">{application.candidate.profile.years_experience} năm kinh nghiệm</p></td>
        <td className="p-4 text-gray-600">{formatDate(application.applied_at)}</td>
        <td className="max-w-xs p-4 text-gray-600">{application.candidate.skills.map(skill => skill.name).join(', ') || 'Chưa cung cấp'}</td>
        <td className="p-4"><StageBadge stage={application.current_stage} /></td>
        <td className="p-4 min-w-[280px]"><div className="flex flex-wrap gap-2"><Button className="rh-review-action inline-flex items-center gap-1.5 !text-xs !px-3 !py-2" id={`applicant-${application._id}`} secondary onClick={() => setSelected({ id: application._id })}><Eye className="h-3.5 w-3.5" aria-hidden="true" />Xem CV và xử lý</Button>{application.allowed_transitions?.map(target => {
          const Icon = { SCREENING: Check, INTERVIEW: MessageSquare, OFFER: Send, HIRED: UserCheck, REJECTED: X }[target] || FileSearch;
          return <button type="button" key={target} disabled={target === 'OFFER' && application.offer_eligible === false} title={target === 'OFFER' ? application.offer_blocker : undefined} className={`rh-workflow-action inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 ${target === 'REJECTED' ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`} onClick={() => setSelected({ id: application._id, target })}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{{ SCREENING: 'Duyệt hồ sơ', INTERVIEW: 'Mời phỏng vấn', OFFER: 'Gửi đề nghị', HIRED: 'Xác nhận tuyển dụng', REJECTED: 'Từ chối' }[target]}</button>;
        })}</div>{application.offer_blocker && <p className="text-xs text-amber-700 mt-2">{application.offer_blocker}</p>}</td>
      </tr>)}</tbody></table></div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading} />
    {selected && <ApplicantDetailModal id={selected.id} initialTarget={selected.target} onClose={() => setSelected(null)} onChanged={resource.reload} />}
  </Page>;
}
