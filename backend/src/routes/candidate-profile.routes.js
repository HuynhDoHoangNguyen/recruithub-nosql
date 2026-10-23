import { Router } from 'express';
import { createAuthRepositories } from '../config/auth-database.config.js';
import { AuthService } from '../services/auth.service.js';
import { createAuthenticate, requireRole } from '../middleware/authenticate.js';
import { CandidateProfileService } from '../services/candidate-profile.service.js';
import { successResponse } from '../utils/api-response.js';
import { sendApiError } from '../utils/send-api-error.js';

function createDefaultServices() {
  const { users, candidates } = createAuthRepositories();
  return {
    auth: new AuthService({ userRepository: users, candidateRepository: candidates, jwtSecret: process.env.JWT_ACCESS_SECRET }),
    profile: new CandidateProfileService({ candidateRepository: candidates }),
  };
}

function setRevision(res, revision) {
  if (revision) res.set('ETag', `"${revision}"`);
}

export function createCandidateProfileRouter({ servicesFactory = createDefaultServices } = {}) {
  let services;
  const getServices = () => (services ??= servicesFactory());
  const router = Router();
  router.use(createAuthenticate({ serviceProvider: () => getServices().auth }));
  router.use(requireRole('CANDIDATE'));

  router.get('/me', async (req, res) => {
    try {
      const result = await getServices().profile.getMyProfile(req.auth.sub);
      setRevision(res, result.revision);
      return res.json(successResponse({ profile: result.profile }, 'Candidate profile loaded.'));
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  router.patch('/me', async (req, res) => {
    try {
      const revision = (req.get('if-match') ?? '').replace(/^"|"$/g, '');
      const result = await getServices().profile.updateMyProfile(req.auth.sub, req.body, revision);
      setRevision(res, result.revision);
      return res.json(successResponse({ profile: result.profile }, 'Candidate profile updated.'));
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  return router;
}

export default createCandidateProfileRouter;
