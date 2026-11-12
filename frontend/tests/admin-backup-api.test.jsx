import { beforeEach, expect, it, vi } from 'vitest';
import api from '../src/services/api';
import { adminBackupApi, backupApiError, saveBackupDownload } from '../src/api/adminBackupApi';
vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: { data: {} } }); api.post.mockResolvedValue({ data: { data: { job_id: 'id' } } }); });

it('uses the existing API base and correct status endpoints without retrying POST', async () => {
  const signal = new AbortController().signal;
  await adminBackupApi.sources(signal); await adminBackupApi.create('business', signal);
  await adminBackupApi.status('a/b', 'VALIDATE', signal); await adminBackupApi.status('restore-id', 'RESTORE', signal);
  await adminBackupApi.restore('validation-id', 'recruithub_restore_demo', signal);
  expect(api.get.mock.calls.map(args => args[0])).toEqual(['/v1/admin/backups/sources', '/v1/admin/backups/a%2Fb', '/v1/admin/restores/restore-id']);
  expect(api.post).toHaveBeenNthCalledWith(1, '/v1/admin/backups', { source_id: 'business' }, { signal });
  expect(api.post).toHaveBeenNthCalledWith(2, '/v1/admin/restores', { validation_id: 'validation-id', target_database: 'recruithub_restore_demo', confirm: true }, { signal });
  api.post.mockRejectedValue(new Error('offline'));
  await expect(adminBackupApi.create('business', signal)).rejects.toThrow('offline');
  expect(api.post).toHaveBeenCalledTimes(3);
});
it('sends raw file bytes and scopes transfer timeout/progress/abort to the request', async () => {
  const file = new File(['gzip'], 'backup.gz'); const progress = vi.fn(); const signal = new AbortController().signal;
  await adminBackupApi.validate(file, progress, signal); await adminBackupApi.download('id', signal);
  expect(api.post).toHaveBeenCalledWith('/v1/admin/backups/validate', file, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 660000, onUploadProgress: progress, signal });
  expect(api.get).toHaveBeenCalledWith('/v1/admin/backups/id/download', { responseType: 'blob', timeout: 660000, signal });
});
it('decodes JSON blob errors and does not expose arbitrary server text', async () => {
  // jsdom Blob lacks text(); use a Blob subclass with the same browser contract.
  class ErrorBlob extends Blob { async text() { return JSON.stringify({ error: { code: 'ARTIFACT_EXPIRED', message: 'private stack' } }); } }
  expect(await backupApiError({ response: { status: 410, data: new ErrorBlob() } })).toContain('hết hạn');
  expect(await backupApiError({ response: { status: 503, data: { message: 'secret credentials' } } })).not.toContain('secret');
  expect(await backupApiError({})).toContain('không tự động gửi lại');
});
it('sanitizes the download filename and revokes the object URL', () => {
  vi.useFakeTimers();
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { expect(this.download).toBe('recruithub-backup-id.rhbr.gz'); });
  try {
    saveBackupDownload({ data: new Blob(), headers: { 'content-disposition': 'attachment; filename="../../unsafe.rhbr.gz"' } }, 'id');
    expect(document.querySelector('a[download]')).toBeNull(); vi.runAllTimers(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  } finally { click.mockRestore(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; vi.useRealTimers(); }
});
