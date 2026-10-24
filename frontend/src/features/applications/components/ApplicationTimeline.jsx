import { formatDate, mainStages, stageLabels } from '../applicationPresentation';
import { StageBadge } from './ApplicationUI';

export default function ApplicationTimeline({ application }) {
  const visited = new Set(application.stage_history.map(event => event.to_stage));
  return <div className="space-y-4"><ol aria-label="Các bước tuyển dụng" className="flex flex-wrap gap-2">
    {mainStages.map(stage => <li key={stage} className={`rounded-lg border px-3 py-2 text-xs ${visited.has(stage) ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500'}`}
      aria-current={application.current_stage === stage ? 'step' : undefined}>{stageLabels[stage]}</li>)}
  </ol>{!mainStages.includes(application.current_stage) && <div><span className="mr-2 text-sm text-gray-600">Kết thúc hồ sơ:</span><StageBadge stage={application.current_stage} /></div>}
    <details><summary className="cursor-pointer text-sm font-semibold text-blue-700">Lịch sử xử lý ({application.stage_history.length})</summary>
      <ol className="mt-3 space-y-3 border-l-2 border-gray-200 pl-4">{application.stage_history.map((event, index) => <li key={`${event.timestamp}-${index}`}>
        <p className="text-sm font-medium text-gray-800">{stageLabels[event.to_stage]}</p><time dateTime={event.timestamp} className="text-xs text-gray-500">{formatDate(event.timestamp)} · {event.actor_role === 'CANDIDATE' ? 'Ứng viên' : event.actor_role === 'RECRUITER' ? 'Nhà tuyển dụng' : 'Hệ thống'}</time>
        {event.note && <p className="whitespace-pre-wrap text-sm text-gray-600">{event.note}</p>}
      </li>)}</ol>
    </details></div>;
}
