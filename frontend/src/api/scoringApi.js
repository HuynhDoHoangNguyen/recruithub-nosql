import client from './axiosClient';
import { apiErrorMessage } from './apiError';

const idPath = id => encodeURIComponent(id);

async function unwrap(request) {
  try {
    const response = await request;
    if (!response?.data?.success) {
      const body = response?.data;
      const envelopeError = new Error(body?.error?.message || body?.message || 'Không thể tải dữ liệu.');
      envelopeError.isEnvelopeError = true;
      envelopeError.code = body?.error?.code;
      envelopeError.details = body?.error?.details || [];
      throw envelopeError;
    }
    return response.data.data;
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      throw error;
    }
    if (error.isEnvelopeError) {
      throw error;
    }
    const body = error.response?.data;
    throw Object.assign(
      new Error(body?.error?.message || body?.message || apiErrorMessage(error)),
      {
        status: error.response?.status,
        code: body?.error?.code,
        details: body?.error?.details || [],
      }
    );
  }
}

export const scoringApi = {
  getAnalysis: (applicationId) => unwrap(client.get(`/v1/resume-analysis/${idPath(applicationId)}`)),
  recompute: (applicationId) => unwrap(client.post('/v1/resume-analysis/compute', { application_id: applicationId })),
};

export default scoringApi;
