import { z } from 'zod';
import { ApiError } from '../middleware/job-application.middleware.js';

const MiB = 1024 * 1024;
export const BACKUP_LIMITS = Object.freeze({ compressed: 128 * MiB, uncompressed: 512 * MiB,
  record: 32 * MiB, documents: 100000, attachmentBytes: 200 * MiB, attachment: 10 * MiB,
  jobs: 32, spool: 1024 * MiB, page: 500, ttl: 86400000, retention: 7 * 86400000,
  timeout: 600000, cleanupInterval: 900000 });
export const backupRequestSchema = z.object({ source_id: z.enum(['business', 'identity', 'audit']) }).strict();
export const backupParamsSchema = z.object({ id: z.uuid() }).strict();
export const backupError = (code, status = 503) => new ApiError(status, code, {
  BACKUP_CONFIGURATION_ERROR: 'Tính năng sao lưu chưa được cấu hình an toàn.',
  DATABASE_UNAVAILABLE: 'Không đọc được nguồn dữ liệu sao lưu.',
  SOURCE_CHANGED: 'Dữ liệu đã thay đổi khi sao lưu. Vui lòng thử lại lúc ít cập nhật.',
  SOURCE_CONFLICTS: 'Nguồn có xung đột phiên bản; cần xử lý trước khi sao lưu.',
  BACKUP_LIMIT_EXCEEDED: 'Vượt giới hạn tài nguyên sao lưu.',
  JOB_BUSY: 'Đang có một tác vụ sao lưu khác.', JOB_NOT_FOUND: 'Không tìm thấy tác vụ.',
  ARTIFACT_EXPIRED: 'Bản sao lưu đã hết hạn.', ARTIFACT_NOT_READY: 'Bản sao lưu chưa sẵn sàng.',
  JOB_INTERRUPTED: 'Tác vụ bị gián đoạn do máy chủ khởi động lại.',
  JOB_TIMEOUT: 'Tác vụ sao lưu vượt thời gian cho phép.',
  INVALID_BACKUP: 'Dữ liệu nguồn không phù hợp định dạng sao lưu.',
  UNSUPPORTED_INDEX: 'Nguồn chứa loại chỉ mục chưa được hỗ trợ.',
  INVALID_TARGET: 'Tên database phục hồi không hợp lệ hoặc thuộc nguồn được bảo vệ.',
  TARGET_EXISTS: 'Database đích đã tồn tại; không được ghi đè.',
  VALIDATION_USED: 'Bản kiểm tra đã được sử dụng hoặc chưa sẵn sàng.',
  CHECKSUM_MISMATCH: 'Nội dung hoặc số liệu bản sao lưu không khớp.',
  SIGNATURE_INVALID: 'Chữ ký hoặc khóa ký bản sao lưu không hợp lệ.',
  UNSUPPORTED_BACKUP_FORMAT: 'Chỉ chấp nhận file gzip RHBR qua application/octet-stream.',
  RESTORE_SECURITY_ERROR: 'Không bảo đảm database đích private; đã dừng phục hồi.',
  RESTORE_VERIFICATION_FAILED: 'Dữ liệu phục hồi không khớp hoặc đã thay đổi khi đối chiếu.',
  RESTORE_WRITE_FAILED: 'Một phần dữ liệu chưa được ghi thành công; database đích chưa hoàn chỉnh.',
}[code] || 'Không hoàn tất được tác vụ sao lưu.');

export function backupConfiguration(env = process.env) {
  const key = env.BACKUP_SIGNING_KEY;
  const keyId = env.BACKUP_SIGNING_KEY_ID;
  if (typeof key !== 'string' || Buffer.byteLength(key) < 32 || /^(replace_with|change_me|your[-_])/i.test(key)
    || !/^[a-zA-Z0-9_-]{1,64}$/.test(keyId || '')
    || [env.JWT_ACCESS_SECRET, env.COUCHDB_PASSWORD, env.AUDIT_COUCHDB_PASSWORD].some(secret => secret && key === secret)) {
    throw backupError('BACKUP_CONFIGURATION_ERROR');
  }
  return { key, keyId };
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
