import api from './api';

export async function searchCompanies(search, signal) {
  const response = await api.get('/v1/companies', { params: { search }, signal });
  return response.data?.data?.items ?? [];
}

export async function getCompanyDepartments(companyId, signal) {
  const response = await api.get(`/v1/companies/${encodeURIComponent(companyId)}/departments`, { signal });
  return response.data?.data?.items ?? [];
}
