import { Router } from 'express';
import { jobController } from '../controllers/job.controller.js';
import { applicationController } from '../controllers/application.controller.js';
import { requireRoles, validate } from '../middleware/job-application.middleware.js';
import { applicantQuerySchema, createJobRequestSchema, editJobRequestSchema, jobListQuerySchema, jobParamsSchema, publicJobQuerySchema, statusRequestSchema, deleteJobRequestSchema } from '../schemas/job-application-request.schema.js';
import { candidateRankingController } from '../controllers/candidate-ranking.controller.js';
import { candidateRankingQuerySchema } from '../schemas/candidate-ranking-request.schema.js';

export function createJobRoutes({ authenticate, jobs, publicJobs = jobs, applications, ranking }) {
  const router = Router();
  const controller = jobController(jobs);
  const publicController = jobController(publicJobs);
  const rankingCtrl = candidateRankingController(ranking);
  const recruiter = [authenticate, requireRoles('RECRUITER')];
  router.get('/recruiter/context', ...recruiter, controller.context);
  router.get('/recruiter/jobs', ...recruiter, validate(jobListQuerySchema, 'query'), controller.list);
  router.get('/recruiter/stats', ...recruiter, controller.stats);
  router.get('/recruiter/jobs/:id', ...recruiter, validate(jobParamsSchema, 'params'), controller.detail);
  router.get('/jobs', validate(publicJobQuerySchema, 'query'), publicController.publicList);
  router.get('/jobs/all', validate(publicJobQuerySchema, 'query'), publicController.publicList);
  router.post('/jobs', ...recruiter, validate(createJobRequestSchema), controller.create);
  router.get('/jobs/:id/applicants', ...recruiter, validate(jobParamsSchema, 'params'), validate(applicantQuerySchema, 'query'), applicationController(applications).applicants);
  router.get('/jobs/:id/applicant-ranking', ...recruiter, validate(jobParamsSchema, 'params'), validate(candidateRankingQuerySchema, 'query'), rankingCtrl.list);
  router.patch('/jobs/:id/status', ...recruiter, validate(jobParamsSchema, 'params'), validate(statusRequestSchema), controller.status);
  router.patch('/jobs/:id', ...recruiter, validate(jobParamsSchema, 'params'), validate(editJobRequestSchema), controller.edit);
  router.delete('/jobs/:id', ...recruiter, validate(jobParamsSchema, 'params'), validate(deleteJobRequestSchema), controller.remove);
  router.get('/jobs/metadata', publicController.metadata);
  router.get('/jobs/:id', validate(jobParamsSchema, 'params'), publicController.publicDetail);
  return router;
}
