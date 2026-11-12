import { Router } from 'express';
import { interviewController } from '../controllers/interview.controller.js';
import { requireRoles, validate } from '../middleware/job-application.middleware.js';
import {
  createInterviewRequestSchema,
  interviewFeedbackParamsSchema,
  interviewFeedbackRequestSchema,
  listInterviewsQuerySchema,
} from '../schemas/interview-request.schema.js';

export function createInterviewRoutes({ authenticate, interviews }) {
  const router = Router();
  const controller = interviewController(interviews);
  router.use(authenticate, requireRoles('RECRUITER'));
  router.post('/', validate(createInterviewRequestSchema), controller.create);
  router.get('/', validate(listInterviewsQuerySchema, 'query'), controller.list);
  router.get('/feedback', validate(listInterviewsQuerySchema, 'query'), controller.listFeedback);
  router.put('/:id/feedback', validate(interviewFeedbackParamsSchema, 'params'),
    validate(interviewFeedbackRequestSchema), controller.complete);
  return router;
}
