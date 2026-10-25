import { Router } from 'express';
import { requireRoles, validate } from '../middleware/job-application.middleware.js';
import { recruiterCompanyPatchSchema, recruiterProfilePatchSchema } from '../schemas/recruiter-profile.schema.js';

export function createRecruiterProfileRoutes({ authenticate, recruiterProfiles }) {
  const router = Router();
  const guarded = [authenticate, requireRoles('RECRUITER')];
  const send = action => async (req, res) => res.json({ success: true, data: await action(req), message: 'Đã cập nhật hồ sơ doanh nghiệp.' });
  router.get('/recruiter/profile', ...guarded, send(req => recruiterProfiles.get(req.user)));
  router.patch('/recruiter/profile', ...guarded, validate(recruiterProfilePatchSchema), send(req => recruiterProfiles.update(req.user, req.validated.body)));
  router.patch('/recruiter/company', ...guarded, validate(recruiterCompanyPatchSchema), send(req => recruiterProfiles.update(req.user, req.validated.body, true)));
  return router;
}
