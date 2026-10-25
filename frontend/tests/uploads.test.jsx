import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FileUpload from '../src/components/uploads/FileUpload';
import PrivateAssetImage from '../src/components/uploads/PrivateAssetImage';
import { fileValidation, MAX_FILE_BYTES } from '../src/components/uploads/fileValidation';
import ApplyModal from '../src/features/applications/components/ApplyModal';
import Profile from '../src/pages/Profile';
import { assetApi } from '../src/api/assetApi';
import { applicationApi } from '../src/api/jobApplicationApi';
import api from '../src/services/api';
import { candidateProfilePatch } from '../src/utils/candidateProfileForm';

vi.mock('../src/api/assetApi', () => ({ assetApi: { upload: vi.fn(), content: vi.fn(), preview: vi.fn() } }));
vi.mock('../src/api/jobApplicationApi', () => ({ applicationApi: { context: vi.fn(), apply: vi.fn() } }));
vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
const file = { asset_id: 'asset:11111111-1111-4111-8111-111111111111', file_name: 'CV.pdf', content_type: 'application/pdf', size: 100, sha256: 'a'.repeat(64) };
const base = () => ({ profile: { role: 'Engineer', seniority: 'MID', industry: 'IT', years_experience: 1, experience_months: 12 }, skills: [], experience: [], projects: [], education: [], data_availability: {} });
beforeEach(() => {
  vi.clearAllMocks(); assetApi.upload.mockResolvedValue(file); assetApi.content.mockResolvedValue(new Blob(['image']));
  applicationApi.context.mockResolvedValue({ candidate: base(), email: 'test@example.invalid' }); applicationApi.apply.mockResolvedValue({ current_stage: 'APPLIED' });
  api.get.mockResolvedValue({ data: { data: { profile: base() } }, headers: { etag: '"1-test"' } });
  api.patch.mockResolvedValue({}); URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn();
});
it('validates type, nonempty and strictly less than 5 MiB without requiring Windows MIME labels', () => {
  expect(fileValidation({ name: 'CV.DOCX', size: MAX_FILE_BYTES - 1 }, 'resume')).toBe('');
  expect(fileValidation({ name: 'a.pdf', size: MAX_FILE_BYTES }, 'resume')).toContain('dưới 5 MB');
  expect(fileValidation({ name: 'a.exe', size: 20 }, 'resume')).toContain('.doc');
  expect(fileValidation({ name: 'a.svg', size: 20 }, 'avatar')).toContain('JPG');
  expect(fileValidation({ name: 'a.pdf', size: 0 }, 'resume')).toContain('trống');
});
it('invalid selection displays a message and never reaches upload API', () => {
  render(<FileUpload kind="resume" label="Tải CV" onUploaded={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Tải CV'), { target: { files: [new File(['bad'], 'a.exe')] } });
  expect(screen.getByRole('alert').textContent).toContain('.doc'); expect(assetApi.upload).not.toHaveBeenCalled();
});
it('blocks submit while uploading and accepts a file-only application with its uploaded asset ID', async () => {
  let resolve; assetApi.upload.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<ApplyModal job={{ _id: 'job:test', title: 'Job' }} onClose={vi.fn()} onRefresh={vi.fn()} onSubmitted={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Tải CV từ máy tính'), { target: { files: [new File(['pdf'], 'CV.pdf')] } });
  expect(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }).disabled).toBe(true);
  resolve(file); await screen.findByText('CV.pdf'); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }));
  await waitFor(() => expect(applicationApi.apply).toHaveBeenCalledWith(expect.objectContaining({ submission: { resume_file_id: file.asset_id } })));
});
it('uses a saved profile CV only after explicit selection and preserves the reapply revision', async () => {
  applicationApi.context.mockResolvedValue({ candidate: { ...base(), resume_file: file }, email: 'test@example.invalid' });
  render(<ApplyModal job={{ _id: 'job:test', title: 'Job' }} previousApplication={{ _rev: '4-old' }} onClose={vi.fn()} onRefresh={vi.fn()} onSubmitted={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /Dùng CV từ hồ sơ/ })); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp hồ sơ' }));
  await waitFor(() => expect(applicationApi.apply).toHaveBeenCalledWith(expect.objectContaining({ expected_rev: '4-old', submission: { resume_file_id: file.asset_id } })));
  expect(assetApi.upload).not.toHaveBeenCalled();
});
it('Candidate can save a CV alone with If-Match even if legacy full_name is absent', async () => {
  render(<MemoryRouter><Profile /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
  fireEvent.click(screen.getByRole('tab', { name: 'CV Đính Kèm' }));
  fireEvent.change(await screen.findByLabelText('Tải CV trong hồ sơ ứng viên'), { target: { files: [new File(['pdf'], 'CV.pdf')] } });
  await screen.findAllByText('CV.pdf'); fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/v1/candidate/profile/me', { resume_file_id: file.asset_id }, { headers: { 'If-Match': '"1-test"' } }));
});
it('profile patch can remove a file reference without sending file bytes or touching career fields', () => {
  const previous = { ...base(), resume_file: file }; const current = { ...previous, resume_file: undefined };
  expect(candidateProfilePatch(current, previous)).toEqual({ resume_file_id: null });
});
it('an absent avatar renders initials and a failed preview falls back safely', async () => {
  const { rerender } = render(<PrivateAssetImage fallback="UV" />); expect(screen.getByText('UV')).toBeTruthy();
  rerender(<PrivateAssetImage fallback="UV" asset={{ ...file, content_type: 'image/png' }} />);
  const image = await screen.findByRole('img', { name: 'Ảnh đại diện ứng viên' }); fireEvent.error(image); expect(screen.getByText('UV')).toBeTruthy(); expect(screen.queryByRole('img')).toBeNull();
});
