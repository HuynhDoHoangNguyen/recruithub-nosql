export function normalizeJob(job) {
  return {
    id: job.id || job._id,
    title: job.title,
    company: typeof job.company === 'string' ? { name: job.company } : job.company || (job.company_name ? { name: job.company_name } : null),
    seniority: job.seniority,
    industry: job.industry,
    description: job.description,
    responsibilities: job.responsibilities || [],
    requiredSkills: job.requiredSkills || job.required_skills || [],
    optionalSkills: job.optionalSkills || job.optional_skills || [],
    deadline: job.deadline || null,
    createdAt: job.createdAt || job.created_at || null,
    status: job.status,
  };
}

export function filterSortAndPageJobs(jobs, { search = '', skills = '', industry = '', seniority = '', sort = 'newest', page = 1, pageSize = 12 } = {}) {
  const query = search.trim().toLowerCase();
  const requiredSkills = (Array.isArray(skills) ? skills : skills.split(','))
    .map(skill => skill.trim().toLowerCase()).filter(Boolean);
  const filtered = jobs.map(normalizeJob).filter((job) => job.status === 'OPEN')
    .filter((job) => !query || [job.title, job.industry, job.description, ...job.responsibilities, ...job.requiredSkills, ...job.optionalSkills].join(' ').toLowerCase().includes(query))
    .filter((job) => requiredSkills.every(skill => [...job.requiredSkills, ...job.optionalSkills].some(value => value.trim().toLowerCase() === skill)))
    .filter((job) => !industry || job.industry === industry)
    .filter((job) => !seniority || job.seniority === seniority)
    .sort((left, right) => sort === 'title' ? left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
      : String(right.createdAt || '').localeCompare(String(left.createdAt || '')) || left.id.localeCompare(right.id));
  const start = (page - 1) * pageSize;
  return { jobs: filtered.slice(start, start + pageSize), total: filtered.length, nextPage: start + pageSize < filtered.length ? page + 1 : null };
}

export function findOpenJob(jobs, id) {
  return jobs.map(normalizeJob).find((job) => job.id === id && job.status === 'OPEN') || null;
}
