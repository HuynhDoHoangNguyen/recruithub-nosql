import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Navbar from '../src/components/Navbar';
import AppRoutes from '../src/routes/AppRoutes';
import { jobApi, applicationApi } from '../src/api/jobApplicationApi';
import api from '../src/services/api';
import { setAccessToken } from '../src/utils/authHelper';
import { apiErrorMessage } from '../src/api/apiError';
import { formatDate } from '../src/features/applications/applicationPresentation';

const session = vi.hoisted(() => ({ user: null, login: vi.fn(), logout: vi.fn(), loading: false }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => session }));
vi.mock('../src/api/jobApplicationApi', () => ({
  jobApi: { metadata: vi.fn(), context: vi.fn(), list: vi.fn(), stats: vi.fn(), detail: vi.fn(), create: vi.fn(), edit: vi.fn(), status: vi.fn(), publicList: vi.fn(), publicDetail: vi.fn() },
  applicationApi: { stats: vi.fn(), context: vi.fn(), apply: vi.fn(), mine: vi.fn(), detail: vi.fn(), applicants: vi.fn(), withdraw: vi.fn(), transition: vi.fn() },
}));
vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const job = { _id: 'job:test', _rev: '1-fixture', title: 'Backend Engineer', industry: 'SaaS', seniority: 'MID',
  description: 'Phát triển API', responsibilities: ['Xây dựng API'], required_skills: ['javascript'], optional_skills: [],
  status: 'DRAFT', deadline: '2026-12-30T23:59:59.123Z', created_at: '2026-10-24T00:00:00Z',
  requirements: { general: ['NoSQL'], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } } };
const token = role => `e30.${btoa(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`;
function DestinationProbe() {
  const location = useLocation();
  return <output data-testid="protected-destination">{location.state?.from}</output>;
}
const mount = route => render(<MemoryRouter initialEntries={[route]}><Navbar /><AppRoutes /><DestinationProbe /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); session.user = null;
  jobApi.metadata.mockResolvedValue({ locations: [], work_modes: [], seniorities: [], skills: [], industries: [] });
  jobApi.context.mockResolvedValue({ company: { name: 'Công ty kiểm thử' }, department: { name: 'Kỹ thuật' } });
});

it.each(['RECRUITER', 'recruiter', 'CANDIDATE', 'JOB-SEEKER', 'job-seeker', 'ADMIN', 'admin'])('navigation handles role %s and mobile menu closes after a click', role => {
  session.user = { role, email: 'test@example.invalid' };
  render(<MemoryRouter><Navbar /></MemoryRouter>);
  expect(screen.getAllByRole('navigation')).toHaveLength(1);
  const expected = ['RECRUITER', 'recruiter'].includes(role) ? '/recruiter/dashboard' : ['ADMIN', 'admin'].includes(role) ? '/admin/dashboard' : '/user/dashboard';
  expect(screen.getByRole('link', { name: 'Bảng Điều Khiển' }).getAttribute('href')).toBe(expected);
  if (expected === '/user/dashboard') expect(screen.queryByRole('link', { name: 'Đăng Tin Tuyển Dụng' })).toBeNull();
  const menu = screen.getByRole('button', { name: 'Mở menu' });
  fireEvent.click(menu);
  expect(menu.getAttribute('aria-expanded')).toBe('true');
  if (expected === '/recruiter/dashboard') expect(within(document.getElementById('mobile-navigation')).getByRole('link', { name: 'Đăng Tin Tuyển Dụng' }).getAttribute('href')).toBe('/recruiter/jobs/create');
  fireEvent.click(within(document.getElementById('mobile-navigation')).getByRole('link', { name: 'Việc Làm IT' }));
  expect(document.getElementById('mobile-navigation')).toBeNull();
});

it('preserves Jobs filter layout, Navbar and retry when the API fails', async () => {
  jobApi.publicList.mockRejectedValueOnce(new Error('Không kết nối được máy chủ API.')).mockResolvedValue({ items: [], has_more: false });
  mount('/jobs');
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'Tuyển Dụng Việc Làm IT Toàn Quốc' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Bộ lọc nâng cao/ })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Chưa tìm thấy việc làm phù hợp');
  expect(jobApi.publicList).toHaveBeenCalledTimes(2);
});

it('retains protected destination and reports rejected Identity login without claiming success', async () => {
  mount('/recruiter/jobs/create');
  await screen.findByRole('heading', { name: 'Chào mừng bạn trở lại' });
  expect(screen.getByTestId('protected-destination').textContent).toBe('/recruiter/jobs/create');
  api.post.mockRejectedValue({ response: { status: 401, data: { error: { code: 'AUTHENTICATION_FAILED' } } } });
  fireEvent.change(screen.getByLabelText('Địa chỉ email'), { target: { value: 'test@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'test-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Đăng nhập' }).closest('form'));
  await screen.findByText('Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được kích hoạt.');
  expect(session.login).not.toHaveBeenCalled();
});

it('recruiter can navigate create, edit, publish, close and applicants using persisted API responses', async () => {
  session.user = { role: 'RECRUITER', email: 'test@example.invalid' }; setAccessToken(token('RECRUITER'));
  let saved = { ...job };
  jobApi.list.mockImplementation(async () => ({ items: [saved], has_more: false }));
  jobApi.stats.mockResolvedValue({ jobs: { DRAFT: 1 }, applications: {}, total_applications: 0 });
  jobApi.detail.mockImplementation(async () => saved);
  jobApi.create.mockImplementation(async payload => { saved = { ...job, ...payload, _rev: '2-fixture' }; return saved; });
  jobApi.edit.mockImplementation(async (_id, payload) => { saved = { ...saved, ...payload, _rev: '3-fixture' }; return saved; });
  jobApi.status.mockImplementation(async (_id, status) => { saved = { ...saved, status, _rev: '4-fixture' }; return saved; });
  applicationApi.applicants.mockResolvedValue({ job, items: [], has_more: false });
  mount('/recruiter/dashboard');
  await screen.findByRole('heading', { name: job.title });
  expect(screen.getByRole('link', { name: 'Bảng Điều Khiển', exact: true }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getAllByRole('link', { name: 'Tạo tin tuyển dụng' }).at(-1));
  fireEvent.change(await screen.findByLabelText('Tiêu đề công việc *'), { target: { value: 'Tin vừa tạo' } });
  expect(screen.getByLabelText('Doanh nghiệp / Công ty').value).toBe('Công ty kiểm thử');
  expect(screen.getByLabelText('Doanh nghiệp / Công ty').readOnly).toBe(true);
  expect(screen.getByRole('link', { name: 'Hủy bỏ' }).getAttribute('href')).toBe('/recruiter/dashboard');
  fireEvent.change(screen.getByLabelText('Ngành nghề *'), { target: { value: 'SaaS' } });
  fireEvent.change(screen.getByLabelText('Mô tả công việc *'), { target: { value: 'Phát triển API' } });
  fireEvent.change(screen.getByLabelText('Kỹ năng bắt buộc * (phân cách bằng dấu phẩy)'), { target: { value: 'javascript' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Tạo tin tuyển dụng' }).closest('form'));
  await screen.findByRole('heading', { name: 'Tin vừa tạo' });
  expect(jobApi.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'DRAFT' }));
  fireEvent.click(screen.getByRole('link', { name: 'Chỉnh sửa' }));
  fireEvent.change(await screen.findByLabelText('Tiêu đề công việc *'), { target: { value: 'Tin đã sửa' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Lưu thay đổi' }).closest('form'));
  await screen.findByRole('heading', { name: 'Tin đã sửa' });
  expect(jobApi.edit).toHaveBeenCalledWith(job._id, expect.objectContaining({ expected_rev: '2-fixture', deadline: job.deadline }));
  fireEvent.click(screen.getByRole('button', { name: 'Đăng tuyển' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Đăng tuyển' })).toBeNull());
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng tin' }));
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Chỉnh sửa' })).toBeNull());
  confirmation.mockRestore();
  fireEvent.click(screen.getByRole('link', { name: 'Xem ứng viên' }));
  await screen.findByText('Chưa có ứng viên ở trạng thái này.');
  expect(applicationApi.applicants).toHaveBeenCalledWith(job._id, expect.any(Object));
});

it('network errors and CouchDB HTTP errors have different messages', () => {
  expect(apiErrorMessage({ message: 'Network Error' })).toContain('Không kết nối được máy chủ API');
  expect(apiErrorMessage({ response: { status: 500, data: '' } })).toContain('Kiểm tra Backend đang chạy');
  expect(apiErrorMessage({ response: { data: { message: 'Chưa kết nối được cơ sở dữ liệu.' } } })).toBe('Chưa kết nối được cơ sở dữ liệu.');
});

it('formats dates with a four digit year in Vietnam time', () => {
  expect(formatDate('2026-10-23T23:30:00Z')).toContain('24/10/2026');
});
