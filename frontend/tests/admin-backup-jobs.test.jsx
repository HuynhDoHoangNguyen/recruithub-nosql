import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBackupRestoreJobs } from '../src/features/admin/useBackupRestoreJobs';
import { adminBackupApi } from '../src/api/adminBackupApi';
import { readTrackedJobs, sessionKey } from '../src/features/admin/backupRestorePresentation';
vi.mock('../src/api/adminBackupApi', () => ({ adminBackupApi: { status: vi.fn() }, backupApiError: async () => 'Lỗi kết nối' }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
afterEach(() => vi.useRealTimers());
it('deduplicates rapid submits and persists only ID/type, with per-user recovery', async () => {
  let finish;
  const operation = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  adminBackupApi.status.mockResolvedValue({ id, type: 'BACKUP', status: 'SUCCEEDED', result: { private: 'data' } });
  const { result } = renderHook(() => useBackupRestoreJobs('user:a'));
  let first;
  act(() => { first = result.current.run('BACKUP', operation); void result.current.run('BACKUP', operation); });
  expect(operation).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ job_id: id, status: 'QUEUED' }); await first; });
  await waitFor(() => expect(result.current.jobs[0].status).toBe('SUCCEEDED'));
  expect(JSON.parse(sessionStorage.getItem(sessionKey('user:a')))).toEqual([{ id, type: 'BACKUP' }]);
  expect(readTrackedJobs('user:b')).toEqual([]);
});
it('does not overlap polls, backs off errors and stops after a terminal response', async () => {
  vi.useFakeTimers(); let resolveStatus;
  sessionStorage.setItem(sessionKey('user:a'), JSON.stringify([{ id, type: 'RESTORE' }]));
  adminBackupApi.status.mockImplementationOnce(() => new Promise(resolve => { resolveStatus = resolve; }))
    .mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue({ id, type: 'RESTORE', status: 'SUCCEEDED' });
  const { result } = renderHook(() => useBackupRestoreJobs('user:a'));
  await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(adminBackupApi.status).toHaveBeenCalledTimes(1);
  await act(async () => resolveStatus({ id, type: 'RESTORE', status: 'RUNNING' }));
  await act(async () => vi.advanceTimersByTimeAsync(2000)); expect(adminBackupApi.status).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(3999)); expect(adminBackupApi.status).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(result.current.jobs[0].status).toBe('SUCCEEDED');
  await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(adminBackupApi.status).toHaveBeenCalledTimes(3);
});
it('aborts on unmount and ignores late POST responses', async () => {
  let finish; const operation = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(() => useBackupRestoreJobs('user:a'));
  let task; act(() => { task = result.current.run('BACKUP', operation); }); unmount();
  expect(operation.mock.calls[0][0].aborted).toBe(true);
  await act(async () => { finish({ job_id: id, status: 'QUEUED' }); expect(await task).toBeNull(); });
  expect(sessionStorage.getItem(sessionKey('user:a'))).toBe('[]');
});
it('stops polling on 403 and never retries a failed POST automatically', async () => {
  vi.useFakeTimers(); sessionStorage.setItem(sessionKey('user:a'), JSON.stringify([{ id, type: 'VALIDATE' }]));
  adminBackupApi.status.mockRejectedValue({ response: { status: 403 } });
  const { result } = renderHook(() => useBackupRestoreJobs('user:a'));
  await act(async () => vi.advanceTimersByTimeAsync(100)); expect(result.current.blocked).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(adminBackupApi.status).toHaveBeenCalledTimes(1);
});
it('continues in memory when browser storage is unavailable', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  try { const { result } = renderHook(() => useBackupRestoreJobs('user:a')); expect(result.current.jobs).toEqual([]); } finally { storage.mockRestore(); }
});
