export const isRunning = job => ['QUEUED', 'RUNNING'].includes(job.status);
export const isExpired = (job, now = Date.now()) => job.status === 'EXPIRED' || (!isRunning(job) && Date.parse(job.expires_at) <= now);
export const validTarget = value => /^recruithub_restore_[a-z0-9_]{1,64}$/.test(value);
export const jobNames = { BACKUP: 'Sao lưu', VALIDATE: 'Kiểm tra file', RESTORE: 'Khôi phục' };
export const statusNames = { QUEUED: 'Đang chờ', RUNNING: 'Đang thực hiện', SUCCEEDED: 'Hoàn tất', FAILED: 'Thất bại', EXPIRED: 'Đã hết hạn' };
export const phaseNames = { EXPORTING: 'Đang xuất dữ liệu', UPLOADING: 'Đang nhận file', VALIDATING: 'Đang kiểm tra file', CREATING: 'Đang tạo database riêng tư', RESTORING: 'Đang ghi dữ liệu', VERIFYING: 'Đang đối chiếu dữ liệu' };
export const formatBytes = bytes => Number.isFinite(bytes) ? `${(bytes / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB` : '—';
export const formatTime = value => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
export const sourceReason = reason => reason === 'DUPLICATE_SOURCE' ? 'Trùng nguồn đã có trong danh sách' : 'Nguồn chưa được cấu hình';
export const sessionKey = userId => `recruithub:backup:v1:${userId}`;
export function readTrackedJobs(userId) {
  try {
    const items = JSON.parse(sessionStorage.getItem(sessionKey(userId)) || '[]');
    return Array.isArray(items) ? items.filter(item => /^[a-f0-9-]{36}$/i.test(item.id) && Object.hasOwn(jobNames, item.type)).slice(0, 32)
      .map(item => ({ id: item.id, type: item.type, status: 'QUEUED' })) : [];
  } catch { return []; }
}
