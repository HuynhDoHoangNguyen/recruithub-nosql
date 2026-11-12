import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AuthContext from '../src/context/auth-context';
import AdminBackupRestore from '../src/features/admin/AdminBackupRestore';
import AdminDashboard from '../src/pages/Dashboard/AdminDashboard';
import RestoreBackupForm from '../src/features/admin/components/RestoreBackupForm';
import BackupJobStatus from '../src/features/admin/components/BackupJobStatus';
import { adminBackupApi } from '../src/api/adminBackupApi';
vi.mock('../src/services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: { users: [], statuses: {} } } }) } }));
vi.mock('../src/api/adminBackupApi', () => ({ adminBackupApi: { sources: vi.fn(), create: vi.fn(), status: vi.fn(), validate: vi.fn(), restore: vi.fn(), download: vi.fn() }, backupApiError: async () => 'Máy chủ chưa cấu hình sao lưu an toàn.', saveBackupDownload: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';
const available = { id, type: 'VALIDATE', status: 'SUCCEEDED', validation_state: 'AVAILABLE', expires_at: '2099-01-01T00:00:00Z', result: { source_database: 'fixture', document_count: 12, design_count: 2, attachment_count: 1, attachment_bytes: 50 } };
const config = { sources: [{ id: 'business', label: 'Dữ liệu nghiệp vụ', available: true }, { id: 'audit', label: 'Nhật ký', available: false, reason: 'SOURCE_CONFIGURATION_UNAVAILABLE' }], limits: { compressed: 100 } };
const auth = userId => ({ user: { id: userId, role: 'ADMIN' } });
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); adminBackupApi.sources.mockResolvedValue(config); adminBackupApi.status.mockResolvedValue({ id, type: 'BACKUP', status: 'SUCCEEDED', expires_at: available.expires_at, result: { document_count: 12 } }); });
it('adds the lazy backup tab and preserves the original admin navigation', async () => {
  render(<AuthContext.Provider value={auth('user:a')}><AdminDashboard /></AuthContext.Provider>);
  expect(screen.getAllByRole('tab')).toHaveLength(4); expect(adminBackupApi.sources).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Sao lưu & khôi phục' }));
  expect(await screen.findByText('Chưa có tác vụ. Chọn nguồn để tạo sao lưu hoặc tải file lên để kiểm tra.')).toBeTruthy();
  await waitFor(() => expect(adminBackupApi.sources).toHaveBeenCalledTimes(1));
  expect(sessionStorage.getItem('recruithub:admin-tab:user:a')).toBe('backup_restore');
});
it('creates a backup, tracks its status and offers download only after success', async () => {
  adminBackupApi.create.mockResolvedValue({ job_id: id, status: 'QUEUED' });
  render(<AuthContext.Provider value={auth('user:a')}><AdminBackupRestore /></AuthContext.Provider>);
  await screen.findByText('Nhật ký: Nguồn chưa được cấu hình.');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bản sao lưu' }));
  expect(await screen.findByRole('button', { name: 'Tải file sao lưu' })).toBeTruthy();
  expect(adminBackupApi.create).toHaveBeenCalledTimes(1);
});
it('shows source configuration failure with retry and disables operations', async () => {
  adminBackupApi.sources.mockRejectedValueOnce({ response: { status: 503 } });
  render(<AuthContext.Provider value={auth('user:a')}><AdminBackupRestore /></AuthContext.Provider>);
  expect(await screen.findByText('Máy chủ chưa cấu hình sao lưu an toàn.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tạo bản sao lưu' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại nguồn' }));
  await screen.findByText('Nhật ký: Nguồn chưa được cấu hình.');
});
it('rejects oversize/empty files locally, clears stale validation on file change', () => {
  const run = vi.fn();
  render(<RestoreBackupForm limits={config.limits} jobs={[available]} busy={false} run={run} now={Date.now()} />);
  expect(screen.getByText('File đã kiểm tra hợp lệ')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('File sao lưu (.rhbr.gz)'), { target: { files: [new File(['x'.repeat(101)], 'big.gz')] } });
  expect(screen.queryByText('File đã kiểm tra hợp lệ')).toBeNull();
  expect(screen.getByRole('button', { name: 'Tải lên và kiểm tra' }).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('tối đa');
  fireEvent.change(screen.getByLabelText('File sao lưu (.rhbr.gz)'), { target: { files: [new File([], 'empty.gz')] } });
  expect(screen.getByRole('button', { name: 'Tải lên và kiểm tra' }).disabled).toBe(true); expect(run).not.toHaveBeenCalled();
});
it('requires valid target, explicit confirmation and consumes the local validation once', async () => {
  const run = vi.fn(async (_type, operation) => { await operation(new AbortController().signal); });
  render(<RestoreBackupForm limits={config.limits} jobs={[available]} busy={false} run={run} now={Date.now()} />);
  const button = screen.getByRole('button', { name: 'Xem lại và khôi phục' }); expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Tên database mới'), { target: { value: 'recruitment_db' } }); expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Tên database mới'), { target: { value: 'recruithub_restore_demo' } }); fireEvent.click(button);
  expect(adminBackupApi.restore).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  fireEvent.click(button); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo và khôi phục' })));
  expect(adminBackupApi.restore).toHaveBeenCalledWith(id, 'recruithub_restore_demo', expect.any(AbortSignal));
  expect(button.disabled).toBe(true); expect(run).toHaveBeenCalledTimes(1);
});
it('disables expired validation and reports partial restore honestly', () => {
  render(<><RestoreBackupForm limits={config.limits} jobs={[{ ...available, expires_at: '2000-01-01T00:00:00Z' }]} busy={false} run={vi.fn()} now={Date.now()} />
    <BackupJobStatus job={{ id, type: 'RESTORE', status: 'FAILED', result: { target_database: 'recruithub_restore_demo', target_incomplete: true, known_written_documents_minimum: 7 } }} now={Date.now()} /></>);
  expect(screen.getByText(/Bản kiểm tra đã hết hạn/)).toBeTruthy();
  expect(screen.getByText(/Số tài liệu đã xác nhận ghi tối thiểu: 7/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xem lại và khôi phục' }).disabled).toBe(true);
});
it('does not leak tracked jobs or late source responses when the account changes', async () => {
  let finish;
  adminBackupApi.sources.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(config);
  sessionStorage.setItem('recruithub:backup:v1:user:a', JSON.stringify([{ id, type: 'BACKUP' }]));
  const { rerender } = render(<AuthContext.Provider value={auth('user:a')}><AdminBackupRestore /></AuthContext.Provider>);
  await screen.findByText(id);
  rerender(<AuthContext.Provider value={auth('user:b')}><AdminBackupRestore /></AuthContext.Provider>);
  await screen.findByText(/Chưa có tác vụ\./);
  await act(async () => finish({ ...config, sources: [{ id: 'private', label: 'Old account source', available: true }] }));
  expect(screen.queryByText(id)).toBeNull(); expect(screen.queryByText('Old account source')).toBeNull();
});
it('requires an authenticated admin for the workspace', () => {
  render(<AuthContext.Provider value={{ user: { id: 'user:c', role: 'CANDIDATE' } }}><AdminBackupRestore /></AuthContext.Provider>);
  expect(screen.getByRole('alert').textContent).toContain('Admin'); expect(adminBackupApi.sources).not.toHaveBeenCalled();
});
it('separates upload percentage from server-side validation and never sends multipart', async () => {
  let finish, emitProgress;
  adminBackupApi.validate.mockImplementation((_file, progress) => { emitProgress = progress; return new Promise(resolve => { finish = resolve; }); });
  const run = vi.fn(async (_type, operation) => (await operation(new AbortController().signal)).job_id);
  render(<RestoreBackupForm limits={config.limits} jobs={[]} busy={false} run={run} now={Date.now()} />);
  const file = new File(['gzip'], 'test.rhbr.gz');
  fireEvent.change(screen.getByLabelText('File sao lưu (.rhbr.gz)'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Tải lên và kiểm tra' }));
  expect(screen.queryByRole('progressbar')).toBeNull();
  act(() => emitProgress({ lengthComputable: true, loaded: 5, total: 10 }));
  expect(screen.getByRole('progressbar').value).toBe(50);
  expect(screen.getByRole('status').textContent).toContain('Máy chủ sẽ kiểm tra sau khi nhận file');
  await act(async () => finish({ job_id: id }));
  expect(screen.queryByRole('progressbar')).toBeNull(); expect(screen.queryByText('File đã kiểm tra hợp lệ')).toBeNull();
  expect(adminBackupApi.validate.mock.calls[0][0]).toBe(file);
});
it('prevents expired backup downloads and gives verified restore results their own message', () => {
  render(<><BackupJobStatus job={{ id, type: 'BACKUP', status: 'SUCCEEDED', expires_at: '2000-01-01T00:00:00Z', result: { document_count: 12 } }} now={Date.now()} />
    <BackupJobStatus job={{ id: 'restore-id', type: 'RESTORE', status: 'SUCCEEDED', result: { target_database: 'recruithub_restore_demo', verified_documents: 12 } }} now={Date.now()} /></>);
  expect(screen.getByRole('button', { name: 'Tải file sao lưu' }).disabled).toBe(true);
  expect(screen.getByText('Đã đối chiếu 12 tài liệu, tệp đính kèm và chỉ mục.')).toBeTruthy();
  expect(screen.getByText(/Ứng dụng chưa chuyển sang database đích/)).toBeTruthy();
});
