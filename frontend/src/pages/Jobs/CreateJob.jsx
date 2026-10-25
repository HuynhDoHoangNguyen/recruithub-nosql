import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { jobApi } from '../../api/jobApplicationApi';
import JobForm from '../../features/jobs/components/JobForm';
import { Resource } from '../../features/applications/components/ApplicationUI';
import { useApiResource } from '../../features/applications/useApiResource';

export default function CreateJob() {
  const { id } = useParams();
  const navigate = useNavigate();
  const resource = useApiResource(useCallback(async () => {
    const [job, organization] = await Promise.all([id ? jobApi.detail(id) : Promise.resolve(null), jobApi.context()]);
    return { job, organization };
  }, [id]));
  return <main className={`min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 ${id ? '' : 'rh-surface-page rh-create-job'}`}><div className="max-w-4xl mx-auto space-y-6">
    <nav aria-label="Đường dẫn" className="flex flex-wrap gap-2 text-xs text-slate-400"><Link to="/">Trang chủ</Link><span>/</span><Link to="/recruiter/dashboard">Bảng điều khiển tuyển dụng</Link><span>/</span><span className="text-slate-800">{id ? 'Chỉnh sửa tin' : 'Đăng tin mới'}</span></nav>
    <Resource resource={resource}><JobForm key={resource.data?.job?._rev || 'new'} job={resource.data?.job} organization={resource.data?.organization} onConflict={resource.reload}
      onSaved={() => { toast.success('Đã lưu tin tuyển dụng.'); navigate('/recruiter/dashboard'); }} /></Resource>
  </div></main>;
}
