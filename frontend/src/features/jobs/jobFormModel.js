export const emptyJobForm = {
  title: '', seniority: 'JUNIOR', industry: '', description: '', responsibilities: '', general: '', required_skills: '', optional_skills: '',
  status: 'DRAFT', deadline: '', experience_status: 'NO_MINIMUM', required_months: '', education_status: 'NO_MINIMUM', minimum_degree: 'BACHELOR',
  project_status: 'NO_REQUIREMENT', required_technologies: '',
};
const lines = value => value.split('\n').map(item => item.trim()).filter(Boolean);
const skills = value => value.split(',').map(item => item.trim()).filter(Boolean);
export const toVietnamInput = iso => iso ? new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16) : '';
export function fromJob(job) {
  if (!job) return { ...emptyJobForm };
  return { ...emptyJobForm, title: job.title, seniority: job.seniority, industry: job.industry, description: job.description,
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
  const payload = { title: form.title, seniority: form.seniority, industry: form.industry, description: form.description,
    responsibilities: lines(form.responsibilities), required_skills: skills(form.required_skills), optional_skills: skills(form.optional_skills),
    requirements: { general: lines(form.general),
      experience: { status: form.experience_status, ...(form.experience_status === 'REQUIRED' ? { required_months: Number(form.required_months) } : {}) },
      education: { status: form.education_status, ...(form.education_status === 'REQUIRED' ? { minimum_degree: form.minimum_degree } : {}) },
      project: { status: form.project_status, ...(form.project_status === 'REQUIRED' ? { required_technologies: skills(form.required_technologies) } : {}) },
    }, ...(form.deadline ? { deadline: new Date(`${form.deadline}:00+07:00`).toISOString() } : {}),
  };
  return job ? { ...payload, expected_rev: job._rev } : { ...payload, status: form.status };
}
