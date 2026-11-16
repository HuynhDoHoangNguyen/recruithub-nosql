import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import FaqChatbox from '../src/components/support/FaqChatbox';

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => auth }));
beforeEach(() => { auth.user = null; });
afterEach(cleanup);

function Destination() {
  const location = useLocation();
  return <output aria-label="Trang hiện tại">{location.pathname}{location.state?.from ? ` → ${location.state.from}` : ''}</output>;
}
function show(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><FaqChatbox /><Destination /></MemoryRouter>);
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Mở hỗ trợ FAQ' })); }

it('guides a guest to search jobs and closes the panel when navigating', () => {
  show(); open();
  fireEvent.click(screen.getByRole('button', { name: 'Tìm việc như thế nào?' }));
  expect(screen.getByText(/Lọc theo địa điểm/)).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Khám phá việc làm' }));
  expect(screen.getByLabelText('Trang hiện tại').textContent).toBe('/jobs');
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('sends guests to login with the intended candidate destination', () => {
  show('/jobs'); open();
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật hồ sơ ở đâu?' }));
  fireEvent.click(screen.getByRole('link', { name: 'Đăng nhập để tiếp tục' }));
  expect(screen.getByLabelText('Trang hiện tại').textContent).toBe('/login → /profile');
  expect(screen.queryByRole('button', { name: 'Mở hỗ trợ FAQ' })).toBeNull();
});

it('links candidates to profile and application history, with accurate CV guidance', () => {
  auth.user = { role: 'CANDIDATE' }; show(); open();
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật hồ sơ ở đâu?' }));
  expect(screen.getByRole('link', { name: 'Mở hồ sơ cá nhân' }).getAttribute('href')).toBe('/profile');
  fireEvent.click(screen.getByRole('button', { name: 'Làm sao để ứng tuyển?' }));
  expect(screen.getByText(/dùng CV từ hồ sơ hoặc nhập CV văn bản/)).toBeTruthy();
  expect(screen.getByText(/Tin tham khảo, tin đã đóng/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Xem tiến trình ứng tuyển ở đâu?' }));
  fireEvent.click(screen.getByRole('link', { name: 'Xem đơn ứng tuyển' }));
  expect(screen.getByLabelText('Trang hiện tại').textContent).toBe('/user/dashboard');
});

it('supports Escape and restores keyboard focus to the launcher', () => {
  show(); open();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng hỗ trợ' }));
  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mở hỗ trợ FAQ' }));
});

it.each(['/login', '/register', '/reset-password', '/admin/dashboard', '/recruiter/dashboard'])('does not cover auth or management pages: %s', path => {
  show(path);
  expect(screen.queryByRole('button', { name: 'Mở hỗ trợ FAQ' })).toBeNull();
});

it.each(['ADMIN', 'RECRUITER'])('does not offer candidate shortcuts to %s', role => {
  auth.user = { role }; show('/jobs');
  expect(screen.queryByRole('button', { name: 'Mở hỗ trợ FAQ' })).toBeNull();
});
