import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../src/services/api';
import AdminDashboard from '../src/pages/Dashboard/AdminDashboard';

vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

const user = { id: 'user:fixture', email: 'candidate@example.invalid', role: 'CANDIDATE', account_status: 'ACTIVE' };
const userPath = '/v1/admin/users/' + encodeURIComponent(user.id);
const details = (account_status, etag) => ({ headers: { etag }, data: { data: { user: { ...user, account_status } } } });
const conflict = { response: { status: 409, data: { error: { code: 'REVISION_CONFLICT' } } } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

function setup(detailResponses) {
  api.get.mockImplementation(path => {
    if (path === userPath) return detailResponses.shift()();
    if (path === '/v1/admin/users') return Promise.resolve({ data: { data: { users: [user] } } });
    return Promise.resolve({ data: { data: { statuses: {} } } });
  });
  api.patch.mockRejectedValueOnce(conflict).mockResolvedValueOnce({});
  render(<AdminDashboard />);
}

async function open() {
  fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Khóa tài khoản' }));
  return dialog;
}

it('reloads the account after a stale ETag and only writes again after confirmation', async () => {
  setup([() => Promise.resolve(details('ACTIVE', '"1-user"')), () => Promise.resolve(details('LOCKED', '"2-user"'))]);
  const dialog = await open();
  await within(dialog).findByText(/xác nhận lại/);
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch).toHaveBeenNthCalledWith(1, userPath + '/status', { account_status: 'LOCKED' }, { headers: { 'If-Match': '"1-user"' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Mở khóa tài khoản' }));
  await waitFor(() => expect(api.patch).toHaveBeenNthCalledWith(2, userPath + '/status',
    { account_status: 'ACTIVE' }, { headers: { 'If-Match': '"2-user"' } }));
  expect(window.confirm).toHaveBeenCalledTimes(2);
});

it('ignores a conflict reload that completes after the details dialog closes', async () => {
  let finishReload;
  setup([() => Promise.resolve(details('ACTIVE', '"1-user"')), () => new Promise(resolve => { finishReload = resolve; })]);
  const dialog = await open();
  await waitFor(() => expect(finishReload).toBeTypeOf('function'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng chi tiết' }));
  await act(async () => finishReload(details('LOCKED', '"2-user"')));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(api.patch).toHaveBeenCalledTimes(1);
});
