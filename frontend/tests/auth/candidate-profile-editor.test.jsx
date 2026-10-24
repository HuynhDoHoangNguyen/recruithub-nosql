import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../../src/pages/Profile';
import api from '../../src/services/api';
import { candidateProfilePatch, hasInvalidDateRange } from '../../src/utils/candidateProfileForm';

vi.mock('../../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

const existingCandidate = () => ({
  profile: { full_name: 'Nguyễn An', role: 'Backend Engineer', industry: 'Công nghệ', seniority: 'MID', years_experience: 3, experience_months: 36, summary: 'Kinh nghiệm API' },
  skills: [{ name: 'Node.js', normalized: 'node.js' }],
  education: [{ degree: 'BACHELOR', institution: 'Đại học A', field_of_study: 'CNTT', start_date: '2018-09', end_date: '2022-06' }],
  experience: [{ employer: 'Công ty A', role: 'Kỹ sư', start_date: '2022-07', description: 'Xây dựng API' }],
  projects: [{ name: 'Hệ thống cũ', technologies: ['CouchDB', 'Node.js'], role: 'Lead', description: 'Giữ thông tin cũ', provenance: { classification: 'mixed', field_origins: { name: 'candidate_self_service' } } }],
  data_availability: { skills: 'AVAILABLE', experience: 'AVAILABLE', education: 'AVAILABLE', projects: 'AVAILABLE' },
});

const profileResponse = (profile = existingCandidate(), etag = '"4-demo"') => ({ data: { data: { profile } }, headers: { etag } });
const renderProfile = () => render(<MemoryRouter><Profile /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(profileResponse());
});

describe('Candidate Profile field mapping and legacy preservation', () => {
  it('rejects reversed date ranges when dates are edited and leaves untouched legacy dates alone', () => {
    expect(hasInvalidDateRange([{ start_date: '2024-08', end_date: '2024-06' }])).toBe(true);
    expect(hasInvalidDateRange(
      [{ start_date: '2024-08', end_date: '2024-06' }],
      [{ start_date: '2024-08', end_date: '2024-06' }],
    )).toBe(false);
    expect(hasInvalidDateRange([{ start_date: '2024-02-29', end_date: '2024-03-01' }])).toBe(false);
    expect(hasInvalidDateRange([{ start_date: '2024-02-30', end_date: '2024-03-01' }])).toBe(true);
  });

  it('blocks a reversed education date range before sending a PATCH', async () => {
    const user = userEvent.setup();
    renderProfile();
    const endDate = await screen.findByLabelText('Ngày kết thúc (nếu có)');
    await user.clear(endDate);
    await user.type(endDate, '2018-01');
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ngày kết thúc không được trước ngày bắt đầu.');
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('sends only changed collections and retains untouched nested profile data', () => {
    const baseline = existingCandidate();
    const edited = structuredClone(baseline);
    edited.experience[0].role = 'Senior Engineer';
    const patch = candidateProfilePatch(edited, baseline);
    expect(patch.experience).toEqual([{ ...baseline.experience[0], role: 'Senior Engineer' }]);
    expect(patch).not.toHaveProperty('skills');
    expect(patch).not.toHaveProperty('education');
    expect(patch).not.toHaveProperty('projects');
    expect(patch.profile.years_experience).toBe(3);
  });

  it('maps edited project controls back to the schema array while retaining untouched legacy properties', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: { data: {} }, headers: { etag: '"5-demo"' } });
    api.get.mockResolvedValueOnce(profileResponse()).mockResolvedValueOnce(profileResponse(existingCandidate(), '"5-demo"'));
    renderProfile();
    const nameField = await screen.findByLabelText('Tên dự án');
    await user.clear(nameField);
    await user.type(nameField, 'Hệ thống nâng cấp');
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const [path, payload, options] = api.patch.mock.calls[0];
    expect(path).toBe('/v1/candidate/profile/me');
    expect(payload.projects).toEqual([{
      ...existingCandidate().projects[0], name: 'Hệ thống nâng cấp',
    }]);
    expect(options.headers['If-Match']).toBe('"4-demo"');
  });

  it('preserves local edits and reports ETag conflict without overwriting them', async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue({ response: { status: 409, data: { error: { code: 'REVISION_CONFLICT' } } } });
    renderProfile();
    const roleField = await screen.findByLabelText('Vị trí mong muốn');
    await user.clear(roleField);
    await user.type(roleField, 'Architect');
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    expect((await screen.findByRole('alert')).textContent).toContain('đã được thay đổi ở phiên khác');
    expect(screen.getByLabelText('Vị trí mong muốn').value).toBe('Architect');
    expect(screen.getByRole('button', { name: 'Tải phiên bản mới' })).toBeTruthy();
    expect(api.patch.mock.calls[0][2].headers['If-Match']).toBe('"4-demo"');
  });

  it('keeps edits after a non-conflict save error and cancel restores the loaded values', async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue({ response: { status: 503, data: { error: { message: 'Dịch vụ tạm thời không khả dụng.' } } } });
    renderProfile();
    const roleField = await screen.findByLabelText('Vị trí mong muốn');
    await user.clear(roleField);
    await user.type(roleField, 'Platform Engineer');
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Dịch vụ tạm thời không khả dụng.');
    expect(screen.getByLabelText('Vị trí mong muốn').value).toBe('Platform Engineer');
    await user.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(screen.getByLabelText('Vị trí mong muốn').value).toBe('Backend Engineer');
  });

  it('allows removing an individual skill and sends an empty array without changing other collections', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: { data: {} } });
    api.get.mockResolvedValueOnce(profileResponse()).mockResolvedValueOnce(profileResponse(existingCandidate(), '"5-demo"'));
    renderProfile();
    await screen.findByLabelText('Tên kỹ năng 1');
    await user.click(screen.getByRole('button', { name: 'Xóa kỹ năng 1' }));
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch.mock.calls[0][1].skills).toEqual([]);
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty('education');
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty('projects');
  });
});
