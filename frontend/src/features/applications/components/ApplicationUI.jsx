import { useEffect, useRef } from 'react';
import { stageLabels } from '../applicationPresentation';

export function Page({ title, subtitle, action, children }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>{subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}</div>{action}</header>{children}
  </div></main>;
}
export function Button({ children, secondary = false, className = '', ...props }) {
  return <button className={`${secondary ? 'btn-secondary' : 'btn-primary'} text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}
export function ErrorMessage({ error, retry }) {
  if (!error) return null;
  return <div role="alert" className="message-error"><p>{error.message}</p>
    {error.status === 409 && <p className="mt-1 text-sm">Dữ liệu có thể đã thay đổi. Hãy kiểm tra trạng thái mới trước khi tiếp tục.</p>}
    {retry && <Button secondary className="mt-3" onClick={retry}>Thử lại</Button>}</div>;
}
export function Resource({ resource, empty = false, emptyMessage = 'Chưa có dữ liệu.', children }) {
  if (resource.loading) return <div role="status" className="card p-8 text-center text-gray-600"><span className="loading-spinner mr-3" aria-hidden="true" />Đang tải dữ liệu…</div>;
  if (resource.error) return <ErrorMessage error={resource.error} retry={resource.reload} />;
  if (empty) return <div className="card p-12 text-center text-gray-600">{emptyMessage}</div>;
  return children;
}
export function StageBadge({ stage }) {
  const colors = { APPLIED: 'bg-sky-100 text-sky-800', SCREENING: 'bg-purple-100 text-purple-800', INTERVIEW: 'bg-amber-100 text-amber-800',
    OFFER: 'bg-teal-100 text-teal-800', HIRED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-rose-100 text-rose-800', WITHDRAWN: 'bg-gray-200 text-gray-700' };
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors[stage] || ''}`}>{stageLabels[stage] || stage}</span>;
}
export function StageFilter({ value, onChange }) {
  return <label className="block text-sm font-semibold text-gray-700">Trạng thái hồ sơ<select className="input-field mt-2" value={value} onChange={event => onChange(event.target.value)}>
    <option value="">Tất cả trạng thái</option>{Object.entries(stageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
  </select></label>;
}
export function Pagination({ pager, data, loading }) {
  return <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-end gap-3"><Button secondary disabled={loading || pager.page === 1} onClick={pager.previous}>Trang trước</Button>
    <span className="text-sm text-gray-600">Trang {pager.page}</span><Button secondary disabled={loading || !data?.has_more} onClick={() => pager.next(data.bookmark)}>Trang sau</Button></nav>;
}
export function Field({ label, name, error, children }) {
  return <div><label htmlFor={name} className="form-label">{label}</label>{children}
    {error && <p id={`${name}-error`} role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}</div>;
}
export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      // Reloading the applicants table replaces its buttons while the dialog is open.
      const currentTrigger = trigger?.isConnected ? trigger : trigger?.id ? document.getElementById(trigger.id) : null;
      currentTrigger?.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="application-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90vh] w-[min(94vw,48rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xl backdrop:bg-gray-900/50">
    <div className="mb-6 flex items-center justify-between gap-4 border-b border-gray-100 pb-4"><h2 id="application-dialog-title" className="text-2xl font-bold text-blue-800">{title}</h2><Button secondary type="button" disabled={busy} onClick={onClose} aria-label="Đóng hộp thoại">Đóng</Button></div>{children}
  </dialog>;
}
