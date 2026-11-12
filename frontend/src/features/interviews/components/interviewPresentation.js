export const interviewTypeLabels = {
  HR_SCREENING: 'Sàng lọc nhân sự',
  TECHNICAL: 'Kỹ thuật',
  SYSTEM_DESIGN: 'Thiết kế hệ thống',
  BEHAVIORAL: 'Hành vi',
  CULTURE_FIT: 'Phù hợp văn hóa',
  FINAL_ROUND: 'Vòng cuối',
};

const formatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatInterviewTime(value) {
  return `${formatter.format(new Date(value))} (UTC+7)`;
}
