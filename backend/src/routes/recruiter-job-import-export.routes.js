import { Router } from 'express';
import { requireRoles, validate } from '../middleware/job-application.middleware.js';
import { importConfirmRequestSchema, importPreviewRequestSchema, jobExportQuerySchema, jobTemplateQuerySchema } from '../schemas/recruiter-job-import-export.schema.js';
import { recruiterJobImportExportController } from '../controllers/recruiter-job-import-export.controller.js';

export function createRecruiterJobImportExportRoutes({ authenticate, service }) {
  const router = Router();
  const controller = recruiterJobImportExportController(service);
  const recruiter = [authenticate, requireRoles('RECRUITER')];
  router.get('/recruiter/jobs/import/template', ...recruiter, validate(jobTemplateQuerySchema, 'query'), controller.template);
  router.post('/recruiter/jobs/import/preview', ...recruiter, validate(importPreviewRequestSchema), controller.preview);
  router.post('/recruiter/jobs/import/confirm', ...recruiter, validate(importConfirmRequestSchema), controller.confirm);
  router.get('/recruiter/jobs/export', ...recruiter, validate(jobExportQuerySchema, 'query'), controller.export);
  return router;
}
