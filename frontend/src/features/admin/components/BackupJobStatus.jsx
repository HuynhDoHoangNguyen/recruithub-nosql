import { formatTime, isExpired, isRunning, jobNames, phaseNames, statusNames } from '../backupRestorePresentation';

export default function BackupJobStatus({ job, now, onDownload, downloading, onRetry }) {
  const expired = isExpired(job, now);
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold text-slate-900">{jobNames[job.type]}</h3>
      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${job.status === 'SUCCEEDED' && !expired ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{expired ? 'Đã hết hạn' : statusNames[job.status] || 'Không truy cập được'}</span>
    </div>
    <p className="mt-2 break-all font-mono text-xs text-slate-500">{job.id}</p>
    <p className="mt-2 text-sm text-slate-600">Tạo lúc {formatTime(job.created_at)} · Hết hạn {formatTime(job.expires_at)}</p>
    {isRunning(job) && <p role="status" className="mt-3 text-sm text-blue-700">{phaseNames[job.phase] || 'Đang chờ cập nhật'} · Đã xử lý {job.processed ?? 0}{job.total != null ? ` / ${job.total}` : ''} tài liệu</p>}
    {job.error && <p role="alert" className="mt-3 text-sm text-rose-700">{job.error.message}</p>}
    {job.pollError && <div className="mt-3 text-sm text-rose-700"><p role="alert">{job.pollError}</p><button type="button" className="btn-secondary mt-2" onClick={onRetry}>Tải lại trạng thái</button></div>}
    {job.type === 'RESTORE' && job.result && <div className="mt-3 space-y-2 text-sm text-slate-700">
      <p className="break-all">Database đích: <strong>{job.result.target_database}</strong></p>
      {job.status === 'SUCCEEDED' ? <p className="text-emerald-800">Đã đối chiếu {job.result.verified_documents} tài liệu, tệp đính kèm và chỉ mục.</p>
        : <p className="text-amber-800">{job.result.target_incomplete ? 'Đích có thể chưa hoàn chỉnh; cần người vận hành kiểm tra.' : 'Chưa xác nhận tạo database đích.'} Số tài liệu đã xác nhận ghi tối thiểu: {job.result.known_written_documents_minimum ?? 0}. Không tự động tiếp tục tác vụ này.</p>}
      <p>Ứng dụng chưa chuyển sang database đích. Việc cấu hình sử dụng dữ liệu cần người vận hành thực hiện riêng.</p>
    </div>}
    {job.type === 'BACKUP' && job.status === 'SUCCEEDED' && <div className="mt-3">
      <p className="mb-3 text-sm text-slate-600">Đã xuất {job.result?.document_count ?? '—'} tài liệu.</p>
      <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50" disabled={expired || downloading} onClick={() => onDownload(job.id)}>{downloading ? 'Đang tải file…' : 'Tải file sao lưu'}</button>
    </div>}
  </article>;
}
