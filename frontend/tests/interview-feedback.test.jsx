import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { interviewApi } from '../src/api/jobApplicationApi';
import InterviewRounds from '../src/features/interviews/components/InterviewRounds';

vi.mock('../src/api/jobApplicationApi', () => ({
  interviewApi: { listFeedback: vi.fn(), complete: vi.fn() },
}));

const scope = { application_id: 'application:one', application_attempt: 2 };
const items = [1, 2].map(round => ({
  _id: `interview:${round}`, round, interview_type: 'TECHNICAL', scheduled_at: '2027-01-02T02:30:00Z',
}));
const pending = items.map(({ _id, round }) => ({ _id, round, status: 'PENDING' }));
const legacy = { ...pending[0], status: 'COMPLETED', score: 73, result: 'FAILED', completed_at: items[0].scheduled_at };
const completed = { ...pending[1], status: 'COMPLETED', score: 80, feedback: 'Bằng chứng', result: 'PASSED', completed_at: items[1].scheduled_at };

const response = items => ({ ...scope, items });
const renderRounds = (props = {}) => render(<InterviewRounds
  applicationId={scope.application_id} applicationAttempt={scope.application_attempt}
  items={items} canEdit onSaved={vi.fn()} {...props}
/>);

async function open() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận đánh giá vòng 2' }));
  return screen.getByRole('form', { name: 'Đánh giá vòng 2' });
}

function fill(feedback = '  Bằng chứng  ') {
  fireEvent.click(screen.getByRole('radio', { name: '4 sao' }));
  fireEvent.change(screen.getByLabelText('Bằng chứng đánh giá'), { target: { value: feedback } });
  fireEvent.change(screen.getByLabelText('Kết quả phỏng vấn'), { target: { value: 'PASSED' } });
}

beforeEach(() => {
  vi.resetAllMocks();
  interviewApi.listFeedback.mockResolvedValue(response(pending));
});

it('validates evidence and sends exactly one request for the selected round', async () => {
  let resolve;
  interviewApi.complete.mockImplementation(() => new Promise(done => { resolve = done; }));
  const refresh = vi.fn();
  renderRounds({ onSaved: refresh });
  const form = await open();
  fireEvent.change(screen.getByLabelText('Bằng chứng đánh giá'), { target: { value: 'Bằng chứng' } });
  fireEvent.submit(form);
  expect(interviewApi.complete).not.toHaveBeenCalled();
  fill('  ');
  fireEvent.submit(form);
  expect(screen.getByRole('alert').textContent).toContain('2.000');
  expect(screen.getByLabelText('Bằng chứng đánh giá').maxLength).toBe(2000);
  expect(interviewApi.complete).not.toHaveBeenCalled();
  fill();
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(interviewApi.complete).toHaveBeenCalledExactlyOnceWith(
    'interview:2', { rating: 4, feedback: 'Bằng chứng', result: 'PASSED' }, expect.any(AbortSignal),
  );
  interviewApi.listFeedback.mockResolvedValue(response([pending[0], completed]));
  await act(async () => resolve(completed));
  await screen.findByText('Đạt · 80/100');
  expect(refresh).toHaveBeenCalledOnce();
});

it('keeps the draft after a timeline error or lost response and retries on demand', async () => {
  interviewApi.complete
    .mockRejectedValueOnce(Object.assign(new Error('Chưa tới giờ phỏng vấn'), { status: 422 }))
    .mockRejectedValueOnce(new Error('Mất kết nối'))
    .mockResolvedValueOnce(completed);
  const refresh = vi.fn();
  renderRounds({ onSaved: refresh });
  const form = await open();
  fill();
  fireEvent.submit(form);
  await screen.findByText('Chưa tới giờ phỏng vấn');
  fireEvent.submit(form);
  await screen.findByText('Mất kết nối');
  expect(interviewApi.complete).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Bằng chứng đánh giá').value).toBe('  Bằng chứng  ');
  expect(screen.getByLabelText('Kết quả phỏng vấn').value).toBe('PASSED');
  expect(screen.getByRole('radio', { name: '4 sao' }).checked).toBe(true);
  fireEvent.submit(form);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(interviewApi.complete.mock.calls.map(([, body]) => body)).toEqual(Array(3).fill({
    rating: 4, feedback: 'Bằng chứng', result: 'PASSED',
  }));
});

it('refreshes a conflict and shows the existing completion without replacing its score', async () => {
  interviewApi.complete.mockRejectedValue(Object.assign(new Error('Xung đột'), { status: 409 }));
  interviewApi.listFeedback.mockResolvedValueOnce(response(pending))
    .mockResolvedValue(response([pending[0], { ...legacy, _id: pending[1]._id, round: 2 }]));
  renderRounds();
  const form = await open();
  fill();
  fireEvent.submit(form);
  await screen.findByText('Không đạt · 73/100');
  expect(screen.queryByRole('form')).toBeNull();
  expect(await screen.findByText(/đã được ghi nhận đánh giá/)).toBeTruthy();
});

it('rejects feedback for a different attempt and shows read-only results after a stage change', async () => {
  interviewApi.listFeedback.mockResolvedValueOnce({ ...response([legacy, pending[1]]), application_attempt: 1 });
  const first = renderRounds();
  await screen.findByText(/Đánh giá thuộc lượt ứng tuyển khác/);
  expect(screen.queryByText('Không đạt · 73/100')).toBeNull();
  first.unmount();
  interviewApi.listFeedback.mockResolvedValue(response([legacy, pending[1]]));
  renderRounds({ canEdit: false });
  await screen.findByText('Không đạt · 73/100');
  expect(screen.queryByRole('button', { name: /Ghi nhận đánh giá/ })).toBeNull();
});

it('aborts an in-flight save on close and ignores its delayed result', async () => {
  let resolve;
  interviewApi.complete.mockImplementation(() => new Promise(done => { resolve = done; }));
  const refresh = vi.fn();
  renderRounds({ onSaved: refresh });
  const form = await open();
  fill();
  fireEvent.submit(form);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng đánh giá' }));
  expect(interviewApi.complete.mock.calls[0][2].aborted).toBe(true);
  await act(async () => resolve(completed));
  expect(refresh).not.toHaveBeenCalled();
  await screen.findByRole('button', { name: 'Ghi nhận đánh giá vòng 2' });
});
