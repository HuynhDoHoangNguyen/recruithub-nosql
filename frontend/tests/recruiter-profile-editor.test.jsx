import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecruiterProfile from '../src/pages/RecruiterProfile';
import { recruiterProfileApi } from '../src/api/jobApplicationApi';

vi.mock('../src/api/jobApplicationApi', () => ({ recruiterProfileApi: { get: vi.fn(), update: vi.fn(), updateCompany: vi.fn() } }));
vi.mock('../src/api/assetApi', () => ({ assetApi: { upload: vi.fn() } }));

const data = () => ({
  email: 'recruiter@example.invalid',
  recruiter: { _id: 'recruiter:1', _rev: 'recruiter-rev-1', profile: { full_name: 'Nguyễn An', phone: '', location: '', bio: '' } },
  company: { _id: 'company:1', _rev: 'company-rev-1', name: 'Công ty Mẫu', industry: 'Công nghệ', address: '', website: '', description: '', logo_url: null },
  department: { _id: 'department:1', name: 'Tuyển dụng' },
});

beforeEach(() => {
  vi.clearAllMocks();
  recruiterProfileApi.get.mockResolvedValue(data());
  recruiterProfileApi.update.mockResolvedValue({ saved: true });
  recruiterProfileApi.updateCompany.mockResolvedValue({ saved: true });
});

it('keeps recruiter personal fields read-only until edit and saves only after a change', async () => {
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>);
  const fullName = await screen.findByLabelText('Họ và tên');
  expect(fullName.readOnly).toBe(true);
  expect(screen.getByRole('button', { name: 'Chỉnh sửa mục này' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa mục này' }));
  expect(fullName.readOnly).toBe(false);
  expect(screen.getByRole('button', { name: /Lưu thông tin cá nhân/ }).disabled).toBe(true);
  fireEvent.change(fullName, { target: { value: 'Nguyễn An mới' } });
  expect(screen.getByRole('button', { name: /Lưu thông tin cá nhân/ }).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Lưu thông tin cá nhân/ }));
  await waitFor(() => expect(recruiterProfileApi.update).toHaveBeenCalledWith({
    expected_rev: 'recruiter-rev-1', profile: { full_name: 'Nguyễn An mới', phone: '', location: '', bio: '' },
  }));
  expect(recruiterProfileApi.updateCompany).not.toHaveBeenCalled();
});

it('keeps company details read-only and reveals logo upload only in edit mode', async () => {
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>);
  await screen.findByLabelText('Họ và tên');
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin công ty' }));
  const companyName = screen.getByLabelText('Tên công ty *');
  expect(companyName.readOnly).toBe(true);
  expect(screen.queryByLabelText('Logo công ty')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa mục này' }));
  expect(companyName.readOnly).toBe(false);
  expect(screen.getByLabelText('Logo công ty')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Lưu hồ sơ công ty/ }).disabled).toBe(true);
  fireEvent.change(companyName, { target: { value: 'Công ty Mẫu mới' } });
  fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ công ty/ }));
  await waitFor(() => expect(recruiterProfileApi.updateCompany).toHaveBeenCalledWith(expect.objectContaining({
    expected_rev: 'company-rev-1', company: expect.objectContaining({ name: 'Công ty Mẫu mới', industry: 'Công nghệ' }),
  })));
  expect(recruiterProfileApi.update).not.toHaveBeenCalled();
});

it('does not discard unsaved recruiter details when switching profile sections', async () => {
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>);
  const fullName = await screen.findByLabelText('Họ và tên');
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa mục này' }));
  fireEvent.change(fullName, { target: { value: 'Thay đổi chưa lưu' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin công ty' }));

  expect(screen.getByRole('tab', { name: 'Thông tin cá nhân' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByLabelText('Họ và tên').value).toBe('Thay đổi chưa lưu');
  expect(screen.getByRole('status').textContent).toContain('lưu hoặc hủy');
  expect(recruiterProfileApi.update).not.toHaveBeenCalled();
});
