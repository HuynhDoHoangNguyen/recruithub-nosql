import { Router } from 'express';
import { applicationController } from '../controllers/application.controller.js';
import { requireRoles, validate } from '../middleware/job-application.middleware.js';
import { applicationListQuerySchema, applicationParamsSchema, applyRequestSchema, stageRequestSchema, withdrawRequestSchema } from '../schemas/job-application-request.schema.js';

export function createApplicationRoutes({ authenticate, applications }) {
  const router = Router();
  const controller = applicationController(applications);
  router.use(authenticate);
  router.post('/', requireRoles('CANDIDATE'), validate(applyRequestSchema), controller.create);
  router.get('/context', requireRoles('CANDIDATE'), controller.context);
  router.get('/my-applications', requireRoles('CANDIDATE'), validate(applicationListQuerySchema, 'query'), controller.mine);
  router.get('/:id', requireRoles('CANDIDATE', 'RECRUITER'), validate(applicationParamsSchema, 'params'), controller.detail);
  router.patch('/:id/withdraw', requireRoles('CANDIDATE'), validate(applicationParamsSchema, 'params'), validate(withdrawRequestSchema), controller.withdraw);
  router.patch('/:id/stage', requireRoles('RECRUITER'), validate(applicationParamsSchema, 'params'), validate(stageRequestSchema), controller.stage);
  return router;
}
