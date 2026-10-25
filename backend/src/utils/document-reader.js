import { Worker } from 'node:worker_threads';
import { ApiError } from '../middleware/job-application.middleware.js';

// Bound parsing time/memory and keep malformed documents off the HTTP thread.
export function readDocument(bytes, action) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./document-worker.js', import.meta.url), {
      workerData: { bytes, action }, resourceLimits: { maxOldGenerationSizeMb: 128 }, stdout: true, stderr: true,
    });
    const failure = () => new ApiError(400, action === 'validate-pdf' ? 'INVALID_FILE' : 'PREVIEW_UNAVAILABLE', action === 'validate-pdf'
      ? 'Không đọc được cấu trúc PDF. Hãy mở file và xuất lại dưới định dạng PDF rồi thử lại.'
      : 'Không thể tạo bản xem nội dung Word. Bạn có thể tải file gốc để kiểm tra.');
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true; clearTimeout(timer); void worker.terminate();
      if (result?.ok) resolve(result); else reject(failure());
    };
    const timer = setTimeout(() => finish(), 10000);
    worker.once('message', finish);
    worker.once('error', () => finish());
    worker.once('exit', () => finish());
  });
}
