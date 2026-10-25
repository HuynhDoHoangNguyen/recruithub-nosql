import { useState } from 'react';
import { Banknote, BriefcaseBusiness, FileText, Settings2, Sparkles, Wrench } from 'lucide-react';
import { useJobMetadata } from '../useJobMetadata';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { jobApi } from '../../../api/jobApplicationApi';
import { Button, ErrorMessage, Field } from '../../applications/components/ApplicationUI';
import { fromJob, jobErrorsFromApi, jobPayload, validateJobForm } from '../jobFormModel';

const inputClass = 'input-field mt-1';
const statusOptions = [['REQUIRED', 'Có yêu cầu tối thiểu'], ['NO_MINIMUM', 'Không yêu cầu tối thiểu'], ['UNAVAILABLE', 'Chưa có thông tin']];

export default function JobForm({ job, organization, onSaved, onConflict }) {
  const metadata = useJobMetadata();
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
  return <form onSubmit={submit} className="relative overflow-hidden w-full bg-white p-6 sm:p-10 rounded-3xl border border-blue-200 shadow-lg shadow-blue-900/5 space-y-8" noValidate>
    <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400" />
    <header className="border-b border-slate-100 pb-5"><span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Dành cho Nhà tuyển dụng</span>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{job ? 'Chỉnh Sửa Tin Tuyển Dụng IT' : 'Đăng Tin Tuyển Dụng IT Mới'}</h1>
      <p className="text-sm text-slate-500 mt-2">Thông tin vị trí, yêu cầu và thời hạn được sử dụng để tiếp nhận, đánh giá hồ sơ.</p></header>
    <ErrorMessage error={error} />
    {job?.status === 'CLOSED' && <p className="mb-4 text-slate-600">Tin đã đóng. Các hồ sơ và lịch sử vẫn được giữ lại.</p>}
    <fieldset disabled={busy || job?.status === 'CLOSED'} className="space-y-5 disabled:opacity-60">
      <section className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/20 p-5"><h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-blue-600" aria-hidden="true" />THÔNG TIN VỊ TRÍ</h2><div className="grid sm:grid-cols-2 gap-5"><Field label="Tiêu đề công việc *" name="title" error={errors.title}><input {...props('title')} placeholder="VD: Senior Frontend Engineer" maxLength={200} required /></Field>
        <Field label="Doanh nghiệp / Công ty" name="company"><input id="company" className={inputClass} value={organization?.company?.name || 'Chưa tải được thông tin công ty'} readOnly /></Field>
        <Field label="Phòng ban" name="department"><input id="department" className={inputClass} value={organization?.department?.name || 'Chưa tải được thông tin phòng ban'} readOnly /></Field>
        <Field label="Ngành nghề *" name="industry" error={errors.industry}><input {...props('industry')} maxLength={120} required /></Field>
        <Field label="Địa điểm làm việc" name="location" error={errors.location}><select {...props('location')} disabled={metadata.loading || !!metadata.error}><option value="">{metadata.loading ? 'Đang tải danh mục…' : 'Chưa cập nhật'}</option>{metadata.data?.locations.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        <Field label="Hình thức làm việc" name="work_mode" error={errors.work_mode}><select {...props('work_mode')} disabled={metadata.loading || !!metadata.error}><option value="">{metadata.loading ? 'Đang tải danh mục…' : 'Chưa cập nhật'}</option>{metadata.data?.work_modes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        {metadata.error && <p role="alert" className="text-sm text-red-600">Không tải được danh mục địa điểm / hình thức. Vui lòng tải lại.</p>}
      </div></section>
      <section className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 p-5"><h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Banknote className="h-5 w-5 text-emerald-600" aria-hidden="true" />MỨC LƯƠNG</h2>
        <div className="grid sm:grid-cols-2 gap-5"><Field label="Thông tin mức lương" name="salary_type" error={errors.salary}><select {...props('salary_type')}><option value="">Chưa cập nhật</option><option value="NEGOTIABLE">Thỏa thuận</option><option value="RANGE">Khoảng lương theo tháng</option></select></Field>
          {form.salary_type === 'RANGE' && <Field label="Đơn vị tiền tệ" name="salary_currency"><select {...props('salary_currency')}><option value="VND">VND — Việt Nam đồng</option><option value="USD">USD — Đô la Mỹ</option></select></Field>}
          {form.salary_type === 'RANGE' && <><Field label="Lương tối thiểu / tháng" name="salary_min" error={errors.salary_min || errors.salary}><input {...props('salary_min')} type="number" min="1" max="1000000000000" step="any" required placeholder="VD: 15000000" /></Field><Field label="Lương tối đa / tháng" name="salary_max" error={errors.salary_max}><input {...props('salary_max')} type="number" min="1" max="1000000000000" step="any" required placeholder="VD: 25000000" /></Field></>}
        </div>
      </section>
      <section className="space-y-5 border-t border-slate-100 pt-8"><h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" aria-hidden="true" />MÔ TẢ CÔNG VIỆC & YÊU CẦU</h2>
      <Field label="Mô tả công việc *" name="description" error={errors.description}><textarea rows={5} {...props('description')} maxLength={20000} required /></Field>
      <div className="grid sm:grid-cols-2 gap-5"><Field label="Trách nhiệm (mỗi dòng một mục)" name="responsibilities" error={errors.responsibilities}><textarea rows={4} {...props('responsibilities')} /></Field>
        <Field label="Yêu cầu chung (mỗi dòng một mục)" name="general" error={errors.general || errors.requirements}><textarea rows={4} {...props('general')} /></Field>
      </div></section>
      <section className="space-y-5 border-t border-slate-100 pt-8"><h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Wrench className="h-5 w-5 text-indigo-600" aria-hidden="true" />KỸ NĂNG & CHUYÊN MÔN</h2><div className="grid sm:grid-cols-2 gap-5">
        <Field label="Kỹ năng bắt buộc * (phân cách bằng dấu phẩy)" name="required_skills" error={errors.required_skills}><input {...props('required_skills')} required /></Field>
        <Field label="Kỹ năng ưu tiên (phân cách bằng dấu phẩy)" name="optional_skills" error={errors.optional_skills}><input {...props('optional_skills')} /></Field>
      </div></section>
      <section className="grid gap-5 rounded-2xl bg-slate-50 p-5 md:grid-cols-3">
        <div className="space-y-3"><Field label="Kinh nghiệm" name="experience_status" error={errors.experience_status}><select {...props('experience_status')}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          {form.experience_status === 'REQUIRED' && <Field label="Số tháng tối thiểu" name="required_months" error={errors.required_months}><input {...props('required_months')} type="number" min="1" step="1" /></Field>}</div>
        <div className="space-y-3"><Field label="Học vấn" name="education_status" error={errors.education_status}><select {...props('education_status')}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          {form.education_status === 'REQUIRED' && <Field label="Bằng cấp tối thiểu" name="minimum_degree" error={errors.minimum_degree}><select {...props('minimum_degree')}><option value="HIGH_SCHOOL">Trung học</option><option value="BACHELOR">Cử nhân</option><option value="MASTER">Thạc sĩ</option><option value="DOCTORATE">Tiến sĩ</option></select></Field>}</div>
        <div className="space-y-3"><Field label="Dự án" name="project_status" error={errors.project_status}><select {...props('project_status')}><option value="REQUIRED">Có yêu cầu công nghệ</option><option value="NO_REQUIREMENT">Không yêu cầu dự án</option><option value="UNAVAILABLE">Chưa có thông tin</option></select></Field>
          {form.project_status === 'REQUIRED' && <Field label="Công nghệ (phân cách bằng dấu phẩy)" name="required_technologies" error={errors.required_technologies}><input {...props('required_technologies')} /></Field>}</div>
      </section>
      <section className="space-y-5 rounded-2xl border border-indigo-100 bg-indigo-50/20 p-5"><h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Settings2 className="h-5 w-5 text-indigo-600" aria-hidden="true" />THIẾT LẬP TIN TUYỂN DỤNG</h2><div className="grid sm:grid-cols-2 gap-5">
        <Field label="Cấp bậc" name="seniority"><select {...props('seniority')}><option value="INTERN">Intern</option><option value="FRESHER">Fresher</option><option value="JUNIOR">Junior</option><option value="SENIOR">Senior</option>{job?.seniority === 'MID' && <option value="MID">Mid-level (tin đã có)</option>}</select></Field>
        <Field label="Loại hình làm việc" name="employment_type" error={errors.employment_type}><select {...props('employment_type')} disabled={metadata.loading || !!metadata.error}><option value="">Chưa cập nhật</option>{metadata.data?.employment_types?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        {!job && <Field label="Trạng thái" name="status"><select {...props('status')}><option value="DRAFT">Lưu nháp</option><option value="OPEN">Đăng tuyển ngay</option></select></Field>}
        <Field label="Hạn nộp (giờ Việt Nam, UTC+7)" name="deadline" error={errors.deadline}><input type="datetime-local" {...props('deadline')} required={form.status === 'OPEN'} /></Field>
      </div></section>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6"><Link to="/recruiter/dashboard" className="btn-secondary">Hủy bỏ</Link><Button type="submit" className="inline-flex gap-2 items-center"><Sparkles className="h-4 w-4" aria-hidden="true" />{busy ? 'Đang lưu…' : job ? 'Lưu thay đổi' : 'Tạo tin tuyển dụng'}</Button></div>
    </fieldset>
  </form>;
}
