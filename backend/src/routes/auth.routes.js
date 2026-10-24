import { Router } from 'express';
import { createAuthRepositories } from '../config/auth-database.config.js';
export { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { CouchDbError, toApiError } from '../services/couchdb.errors.js';
import { AuthService, AuthServiceError } from '../services/auth.service.js';
import { candidateRegistrationRequestSchema, loginRequestSchema, recruiterRegistrationRequestSchema } from '../schemas/auth-request.schema.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate-body.js';
import { errorResponse, successResponse } from '../utils/api-response.js';

function createDefaultAuthService() {
  const repositories = createAuthRepositories();
  return new AuthService({
    userRepository: repositories.users,
    candidateRepository: repositories.candidates,
    companyRepository: repositories.companies,
    departmentRepository: repositories.departments,
    recruiterRepository: repositories.recruiters,
    jwtSecret: process.env.JWT_ACCESS_SECRET,
  });
}

function sendAuthError(res, error) {
  if (error instanceof AuthServiceError) {
    return res.status(error.status).json(errorResponse(error.code, error.message, error.details));
  }
  if (error instanceof CouchDbError) {
    const mapped = toApiError(error);
    return res.status(mapped.status).json(mapped.body);
  }
  if (error?.code === 'INVALID_DATABASE_CONFIG') {
    return res.status(503).json(errorResponse('DATABASE_CONFIGURATION_ERROR', 'Authentication storage is unavailable.', null));
  }
  if (error?.code === 'AUTH_DATABASE_CONFIGURATION_ERROR') {
    return res.status(503).json(errorResponse('AUTH_DATABASE_CONFIGURATION_ERROR', 'Authentication storage is not configured for an isolated database.', null));
  }
  return res.status(500).json(errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected server error occurred.', null));
}

/** Route factory supports fake services for isolated tests. */
export function createAuthRouter({
  serviceFactory = createDefaultAuthService,
  recruiterRegistrationEnabled = process.env.PUBLIC_RECRUITER_REGISTRATION_ENABLED === 'true',
} = {}) {
  if (typeof serviceFactory !== 'function') throw new TypeError('serviceFactory must be a function.');
  const router = Router();
  let service;
  const serviceProvider = () => {
    if (!service) service = serviceFactory();
    return service;
  };

  router.post('/register', validateBody(candidateRegistrationRequestSchema), async (req, res) => {
    try {
      const result = await serviceProvider().register(req.validatedBody);
      return res.status(201).json(successResponse(result, 'Candidate account created. Sign in to continue.'));
    } catch (error) {
      return sendAuthError(res, error);
    }
  });

  router.post('/register/recruiter', (req, res, next) => {
    if (!recruiterRegistrationEnabled) {
      return res.status(404).json(errorResponse('RECRUITER_REGISTRATION_DISABLED', 'Recruiter registration is not enabled.', null));
    }
    return next();
  }, validateBody(recruiterRegistrationRequestSchema), async (req, res) => {
    try {
      const result = await serviceProvider().registerRecruiter(req.validatedBody);
      return res.status(201).json(successResponse(result, 'Recruiter account created. Sign in to continue.'));
    } catch (error) {
      return sendAuthError(res, error);
    }
  });

  router.post('/login', validateBody(loginRequestSchema), async (req, res) => {
    try {
      const result = await serviceProvider().login(req.validatedBody);
      return res.status(200).json(successResponse(result, 'Signed in successfully.'));
    } catch (error) {
      return sendAuthError(res, error);
    }
  });

  router.get('/me', createAuthenticate({ serviceProvider }), (req, res) => (
    res.status(200).json(successResponse({ user: req.user }, 'Authenticated user.'))
  ));

  return router;
}

export default createAuthRouter;
