import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { applicationApi } from '../src/api/jobApplicationApi';
import { scoringApi } from '../src/api/scoringApi';
import JobApplicantsPage from '../src/pages/Jobs/JobApplicantsPage';
import CandidateRankingView from '../src/features/scoring/components/CandidateRankingView';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

vi.mock('../src/api/jobApplicationApi', () => ({
  applicationApi: {
    applicants: vi.fn(),
    ranking: vi.fn(),
    detail: vi.fn(),
    transition: vi.fn(),
  },
  jobApi: {
    remove: vi.fn(),
  },
}));

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

const mockJob = {
  _id: 'job:cms:J_000001',
  _rev: '1-mock',
  title: 'Kỹ sư Backend',
  company_name: 'Tech Corp',
  company_logo_url: null,
};

const mockApplicantsResponse = {
  job: mockJob,
  items: [
    {
      _id: 'application:pair:list_item_1',
      _rev: '1-rev',
      current_stage: 'APPLIED',
      applied_at: '2026-10-22T08:00:00.000Z',
      email: 'applicant_list@example.invalid',
      candidate: {
        profile: { full_name: 'Lê Văn C', years_experience: 3 },
        skills: [{ name: 'Node.js' }],
      },
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      analysis_total_score: 90,
      analysis_recommendation: 'HIGH',
      allowed_transitions: ['SCREENING', 'REJECTED'],
    },
  ],
  has_more: false,
};

const mockRankingResponse = {
  job: {
    id: 'job:cms:J_000001',
    title: 'Kỹ sư Backend',
  },
  summary: {
    total_applications: 3,
    eligible_applications: 2,
    excluded_applications: 1,
    exclusions_by_reason: {
      NOT_ANALYZED: 1,
    },
  },
  items: [
    {
      rank: 1,
      application_id: `application:pair:${'a'.repeat(64)}`,
      current_stage: 'SCREENING',
      applied_at: '2026-10-22T09:00:00.000Z',
      candidate: {
        id: 'candidate:ranking_a',
        profile: {
          full_name: 'Nguyễn Văn A',
          role: 'Backend Engineer',
          seniority: 'MID',
        },
        skills: [
          {
            name: 'JavaScript',
            normalized: 'javascript',
          },
          {
            name: 'CouchDB',
            normalized: 'couchdb',
          },
        ],
      },
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      analysis_total_score: 88.7654321,
      analysis_recommendation: 'HIGH',
    },
    {
      rank: 2,
      application_id: `application:pair:${'b'.repeat(64)}`,
      current_stage: 'APPLIED',
      applied_at: '2026-10-22T10:00:00.000Z',
      candidate: {
        id: 'candidate:ranking_b',
        profile: {
          full_name: 'Trần Thị B',
          role: 'Backend Engineer',
          seniority: 'JUNIOR',
        },
        skills: [
          {
            name: 'JavaScript',
            normalized: 'javascript',
          },
        ],
      },
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      analysis_total_score: 75.333333333,
      analysis_recommendation: 'MEDIUM',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total_items: 2,
    total_pages: 1,
  },
};

function renderApplicantsPage(jobId = 'job:cms:J_000001') {
  return render(
    <MemoryRouter initialEntries={[`/recruiter/jobs/${jobId}/applicants`]}>
      <Routes>
        <Route path="/recruiter/jobs/:id/applicants" element={<JobApplicantsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CandidateRankingView UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applicationApi.applicants.mockResolvedValue(mockApplicantsResponse);
    applicationApi.ranking.mockResolvedValue(mockRankingResponse);
  });

  it('1. defaults to "Danh sách xử lý" view with StageFilter and applicant pipeline', async () => {
    renderApplicantsPage();

    await screen.findByText('Lê Văn C');

    const listBtn = screen.getByRole('button', { name: 'Danh sách xử lý' });
    const rankingBtn = screen.getByRole('button', { name: 'Xếp hạng phù hợp' });

    expect(listBtn.getAttribute('aria-pressed')).toBe('true');
    expect(rankingBtn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Trạng thái hồ sơ')).toBeTruthy();
    expect(applicationApi.applicants).toHaveBeenCalledWith(
      'job:cms:J_000001',
      expect.objectContaining({ limit: 20 })
    );
    expect(applicationApi.ranking).not.toHaveBeenCalled();
  });

  it('2. switches to "Xếp hạng phù hợp" and calls applicationApi.ranking(jobId, { page: 1, limit: 20 })', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    const rankingBtn = screen.getByRole('button', { name: 'Xếp hạng phù hợp' });
    fireEvent.click(rankingBtn);

    expect(rankingBtn.getAttribute('aria-pressed')).toBe('true');
    expect(applicationApi.ranking).toHaveBeenCalledWith('job:cms:J_000001', {
      page: 1,
      limit: 20,
    });
  });

  it('3. displays loading state with role="status" and Vietnamese text while ranking is pending', async () => {
    let resolveRanking;
    applicationApi.ranking.mockReturnValue(
      new Promise((resolve) => {
        resolveRanking = resolve;
      })
    );

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    const rankingBtn = screen.getByRole('button', { name: 'Xếp hạng phù hợp' });
    fireEvent.click(rankingBtn);

    const loadingStatus = screen.getByRole('status');
    expect(loadingStatus).toBeTruthy();
    expect(loadingStatus.textContent).toContain('Đang tải bảng xếp hạng ứng viên…');
    expect(screen.queryByText('Chưa có ứng viên đủ điều kiện xếp hạng.')).toBeNull();

    resolveRanking(mockRankingResponse);
    await screen.findByText('Nguyễn Văn A');
  });

  it('4. displays error state with role="alert", error message, and a "Thử lại" button on API rejection', async () => {
    applicationApi.ranking.mockRejectedValueOnce(new Error('Máy chủ gặp sự cố xếp hạng'));

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Máy chủ gặp sự cố xếp hạng');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('5. clicking "Thử lại" re-invokes ranking API for the current page', async () => {
    applicationApi.ranking.mockRejectedValueOnce(new Error('Lỗi tạm thời'));

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByRole('alert');

    applicationApi.ranking.mockResolvedValueOnce(mockRankingResponse);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await screen.findByText('Nguyễn Văn A');
    expect(applicationApi.ranking).toHaveBeenCalledTimes(2);
    expect(applicationApi.ranking).toHaveBeenLastCalledWith('job:cms:J_000001', {
      page: 1,
      limit: 20,
    });
  });

  it('6. displays empty eligible state while still showing aggregate excluded summary', async () => {
    const emptyRanking = {
      job: { id: 'job:cms:J_000001', title: 'Kỹ sư Backend' },
      summary: {
        total_applications: 3,
        eligible_applications: 0,
        excluded_applications: 3,
        exclusions_by_reason: {
          NOT_ANALYZED: 2,
          INCOMPLETE: 1,
        },
      },
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        total_items: 0,
        total_pages: 0,
      },
    };
    applicationApi.ranking.mockResolvedValueOnce(emptyRanking);

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));

    expect(await screen.findByText('Chưa có ứng viên đủ điều kiện xếp hạng.')).toBeTruthy();
    expect(screen.getByText('Tổng hồ sơ')).toBeTruthy();
    expect(screen.getByText('Đã loại khỏi xếp hạng')).toBeTruthy();
    expect(screen.getByText(/Chưa phân tích/)).toBeTruthy();
    expect(screen.getByText(/Thiếu dữ liệu/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('7. displays summary cards and both ranking rows on success', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));

    await screen.findByText('Nguyễn Văn A');
    expect(screen.getByText('Trần Thị B')).toBeTruthy();
    expect(screen.getByText('Tổng hồ sơ')).toBeTruthy();
    expect(screen.getByText('Đủ điều kiện xếp hạng')).toBeTruthy();
    expect(screen.getByText('Đã loại khỏi xếp hạng')).toBeTruthy();
  });

  it('8. preserves exact server row order without local sorting', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const tableRows = screen.getAllByRole('row');
    // Header is row 0; data rows are 1 and 2
    expect(tableRows[1].textContent).toContain('Nguyễn Văn A');
    expect(tableRows[2].textContent).toContain('Trần Thị B');
  });

  it('9. displays global ranks directly from backend response without array index computation', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const tableRows = screen.getAllByRole('row');
    expect(tableRows[1].textContent).toContain('1');
    expect(tableRows[2].textContent).toContain('2');
  });

  it('10. renders candidate skills from { name, normalized }', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    expect(screen.getByText('JavaScript, CouchDB')).toBeTruthy();
  });

  it('11. does not require email, CV, or submission to render candidate row', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    // Safe DTO does not include candidate email or CV, renders gracefully
    expect(screen.queryByText('applicant_list@example.invalid')).toBeNull();
  });

  it('12. displays 89% for score 88.7654321 via Badge while preserving unrounded server rank order', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    expect(screen.getByText('89%')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();

    const tableRows = screen.getAllByRole('row');
    expect(tableRows[1].textContent).toContain('Nguyễn Văn A');
  });

  it('13. clicking "Trang sau" invokes ranking API for page 2', async () => {
    const multiPageRanking = {
      ...mockRankingResponse,
      pagination: {
        page: 1,
        limit: 20,
        total_items: 25,
        total_pages: 2,
      },
    };
    applicationApi.ranking.mockResolvedValueOnce(multiPageRanking);

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const nextBtn = screen.getByRole('button', { name: /Trang sau/i });
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);

    expect(applicationApi.ranking).toHaveBeenCalledWith('job:cms:J_000001', {
      page: 2,
      limit: 20,
    });
  });

  it('14. page 2 displays items with global rank 21 from backend, not reset to 1', async () => {
    const page2Response = {
      job: { id: 'job:cms:J_000001', title: 'Kỹ sư Backend' },
      summary: { total_applications: 25, eligible_applications: 21, excluded_applications: 4 },
      items: [
        {
          rank: 21,
          application_id: 'application:pair:p2_item',
          current_stage: 'APPLIED',
          applied_at: '2026-10-22T11:00:00.000Z',
          candidate: {
            profile: { full_name: 'Phạm Văn D', role: 'Dev', seniority: 'JUNIOR' },
            skills: [{ name: 'Go' }],
          },
          analysis_status: 'COMPLETE',
          analysis_fresh: true,
          analysis_total_score: 55,
          analysis_recommendation: 'LOW',
        },
      ],
      pagination: {
        page: 2,
        limit: 20,
        total_items: 21,
        total_pages: 2,
      },
    };

    const multiPageRanking = {
      ...mockRankingResponse,
      pagination: { page: 1, limit: 20, total_items: 21, total_pages: 2 },
    };
    applicationApi.ranking.mockResolvedValueOnce(multiPageRanking);

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    applicationApi.ranking.mockResolvedValueOnce(page2Response);
    fireEvent.click(screen.getByRole('button', { name: /Trang sau/i }));

    await screen.findByText('Phạm Văn D');
    const tableRows = screen.getAllByRole('row');
    expect(tableRows[1].textContent).toContain('21');
    expect(tableRows[1].textContent).toContain('Phạm Văn D');
  });

  it('15. has correct disabled states for "Trang trước" and "Trang sau"', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const prevBtn = screen.getByRole('button', { name: /Trang trước/i });
    const nextBtn = screen.getByRole('button', { name: /Trang sau/i });

    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(true); // total_pages === 1
  });

  it('16. hides StageFilter in ranking mode', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');
    expect(screen.getByLabelText('Trạng thái hồ sơ')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    expect(screen.queryByLabelText('Trạng thái hồ sơ')).toBeNull();
  });

  it('17. returns to "Danh sách xử lý" restoring the original pipeline view', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(screen.getByRole('button', { name: 'Danh sách xử lý' }));

    expect(await screen.findByText('Lê Văn C')).toBeTruthy();
    expect(screen.getByLabelText('Trạng thái hồ sơ')).toBeTruthy();
  });

  it('18. clicking score badge opens ScoreBreakdownDrawer with the application_id', async () => {
    const targetAppId = mockRankingResponse.items[0].application_id;
    scoringApi.getAnalysis.mockResolvedValueOnce({
      application_id: targetAppId,
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      candidate: { full_name: 'Nguyễn Văn A' },
      job: { title: 'Kỹ sư Backend' },
      analysis: {
        total_score: 88.8,
        recommendation: 'HIGH',
        scores: { skill: 90, experience: 85, education: 100, project: 80 },
        matched_skills: ['JavaScript'],
        missing_skills: [],
      },
    });

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const badgeBtn = screen.getByRole('button', { name: /Điểm phù hợp: 89%/i });
    fireEvent.click(badgeBtn);

    await waitFor(() => {
      expect(scoringApi.getAnalysis).toHaveBeenCalledWith(targetAppId);
    });
  });

  it('19. successful recompute invokes scoringApi.recompute, reload analysis, and applicationApi.ranking(jobId, currentPage)', async () => {
    const targetAppId = mockRankingResponse.items[0].application_id;
    scoringApi.getAnalysis.mockResolvedValue({
      application_id: targetAppId,
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      candidate: { full_name: 'Nguyễn Văn A' },
      job: { title: 'Kỹ sư Backend' },
      analysis: {
        total_score: 88.8,
        recommendation: 'HIGH',
        scores: { skill: 90, experience: 85, education: 100, project: 80 },
        matched_skills: ['JavaScript'],
        missing_skills: [],
      },
    });
    scoringApi.recompute.mockResolvedValueOnce({ application_id: targetAppId, status: 'COMPLETE' });

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const badgeBtn = screen.getByRole('button', { name: /Điểm phù hợp: 89%/i });
    fireEvent.click(badgeBtn);

    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    await waitFor(() => expect(recomputeBtn.disabled).toBe(false));

    fireEvent.click(recomputeBtn);

    await waitFor(() => {
      expect(scoringApi.recompute).toHaveBeenCalledWith(targetAppId);
      expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(2);
      expect(applicationApi.ranking).toHaveBeenCalledTimes(2);
      expect(applicationApi.ranking).toHaveBeenLastCalledWith('job:cms:J_000001', {
        page: 1,
        limit: 20,
      });
    });
  });

  it('20. recompute does not call applicationApi.applicants() to refresh ranking', async () => {
    const targetAppId = mockRankingResponse.items[0].application_id;
    scoringApi.getAnalysis.mockResolvedValue({
      application_id: targetAppId,
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      candidate: { full_name: 'Nguyễn Văn A' },
      job: { title: 'Kỹ sư Backend' },
      analysis: { total_score: 88.8, recommendation: 'HIGH' },
    });
    scoringApi.recompute.mockResolvedValueOnce({ application_id: targetAppId, status: 'COMPLETE' });

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');
    const applicantsCallsBeforeRanking = applicationApi.applicants.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(screen.getByRole('button', { name: /Điểm phù hợp: 89%/i }));
    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    await waitFor(() => expect(recomputeBtn.disabled).toBe(false));

    fireEvent.click(recomputeBtn);

    await waitFor(() => {
      expect(scoringApi.recompute).toHaveBeenCalled();
    });

    // applicants() must not be called again
    expect(applicationApi.applicants.mock.calls.length).toBe(applicantsCallsBeforeRanking);
  });

  it('21. failed recompute keeps Drawer open and does not patch local rank', async () => {
    const targetAppId = mockRankingResponse.items[0].application_id;
    scoringApi.getAnalysis.mockResolvedValue({
      application_id: targetAppId,
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      candidate: { full_name: 'Nguyễn Văn A' },
      job: { title: 'Kỹ sư Backend' },
      analysis: { total_score: 88.8, recommendation: 'HIGH' },
    });
    scoringApi.recompute.mockRejectedValueOnce(new Error('Lỗi máy chủ khi tính lại'));

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(screen.getByRole('button', { name: /Điểm phù hợp: 89%/i }));
    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    await waitFor(() => expect(recomputeBtn.disabled).toBe(false));

    fireEvent.click(recomputeBtn);

    await screen.findByText('Lỗi máy chủ khi tính lại');
    // Drawer is still open
    expect(screen.getByRole('heading', { name: /Chi tiết điểm phù hợp/i })).toBeTruthy();
    // Rank unchanged
    expect(screen.getAllByRole('row')[1].textContent).toContain('Nguyễn Văn A');
  });

  it('22. contains semantic table with screen-reader caption and responsive wrapper', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const table = screen.getByRole('table');
    expect(table).toBeTruthy();

    const caption = table.querySelector('caption');
    expect(caption).toBeTruthy();
    expect(caption.textContent).toBe('Bảng xếp hạng ứng viên');

    const wrapper = table.closest('.overflow-x-auto');
    expect(wrapper).toBeTruthy();
  });

  it('23. does not render sensitive or forbidden fields (email, CV, resume_text, input_fingerprint, provenance)', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    const tableHtml = screen.getByRole('table').innerHTML;
    expect(tableHtml).not.toContain('resume_text');
    expect(tableHtml).not.toContain('input_fingerprint');
    expect(tableHtml).not.toContain('provenance');
    expect(tableHtml).not.toContain('submission');
    expect(tableHtml).not.toContain('stage_history');
    expect(tableHtml).not.toContain('test@example');
  });

  it('24. preserved existing UC14 applicants pipeline functions intact', async () => {
    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    // List mode preserves action buttons
    expect(screen.getByText('Xem CV và xử lý')).toBeTruthy();
    expect(screen.getByText('Duyệt hồ sơ')).toBeTruthy();
    expect(screen.getByText('Từ chối')).toBeTruthy();
  });

  it('25. Stale Job response: ignores delayed response from old Job after switching jobs', async () => {
    const jobADeferred = createDeferred();
    const jobBDeferred = createDeferred();

    applicationApi.ranking.mockImplementation((jobId) => {
      if (jobId === 'job:cms:J_000001') return jobADeferred.promise;
      if (jobId === 'job:cms:J_000002') return jobBDeferred.promise;
      return Promise.resolve(mockRankingResponse);
    });

    const { rerender } = render(
      <CandidateRankingView jobId="job:cms:J_000001" />
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(applicationApi.ranking).toHaveBeenCalledWith('job:cms:J_000001', { page: 1, limit: 20 });

    // Rerender with Job B
    rerender(<CandidateRankingView jobId="job:cms:J_000002" />);
    expect(applicationApi.ranking).toHaveBeenCalledWith('job:cms:J_000002', { page: 1, limit: 20 });

    // Job B resolves first
    const jobBResponse = {
      job: { id: 'job:cms:J_000002', title: 'Job B Title' },
      summary: { total_applications: 1, eligible_applications: 1, excluded_applications: 0 },
      items: [
        {
          rank: 1,
          application_id: 'app:job_b_candidate',
          current_stage: 'APPLIED',
          applied_at: '2026-10-22T09:00:00.000Z',
          candidate: {
            id: 'cand:b',
            profile: { full_name: 'Ứng viên Job B', role: 'Dev', seniority: 'MID' },
            skills: [{ name: 'Go', normalized: 'go' }],
          },
          analysis_status: 'COMPLETE',
          analysis_fresh: true,
          analysis_total_score: 91,
          analysis_recommendation: 'HIGH',
        },
      ],
      pagination: { page: 1, limit: 20, total_items: 1, total_pages: 1 },
    };
    jobBDeferred.resolve(jobBResponse);

    // Displays candidate B
    await screen.findByText('Ứng viên Job B');
    expect(screen.queryByText('Nguyễn Văn A')).toBeNull();

    // Job A resolves afterwards
    jobADeferred.resolve(mockRankingResponse);

    // Verify candidate B remains displayed and candidate A never appears
    await waitFor(() => {
      expect(screen.getByText('Ứng viên Job B')).toBeTruthy();
      expect(screen.queryByText('Nguyễn Văn A')).toBeNull();
    });
  });

  it('26. Stale error: ignores rejected error from old request after newer request succeeded', async () => {
    const req1Deferred = createDeferred();
    const req2Deferred = createDeferred();

    applicationApi.ranking
      .mockImplementationOnce(() => req1Deferred.promise)
      .mockImplementationOnce(() => req2Deferred.promise);

    const { rerender } = render(
      <CandidateRankingView jobId="job:cms:J_000001" />
    );

    // Request 1 is pending for job 1
    expect(screen.getByRole('status')).toBeTruthy();

    // Rerender with job 2 to trigger Request 2
    rerender(<CandidateRankingView jobId="job:cms:J_000002" />);

    // Request 2 resolves with success first
    req2Deferred.resolve(mockRankingResponse);
    await screen.findByText('Nguyễn Văn A');

    // Request 1 rejects later
    req1Deferred.reject(new Error('Lỗi từ request cũ'));

    // UI must NOT switch to error alert
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    });
  });

  it('27. Latest loading ownership: loading is not dismissed early when old request finishes before new one', async () => {
    const req1Deferred = createDeferred();
    const req2Deferred = createDeferred();

    applicationApi.ranking
      .mockImplementationOnce(() => req1Deferred.promise)
      .mockImplementationOnce(() => req2Deferred.promise);

    const { rerender } = render(
      <CandidateRankingView jobId="job:cms:J_000001" />
    );

    // Request 1 pending
    expect(screen.getByRole('status')).toBeTruthy();

    // Trigger Request 2 by changing jobId
    rerender(<CandidateRankingView jobId="job:cms:J_000002" />);

    // Request 1 completes before Request 2
    req1Deferred.resolve(mockRankingResponse);

    // Loading should NOT be turned off by Request 1 because Request 2 is still pending
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('Nguyễn Văn A')).toBeNull();

    // Request 2 completes
    req2Deferred.resolve(mockRankingResponse);

    // Loading finishes and displays data
    await screen.findByText('Nguyễn Văn A');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('28. Delayed recompute refresh: keeps drawer open without unmount/remount during pending ranking refetch', async () => {
    const targetAppId = mockRankingResponse.items[0].application_id;

    scoringApi.getAnalysis.mockResolvedValue({
      application_id: targetAppId,
      analysis_status: 'COMPLETE',
      analysis_fresh: true,
      candidate: { full_name: 'Nguyễn Văn A' },
      job: { title: 'Kỹ sư Backend' },
      analysis: { total_score: 88.8, recommendation: 'HIGH' },
    });
    scoringApi.recompute.mockResolvedValueOnce({ application_id: targetAppId, status: 'COMPLETE' });

    renderApplicantsPage();
    await screen.findByText('Lê Văn C');

    fireEvent.click(screen.getByRole('button', { name: 'Xếp hạng phù hợp' }));
    await screen.findByText('Nguyễn Văn A');

    // Click score badge to open ScoreBreakdownDrawer (1st getAnalysis call)
    fireEvent.click(screen.getByRole('button', { name: /Điểm phù hợp: 89%/i }));
    const recomputeBtn = await screen.findByRole('button', { name: /Tính lại điểm/i });
    await waitFor(() => expect(recomputeBtn.disabled).toBe(false));

    expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(1);

    // Setup ranking refetch to remain pending with deferred promise
    const rankingRefetchDeferred = createDeferred();
    applicationApi.ranking.mockReturnValueOnce(rankingRefetchDeferred.promise);

    // User clicks recompute in drawer
    fireEvent.click(recomputeBtn);

    // Wait until recompute and reload analysis in drawer complete (2nd getAnalysis call)
    await waitFor(() => {
      expect(scoringApi.recompute).toHaveBeenCalledWith(targetAppId);
      expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(2);
      expect(applicationApi.ranking).toHaveBeenCalledTimes(2);
    });

    // While ranking refetch is still pending:
    // 1. Drawer is still open in the DOM
    expect(screen.getByRole('dialog', { name: /Chi tiết điểm phù hợp/i })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();

    // 2. Drawer was NOT unmounted/remounted (which would have called getAnalysis a 3rd time)
    expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(2);

    // Now resolve the delayed ranking refetch with updated server data
    const updatedRankingResponse = {
      ...mockRankingResponse,
      items: [
        {
          ...mockRankingResponse.items[0],
          analysis_total_score: 99.12345,
        },
        mockRankingResponse.items[1],
      ],
    };
    rankingRefetchDeferred.resolve(updatedRankingResponse);

    // Verify updated server data and rank
    await screen.findByText('99%');
    expect(screen.getByRole('dialog', { name: /Chi tiết điểm phù hợp/i })).toBeTruthy();
    expect(scoringApi.getAnalysis).toHaveBeenCalledTimes(2);
  });
});
