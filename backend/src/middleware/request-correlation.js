import { randomUUID } from 'node:crypto';

export function requestCorrelation(req, res, next) {
  req.correlationId = randomUUID();
  res.set('X-Request-Id', req.correlationId);
  next();
}
