import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';

const RECOMMENDATION_LABELS = {
  HIGH: 'Phù hợp cao',
  MEDIUM: 'Phù hợp',
  LOW: 'Phù hợp thấp',
};

export default function MatchScoreBadge({
  id,
  status,
  fresh,
  totalScore,
  recommendation,
  onOpen,
  className = '',
  'aria-haspopup': ariaHasPopup,
  'aria-controls': ariaControls,
}) {
  const isClickable = typeof onOpen === 'function';
  const actionText = isClickable ? '. Nhấn để xem chi tiết phân tích.' : '';

  let Icon;
  let colorClasses;
  let ariaLabel;
  let content;

  // 1. NOT_ANALYZED hoặc status không xác định
  if (!status || status === 'NOT_ANALYZED' || (status !== 'COMPLETE' && status !== 'INCOMPLETE')) {
    Icon = Clock;
    colorClasses = 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100';
    ariaLabel = `Phân tích hồ sơ: Chưa phân tích${actionText}`;
    content = <span>Chưa phân tích</span>;
  }
  // 2. Có analysis nhưng fresh === false (cần tính lại, không hiển thị score stale)
  else if (fresh === false) {
    Icon = RefreshCw;
    colorClasses = 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100';
    ariaLabel = `Phân tích hồ sơ: Cần tính lại${actionText}`;
    content = <span>Cần tính lại</span>;
  }
  // 3. INCOMPLETE + fresh (thiếu dữ liệu, không hiển thị total score)
  else if (status === 'INCOMPLETE') {
    Icon = AlertTriangle;
    colorClasses = 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
    ariaLabel = `Phân tích hồ sơ: Thiếu dữ liệu${actionText}`;
    content = <span>Thiếu dữ liệu</span>;
  }
  // 4. COMPLETE + fresh
  else {
    const isValidScore = typeof totalScore === 'number' && Number.isFinite(totalScore);
    const recLabel = RECOMMENDATION_LABELS[recommendation] || '';

    if (recommendation === 'HIGH') {
      Icon = CheckCircle2;
      colorClasses = 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';
    } else if (recommendation === 'MEDIUM') {
      Icon = Check;
      colorClasses = 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100';
    } else if (recommendation === 'LOW') {
      Icon = AlertCircle;
      colorClasses = 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100';
    } else {
      Icon = CheckCircle2;
      colorClasses = 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100';
    }

    if (isValidScore) {
      const roundedScore = Math.round(totalScore);
      ariaLabel = `Điểm phù hợp: ${roundedScore}%${recLabel ? `, ${recLabel}` : ''}${actionText}`;
      content = (
        <>
          <span className="font-bold">{roundedScore}%</span>
          {recLabel && <span className="opacity-80">· {recLabel}</span>}
        </>
      );
    } else {
      const fallbackText = recLabel || 'Chưa có điểm';
      ariaLabel = `Điểm phù hợp: ${fallbackText}${actionText}`;
      content = <span>{fallbackText}</span>;
    }
  }

  const baseClasses =
    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';

  if (isClickable) {
    return (
      <button
        id={id}
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        aria-haspopup={ariaHasPopup || 'dialog'}
        aria-controls={ariaControls}
        className={`${baseClasses} ${colorClasses} cursor-pointer ${className}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {content}
      </button>
    );
  }

  return (
    <span
      id={id}
      aria-label={ariaLabel}
      className={`${baseClasses} ${colorClasses} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {content}
    </span>
  );
}
