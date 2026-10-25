import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import HomeJobSearch from '../src/features/jobs/components/HomeJobSearch';
import ApplyModal from '../src/features/applications/components/ApplyModal';
import ReopenJobModal from '../src/features/jobs/components/ReopenJobModal';
import ApplicationAttempts from '../src/features/applications/components/ApplicationAttempts';
import { jobApi, applicationApi } from '../src/api/jobApplicationApi';
vi.mock('../src/api/jobApplicationApi', () => ({ jobApi: { metadata: vi.fn(), status: vi.fn() }, applicationApi: { context: vi.fn(), apply: vi.fn() } }));
const job = { _id: 'job:test', _rev: '3-test', title: 'Engineer', deadline: '2099-11-30T10:00:59.123Z' };
function Probe() { return <output data-testid="url">{useLocation().search}</output>; }
beforeEach(() => {
  vi.clearAllMocks();
  jobApi.metadata.mockResolvedValue({ skills: ['javascript', 'typescript'], locations: [{ value: 'VN-HN', label: 'Hà Nội' }] });
  applicationApi.context.mockResolvedValue({ candidate: { profile: {}, skills: [] }, email: 'candidate@example.invalid' });
});
it('home autocomplete supports keyboard selection, escape and transfers canonical skill and location', async () => {
  render(<MemoryRouter><HomeJobSearch /><Probe /></MemoryRouter>);
  const input = screen.getByRole('combobox', { name: 'Tìm công việc' });
  fireEvent.focus(input); await screen.findByRole('option', { name: 'javascript' });
  fireEvent.keyDown(input, { key: 'Escape' }); expect(input.getAttribute('aria-expanded')).toBe('false');
  fireEvent.change(input, { target: { value: 'java' } }); fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Địa điểm muốn ứng tuyển' }), { target: { value: 'VN-HN' } });
  fireEvent.click(screen.getByRole('button', { name: /Tìm Kiếm/ }));
  expect(screen.getByTestId('url').textContent).toContain('skills=javascript'); expect(screen.getByTestId('url').textContent).toContain('location=VN-HN');
});
it('reapply submits the withdrawn revision and keeps one idempotency key through a response-loss retry', async () => {
  applicationApi.apply.mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValue({ current_stage: 'APPLIED' });
  render(<ApplyModal job={job} previousApplication={{ _rev: '4-test' }} onClose={vi.fn()} onRefresh={vi.fn()} onSubmitted={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('CV văn bản (khi không đính kèm file)'), { target: { value: 'CV lần mới' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' })); await screen.findByText('Mất kết nối');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }));
  await waitFor(() => expect(applicationApi.apply).toHaveBeenCalledTimes(2));
  const payloads = applicationApi.apply.mock.calls.map(call => call[0]); expect(payloads[0].request_id).toBe(payloads[1].request_id);
  expect(payloads[0].expected_rev).toBe('4-test'); expect(payloads[0].submission.resume_text).toBe('CV lần mới');
});
it('reopen preserves deadline seconds when unchanged and sends expected revision', async () => {
  jobApi.status.mockResolvedValue({ ...job, status: 'OPEN' }); const changed = vi.fn();
  render(<ReopenJobModal job={job} onClose={vi.fn()} onChanged={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận mở lại tin' }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(jobApi.status).toHaveBeenCalledWith(job._id, 'OPEN', job._rev, job.deadline);
});
it('reopen rejects an expired deadline before submitting', async () => {
  render(<ReopenJobModal job={{ ...job, deadline: '2020-01-01T00:00:00Z' }} onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận mở lại tin' }));
  expect(await screen.findByText('Chọn hạn nộp trong tương lai trước khi mở lại tin.')).toBeTruthy(); expect(jobApi.status).not.toHaveBeenCalled();
});
it('reopen conflict refreshes the list and disables resubmission with a stale revision', async () => {
  jobApi.status.mockRejectedValue(Object.assign(new Error('Tin đã thay đổi.'), { status: 409 })); const changed = vi.fn();
  render(<ReopenJobModal job={job} onClose={vi.fn()} onChanged={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận mở lại tin' }));
  await screen.findByText('Danh sách đã được cập nhật. Đóng hộp thoại và kiểm tra tin trước khi mở lại.');
  expect(changed).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Xác nhận mở lại tin' }).disabled).toBe(true);
});
it('renders archived CV and history independently from the current attempt', () => {
  const at = '2026-10-25T00:00:00Z';
  render(<ApplicationAttempts application={{ previous_attempts: [{ attempt_number: 1, current_stage: 'WITHDRAWN', applied_at: at, submission: { resume_text: 'CV cũ giữ nguyên' }, stage_history: [{ from_stage: null, to_stage: 'APPLIED', timestamp: at }, { from_stage: 'APPLIED', to_stage: 'WITHDRAWN', timestamp: at }] }] }} />);
  expect(screen.getByText('CV cũ giữ nguyên')).toBeTruthy(); expect(screen.getByText(/Lần 1/)).toBeTruthy();
});
