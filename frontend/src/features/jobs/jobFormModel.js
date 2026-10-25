export const emptyJobForm = {
  employment_type: '', salary_type: '', salary_min: '', salary_max: '', salary_currency: 'VND',
  location: '', work_mode: '', title: '', seniority: 'JUNIOR', industry: '', description: '', responsibilities: '', general: '', required_skills: '', optional_skills: '',
  status: 'DRAFT', deadline: '', experience_status: 'NO_MINIMUM', required_months: '', education_status: 'NO_MINIMUM', minimum_degree: 'BACHELOR',
  project_status: 'NO_REQUIREMENT', required_technologies: '',
};
const lines = value => value.split('\n').map(item => item.trim()).filter(Boolean);
const skills = value => value.split(',').map(item => item.trim()).filter(Boolean);
export const toVietnamInput = iso => iso ? new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16) : '';
export function fromJob(job) {
  if (!job) return { ...emptyJobForm };
  return { ...emptyJobForm, location: job.location || '', work_mode: job.work_mode || '', title: job.title, seniority: job.seniority, industry: job.industry, description: job.description,
    employment_type: job.employment_type || '', salary_type: job.salary?.type || '', salary_min: job.salary?.min ?? '', salary_max: job.salary?.max ?? '', salary_currency: job.salary?.currency || 'VND',
    responsibilities: job.responsibilities.join('\n'), general: job.requirements.general.join('\n'),
    required_skills: job.required_skills.join(', '), optional_skills: job.optional_skills.join(', '), status: job.status,
    deadline: toVietnamInput(job.deadline), experience_status: job.requirements.experience.status,
    required_months: job.requirements.experience.required_months || '', education_status: job.requirements.education.status,
    minimum_degree: job.requirements.education.minimum_degree || 'BACHELOR', project_status: job.requirements.project.status,
    required_technologies: (job.requirements.project.required_technologies || []).join(', '),
  };
}
export function validateJobForm(form) {
  const errors = {};
  if (form.salary_type === 'RANGE' && (!Number.isFinite(Number(form.salary_min)) || Number(form.salary_min) <= 0)) errors.salary_min = 'Nhập mức lương tối thiểu lớn hơn 0.';
  if (form.salary_type === 'RANGE' && (!Number.isFinite(Number(form.salary_max)) || Number(form.salary_max) < Number(form.salary_min) || Number(form.salary_max) <= 0)) errors.salary_max = 'Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.';
  for (const name of ['title', 'industry', 'description', 'required_skills']) if (!form[name].trim()) errors[name] = 'Vui lòng nhập thông tin này.';
  if (form.status === 'OPEN' && !form.deadline) errors.deadline = 'Tin đang tuyển cần hạn nộp hồ sơ.';
  if (form.experience_status === 'REQUIRED' && (!Number.isInteger(Number(form.required_months)) || Number(form.required_months) < 1)) errors.required_months = 'Nhập số tháng nguyên dương.';
  if (form.project_status === 'REQUIRED' && !skills(form.required_technologies).length) errors.required_technologies = 'Nhập ít nhất một công nghệ.';
  return errors;
}
export function jobErrorsFromApi(details = []) {
  const paths = { 'requirements.general': 'general', 'requirements.experience.status': 'experience_status',
    'requirements.experience.required_months': 'required_months', 'requirements.education.status': 'education_status',
    'requirements.education.minimum_degree': 'minimum_degree', 'requirements.project.status': 'project_status',
    'requirements.project.required_technologies': 'required_technologies' };
  return Object.fromEntries(details.map(issue => {
    const path = Object.keys(paths).find(key => issue.field === key || issue.field.startsWith(`${key}.`));
    return [path ? paths[path] : issue.field.split('.')[0], issue.message];
  }));
}
export function jobPayload(form, job) {
  const payload = { ...(form.location ? { location: form.location } : {}), ...(form.work_mode ? { work_mode: form.work_mode } : {}), title: form.title, seniority: form.seniority, industry: form.industry, description: form.description,
    ...(form.employment_type ? { employment_type: form.employment_type } : {}),
    ...(form.salary_type ? { salary: form.salary_type === 'NEGOTIABLE' ? { type: 'NEGOTIABLE' } : { type: 'RANGE', min: Number(form.salary_min), max: Number(form.salary_max), currency: form.salary_currency, period: 'MONTH' } } : {}),
    responsibilities: lines(form.responsibilities), required_skills: skills(form.required_skills), optional_skills: skills(form.optional_skills),
    requirements: { general: lines(form.general),
      experience: { status: form.experience_status, ...(form.experience_status === 'REQUIRED' ? { required_months: Number(form.required_months) } : {}) },
      education: { status: form.education_status, ...(form.education_status === 'REQUIRED' ? { minimum_degree: form.minimum_degree } : {}) },
      project: { status: form.project_status, ...(form.project_status === 'REQUIRED' ? { required_technologies: skills(form.required_technologies) } : {}) },
    }, ...(form.deadline ? { deadline: job && form.deadline === toVietnamInput(job.deadline)
      ? job.deadline : new Date(`${form.deadline}:00+07:00`).toISOString() } : {}),
  };
  return job ? { ...payload, ...(job.location && !form.location ? { location: null } : {}),
    ...(job.work_mode && !form.work_mode ? { work_mode: null } : {}),
    ...(job.employment_type && !form.employment_type ? { employment_type: null } : {}),
    ...(job.salary && !form.salary_type ? { salary: null } : {}), expected_rev: job._rev } : { ...payload, status: form.status };
}
