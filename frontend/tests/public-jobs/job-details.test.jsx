import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JobDetails from '../../src/pages/Jobs/JobDetails';
import { useAuth } from '../../src/context/useAuth';
import { applicationApi } from '../../src/api/jobApplicationApi';
import { getPublicJob } from '../../src/services/publicJobsApi';

vi.mock('../../src/context/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../src/api/jobApplicationApi', () => ({ applicationApi: { mine: vi.fn() } }));
vi.mock('../../src/services/publicJobsApi', () => ({ getPublicJob: vi.fn(), isPublicJobsMockMode: false }));
vi.mock('../../src/features/applications/components/ApplyModal', () => ({ default: () => null }));
vi.mock('../../src/features/applications/components/ApplicationTimeline', () => ({ default: () => null }));
vi.mock('../../src/features/applications/components/WithdrawButton', () => ({ default: () => null }));

const openJob = {
  _id: 'job:cms:J_000001', status: 'OPEN', title: '<img src=x onerror=alert(1)> Designer',
  company: { name: 'Northstar Labs', industry: 'Technology', website: 'https://example.test' },
  industry: 'Technology', seniority: 'MID', description: 'Line one\nLine two', responsibilities: ['Build interfaces'],
  requirements: { general: [], experience: { status: 'UNAVAILABLE' }, education: { status: 'UNAVAILABLE' }, project: { status: 'UNAVAILABLE' } },
  required_skills: ['React'], optional_skills: [], deadline: '2027-04-01T00:00:00.000Z',
};

function LoginDestination() {
  const location = useLocation();
  return <output data-testid="login-destination">{location.state?.from || ''}</output>;
}

function renderDetail({ role = null, job = openJob, entry = '/jobs/job%3Acms%3AJ_000001', publicJobError, historyApplication } = {}) {
  useAuth.mockReturnValue({ user: role ? { role } : null });
  if (publicJobError) getPublicJob.mockRejectedValue(publicJobError);
  else getPublicJob.mockResolvedValue(job);
  applicationApi.mine.mockResolvedValue({ items: historyApplication ? [historyApplication] : [] });
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/jobs/:id" element={<JobDetails />} />
    <Route path="/login" element={<LoginDestination />} />
  </Routes></MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());

describe('Public Job Detail', () => {
  it('renders safe job text, multiline description and omits empty optional sections', async () => {
    const { container } = renderDetail();
    expect(await screen.findByRole('heading', { name: '<img src=x onerror=alert(1)> Designer' })).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    const description = container.querySelector('p.whitespace-pre-wrap');
    expect(description.textContent).toBe('Line one\nLine two');
    expect(screen.getByText('Build interfaces')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Kỹ năng ưu tiên' })).toBeNull();
    expect(screen.getAllByText('Northstar Labs')).toHaveLength(2);
  });

  it('lets a guest open login while retaining the job detail destination', async () => {
    renderDetail();
    const link = await screen.findByRole('link', { name: 'Đăng nhập để ứng tuyển' });
    fireEvent.click(link);
    expect((await screen.findByTestId('login-destination')).textContent).toBe('/jobs/job%3Acms%3AJ_000001');
  });

  it('shows Apply only to Candidates and blocks Recruiter/Admin application', async () => {
    const { unmount } = renderDetail({ role: 'CANDIDATE' });
    expect(await screen.findByRole('button', { name: 'Nộp hồ sơ ứng tuyển' })).toBeTruthy();
    expect(applicationApi.mine).toHaveBeenCalledWith({ job_id: 'job:cms:J_000001', limit: 20 });
    unmount();
    for (const role of ['RECRUITER', 'ADMIN']) {
      renderDetail({ role });
      expect(await screen.findByText('Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Nộp hồ sơ ứng tuyển' })).toBeNull();
    }
  });

  it('loads a CLOSED Job from the signed-in Candidate application history only', async () => {
    const closedJob = { ...openJob, status: 'CLOSED', application_available: false };
    const historyApplication = { _id: 'application:pair:history', job_id: closedJob._id, job: closedJob, current_stage: 'REJECTED' };
    renderDetail({ role: 'CANDIDATE', job: null, publicJobError: Object.assign(new Error(), { status: 404 }), historyApplication });
    expect(await screen.findByRole('heading', { name: closedJob.title })).toBeTruthy();
    expect(screen.getByText(/đã đóng tin/i)).toBeTruthy();
    expect(applicationApi.mine).toHaveBeenCalledWith({ job_id: closedJob._id, limit: 20 });
    expect(screen.queryByRole('button', { name: 'Ná»™p há»“ sÆ¡ á»©ng tuyá»ƒn' })).toBeNull();
  });

  it('shows unavailable state for missing Job and retry for network errors', async () => {
    getPublicJob.mockResolvedValueOnce(null);
    renderDetail({ job: null });
    expect(await screen.findByRole('heading', { name: 'Tin tuyển dụng không khả dụng' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('disables the Candidate Apply action after the deadline', async () => {
    const expired = { ...openJob, deadline: '2020-01-01T00:00:00.000Z' };
    renderDetail({ role: 'CANDIDATE', job: expired });
    const button = await screen.findByRole('button', { name: 'Nộp hồ sơ ứng tuyển' });
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Tin đã hết hạn nhận hồ sơ.')).toBeTruthy();
  });

  it('offers retry on a network failure', async () => {
    getPublicJob.mockRejectedValueOnce(new Error('Không thể kết nối máy chủ.'));
    renderDetail();
    expect((await screen.findByRole('alert')).textContent).toContain('Không thể kết nối máy chủ.');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { name: openJob.title })).toBeTruthy();
  });

  it('continues showing the Job when its Company reference cannot be resolved', async () => {
    renderDetail({ job: { ...openJob, company: null, company_name: undefined } });
    expect(await screen.findByRole('heading', { name: openJob.title })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Thông tin công ty' })).toBeNull();
    expect(screen.getByText('Cơ hội nghề nghiệp')).toBeTruthy();
  });
});
