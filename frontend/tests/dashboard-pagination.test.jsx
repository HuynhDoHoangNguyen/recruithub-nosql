import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecruiterDashboard from '../src/pages/Dashboard/RecruiterDashboard';
import JobSeekerDashboard from '../src/pages/Dashboard/JobSeekerDashboard';
import { jobApi, applicationApi } from '../src/api/jobApplicationApi';

vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { name: 'Tài khoản test', role: 'CANDIDATE' } }) }));
vi.mock('../src/api/jobApplicationApi', () => ({
  jobApi: { list: vi.fn(), stats: vi.fn(), context: vi.fn() },
  applicationApi: { mine: vi.fn(), stats: vi.fn(), context: vi.fn() },
}));
const jobs = Array.from({ length: 6 }, (_, i) => ({ _id: `job:${i}`, title: `Vị trí ${i + 1}`, industry: 'IT', company_name: 'Công ty test', status: 'OPEN', required_skills: [], deadline: '2026-12-30T00:00:00Z' }));
const applications = jobs.map((job, i) => ({ _id: `application:${i}`, job_id: job._id, job, current_stage: 'HIRED', applied_at: '2026-10-25T00:00:00Z', stage_history: [] }));
beforeEach(() => {
  vi.clearAllMocks();
  const page = items => async params => params.bookmark === 'page-2' ? { items: items.slice(5), has_more: false } : { items: items.slice(0, 5), has_more: true, bookmark: 'page-2' };
  jobApi.list.mockImplementation(page(jobs)); applicationApi.mine.mockImplementation(page(applications));
  jobApi.stats.mockResolvedValue({ jobs: { OPEN: 6 }, applications: {}, total_applications: 6 });
  jobApi.context.mockResolvedValue({ company: { name: 'Công ty test' }, department: { name: 'Nhân sự' } });
  applicationApi.stats.mockResolvedValue({ total_applications: 6, by_stage: { HIRED: 6 } });
  applicationApi.context.mockResolvedValue({ candidate: { profile: {} } });
});
it.each(['candidate', 'recruiter'])('%s dashboard uses 5-item API pages, next/back bookmarks and resets to first page when filtering', async role => {
  const candidate = role === 'candidate', loader = candidate ? applicationApi.mine : jobApi.list;
  render(<MemoryRouter>{candidate ? <JobSeekerDashboard /> : <RecruiterDashboard />}</MemoryRouter>);
  await screen.findByRole('heading', { name: 'Vị trí 1' });
  expect(document.querySelectorAll('article')).toHaveLength(5);
  expect(loader).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 5, bookmark: undefined }));
  expect(screen.getByRole('button', { name: 'Trang trước' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await screen.findByRole('heading', { name: 'Vị trí 6' });
  expect(document.querySelectorAll('article')).toHaveLength(1);
  expect(loader).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 5, bookmark: 'page-2' }));
  expect(screen.getByRole('button', { name: 'Trang sau' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
  await screen.findByRole('heading', { name: 'Vị trí 1' });
  expect(document.querySelectorAll('article')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' })); await screen.findByRole('heading', { name: 'Vị trí 6' });
  if (candidate) fireEvent.click(screen.getByRole('button', { name: /Phỏng vấn/ }));
  else fireEvent.change(screen.getByLabelText('Trạng thái tin'), { target: { value: 'OPEN' } });
  await waitFor(() => expect(loader).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 5, bookmark: undefined, ...(candidate ? { stage: 'INTERVIEW' } : { status: 'OPEN' }) })));
  await screen.findByRole('heading', { name: 'Vị trí 1' });
  expect(screen.getByRole('button', { name: 'Trang trước' }).disabled).toBe(true);
});
