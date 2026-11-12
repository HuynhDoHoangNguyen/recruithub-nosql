import { Worker } from 'node:worker_threads';
import { ApiError } from '../middleware/job-application.middleware.js';

// Bound parsing time/memory and keep malformed documents off the HTTP thread.
export function readDocument(bytes, action, WorkerClass = Worker) {
  return new Promise((resolve, reject) => {
    const invalidFile = () => new ApiError(400, action === 'validate-pdf' ? 'INVALID_FILE' : 'PREVIEW_UNAVAILABLE', action === 'validate-pdf'
      ? 'Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c c\u1ea5u tr\u00fac PDF. H\u00e3y m\u1edf file v\u00e0 xu\u1ea5t l\u1ea1i d\u01b0\u1edbi \u0111\u1ecbnh d\u1ea1ng PDF r\u1ed3i th\u1eed l\u1ea1i.'
      : 'Kh\u00f4ng th\u1ec3 t\u1ea1o b\u1ea3n xem n\u1ed9i dung Word. B\u1ea1n c\u00f3 th\u1ec3 t\u1ea3i file g\u1ed1c \u0111\u1ec3 ki\u1ec3m tra.');
    const unavailable = () => new ApiError(503, 'DOCUMENT_READER_UNAVAILABLE', 'D\u1ecbch v\u1ee5 ki\u1ec3m tra file t\u1ea1m th\u1eddi kh\u00f4ng kh\u1ea3 d\u1ee5ng. H\u00e3y kh\u1edfi \u0111\u1ed9ng l\u1ea1i backend v\u00e0 th\u1eed l\u1ea1i.');
    let worker;
    try {
      worker = new WorkerClass(new URL('./document-worker.js', import.meta.url), {
        workerData: { bytes, action }, resourceLimits: { maxOldGenerationSizeMb: 128 }, stdout: true, stderr: true,
      });
    } catch {
      reject(unavailable());
      return;
    }

    let settled = false;
    const finish = (result, workerFailed = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (result?.ok) resolve(result);
      else reject(workerFailed ? unavailable() : invalidFile());
    };
    const timer = setTimeout(() => finish(null, true), 10000);
    worker.once('message', finish);
    worker.once('error', () => finish(null, true));
    worker.once('exit', code => { if (code !== 0 || !settled) finish(null, true); });
  });
}
