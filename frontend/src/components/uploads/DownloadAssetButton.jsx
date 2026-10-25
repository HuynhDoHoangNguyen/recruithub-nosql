import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { assetApi } from '../../api/assetApi';

export default function DownloadAssetButton({ asset, compact = false }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!asset) return null;
  async function download() {
    setBusy(true); setError(''); let url;
    try {
      const blob = await assetApi.content(asset.asset_id); url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = asset.file_name; document.body.append(link); link.click(); link.remove();
    } catch (failure) { setError(failure.message); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); setBusy(false); }
  }
  return <div><button type="button" onClick={download} disabled={busy} aria-label={`Tải CV: ${asset.file_name}`} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}{compact ? 'Tải xuống' : `Tải CV: ${asset.file_name}`}</button>{error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}</div>;
}
