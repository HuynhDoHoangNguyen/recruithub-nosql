import { AuthServiceError } from '../services/auth.service.js';
import { CouchDbError, toApiError } from '../services/couchdb.errors.js';
import { errorResponse } from './api-response.js';

export function sendApiError(res, error) {
  if (error instanceof AuthServiceError) {
    return res.status(error.status).json(errorResponse(error.code, error.message, null));
  }
  if (error instanceof CouchDbError) {
    const mapped = toApiError(error);
    return res.status(mapped.status).json(mapped.body);
  }
  if (error?.code === 'DOCUMENT_VALIDATION_FAILED') {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', 'The requested data is invalid.', null));
  }
  if (error?.code === 'AUTH_DATABASE_CONFIGURATION_ERROR') {
    return res.status(503).json(errorResponse('AUTH_DATABASE_CONFIGURATION_ERROR', 'Authentication storage is not configured for an isolated database.', null));
  }
  if (error?.code === 'INVALID_DATABASE_CONFIG') {
    return res.status(503).json(errorResponse('DATABASE_CONFIGURATION_ERROR', 'Authentication storage is unavailable.', null));
  }
  return res.status(500).json(errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected server error occurred.', null));
}
