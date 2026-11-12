import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScoreBreakdownDrawer from '../src/features/scoring/components/ScoreBreakdownDrawer';
import { scoringApi } from '../src/api/scoringApi';

vi.mock('../src/api/scoringApi', () => ({
  scoringApi: {
    getAnalysis: vi.fn(),
    recompute: vi.fn(),
  },
  default: {
    getAnalysis: vi.fn(),
    recompute: vi.fn(),
  },
}));

const mockCompleteAnalysis = {
  application_id: 'application:test-1',
  analysis_status: 'COMPLETE',
  analysis_fresh: true,
  candidate: { id: 'candidate:1', full_name: 'Nguyễn Văn A' },
  job: { id: 'job:1', title: 'Kỹ sư Phần mềm' },
  analysis: {
    total_score: 84.6,
    recommendation: 'HIGH',
    scores: {
      skill: 89.2,
      experience: 79.5,
      education: 100,
      project: 70.4,
    },
    matched_skills: ['JavaScript', 'React'],
    missing_skills: ['Docker'],
    project: {
      matched_technologies: ['Node.js'],
      missing_technologies: ['Kubernetes'],
    },
    missing_inputs: [],
    algorithm_version: 'recruithub-scoring-mvp-v1',
    analyzed_at: '2026-10-25T14:30:00.000Z',
    evidence_metadata: {
      available: true,
      has_synthetic_evidence: false,
    },
  },
};

describe('ScoreBreakdownDrawer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially while fetching analysis', async () => {
    scoringApi.getAnalysis.mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/Đang tải dữ liệu phân tích hồ sơ/i)).toBeTruthy();
  });

  it('disables recompute button while initial GET is loading and prevents calls', async () => {
    let resolveAnalysis;
    scoringApi.getAnalysis.mockReturnValue(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      })
    );

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    const recomputeBtn = screen.getByRole('button', { name: /Tính lại điểm/i });
    expect(recomputeBtn.disabled).toBe(true);

    fireEvent.click(recomputeBtn);
    expect(scoringApi.recompute).not.toHaveBeenCalled();

    // When fetch finishes, button is enabled
    resolveAnalysis(mockCompleteAnalysis);
    await waitFor(() => {
      expect(recomputeBtn.disabled).toBe(false);
    });
  });

  it('renders error state and retries fetching analysis when retry button is clicked', async () => {
    scoringApi.getAnalysis.mockRejectedValueOnce(new Error('Lỗi máy chủ'));
    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Lỗi máy chủ')).toBeTruthy();

    scoringApi.getAnalysis.mockResolvedValueOnce(mockCompleteAnalysis);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryBtn);

    expect(await screen.findByText('85%')).toBeTruthy();
    expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(2);
  });

  it('renders NOT_ANALYZED state cleanly with action to calculate', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce({
      application_id: 'application:test-1',
      analysis_status: 'NOT_ANALYZED',
      analysis_fresh: false,
      candidate: { id: 'candidate:1', full_name: 'Trần Thị B' },
      job: { id: 'job:1', title: 'Product Manager' },
      analysis: null,
    });

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Chưa phân tích hồ sơ')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tính lại điểm/i })).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('renders COMPLETE + fresh with 50/25/10/15 weights, rounded scores, and non-affirming evidence label', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce(mockCompleteAnalysis);

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    // Candidate and Job info
    expect(await screen.findByText(/Nguyễn Văn A · Kỹ sư Phần mềm/)).toBeTruthy();

    // Overall rounded score
    expect(screen.getByText('85%')).toBeTruthy();
    expect(screen.getByText('Phù hợp cao')).toBeTruthy();

    // Four component weights 50 / 25 / 10 / 15
    expect(screen.getByText('Kỹ năng (50%)')).toBeTruthy();
    expect(screen.getByText('89%')).toBeTruthy();

    expect(screen.getByText('Kinh nghiệm (25%)')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();

    expect(screen.getByText('Học vấn (10%)')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();

    expect(screen.getByText('Dự án (15%)')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();

    // Skills and project details
    expect(screen.getByText('JavaScript')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.getByText('Docker')).toBeTruthy();
    expect(screen.getByText('Node.js')).toBeTruthy();
    expect(screen.getByText('Kubernetes')).toBeTruthy();

    // Algorithm & Evidence label
    expect(screen.getByText('recruithub-scoring-mvp-v1')).toBeTruthy();
    expect(screen.getByText('Không phát hiện dữ liệu tổng hợp')).toBeTruthy();
    expect(screen.queryByText(/Bằng chứng quan sát thực tế/)).toBeNull();
  });

  it('renders INCOMPLETE state with missing_inputs objects according to real backend schema', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce({
      application_id: 'application:test-1',
      analysis_status: 'INCOMPLETE',
      analysis_fresh: true,
      candidate: { id: 'candidate:1', full_name: 'Lê Văn C' },
      job: { id: 'job:1', title: 'Data Analyst' },
      analysis: {
        scores: {
          skill: 75.2,
          experience: null,
          education: null,
          project: 60,
        },
        missing_inputs: [
          {
            component: 'education',
            code: 'CANDIDATE_EDUCATION_UNAVAILABLE',
            message: 'Candidate education evidence is UNAVAILABLE',
          },
          {
            component: 'experience',
            code: 'MISSING_CANDIDATE_EXPERIENCE',
            message: 'Candidate experience_months is missing or UNAVAILABLE',
          },
        ],
        missing_skills: [],
        matched_skills: ['SQL'],
        algorithm_version: 'recruithub-scoring-mvp-v1',
      },
    });

    const { container } = render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Hồ sơ thiếu dữ liệu')).toBeTruthy();

    // Must not show overall total_score or recommendation
    expect(screen.queryByText('Điểm phù hợp tổng thể')).toBeNull();
    expect(screen.queryByText(/Phù hợp cao|Phù hợp thấp/)).toBeNull();

    // Missing inputs list renders Vietnamese component names
    expect(screen.getByText('Trình độ học vấn')).toBeTruthy();
    expect(screen.getByText('Kinh nghiệm làm việc')).toBeTruthy();

    // Crucial assertions: no [object Object] and no required_count
    expect(container.textContent).not.toContain('[object Object]');
    expect(screen.queryByText(/required_count/i)).toBeNull();

    // Component scores: null becomes 'Thiếu dữ liệu', never fabricated 0%
    const missingDataBadges = screen.getAllByText('Thiếu dữ liệu');
    expect(missingDataBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('0%')).toBeNull();

    // Real available scores are rendered accurately
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('renders Stale warning and hides current numeric scores to prevent stale anchoring', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce({
      ...mockCompleteAnalysis,
      analysis_fresh: false,
    });

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/Kết quả đã cũ — Cần tính lại điểm/)).toBeTruthy();
    // Numeric scores should NOT be displayed as active scores
    expect(screen.queryByText('85%')).toBeNull();
    expect(screen.queryByText('89%')).toBeNull();

    // Recompute button is present
    expect(screen.getByRole('button', { name: /Tính lại điểm/i })).toBeTruthy();
  });

  it('handles unavailable metadata without crash and renders safe label', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce({
      ...mockCompleteAnalysis,
      analysis: {
        ...mockCompleteAnalysis.analysis,
        evidence_metadata: {
          available: false,
          has_synthetic_evidence: null,
        },
      },
    });

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Metadata nguồn không khả dụng')).toBeTruthy();
    expect(screen.queryByText(/Bằng chứng quan sát thực tế/)).toBeNull();
  });

  it('labels synthetic metadata safely as simulated data rather than verified evidence', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce({
      ...mockCompleteAnalysis,
      analysis: {
        ...mockCompleteAnalysis.analysis,
        evidence_metadata: {
          available: true,
          has_synthetic_evidence: true,
        },
      },
    });

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Có dữ liệu tổng hợp / mô phỏng')).toBeTruthy();
    expect(screen.queryByText(/Bằng chứng quan sát thực tế/)).toBeNull();
  });

  it('labels undetermined metadata safely when has_synthetic_evidence is null', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce({
      ...mockCompleteAnalysis,
      analysis: {
        ...mockCompleteAnalysis.analysis,
        evidence_metadata: {
          available: true,
          has_synthetic_evidence: null,
        },
      },
    });

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Chưa xác định nguồn bằng chứng')).toBeTruthy();
    expect(screen.queryByText(/Bằng chứng quan sát thực tế/)).toBeNull();
  });

  it('recomputes successfully: calls POST, reloads detail, and calls onRecomputed', async () => {
    scoringApi.getAnalysis
      .mockResolvedValueOnce({
        ...mockCompleteAnalysis,
        analysis_fresh: false,
      })
      .mockResolvedValueOnce(mockCompleteAnalysis);

    scoringApi.recompute.mockResolvedValueOnce({ _id: 'analysis:test-1', total_score: 84.6 });

    const handleRecomputed = vi.fn();
    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
        onRecomputed={handleRecomputed}
      />
    );

    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    fireEvent.click(recomputeBtn);

    await waitFor(() => {
      expect(scoringApi.recompute).toHaveBeenCalledWith('application:test-1');
      expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(2);
      expect(handleRecomputed).toHaveBeenCalledOnce();
    });
  });

  it('prevents synchronous double submission when recompute button is double-clicked', async () => {
    scoringApi.getAnalysis.mockResolvedValue(mockCompleteAnalysis);
    scoringApi.recompute.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ _id: 'ok' }), 50))
    );

    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
      />
    );

    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    // Click twice rapidly in same tick
    fireEvent.click(recomputeBtn);
    fireEvent.click(recomputeBtn);

    expect(scoringApi.recompute).toHaveBeenCalledTimes(1);
  });

  it('keeps drawer open and allows retry when recompute fails', async () => {
    scoringApi.getAnalysis.mockResolvedValue(mockCompleteAnalysis);
    scoringApi.recompute.mockRejectedValueOnce(new Error('Máy chủ quá tải khi tính điểm'));

    const handleClose = vi.fn();
    render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={handleClose}
      />
    );

    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    fireEvent.click(recomputeBtn);

    expect(await screen.findByText('Máy chủ quá tải khi tính điểm')).toBeTruthy();
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Tính lại điểm/i })).toBeTruthy();
  });

  it('closes drawer on Escape key when not busy', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce(mockCompleteAnalysis);
    const handleClose = vi.fn();

    const { container } = render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={handleClose}
      />
    );

    await screen.findByText('85%');
    const dialog = container.querySelector('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(handleClose).toHaveBeenCalledOnce();
  });

  it('restores focus to previous active trigger or fallback returnFocusId when closing', async () => {
    scoringApi.getAnalysis.mockResolvedValueOnce(mockCompleteAnalysis);

    const fallbackBtn = document.createElement('button');
    fallbackBtn.id = 'trigger-fallback-id';
    document.body.appendChild(fallbackBtn);

    const initialBtn = document.createElement('button');
    initialBtn.id = 'trigger-initial-id';
    document.body.appendChild(initialBtn);
    initialBtn.focus();
    expect(document.activeElement).toBe(initialBtn);

    const { unmount } = render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
        returnFocusId="trigger-fallback-id"
      />
    );

    // When unmounting (closing) while initialBtn is still connected:
    unmount();
    expect(document.activeElement).toBe(initialBtn);

    // Now test fallback when trigger was unmounted/replaced:
    initialBtn.remove();
    const { unmount: unmountSecond } = render(
      <ScoreBreakdownDrawer
        applicationId="application:test-1"
        onClose={vi.fn()}
        returnFocusId="trigger-fallback-id"
      />
    );

    unmountSecond();
    expect(document.activeElement).toBe(fallbackBtn);

    fallbackBtn.remove();
  });
});
