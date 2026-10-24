import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from '../../src/pages/Login';
import Register from '../../src/pages/Register';
import ProtectedRoute from '../../src/components/ProtectedRoute';
import api from '../../src/services/api';
import { validateCandidateRegistration } from '../../src/utils/candidateRegistration';

const authState = vi.hoisted(() => ({ user: null, login: vi.fn(), refreshMe: vi.fn() }));
const organizationApi = vi.hoisted(() => ({ searchCompanies: vi.fn(), getCompanyDepartments: vi.fn() }));
vi.mock('../../src/services/api', () => ({ default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } }));
vi.mock('../../src/context/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../../src/services/organizationApi', () => organizationApi);

function renderLogin(initialEntry = '/login') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/profile" element={<p>Candidate profile destination</p>} />
    <Route path="/user/dashboard" element={<p>Candidate dashboard destination</p>} />
    <Route path="/recruiter/dashboard" element={<p>Recruiter dashboard destination</p>} />
    <Route path="/admin/dashboard" element={<p>Admin dashboard destination</p>} />
    <Route path="/recruiter/jobs/:id/applicants" element={<p>Recruiter applicant destination</p>} />
  </Routes></MemoryRouter>);
}

function renderRegister() {
  return render(<MemoryRouter initialEntries={['/register']}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/login" element={<p>Sign in page</p>} />
  </Routes></MemoryRouter>);
}

function renderProtectedRoute() {
  return render(<MemoryRouter initialEntries={['/protected?tab=profile']}><Routes>
    <Route element={<ProtectedRoute allowedRoles={['CANDIDATE']} />}>
      <Route path="/protected" element={<p>Protected candidate content</p>} />
    </Route>
    <Route path="/login" element={<p>Login required</p>} />
    <Route path="/" element={<p>Access denied</p>} />
  </Routes></MemoryRouter>);
}

async function fillRegistration(user, { password = 'StrongPass1', confirmation = password } = {}) {
  await user.type(screen.getByLabelText('Họ và tên'), 'Nguyễn Văn An');
  await user.type(screen.getByLabelText('Địa chỉ email'), 'an@example.com');
  await user.type(screen.getByLabelText('Mật khẩu', { selector: '#password' }), password);
  await user.type(screen.getByLabelText('Xác nhận mật khẩu'), confirmation);
  await user.selectOptions(screen.getByLabelText('Vị trí mong muốn'), 'Backend Developer');
  await user.selectOptions(screen.getByLabelText('Ngành nghề quan tâm'), 'Công nghệ');
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
  authState.refreshMe.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv('VITE_RECRUITER_REGISTRATION_ENABLED', 'false');
  organizationApi.searchCompanies.mockResolvedValue([{ id: 'company:acme', name: 'Acme Technology', industry: 'Technology' }]);
  organizationApi.getCompanyDepartments.mockResolvedValue([{ id: 'department:engineering', name: 'Engineering' }]);
});

describe('Login UI', () => {
  it.each([
    ['CANDIDATE', 'Candidate dashboard destination'],
    ['RECRUITER', 'Recruiter dashboard destination'],
    ['ADMIN', 'Admin dashboard destination'],
  ])('redirects a successful %s login to its dashboard', async (role, destinationText) => {
    const user = userEvent.setup();
    authState.refreshMe.mockResolvedValue({ role });
    api.post.mockResolvedValue({ data: { data: { accessToken: 'token', user: { role } } } });
    renderLogin();
    await user.type(screen.getByLabelText('Địa chỉ email'), 'user@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText(destinationText)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/v1/auth/login', { email: 'user@example.com', password: 'StrongPass1' });
  });

  it('returns to the same-role protected destination saved by ProtectedRoute', async () => {
    const user = userEvent.setup();
    authState.refreshMe.mockResolvedValue({ role: 'RECRUITER' });
    api.post.mockResolvedValue({ data: { data: { accessToken: 'token', user: { role: 'RECRUITER' } } } });
    renderLogin({ pathname: '/login', state: { from: '/recruiter/jobs/job-1/applicants?tab=all' } });
    await user.type(screen.getByLabelText('Địa chỉ email'), 'r@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Recruiter applicant destination')).toBeTruthy();
  });

  it('sends a user to their own dashboard when saved destination belongs to another role', async () => {
    const user = userEvent.setup();
    authState.refreshMe.mockResolvedValue({ role: 'CANDIDATE' });
    api.post.mockResolvedValue({ data: { data: { accessToken: 'token', user: { role: 'CANDIDATE' } } } });
    renderLogin({ pathname: '/login', state: { from: '/admin/dashboard' } });
    await user.type(screen.getByLabelText('Địa chỉ email'), 'c@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Candidate dashboard destination')).toBeTruthy();
  });

  it('does not show nonfunctional remember, password recovery, or social login controls', () => {
    renderLogin();
    expect(screen.queryByText(/remember me|forgot your password|google|twitter/i)).toBeNull();
  });
});

describe('Protected route behavior', () => {
  it('redirects an unauthenticated session to login', () => {
    authState.user = null;
    renderProtectedRoute();
    expect(screen.getByText('Login required')).toBeTruthy();
  });

  it('denies a signed-in user with an invalid role', () => {
    authState.user = { role: 'UNKNOWN' };
    renderProtectedRoute();
    expect(screen.getByText('Access denied')).toBeTruthy();
  });
});

describe('Candidate registration UI', () => {
  it('validates email, password policy and matching confirmation', () => {
    const form = { full_name: 'A', email: 'a@example.com', password: 'StrongPass1', confirm_password: 'StrongPass1', candidate_role: 'Engineer', industry: 'Technology', years_experience: '0' };
    expect(validateCandidateRegistration({ ...form, email: 'not-an-email' })).toContain('email');
    expect(validateCandidateRegistration({ ...form, password: 'weak' })).toContain('Mật khẩu cần');
    expect(validateCandidateRegistration({ ...form, confirm_password: 'OtherPass1' })).toContain('không khớp');
    expect(validateCandidateRegistration(form)).toBe('');
  });

  it('rejects invalid email and password confirmation before calling the API', async () => {
    const user = userEvent.setup();
    renderRegister();
    await fillRegistration(user, { confirmation: 'DifferentPass2' });
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản Candidate' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Mật khẩu xác nhận không khớp.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('posts only the Candidate DTO and excludes confirmation/role fields', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { success: true } });
    renderRegister();
    await fillRegistration(user);
    await user.selectOptions(screen.getByLabelText('Cấp độ kinh nghiệm'), 'MID');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản Candidate' }));
    expect(await screen.findByText('Sign in page')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/v1/auth/register', {
      email: 'an@example.com', password: 'StrongPass1', full_name: 'Nguyễn Văn An',
      candidate_role: 'Backend Developer', industry: 'Công nghệ', seniority: 'MID', years_experience: 0,
    });
  });

  it('submits custom text when Khác is selected for a suggestion field', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { success: true } });
    renderRegister();
    await fillRegistration(user);
    await user.selectOptions(screen.getByLabelText('Vị trí mong muốn'), '__other__');
    await user.clear(screen.getByLabelText('Nhập vị trí mong muốn khác'));
    await user.type(screen.getByLabelText('Nhập vị trí mong muốn khác'), 'Thiết kế sản phẩm');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản Candidate' }));
    await screen.findByText('Sign in page');
    expect(api.post).toHaveBeenCalledWith('/v1/auth/register', expect.objectContaining({
      candidate_role: 'Thiết kế sản phẩm', industry: 'Công nghệ',
    }));
  });

  it('blocks double submission while the registration request is pending', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    api.post.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderRegister();
    await fillRegistration(user);
    const submit = screen.getByRole('button', { name: 'Tạo tài khoản Candidate' });
    fireEvent.submit(submit.closest('form'));
    fireEvent.submit(submit.closest('form'));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    resolveRequest({ data: { success: true } });
    expect(await screen.findByText('Sign in page')).toBeTruthy();
  });

  it('does not display placeholder legal links or unsupported social signup', () => {
    renderRegister();
    expect(document.querySelector('a[href="#"]')).toBeNull();
    expect(screen.queryByText(/google|twitter|điều khoản|chính sách bảo mật/i)).toBeNull();
  });

  it('shows both role cards and keeps Recruiter visibly disabled while its feature flag is off', () => {
    vi.stubEnv('VITE_RECRUITER_REGISTRATION_ENABLED', 'false');
    renderRegister();
    expect(screen.getByRole('heading', { name: 'Tạo tài khoản RecruiHub' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Ứng viên' }).checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'Nhà tuyển dụng' }).disabled).toBe(true);
    expect(screen.getByText('Đăng ký hiện chưa được bật')).toBeTruthy();
    expect(screen.queryByLabelText('Tìm công ty')).toBeNull();
  });

  it('shows the Recruiter form and submits only selected IDs when the explicit UI flag is enabled', async () => {
    vi.stubEnv('VITE_RECRUITER_REGISTRATION_ENABLED', 'true');
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { success: true } });
    renderRegister();
    await user.click(screen.getByRole('radio', { name: 'Nhà tuyển dụng' }));
    await user.type(screen.getByLabelText('Email'), 'r@example.com');
    await user.type(screen.getByLabelText('Mật khẩu', { selector: '#recruiter-password' }), 'StrongPass1');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu', { selector: '#recruiter-confirm-password' }), 'StrongPass1');
    await user.type(screen.getByLabelText('Tìm công ty'), 'Acme');
    await user.click(await screen.findByRole('option', { name: /Acme Technology.*Technology/i }));
    await user.selectOptions(await screen.findByLabelText('Phòng ban'), 'department:engineering');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản Recruiter' }));
    expect(await screen.findByText('Sign in page')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/v1/auth/register/recruiter', {
      email: 'r@example.com', password: 'StrongPass1', company_id: 'company:acme', department_id: 'department:engineering',
    });
  });
});
