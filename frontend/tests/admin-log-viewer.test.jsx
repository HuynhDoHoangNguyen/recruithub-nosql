import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { adminAuditApi } from '../src/api/adminAuditApi';
import AdminDashboard from '../src/pages/Dashboard/AdminDashboard';

vi.mock('../src/services/api', () => ({ default: { get: vi.fn(path => Promise.resolve(path.includes('/users')
  ? { data: { data: { users: [] } } }
  : { data: { data: { statuses: {} } } })), patch: vi.fn() } }));
vi.mock('../src/api/adminAuditApi', () => ({ adminAuditApi: { listAuditTrails: vi.fn(), listSystemLogs: vi.fn() } }));

const event = {
  schema_version: 1,
  kind: 'audit_trail',
  event_id: '11111111-1111-4111-8111-111111111111',
  correlation_id: '22222222-2222-4222-8222-222222222222',
  occurred_at: '2026-11-12T01:02:03.000Z',
  action: 'USER_ACCOUNT_STATUS_CHANGED',
  actor: { type: 'USER', id: 'user:actor', role: 'ADMIN' },
  subject: { type: 'USER', id: 'user:target' },
  outcome: 'SUCCEEDED',
  change: { field: 'account_status', from: 'ACTIVE', to: 'LOCKED' },
};
const empty = { items: [], has_more: false, next_cursor: null };

beforeEach(() => {
  vi.resetAllMocks();
  adminAuditApi.listAuditTrails.mockResolvedValue(empty);
  adminAuditApi.listSystemLogs.mockResolvedValue(empty);
});

async function openAudit() {
  render(<AdminDashboard />);
  expect(adminAuditApi.listAuditTrails).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Vết kiểm toán' }));
  await waitFor(() => expect(adminAuditApi.listAuditTrails).toHaveBeenCalledTimes(1));
}

it('lazy-loads each admin log tab and renders safe audit details in Vietnamese', async () => {
  adminAuditApi.listAuditTrails.mockResolvedValue({ items: [event], has_more: false, next_cursor: null });
  await openAudit();
  expect(await screen.findByText('Khóa hoặc mở tài khoản')).toBeTruthy();
  expect(screen.getByText('Admin · user:actor')).toBeTruthy();
  expect(screen.getByText('Tài khoản · user:target')).toBeTruthy();
  expect(screen.getByText(/ACTIVE → LOCKED/)).toBeTruthy();
  fireEvent.click(screen.getByText('Chi tiết kỹ thuật'));
  expect(screen.getByText(event.correlation_id)).toBeTruthy();

  fireEvent.click(screen.getByRole('tab', { name: 'Nhật ký hệ thống' }));
  await waitFor(() => expect(adminAuditApi.listSystemLogs).toHaveBeenCalledTimes(1));
});

it('uses the signed cursor alone on the next page and restores the fixed range on previous', async () => {
  adminAuditApi.listAuditTrails
    .mockResolvedValueOnce({ items: [event], has_more: true, next_cursor: 'signed.cursor' })
    .mockResolvedValueOnce(empty)
    .mockResolvedValueOnce({ items: [event], has_more: true, next_cursor: 'signed.cursor' });
  await openAudit();
  const firstQuery = adminAuditApi.listAuditTrails.mock.calls[0][0];
  expect(firstQuery).toMatchObject({ limit: 25 });
  expect(firstQuery.from).toMatch(/T17:00:00\.000Z$/);
  expect(firstQuery.to).toMatch(/T17:00:00\.000Z$/);

  fireEvent.click(screen.getByRole('button', { name: 'Trang nhật ký tiếp' }));
  await waitFor(() => expect(adminAuditApi.listAuditTrails).toHaveBeenNthCalledWith(2, { cursor: 'signed.cursor', limit: 25 }));
  fireEvent.click(screen.getByRole('button', { name: 'Trang nhật ký trước' }));
  await waitFor(() => expect(adminAuditApi.listAuditTrails).toHaveBeenCalledTimes(3));
  expect(adminAuditApi.listAuditTrails.mock.calls[2][0]).toEqual(firstQuery);
});

it('applies one auxiliary audit filter and converts selected Vietnam days to a half-open UTC range', async () => {
  await openAudit();
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-02' } });
  fireEvent.change(screen.getByLabelText('Kiểu lọc'), { target: { value: 'actor' } });
  fireEvent.change(screen.getByLabelText('ID người thực hiện'), { target: { value: 'user:actor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  await waitFor(() => expect(adminAuditApi.listAuditTrails).toHaveBeenCalledTimes(2));
  expect(adminAuditApi.listAuditTrails.mock.calls[1][0]).toEqual({
    from: '2026-10-31T17:00:00.000Z',
    to: '2026-11-02T17:00:00.000Z',
    limit: 25,
    actor_id: 'user:actor',
  });
});

it('shows loading, empty, service error and retry states', async () => {
  let finish;
  adminAuditApi.listSystemLogs.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole('tab', { name: 'Nhật ký hệ thống' }));
  expect((await screen.findByRole('status')).textContent).toContain('Đang tải nhật ký hệ thống');
  await act(async () => finish(empty));
  expect(await screen.findByText('Không có bản ghi phù hợp')).toBeTruthy();

  adminAuditApi.listSystemLogs.mockRejectedValueOnce({ response: { status: 503, data: { error: { code: 'AUDIT_READ_UNAVAILABLE' } } } });
  const form = screen.getByRole('button', { name: 'Áp dụng' }).closest('form');
  fireEvent.submit(form);
  expect((await screen.findByRole('alert')).textContent).toContain('Kho nhật ký tạm thời');
  adminAuditApi.listSystemLogs.mockResolvedValueOnce(empty);
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(adminAuditApi.listSystemLogs).toHaveBeenCalledTimes(3));
});

it('requires an explicit return to the first page when a cursor is invalid', async () => {
  adminAuditApi.listAuditTrails
    .mockResolvedValueOnce({ items: [event], has_more: true, next_cursor: 'expired.cursor' })
    .mockRejectedValueOnce({ response: { data: { error: { code: 'INVALID_CURSOR' } } } })
    .mockResolvedValueOnce(empty);
  await openAudit();
  fireEvent.click(screen.getByRole('button', { name: 'Trang nhật ký tiếp' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('quay về trang đầu');
  fireEvent.click(within(alert).getByRole('button', { name: 'Về trang đầu' }));
  await waitFor(() => expect(adminAuditApi.listAuditTrails).toHaveBeenCalledTimes(3));
  expect(adminAuditApi.listAuditTrails.mock.calls[2][0].cursor).toBeUndefined();
});

