import api from '../services/api';

const root = '/v1/admin';
const unwrap = response => response.data.data;
const transferTimeout = 660000;

export const adminBackupApi = {
  sources: signal => api.get(`${root}/backups/sources`, { signal }).then(unwrap),
  create: (source_id, signal) => api.post(`${root}/backups`, { source_id }, { signal }).then(unwrap),
  status: (id, type, signal) => api.get(`${root}/${type === 'RESTORE' ? 'restores' : 'backups'}/${encodeURIComponent(id)}`, { signal }).then(unwrap),
  validate: (file, onUploadProgress, signal) => api.post(`${root}/backups/validate`, file, {
    headers: { 'Content-Type': 'application/octet-stream' }, timeout: transferTimeout, onUploadProgress, signal,
  }).then(unwrap),
  restore: (validation_id, target_database, signal) => api.post(`${root}/restores`, {
    validation_id, target_database, confirm: true,
  }, { signal }).then(unwrap),
  download: (id, signal) => api.get(`${root}/backups/${encodeURIComponent(id)}/download`, {
    responseType: 'blob', timeout: transferTimeout, signal,
  }),
};

export async function backupApiError(error) {
  let data = error?.response?.data;
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()); } catch { data = null; }
  }
  const status = error?.response?.status;
  const code = data?.error?.code || data?.code;
  const messages = {
    BACKUP_CONFIGURATION_ERROR: 'Máy chủ chưa cấu hình sao lưu an toàn. Liên hệ người vận hành.',
    JOB_BUSY: 'Máy chủ đang có tác vụ khác. Chờ hoàn tất rồi thử lại.',
    JOB_NOT_FOUND: 'Không tìm thấy tác vụ hoặc tài khoản hiện tại không có quyền xem.',
    ARTIFACT_EXPIRED: 'File đã hết hạn. Hãy tạo bản sao lưu hoặc tải file lên kiểm tra lại.',
    BACKUP_LIMIT_EXCEEDED: 'Vượt giới hạn dung lượng hoặc tài nguyên của máy chủ.',
    INVALID_BACKUP: 'File không đúng định dạng RHBR v1 hoặc nội dung không hợp lệ.',
    SIGNATURE_INVALID: 'Chữ ký file không hợp lệ hoặc khóa ký không khớp.',
    CHECKSUM_MISMATCH: 'Nội dung file không khớp mã kiểm tra toàn vẹn.',
    VALIDATION_USED: 'Bản kiểm tra đã được dùng. Hãy tải file lên kiểm tra lại.',
    TARGET_EXISTS: 'Database đích đã tồn tại. Hãy dùng một tên mới.',
    INVALID_TARGET: 'Tên database đích không hợp lệ hoặc thuộc nguồn được bảo vệ.',
  };
  return messages[code] || (status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    : status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
      : status ? 'Không hoàn tất được yêu cầu. Kiểm tra trạng thái tác vụ trước khi thao tác tiếp.'
        : 'Mất kết nối hoặc hết thời gian chờ API. Yêu cầu tạo tác vụ có thể đã đến máy chủ; không tự động gửi lại.');
}

export function saveBackupDownload(response, id) {
  const disposition = response.headers?.['content-disposition'] || '';
  const candidate = /filename="([^"]+)"/i.exec(disposition)?.[1];
  const filename = candidate && /^[a-zA-Z0-9._-]+\.rhbr\.gz$/.test(candidate)
    ? candidate : `recruithub-backup-${id}.rhbr.gz`;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  try {
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click();
  } finally {
    anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
