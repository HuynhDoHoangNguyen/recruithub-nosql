import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { applicationApi } from '../../../api/jobApplicationApi';
import { formatDate } from '../../applications/applicationPresentation';
import { StageBadge } from '../../applications/components/ApplicationUI';
import MatchScoreBadge from './MatchScoreBadge';
import ScoreBreakdownDrawer from './ScoreBreakdownDrawer';

const EXCLUSION_LABELS = {
  NOT_ANALYZED: 'Chưa phân tích',
  INCOMPLETE: 'Thiếu dữ liệu',
  STALE: 'Kết quả đã cũ',
  INVALID_ANALYSIS: 'Phân tích không hợp lệ',
  REFERENCE_MISMATCH: 'Tham chiếu không hợp lệ',
  INVALID_APPLICATION: 'Hồ sơ không hợp lệ',
  INVALID_CANDIDATE: 'Ứng viên không hợp lệ',
  INACTIVE_STAGE: 'Không còn ở giai đoạn hoạt động',
};

export default function CandidateRankingView({ jobId }) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [prevJobId, setPrevJobId] = useState(jobId);

  const generation = useRef(0);

  if (prevJobId !== jobId) {
    setPrevJobId(jobId);
    setPage(1);
    setData(null);
    setError(null);
    setLoading(true);
    setSelectedApplicationId(null);
  }

  const fetchRankingForPage = useCallback(
    async (pageNumber, targetJobId = jobId) => {
      const requestId = ++generation.current;
      setLoading(true);
      setError(null);
      try {
        const res = await applicationApi.ranking(targetJobId, { page: pageNumber, limit: 20 });
        if (generation.current === requestId) {
          setData(res);
          if (res?.pagination) {
            const totalPages = res.pagination.total_pages;
            if (totalPages > 0 && pageNumber > totalPages) {
              setPage(totalPages);
            } else if (totalPages === 0 && pageNumber !== 1) {
              setPage(1);
            }
          }
          setLoading(false);
        }
        return res;
      } catch (err) {
        if (generation.current === requestId) {
          setError(err);
          setLoading(false);
        }
        return null;
      }
    },
    [jobId]
  );

  useEffect(() => {
    generation.current++;
  }, [jobId]);

  useEffect(() => {
    const gen = generation;
    return () => {
      gen.current++;
    };
  }, []);

  useEffect(() => {
    fetchRankingForPage(page, jobId);
  }, [fetchRankingForPage, page, jobId]);

  const summary = data?.summary || {
    total_applications: 0,
    eligible_applications: 0,
    excluded_applications: 0,
    exclusions_by_reason: {},
  };

  const items = data?.items || [];
  const isEligibleEmpty = summary.eligible_applications === 0 || items.length === 0;

  const totalPages = data?.pagination?.total_pages ?? 0;
  const displayTotalPages = totalPages === 0 ? 1 : totalPages;
  const displayPage = totalPages === 0 ? 1 : page;

  return (
    <div className="space-y-6">
      {loading ? (
        <div
          role="status"
          className="card p-8 text-center text-slate-600 rounded-2xl border border-blue-100 bg-white shadow-sm"
        >
          <span
            className="loading-spinner mr-3 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
            aria-hidden="true"
          />
          Đang tải bảng xếp hạng ứng viên…
        </div>
      ) : error ? (
        <div role="alert" className="message-error p-6 rounded-2xl border border-red-200 bg-red-50 text-red-800">
          <p className="font-semibold text-sm sm:text-base">{error.message || 'Không thể tải bảng xếp hạng ứng viên.'}</p>
          <button
            type="button"
            className="btn-secondary mt-3 inline-flex items-center text-xs font-semibold px-4 py-2 rounded-xl border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
            onClick={() => fetchRankingForPage(page, jobId)}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <>
      {/* Aggregate Summary */}
      <section
        aria-label="Tổng quan bảng xếp hạng"
        className="rh-panel rh-summary-card rounded-2xl border border-blue-100 bg-white p-5 shadow-sm space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs font-medium text-slate-500">Tổng hồ sơ</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{summary.total_applications ?? 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <p className="text-xs font-medium text-emerald-700">Đủ điều kiện xếp hạng</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">{summary.eligible_applications ?? 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
            <p className="text-xs font-medium text-amber-700">Đã loại khỏi xếp hạng</p>
            <p className="text-2xl font-extrabold text-amber-800 mt-1">{summary.excluded_applications ?? 0}</p>
          </div>
        </div>

        {summary.exclusions_by_reason && Object.keys(summary.exclusions_by_reason).length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Lý do loại trừ:</span>
            {Object.entries(summary.exclusions_by_reason).map(([reason, count]) => (
              <span
                key={reason}
                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
              >
                {EXCLUSION_LABELS[reason] || reason}: <strong className="ml-1">{count}</strong>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Empty State or Semantic Table */}
      {isEligibleEmpty ? (
        <div className="card p-12 text-center text-slate-500 rounded-2xl border border-blue-100 bg-white shadow-sm">
          Chưa có ứng viên đủ điều kiện xếp hạng.
        </div>
      ) : (
        <>
          <div className="rh-applicant-table overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-left text-sm">
              <caption className="sr-only">Bảng xếp hạng ứng viên</caption>
              <thead className="bg-blue-50/70 text-slate-500">
                <tr>
                  <th scope="col" className="p-4 font-semibold w-20 text-center">
                    Xếp hạng
                  </th>
                  <th scope="col" className="p-4 font-semibold">
                    Ứng viên
                  </th>
                  <th scope="col" className="p-4 font-semibold">
                    Vai trò / Cấp bậc
                  </th>
                  <th scope="col" className="p-4 font-semibold">
                    Kỹ năng
                  </th>
                  <th scope="col" className="p-4 font-semibold">
                    Ngày nộp
                  </th>
                  <th scope="col" className="p-4 font-semibold">
                    Trạng thái
                  </th>
                  <th scope="col" className="p-4 font-semibold">
                    Điểm phù hợp
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const candidateName = item.candidate?.profile?.full_name || 'Chưa cung cấp họ tên';
                  const role = item.candidate?.profile?.role;
                  const seniority = item.candidate?.profile?.seniority;
                  const roleSeniority = [role, seniority].filter(Boolean).join(' · ') || 'Chưa cung cấp';
                  const skillsText = item.candidate?.skills?.length
                    ? item.candidate.skills.map((s) => s.name).join(', ')
                    : 'Chưa cung cấp';
                  const triggerId = `ranking-score-${item.application_id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                  return (
                    <tr key={item.application_id} className="border-t border-gray-100 hover:bg-slate-50/50">
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-extrabold text-sm border border-blue-200">
                          {item.rank}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{candidateName}</p>
                      </td>
                      <td className="p-4 text-gray-600">
                        <p>{roleSeniority}</p>
                      </td>
                      <td className="max-w-xs p-4 text-gray-600">
                        {skillsText}
                      </td>
                      <td className="p-4 text-gray-600">
                        {formatDate(item.applied_at)}
                      </td>
                      <td className="p-4">
                        <StageBadge stage={item.current_stage} />
                      </td>
                      <td className="p-4">
                        <MatchScoreBadge
                          id={triggerId}
                          status={item.analysis_status}
                          fresh={item.analysis_fresh}
                          totalScore={item.analysis_total_score}
                          recommendation={item.analysis_recommendation}
                          onOpen={() => setSelectedApplicationId(item.application_id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Numeric Pagination */}
          <nav
            aria-label="Phân trang xếp hạng"
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-white px-4 py-4 shadow-sm"
          >
            <p className="text-xs text-slate-500">
              Trang {displayPage} / {displayTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1.5 !rounded-xl !border-blue-200 !px-3 !py-2.5 hover:!bg-blue-50 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Trang trước
              </button>
              <span
                aria-current="page"
                className="flex min-w-12 items-center justify-center rounded-xl border border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20"
              >
                Trang {displayPage}
              </span>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-1.5 !rounded-xl !border !border-blue-500 !bg-gradient-to-r !from-blue-600 !to-indigo-600 !px-3 !py-2.5 shadow-md shadow-blue-500/20 hover:shadow-blue-500/35 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || totalPages === 0 || page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </nav>
        </>
      )}
        </>
      )}

      {/* UC14 Drawer Integration */}
      {selectedApplicationId && (
        <ScoreBreakdownDrawer
          applicationId={selectedApplicationId}
          onClose={() => setSelectedApplicationId(null)}
          onRecomputed={() => fetchRankingForPage(page, jobId)}
          returnFocusId={`ranking-score-${selectedApplicationId.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
        />
      )}
    </div>
  );
}
