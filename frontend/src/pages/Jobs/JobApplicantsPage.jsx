import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationApi } from '../../api/jobApplicationApi';
import { formatDate } from '../../features/applications/applicationPresentation';
import { Button, Page, Pagination, Resource, StageBadge, StageFilter } from '../../features/applications/components/ApplicationUI';
import ApplicantDetailModal from '../../features/applications/components/ApplicantDetailModal';
import { useApiResource, useBookmarkPage } from '../../features/applications/useApiResource';

export default function JobApplicantsPage() {
  const { id } = useParams();
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState(null);
  const pager = useBookmarkPage();
  const { bookmark } = pager;
  const resource = useApiResource(useCallback(() => applicationApi.applicants(id, { bookmark, limit: 20, ...(stage ? { stage } : {}) }), [id, bookmark, stage]));
  return <Page title="Hồ sơ ứng viên" subtitle={resource.data?.job.title}
    action={<Link to="/recruiter/dashboard" className="text-sm font-semibold text-indigo-700">Về quản lý tuyển dụng</Link>}>
    <StageFilter value={stage} onChange={value => { setStage(value); pager.reset(); }} />
    <Resource resource={resource} empty={!resource.data?.items.length} emptyMessage="Chưa có ứng viên ở trạng thái này.">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>
        {['Ứng viên', 'Ngày nộp', 'Kỹ năng', 'Trạng thái', 'Thao tác'].map(label => <th key={label} className="p-4 font-semibold">{label}</th>)}
      </tr></thead><tbody>{resource.data?.items.map(application => <tr key={application._id} className="border-t border-slate-100">
        <td className="p-4"><p className="font-semibold text-slate-800">{application.candidate.profile.full_name || 'Chưa cung cấp họ tên'}</p><p className="text-xs text-slate-500">{application.email}</p>
          <p className="mt-1 text-xs">{application.candidate.profile.years_experience} năm kinh nghiệm</p></td>
        <td className="p-4 text-slate-600">{formatDate(application.applied_at)}</td>
        <td className="max-w-xs p-4 text-slate-600">{application.candidate.skills.map(skill => skill.name).join(', ') || 'Chưa cung cấp'}</td>
        <td className="p-4"><StageBadge stage={application.current_stage} /></td>
        <td className="p-4"><Button secondary onClick={() => setSelected(application._id)}>Xem CV và xử lý</Button></td>
      </tr>)}</tbody></table></div>
    </Resource><Pagination pager={pager} data={resource.data} loading={resource.loading} />
    {selected && <ApplicantDetailModal id={selected} onClose={() => setSelected(null)} onChanged={resource.reload} />}
  </Page>;
}
