import { useState } from 'react';
import { toast } from 'react-toastify';
import { jobApi } from '../../../api/jobApplicationApi';
import { Button, ErrorMessage, Field } from '../../applications/components/ApplicationUI';
import { fromJob, jobErrorsFromApi, jobPayload, validateJobForm } from '../jobFormModel';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:border-indigo-500 focus:outline-indigo-500';
const statusOptions = [['REQUIRED', 'Có yêu cầu tối thiểu'], ['NO_MINIMUM', 'Không yêu cầu tối thiểu'], ['UNAVAILABLE', 'Chưa có thông tin']];

export default function JobForm({ job, onSaved, onConflict }) {
  const [form, setForm] = useState(() => fromJob(job));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const props = name => ({ id: name, name, value: form[name], onChange: change, className: inputClass,
    'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `${name}-error` : undefined });
  async function submit(event) {
    event.preventDefault();
    const validation = validateJobForm(form);
    setErrors(validation); setError(null);
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      const payload = jobPayload(form, job);
      const saved = job ? await jobApi.edit(job._id, payload) : await jobApi.create(payload);
      onSaved(saved);
    } catch (failure) {
      setError(failure);
      setErrors(jobErrorsFromApi(failure.details));
      if (failure.status === 409) { toast.error(failure.message); await onConflict?.(); }
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" noValidate>
    <ErrorMessage error={error} />
    {job?.status === 'CLOSED' && <p className="mb-4 text-slate-600">Tin đã đóng. Các hồ sơ và lịch sử vẫn được giữ lại.</p>}
    <fieldset disabled={busy || job?.status === 'CLOSED'} className="space-y-5 disabled:opacity-60">
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Tiêu đề công việc *" name="title" error={errors.title}><input {...props('title')} maxLength={200} required /></Field>
        <Field label="Ngành nghề *" name="industry" error={errors.industry}><input {...props('industry')} maxLength={120} required /></Field>
        <Field label="Cấp bậc" name="seniority"><select {...props('seniority')}><option value="JUNIOR">Mới bắt đầu</option><option value="MID">Có kinh nghiệm</option><option value="SENIOR">Cao cấp</option></select></Field>
        {!job && <Field label="Trạng thái" name="status"><select {...props('status')}><option value="DRAFT">Lưu nháp</option><option value="OPEN">Đăng tuyển ngay</option></select></Field>}
        <Field label="Hạn nộp (giờ Việt Nam, UTC+7)" name="deadline" error={errors.deadline}><input type="datetime-local" {...props('deadline')} required={form.status === 'OPEN'} /></Field>
      </div>
      <Field label="Mô tả công việc *" name="description" error={errors.description}><textarea rows={5} {...props('description')} maxLength={20000} required /></Field>
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Trách nhiệm (mỗi dòng một mục)" name="responsibilities" error={errors.responsibilities}><textarea rows={4} {...props('responsibilities')} /></Field>
        <Field label="Yêu cầu chung (mỗi dòng một mục)" name="general" error={errors.general || errors.requirements}><textarea rows={4} {...props('general')} /></Field>
        <Field label="Kỹ năng bắt buộc * (phân cách bằng dấu phẩy)" name="required_skills" error={errors.required_skills}><input {...props('required_skills')} required /></Field>
        <Field label="Kỹ năng ưu tiên (phân cách bằng dấu phẩy)" name="optional_skills" error={errors.optional_skills}><input {...props('optional_skills')} /></Field>
      </div>
      <section className="grid gap-5 rounded-xl bg-slate-50 p-4 md:grid-cols-3">
        <div className="space-y-3"><Field label="Kinh nghiệm" name="experience_status" error={errors.experience_status}><select {...props('experience_status')}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          {form.experience_status === 'REQUIRED' && <Field label="Số tháng tối thiểu" name="required_months" error={errors.required_months}><input {...props('required_months')} type="number" min="1" step="1" /></Field>}</div>
        <div className="space-y-3"><Field label="Học vấn" name="education_status" error={errors.education_status}><select {...props('education_status')}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          {form.education_status === 'REQUIRED' && <Field label="Bằng cấp tối thiểu" name="minimum_degree" error={errors.minimum_degree}><select {...props('minimum_degree')}><option value="HIGH_SCHOOL">Trung học</option><option value="BACHELOR">Cử nhân</option><option value="MASTER">Thạc sĩ</option><option value="DOCTORATE">Tiến sĩ</option></select></Field>}</div>
        <div className="space-y-3"><Field label="Dự án" name="project_status" error={errors.project_status}><select {...props('project_status')}><option value="REQUIRED">Có yêu cầu công nghệ</option><option value="NO_REQUIREMENT">Không yêu cầu dự án</option><option value="UNAVAILABLE">Chưa có thông tin</option></select></Field>
          {form.project_status === 'REQUIRED' && <Field label="Công nghệ (phân cách bằng dấu phẩy)" name="required_technologies" error={errors.required_technologies}><input {...props('required_technologies')} /></Field>}</div>
      </section>
      <Button type="submit">{busy ? 'Đang lưu…' : job ? 'Lưu thay đổi' : 'Tạo tin tuyển dụng'}</Button>
    </fieldset>
  </form>;
}
