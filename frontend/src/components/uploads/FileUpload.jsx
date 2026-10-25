import { useId, useRef, useState } from 'react';
import { CheckCircle2, CloudUpload, FileText, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { assetApi } from '../../api/assetApi';
import { fileValidation } from './fileValidation';
export default function FileUpload({ kind, label, value, onUploaded, onRemove, disabled = false, onBusyChange, variant = 'dropzone' }) {
  const id = useId(), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const input = useRef(null);
  const image = kind !== 'resume';
  async function upload(file) {
    if (!file || busy || disabled) return;
    const validation = fileValidation(file, kind); setError(validation); if (validation) return;
    setBusy(true); setProgress(0); onBusyChange?.(true);
    try { onUploaded(await assetApi.upload(kind, file, setProgress)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  if (variant === 'button') return <div className="mt-3 max-w-48 space-y-2 text-center"><input ref={input} id={id} type="file" aria-label={label} className="hidden" accept=".jpg,.jpeg,.png,.webp" disabled={busy || disabled} onChange={event => { upload(event.target.files[0]); event.target.value = ''; }} /><button type="button" disabled={busy || disabled} onClick={() => input.current.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}{busy ? `Đang tải ${progress}%` : 'Thay ảnh đại diện'}</button><p className="text-[10px] text-slate-400">JPG, PNG, WEBP · dưới 5 MB</p>{value && onRemove && <button type="button" disabled={busy || disabled} onClick={onRemove} className="text-xs text-slate-400 hover:text-rose-600">Bỏ ảnh đã chọn</button>}{error && <p role="alert" className="text-xs text-rose-600">{error}</p>}</div>;
  return <div className="space-y-3"><label htmlFor={id} className="text-sm font-bold text-slate-700">{label}</label>
    <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); upload(event.dataTransfer.files[0]); }} className={`relative rounded-2xl border-2 border-dashed px-5 py-6 text-center transition focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-400 ${busy || disabled ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 hover:border-blue-400'}`}>
      <input id={id} type="file" accept={image ? '.jpg,.jpeg,.png,.webp' : '.doc,.docx,.pdf'} disabled={busy || disabled} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => { upload(event.target.files[0]); event.target.value = ''; }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait" />
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">{busy ? <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" /> : image ? <ImagePlus className="h-6 w-6" aria-hidden="true" /> : <CloudUpload className="h-6 w-6" aria-hidden="true" />}</span>
      <p className="font-bold text-sm text-slate-700">{busy ? `Đang tải lên ${progress}%` : value ? 'Chọn file khác để thay thế' : 'Bấm chọn hoặc kéo thả file vào đây'}</p>
      <p id={`${id}-help`} className="mt-2 text-xs text-slate-500">{image ? 'JPG, PNG, WEBP' : '.doc, .docx, .pdf'} · Kích thước dưới 5 MB</p>
      {busy && <div role="progressbar" aria-label="Tiến độ tải file" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-1.5 rounded-full bg-blue-100 overflow-hidden"><div style={{ width: `${progress}%` }} className="h-full bg-blue-600 transition-all" /></div>}
    </div>
    {value && <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 flex items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-700">{value.file_name}</p><p className="text-xs text-slate-400 mt-1">{(value.size / 1024).toFixed(1)} KB · Đã tải lên</p></div><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />{onRemove && <button type="button" onClick={onRemove} disabled={disabled || busy} aria-label={`Bỏ ${label.toLowerCase()}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"><X className="h-4 w-4" aria-hidden="true" /></button>}</div>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-rose-600">{error}</p>}
  </div>;
}
