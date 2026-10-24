import { errorResponse } from '../utils/api-response.js';

/**
 * Provisional Zod body validation for future versioned routes. It returns a
 * generic error without exposing input values or Zod issue messages. Final
 * status/code details remain subject to the shared API decision register.
 */
export function validateBody(schema) {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('validateBody requires a Zod-compatible schema.');
  }

  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(errorResponse(
        'VALIDATION_ERROR',
        'Request validation failed.',
        null,
      ));
    }

    req.validatedBody = result.data;
    return next();
  };
}
