import { useRef, useState } from 'react';
import { Download, FileUp, FileDown, X, CircleCheck, CircleAlert, Eye } from 'lucide-react';
import { jobApi } from '../../../api/jobApplicationApi';

const MAX_FILE_SIZE = 256 * 1024;
const PREVIEW_LIMIT = 8;
function saveBlob(blob, fallbackName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fallbackName;
  document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function suggestedName(response, fallback) {
  const disposition = response.headers?.['content-disposition'];
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
}

export default function JobImportExportModal({ onClose, onImported }) {
  const [mode, setMode] = useState('import');
  const [format, setFormat] = useState('csv');
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [showAllImportRows, setShowAllImportRows] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);
  const [showAllExportRows, setShowAllExportRows] = useState(false);
  const [exportFilters, setExportFilters] = useState({ status: '', q: '', created_from: '', created_to: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const resetFile = () => { setFile(null); setContent(''); setPreview(null); setResult(null); setError(''); if (inputRef.current) inputRef.current.value = ''; };
  async function chooseFile(next) {
    resetFile();
    if (!next) return;
    const ext = next.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(ext)) { setError('Chỉ hỗ trợ file .csv hoặc .json.'); return; }
    if (next.size > MAX_FILE_SIZE) { setError('File tối đa 256 KB.'); return; }
    try { setFile(next); setFormat(ext); setContent(await next.text()); } catch { setError('Không đọc được file đã chọn.'); }
  }
  async function previewFile() {
    setBusy(true); setError(''); setResult(null);
    try { setPreview(await jobApi.importPreview({ format, fileName: file.name, content })); setShowAllImportRows(false); }
    catch (failure) { setError(failure.message); setPreview(null); }
    finally { setBusy(false); }
  }
  async function confirmImport() {
    if (!preview || !window.confirm(`Tạo ${preview.valid} tin tuyển dụng ở trạng thái Nháp?`)) return;
    setBusy(true); setError('');
    try { const data = await jobApi.importConfirm({ format, fileName: file.name, content, previewToken: preview.previewToken }); setResult(data); setPreview(null); await onImported?.(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function downloadTemplate(templateFormat) {
    setBusy(true); setError('');
    try { const response = await jobApi.importTemplate(templateFormat); saveBlob(response.data, suggestedName(response, `recruithub-jobs-template.${templateFormat}`)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function exportJobs() {
    setBusy(true); setError('');
    try {
      const params = { format, ...Object.fromEntries(Object.entries(exportFilters).filter(([, value]) => value)) };
      const response = await jobApi.exportJobs(params);
      saveBlob(response.data, suggestedName(response, `recruithub-jobs.${format}`));
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function updateExportFilter(field, value) {
    setExportFilters(current => ({ ...current, [field]: value }));
    setExportPreview(null);
    setShowAllExportRows(false);
    setError('');
  }
  async function previewExport() {
    setBusy(true); setError(''); setExportPreview(null);
    try {
      const params = { format: 'json', ...Object.fromEntries(Object.entries(exportFilters).filter(([, value]) => value)) };
      const response = await jobApi.exportJobs(params);
      const payload = JSON.parse(await response.data.text());
      if (!Array.isArray(payload.jobs)) throw new Error('Dữ liệu xem trước không đúng định dạng.');
      setExportPreview({ jobs: payload.jobs, exportedAt: payload.exported_at });
      setShowAllExportRows(false);
    } catch (failure) {
      setError(failure.message || 'Không thể tải bản xem trước.');
    } finally { setBusy(false); }
  }
  const validPreview = preview?.rows.filter(row => row.status === 'READY') || [];
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="job-import-export-title" className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
      <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Tin tuyển dụng</p><h2 id="job-import-export-title" className="mt-1 text-xl font-extrabold text-slate-900">Nhập / xuất công việc</h2><p className="mt-1 text-sm text-slate-500">Job nhập vào luôn được tạo ở trạng thái Nháp.</p></div><button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="mt-5 flex gap-2 border-b border-slate-200 pb-3"><button type="button" onClick={() => { setMode('import'); setError(''); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'import' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><FileUp className="mr-2 inline h-4 w-4" />Nhập</button><button type="button" onClick={() => { setMode('export'); setError(''); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'export' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><FileDown className="mr-2 inline h-4 w-4" />Xuất</button></div>
      {mode === 'import' ? <div className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-700">Tải mẫu:</span><button disabled={busy} onClick={() => downloadTemplate('csv')} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"><Download className="mr-1 inline h-4 w-4" />CSV</button><button disabled={busy} onClick={() => downloadTemplate('json')} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"><Download className="mr-1 inline h-4 w-4" />JSON</button></div>
        <label className="block rounded-xl border-2 border-dashed border-blue-200 bg-slate-50 p-5"><span className="block text-sm font-semibold text-slate-800">Chọn file CSV hoặc JSON (tối đa 256 KB)</span><input ref={inputRef} type="file" accept=".csv,.json,application/json,text/csv" onChange={event => chooseFile(event.target.files?.[0])} className="mt-3 block w-full text-sm text-slate-600" /></label>
        {file && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="text-sm text-slate-700">{file.name} · {Math.ceil(file.size / 1024)} KB</span><button disabled={busy || !content} onClick={previewFile} className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang kiểm tra…' : 'Xem trước và kiểm tra'}</button></div>}
        {preview && <div className="space-y-3"><div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-slate-700">Tệp có <b>{preview.total}</b> dòng: <b className="text-emerald-700">{preview.valid} hợp lệ</b>, <b className="text-amber-700">{preview.skipped} trùng/bỏ qua</b>, <b className="text-rose-700">{preview.failed} lỗi</b>. Chỉ các dòng hợp lệ mới được tạo thành tin Nháp.</div><div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Sẵn sàng <b>{preview.valid}</b></div><div className="rounded-lg bg-amber-50 p-3 text-amber-800">Bỏ qua <b>{preview.skipped}</b></div><div className="rounded-lg bg-rose-50 p-3 text-rose-800">Lỗi <b>{preview.failed}</b></div></div><div className="overflow-hidden rounded-xl border border-slate-200"><div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th className="p-2">Dòng</th><th className="p-2">Trạng thái</th><th className="p-2">Tin / lỗi</th></tr></thead><tbody>{(showAllImportRows ? preview.rows : preview.rows.slice(0, PREVIEW_LIMIT)).map(row => <tr key={row.row} className="border-t border-slate-100 align-top"><td className="p-2">{row.row}</td><td className="p-2">{row.status}</td><td className="p-2">{row.job?.title || row.errors?.map(item => item.message).join('; ') || row.warnings?.map(item => item.message).join('; ')}</td></tr>)}</tbody></table></div>{preview.rows.length > PREVIEW_LIMIT && <button type="button" onClick={() => setShowAllImportRows(value => !value)} className="w-full border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">{showAllImportRows ? 'Thu gọn danh sách' : `Xem tất cả ${preview.rows.length} dòng`}</button>}</div><button disabled={busy || !validPreview.length} onClick={confirmImport} className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang nhập…' : `Xác nhận nhập ${validPreview.length} tin nháp`}</button></div>}
        {result && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold text-emerald-900"><CircleCheck className="mr-2 inline h-5 w-5" />Hoàn tất: {result.created} tạo mới, {result.skipped} bỏ qua, {result.failed} lỗi.</p><ul className="mt-2 max-h-32 overflow-auto text-xs text-emerald-800">{result.rows.map(row => <li key={row.row}>Dòng {row.row}: {row.status}{row.errors?.map(e => ` — ${e.message}`)}</li>)}</ul></div>}
      </div> : <div className="space-y-4 pt-5"><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Định dạng<select value={format} onChange={event => setFormat(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5"><option value="csv">CSV</option><option value="json">JSON</option></select></label><label className="block text-sm font-medium text-slate-700">Trạng thái<select value={exportFilters.status} onChange={event => updateExportFilter('status', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5"><option value="">Tất cả</option><option value="DRAFT">Nháp</option><option value="OPEN">Đang tuyển</option><option value="CLOSED">Đã đóng</option></select></label><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Từ khóa<input value={exportFilters.q} onChange={event => updateExportFilter('q', event.target.value)} maxLength={120} placeholder="Tên vị trí, ngành nghề…" className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Tạo từ<input type="date" value={exportFilters.created_from} onChange={event => updateExportFilter('created_from', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Đến ngày<input type="date" value={exportFilters.created_to} onChange={event => updateExportFilter('created_to', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" /></label></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={previewExport} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><Eye className="mr-2 inline h-4 w-4" />{busy ? 'Đang lấy dữ liệu…' : 'Xem trước số lượng và danh sách'}</button><button type="button" disabled={busy || !exportPreview} onClick={exportJobs} className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : `Tải file ${format.toUpperCase()}`}</button></div>{exportPreview && <section className="overflow-hidden rounded-xl border border-blue-100 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/70 p-3"><div><p className="font-bold text-slate-800">Sẽ xuất <span className="text-blue-700">{exportPreview.jobs.length}</span> tin</p><p className="text-xs text-slate-500">{exportFilters.created_from || exportFilters.created_to ? `Khoảng ngày tạo: ${exportFilters.created_from || 'không giới hạn'} – ${exportFilters.created_to || 'không giới hạn'}` : 'Không giới hạn ngày tạo'}{exportFilters.status ? ` · ${exportFilters.status}` : ''}{exportFilters.q ? ` · Từ khóa “${exportFilters.q}”` : ''}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{exportPreview.jobs.length > PREVIEW_LIMIT ? `Hiển thị ${showAllExportRows ? exportPreview.jobs.length : Math.min(PREVIEW_LIMIT, exportPreview.jobs.length)} / ${exportPreview.jobs.length}` : `${exportPreview.jobs.length} tin`}</span></div>{exportPreview.jobs.length ? <div className="max-h-64 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-white text-slate-500"><tr><th className="p-2">Vị trí</th><th className="p-2">Ngành nghề</th><th className="p-2">Cấp độ</th><th className="p-2">Trạng thái</th></tr></thead><tbody>{(showAllExportRows ? exportPreview.jobs : exportPreview.jobs.slice(0, PREVIEW_LIMIT)).map((job, index) => <tr key={`${job.title}-${index}`} className="border-t border-slate-100"><td className="max-w-[240px] truncate p-2 font-medium text-slate-800" title={job.title}>{job.title || '—'}</td><td className="p-2">{job.industry || '—'}</td><td className="p-2">{job.seniority || '—'}</td><td className="p-2">{job.status || '—'}</td></tr>)}</tbody></table></div> : <p className="p-5 text-center text-sm text-slate-500">Không có tin phù hợp với bộ lọc này.</p>}{exportPreview.jobs.length > PREVIEW_LIMIT && <button type="button" onClick={() => setShowAllExportRows(value => !value)} className="w-full border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">{showAllExportRows ? 'Thu gọn danh sách' : `Xem tất cả ${exportPreview.jobs.length} tin`}</button>}</section>}</div>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><CircleAlert className="mr-2 inline h-4 w-4" />{error}</p>}
      <footer className="mt-6 flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đóng</button></footer>
    </section>
  </div>;
}
