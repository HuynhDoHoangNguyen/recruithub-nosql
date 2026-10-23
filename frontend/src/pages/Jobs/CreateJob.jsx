import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { jobApi } from '../../api/jobApplicationApi';
import JobForm from '../../features/jobs/components/JobForm';
import { Page, Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource } from '../../features/applications/useApiResource';

export default function CreateJob() {
  const { id } = useParams();
  const navigate = useNavigate();
  const resource = useApiResource(useCallback(() => id ? jobApi.detail(id) : Promise.resolve(null), [id]));
  return <Page title={id ? 'Chỉnh sửa tin tuyển dụng' : 'Tạo tin tuyển dụng'} subtitle="Thông tin công ty và phòng ban được lấy từ tài khoản nhà tuyển dụng."
    action={<Link to="/recruiter/dashboard" className="text-sm font-semibold text-indigo-700">Về quản lý tuyển dụng</Link>}>
    <Resource resource={resource}><JobForm key={resource.data?._rev || 'new'} job={resource.data} onConflict={resource.reload}
      onSaved={() => { toast.success('Đã lưu tin tuyển dụng.'); navigate('/recruiter/dashboard'); }} /></Resource>
  </Page>;
}
