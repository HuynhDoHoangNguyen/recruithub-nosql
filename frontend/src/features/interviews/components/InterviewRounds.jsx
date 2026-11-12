import { useCallback, useState } from 'react';
import { interviewApi } from '../../../api/jobApplicationApi';
import { Button, ErrorMessage } from '../../applications/components/ApplicationUI';
import { useApiResource } from '../../applications/useApiResource';
import InterviewFeedbackForm from './InterviewFeedbackForm';
import { formatInterviewTime, interviewTypeLabels } from './interviewPresentation';

export default function InterviewRounds({ applicationId, applicationAttempt, items, canEdit, onSaved }) {
  const resource = useApiResource(useCallback(() => interviewApi.listFeedback(applicationId), [applicationId]));
  const [activeId, setActiveId] = useState(null);
  const [notice, setNotice] = useState('');
  const matchingAttempt = resource.data?.application_id === applicationId &&
    resource.data.application_attempt === applicationAttempt;
  const feedbackById = new Map(matchingAttempt ? resource.data.items.map(item => [item._id, item]) : []);
  const activeFormId = canEdit && feedbackById.get(activeId)?.status === 'PENDING' ? activeId : null;

  async function saved() {
    setActiveId(null);
    await Promise.all([resource.reload(), onSaved()]);
  }

  async function conflict(id, signal) {
    const current = await resource.reload();
    const valid = current?.application_id === applicationId && current.application_attempt === applicationAttempt;
    if (!signal.aborted && valid && current.items.find(item => item._id === id)?.status === 'COMPLETED') {
      setActiveId(null);
      setNotice('Vòng này đã được ghi nhận đánh giá. Kết quả đã lưu được hiển thị bên dưới.');
    }
  }

  return <>
    {resource.loading && <p role="status" className="text-sm text-slate-600">Đang tải đánh giá…</p>}
    <ErrorMessage error={resource.error} retry={resource.reload} />
    {resource.data && !matchingAttempt && <ErrorMessage error={new Error('Đánh giá thuộc lượt ứng tuyển khác. Hãy mở lại hồ sơ.')} />}
    {notice && <p role="status" className="text-sm text-amber-800">{notice}</p>}
    <ol className="space-y-3 text-sm">
      {items.map(item => {
        const feedback = feedbackById.get(item._id);
        const editing = activeFormId === item._id;
        return <li key={item._id} className="space-y-2">
          <p>Vòng {item.round} · {interviewTypeLabels[item.interview_type]} · {formatInterviewTime(item.scheduled_at)}</p>
          {feedback?.status === 'COMPLETED' && <div className="space-y-1 rounded-lg bg-slate-50 p-3">
            <p className="font-semibold">{feedback.result === 'PASSED' ? 'Đạt' : 'Không đạt'}{feedback.score != null && ` · ${feedback.score}/100`}</p>
            <p className="text-slate-600">Hoàn tất {formatInterviewTime(feedback.completed_at)}</p>
            {feedback.feedback && <p className="whitespace-pre-wrap break-words">{feedback.feedback}</p>}
          </div>}
          {feedback?.status === 'PENDING' && <p className="text-slate-600">Chờ đánh giá</p>}
          {canEdit && !activeFormId && !resource.loading && !resource.error && feedback?.status === 'PENDING' &&
            <Button type="button" secondary onClick={() => { setNotice(''); setActiveId(item._id); }}>
              Ghi nhận đánh giá vòng {item.round}
            </Button>}
          {editing && <InterviewFeedbackForm
            interviewId={item._id} round={item.round} blocked={resource.loading || Boolean(resource.error)}
            onSaved={saved} onConflict={signal => conflict(item._id, signal)}
            onClose={() => { setActiveId(null); void resource.reload(); }}
          />}
        </li>;
      })}
    </ol>
  </>;
}
