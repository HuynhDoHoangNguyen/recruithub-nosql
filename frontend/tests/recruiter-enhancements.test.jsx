import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobForm from '../src/features/jobs/components/JobForm';
import DeleteJobButton from '../src/features/jobs/components/DeleteJobButton';
import RecruiterProfile from '../src/pages/RecruiterProfile';
import CompanyLogo from '../src/components/CompanyLogo';
import { jobApi, recruiterProfileApi } from '../src/api/jobApplicationApi';
import { fromJob, jobPayload } from '../src/features/jobs/jobFormModel';
import { assetApi } from '../src/api/assetApi';
vi.mock('../src/api/assetApi', () => ({ assetApi: { upload: vi.fn(), content: vi.fn() } }));

vi.mock('../src/api/jobApplicationApi', () => ({ jobApi: { metadata: vi.fn(), create: vi.fn(), remove: vi.fn() }, recruiterProfileApi: { get: vi.fn(), update: vi.fn(), updateCompany: vi.fn() } }));
const company = { _id: 'company:test', _rev: '1-company', name: 'Công ty thật', industry: 'IT' };
const data = { email: 'recruiter@example.invalid', recruiter: { _id: 'recruiter:test', _rev: '2-profile', profile: { full_name: 'Tên đã lưu', phone: '0901234567' } }, company, department: { name: 'Kỹ thuật' } };
beforeEach(() => {
  vi.clearAllMocks();
  jobApi.metadata.mockResolvedValue({ locations: [{ value: 'VN-HN', label: 'Hà Nội' }], work_modes: [{ value: 'HYBRID', label: 'Hybrid' }], employment_types: [{ value: 'FULL_TIME', label: 'Full time' }, { value: 'PART_TIME', label: 'Part time' }, { value: 'CONTRACT', label: 'Hợp đồng' }, { value: 'INTERNSHIP', label: 'Intern (Thực tập)' }] });
  recruiterProfileApi.get.mockResolvedValue(data); recruiterProfileApi.update.mockResolvedValue({ saved: true }); recruiterProfileApi.updateCompany.mockResolvedValue({ saved: true });
  assetApi.upload.mockResolvedValue({ asset_id: 'asset:11111111-1111-4111-8111-111111111111', file_name: 'logo.png', size: 100, content_type: 'image/png' });
});
it('new Job offers exactly four levels and submits employment, work mode and salary independently', async () => {
  jobApi.create.mockResolvedValue({ _id: 'job:new' }); const saved = vi.fn();
  render(<MemoryRouter><JobForm onSaved={saved} /></MemoryRouter>);
  expect([...screen.getByLabelText('Cấp bậc').options].map(option => option.text)).toEqual(['Intern', 'Fresher', 'Junior', 'Senior']);
  fireEvent.change(screen.getByLabelText('Tiêu đề công việc *'), { target: { value: 'Kỹ sư' } }); fireEvent.change(screen.getByLabelText('Ngành nghề *'), { target: { value: 'IT' } });
  fireEvent.change(screen.getByLabelText('Mô tả công việc *'), { target: { value: 'Công việc thực tế' } }); fireEvent.change(screen.getByLabelText('Kỹ năng bắt buộc * (phân cách bằng dấu phẩy)'), { target: { value: 'JavaScript' } });
  await screen.findByRole('option', { name: 'Full time' });
  fireEvent.change(screen.getByLabelText('Cấp bậc'), { target: { value: 'FRESHER' } });
  fireEvent.change(screen.getByLabelText('Hình thức làm việc'), { target: { value: 'HYBRID' } }); fireEvent.change(screen.getByLabelText('Loại hình làm việc'), { target: { value: 'PART_TIME' } });
  fireEvent.change(screen.getByLabelText('Thông tin mức lương'), { target: { value: 'RANGE' } });
  fireEvent.change(screen.getByLabelText('Lương tối thiểu / tháng'), { target: { value: '15000000' } }); fireEvent.change(screen.getByLabelText('Lương tối đa / tháng'), { target: { value: '25000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tin tuyển dụng' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(jobApi.create).toHaveBeenCalledWith(expect.objectContaining({ seniority: 'FRESHER', work_mode: 'HYBRID', employment_type: 'PART_TIME', salary: { type: 'RANGE', min: 15000000, max: 25000000, currency: 'VND', period: 'MONTH' } }));
});
it('edit preserves a legacy MID and exact deadline while clearing salary/employment intentionally', () => {
  const job = { title: 'Job cũ', seniority: 'MID', industry: 'IT', description: 'Mô tả', responsibilities: [], required_skills: ['javascript'], optional_skills: [], requirements: { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } }, deadline: '2099-01-01T00:00:59.123Z', _rev: '3-test', salary: { type: 'NEGOTIABLE' }, employment_type: 'FULL_TIME' };
  const form = fromJob(job); form.salary_type = ''; form.employment_type = '';
  const payload = jobPayload(form, job); expect(payload.seniority).toBe('MID'); expect(payload.deadline).toBe(job.deadline); expect(payload.salary).toBeNull(); expect(payload.employment_type).toBeNull();
});
it('delete confirms, sends the expected revision and refreshes after a conflict', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
  jobApi.remove.mockRejectedValueOnce(Object.assign(new Error('Tin đã thay đổi'), { status: 409 })).mockResolvedValue({ deleted: true });
  const changed = vi.fn(), conflict = vi.fn(); render(<DeleteJobButton job={{ _id: 'job:test', _rev: '3-test', title: 'Job' }} onDeleted={changed} onConflict={conflict} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tin' })); expect(jobApi.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tin' })); await screen.findByText('Tin đã thay đổi'); expect(conflict).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tin' })); await waitFor(() => expect(changed).toHaveBeenCalledOnce()); expect(jobApi.remove).toHaveBeenCalledWith('job:test', '3-test'); confirm.mockRestore();
});
it('profile has the requested layout and saves own contact fields with immutable email', async () => {
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>);
  const name = await screen.findByLabelText('Họ và tên'); expect(name.value).toBe('Tên đã lưu'); expect(screen.getByLabelText('Email liên hệ').readOnly).toBe(true);
  fireEvent.change(name, { target: { value: 'Tên mới' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(recruiterProfileApi.update).toHaveBeenCalledWith({ expected_rev: '2-profile', profile: { full_name: 'Tên mới', phone: '0901234567', location: '', bio: '' } }));
  expect(await screen.findByText('Đã lưu thông tin liên hệ.')).toBeTruthy();
});
it('company tab saves logo/metadata to its own endpoint and cancel restores stored fields', async () => {
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>); await screen.findByLabelText('Họ và tên');
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin công ty' }));
  fireEvent.change(screen.getByLabelText('Tên công ty *'), { target: { value: 'Chưa lưu' } }); fireEvent.click(screen.getByRole('button', { name: 'Hủy' })); expect(screen.getByLabelText('Tên công ty *').value).toBe('Công ty thật');
  fireEvent.change(screen.getByLabelText('Tải logo công ty từ máy tính'), { target: { files: [new File(['png-test'], 'logo.png', { type: 'image/png' })] } });
  await screen.findByText('logo.png'); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(recruiterProfileApi.updateCompany).toHaveBeenCalledWith(expect.objectContaining({ expected_rev: '1-company', company: expect.objectContaining({ logo_asset_id: 'asset:11111111-1111-4111-8111-111111111111', name: 'Công ty thật' }) })));
});
it('profile conflict reloads before the next edit and reports the failure', async () => {
  recruiterProfileApi.update.mockRejectedValue(Object.assign(new Error('Hồ sơ đã thay đổi'), { status: 409 }));
  render(<MemoryRouter><RecruiterProfile /></MemoryRouter>); await screen.findByLabelText('Họ và tên'); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await screen.findByText('Hồ sơ đã thay đổi'); await waitFor(() => expect(recruiterProfileApi.get).toHaveBeenCalledTimes(2));
});
it('a broken company image falls back to initials instead of a broken logo', () => {
  render(<CompanyLogo name="Công ty kiểm thử" src="https://example.invalid/missing.png" />);
  fireEvent.error(screen.getByRole('img', { name: 'Logo Công ty kiểm thử' })); expect(screen.queryByRole('img')).toBeNull(); expect(screen.getByText('CTK')).toBeTruthy();
});
