import { useState } from 'react';
import { Upload, ShieldCheck } from 'lucide-react';
import { adminBackupApi } from '../../../api/adminBackupApi';
import { formatBytes, formatTime, isExpired, validTarget } from '../backupRestorePresentation';
import RestoreConfirmDialog from './RestoreConfirmDialog';

export default function RestoreBackupForm({ limits, jobs, busy, blocked, run, now }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [validationId, setValidationId] = useState(null);
  const [used, setUsed] = useState(false);
  const [target, setTarget] = useState('recruithub_restore_');
  const [confirm, setConfirm] = useState(false);
  // Recovery after reload chooses the latest known validation; never persists file contents.
  const validation = jobs.find(job => job.type === 'VALIDATE' && (validationId ? job.id === validationId : !file && !used));
  const available = validation?.status === 'SUCCEEDED' && validation.validation_state === 'AVAILABLE'
    && !isExpired(validation, now) && !used;
  const disabled = busy || blocked || !limits;
  const select = event => {
    const next = event.target.files?.[0] || null;
    setFile(next); setValidationId(null); setUsed(false); setProgress(null);
    setFileError(next && (next.size === 0 || next.size > limits.compressed) ? `File phải có dữ liệu và tối đa ${formatBytes(limits.compressed)}.` : '');
  };
  const upload = async () => {
    if (!file || fileError || disabled) return;
    setUploading(true); setValidationId(null); setUsed(false);
    const id = await run('VALIDATE', signal => adminBackupApi.validate(file, event => {
      if (!signal.aborted) setProgress(event.lengthComputable && event.total > 0 ? Math.min(100, Math.round(event.loaded / event.total * 100)) : null);
    }, signal));
    setUploading(false); if (id) setValidationId(id);
  };
  const restore = () => {
    setConfirm(false);
    if (!available || disabled || !validTarget(target)) return;
    setUsed(true);
    void run('RESTORE', signal => adminBackupApi.restore(validation.id, target, signal));
  };
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="restore-heading">
    <div className="flex items-center gap-3"><Upload className="text-blue-600" aria-hidden="true" /><h2 id="restore-heading" className="text-lg font-bold text-slate-900">Khôi phục từ file</h2></div>
    <p className="mt-3 text-sm leading-6 text-slate-600">1. Chọn file RHBR v1 đã tải từ hệ thống. 2. Kiểm tra chữ ký và nội dung. 3. Khôi phục vào database mới.</p>
    <label htmlFor="restore-file" className="mt-5 block text-sm font-semibold text-slate-700">File sao lưu (.rhbr.gz)</label>
    <input id="restore-file" type="file" accept=".gz,.rhbr.gz,application/gzip" className="mt-2 block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-700" disabled={disabled} onChange={select} aria-describedby="restore-file-help" />
    <p id="restore-file-help" className="mt-2 text-xs text-slate-500">{limits ? `Tối đa ${formatBytes(limits.compressed)}. ` : ''}Máy chủ sẽ kiểm tra định dạng thực và chữ ký; đuôi file chỉ hỗ trợ chọn file.</p>
    {file && <p className="mt-2 break-all text-sm text-slate-600">{file.name} · {formatBytes(file.size)}</p>}
    {fileError && <p role="alert" className="mt-2 text-sm text-rose-700">{fileError}</p>}
    <button type="button" className="btn-secondary mt-4 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || !file || Boolean(fileError)} onClick={upload}>Tải lên và kiểm tra</button>
    {uploading && <div className="mt-3 text-sm text-blue-700" role="status">Đang tải file lên{progress == null ? '…' : `: ${progress}%`}. Máy chủ sẽ kiểm tra sau khi nhận file.
      {progress != null && <progress className="mt-2 w-full" max="100" value={progress} aria-label="Tiến độ tải file lên" />}</div>}
    {validation && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      {available ? <><p className="flex items-center gap-2 font-semibold text-emerald-800"><ShieldCheck size={18} aria-hidden="true" />File đã kiểm tra hợp lệ</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-slate-700"><dt>Nguồn</dt><dd className="break-all">{validation.result.source_database}</dd>
          <dt>Tài liệu</dt><dd>{validation.result.document_count} (design: {validation.result.design_count})</dd>
          <dt>Tệp đính kèm</dt><dd>{validation.result.attachment_count} · {formatBytes(validation.result.attachment_bytes)}</dd>
          <dt>Dùng trước</dt><dd>{formatTime(validation.expires_at)}</dd></dl></>
        : <p role="status">{used || validation.validation_state === 'CONSUMED' || validation.validation_state === 'RESERVED'
          ? 'Bản kiểm tra đã được dùng hoặc gửi yêu cầu khôi phục. Muốn tạo tác vụ khác, tải file lên kiểm tra lại.'
          : isExpired(validation, now) ? 'Bản kiểm tra đã hết hạn. Tải file lên kiểm tra lại.'
            : validation.status === 'FAILED' ? 'File kiểm tra không đạt. Xem lỗi tại danh sách tác vụ.' : 'Đang kiểm tra nội dung trên máy chủ…'}</p>}
    </div>}
    <label htmlFor="restore-target" className="mt-5 block text-sm font-semibold text-slate-700">Tên database mới</label>
    <input id="restore-target" className="input-field mt-2" value={target} maxLength={83} onChange={event => setTarget(event.target.value)} disabled={busy || blocked} aria-describedby="restore-target-help" />
    <p id="restore-target-help" className="mt-2 break-words text-xs leading-5 text-slate-500">Bắt đầu bằng recruithub_restore_, sau đó 1–64 chữ thường, số hoặc dấu _. Database đích phải chưa tồn tại.</p>
    {target !== 'recruithub_restore_' && !validTarget(target) && <p role="alert" className="mt-2 text-sm text-rose-700">Tên database chưa đúng quy tắc.</p>}
    <button type="button" className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || !available || !validTarget(target)} onClick={() => setConfirm(true)}>Xem lại và khôi phục</button>
    {confirm && <RestoreConfirmDialog target={target} count={validation?.result?.document_count} onCancel={() => setConfirm(false)} onConfirm={restore} />}
  </section>;
}
