import { useEffect, useId, useRef, useState } from 'react';
import { Eye, FileText, LoaderCircle, X } from 'lucide-react';
import { assetApi } from '../../api/assetApi';
import DownloadAssetButton from './DownloadAssetButton';

function Preview({ asset, onClose }) {
  const dialog = useRef(null), titleId = useId();
  const [state, setState] = useState({ loading: true });
  const pdf = asset.content_type === 'application/pdf';
  useEffect(() => {
    const trigger = document.activeElement, controller = new AbortController(); let url;
    dialog.current.showModal();
    const load = async () => {
      try {
        if (pdf) {
          const blob = await assetApi.content(asset.asset_id, { signal: controller.signal });
          if (controller.signal.aborted) return;
          url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          setState({ url });
        } else {
          const data = await assetApi.preview(asset.asset_id, { signal: controller.signal });
          if (!controller.signal.aborted) setState(data);
        }
      } catch (error) { if (!controller.signal.aborted) setState({ error: error.message }); }
    };
    void load();
    const element = dialog.current;
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); element.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [asset.asset_id, pdf]);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto h-[90dvh] w-[96vw] max-w-6xl rounded-2xl border border-slate-200 bg-slate-50 p-0 shadow-2xl backdrop:bg-slate-900/65">
    <div className="flex h-full flex-col"><header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-4"><FileText className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" /><div className="min-w-0 flex-1"><h2 id={titleId} className="break-all font-bold text-slate-900">{asset.file_name}</h2><p className="text-xs text-slate-500">{pdf ? 'Xem CV trực tiếp' : 'Bản xem nội dung Word · Bố cục và hình ảnh có thể khác file gốc'}</p></div><DownloadAssetButton asset={asset} compact /><button type="button" onClick={onClose} aria-label="Đóng bản xem CV" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
        {state.loading && <p role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Đang mở CV…</p>}
        {state.error && <p role="alert" className="message-error">{state.error}</p>}
        {state.url && <iframe src={state.url} title={`CV: ${asset.file_name}`} className="h-full min-h-96 w-full rounded-xl border border-slate-200 bg-white" />}
        {state.text !== undefined && <article className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-800">{state.text || 'File không chứa văn bản có thể trích xuất. Hãy tải file gốc để xem phần hình ảnh.'}</pre>{state.truncated && <p className="mt-6 text-sm text-amber-700">Nội dung dài đã được rút gọn. Tải file gốc để xem đầy đủ.</p>}</article>}
      </div>
    </div>
  </dialog>;
}

export default function ViewAssetButton({ asset }) {
  const [open, setOpen] = useState(false);
  if (!asset) return null;
  return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Eye className="h-4 w-4" aria-hidden="true" />Xem CV</button><DownloadAssetButton asset={asset} compact />{open && <Preview asset={asset} onClose={() => setOpen(false)} />}</div>;
}
