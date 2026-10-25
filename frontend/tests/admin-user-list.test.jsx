import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../src/services/api';
import AdminDashboard from '../src/pages/Dashboard/AdminDashboard';

vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

const user = { id: `user:${'a'.repeat(64)}`, email: 'admin-list@example.invalid', role: 'CANDIDATE', account_status: 'ACTIVE', created_at: '2026-10-25T00:00:00.000Z' };
const stats = { source: 'couchdb_mapreduce', totalUsers: 1, totalCandidates: 1, roles: { CANDIDATE: 1, RECRUITER: 0, ADMIN: 0 }, statuses: { ACTIVE: 1, LOCKED: 0, RESET_REQUIRED: 0 }, jobs: { total: 3, statuses: { OPEN: 1, DRAFT: 1, CLOSED: 1 } } };

function renderDashboard(entry = '/admin/dashboard') {
  return render(<MemoryRouter initialEntries={[entry]}><AdminDashboard /></MemoryRouter>);
}

describe('Admin user list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user } : { users: [user], nextCursor: null } }, headers: { etag: '"1-rev"' } }));
  });

  it('loads the user list and details without mutating status until confirmation', async () => {
    renderDashboard();
    expect(await screen.findByText(user.email)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/v1/admin/users', { params: { limit: 20 } });
    expect(screen.getByRole('button', { name: 'Lock' })).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
    expect(await screen.findByText('Nguồn thống kê: CouchDB MapReduce')).toBeTruthy();
    expect(screen.getByText('Tổng tin tuyển dụng')).toBeTruthy();
    expect(screen.getByText('Tổng tin tuyển dụng').parentElement.textContent).toContain('3');
    expect(screen.getByText('Bản nháp')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await screen.findByRole('dialog');
    expect(api.get).toHaveBeenCalledWith(`/v1/admin/users/${encodeURIComponent(user.id)}`);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('does not fabricate statistics on API failure and retries the aggregate request', async () => {
    api.get.mockImplementation((path) => path.endsWith('/stats')
      ? Promise.reject({ response: { data: { error: { message: 'Statistics views are not installed.' } } } })
      : Promise.resolve({ data: { data: { users: [user], nextCursor: null } } }));
    renderDashboard();
    expect(await screen.findByText(user.email)).toBeTruthy();
    expect(await screen.findByText('Statistics views are not installed.')).toBeTruthy();
    expect(screen.queryByText('Nguồn thống kê: CouchDB MapReduce')).toBeNull();
    expect(screen.queryByText('Phân bổ vai trò')).toBeNull();
    expect(screen.queryByText('1', { selector: 'p' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại thống kê' }));
    await waitFor(() => expect(api.get.mock.calls.filter(([path]) => path.endsWith('/stats'))).toHaveLength(2));
  });

  it('debounces search and applies role/status filters to the API request', async () => {
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.change(screen.getByLabelText('Tìm theo email'), { target: { value: '  admin-list  ' } });
    fireEvent.change(screen.getByLabelText('Lọc theo vai trò'), { target: { value: 'CANDIDATE' } });
    fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), { target: { value: 'ACTIVE' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/v1/admin/users', { params: { limit: 20, search: 'admin-list', role: 'CANDIDATE', status: 'ACTIVE' } }), { timeout: 1500 });
  });

  it('continues with server cursors and supports returning to the prior page', async () => {
    api.get.mockImplementation((path, config) => {
      if (path.endsWith('/stats')) return Promise.resolve({ data: { data: stats } });
      const cursor = config?.params?.cursor;
      return Promise.resolve({ data: { data: { users: [{ ...user, email: cursor ? 'second@example.invalid' : user.email }], nextCursor: cursor ? null : 'cursor-page-2' } } });
    });
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));
    expect(await screen.findByText('second@example.invalid')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/v1/admin/users', { params: { limit: 20, cursor: 'cursor-page-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await screen.findByText(user.email);
  });

  it('shows only eligible actions, asks for confirmation, and cancel does not PATCH', async () => {
    const locked = { ...user, id: `user:${'b'.repeat(64)}`, email: 'locked@example.invalid', account_status: 'LOCKED' };
    const admin = { ...user, id: `user:${'c'.repeat(64)}`, email: 'admin@example.invalid', role: 'ADMIN' };
    const reset = { ...user, id: `user:${'d'.repeat(64)}`, email: 'reset@example.invalid', account_status: 'RESET_REQUIRED' };
    api.get.mockImplementation((path) => {
      const id = decodeURIComponent(path.split('/').at(-1));
      const detail = id === locked.id ? locked : id === admin.id ? admin : id === reset.id ? reset : user;
      return Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user: detail } : { users: [user, locked, admin, reset], nextCursor: null } }, headers: { etag: '"1-rev"' } });
    });
    renderDashboard();
    await screen.findByText(user.email);
    expect(screen.getByRole('button', { name: 'Lock' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Lock' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Unlock' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('sends the current ETag after confirmation and updates the row on success', async () => {
    const lockedUser = { ...user, account_status: 'LOCKED' };
    let currentUser = user;
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user: currentUser } : { users: [currentUser], nextCursor: null } }, headers: { etag: '"1-rev"' } }));
    api.patch.mockImplementation(async () => { currentUser = lockedUser; return { data: { data: { user: lockedUser } }, headers: { etag: '"2-rev"' } }; });
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm lock' }));
    await screen.findByRole('status');
    expect(api.patch).toHaveBeenCalledWith(`/v1/admin/users/${encodeURIComponent(user.id)}/status`, { account_status: 'LOCKED' }, { headers: { 'If-Match': '"1-rev"' } });
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeTruthy();
    expect(screen.getByText('Account locked.')).toBeTruthy();
  });

  it('offers the eligible action in user details and keeps the updated status in the detail view', async () => {
    let currentUser = user;
    const lockedUser = { ...user, account_status: 'LOCKED' };
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user: currentUser } : { users: [currentUser], nextCursor: null } }, headers: { etag: '"1-rev"' } }));
    api.patch.mockImplementation(async () => { currentUser = lockedUser; return { data: { data: { user: lockedUser } }, headers: { etag: '"2-rev"' } }; });
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Lock account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm lock' }));
    await screen.findByRole('status');
    expect(screen.getByRole('button', { name: 'Unlock account' })).toBeTruthy();
  });

  it('reports revision conflicts without retrying and offers a refresh', async () => {
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user } : { users: [user], nextCursor: null } }, headers: { etag: '"1-rev"' } }));
    api.patch.mockRejectedValue({ response: { status: 409, data: { error: { code: 'REVISION_CONFLICT', message: 'Conflict.' } } } });
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm lock' }));
    expect(await screen.findByText(/Nothing was overwritten/)).toBeTruthy();
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Refresh list' })).toBeTruthy();
  });

  it('shows API failures and leaves account status unchanged', async () => {
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user } : { users: [user], nextCursor: null } }, headers: { etag: '"1-rev"' } }));
    api.patch.mockRejectedValue({ response: { status: 403, data: { error: { code: 'FORBIDDEN', message: 'Not allowed.' } } } });
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm lock' }));
    expect(await screen.findByText('Not allowed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeTruthy();
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it('disables the status action while a mutation is pending', async () => {
    let resolvePatch;
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.endsWith('/stats') ? stats : path.includes('/users/') ? { user } : { users: [user], nextCursor: null } }, headers: { etag: '"1-rev"' } }));
    api.patch.mockReturnValue(new Promise((resolve) => { resolvePatch = resolve; }));
    renderDashboard();
    await screen.findByText(user.email);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm lock' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const confirmation = screen.getByRole('alertdialog');
    expect(confirmation.querySelector('button.btn-primary').disabled).toBe(true);
    resolvePatch({ data: { data: { user: { ...user, account_status: 'LOCKED' } } } });
    await screen.findByRole('status');
  });
});
