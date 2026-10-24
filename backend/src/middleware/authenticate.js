import { errorResponse } from '../utils/api-response.js';
import { AuthServiceError } from '../services/auth.service.js';
import { CouchDbError, toApiError } from '../services/couchdb.errors.js';

export function createAuthenticate({ serviceProvider }) {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(header);
    if (!match) {
      return res.status(401).json(errorResponse('AUTHENTICATION_FAILED', 'A valid access token is required.', null));
    }

    try {
      const authenticated = await serviceProvider().authenticate(match[1]);
      req.auth = authenticated.principal;
      req.user = authenticated.user;
      return next();
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return res.status(error.status).json(errorResponse(error.code, error.message, null));
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
  };
}

export function requireRole(...allowedRoles) {
  if (!allowedRoles.length) throw new TypeError('requireRole needs at least one role.');
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json(errorResponse('AUTHENTICATION_FAILED', 'A valid access token is required.', null));
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json(errorResponse('FORBIDDEN', 'You do not have permission to perform this action.', null));
    }
    return next();
  };
}
