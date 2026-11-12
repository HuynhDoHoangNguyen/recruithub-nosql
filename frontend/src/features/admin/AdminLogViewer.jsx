import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaFilter, FaHistory, FaRedo, FaSearch, FaServer } from 'react-icons/fa';
import { adminAuditApi } from '../../api/adminAuditApi';

const auditActions = [
  ['APPLICATION_STAGE_CHANGED', 'Đổi giai đoạn hồ sơ'],
  ['JOB_STATUS_CHANGED', 'Đổi trạng thái tin tuyển dụng'],
  ['USER_ACCOUNT_STATUS_CHANGED', 'Khóa hoặc mở tài khoản'],
];
const systemActions = [
  ['DEPENDENCY_WRITE_FAILED', 'Ghi dữ liệu nghiệp vụ thất bại'],
  ['AUDIT_DELIVERY_FAILED', 'Giao audit thất bại'],
  ['AUDIT_DELIVERY_RECOVERED', 'Giao audit đã phục hồi'],
];
const actionLabels = Object.fromEntries([...auditActions, ...systemActions]);
const outcomeLabels = { SUCCEEDED: 'Thành công', FAILED: 'Thất bại', UNKNOWN: 'Chưa xác định', RECOVERED: 'Đã phục hồi' };
const roleLabels = { ADMIN: 'Admin', RECRUITER: 'Nhà tuyển dụng', CANDIDATE: 'Ứng viên' };
const subjectLabels = { APPLICATION: 'Hồ sơ', JOB: 'Tin tuyển dụng', USER: 'Tài khoản', COMPONENT: 'Thành phần' };

function localDateValue(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(date);
}
function defaultDates() {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 86400000);
  return { fromDate: localDateValue(start), toDate: localDateValue(end) };
}
function toRange(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00+07:00`);
  const to = new Date(`${toDate}T00:00:00+07:00`);
  to.setUTCDate(to.getUTCDate() + 1);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to - from > 30 * 86400000) {
    throw new Error('Khoảng ngày phải từ 1 đến 30 ngày.');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}
function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function requestError(error) {
  const code = error?.response?.data?.error?.code;
  if (code === 'INVALID_CURSOR') return { code, message: 'Trang nhật ký đã hết hiệu lực hoặc bộ lọc đã thay đổi. Hãy quay về trang đầu.' };
  if (code === 'AUDIT_READ_UNAVAILABLE' || error?.response?.status === 503) return { code: 'AUDIT_READ_UNAVAILABLE', message: 'Kho nhật ký tạm thời không thể truy cập. Vui lòng thử lại.' };
  return { code, message: error?.response?.data?.error?.message || 'Không tải được nhật ký.' };
}

function FilterFields({ kind, draft, setDraft, onReset }) {
  const actions = kind === 'audit_trail' ? auditActions : systemActions;
  return <div className="grid gap-3 lg:grid-cols-[160px_160px_210px_minmax(220px,1fr)_auto_auto]">
    <label><span className="mb-1 block text-xs font-semibold text-slate-600">Từ ngày</span><input aria-label="Từ ngày" type="date" className="input-field !py-2.5" value={draft.fromDate} onChange={event => setDraft(current => ({ ...current, fromDate: event.target.value }))} /></label>
    <label><span className="mb-1 block text-xs font-semibold text-slate-600">Đến ngày</span><input aria-label="Đến ngày" type="date" className="input-field !py-2.5" value={draft.toDate} onChange={event => setDraft(current => ({ ...current, toDate: event.target.value }))} /></label>
    <label><span className="mb-1 block text-xs font-semibold text-slate-600">Kiểu lọc</span><select aria-label="Kiểu lọc" className="input-field !py-2.5" value={draft.filterType} onChange={event => setDraft(current => ({ ...current, filterType: event.target.value, filterValue: '', subjectType: 'APPLICATION' }))}><option value="">Không lọc thêm</option><option value="action">Hành động</option>{kind === 'audit_trail' && <option value="actor">Người thực hiện</option>}{kind === 'audit_trail' && <option value="subject">Đối tượng</option>}</select></label>
    {draft.filterType === 'action' ? <label><span className="mb-1 block text-xs font-semibold text-slate-600">Hành động</span><select aria-label="Hành động" className="input-field !py-2.5" value={draft.filterValue} onChange={event => setDraft(current => ({ ...current, filterValue: event.target.value }))}><option value="">Chọn hành động</option>{actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      : draft.filterType === 'actor' ? <label><span className="mb-1 block text-xs font-semibold text-slate-600">ID người thực hiện</span><input aria-label="ID người thực hiện" className="input-field !py-2.5" value={draft.filterValue} onChange={event => setDraft(current => ({ ...current, filterValue: event.target.value }))} placeholder="user:…" /></label>
        : draft.filterType === 'subject' ? <div><span className="mb-1 block text-xs font-semibold text-slate-600">Đối tượng</span><div className="grid grid-cols-[130px_1fr] gap-2"><select aria-label="Loại đối tượng" className="input-field !py-2.5" value={draft.subjectType} onChange={event => setDraft(current => ({ ...current, subjectType: event.target.value, filterValue: '' }))}><option value="APPLICATION">Hồ sơ</option><option value="JOB">Tin tuyển dụng</option><option value="USER">Tài khoản</option></select><input aria-label="ID đối tượng" className="input-field !py-2.5" value={draft.filterValue} onChange={event => setDraft(current => ({ ...current, filterValue: event.target.value }))} placeholder={`${draft.subjectType.toLowerCase()}:…`} /></div></div>
          : <div className="hidden lg:block" />}
    <button type="submit" className="btn-primary self-end !py-2.5"><FaFilter className="mr-2" aria-hidden="true" />Áp dụng</button>
    <button type="button" className="btn-secondary self-end !py-2.5" onClick={onReset}>Đặt lại</button>
  </div>;
}

function EventRow({ event, kind }) {
  const actor = event.actor?.type === 'USER' ? `${roleLabels[event.actor.role] || event.actor.role} · ${event.actor.id}` : 'Hệ thống';
  const subject = `${subjectLabels[event.subject?.type] || event.subject?.type || '—'} · ${event.subject?.id || '—'}`;
  return <article className="border-b border-slate-100 p-4 last:border-b-0 sm:p-5">
    <div className="grid gap-3 md:grid-cols-[180px_minmax(240px,1fr)_minmax(190px,0.8fr)_auto] md:items-center">
      <time className="text-sm font-medium text-slate-600" dateTime={event.occurred_at}>{formatTime(event.occurred_at)}</time>
      <div><p className="font-semibold text-slate-900">{actionLabels[event.action] || event.action}</p><p className="mt-1 break-all text-xs text-slate-500">{kind === 'audit_trail' ? actor : subject}</p></div>
      <div className="text-sm text-slate-600">{kind === 'audit_trail' ? subject : (event.code || '—')}</div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${event.outcome === 'FAILED' ? 'bg-rose-50 text-rose-700' : event.outcome === 'UNKNOWN' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{outcomeLabels[event.outcome] || event.outcome}</span>
    </div>
    {kind === 'audit_trail' && event.change && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><span className="font-medium">{event.change.field}</span> · {event.change.from} → {event.change.to}</p>}
    <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200">Chi tiết kỹ thuật</summary><dl className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><div><dt className="font-semibold">Event ID</dt><dd className="break-all">{event.event_id}</dd></div><div><dt className="font-semibold">Correlation ID</dt><dd className="break-all">{event.correlation_id}</dd></div>{event.operation && <div><dt className="font-semibold">Thao tác</dt><dd>{event.operation}</dd></div>}</dl></details>
  </article>;
}

export default function AdminLogViewer({ kind }) {
  const defaults = useMemo(defaultDates, []);
  const initial = useMemo(() => ({ ...defaults, filterType: '', filterValue: '', subjectType: 'APPLICATION' }), [defaults]);
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(() => ({ ...toRange(defaults.fromDate, defaults.toDate), limit: 25 }));
  const [cursors, setCursors] = useState([null]);
  const [state, setState] = useState({ items: [], nextCursor: null, loading: true, error: null });
  const generation = useRef(0);
  const cursor = cursors.at(-1);

  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const params = cursor ? { cursor, limit: query.limit } : query;
      const loader = kind === 'audit_trail' ? adminAuditApi.listAuditTrails : adminAuditApi.listSystemLogs;
      const result = await loader(params);
      if (requestId === generation.current) setState({ items: Array.isArray(result.items) ? result.items : [], nextCursor: result.has_more ? result.next_cursor : null, loading: false, error: null });
    } catch (error) {
      if (requestId === generation.current) setState(current => ({ ...current, nextCursor: null, loading: false, error: requestError(error) }));
    }
  }, [cursor, kind, query]);
  const invalidate = useCallback(() => { generation.current++; }, []);

  useEffect(() => { load(); return invalidate; }, [load, invalidate]);

  const apply = event => {
    event.preventDefault();
    try {
      const next = { ...toRange(draft.fromDate, draft.toDate), limit: 25 };
      if (draft.filterType && !draft.filterValue.trim()) throw new Error('Hãy nhập giá trị cho bộ lọc đã chọn.');
      if (draft.filterType === 'action') next.action = draft.filterValue;
      if (draft.filterType === 'actor') next.actor_id = draft.filterValue.trim();
      if (draft.filterType === 'subject') {
        next.subject_type = draft.subjectType;
        next.subject_id = draft.filterValue.trim();
      }
      setCursors([null]);
      setQuery(next);
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: { code: 'CLIENT_VALIDATION', message: error.message } }));
    }
  };
  const reset = () => {
    setDraft(initial);
    setCursors([null]);
    setQuery({ ...toRange(initial.fromDate, initial.toDate), limit: 25 });
  };

  const title = kind === 'audit_trail' ? 'Vết kiểm toán' : 'Nhật ký hệ thống';
  const Icon = kind === 'audit_trail' ? FaHistory : FaServer;
  return <section aria-labelledby={`${kind}-title`} className="space-y-5">
    <header className="flex items-start gap-3"><span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon aria-hidden="true" /></span><div><h2 id={`${kind}-title`} className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">Tra cứu tối đa 30 ngày mỗi lần. Thời gian hiển thị theo múi giờ Việt Nam.</p></div></header>
    <form onSubmit={apply} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"><FilterFields kind={kind} draft={draft} setDraft={setDraft} onReset={reset} /></form>
    {state.error && <div role="alert" className="message-error flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><span>{state.error.message}</span><div className="flex gap-2">{state.error.code === 'INVALID_CURSOR' && <button type="button" className="btn-secondary !py-2" onClick={() => setCursors([null])}>Về trang đầu</button>}<button type="button" className="btn-secondary !py-2" onClick={load}><FaRedo className="mr-2" aria-hidden="true" />Thử lại</button></div></div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
      <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">{state.loading ? 'Đang cập nhật…' : `${state.items.length} bản ghi trên trang`}</div>
      {state.loading && state.items.length === 0 ? <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm font-medium text-slate-500"><span className="loading-spinner" aria-hidden="true" />Đang tải {title.toLowerCase()}…</div>
        : !state.loading && state.items.length === 0 && !state.error ? <div className="p-12 text-center"><FaSearch className="mx-auto text-2xl text-slate-400" aria-hidden="true" /><p className="mt-4 font-semibold text-slate-800">Không có bản ghi phù hợp</p><p className="mt-1 text-sm text-slate-500">Thử đổi khoảng ngày hoặc bộ lọc.</p></div>
          : <div aria-live="polite">{state.items.map(event => <EventRow key={event.event_id} event={event} kind={kind} />)}</div>}
      <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5"><p className="text-xs text-slate-500">Trang {cursors.length}</p><div className="flex gap-2"><button aria-label="Trang nhật ký trước" className="btn-secondary !rounded-lg !px-3 !py-2" type="button" disabled={cursors.length === 1 || state.loading} onClick={() => setCursors(current => current.slice(0, -1))}><FaChevronLeft aria-hidden="true" /></button><button aria-label="Trang nhật ký tiếp" className="btn-secondary !rounded-lg !px-3 !py-2" type="button" disabled={!state.nextCursor || state.loading} onClick={() => setCursors(current => [...current, state.nextCursor])}><FaChevronRight aria-hidden="true" /></button></div></footer>
    </div>
  </section>;
}

