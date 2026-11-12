import { ApiError } from '../middleware/job-application.middleware.js';
import { backupError } from '../models/admin-backup.schema.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export function createRestoreController(serviceProvider) {
  const handle = operation => async (req, res) => {
    try { await operation(req, res); }
    catch (error) {
      if (res.destroyed) return;
      const safe = error instanceof ApiError ? error : backupError('BACKUP_CONFIGURATION_ERROR');
      if (req.method === 'POST' && req.path.endsWith('/validate')) res.set('Connection', 'close');
      res.status(safe.status).json(errorResponse(safe.code, safe.message, null));
    }
  };
  return {
    upload: handle(async (req, res) => res.status(202).json(successResponse(await serviceProvider().validateUpload(req.auth.sub, req)))),
    create: handle(async (req, res) => res.status(202).json(successResponse(await serviceProvider().createRestore(req.auth.sub, req.validatedBody)))),
    status: handle(async (req, res) => res.json(successResponse(await serviceProvider().restoreStatus(req.auth.sub, req.backupParams.id)))),
  };
}
