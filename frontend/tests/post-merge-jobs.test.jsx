import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JobDetails from '../src/pages/Jobs/JobDetails';
import { applicationApi, jobApi } from '../src/api/jobApplicationApi';

vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { role: 'CANDIDATE', email: 'candidate@example.invalid' } }) }));
vi.mock('../src/api/jobApplicationApi', () => ({ jobApi: { publicDetail: vi.fn() }, applicationApi: { mine: vi.fn(), context: vi.fn(), apply: vi.fn(), withdraw: vi.fn() } }));
vi.mock('../src/api/assetApi', () => ({ assetApi: { content: vi.fn(), upload: vi.fn() } }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn() } }));
const oldFile = { asset_id: 'asset:old', file_name: 'CV-old.pdf', content_type: 'application/pdf', size: 100 };
const newFile = { ...oldFile, asset_id: 'asset:new', file_name: 'CV-new.pdf' };
const job = { _id: 'job:live', title: 'Công việc sau merge', company_name: 'Doanh nghiệp từ API', required_skills: ['React'], optional_skills: [], status: 'OPEN', deadline: '2099-10-30T00:00:00Z', application_available: true, requirements: {} };
const renderDetail = () => render(<MemoryRouter initialEntries={['/jobs/job%3Alive']}><Routes><Route path="/jobs/:id" element={<JobDetails />} /></Routes></MemoryRouter>);
let current;
beforeEach(() => {
  vi.clearAllMocks();
  current = { _id: 'application:pair:test', _rev: '4-withdrawn', job_id: job._id, current_stage: 'WITHDRAWN', applied_at: '2026-10-25T00:00:00Z', submission: { resume_file: oldFile, cover_letter: 'Thư lần trước' }, stage_history: [] };
  jobApi.publicDetail.mockResolvedValue(job);
  applicationApi.mine.mockImplementation(async () => ({ items: [current] }));
  applicationApi.context.mockResolvedValue({ candidate: { profile: { full_name: 'Nguyễn An' }, skills: [], resume_file: newFile }, email: 'candidate@example.invalid' });
  applicationApi.apply.mockImplementation(async () => {
    const previous = { ...current, attempt_number: 1 };
    current = { ...current, _rev: '5-new', current_stage: 'APPLIED', submission: { resume_file: newFile }, previous_attempts: [previous] };
    return current;
  });
});
it('keeps the dev detail layout and restores CV access, reapply revision and archived attempt history', async () => {
  const { container } = renderDetail();
  await screen.findByRole('heading', { name: job.title });
  expect(container.querySelector('main').className).toContain('bg-[#CDEAF4]');
  expect(screen.getByRole('heading', { name: 'Tóm tắt công việc' })).toBeTruthy();
  fireEvent.click(screen.getByText('Xem CV và thư giới thiệu đã nộp'));
  expect(screen.getByRole('button', { name: 'Xem CV' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tải CV: CV-old.pdf' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ứng tuyển lại' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Dùng CV từ hồ sơ: CV-new.pdf' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }));
  await waitFor(() => expect(applicationApi.apply).toHaveBeenCalledWith(expect.objectContaining({ job_id: job._id, expected_rev: '4-withdrawn', request_id: expect.any(String), submission: { resume_file_id: newFile.asset_id } })));
  await screen.findByRole('heading', { name: 'Lịch sử các lần ứng tuyển (1)' });
  expect(screen.queryByRole('button', { name: 'Ứng tuyển lại' })).toBeNull();
});
it('keeps a closed job readable through the Candidate application history only', async () => {
  const closedJob = { ...job, status: 'CLOSED' };
  jobApi.publicDetail.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
  current = { ...current, job: closedJob };
  renderDetail(); await screen.findByRole('heading', { name: job.title });
  expect(applicationApi.mine).toHaveBeenCalledWith({ job_id: job._id, limit: 20 });
  expect(screen.getByText(/đã đóng tin/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'á»¨ng tuyá»ƒn láº¡i' })).toBeNull();
  expect(applicationApi.apply).not.toHaveBeenCalled();
});
