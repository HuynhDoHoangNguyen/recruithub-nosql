import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { applicationApi } from '../../../api/jobApplicationApi';
import { reasonLabels, stageLabels } from '../applicationPresentation';
import { useApiResource } from '../useApiResource';
import { Button, ErrorMessage, Field, Modal, Resource, StageBadge } from './ApplicationUI';
import ApplicationTimeline from './ApplicationTimeline';

export default function ApplicantDetailModal({ id, onClose, onChanged }) {
  const resource = useApiResource(useCallback(() => applicationApi.detail(id), [id]));
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [acceptedAt, setAcceptedAt] = useState('');
  const [method, setMethod] = useState('EMAIL');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const application = resource.data;
  async function submit(event) {
    event.preventDefault(); setError(null);
    if (!target || (target === 'REJECTED' && !reason) || (target === 'HIRED' && (!acceptedAt || !confirmed))) {
      setError(new Error('Chọn trạng thái và điền đầy đủ lý do hoặc bằng chứng cần thiết.')); return;
    }
    setBusy(true);
    try {
      await applicationApi.transition(application, { to_stage: target,
        ...(target === 'REJECTED' ? { reason_code: reason } : {}), ...(note.trim() ? { note: note.trim() } : {}),
        ...(target === 'HIRED' ? { evidence: { accepted_at: new Date(`${acceptedAt}:00+07:00`).toISOString(), method,
          ...(reference.trim() ? { [method === 'ELECTRONIC_SIGNATURE' ? 'signed_document_id' : 'reference']: reference.trim() } : {}) } } : {}),
      });
      toast.success('Đã chuyển trạng thái hồ sơ.'); setTarget(''); setReason(''); setNote(''); setConfirmed(false);
      await resource.reload(); await onChanged();
    } catch (failure) {
      setError(failure);
      if (failure.status === 409) { setTarget(''); await resource.reload(); await onChanged(); }
    } finally { setBusy(false); }
  }
  const reasons = Object.entries(reasonLabels).filter(([key]) => application?.current_stage === 'OFFER' ? key.startsWith('OFFER_') : !key.startsWith('OFFER_'));
  return <Modal title="Chi tiết hồ sơ ứng tuyển" onClose={onClose} busy={busy}>
    <ErrorMessage error={error} />
    <Resource resource={resource}>{application && <div className="space-y-5"><div><h3 className="font-semibold text-slate-900">{application.candidate.profile.full_name || 'Chưa cung cấp họ tên'}</h3>
      <p className="break-all text-sm text-slate-600">{application.email}</p><p className="my-2 text-sm">{application.candidate.profile.role} · {application.candidate.profile.years_experience} năm kinh nghiệm</p><StageBadge stage={application.current_stage} /></div>
      <p className="text-sm text-slate-700">Kỹ năng: {application.candidate.skills.map(skill => skill.name).join(', ') || 'Chưa cung cấp'}</p>
      <section><h3 className="mb-2 font-semibold">CV văn bản đã nộp</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 font-sans text-sm">{application.submission?.resume_text || 'Hồ sơ lịch sử chưa có CV văn bản.'}</pre></section>
      {application.submission?.cover_letter && <section><h3 className="mb-2 font-semibold">Thư giới thiệu</h3><p className="whitespace-pre-wrap text-sm text-slate-700">{application.submission.cover_letter}</p></section>}
      <ApplicationTimeline application={application} />
      <p className="text-sm text-slate-500">Điểm phù hợp: Chưa tích hợp dịch vụ phân tích.</p>
      {application.current_stage === 'INTERVIEW' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{application.interview_status === 'SCHEDULING_REQUIRED' ? 'Cần lên lịch phỏng vấn. Liên hệ bộ phận phỏng vấn để tạo vòng đánh giá.' : 'Đã có biên bản phỏng vấn. Chỉ có thể gửi offer khi tất cả các vòng hoàn tất.'}</p>}
      {!!application.allowed_transitions.length && <form onSubmit={submit} className="space-y-4 border-t border-slate-200 pt-5"><fieldset disabled={busy} className="space-y-4">
        <Field label="Chuyển trạng thái" name="target-stage"><select id="target-stage" value={target} onChange={event => { setTarget(event.target.value); setReason(''); }} required className="w-full rounded-lg border border-slate-300 p-3">
          <option value="">Chọn thao tác</option>{application.allowed_transitions.map(stage => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></Field>
        {target === 'REJECTED' && <Field label="Lý do từ chối *" name="rejection-reason"><select id="rejection-reason" value={reason} onChange={event => setReason(event.target.value)} required className="w-full rounded-lg border p-3">
          <option value="">Chọn lý do</option>{reasons.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>}
        {target === 'HIRED' && <div className="space-y-3 rounded-lg bg-slate-50 p-4">
          <Field label="Thời điểm ứng viên chấp nhận (giờ Việt Nam, UTC+7) *" name="accepted-at"><input id="accepted-at" type="datetime-local" value={acceptedAt} onChange={event => setAcceptedAt(event.target.value)} required className="w-full rounded-lg border p-3" /></Field>
          <Field label="Hình thức xác nhận" name="accept-method"><select id="accept-method" value={method} onChange={event => setMethod(event.target.value)} className="w-full rounded-lg border p-3"><option value="EMAIL">Email xác nhận</option><option value="ELECTRONIC_SIGNATURE">Chữ ký điện tử</option><option value="WRITTEN_CONFIRMATION">Xác nhận bằng văn bản</option></select></Field>
          <Field label="Tham chiếu bằng chứng (nếu có)" name="accept-reference"><input id="accept-reference" value={reference} onChange={event => setReference(event.target.value)} maxLength={500} className="w-full rounded-lg border p-3" /></Field>
          <label className="flex gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi đã kiểm tra bằng chứng ứng viên chấp nhận offer.</label>
        </div>}
        <Field label="Ghi chú nội bộ (không hiển thị cho ứng viên)" name="transition-note"><textarea id="transition-note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg border p-3" /></Field>
        <Button type="submit" disabled={busy || !target || (target === 'REJECTED' && !reason) || (target === 'HIRED' && (!acceptedAt || !confirmed))}>{busy ? 'Đang cập nhật…' : 'Xác nhận chuyển trạng thái'}</Button>
      </fieldset></form>}
    </div>}</Resource>
  </Modal>;
}
