import { publicJobFixtures } from '../mocks/publicJobs';
import { filterSortAndPageJobs, findOpenJob, normalizeJob } from './publicJobsModel';
import { jobApi } from '../api/jobApplicationApi';

// Fixtures are explicit development-only behavior. Live mode calls TV2's public API.
const developmentFixturesEnabled = import.meta.env.DEV && import.meta.env.VITE_PUBLIC_JOBS_MODE === 'fixtures';
export const isPublicJobsMockMode = developmentFixturesEnabled;

export async function listPublicJobs({ search = '', skills = '', industry = '', seniority = '', location = '', work_mode = '', sort = 'newest', page = 1, pageSize = 12, bookmark, signal } = {}) {
  if (developmentFixturesEnabled) return filterSortAndPageJobs(publicJobFixtures, { search, skills, industry, seniority, sort, page, pageSize });
  const response = await jobApi.publicList({ limit: pageSize, q: search, skills, industry, ...(location ? { location } : {}), ...(work_mode ? { work_mode } : {}), ...(seniority ? { seniority } : {}), ...(bookmark ? { bookmark } : {}) }, { signal });
  return {
    jobs: (response.items || []).map(normalizeJob),
    total: null,
    nextPage: response.has_more ? response.bookmark : null,
    has_more: response.has_more,
    bookmark: response.bookmark,
  };
}

export async function getPublicJob(id) {
  if (developmentFixturesEnabled) return findOpenJob(publicJobFixtures, id);
  const job = await jobApi.publicDetail(id);
  return job?.status === 'OPEN' ? { ...job, ...normalizeJob(job) } : null;
}
