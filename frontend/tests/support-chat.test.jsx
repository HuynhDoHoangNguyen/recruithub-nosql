import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import FaqChatbox from '../src/components/support/FaqChatbox';
import { sendSupportChat } from '../src/api/supportChatApi';

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../src/api/supportChatApi', () => ({ sendSupportChat: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); auth.user = null; });
afterEach(cleanup);
function show() {
  const view = render(<MemoryRouter><FaqChatbox /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Mở hỗ trợ FAQ' }));
  return view;
}
function ask(value = 'Tôi muốn cập nhật hồ sơ') {
  fireEvent.change(screen.getByLabelText('Hỏi trợ lý AI'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

it('keeps FAQ suggestions entirely local', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: 'Tìm việc như thế nào?' }));
  expect(screen.getByText('FAQ · Hướng dẫn có sẵn')).toBeTruthy(); expect(sendSupportChat).not.toHaveBeenCalled();
});

it('sends bounded conversation and renders AI as text, not HTML or executable links', async () => {
  sendSupportChat.mockResolvedValue({ mode: 'ai', reply: '<img src=x onerror=alert(1)> Mở Hồ sơ cá nhân.' });
  show(); ask();
  await screen.findByText('AI · Gemini');
  expect(screen.getByText(/<img src=x/)).toBeTruthy(); expect(document.querySelector('img')).toBeNull();
  expect(sendSupportChat.mock.calls[0][1]).toEqual([]);
  sendSupportChat.mockResolvedValue({ mode: 'ai', reply: 'Chọn Chỉnh sửa hồ sơ.' }); ask('Rồi làm gì tiếp?');
  await screen.findByText('Chọn Chỉnh sửa hồ sơ.');
  expect(sendSupportChat.mock.calls[1][1]).toHaveLength(2);
});

it.each([503, 429, 504])('provider failure %s displays honest fallback, retains question and usable CTA', async status => {
  sendSupportChat.mockRejectedValue({ response: { status } }); show(); ask();
  await screen.findByRole('alert');
  expect(screen.getByText('FAQ · Hướng dẫn có sẵn')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Đăng nhập để tiếp tục' }).getAttribute('href')).toBe('/login');
  expect(screen.getByLabelText('Hỏi trợ lý AI').value).toBe('Tôi muốn cập nhật hồ sơ');
  expect(screen.queryByText('AI · Gemini')).toBeNull(); expect(sendSupportChat).toHaveBeenCalledTimes(1);
});

it('offers generic FAQ on an unrecognized question after failure', async () => {
  sendSupportChat.mockRejectedValue(new Error('offline')); show(); ask('abcxyz');
  await screen.findByRole('alert'); expect(screen.getByRole('button', { name: 'Tìm việc như thế nào?' })).toBeTruthy();
  expect(screen.queryByText('FAQ · Hướng dẫn có sẵn')).toBeNull();
});

it('blocks double send, whitespace and IME Enter while supporting Enter submit', async () => {
  const pending = deferred(); sendSupportChat.mockReturnValue(pending.promise); show();
  const input = screen.getByLabelText('Hỏi trợ lý AI');
  fireEvent.change(input, { target: { value: '   ' } }); fireEvent.submit(input.form); expect(sendSupportChat).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'Xin chào' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(sendSupportChat).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.submit(input.form);
  expect(sendSupportChat).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve({ mode: 'ai', reply: 'Chào bạn.' }));
});

it.each(['close', 'reset', 'faq', 'unmount', 'identity'])('ignores late replies after %s and aborts the request', async action => {
  const pending = deferred(); sendSupportChat.mockReturnValue(pending.promise); const view = show(); ask();
  const signal = sendSupportChat.mock.calls[0][2];
  if (action === 'close') fireEvent.click(screen.getByRole('button', { name: 'Đóng hỗ trợ' }));
  if (action === 'reset') fireEvent.click(screen.getByRole('button', { name: 'Xóa hội thoại' }));
  if (action === 'faq') fireEvent.click(screen.getByRole('button', { name: 'Tìm việc như thế nào?' }));
  if (action === 'unmount') view.unmount();
  if (action === 'identity') { auth.user = { _id: 'new-candidate', role: 'CANDIDATE' }; view.rerender(<MemoryRouter><FaqChatbox /></MemoryRouter>); }
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ mode: 'ai', reply: 'Late private answer' }));
  expect(screen.queryByText('Late private answer')).toBeNull();
  if (action === 'close') { fireEvent.click(screen.getByRole('button', { name: 'Mở hỗ trợ FAQ' })); expect(screen.queryByText('Late private answer')).toBeNull(); }
});

function CurrentPath() { return <output aria-label="Đường dẫn">{useLocation().pathname}</output>; }
const jobResult = {
  mode: 'jobs', reply: 'Tìm thấy tin phù hợp trong CouchDB.',
  filter_labels: ['node.js', 'Hà Nội', 'Hybrid (Linh hoạt)'], searched: true,
  checked_at: '2026-11-16T06:00:00Z', partial: false, has_more: false,
  search_url: '/jobs?location=VN-HN&skills=node.js',
  jobs: [{ id: 'job:real-01', title: 'Backend từ CouchDB', company_name: 'Công ty thật', location_label: 'Hà Nội',
    work_mode_label: 'Hybrid (Linh hoạt)', seniority: 'JUNIOR', required_skills: ['node.js'], deadline: '2026-12-30T00:00:00Z' }],
};

it('renders real job cards with encoded internal detail links and closes on navigation', async () => {
  sendSupportChat.mockResolvedValue(jobResult);
  render(<MemoryRouter><FaqChatbox /><CurrentPath /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Mở hỗ trợ FAQ' })); ask('Tìm việc Node.js ở Hà Nội');
  const link = await screen.findByRole('link', { name: 'Backend từ CouchDB' });
  expect(link.getAttribute('href')).toBe('/jobs/job%3Areal-01');
  expect(screen.getByText('Tìm việc · CouchDB')).toBeTruthy();
  expect(screen.getByText('Công ty thật')).toBeTruthy();
  expect(screen.getByText(/Bộ lọc đã hiểu: node.js · Hà Nội/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Mở trang việc làm với bộ lọc này' }).getAttribute('href')).toBe(jobResult.search_url);
  fireEvent.click(link);
  expect(screen.getByLabelText('Đường dẫn').textContent).toBe('/jobs/job%3Areal-01');
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('shows an honest empty/partial result and never invents cards', async () => {
  sendSupportChat.mockResolvedValue({ ...jobResult, jobs: [], partial: true, reply: 'Chưa tìm thấy trong phạm vi kiểm tra.' });
  show(); ask('Tìm việc khác');
  await screen.findByText('Chưa tìm thấy trong phạm vi kiểm tra.');
  expect(screen.getByText(/Đã chạm giới hạn tra cứu/)).toBeTruthy();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.getByRole('link', { name: 'Mở trang việc làm với bộ lọc này' })).toBeTruthy();
});

it('unsupported filters are distinguished from an actual zero-result DB query', async () => {
  sendSupportChat.mockResolvedValue({ ...jobResult, jobs: [], searched: false, reply: 'Chưa hỗ trợ mức lương.' });
  show(); ask('Tìm việc lương 50 triệu');
  await screen.findByText('Chưa hỗ trợ mức lương.');
  expect(screen.getByText('Chưa truy vấn dữ liệu do tiêu chí chưa được hỗ trợ.')).toBeTruthy();
});

it('DB errors display a lookup error rather than empty job results', async () => {
  sendSupportChat.mockRejectedValue({ response: { status: 503, data: { error: { code: 'CHAT_SEARCH_UNAVAILABLE' } } } });
  show(); ask('Tìm việc Node.js');
  expect((await screen.findByRole('alert')).textContent).toContain('Chưa thể đọc dữ liệu việc làm');
  expect(screen.queryByText('Tìm việc · CouchDB')).toBeNull();
});
