import { publicJobFixtures } from '../mocks/publicJobs';
import { filterSortAndPageJobs, findOpenJob, normalizeJob } from './publicJobsModel';
import { jobApi } from '../api/jobApplicationApi';

// Fixtures are explicit development-only behavior. Live mode calls TV2's public API.
const developmentFixturesEnabled = import.meta.env.DEV && import.meta.env.VITE_PUBLIC_JOBS_MODE !== 'api';
export const isPublicJobsMockMode = developmentFixturesEnabled;

function filterLiveJobs(jobs, { search = '', industry = '', seniority = '', sort = 'newest' }) {
  const query = search.trim().toLowerCase();
  return jobs.map(job => ({ ...job, ...normalizeJob(job) }))
    .filter(job => job.status === 'OPEN')
    .filter(job => !query || [job.title, job.company?.name, job.industry, ...(job.requiredSkills || [])].join(' ').toLowerCase().includes(query))
    .filter(job => !industry || job.industry === industry)
    .filter(job => !seniority || job.seniority === seniority)
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function listPublicJobs({ search = '', industry = '', seniority = '', sort = 'newest', page = 1, pageSize = 6, bookmark } = {}) {
  if (developmentFixturesEnabled) return filterSortAndPageJobs(publicJobFixtures, { search, industry, seniority, sort, page, pageSize });
  const response = await jobApi.publicList({ limit: 50, ...(bookmark ? { bookmark } : {}) });
  const jobs = filterLiveJobs(response.items || [], { search, industry, seniority, sort });
  return { jobs, total: jobs.length, nextPage: response.has_more ? response.bookmark : null, has_more: response.has_more, bookmark: response.bookmark };
}

export async function getPublicJob(id) {
  if (developmentFixturesEnabled) return findOpenJob(publicJobFixtures, id);
  const job = await jobApi.publicDetail(id);
  return job?.status === 'OPEN' ? { ...job, ...normalizeJob(job) } : null;
}
