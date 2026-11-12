import { useCallback, useEffect, useRef, useState } from 'react';
import { interviewApi } from '../../../api/jobApplicationApi';
import { Button, ErrorMessage, Field, Resource } from '../../applications/components/ApplicationUI';
import { useApiResource } from '../../applications/useApiResource';
import InterviewRounds from './InterviewRounds';
import { interviewTypeLabels } from './interviewPresentation';

export default function InterviewSchedule({ applicationId, applicationAttempt = 1, canEdit = true, onScheduled }) {
  const resource = useApiResource(useCallback(() => interviewApi.list(applicationId), [applicationId]));
  const [round, setRound] = useState(null);
  const [type, setType] = useState('TECHNICAL');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  function openForm() {
    setError(null);
    setType('TECHNICAL');
    setTime('');
    setRound(resource.data.next_round);
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !time || round !== resource.data?.next_round) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError(null);
    try {
      await interviewApi.create({
        application_id: applicationId,
        round,
        interview_type: type,
        scheduled_at: `${time}:00+07:00`,
      }, request.signal);
      if (request.signal.aborted) return;
      setRound(null);
      await onScheduled();
    } catch (failure) {
      if (request.signal.aborted) return;
      setError(failure);
      if (failure.status === 409) {
        setRound(null);
        await resource.reload();
      }
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  const items = resource.data?.items ?? [];
  const matchingAttempt = resource.data?.application_id === applicationId && resource.data.application_attempt === applicationAttempt;
  return <section aria-labelledby="interview-schedule-title" className="space-y-3 rounded-xl border border-gray-200 p-4">
    <h3 id="interview-schedule-title" className="font-semibold">Lịch phỏng vấn</h3>
    <ErrorMessage error={error} />
    <Resource resource={resource}>
      {resource.data && !matchingAttempt && <ErrorMessage error={new Error('Lượt ứng tuyển đã thay đổi. Hãy mở lại hồ sơ.')} />}
      {matchingAttempt && (items.length ? <InterviewRounds
        applicationId={applicationId} applicationAttempt={applicationAttempt} items={items}
        canEdit={canEdit} onSaved={onScheduled}
      /> : <p className="text-sm text-amber-800">{canEdit ? 'Cần lên lịch phỏng vấn.' : 'Chưa có lịch phỏng vấn.'}</p>)}
      {canEdit && matchingAttempt && (round === null ? <Button type="button" onClick={openForm} disabled={busy}>Lên lịch phỏng vấn</Button> :
        <form onSubmit={submit} className="space-y-3">
          <fieldset disabled={busy} className="min-w-0 space-y-3">
            <legend className="font-medium">Lên lịch vòng {round}</legend>
            <Field label="Loại vòng phỏng vấn" name="interview-type">
              <select id="interview-type" className="input-field" value={type} onChange={event => setType(event.target.value)}>
                {Object.entries(interviewTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Ngày giờ phỏng vấn (giờ Việt Nam, UTC+7)" name="interview-time">
              <input id="interview-time" className="input-field min-w-0" type="datetime-local" required value={time} onChange={event => setTime(event.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu lịch'}</Button>
              <Button type="button" secondary onClick={() => { setRound(null); setError(null); }}>Đóng form</Button>
            </div>
          </fieldset>
        </form>)}
    </Resource>
  </section>;
}
