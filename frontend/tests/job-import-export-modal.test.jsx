import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JobImportExportModal from '../src/features/jobs/components/JobImportExportModal';
import { jobApi } from '../src/api/jobApplicationApi';

vi.mock('../src/api/jobApplicationApi', () => ({ jobApi: {
  importPreview: vi.fn(), importConfirm: vi.fn(), importTemplate: vi.fn(), exportJobs: vi.fn(),
} }));

describe('Recruiter Job import/export modal', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('confirm', vi.fn(() => true)); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('previews a selected JSON file and confirms import, then refreshes recruiter jobs', async () => {
    const onImported = vi.fn();
    jobApi.importPreview.mockResolvedValue({ previewToken: 'signed-preview-token', valid: 1, skipped: 0, failed: 0,
      rows: [{ row: 1, status: 'READY', job: { title: 'Backend Engineer' }, warnings: [] }] });
    jobApi.importConfirm.mockResolvedValue({ created: 1, skipped: 0, failed: 0, rows: [{ row: 1, status: 'CREATED' }] });
    render(<JobImportExportModal onClose={vi.fn()} onImported={onImported} />);
    const file = new File([JSON.stringify([{ title: 'Backend Engineer' }])], 'jobs.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/Chọn file CSV hoặc JSON/i), { target: { files: [file] } });
    await screen.findByText(/jobs.json/);
    fireEvent.click(screen.getByRole('button', { name: /Xem trước và kiểm tra/i }));
    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận nhập 1 tin nháp/i }));
    await waitFor(() => expect(jobApi.importConfirm).toHaveBeenCalledWith(expect.objectContaining({ format: 'json', fileName: 'jobs.json', previewToken: 'signed-preview-token' })));
    expect(onImported).toHaveBeenCalledOnce();
    expect(await screen.findByText(/1 tạo mới/)).toBeTruthy();
  });

  it('exports only after the recruiter selects the export view and submits filters', async () => {
    jobApi.exportJobs.mockResolvedValue({ data: new Blob(['{}']), headers: { 'content-disposition': 'attachment; filename="jobs.json"' } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    render(<JobImportExportModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Xuất/i }));
    fireEvent.change(screen.getByLabelText('Từ khóa'), { target: { value: 'Platform' } });
    fireEvent.click(screen.getByRole('button', { name: /Tải file công việc/i }));
    await waitFor(() => expect(jobApi.exportJobs).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv', q: 'Platform' })));
  });
});
