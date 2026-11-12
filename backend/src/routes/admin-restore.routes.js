import { Router } from 'express';
import { requireRole } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-body.js';
import { restoreRequestSchema } from '../models/admin-restore.schema.js';
import { backupParamsSchema } from '../models/admin-backup.schema.js';
import { errorResponse } from '../utils/api-response.js';
import { createRestoreController } from '../controllers/admin-restore.controller.js';

export function createAdminRestoreRouter({ authenticate, serviceProvider }) {
  const router = Router(); const controller = createRestoreController(serviceProvider);
  router.use('/restores', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, authenticate, requireRole('ADMIN'));
  router.post('/restores', validateBody(restoreRequestSchema), controller.create);
  router.get('/restores/:id', (req, res, next) => {
    const result = backupParamsSchema.safeParse(req.params);
    if (!result.success) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Mã tác vụ không hợp lệ.', null));
    req.backupParams = result.data; next();
  }, controller.status);
  return router;
}
