export const stageLabels = { APPLIED: 'Đã nộp', SCREENING: 'Sàng lọc', INTERVIEW: 'Phỏng vấn', OFFER: 'Đề nghị nhận việc',
  HIRED: 'Đã tuyển', REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút đơn' };
export const jobStatusLabels = { DRAFT: 'Bản nháp', OPEN: 'Đang tuyển', CLOSED: 'Đã đóng' };
export const seniorityLabels = { JUNIOR: 'Mới bắt đầu', MID: 'Có kinh nghiệm', SENIOR: 'Cao cấp' };
export const degreeLabels = { HIGH_SCHOOL: 'Trung học', BACHELOR: 'Cử nhân', MASTER: 'Thạc sĩ', DOCTORATE: 'Tiến sĩ' };
export const reasonLabels = { SCREENING_REJECTED: 'Không qua sàng lọc', INTERVIEW_FAILED: 'Không đạt phỏng vấn',
  OFFER_DECLINED: 'Ứng viên từ chối offer', OFFER_EXPIRED: 'Offer hết hạn', POSITION_FILLED: 'Vị trí đã đủ người',
  QUALIFICATIONS_MISMATCH: 'Chuyên môn chưa phù hợp', OTHER: 'Lý do khác' };
export const mainStages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'];
export const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Chưa có';
export const canWithdraw = stage => ['APPLIED', 'SCREENING', 'INTERVIEW'].includes(stage);
export const jobUrl = id => `/jobs/${encodeURIComponent(id)}`;
export const recruiterJobUrl = (id, action) => `/recruiter/jobs/${encodeURIComponent(id)}/${action}`;
export function normalizeRole(role) {
  return ({ 'job-seeker': 'CANDIDATE', recruiter: 'RECRUITER', admin: 'ADMIN' })[role] || role;
}
export function deadlineIsOpen(job, now = Date.now()) {
  return job?.status === 'OPEN' && Number.isFinite(Date.parse(job.deadline)) && now <= Date.parse(job.deadline);
}
