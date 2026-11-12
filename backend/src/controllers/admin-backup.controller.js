import { pipeline } from 'node:stream/promises';
import { ApiError } from '../middleware/job-application.middleware.js';
import { backupError } from '../models/admin-backup.schema.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export function createBackupController(serviceProvider) {
  const owner = req => req.auth.sub;
  const handle = operation => async (req, res, next) => {
    try { await operation(req, res); }
    catch (error) {
      if (res.headersSent) {
        if (res.destroyed) return;
        return next(backupError('BACKUP_CONFIGURATION_ERROR'));
      }
      const safe = error instanceof ApiError ? error : backupError('BACKUP_CONFIGURATION_ERROR');
      res.status(safe.status).json(errorResponse(safe.code, safe.message, null));
    }
  };
  return {
    sources: handle(async (_req, res) => res.json(successResponse(await serviceProvider().sources()))),
    create: handle(async (req, res) => res.status(202).json(successResponse(await serviceProvider().create(owner(req), req.validatedBody.source_id)))),
    status: handle(async (req, res) => res.json(successResponse(await serviceProvider().status(owner(req), req.backupParams.id)))),
    download: handle(async (req, res) => {
      const download = await serviceProvider().download(owner(req), req.backupParams.id);
      try {
        res.set({ 'Content-Type': 'application/gzip', 'Content-Length': String(download.size),
          'Content-Disposition': `attachment; filename="${download.filename}"`, 'X-Content-Type-Options': 'nosniff' });
        await pipeline(download.stream, res);
      } finally { download.stream.destroy(); await download.handle.close().catch(() => {}); }
    }),
  };
}
