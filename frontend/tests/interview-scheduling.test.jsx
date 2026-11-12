import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { interviewApi } from '../src/api/jobApplicationApi';
import InterviewSchedule from '../src/features/interviews/components/InterviewSchedule';

vi.mock('../src/api/jobApplicationApi', () => ({
  interviewApi: { list: vi.fn(), create: vi.fn(), listFeedback: vi.fn() },
}));

const scope = { application_id: 'application:one', application_attempt: 1 };
const empty = { ...scope, items: [], next_round: 1 };
const firstRound = { _id: 'interview:one', round: 1, interview_type: 'TECHNICAL', scheduled_at: '2027-01-02T02:30:00Z' };
const payload = {
  application_id: 'application:one',
  round: 1,
  interview_type: 'TECHNICAL',
  scheduled_at: '2027-01-02T09:30:00+07:00',
};

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Lên lịch phỏng vấn' }));
  fireEvent.change(screen.getByLabelText(/Ngày giờ phỏng vấn/), { target: { value: '2027-01-02T09:30' } });
  return screen.getByRole('button', { name: 'Lưu lịch' }).closest('form');
}

describe('Recruiter interview scheduling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    interviewApi.list.mockResolvedValue(empty);
    interviewApi.listFeedback.mockResolvedValue({ ...scope, items: [] });
  });

  it('prevents double-submit and sends the server round and displayed timezone', async () => {
    let complete;
    interviewApi.create.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const refresh = vi.fn();
    render(<InterviewSchedule applicationId="application:one" onScheduled={refresh} />);
    const form = await openForm();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(interviewApi.create).toHaveBeenCalledExactlyOnceWith(payload, expect.any(AbortSignal));
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => complete({ created: true }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retains the payload after a lost response and retries only on submit', async () => {
    interviewApi.create.mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValueOnce({ idempotent: true });
    const refresh = vi.fn();
    render(<InterviewSchedule applicationId="application:one" onScheduled={refresh} />);
    const form = await openForm();
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toContain('Mất kết nối');
    expect(interviewApi.create).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Ngày giờ phỏng vấn/).value).toBe('2027-01-02T09:30');
    fireEvent.submit(form);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(interviewApi.create.mock.calls.map(([body]) => body)).toEqual([payload, payload]);
  });

  it('reloads a conflict and uses the new next round', async () => {
    interviewApi.list.mockResolvedValueOnce(empty).mockResolvedValue({ ...scope, items: [firstRound], next_round: 2 });
    interviewApi.create.mockRejectedValue(Object.assign(new Error('Vòng này đã được đặt.'), { status: 409 }));
    render(<InterviewSchedule applicationId="application:one" onScheduled={vi.fn()} />);
    fireEvent.submit(await openForm());
    await screen.findByText(/Vòng 1 · Kỹ thuật/);
    expect(screen.getByRole('alert').textContent).toContain('Vòng này đã được đặt.');
    fireEvent.click(screen.getByRole('button', { name: 'Lên lịch phỏng vấn' }));
    expect(screen.getByText('Lên lịch vòng 2')).toBeTruthy();
  });

  it('discards a delayed result after the applicant changes', async () => {
    let complete;
    interviewApi.create.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const refresh = vi.fn();
    const { rerender } = render(<InterviewSchedule key="one" applicationId="application:one" onScheduled={refresh} />);
    fireEvent.submit(await openForm());
    const signal = interviewApi.create.mock.calls[0][1];
    interviewApi.list.mockResolvedValue({ ...empty, application_id: 'application:two' });
    rerender(<InterviewSchedule key="two" applicationId="application:two" onScheduled={refresh} />);
    expect(signal.aborted).toBe(true);
    await act(async () => complete({ created: true }));
    await screen.findByRole('button', { name: 'Lên lịch phỏng vấn' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
