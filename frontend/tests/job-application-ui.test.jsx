import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { applicationApi, jobApi } from '../src/api/jobApplicationApi';
import ApplyModal from '../src/features/applications/components/ApplyModal';
import ApplicantDetailModal from '../src/features/applications/components/ApplicantDetailModal';
import ApplicationTimeline from '../src/features/applications/components/ApplicationTimeline';
import WithdrawButton from '../src/features/applications/components/WithdrawButton';
import JobForm from '../src/features/jobs/components/JobForm';
import { jobPayload, fromJob, jobErrorsFromApi, validateJobForm } from '../src/features/jobs/jobFormModel';
import { deadlineIsOpen } from '../src/features/applications/applicationPresentation';
import { Resource } from '../src/features/applications/components/ApplicationUI';
import AppRoutes from '../src/routes/AppRoutes';
import { removeAccessToken, setAccessToken } from '../src/utils/authHelper';

vi.mock('../src/api/jobApplicationApi', () => ({
  jobApi: { metadata: vi.fn(), context: vi.fn(), list: vi.fn(), stats: vi.fn(), detail: vi.fn(), create: vi.fn(), edit: vi.fn(), status: vi.fn(), publicList: vi.fn(), publicDetail: vi.fn() },
  applicationApi: { stats: vi.fn(), context: vi.fn(), apply: vi.fn(), mine: vi.fn(), detail: vi.fn(), applicants: vi.fn(), withdraw: vi.fn(), transition: vi.fn() },
}));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: window.__verifiedTestUser || null, loading: false, logout: vi.fn() }) }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const job = { _id: 'job:cms:J_000001', _rev: '1-fixture', title: 'Kỹ sư Backend', seniority: 'MID', industry: 'SaaS', description: 'Phát triển API',
  status: 'OPEN', deadline: '2026-11-30T23:59:00Z', responsibilities: [], required_skills: ['javascript'], optional_skills: [],
  requirements: { general: [], experience: { status: 'NO_MINIMUM' }, education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } } };
const candidate = { profile: { role: 'Backend Engineer', years_experience: 2 }, skills: [{ name: 'JavaScript' }] };
const application = { _id: 'application:pair:test', _rev: '1-fixture', current_stage: 'APPLIED', job_id: job._id, job, candidate,
  email: 'test@example.invalid', applied_at: '2026-10-22T12:00:00Z', allowed_transitions: ['SCREENING', 'REJECTED'],
  submission: { resume_text: 'CV đã lưu', cover_letter: 'Thư giới thiệu đã lưu' },
  stage_history: [{ from_stage: null, to_stage: 'APPLIED', timestamp: '2026-10-22T12:00:00Z', actor_role: 'CANDIDATE' }] };

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); removeAccessToken(); window.__verifiedTestUser = null; applicationApi.context.mockResolvedValue({ candidate, email: application.email });
  jobApi.metadata.mockResolvedValue({ locations: [{ value: 'VN-HN', label: 'Hà Nội' }], work_modes: [{ value: 'REMOTE', label: 'Remote' }], skills: ['javascript'], industries: ['SaaS'], seniorities: [] });
  jobApi.publicList.mockResolvedValue({ items: [] });
  jobApi.context.mockResolvedValue({ company: { name: 'Công ty kiểm thử' }, department: { name: 'Kỹ thuật' } });
  applicationApi.stats.mockResolvedValue({ total_applications: 25, by_stage: { APPLIED: 24, WITHDRAWN: 1 } });
});

describe('deadline precision when editing jobs', () => {
  const precise = { ...job, deadline: '2026-11-30T23:59:59.123Z' };
  it.each(['title', 'description'])('preserves seconds and milliseconds when only %s changes', field => {
    const form = fromJob(precise);
    form[field] = 'Nội dung mới';
    expect(jobPayload(form, precise).deadline).toBe(precise.deadline);
  });
  it('restores the original timestamp after changing then restoring the displayed input', () => {
    const form = fromJob(precise);
    const original = form.deadline;
    form.deadline = '2026-12-02T09:30';
    expect(jobPayload(form, precise).deadline).toBe('2026-12-02T02:30:00.000Z');
    form.deadline = original;
    expect(jobPayload(form, precise).deadline).toBe(precise.deadline);
  });
  it('converts a new job deadline from Vietnam time across the UTC date boundary', () => {
    const form = fromJob(job);
    form.deadline = '2026-12-02T02:30';
    expect(jobPayload(form).deadline).toBe('2026-12-01T19:30:00.000Z');
    expect(jobPayload(form).status).toBe('OPEN');
  });
  it('submits the original deadline through the actual edit form', async () => {
    jobApi.edit.mockResolvedValue(precise);
    const saved = vi.fn();
    render(<MemoryRouter><JobForm job={precise} onSaved={saved} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Tiêu đề công việc *'), { target: { value: 'Tiêu đề đã sửa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(jobApi.edit).toHaveBeenCalledWith(precise._id, expect.objectContaining({
      title: 'Tiêu đề đã sửa', deadline: precise.deadline, expected_rev: precise._rev,
    }));
  });
});

describe('Apply and submission', () => {
  it('loads the real profile, validates text, submits a strict DTO and disables while pending', async () => {
    const user = userEvent.setup();
    let resolve;
    applicationApi.apply.mockReturnValue(new Promise(done => { resolve = done; }));
    const onSubmitted = vi.fn();
    render(<ApplyModal job={job} onClose={vi.fn()} onSubmitted={onSubmitted} onRefresh={vi.fn()} />);
    await screen.findByText(application.email);
    const submit = screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' });
    fireEvent.submit(submit.closest('form')); expect(await screen.findByText('Đính kèm file CV hoặc nhập CV văn bản.')).toBeTruthy();
    expect(applicationApi.apply).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('CV văn bản (khi không đính kèm file)'), 'CV gửi nhà tuyển dụng');
    await user.type(screen.getByLabelText('Thư giới thiệu (không bắt buộc)'), 'Xin chào');
    await user.click(submit);
    expect(screen.getByRole('button', { name: 'Đang nộp…' }).disabled).toBe(true);
    expect(applicationApi.apply).toHaveBeenCalledWith({ job_id: job._id, request_id: expect.any(String), submission: { resume_text: 'CV gửi nhà tuyển dụng', cover_letter: 'Xin chào' } });
    resolve(application); await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(application));
  });
  it('shows duplicate feedback and refreshes current state without claiming success', async () => {
    applicationApi.apply.mockRejectedValue(Object.assign(new Error('Bạn đã nộp hồ sơ.'), { status: 409, code: 'DUPLICATE_APPLICATION' }));
    const refresh = vi.fn(); const submitted = vi.fn();
    render(<ApplyModal job={job} onClose={vi.fn()} onSubmitted={submitted} onRefresh={refresh} />);
    fireEvent.change(await screen.findByLabelText('CV văn bản (khi không đính kèm file)'), { target: { value: 'CV' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }).closest('form'));
    await screen.findByText('Bạn đã nộp hồ sơ.'); expect(refresh).toHaveBeenCalledOnce(); expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }).disabled).toBe(true);
  });
});

it('withdraw asks for confirmation, keeps the application and submits expected revision/stage', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const reload = vi.fn(); applicationApi.withdraw.mockResolvedValue({ ...application, current_stage: 'WITHDRAWN' });
  render(<WithdrawButton application={application} onChanged={reload} />);
  fireEvent.click(screen.getByText('Rút đơn ứng tuyển')); expect(applicationApi.withdraw).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); fireEvent.click(screen.getByText('Rút đơn ứng tuyển'));
  await waitFor(() => expect(applicationApi.withdraw).toHaveBeenCalledWith(application)); expect(reload).toHaveBeenCalledOnce(); confirm.mockRestore();
});

it('terminal timeline has a distinct end branch and no withdrawal button', () => {
  const terminal = { ...application, current_stage: 'REJECTED', stage_history: [...application.stage_history,
    { from_stage: 'APPLIED', to_stage: 'REJECTED', timestamp: '2026-10-22T13:00:00Z', actor_role: 'RECRUITER' }] };
  render(<><ApplicationTimeline application={terminal} /><WithdrawButton application={terminal} onChanged={vi.fn()} /></>);
  expect(screen.getByRole('list', { name: 'Các bước tuyển dụng' }).children.length).toBe(5);
  expect(screen.getByText('Kết thúc hồ sơ:')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Rút đơn ứng tuyển' })).toBeNull();
});

it('recruiter reads saved CV and uses only server-approved transitions with rejection reason validation', async () => {
  applicationApi.detail.mockResolvedValue(application); applicationApi.transition.mockResolvedValue(application);
  const changed = vi.fn(); render(<ApplicantDetailModal id={application._id} onClose={vi.fn()} onChanged={changed} />);
  expect(await screen.findByText('CV đã lưu')).toBeTruthy(); expect(screen.getByText('Thư giới thiệu đã lưu')).toBeTruthy();
  const select = screen.getByLabelText('Chuyển trạng thái');
  expect([...select.options].map(option => option.value)).toEqual(['', 'SCREENING', 'REJECTED']);
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }));
  expect(select.value).toBe('SCREENING');
  fireEvent.click(screen.getByRole('button', { name: 'Từ chối', exact: true }));
  expect(screen.getByText('Xác nhận chuyển trạng thái').disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Lý do từ chối *'), { target: { value: 'QUALIFICATIONS_MISMATCH' } });
  fireEvent.submit(screen.getByText('Xác nhận chuyển trạng thái').closest('form'));
  await waitFor(() => expect(applicationApi.transition).toHaveBeenCalledWith(application, { to_stage: 'REJECTED', reason_code: 'QUALIFICATIONS_MISMATCH' }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
});

it('explains missing current-attempt interview evidence and disables the visible offer action', async () => {
  applicationApi.detail.mockResolvedValue({ ...application, current_stage: 'INTERVIEW', allowed_transitions: ['OFFER', 'REJECTED'],
    interview_status: 'SCHEDULING_REQUIRED', offer_eligible: false, offer_blocker: 'Cần hoàn tất phỏng vấn của lần hiện tại.' });
  render(<ApplicantDetailModal id={application._id} onClose={vi.fn()} onChanged={vi.fn()} />);
  expect((await screen.findByRole('button', { name: 'Gửi đề nghị' })).disabled).toBe(true);
  expect(screen.getByText('Cần hoàn tất phỏng vấn của lần hiện tại.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Từ chối', exact: true }).disabled).toBe(false);
});

it('withdrawn job detail restores the reapply CTA with the archived attempt revision', async () => {
  verifiedUserFor('CANDIDATE');
  jobApi.publicDetail.mockResolvedValue(job); applicationApi.mine.mockResolvedValue({ items: [{ ...application, current_stage: 'WITHDRAWN' }] });
  render(<MemoryRouter initialEntries={['/jobs/job%3Acms%3AJ_000001']}><AppRoutes /></MemoryRouter>);
  const buttons = await screen.findAllByRole('button', { name: 'Ứng tuyển lại', exact: true });
  fireEvent.click(buttons[0]); await screen.findByLabelText('CV văn bản (khi không đính kèm file)');
  expect(screen.getByLabelText('CV văn bản (khi không đính kèm file)').value).toBe('');
});

it('conflicting transition reports the error and reloads the actual application', async () => {
  applicationApi.detail.mockResolvedValue(application);
  applicationApi.transition.mockRejectedValue(Object.assign(new Error('Tiến trình đã thay đổi.'), { status: 409 }));
  const changed = vi.fn(); render(<ApplicantDetailModal id={application._id} onClose={vi.fn()} onChanged={changed} />);
  fireEvent.change(await screen.findByLabelText('Chuyển trạng thái'), { target: { value: 'SCREENING' } });
  fireEvent.submit(screen.getByText('Xác nhận chuyển trạng thái').closest('form'));
  await screen.findByText('Tiến trình đã thay đổi.'); await waitFor(() => expect(applicationApi.detail).toHaveBeenCalledTimes(2));
  expect(changed).toHaveBeenCalledOnce();
});

it('job form rejects missing fields and converts Vietnam deadline to UTC with canonical conditional paths', async () => {
  render(<MemoryRouter><JobForm onSaved={vi.fn()} /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('button', { name: 'Tạo tin tuyển dụng' }).closest('form'));
  expect((await screen.findAllByText('Vui lòng nhập thông tin này.')).length).toBe(4); expect(jobApi.create).not.toHaveBeenCalled();
  const form = fromJob(job); form.experience_status = 'REQUIRED'; form.required_months = '12';
  expect(validateJobForm(form)).toEqual({});
  const payload = jobPayload(form); expect(payload.deadline).toBe(job.deadline.replace('00Z', '00.000Z'));
  expect(payload.requirements.experience).toEqual({ status: 'REQUIRED', required_months: 12 });
  expect(payload).not.toHaveProperty('company_id'); expect(payload).not.toHaveProperty('salary');
  expect(jobErrorsFromApi([{ field: 'requirements.project.required_technologies.1', message: 'Trùng kỹ năng' }])).toEqual({ required_technologies: 'Trùng kỹ năng' });
  expect(deadlineIsOpen(job, Date.parse(job.deadline))).toBe(true); expect(deadlineIsOpen(job, Date.parse(job.deadline) + 1)).toBe(false);
});

it('data states render loading, empty and retryable error explicitly', () => {
  const retry = vi.fn();
  const { rerender } = render(<Resource resource={{ loading: true }}>Success</Resource>); expect(screen.getByRole('status').textContent).toContain('Đang tải');
  rerender(<Resource resource={{ loading: false }} empty>Success</Resource>); expect(screen.getByText('Chưa có dữ liệu.')).toBeTruthy();
  rerender(<Resource resource={{ error: new Error('Không kết nối'), reload: retry }}>Success</Resource>);
  fireEvent.click(screen.getByText('Thử lại')); expect(retry).toHaveBeenCalledOnce();
  rerender(<Resource resource={{ loading: false }}>Success</Resource>); expect(screen.getByText('Success')).toBeTruthy();
});

const verifiedUserFor = role => { window.__verifiedTestUser = { id: 'user:test', role, account_status: 'ACTIVE' }; };
it('active router mounts recruiter edit and applicants for canonical roles', async () => {
  verifiedUserFor('RECRUITER'); setAccessToken('test-token'); jobApi.detail.mockResolvedValue(job);
  const { unmount } = render(<MemoryRouter initialEntries={['/recruiter/jobs/job%3Acms%3AJ_000001/edit']}><AppRoutes /></MemoryRouter>);
  expect(await screen.findByDisplayValue(job.title)).toBeTruthy(); expect(jobApi.detail).toHaveBeenCalledWith(job._id); unmount();
  applicationApi.applicants.mockResolvedValue({ job, items: [application], has_more: false });
  render(<MemoryRouter initialEntries={['/recruiter/jobs/job%3Acms%3AJ_000001/applicants']}><AppRoutes /></MemoryRouter>);
  expect(await screen.findByText('Xem CV và xử lý')).toBeTruthy(); expect(applicationApi.applicants).toHaveBeenCalledWith(job._id, expect.any(Object));
});

it('candidate tracker reloads persisted stage and CV after remount', async () => {
  verifiedUserFor('CANDIDATE'); setAccessToken('test-token');
  applicationApi.mine.mockResolvedValue({ items: [{ ...application, current_stage: 'WITHDRAWN' }], has_more: false });
  const mount = () => render(<MemoryRouter initialEntries={['/user/dashboard']}><AppRoutes /></MemoryRouter>);
  const first = mount();
  fireEvent.click(await screen.findByRole('button', { name: /Xem chi tiết, CV và lịch sử/ }));
  await screen.findByText('CV đã lưu'); expect(screen.queryByRole('button', { name: 'Rút đơn ứng tuyển' })).toBeNull(); first.unmount();
  mount();
  const expand = await screen.findByRole('button', { name: /Xem chi tiết, CV và lịch sử/ });
  expect(screen.queryByText('CV đã lưu')).toBeNull();
  fireEvent.click(expand); await screen.findByText('CV đã lưu'); expect(applicationApi.mine).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('region', { name: 'Thống kê toàn bộ hồ sơ của tôi' }).textContent).toContain('25');
  expect(screen.getByRole('button', { name: /Đã nộp/ }).textContent).toContain('24');
});

it('aggregate failure keeps saved applications visible and displays unknown totals with retry', async () => {
  verifiedUserFor('CANDIDATE'); setAccessToken('test-token');
  applicationApi.mine.mockResolvedValue({ items: [application], has_more: false });
  applicationApi.stats.mockRejectedValueOnce(new Error('Không tải được thống kê.'));
  render(<MemoryRouter initialEntries={['/user/dashboard']}><AppRoutes /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Xem chi tiết, CV và lịch sử/ }));
  await screen.findByText('CV đã lưu');
  await screen.findByText('Không tải được thống kê.');
  const stats = screen.getByRole('region', { name: 'Thống kê toàn bộ hồ sơ của tôi' });
  expect(stats.textContent).toContain('—');
  expect(stats.textContent).not.toContain('25');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(stats.textContent).toContain('25'));
});

it('historical catalog detail explains why Apply is disabled without submitting to another database', async () => {
  verifiedUserFor('CANDIDATE');
  jobApi.publicDetail.mockResolvedValue({ ...job, application_available: false, catalog_source: 'dataset' });
  applicationApi.mine.mockResolvedValue({ items: [] });
  render(<MemoryRouter initialEntries={['/jobs/job%3Acms%3AJ_000001']}><AppRoutes /></MemoryRouter>);
  const button = await screen.findByRole('button', { name: 'Nộp hồ sơ ứng tuyển' });
  expect(button.disabled).toBe(true);
  expect(screen.getByText(/Tin tham khảo từ bộ dữ liệu/)).toBeTruthy();
  expect(applicationApi.apply).not.toHaveBeenCalled();
});
