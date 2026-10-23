import { useEffect, useRef } from 'react';
import { stageLabels } from '../applicationPresentation';

export function Page({ title, subtitle, action, children }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600">RecruiHub</p>
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>{subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}</div>{action}</header>{children}
  </div></main>;
}
export function Button({ children, secondary = false, className = '', ...props }) {
  return <button className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${secondary ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'} ${className}`} {...props}>{children}</button>;
}
export function ErrorMessage({ error, retry }) {
  if (!error) return null;
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><p>{error.message}</p>
    {error.status === 409 && <p className="mt-1 text-sm">Dữ liệu có thể đã thay đổi. Hãy kiểm tra trạng thái mới trước khi tiếp tục.</p>}
    {retry && <Button secondary className="mt-3" onClick={retry}>Thử lại</Button>}</div>;
}
export function Resource({ resource, empty = false, emptyMessage = 'Chưa có dữ liệu.', children }) {
  if (resource.loading) return <p role="status" className="rounded-xl bg-white p-8 text-slate-600">Đang tải dữ liệu…</p>;
  if (resource.error) return <ErrorMessage error={resource.error} retry={resource.reload} />;
  if (empty) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">{emptyMessage}</p>;
  return children;
}
export function StageBadge({ stage }) {
  const colors = { APPLIED: 'bg-sky-100 text-sky-800', SCREENING: 'bg-purple-100 text-purple-800', INTERVIEW: 'bg-amber-100 text-amber-800',
    OFFER: 'bg-teal-100 text-teal-800', HIRED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-rose-100 text-rose-800', WITHDRAWN: 'bg-slate-200 text-slate-700' };
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors[stage] || ''}`}>{stageLabels[stage] || stage}</span>;
}
export function StageFilter({ value, onChange }) {
  return <label className="block text-sm font-medium text-slate-700">Trạng thái hồ sơ<select className="ml-3 rounded-lg border border-slate-300 bg-white p-2" value={value} onChange={event => onChange(event.target.value)}>
    <option value="">Tất cả trạng thái</option>{Object.entries(stageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
  </select></label>;
}
export function Pagination({ pager, data, loading }) {
  return <nav aria-label="Phân trang" className="flex items-center justify-end gap-4"><Button secondary disabled={loading || pager.page === 1} onClick={pager.previous}>Trang trước</Button>
    <span className="text-sm text-slate-600">Trang {pager.page}</span><Button secondary disabled={loading || !data?.has_more} onClick={() => pager.next(data.bookmark)}>Trang sau</Button></nav>;
}
export function Field({ label, name, error, children }) {
  return <div><label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>{children}
    {error && <p id={`${name}-error`} role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}</div>;
}
export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="application-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90vh] w-[min(94vw,48rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-900/50">
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id="application-dialog-title" className="text-xl font-bold text-slate-900">{title}</h2><Button secondary type="button" disabled={busy} onClick={onClose} aria-label="Đóng hộp thoại">Đóng</Button></div>{children}
  </dialog>;
}
