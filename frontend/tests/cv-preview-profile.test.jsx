import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ViewAssetButton from '../src/components/uploads/ViewAssetButton';
import Profile from '../src/pages/Profile';
import { assetApi } from '../src/api/assetApi';
import api from '../src/services/api';

vi.mock('../src/api/assetApi', () => ({ assetApi: { content: vi.fn(), preview: vi.fn(), upload: vi.fn() } }));
vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { name: 'Nguyễn An', email: 'an@example.invalid' } }) }));
const asset = { asset_id: 'asset:test', file_name: 'CV.pdf', content_type: 'application/pdf' };
const candidate = () => ({ profile: { full_name: 'Nguyễn An', role: 'Engineer', industry: 'IT', seniority: 'JUNIOR', years_experience: 0, experience_months: 0 }, skills: [{ name: 'React', normalized: 'react' }], languages: [], experience: [], projects: [], education: [] });
beforeEach(() => {
  vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:cv'); URL.revokeObjectURL = vi.fn();
  assetApi.content.mockResolvedValue(new Blob(['PDF'])); assetApi.preview.mockResolvedValue({ text: '<script>literal content</script>' });
  api.get.mockResolvedValue({ data: { data: { profile: candidate() } }, headers: { etag: '"2-current"' } });
});
it('opens authenticated PDF in browser without downloading and releases blob when closed', async () => {
  render(<ViewAssetButton asset={asset} />);
  expect(assetApi.content).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xem CV' }));
  expect((await screen.findByTitle('CV: CV.pdf')).src).toContain('blob:cv');
  expect(assetApi.content).toHaveBeenCalledTimes(1); expect(assetApi.preview).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng bản xem CV' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cv'); expect(screen.queryByRole('dialog')).toBeNull();
});
it('renders Word content as escaped text and reports API permission failures', async () => {
  const { unmount } = render(<ViewAssetButton asset={{ ...asset, file_name: 'CV.docx', content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xem CV' }));
  await screen.findByText('<script>literal content</script>'); expect(document.querySelector('dialog script')).toBeNull();
  expect(assetApi.content).not.toHaveBeenCalled(); unmount();
  assetApi.content.mockRejectedValue(new Error('Bạn không có quyền tải file này.'));
  render(<ViewAssetButton asset={asset} />); fireEvent.click(screen.getByRole('button', { name: 'Xem CV' }));
  expect((await screen.findByRole('alert')).textContent).toContain('không có quyền');
});
it('profile starts read-only, provides five tabs and retains edits across tabs until cancel', async () => {
  render(<MemoryRouter><Profile /></MemoryRouter>);
  const name = await screen.findByLabelText('Họ và tên'); expect(name.readOnly).toBe(true);
  expect(screen.getAllByRole('tab')).toHaveLength(5); expect(screen.queryByRole('button', { name: 'Thay ảnh đại diện' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
  expect(screen.getByRole('button', { name: 'Thay ảnh đại diện' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Tên đang sửa' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Kỹ năng & Chuyên môn' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thêm ngoại ngữ' }));
  fireEvent.change(screen.getByLabelText('Ngoại ngữ 1'), { target: { value: 'English' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Thông tin chung' }));
  expect(screen.getByLabelText('Họ và tên').value).toBe('Tên đang sửa');
  fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
  await waitFor(() => expect(screen.getByLabelText('Họ và tên').value).toBe('Nguyễn An'));
  expect(screen.getByLabelText('Họ và tên').readOnly).toBe(true); expect(api.patch).not.toHaveBeenCalled();
});
