import { publicJobFixtures } from '../mocks/publicJobs';
import { filterSortAndPageJobs, findOpenJob } from './publicJobsModel';

const developmentFixturesEnabled = import.meta.env.DEV && import.meta.env.VITE_PUBLIC_JOBS_MODE !== 'api';

export async function listPublicJobs({ search = '', industry = '', seniority = '', sort = 'newest', page = 1, pageSize = 6 } = {}) {
  if (!developmentFixturesEnabled) {
    const error = new Error('TV2 Public Job API contract is not available; live integration is pending.');
    error.code = 'PUBLIC_JOBS_INTEGRATION_PENDING';
    throw error;
  }
  return filterSortAndPageJobs(publicJobFixtures, { search, industry, seniority, sort, page, pageSize });
}

export async function getPublicJob(id) {
  if (!developmentFixturesEnabled) {
    const error = new Error('TV2 Public Job API contract is not available; live integration is pending.');
    error.code = 'PUBLIC_JOBS_INTEGRATION_PENDING';
    throw error;
  }
  return findOpenJob(publicJobFixtures, id);
}

export const isPublicJobsMockMode = developmentFixturesEnabled;
