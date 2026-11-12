import { useEffect, useRef } from 'react';

export default function RestoreConfirmDialog({ target, count, onCancel, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="restore-confirm-title" onCancel={event => { event.preventDefault(); onCancel(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = event.currentTarget.querySelectorAll('button:not(:disabled)');
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl backdrop:bg-slate-950/50">
    <h2 id="restore-confirm-title" className="text-xl font-bold text-slate-900">Xác nhận khôi phục dữ liệu</h2>
    <p className="mt-4 text-sm text-slate-600">Tạo database riêng tư mới và khôi phục {count} tài liệu vào:</p>
    <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 font-mono text-sm font-semibold">{target}</p>
    <p className="mt-4 text-sm leading-6 text-amber-800">Bản kiểm tra chỉ dùng một lần. Nếu ghi dữ liệu thất bại, database đích có thể chưa hoàn chỉnh và cần kiểm tra thủ công.</p>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" className="btn-secondary" autoFocus onClick={onCancel}>Hủy</button>
      <button type="button" className="btn-primary" onClick={onConfirm}>Xác nhận tạo và khôi phục</button>
    </div>
  </dialog>;
}
