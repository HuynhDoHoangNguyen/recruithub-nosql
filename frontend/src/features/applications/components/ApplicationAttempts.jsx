import { formatDate, stageLabels } from '../applicationPresentation';
import ApplicationTimeline from './ApplicationTimeline';
import ViewAssetButton from '../../../components/uploads/ViewAssetButton';

export default function ApplicationAttempts({ application }) {
  if (!application.previous_attempts?.length) return null;
  return <section className="space-y-3"><h3 className="font-bold text-slate-800">Lịch sử các lần ứng tuyển ({application.previous_attempts.length})</h3>
    {application.previous_attempts.map(attempt => <details key={attempt.attempt_number} className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Lần {attempt.attempt_number} · {stageLabels[attempt.current_stage]} · {formatDate(attempt.applied_at)}</summary>
      <div className="mt-4 space-y-3"><p className="text-xs text-slate-500">CV của lần nộp này</p><pre className="whitespace-pre-wrap break-words font-sans text-sm bg-slate-50 rounded-lg p-4 max-h-64 overflow-auto">{attempt.submission?.resume_text || (attempt.submission?.resume_file ? 'CV đã được đính kèm dưới dạng file.' : 'Hồ sơ lịch sử chưa có CV văn bản.')}</pre>
        <ViewAssetButton asset={attempt.submission?.resume_file} />
        {attempt.submission?.cover_letter && <p className="text-sm whitespace-pre-wrap">{attempt.submission.cover_letter}</p>}
        <ApplicationTimeline application={attempt} />
      </div>
    </details>)}
  </section>;
}
