import client from './axiosClient';
import { apiErrorMessage } from './apiError';

const idPath = id => encodeURIComponent(id);
async function unwrap(request) {
  try {
    const response = await request;
    if (!response.data.success) throw new Error(response.data.message || 'Không thể tải dữ liệu.');
    return response.data.data;
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') throw error;
    const body = error.response?.data;
    throw Object.assign(new Error(body?.error?.message || body?.message || apiErrorMessage(error)), {
      status: error.response?.status, code: body?.error?.code, details: body?.error?.details || [],
    });
  }
}
export const jobApi = {
  metadata: () => unwrap(client.get('/v1/jobs/metadata')),
  context: () => unwrap(client.get('/v1/recruiter/context')),
  list: params => unwrap(client.get('/v1/recruiter/jobs', { params })),
  stats: () => unwrap(client.get('/v1/recruiter/stats')),
  detail: id => unwrap(client.get(`/v1/recruiter/jobs/${idPath(id)}`)),
  create: payload => unwrap(client.post('/v1/jobs', payload)),
  edit: (id, payload) => unwrap(client.patch(`/v1/jobs/${idPath(id)}`, payload)),
  remove: (id, expected_rev) => unwrap(client.delete(`/v1/jobs/${idPath(id)}`, { data: { expected_rev } })),
  status: (id, status, expected_rev, deadline) => unwrap(client.patch(`/v1/jobs/${idPath(id)}/status`, { status, expected_rev, ...(deadline ? { deadline } : {}) })),
  publicList: (params, { signal } = {}) => unwrap(client.get('/v1/jobs', { params, signal })),
  publicDetail: id => unwrap(client.get(`/v1/jobs/${idPath(id)}`)),
};
export const recruiterProfileApi = {
  get: () => unwrap(client.get('/v1/recruiter/profile')),
  update: payload => unwrap(client.patch('/v1/recruiter/profile', payload)),
  updateCompany: payload => unwrap(client.patch('/v1/recruiter/company', payload)),
};
export const applicationApi = {
  stats: () => unwrap(client.get('/v1/applications/stats')),
  context: () => unwrap(client.get('/v1/applications/context')),
  apply: payload => unwrap(client.post('/v1/applications', payload)),
  mine: params => unwrap(client.get('/v1/applications/my-applications', { params })),
  detail: id => unwrap(client.get(`/v1/applications/${idPath(id)}`)),
  applicants: (id, params) => unwrap(client.get(`/v1/jobs/${idPath(id)}/applicants`, { params })),
  ranking: (id, params) =>
    unwrap(
      client.get(
        `/v1/jobs/${idPath(id)}/applicant-ranking`,
        { params }
      )
    ),
  withdraw: application => unwrap(client.patch(`/v1/applications/${idPath(application._id)}/withdraw`, {
    expected_stage: application.current_stage, expected_rev: application._rev,
  })),
  transition: (application, action) => unwrap(client.patch(`/v1/applications/${idPath(application._id)}/stage`, {
    expected_stage: application.current_stage, expected_rev: application._rev, ...action,
  })),
};
