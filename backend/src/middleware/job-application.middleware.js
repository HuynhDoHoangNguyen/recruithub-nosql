import { createHmac, timingSafeEqual } from 'node:crypto';
import { userDocumentSchema } from '../schemas/user.schema.js';

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.',
    result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }))));
  req.validated = { ...req.validated, [source]: result.data };
  next();
};

// Identity integration: HS256 access token; canonical User remains the authority.
export function createJwtAuthentication(repository, env = process.env, now = () => Date.now()) {
  return async (req, res, next) => {
    if (env.JWT_ALGORITHM !== 'HS256' || !env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Dịch vụ xác thực chưa được cấu hình.');
    }
    const denied = () => new ApiError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || token.length > 8192) throw denied();
    let claims;
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some(part => !part)) throw denied();
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (header.alg !== 'HS256' || header.crit) throw denied();
      const signature = Buffer.from(parts[2], 'base64url');
      const expected = createHmac('sha256', env.JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
      if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw denied();
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const seconds = now() / 1000;
      if (!Number.isFinite(claims.exp) || claims.exp <= seconds) throw denied();
      if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds)) throw denied();
      if (env.JWT_ISSUER && claims.iss !== env.JWT_ISSUER) throw denied();
      if (env.JWT_AUDIENCE && !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(env.JWT_AUDIENCE)) throw denied();
      if (claims.sub && claims.user_id && claims.sub !== claims.user_id) throw denied();
      if (!/^user:[a-f0-9]{64}$/.test(claims.sub || claims.user_id || '')) throw denied();
    } catch { throw denied(); }
    const user = await repository.get(claims.sub || claims.user_id);
    if (!userDocumentSchema.safeParse(user).success || user.account_status !== 'ACTIVE') throw denied();
    req.user = user;
    next();
  };
}

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
  next();
};

export function jobApplicationErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const known = error instanceof ApiError;
  const malformed = error.type === 'entity.parse.failed';
  const oversized = error.type === 'entity.too.large';
  res.status(known ? error.status : malformed || oversized ? 400 : 500).json({
    success: false,
    error: { code: known ? error.code : malformed || oversized ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', details: known ? error.details : [] },
    message: known ? error.message : malformed || oversized ? 'Nội dung gửi lên không hợp lệ hoặc quá dài.' : 'Có lỗi hệ thống. Vui lòng thử lại.',
  });
}
