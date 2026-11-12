import { useEffect, useRef, useState } from 'react';
import { interviewApi } from '../../../api/jobApplicationApi';
import { Button, ErrorMessage, Field } from '../../applications/components/ApplicationUI';

const feedbackLimit = 2000;

export default function InterviewFeedbackForm({ interviewId, round, blocked, onSaved, onConflict, onClose }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackError, setFeedbackError] = useState(null);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || blocked) return;
    const evidence = feedback.trim();
    const invalidFeedback = !evidence || feedback.length > feedbackLimit;
    setFeedbackError(invalidFeedback ? 'Nhập bằng chứng đánh giá từ 1 đến 2.000 ký tự.' : null);
    if (!rating || !result || invalidFeedback) return;

    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError(null);
    try {
      await interviewApi.complete(interviewId, { rating, feedback: evidence, result }, request.signal);
      if (!request.signal.aborted) await onSaved();
    } catch (failure) {
      if (request.signal.aborted) return;
      setError(failure);
      if (failure.status === 409) await onConflict(request.signal);
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return <form aria-label={`Đánh giá vòng ${round}`} onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 p-3">
    <ErrorMessage error={error} />
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <legend className="font-semibold">Đánh giá vòng {round}</legend>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="form-label">Điểm phỏng vấn</legend>
        {[1, 2, 3, 4, 5].map(value => <label key={value} className="inline-flex items-center gap-1">
          <input type="radio" name="interview-rating" required value={value} checked={rating === value} onChange={() => setRating(value)} />
          {value} sao
        </label>)}
      </fieldset>
      <Field label="Bằng chứng đánh giá" name="interview-feedback" error={feedbackError}>
        <textarea id="interview-feedback" value={feedback} onChange={event => setFeedback(event.target.value)}
          required maxLength={feedbackLimit} rows={4} className="input-field min-w-0"
          aria-invalid={Boolean(feedbackError)} aria-describedby={feedbackError ? 'interview-feedback-error' : undefined} />
      </Field>
      <Field label="Kết quả phỏng vấn" name="interview-result">
        <select id="interview-result" required value={result} onChange={event => setResult(event.target.value)} className="input-field">
          <option value="">Chọn kết quả</option>
          <option value="PASSED">Đạt</option>
          <option value="FAILED">Không đạt</option>
        </select>
      </Field>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={busy || blocked}>{busy ? 'Đang lưu đánh giá…' : 'Lưu đánh giá'}</Button>
      <Button type="button" secondary onClick={onClose}>Đóng đánh giá</Button>
    </div>
  </form>;
}
