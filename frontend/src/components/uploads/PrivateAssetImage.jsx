import { useEffect, useState } from 'react';
import { assetApi } from '../../api/assetApi';

export default function PrivateAssetImage({ asset, fallback = 'UV', className = 'h-20 w-20', alt = 'Ảnh đại diện ứng viên' }) {
  const [state, setState] = useState(null); const id = asset?.asset_id;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); let url;
    assetApi.content(id, { signal: controller.signal }).then(blob => { if (controller.signal.aborted) return; url = URL.createObjectURL(blob); setState({ id, url }); }).catch(() => { if (!controller.signal.aborted) setState({ id, error: true }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return <span className={`${className} overflow-hidden inline-flex shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-xl font-bold text-blue-700 shadow-md`} title={state?.id === id && state?.error ? 'Không tải được ảnh đại diện' : alt}>
    {state?.id === id && state?.url ? <img src={state.url} alt={alt} onError={() => setState({ id, error: true })} className="h-full w-full object-cover" /> : <span aria-hidden="true">{fallback}</span>}
  </span>;
}
