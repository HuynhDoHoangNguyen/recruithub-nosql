import { Router } from 'express';
import { z } from 'zod';
import { createAuthRepositories } from '../config/auth-database.config.js';
import { createAuthenticate, requireRole } from '../middleware/authenticate.js';
import { AuthService } from '../services/auth.service.js';
import { AdminUserService } from '../services/admin-user.service.js';
import { errorResponse, successResponse } from '../utils/api-response.js';
import { sendApiError } from '../utils/send-api-error.js';

const statusBodySchema = z.object({ account_status: z.enum(['ACTIVE', 'LOCKED']) }).strict();
const idSchema = z.string().regex(/^user:[a-f0-9]{64}$/);

function createDefaultServices() {
  const repositories = createAuthRepositories();
  const { users, candidates } = repositories;
  return {
    auth: new AuthService({ userRepository: users, candidateRepository: candidates,
      companyRepository: repositories.companies, departmentRepository: repositories.departments,
      recruiterRepository: repositories.recruiters, jwtSecret: process.env.JWT_ACCESS_SECRET }),
    admin: new AdminUserService({ userRepository: users, candidateRepository: candidates }),
  };
}

export function createAdminUserRouter({ servicesFactory = createDefaultServices } = {}) {
  let services;
  const getServices = () => (services ??= servicesFactory());
  const router = Router();
  router.use(createAuthenticate({ serviceProvider: () => getServices().auth }));
  router.use(requireRole('ADMIN'));

  router.get('/users', async (req, res) => {
    try {
      const result = await getServices().admin.list(req.query);
      return res.json(successResponse(result, 'Users loaded.'));
    } catch (error) { return sendApiError(res, error); }
  });

  router.get('/users/:id', async (req, res) => {
    try {
      if (!idSchema.safeParse(req.params.id).success) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'User ID is invalid.', null));
      const result = await getServices().admin.getDetails(req.params.id);
      if (result.revision) res.set('ETag', `"${result.revision}"`);
      return res.json(successResponse({ user: result.user }, 'User loaded.'));
    } catch (error) { return sendApiError(res, error); }
  });

  router.patch('/users/:id/status', async (req, res) => {
    try {
      if (!idSchema.safeParse(req.params.id).success) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'User ID is invalid.', null));
      const parsed = statusBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Account status request is invalid.', null));
      const revision = (req.get('if-match') ?? '').replace(/^"|"$/g, '');
      const result = await getServices().admin.setAccountStatus(req.params.id, parsed.data.account_status, revision);
      if (result.revision) res.set('ETag', `"${result.revision}"`);
      return res.json(successResponse({ user: result.user }, 'Account status updated.'));
    } catch (error) { return sendApiError(res, error); }
  });

  router.get('/stats', async (_req, res) => {
    try {
      const stats = await getServices().admin.getStatistics();
      return res.json(successResponse(stats, 'Account statistics loaded.'));
    } catch (error) { return sendApiError(res, error); }
  });
  return router;
}

export default createAdminUserRouter;
