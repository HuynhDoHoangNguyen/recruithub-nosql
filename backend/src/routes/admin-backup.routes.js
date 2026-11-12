import { Router } from 'express';
import { requireRole } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-body.js';
import { backupRequestSchema, backupParamsSchema } from '../models/admin-backup.schema.js';
import { errorResponse } from '../utils/api-response.js';
import { createBackupController } from '../controllers/admin-backup.controller.js';
import { AdminBackupService } from '../services/admin-backup.service.js';
import { createRestoreController } from '../controllers/admin-restore.controller.js';
import { createAdminRestoreRouter } from './admin-restore.routes.js';

let configuredService;
const defaultService = () => (configuredService ??= new AdminBackupService());

export function createAdminBackupRouter({ authenticate, serviceProvider = defaultService }) {
  const router = Router();
  const controller = createBackupController(serviceProvider);
  const restores = createRestoreController(serviceProvider);
  router.use('/backups', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, authenticate, requireRole('ADMIN'));
  const params = (req, res, next) => {
    const result = backupParamsSchema.safeParse(req.params);
    if (!result.success) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Mã tác vụ không hợp lệ.', null));
    req.backupParams = result.data; next();
  };
  router.get('/backups/sources', controller.sources);
  router.post('/backups/validate', (req, res, next) => {
    if (req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/octet-stream'
      || req.get('content-encoding')) return res.status(415).json(errorResponse('UNSUPPORTED_BACKUP_FORMAT', 'Chỉ chấp nhận gzip qua application/octet-stream.', null));
    next();
  }, restores.upload);
  router.post('/backups', validateBody(backupRequestSchema), controller.create);
  router.get('/backups/:id/download', params, controller.download);
  router.get('/backups/:id', params, controller.status);
  router.use(createAdminRestoreRouter({ authenticate, serviceProvider }));
  return router;
}
