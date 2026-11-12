import { beforeEach, describe, expect, it, vi } from 'vitest';
import client from '../src/api/axiosClient';
import { scoringApi } from '../src/api/scoringApi';

vi.mock('../src/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('scoringApi client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAnalysis', () => {
    it('sends GET request with safely URL-encoded application ID', async () => {
      const rawId = 'application:pair:123/extra test?val=1';
      const mockResult = {
        application_id: rawId,
        status: 'COMPLETE',
        total_score: 85,
        recommendation: 'HIGH',
      };

      client.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockResult,
        },
      });

      const result = await scoringApi.getAnalysis(rawId);

      expect(client.get).toHaveBeenCalledTimes(1);
      const calledUrl = client.get.mock.calls[0][0];
      expect(calledUrl).toBe(`/v1/resume-analysis/${encodeURIComponent(rawId)}`);
      expect(calledUrl).toContain('application%3Apair%3A123%2Fextra%20test%3Fval%3D1');
      expect(result).toEqual(mockResult);
    });

    it('unwraps data envelope when response.data.success is true', async () => {
      const mockData = { id: 'analysis:1', analysis_status: 'COMPLETE' };
      client.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockData,
        },
      });

      const res = await scoringApi.getAnalysis('application:1');
      expect(res).toEqual(mockData);
    });

    it('throws error when response.data.success is false', async () => {
      client.get.mockResolvedValueOnce({
        data: {
          success: false,
          message: 'Lỗi không xác định từ máy chủ',
        },
      });

      await expect(scoringApi.getAnalysis('application:1')).rejects.toThrow(
        'Lỗi không xác định từ máy chủ'
      );
    });
  });

  describe('recompute', () => {
    it('sends POST request to /v1/resume-analysis/compute with { application_id }', async () => {
      const targetAppId = 'application:pair:xyz-456';
      const mockRecomputeResult = {
        application_id: targetAppId,
        status: 'COMPLETE',
        total_score: 92,
      };

      client.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockRecomputeResult,
        },
      });

      const res = await scoringApi.recompute(targetAppId);

      expect(client.post).toHaveBeenCalledTimes(1);
      expect(client.post).toHaveBeenCalledWith('/v1/resume-analysis/compute', {
        application_id: targetAppId,
      });
      expect(res).toEqual(mockRecomputeResult);
    });
  });

  describe('error preservation and unwrapping', () => {
    it('preserves status, code, and details from API error response', async () => {
      const apiError = {
        response: {
          status: 404,
          data: {
            error: {
              code: 'NOT_FOUND',
              message: 'Hồ sơ tuyển dụng không tồn tại.',
              details: [{ field: 'application_id', issue: 'not found' }],
            },
          },
        },
      };

      client.get.mockRejectedValueOnce(apiError);

      await expect(scoringApi.getAnalysis('application:invalid')).rejects.toMatchObject({
        message: 'Hồ sơ tuyển dụng không tồn tại.',
        status: 404,
        code: 'NOT_FOUND',
        details: [{ field: 'application_id', issue: 'not found' }],
      });
    });

    it('falls back to apiErrorMessage when response has generic error format', async () => {
      const networkError = {
        message: 'Network Error',
      };

      client.post.mockRejectedValueOnce(networkError);

      await expect(scoringApi.recompute('application:1')).rejects.toThrow(
        'Không kết nối được máy chủ API. Kiểm tra Backend đang chạy và thử lại.'
      );
    });

    it('re-throws CanceledError without wrapping', async () => {
      const cancelError = new Error('Request canceled');
      cancelError.name = 'CanceledError';

      client.get.mockRejectedValueOnce(cancelError);

      await expect(scoringApi.getAnalysis('app:1')).rejects.toBe(cancelError);
    });
  });
});
