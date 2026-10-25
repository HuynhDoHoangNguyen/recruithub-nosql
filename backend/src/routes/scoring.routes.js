import { Router } from 'express';
import { scoringController } from '../controllers/scoring.controller.js';
import { requireRoles, validate } from '../middleware/job-application.middleware.js';
import { computeScoringRequestSchema } from '../schemas/scoring-request.schema.js';

export function createScoringRoutes({ authenticate, scoring }) {
  const router = Router();
  const controller = scoringController(scoring);

  router.use(authenticate);
  router.post(
    '/compute',
    requireRoles('RECRUITER'),
    validate(computeScoringRequestSchema),
    controller.compute
  );

  return router;
}
