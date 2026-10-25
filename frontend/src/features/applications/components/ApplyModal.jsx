import { useState } from 'react';
import { applicationApi } from '../../../api/jobApplicationApi';
import { useApiResource } from '../useApiResource';
import { Button, ErrorMessage, Field, Modal, Resource } from './ApplicationUI';
import FileUpload from '../../../components/uploads/FileUpload';

export default function ApplyModal({ job, previousApplication, onClose, onSubmitted, onRefresh }) {
  const context = useApiResource(applicationApi.context);
  const [requestId] = useState(() => crypto.randomUUID());
  const [resume, setResume] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cover, setCover] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [fieldError, setFieldError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError(null);
    if (uploading) return;
    if (!resume.trim() && !resumeFile) { setFieldError('Đính kèm file CV hoặc nhập CV văn bản.'); return; }
    setFieldError(''); setBusy(true);
    try {
      const application = await applicationApi.apply({ job_id: job._id, request_id: requestId, ...(previousApplication ? { expected_rev: previousApplication._rev } : {}), submission: {
        ...(resume.trim() ? { resume_text: resume.trim() } : {}), ...(resumeFile ? { resume_file_id: resumeFile.asset_id } : {}), ...(cover.trim() ? { cover_letter: cover.trim() } : {}),
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
  return <Modal title={`Nộp hồ sơ — ${job.title}`} onClose={onClose} busy={busy || uploading}><Resource resource={context}>
    <form onSubmit={submit} className="space-y-5"><div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
      <p className="font-semibold">{candidate?.profile.full_name || 'Chưa cung cấp họ tên'}</p><p>{context.data?.email}</p>
      <p className="mt-2">{candidate?.profile.role} · {candidate?.profile.years_experience} năm kinh nghiệm</p>
      <p className="mt-1">Kỹ năng: {candidate?.skills.map(item => item.name).join(', ') || 'Chưa cung cấp'}</p></div>
      <ErrorMessage error={error} />
      <div className="rounded-2xl border border-blue-100 p-4 sm:p-5 space-y-4"><FileUpload kind="resume" label="Tải CV từ máy tính" value={resumeFile} onUploaded={file => { setResumeFile(file); setFieldError(''); }} onRemove={() => setResumeFile(null)} disabled={busy} onBusyChange={setUploading} />
        {candidate?.resume_file && <button type="button" disabled={busy || uploading} onClick={() => { setResumeFile(candidate.resume_file); setFieldError(''); }} className="text-xs font-bold text-blue-600 rounded-lg bg-blue-50 px-3 py-2">Dùng CV từ hồ sơ: {candidate.resume_file.file_name}</button>}
        <p className="text-xs leading-5 text-slate-500">Đính kèm file CV hoặc nhập CV văn bản bên dưới. File của lần ứng tuyển này được giữ riêng khi bạn thay CV trong hồ sơ.</p></div>
      <Field label="CV văn bản (khi không đính kèm file)" name="resume_text" error={fieldError}><textarea id="resume_text" value={resume} onChange={event => setResume(event.target.value)}
        required={!resumeFile} maxLength={50000} rows={6} disabled={busy || uploading} aria-invalid={!!fieldError} aria-describedby={fieldError ? 'resume_text-error' : undefined} className="input-field mt-2 resize-y" /></Field>
      <Field label="Thư giới thiệu (không bắt buộc)" name="cover_letter"><textarea id="cover_letter" value={cover} onChange={event => setCover(event.target.value)}
        maxLength={10000} rows={4} disabled={busy} className="w-full rounded-lg border border-gray-300 p-3" /></Field>
      <div className="sticky -bottom-8 border-t border-slate-100 bg-white/95 py-4 backdrop-blur space-y-3"><p className="text-xs text-gray-500">CV được gửi cho nhà tuyển dụng của vị trí này. Nếu đã rút đơn, bạn có thể nộp một lần mới khi tin còn mở và còn hạn. CV và lịch sử từng lần được giữ riêng.</p>
      <Button type="submit" disabled={busy || uploading || duplicate}>{busy ? 'Đang nộp…' : 'Xác nhận nộp hồ sơ'}</Button></div>
    </form>
  </Resource></Modal>;
}
