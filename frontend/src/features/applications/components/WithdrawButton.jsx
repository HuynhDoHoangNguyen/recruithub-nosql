import { useState } from 'react';
import { toast } from 'react-toastify';
import { applicationApi } from '../../../api/jobApplicationApi';
import { canWithdraw } from '../applicationPresentation';
import { Button, ErrorMessage } from './ApplicationUI';

export default function WithdrawButton({ application, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function withdraw() {
    if (!window.confirm('Xác nhận rút đơn? CV và lịch sử lần này sẽ được giữ lại. Bạn có thể nộp lại nếu tin vẫn mở và còn hạn.')) return;
    setBusy(true); setError(null);
    try { await applicationApi.withdraw(application); toast.success('Đã rút đơn ứng tuyển.'); await onChanged(); }
    catch (failure) { setError(failure); toast.error(failure.message); if (failure.status === 409) await onChanged(); }
    finally { setBusy(false); }
  }
  if (!canWithdraw(application.current_stage)) return null;
  return <div className="space-y-3"><ErrorMessage error={error} /><Button secondary disabled={busy} onClick={withdraw}>{busy ? 'Đang rút đơn…' : 'Rút đơn ứng tuyển'}</Button></div>;
}
