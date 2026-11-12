import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  Code2,
  FolderGit2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { scoringApi } from '../../../api/scoringApi';

const RECOMMENDATION_LABELS = {
  HIGH: 'Phù hợp cao',
  MEDIUM: 'Phù hợp',
  LOW: 'Phù hợp thấp',
};

const COMPONENT_LABELS = {
  skill: 'Kỹ năng chuyên môn',
  experience: 'Kinh nghiệm làm việc',
  education: 'Trình độ học vấn',
  project: 'Dự án thực tế',
};

function formatDateTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(isoString);
  }
}

function renderEvidenceSource(evidenceMetadata) {
  if (!evidenceMetadata || evidenceMetadata.available === false) {
    return <span className="text-slate-500">Metadata nguồn không khả dụng</span>;
  }
  if (evidenceMetadata.has_synthetic_evidence === true) {
    return <span className="text-amber-700 font-medium">Có dữ liệu tổng hợp / mô phỏng</span>;
  }
  if (evidenceMetadata.has_synthetic_evidence === false) {
    return <span className="text-emerald-700 font-medium">Không phát hiện dữ liệu tổng hợp</span>;
  }
  return <span className="text-slate-500">Chưa xác định nguồn bằng chứng</span>;
}

export default function ScoreBreakdownDrawer({
  applicationId,
  onClose,
  onRecomputed,
  returnFocusId,
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const isSubmittingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recomputeError, setRecomputeError] = useState(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await scoringApi.getAnalysis(applicationId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    loadAnalysis();

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      const hasValidTrigger =
        triggerRef.current &&
        triggerRef.current !== document.body &&
        triggerRef.current.isConnected;

      if (hasValidTrigger) {
        triggerRef.current.focus();
      } else if (returnFocusId) {
        const fallbackEl = document.getElementById(returnFocusId);
        fallbackEl?.focus();
      }
    };
  }, [loadAnalysis, returnFocusId]);

  const handleClose = () => {
    if (!busy) {
      onClose();
    }
  };

  const handleRecompute = async () => {
    if (busy || loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setBusy(true);
    setRecomputeError(null);

    try {
      await scoringApi.recompute(applicationId);
      await loadAnalysis();
      if (onRecomputed) {
        await onRecomputed();
      }
    } catch (err) {
      setRecomputeError(err);
    } finally {
      setBusy(false);
      isSubmittingRef.current = false;
    }
  };

  const analysis = data?.analysis;
  const status = data?.analysis_status;
  const fresh = data?.analysis_fresh;
  const candidateName = data?.candidate?.full_name || 'Ứng viên';
  const jobTitle = data?.job?.title || 'Vị trí tuyển dụng';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="score-breakdown-drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      className="m-0 ml-auto h-full max-h-screen w-full sm:w-[500px] md:w-[580px] bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 overflow-hidden flex flex-col z-50 rounded-none sm:rounded-l-2xl border-l border-slate-200"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
        <div>
          <h2
            id="score-breakdown-drawer-title"
            className="text-lg font-bold text-slate-900"
          >
            Chi tiết điểm phù hợp
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {candidateName} · {jobTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          aria-label="Đóng bảng phân tích"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Recompute Error Notification */}
        {recomputeError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
            <p className="font-semibold">Tính lại điểm không thành công</p>
            <p className="mt-1">{recomputeError.message || 'Vui lòng thử lại sau.'}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div role="status" className="flex flex-col items-center justify-center py-16 text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium">Đang tải dữ liệu phân tích hồ sơ…</p>
          </div>
        )}

        {/* Fetch Error State */}
        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-600 mb-2" aria-hidden="true" />
            <h3 className="text-sm font-bold text-rose-900">Không thể tải phân tích hồ sơ</h3>
            <p className="mt-1 text-xs text-rose-700">{error.message || 'Đã có lỗi xảy ra.'}</p>
            <button
              type="button"
              onClick={loadAnalysis}
              className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Content Loaded */}
        {!loading && !error && data && (
          <>
            {/* 1. NOT_ANALYZED */}
            {status === 'NOT_ANALYZED' && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
                <Clock className="mx-auto h-10 w-10 text-slate-400 mb-3" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-800">Chưa phân tích hồ sơ</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                  Hồ sơ này chưa có kết quả đánh giá mức độ phù hợp với tiêu chí tuyển dụng.
                </p>
              </div>
            )}

            {/* 2. STALE WARNING */}
            {fresh === false && status !== 'NOT_ANALYZED' && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 flex items-start gap-3"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <p className="font-bold">Kết quả đã cũ — Cần tính lại điểm</p>
                  <p className="mt-1 text-amber-800 leading-relaxed">
                    Thông tin ứng viên hoặc yêu cầu công việc đã được chỉnh sửa kể từ lần phân tích gần nhất. Vui lòng bấm &ldquo;Tính lại điểm&rdquo; để cập nhật kết quả mới.
                  </p>
                </div>
              </div>
            )}

            {/* 3. INCOMPLETE STATE */}
            {status === 'INCOMPLETE' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-amber-600 mb-2" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-amber-900">Hồ sơ thiếu dữ liệu</h3>
                  <p className="mt-1 text-xs text-amber-700">
                    Không thể xác định điểm tổng thể và xếp hạng mức độ phù hợp do ứng viên chưa cung cấp đủ dữ liệu.
                  </p>
                </div>

                {/* Missing Inputs */}
                {analysis?.missing_inputs?.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Thông tin còn thiếu
                    </h4>
                    <ul className="space-y-1.5">
                      {analysis.missing_inputs.map((item, index) => {
                        const comp = typeof item === 'object' && item !== null ? item.component : item;
                        const code = typeof item === 'object' && item !== null ? item.code : '';
                        const label = COMPONENT_LABELS[comp] || comp || 'Thông tin chưa đầy đủ';
                        const key = `${comp || 'input'}-${code || 'missing'}-${index}`;
                        return (
                          <li key={key} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="font-medium text-slate-800">{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 4. COMPLETE + FRESH SUCCESS OVERALL */}
            {status === 'COMPLETE' && fresh === true && (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/40 p-6 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Điểm phù hợp tổng thể
                </p>
                <div className="my-2 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-blue-700">
                    {typeof analysis?.total_score === 'number' && Number.isFinite(analysis.total_score)
                      ? `${Math.round(analysis.total_score)}%`
                      : 'Chưa có điểm'}
                  </span>
                </div>
                {analysis?.recommendation && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 px-3 py-1 text-xs font-semibold text-blue-800">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{RECOMMENDATION_LABELS[analysis.recommendation] || 'Đã phân tích'}</span>
                  </div>
                )}
              </div>
            )}

            {/* COMPONENT BREAKDOWN (Skill 50%, Exp 25%, Edu 10%, Project 15%) */}
            {/* When fresh === false, we do NOT display current numeric scores to prevent stale anchoring */}
            {analysis?.scores && fresh !== false && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Trọng số thành phần (50 / 25 / 10 / 15)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Skill (50%) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <Award className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold">Kỹ năng (50%)</span>
                    </div>
                    <p className="text-lg font-extrabold text-slate-800">
                      {typeof analysis.scores.skill === 'number' && Number.isFinite(analysis.scores.skill)
                        ? `${Math.round(analysis.scores.skill)}%`
                        : <span className="text-xs font-medium text-amber-700">Thiếu dữ liệu</span>}
                    </p>
                  </div>

                  {/* Experience (25%) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <Briefcase className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold">Kinh nghiệm (25%)</span>
                    </div>
                    <p className="text-lg font-extrabold text-slate-800">
                      {typeof analysis.scores.experience === 'number' && Number.isFinite(analysis.scores.experience)
                        ? `${Math.round(analysis.scores.experience)}%`
                        : <span className="text-xs font-medium text-amber-700">Thiếu dữ liệu</span>}
                    </p>
                  </div>

                  {/* Education (10%) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <BookOpen className="h-4 w-4 text-purple-600 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold">Học vấn (10%)</span>
                    </div>
                    <p className="text-lg font-extrabold text-slate-800">
                      {typeof analysis.scores.education === 'number' && Number.isFinite(analysis.scores.education)
                        ? `${Math.round(analysis.scores.education)}%`
                        : <span className="text-xs font-medium text-amber-700">Thiếu dữ liệu</span>}
                    </p>
                  </div>

                  {/* Project (15%) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <FolderGit2 className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold">Dự án (15%)</span>
                    </div>
                    <p className="text-lg font-extrabold text-slate-800">
                      {typeof analysis.scores.project === 'number' && Number.isFinite(analysis.scores.project)
                        ? `${Math.round(analysis.scores.project)}%`
                        : <span className="text-xs font-medium text-amber-700">Thiếu dữ liệu</span>}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* DETAILED EVIDENCE (Only when not stale) */}
            {fresh !== false && (
              <>
                {/* Skills Breakdown */}
                {((analysis?.matched_skills?.length ?? 0) > 0 || (analysis?.missing_skills?.length ?? 0) > 0) && (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      Chi tiết kỹ năng
                    </h4>
                    {analysis.matched_skills?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-emerald-800 mb-1.5">Kỹ năng phù hợp:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.matched_skills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.missing_skills?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-rose-800 mb-1.5">Kỹ năng còn thiếu:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.missing_skills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                            >
                              <X className="h-3 w-3 text-rose-500" aria-hidden="true" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Project Technologies Breakdown */}
                {((analysis?.project?.matched_technologies?.length ?? 0) > 0 ||
                  (analysis?.project?.missing_technologies?.length ?? 0) > 0) && (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FolderGit2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                      Công nghệ dự án
                    </h4>
                    {analysis.project.matched_technologies?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-indigo-800 mb-1.5">Công nghệ khớp:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.project.matched_technologies.map((tech) => (
                            <span
                              key={tech}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800"
                            >
                              <CheckCircle2 className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.project.missing_technologies?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Công nghệ chưa đối sánh:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.project.missing_technologies.map((tech) => (
                            <span
                              key={tech}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* METADATA & AUDIT (Safe metadata only, no raw provenance) */}
            {analysis && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Phiên bản thuật toán:</span>
                  <span className="font-semibold text-slate-700 font-mono text-[11px]">
                    {analysis.algorithm_version || 'recruithub-scoring-mvp-v1'}
                  </span>
                </div>
                {analysis.analyzed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thời điểm phân tích:</span>
                    <span className="font-semibold text-slate-700">
                      {formatDateTime(analysis.analyzed_at)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Nguồn bằng chứng:</span>
                  <span>{renderEvidenceSource(analysis.evidence_metadata)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer / Recompute Action */}
      <footer className="border-t border-slate-200 bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
        >
          Đóng
        </button>

        <button
          type="button"
          onClick={handleRecompute}
          disabled={busy || loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{busy ? 'Đang tính lại điểm…' : 'Tính lại điểm'}</span>
        </button>
      </footer>
    </dialog>
  );
}
