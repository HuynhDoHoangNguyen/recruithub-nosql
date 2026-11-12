import { beforeEach, describe, expect, it, vi } from 'vitest';
import client from '../src/api/axiosClient';
import { applicationApi } from '../src/api/jobApplicationApi';

vi.mock('../src/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('candidate ranking API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /v1/jobs/job%3Acms%3AJ_000001/applicant-ranking with URL encoded job ID', async () => {
    const rawJobId = 'job:cms:J_000001';
    const mockData = {
      job: { id: rawJobId, title: 'Kỹ sư Backend' },
      items: [],
      summary: { total_applications: 0, eligible_applications: 0, excluded_applications: 0 },
      pagination: { page: 1, limit: 20, total_items: 0, total_pages: 0 },
    };

    client.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockData,
      },
    });

    const result = await applicationApi.ranking(rawJobId, { page: 1, limit: 20 });

    expect(client.get).toHaveBeenCalledTimes(1);
    const [calledUrl, calledConfig] = client.get.mock.calls[0];
    expect(calledUrl).toBe('/v1/jobs/job%3Acms%3AJ_000001/applicant-ranking');
    expect(calledConfig).toEqual({ params: { page: 1, limit: 20 } });
    expect(result).toEqual(mockData);
  });

  it('sends exact query parameters { page: 1, limit: 20 } without unauthorized fields', async () => {
    client.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { items: [], pagination: { page: 1, limit: 20 } },
      },
    });

    await applicationApi.ranking('job:1', { page: 1, limit: 20 });

    const [, calledConfig] = client.get.mock.calls[0];
    expect(calledConfig.params).toEqual({ page: 1, limit: 20 });
    expect(calledConfig.params).not.toHaveProperty('bookmark');
    expect(calledConfig.params).not.toHaveProperty('stage');
    expect(calledConfig.params).not.toHaveProperty('sort');
    expect(calledConfig.params).not.toHaveProperty('order');
    expect(calledConfig.params).not.toHaveProperty('include_excluded');
  });

  it('unwraps response.data.data when response.data.success is true', async () => {
    const mockPayload = {
      job: { id: 'job:cms:J_000001', title: 'Kỹ sư Backend' },
      summary: { total_applications: 1, eligible_applications: 1, excluded_applications: 0 },
      items: [{ rank: 1, application_id: 'app:1', analysis_status: 'COMPLETE' }],
      pagination: { page: 1, limit: 20, total_items: 1, total_pages: 1 },
    };

    client.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockPayload,
      },
    });

    const data = await applicationApi.ranking('job:cms:J_000001', { page: 1, limit: 20 });
    expect(data).toEqual(mockPayload);
  });

  it('preserves error envelope fields: status, code, details, message', async () => {
    const errorResponse = {
      response: {
        status: 403,
        data: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Chỉ nhà tuyển dụng sở hữu tin tuyển dụng mới có quyền xem bảng xếp hạng.',
            details: [{ field: 'job_id', issue: 'unauthorized_owner' }],
          },
        },
      },
    };

    client.get.mockRejectedValueOnce(errorResponse);

    await expect(
      applicationApi.ranking('job:cms:J_000001', { page: 1, limit: 20 })
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Chỉ nhà tuyển dụng sở hữu tin tuyển dụng mới có quyền xem bảng xếp hạng.',
      details: [{ field: 'job_id', issue: 'unauthorized_owner' }],
    });
  });

  it('does not transform API error into fake empty ranking response', async () => {
    const networkError = new Error('Network Error');
    client.get.mockRejectedValueOnce(networkError);

    let caughtError = null;
    let result = null;
    try {
      result = await applicationApi.ranking('job:cms:J_000001', { page: 1, limit: 20 });
    } catch (err) {
      caughtError = err;
    }

    expect(result).toBeNull();
    expect(caughtError).toBeTruthy();
    expect(caughtError).not.toEqual({ items: [], summary: {} });
  });
});
