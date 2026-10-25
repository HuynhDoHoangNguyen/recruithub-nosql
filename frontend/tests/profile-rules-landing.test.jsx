import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../src/pages/Profile';
import RecruiterProfile from '../src/pages/RecruiterProfile';
import Landing from '../src/pages/Landing';
import api from '../src/services/api';
import { jobApi, recruiterProfileApi } from '../src/api/jobApplicationApi';
import { candidateProfileErrors } from '../src/features/profile/profileValidation';
vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../src/api/jobApplicationApi', () => ({ jobApi: { publicList: vi.fn(), metadata: vi.fn() }, recruiterProfileApi: { get: vi.fn(), update: vi.fn(), updateCompany: vi.fn() } }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { name: 'Nguyễn An', email: 'an@example.invalid' } }) }));
const candidate = { profile: { full_name: 'Nguyễn An', role: 'Engineer', industry: 'IT', seniority: 'JUNIOR', years_experience: 0, experience_months: 0, phone: '0912345678' }, skills: [], experience: [], projects: [], education: [] };
const company = { _rev: '2-company', name: 'Công ty kiểm thử', industry: 'IT' };
const job = { _id: 'job:real-data', title: 'Vị trí lấy từ API', company_name: 'Tên công ty từ API', industry: 'IT', required_skills: ['React'], location_label: 'Hà Nội', seniority: 'JUNIOR', salary: { type: 'NEGOTIABLE' }, deadline: '2026-12-30T00:00:00Z', catalog_source: 'runtime', application_available: true };
beforeEach(() => {
  vi.clearAllMocks(); api.get.mockResolvedValue({ data: { data: { profile: structuredClone(candidate) } }, headers: { etag: '"2-current"' } }); api.patch.mockResolvedValue({});
  recruiterProfileApi.get.mockResolvedValue({ email: 'recruiter@example.invalid', company, department: { name: 'Nhân sự' }, recruiter: { _rev: '2-current', profile: { full_name: 'Nguyễn An', phone: '0912345678' } } });
  recruiterProfileApi.update.mockResolvedValue({ saved: true }); recruiterProfileApi.updateCompany.mockResolvedValue({ saved: true });
  jobApi.publicList.mockResolvedValue({ items: [job] }); jobApi.metadata.mockResolvedValue({ skills: ['React'], locations: [] });
});
it('Candidate rejects incomplete phone inline and on save, then accepts a complete +84 number', async () => {
  render(<MemoryRouter><Profile /></MemoryRouter>); fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
  const phone = screen.getByLabelText('Số điện thoại'); fireEvent.change(phone, { target: { value: '0912' } }); fireEvent.blur(phone);
  expect(phone.getAttribute('aria-invalid')).toBe('true'); expect(screen.getByText(/Số điện thoại chưa đúng/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' })); expect(api.patch).not.toHaveBeenCalled();
  fireEvent.change(phone, { target: { value: '+84 912 345 678' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/v1/candidate/profile/me', expect.objectContaining({ profile: expect.objectContaining({ phone: '+84 912 345 678' }) }), { headers: { 'If-Match': '"2-current"' } }));
});
it('Recruiter blocks short phone and company website without losing values', async () => {
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>); const phone = await screen.findByLabelText('Số điện thoại');
  fireEvent.change(phone, { target: { value: '0912345' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(recruiterProfileApi.update).not.toHaveBeenCalled(); expect(phone.value).toBe('0912345'); expect(phone.getAttribute('aria-invalid')).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin công ty' }));
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'javascript:alert(1)' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(recruiterProfileApi.updateCompany).not.toHaveBeenCalled(); expect(screen.getByText(/Nhập website http/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://company.example.invalid' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(recruiterProfileApi.updateCompany).toHaveBeenCalled());
});
it('Landing uses API jobs for the hero and featured cards with accessible links', async () => {
  render(<MemoryRouter><Landing /></MemoryRouter>);
  const section = screen.getByRole('region', { name: /Việc Làm IT Tiêu Biểu/ });
  await within(section).findByRole('heading', { name: job.title });
  expect(within(section).getByRole('link', { name: new RegExp(job.title) }).getAttribute('href')).toBe('/jobs/job%3Areal-data');
  expect(screen.getByRole('combobox', { name: 'Tìm công việc' })).toBeTruthy(); expect(jobApi.publicList).toHaveBeenCalledWith({ limit: 6 });
  expect(screen.getByRole('link', { name: 'Khám phá việc làm tiêu biểu' }).getAttribute('href')).toBe('#featured-jobs');
});
it('Landing keeps the search and retry available when job loading fails, then shows the empty state', async () => {
  jobApi.publicList.mockRejectedValueOnce(new Error('Không tải được tin.')).mockResolvedValue({ items: [] });
  render(<MemoryRouter><Landing /></MemoryRouter>); await screen.findByText('Không tải được tin.');
  expect(screen.getByRole('combobox', { name: 'Tìm công việc' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByText('Chưa có tin tuyển dụng đang mở.');
});
it('collection size errors remain attached to a visible field after validating individual items', () => {
  const edited = structuredClone(candidate);
  edited.skills = Array.from({ length: 101 }, (_, i) => ({ name: `Skill ${i}`, normalized: `skill ${i}` }));
  edited.languages = Array.from({ length: 21 }, (_, i) => ({ name: `Language ${i}` }));
  const errors = candidateProfileErrors(edited, candidate);
  expect(errors['skills.0.name']).toContain('100'); expect(errors['languages.0.name']).toContain('20');
});
