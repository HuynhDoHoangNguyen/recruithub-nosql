import client from './axiosClient';

const idPath = id => encodeURIComponent(id);
async function unwrap(request) {
  try {
    const response = await request;
    if (!response.data.success) throw new Error(response.data.message || 'Không thể tải dữ liệu.');
    return response.data.data;
  } catch (error) {
    const body = error.response?.data;
    throw Object.assign(new Error(body?.message || error.message || 'Không thể kết nối máy chủ.'), {
      status: error.response?.status, code: body?.error?.code, details: body?.error?.details || [],
    });
  }
}
export const jobApi = {
  list: params => unwrap(client.get('/recruiter/jobs', { params })),
  stats: () => unwrap(client.get('/recruiter/stats')),
  detail: id => unwrap(client.get(`/recruiter/jobs/${idPath(id)}`)),
  create: payload => unwrap(client.post('/jobs', payload)),
  edit: (id, payload) => unwrap(client.patch(`/jobs/${idPath(id)}`, payload)),
  status: (id, status, expected_rev) => unwrap(client.patch(`/jobs/${idPath(id)}/status`, { status, expected_rev })),
  publicList: params => unwrap(client.get('/jobs', { params })),
  publicDetail: id => unwrap(client.get(`/jobs/${idPath(id)}`)),
};
export const applicationApi = {
  context: () => unwrap(client.get('/applications/context')),
  apply: payload => unwrap(client.post('/applications', payload)),
  mine: params => unwrap(client.get('/applications/my-applications', { params })),
  detail: id => unwrap(client.get(`/applications/${idPath(id)}`)),
  applicants: (id, params) => unwrap(client.get(`/jobs/${idPath(id)}/applicants`, { params })),
  withdraw: application => unwrap(client.patch(`/applications/${idPath(application._id)}/withdraw`, {
    expected_stage: application.current_stage, expected_rev: application._rev,
  })),
  transition: (application, action) => unwrap(client.patch(`/applications/${idPath(application._id)}/stage`, {
    expected_stage: application.current_stage, expected_rev: application._rev, ...action,
  })),
};
