import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { jobApi } from '../../../api/jobApplicationApi';
import { ErrorMessage } from '../../applications/components/ApplicationUI';

export default function DeleteJobButton({ job, disabled, onDeleted, onConflict }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function remove() {
    if (!window.confirm(`Xóa tin “${job.title}” khỏi danh sách và ngừng nhận hồ sơ? CV và lịch sử ứng tuyển đã nộp vẫn được giữ lại.`)) return;
    setBusy(true); setError(null);
    try { await jobApi.remove(job._id, job._rev); await onDeleted(); }
    catch (failure) { setError(failure); if (failure.status === 409) await onConflict?.(); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={disabled || busy} onClick={remove} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" />{busy ? 'Đang xóa…' : 'Xóa tin'}</button><ErrorMessage error={error} /></div>;
}
