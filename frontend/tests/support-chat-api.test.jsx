import { expect, it, vi } from 'vitest';
import api from '../src/services/api';
import { sendSupportChat } from '../src/api/supportChatApi';
vi.mock('../src/services/api', () => ({ default: { post: vi.fn() } }));
const result = { mode: 'jobs', reply: 'Kết quả thật', jobs: [], filter_labels: [], search_url: '/jobs' };

it('uses a bounded timeout and abort signal, with only message/history in the request', async () => {
  api.post.mockResolvedValue({ data: { data: result } });
  const controller = new AbortController();
  expect(await sendSupportChat('Tìm việc', [], controller.signal)).toEqual(result);
  expect(api.post).toHaveBeenCalledWith('/v1/support/chat', { message: 'Tìm việc', history: [] }, { signal: controller.signal, timeout: 20000 });
});

it.each([
  { ...result, search_url: 'https://evil.invalid' },
  { ...result, search_url: '//evil.invalid/jobs' },
  { ...result, jobs: [{ id: 'javascript:alert(1)', title: 'fake' }] },
  { ...result, jobs: Array(6).fill({}) },
  { ...result, filter_labels: null },
  { ...result, mode: 'unknown' },
])('rejects malformed job data or unsafe navigation', async data => {
  api.post.mockResolvedValue({ data: { data } });
  await expect(sendSupportChat('Tìm việc', [])).rejects.toThrow();
});
