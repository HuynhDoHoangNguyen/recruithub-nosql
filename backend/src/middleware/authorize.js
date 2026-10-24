import { errorResponse } from '../utils/api-response.js';
import { sendApiError } from '../utils/send-api-error.js';

/** Reusable resource ownership guard. The loader must resolve from trusted IDs. */
export function requireOwnership({ loadResource, getOwnerId = (resource) => resource?.user_id, getResourceId = (req) => req.params.id }) {
  if (typeof loadResource !== 'function' || typeof getOwnerId !== 'function' || typeof getResourceId !== 'function') {
    throw new TypeError('requireOwnership needs resource and owner resolvers.');
  }
  return async (req, res, next) => {
    if (!req.auth?.sub) return res.status(401).json(errorResponse('AUTHENTICATION_FAILED', 'A valid access token is required.', null));
    try {
      const resource = await loadResource(getResourceId(req), req);
      if (!resource) return res.status(404).json(errorResponse('NOT_FOUND', 'The requested resource was not found.', null));
      if (getOwnerId(resource, req) !== req.auth.sub) {
        return res.status(403).json(errorResponse('FORBIDDEN', 'You do not have permission to access this resource.', null));
      }
      req.ownedResource = resource;
      return next();
    } catch (error) {
      return sendApiError(res, error);
    }
  };
}

/** Reusable scope guard for modules whose resource ownership is organization-scoped. */
export function requireScope({ resolveAllowedScopes, getRequestedScope = (req) => req.params.scopeId }) {
  if (typeof resolveAllowedScopes !== 'function' || typeof getRequestedScope !== 'function') {
    throw new TypeError('requireScope needs scope resolvers.');
  }
  return async (req, res, next) => {
    if (!req.auth?.sub) return res.status(401).json(errorResponse('AUTHENTICATION_FAILED', 'A valid access token is required.', null));
    try {
      const [scopes, requested] = await Promise.all([
        resolveAllowedScopes(req.auth, req),
        Promise.resolve(getRequestedScope(req)),
      ]);
      if (!requested || !Array.isArray(scopes) || !scopes.includes(requested)) {
        return res.status(403).json(errorResponse('FORBIDDEN', 'You do not have permission to access this scope.', null));
      }
      req.authorizedScope = requested;
      return next();
    } catch (error) {
      return sendApiError(res, error);
    }
  };
}
