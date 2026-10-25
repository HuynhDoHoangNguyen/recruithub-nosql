import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { jobApi } from '../../../api/jobApplicationApi';
import { toVietnamInput } from '../jobFormModel';
import { Button, ErrorMessage, Field, Modal } from '../../applications/components/ApplicationUI';

export default function ReopenJobModal({ job, onClose, onChanged }) {
  const [deadline, setDeadline] = useState(toVietnamInput(job.deadline));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [conflicted, setConflicted] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(null);
    const timestamp = deadline === toVietnamInput(job.deadline) ? job.deadline : new Date(`${deadline}:00+07:00`).toISOString();
    if (!timestamp || Date.parse(timestamp) <= Date.now()) { setError(new Error('Chọn hạn nộp trong tương lai trước khi mở lại tin.')); return; }
    setBusy(true);
    try { await jobApi.status(job._id, 'OPEN', job._rev, timestamp); await onChanged(); onClose(); }
    catch (failure) { setError(failure); if (failure.status === 409) { setConflicted(true); await onChanged(); } }
    finally { setBusy(false); }
  }
  return <Modal title="Mở lại tin tuyển dụng" onClose={onClose} busy={busy}><form className="space-y-5" onSubmit={submit}>
    <p className="font-bold">{job.title}</p><p className="text-sm text-slate-500">Hồ sơ và quyết định tuyển dụng được giữ nguyên. Tin chỉ mở khi thông tin hợp lệ và còn hạn nộp.</p>
    <ErrorMessage error={error} /><Field label="Hạn nộp mới (giờ Việt Nam, UTC+7)" name="reopen-deadline"><input id="reopen-deadline" type="datetime-local" required disabled={busy} value={deadline} onChange={event => setDeadline(event.target.value)} className="input-field mt-2" /></Field>
    {conflicted && <p className="text-sm text-amber-800">Danh sách đã được cập nhật. Đóng hộp thoại và kiểm tra tin trước khi mở lại.</p>}
    <Button type="submit" className="inline-flex gap-2 items-center" disabled={busy || conflicted}><RotateCcw className="h-4 w-4" aria-hidden="true" />{busy ? 'Đang mở lại…' : 'Xác nhận mở lại tin'}</Button>
  </form></Modal>;
}
