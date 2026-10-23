import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaBriefcase, FaCheckCircle } from 'react-icons/fa';
import { getPublicJob, isPublicJobsMockMode } from '../../services/publicJobsApi';
import { useAuth } from '../../context/useAuth';

const JobDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicJob(id)
      .then((data) => { if (active) setJob(data); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được tin tuyển dụng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div role="status" className="min-h-screen flex items-center justify-center text-blue-700">Đang tải chi tiết việc làm…</div>;
  if (error) return <main className="mx-auto max-w-4xl p-6"><div role="alert" className="message-error">{error}</div><Link className="mt-4 inline-block text-blue-700 underline" to="/jobs">Quay lại danh sách</Link></main>;
  if (!job) return <main className="mx-auto max-w-4xl p-6 text-center"><p className="text-gray-600">Không tìm thấy tin tuyển dụng đang mở.</p><Link className="mt-4 inline-block text-blue-700 underline" to="/jobs">Quay lại danh sách</Link></main>;

  return (
    <main className="min-h-screen bg-blue-50 p-4 sm:p-6">
      <article className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-md sm:p-8">
        {isPublicJobsMockMode && <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Dữ liệu fixture phát triển · API công khai do TV2 cung cấp đang chờ tích hợp.</div>}
        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">{job.status}</span>
        <h1 className="mt-4 text-3xl font-bold text-blue-800">{job.title}</h1>
        <p className="mt-2 flex items-center gap-2 text-gray-600"><FaBriefcase aria-hidden="true" />{job.company.name} · {job.industry}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600"><span>{job.seniority}</span><span>Hạn ứng tuyển: {job.deadline ? new Date(job.deadline).toLocaleDateString('vi-VN') : 'Chưa có thông tin'}</span></div>
        <hr className="my-6" />
        <section><h2 className="text-xl font-semibold text-blue-700">Mô tả công việc</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-gray-700">{job.description}</p></section>
        <section className="mt-6"><h2 className="text-xl font-semibold text-blue-700">Trách nhiệm</h2><ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700">{job.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="mt-6"><h2 className="text-xl font-semibold text-blue-700">Kỹ năng yêu cầu</h2><div className="mt-3 flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <span key={skill} className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">{skill}</span>)}</div></section>
        <section className="mt-6"><h2 className="text-xl font-semibold text-blue-700">Kỹ năng ưu tiên</h2><div className="mt-3 flex flex-wrap gap-2">{job.optionalSkills.length ? job.optionalSkills.map((skill) => <span key={skill} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{skill}</span>) : <p className="text-gray-500">Không có thông tin.</p>}</div></section>
        <div className="mt-8 rounded-lg bg-blue-50 p-4">
          <div className="flex items-start gap-3"><FaCheckCircle className="mt-1 text-blue-700" aria-hidden="true" /><div><p className="font-semibold text-gray-900">Nộp hồ sơ</p>{user?.role === 'CANDIDATE' ? <p className="mt-1 text-sm text-gray-700">Luồng ứng tuyển do TV2 phát triển và chưa được tích hợp vào cổng công khai.</p> : user ? <p className="mt-1 text-sm text-gray-700">Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.</p> : <p className="mt-1 text-sm text-gray-700">Đăng nhập hoặc tạo tài khoản ứng viên để tiếp tục khi luồng ứng tuyển sẵn sàng.</p>}</div></div>
          {!user && <div className="mt-4 flex gap-3"><Link className="btn-primary" to="/login">Đăng nhập</Link><Link className="btn-secondary" to="/register">Đăng ký ứng viên</Link></div>}
        </div>
        <Link className="mt-6 inline-block text-blue-700 underline" to="/jobs">Quay lại danh sách việc làm</Link>
      </article>
    </main>
  );
};

export default JobDetails;
