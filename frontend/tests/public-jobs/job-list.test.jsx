import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import JobList from '../../src/pages/Jobs/JobList';
import { listPublicJobs } from '../../src/services/publicJobsApi';
import { jobApi } from '../../src/api/jobApplicationApi';

vi.mock('../../src/services/publicJobsApi', () => ({ isPublicJobsMockMode: false, listPublicJobs: vi.fn() }));
vi.mock('../../src/api/jobApplicationApi', () => ({ jobApi: { metadata: vi.fn() } }));

function LocationText() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderJobs(entry = '/jobs') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/jobs" element={<><JobList /><LocationText /></>} />
  </Routes></MemoryRouter>);
}
const searchInput = () => screen.getAllByLabelText('Từ khóa')[0];

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  listPublicJobs.mockResolvedValue({ jobs: [], total: null, nextPage: null });
  jobApi.metadata.mockResolvedValue({ skills: ['JavaScript', 'SQL'], industries: ['SaaS'], locations: [{ value: 'VN-HN', label: 'Hà Nội' }], work_modes: [{ value: 'REMOTE', label: 'Remote' }], seniorities: [{ value: 'MID', label: 'Có kinh nghiệm' }] });
});

describe('Public Job search UI', () => {
  it('restores filters from URL and requests them from the API', async () => {
    renderJobs('/jobs?q=Backend&skills=JavaScript%2C%20SQL&industry=SaaS&seniority=MID');

    expect(searchInput().value).toBe('Backend');
    expect(screen.getByLabelText('Kỹ năng').value).toBe('JavaScript, SQL');

    expect(screen.getByLabelText('Ngành nghề').value).toBe('SaaS');
    expect(screen.getByLabelText('Cấp độ').value).toBe('MID');
    await waitFor(() => expect(listPublicJobs).toHaveBeenCalledWith(expect.objectContaining({
      search: 'Backend', skills: 'JavaScript,SQL', industry: 'SaaS', seniority: 'MID', page: 1, pageSize: 12,
    })));
  });

  it('clears all filters and URL query values on reset', async () => {
    renderJobs('/jobs?q=Backend&skills=JavaScript&industry=SaaS&seniority=MID');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe(''));

    expect(searchInput().value).toBe('');
    expect(screen.getByLabelText('Kỹ năng').value).toBe('');

    expect(screen.getByLabelText('Ngành nghề').value).toBe('');
    expect(screen.getByLabelText('Cấp độ').value).toBe('');
  });

  it('shows the empty state without inventing an exact total', async () => {
    renderJobs();
    expect(await screen.findByText('Chưa tìm thấy việc làm phù hợp')).toBeTruthy();
    expect(screen.queryByText(/vị trí phù hợp/)).toBeNull();
  });

  it('starts over from page one when a filter changes', async () => {
    listPublicJobs
      .mockResolvedValueOnce({ jobs: [{ id: 'job:first', title: 'First job', status: 'OPEN', industry: 'SaaS', seniority: 'MID', requiredSkills: [] }], nextPage: 'cursor-next' })
      .mockResolvedValue({ jobs: [{ id: 'job:filtered', title: 'Filtered job', status: 'OPEN', industry: 'SaaS', seniority: 'MID', requiredSkills: [] }], nextPage: null });
    renderJobs();
    expect(await screen.findByText('First job')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(listPublicJobs).toHaveBeenCalledTimes(2));
    expect(listPublicJobs.mock.calls[1][0]).toMatchObject({ page: 2, bookmark: 'cursor-next' });
    fireEvent.change(screen.getByLabelText('Cấp độ'), { target: { value: 'MID' } });
    await waitFor(() => expect(listPublicJobs).toHaveBeenCalledTimes(3));
    expect(listPublicJobs.mock.calls[2][0]).toMatchObject({ page: 1, bookmark: undefined, seniority: 'MID' });
  });

  it('ignores a stale response after a newer debounced search finishes', async () => {
    vi.useFakeTimers();
    let resolveOld;
    let resolveNew;
    listPublicJobs.mockImplementation(({ search }) => new Promise(resolve => {
      if (search === 'React') resolveNew = resolve;
      else resolveOld = resolve;
    }));
    renderJobs();
    await act(async () => {});
    fireEvent.change(searchInput(), { target: { value: 'React' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    await act(async () => { resolveNew({ jobs: [{ id: 'job:new', title: 'React Engineer', status: 'OPEN', industry: 'SaaS', seniority: 'MID', requiredSkills: [] }], nextPage: null }); });
    expect(screen.getByText('React Engineer')).toBeTruthy();
    await act(async () => { resolveOld({ jobs: [{ id: 'job:old', title: 'Old result', status: 'OPEN', industry: 'SaaS', seniority: 'MID', requiredSkills: [] }], nextPage: null }); });
    expect(screen.queryByText('Old result')).toBeNull();
    expect(screen.getByText('React Engineer')).toBeTruthy();
  });

  it('submits skill and industry drafts together, then keeps them when selecting a location', async () => {
    renderJobs();
    fireEvent.change(searchInput(), { target: { value: 'Backend' } });
    fireEvent.change(screen.getByLabelText('Kỹ năng'), { target: { value: 'JavaScript, SQL' } });
    fireEvent.change(screen.getByLabelText('Ngành nghề'), { target: { value: 'SaaS' } });
    fireEvent.submit(searchInput().closest('form'));
    await waitFor(() => expect(listPublicJobs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Backend', skills: 'JavaScript,SQL', industry: 'SaaS', page: 1 })));
    fireEvent.change(screen.getByLabelText('Địa điểm'), { target: { value: 'VN-HN' } });
    await waitFor(() => expect(listPublicJobs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Backend', skills: 'JavaScript,SQL', industry: 'SaaS', location: 'VN-HN', bookmark: undefined })));
    expect(screen.getByRole('heading', { name: 'Job Search Dashboard' })).toBeTruthy();
  });
});
