import { useState } from 'react';
import { applicationApi } from '../../../api/jobApplicationApi';
import { useApiResource } from '../useApiResource';
import { Button, ErrorMessage, Field, Modal, Resource } from './ApplicationUI';

export default function ApplyModal({ job, onClose, onSubmitted, onRefresh }) {
  const context = useApiResource(applicationApi.context);
  const [resume, setResume] = useState('');
  const [cover, setCover] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [fieldError, setFieldError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError(null);
    if (!resume.trim()) { setFieldError('Vui lòng nhập CV văn bản.'); return; }
    setFieldError(''); setBusy(true);
    try {
      const application = await applicationApi.apply({ job_id: job._id, submission: {
        resume_text: resume.trim(), ...(cover.trim() ? { cover_letter: cover.trim() } : {}),
      } });
      onSubmitted(application);
    } catch (failure) {
      setError(failure);
      const issue = failure.details?.find(item => item.field === 'submission.resume_text');
      if (issue) setFieldError(issue.message);
      if (failure.status === 409) { setDuplicate(failure.code === 'DUPLICATE_APPLICATION'); await onRefresh(); }
    } finally { setBusy(false); }
  }
  const candidate = context.data?.candidate;
  return <Modal title={`Nộp hồ sơ — ${job.title}`} onClose={onClose} busy={busy}><Resource resource={context}>
    <form onSubmit={submit} className="space-y-5"><div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
      <p className="font-semibold">{candidate?.profile.full_name || 'Chưa cung cấp họ tên'}</p><p>{context.data?.email}</p>
      <p className="mt-2">{candidate?.profile.role} · {candidate?.profile.years_experience} năm kinh nghiệm</p>
      <p className="mt-1">Kỹ năng: {candidate?.skills.map(item => item.name).join(', ') || 'Chưa cung cấp'}</p></div>
      <ErrorMessage error={error} />
      <Field label="CV văn bản *" name="resume_text" error={fieldError}><textarea id="resume_text" value={resume} onChange={event => setResume(event.target.value)}
        required maxLength={50000} rows={9} disabled={busy} aria-invalid={!!fieldError} aria-describedby={fieldError ? 'resume_text-error' : undefined} className="w-full rounded-lg border border-gray-300 p-3" /></Field>
      <Field label="Thư giới thiệu (không bắt buộc)" name="cover_letter"><textarea id="cover_letter" value={cover} onChange={event => setCover(event.target.value)}
        maxLength={10000} rows={4} disabled={busy} className="w-full rounded-lg border border-gray-300 p-3" /></Field>
      <p className="text-xs text-gray-500">CV được gửi cho nhà tuyển dụng của vị trí này. Bạn chỉ có thể nộp một lần cho mỗi vị trí.</p>
      <Button type="submit" disabled={busy || duplicate}>{busy ? 'Đang nộp…' : 'Xác nhận nộp hồ sơ'}</Button>
    </form>
  </Resource></Modal>;
}
