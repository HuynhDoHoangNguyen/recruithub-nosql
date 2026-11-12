import { useContext, useEffect, useRef, useState } from 'react';
import { DatabaseBackup, ShieldAlert } from 'lucide-react';
import AuthContext from '../../context/auth-context';
import { adminBackupApi, backupApiError, saveBackupDownload } from '../../api/adminBackupApi';
import { sourceReason } from './backupRestorePresentation';
import { useBackupRestoreJobs } from './useBackupRestoreJobs';
import BackupJobStatus from './components/BackupJobStatus';
import RestoreBackupForm from './components/RestoreBackupForm';

function BackupRestoreWorkspace({ userId }) {
  const [config, setConfig] = useState(null);
  const [source, setSource] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const downloadController = useRef(null);
  const state = useBackupRestoreJobs(userId);
  useEffect(() => {
    const controller = new AbortController();
    setSourceError(''); setConfig(null);
    adminBackupApi.sources(controller.signal).then(result => {
      if (!controller.signal.aborted) { setConfig(result); setSource(result.sources.find(item => item.available)?.id || ''); }
    }).catch(async error => { const message = await backupApiError(error); if (!controller.signal.aborted) setSourceError(message); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => () => downloadController.current?.abort(), []);
  const download = async id => {
    if (downloadController.current) return;
    const controller = new AbortController(); downloadController.current = controller;
    setDownloading(id); setDownloadError('');
    try { const response = await adminBackupApi.download(id, controller.signal); if (!controller.signal.aborted) saveBackupDownload(response, id); }
    catch (error) { const message = await backupApiError(error); if (!controller.signal.aborted) { setDownloadError(message); state.retry(); } }
    finally { downloadController.current = null; if (!controller.signal.aborted) setDownloading(null); }
  };
  return <section className="space-y-6" aria-label="Sao lưu và khôi phục">
    <header><p className="text-sm font-semibold text-blue-700">Bảo vệ dữ liệu</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sao lưu & khôi phục</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Mỗi bản sao lưu chứa trạng thái hiện tại của một database, tài liệu, design và tệp đính kèm. File không chứa toàn bộ cấu hình máy chủ hay lịch sử phiên bản.</p></header>
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><ShieldAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true" /><p>File có thể chứa hồ sơ, CV và dữ liệu tài khoản. Lưu ở nơi an toàn và chỉ chia sẻ cho người có quyền. Khôi phục tạo database riêng tư mới; ứng dụng không tự chuyển sang dữ liệu vừa khôi phục.</p></div>
    {!config && !sourceError && <p role="status">Đang tải nguồn và giới hạn sao lưu…</p>}
    {sourceError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{sourceError}</p><button type="button" className="btn-secondary mt-3" onClick={() => setRetry(value => value + 1)}>Tải lại nguồn</button></div>}
    {(state.error || downloadError) && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{state.error || downloadError}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="backup-heading">
        <div className="flex items-center gap-3"><DatabaseBackup className="text-blue-600" aria-hidden="true" /><h2 id="backup-heading" className="text-lg font-bold text-slate-900">Tạo bản sao lưu</h2></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">Chọn một nguồn. Máy chủ xuất và kiểm tra file trước khi cho phép tải xuống.</p>
        <label htmlFor="backup-source" className="mt-5 block text-sm font-semibold text-slate-700">Nguồn dữ liệu</label>
        <select id="backup-source" className="input-field mt-2" value={source} onChange={event => setSource(event.target.value)} disabled={!config || state.busy || state.blocked}>
          {!source && <option value="">Chưa có nguồn khả dụng</option>}
          {config?.sources.map(item => <option key={item.id} value={item.id} disabled={!item.available}>{item.label}{!item.available ? ` — ${sourceReason(item.reason)}` : ''}</option>)}
        </select>
        {config?.sources.filter(item => !item.available).map(item => <p key={item.id} className="mt-2 text-xs text-slate-500">{item.label}: {sourceReason(item.reason)}.</p>)}
        {config && !config.sources.some(item => item.available) && <p className="mt-3 text-sm text-slate-600">Chưa có nguồn để sao lưu. Liên hệ người vận hành để kiểm tra cấu hình.</p>}
        <button type="button" className="btn-primary mt-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={!config || !source || state.busy || state.blocked} onClick={() => void state.run('BACKUP', signal => adminBackupApi.create(source, signal))}>Tạo bản sao lưu</button>
        <p className="mt-3 text-xs leading-5 text-slate-500">Mỗi máy chủ xử lý một tác vụ sao lưu, kiểm tra hoặc khôi phục tại một thời điểm.</p>
      </section>
      <RestoreBackupForm limits={config?.limits} {...state} />
    </div>
    <section aria-labelledby="backup-jobs-heading"><h2 id="backup-jobs-heading" className="text-lg font-bold text-slate-900">Tác vụ đã mở trong phiên</h2>
      <p className="mt-2 text-sm text-slate-600">Chỉ theo dõi các mã tác vụ của tài khoản này trên trình duyệt hiện tại; đây không phải toàn bộ lịch sử máy chủ. Rời tab chỉ dừng theo dõi, tác vụ trên máy chủ vẫn tiếp tục.</p>
      {!state.jobs.length ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chưa có tác vụ. Chọn nguồn để tạo sao lưu hoặc tải file lên để kiểm tra.</p>
        : <div className="mt-4 grid gap-4" aria-live="polite">{state.jobs.map(job => <BackupJobStatus key={job.id} job={job} now={state.now} onDownload={download} downloading={downloading === job.id} onRetry={state.retry} />)}</div>}
    </section>
  </section>;
}

export default function AdminBackupRestore() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id;
  if (!userId || auth.user.role !== 'ADMIN') return <p role="alert">Vui lòng đăng nhập bằng tài khoản Admin để quản lý sao lưu.</p>;
  return <BackupRestoreWorkspace key={userId} userId={userId} />;
}
