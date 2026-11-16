import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { normalizeRole } from '../../features/applications/applicationPresentation';
import { topics, findFaqTopic } from './faqTopics';
import { sendSupportChat } from '../../api/supportChatApi';
import ChatJobResults from './ChatJobResults';

export default function FaqChatbox() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const role = normalizeRole(user?.role);
  const visible = (!user || role === 'CANDIDATE')
    && !/^\/(admin|recruiter|login|register|reset-password)(\/|$)/.test(pathname);
  return visible ? <ClientChatbox key={user?._id || user?.email || (user ? 'candidate' : 'guest')} user={user} /> : null;
}

function ClientChatbox({ user }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(null);
  const launcher = useRef(null);
  const closeButton = useRef(null);
  const answer = useRef(null);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  useEffect(() => {
    answer.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selected, messages, busy]);

  useEffect(() => () => { pending.current?.abort(); }, []);

  function cancel() {
    pending.current?.abort(); pending.current = null; setBusy(false);
  }

  function close() {
    cancel();
    setOpen(false);
    launcher.current?.focus();
  }

  function chooseTopic(topic) { cancel(); setSelected(topic); setError(''); }

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !message.trim() || message.trim().length > 1000) return;
    const question = message.trim();
    const controller = new AbortController(); pending.current = controller;
    const history = [];
    let size = 0;
    for (const item of [...messages].reverse()) {
      if (item.content.length > 1000 || size + item.content.length > 4000 || history.length === 6) break;
      history.unshift({ role: item.role, content: item.content }); size += item.content.length;
    }
    const previous = [...messages, { role: 'user', content: question }].slice(-11);
    setMessages(previous); setBusy(true); setError(''); setSelected(null);
    try {
      const response = await sendSupportChat(question, history, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      setMessages([...previous, { role: 'assistant', content: response.reply,
        ...(response.mode === 'jobs' ? { result: response } : {}) }].slice(-12)); setMessage('');
    } catch (failure) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setError(failure.response?.data?.error?.code === 'CHAT_SEARCH_UNAVAILABLE' ? 'Chưa thể đọc dữ liệu việc làm. Hãy mở trang Việc làm hoặc thử lại sau.'
        : failure.response?.status === 429 ? 'Đã đạt giới hạn AI. Hãy chờ một lúc hoặc dùng FAQ bên dưới.'
        : 'AI hiện chưa khả dụng hoặc phản hồi quá chậm. Bạn vẫn có thể dùng FAQ bên dưới.');
      setSelected(findFaqTopic(question));
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  function reset() { cancel(); setMessages([]); setSelected(null); setError(''); setMessage(''); }
  const needsLogin = selected?.protected && !user;

  return <aside aria-label="Hỗ trợ sử dụng RecruiHub" className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
    {open && <section id="faq-chatbox" role="dialog" aria-modal="false" aria-labelledby="faq-title"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}
      className="mb-3 flex max-h-[calc(100dvh-7rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 bg-blue-700 px-5 py-4 text-white">
        <div><h2 id="faq-title" className="font-bold">RecruiHub hỗ trợ</h2><p className="mt-1 text-xs text-blue-100">Giải đáp nhanh cho ứng viên</p></div>
        <button ref={closeButton} type="button" onClick={close} aria-label="Đóng hỗ trợ" className="rounded-lg p-1 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="space-y-4 overflow-y-auto overscroll-contain p-4">
        <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">Xin chào! Bạn cần hướng dẫn thao tác nào? Chọn một câu hỏi bên dưới nhé.</p>
        {messages.length > 0 && <div role="log" aria-live="polite" aria-label="Hội thoại hỗ trợ" className="space-y-3">{messages.map((item, index) => <div key={index} className={`rounded-xl p-3 text-sm leading-6 ${item.role === 'user' ? 'ml-5 bg-slate-100' : 'mr-2 bg-blue-50'}`}>
          <p className="mb-1 text-xs font-bold text-slate-500">{item.role === 'user' ? 'Bạn' : item.result ? 'Tìm việc · CouchDB' : 'AI · Gemini'}</p><p className="whitespace-pre-wrap break-words text-slate-800">{item.content}</p>
          {item.result && <ChatJobResults result={item.result} onNavigate={close} />}
        </div>)}</div>}
        {busy && <p role="status" className="text-sm text-blue-700">AI đang trả lời…</p>}
        {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div aria-label="Câu hỏi gợi ý" className="flex flex-wrap gap-2">{topics.map(topic => <button key={topic.id} type="button" onClick={() => chooseTopic(topic)} aria-pressed={selected?.id === topic.id}
          className={`rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${selected?.id === topic.id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'}`}>{topic.question}</button>)}</div>
        {selected && <div ref={answer} role="status" aria-live="polite" aria-atomic="true" className="space-y-3 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-slate-700">
          <p className="text-xs font-bold text-blue-700">FAQ · Hướng dẫn có sẵn</p>
          <h3 className="font-bold text-slate-900">{selected.title}</h3>
          <ol className="list-decimal space-y-2 pl-5">{selected.steps.map(step => <li key={step}>{step}</li>)}</ol>
          {selected.note && <p className="text-xs leading-5 text-slate-600">{selected.note}</p>}
          {needsLogin && <p className="text-xs leading-5 text-blue-800">Bạn cần đăng nhập tài khoản ứng viên để mở trang này.</p>}
          <Link to={needsLogin ? '/login' : selected.to} state={needsLogin ? { from: selected.to } : undefined} onClick={close}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-800">{needsLogin ? 'Đăng nhập để tiếp tục' : selected.action}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>}
        <div ref={!selected ? answer : undefined} />
      </div>
      <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-slate-100 bg-white p-4">
        <label htmlFor="support-question" className="text-xs font-semibold text-slate-700">Hỏi trợ lý AI</label>
        <div className="flex items-end gap-2"><textarea id="support-question" value={message} onChange={event => setMessage(event.target.value)} maxLength={1000} rows={2} disabled={busy}
          placeholder="Ví dụ: Tìm việc Node.js ở Hà Nội, làm hybrid"
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }}
          className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
          <button type="submit" disabled={busy || !message.trim()} aria-label="Gửi câu hỏi" className="rounded-xl bg-blue-700 p-3 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Send size={18} aria-hidden="true" /></button></div>
        <div className="flex justify-between text-xs text-slate-500"><span>{message.length}/1.000 ký tự</span><button type="button" onClick={reset} className="text-blue-700 hover:underline">Xóa hội thoại</button></div>
        <p className="text-[11px] leading-4 text-slate-500">Câu hỏi và lịch sử gần đây được gửi tới Google Gemini. Không nhập mật khẩu hoặc thông tin nhạy cảm. AI có thể trả lời sai; FAQ vẫn dùng được khi AI lỗi.</p>
      </form>
    </section>}
    <button ref={launcher} type="button" aria-label={open ? 'Thu gọn hỗ trợ' : 'Mở hỗ trợ FAQ'} aria-expanded={open} aria-controls={open ? 'faq-chatbox' : undefined}
      onClick={() => { if (open) close(); else setOpen(true); }} className="ml-auto flex items-center gap-2 rounded-full bg-blue-700 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <MessageCircle size={21} aria-hidden="true" /><span>Hỗ trợ</span>
    </button>
  </aside>;
}
