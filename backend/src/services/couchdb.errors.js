const HTTP_ERROR_MESSAGES = Object.freeze({
  400: ['BAD_REQUEST', 'CouchDB rejected the request.'],
  401: ['AUTHENTICATION_ERROR', 'CouchDB authentication failed.'],
  403: ['AUTHORIZATION_ERROR', 'CouchDB denied the request.'],
  404: ['NOT_FOUND', 'The requested CouchDB resource was not found.'],
  409: ['CONFLICT', 'The document revision conflicts with the current revision.'],
});

export class CouchDbError extends Error {
  constructor(code, message, { status, operation, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'CouchDbError';
    this.code = code;
    this.status = status;
    this.operation = operation;
  }
}

export function couchDbErrorFromResponse(status, operation, { databaseRequest = false } = {}) {
  if (status === 404 && databaseRequest) {
    return new CouchDbError(
      'DATABASE_NOT_FOUND',
      'The configured CouchDB database does not exist.',
      { status, operation },
    );
  }

  if (HTTP_ERROR_MESSAGES[status]) {
    const [code, message] = HTTP_ERROR_MESSAGES[status];
    return new CouchDbError(code, message, { status, operation });
  }

  if (status >= 500) {
    return new CouchDbError(
      'SERVER_ERROR',
      'CouchDB returned a server error.',
      { status, operation },
    );
  }

  return new CouchDbError(
    'HTTP_ERROR',
    'CouchDB returned an unexpected HTTP response.',
    { status, operation },
  );
}

export function couchDbErrorFromNetwork(error, operation, timedOut = false) {
  if (timedOut || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return new CouchDbError('TIMEOUT', 'The CouchDB request timed out.', { operation, cause: error });
  }
  return new CouchDbError('NETWORK_ERROR', 'CouchDB could not be reached.', { operation, cause: error });
}

export function toApiError(error) {
  if (error instanceof CouchDbError) {
    const statusByCode = {
      DATABASE_NOT_FOUND: 503,
      NOT_FOUND: 404,
      CONFLICT: 409,
      AUTHENTICATION_ERROR: 503,
      AUTHORIZATION_ERROR: 503,
      NETWORK_ERROR: 503,
      TIMEOUT: 504,
      SERVER_ERROR: 502,
      BAD_REQUEST: 400,
      HTTP_ERROR: 502,
    };
    return {
      status: statusByCode[error.code] ?? 500,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: [],
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.',
        details: [],
      },
    },
  };
}
