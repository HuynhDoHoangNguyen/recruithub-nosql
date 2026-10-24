import { userDocumentSchema } from '../schemas/user.schema.js';
import { verifyAccessToken } from '../services/jwt-access-token.js';

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

// Compatibility adapter for TV2 routes; token format and verification are owned by TV1 Auth.
export function createJwtAuthentication(repository, env = process.env, now = () => Date.now()) {
  return async (req, res, next) => {
    if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32) {
      throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Dịch vụ xác thực chưa được cấu hình.');
    }
    const denied = () => new ApiError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || token.length > 8192) throw denied();
    let claims;
    try { claims = verifyAccessToken(token, { secret: env.JWT_ACCESS_SECRET, nowMs: now() }); }
    catch { throw denied(); }
    const user = await repository.get(claims.sub);
    if (!userDocumentSchema.safeParse(user).success || user.account_status !== 'ACTIVE') throw denied();
    // Reloaded canonical User is authoritative; role claims are never trusted.
    req.user = user;
    req.auth = { sub: user._id, role: user.role };
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
  const databaseConfiguration = error?.code === 'AUTH_DATABASE_CONFIGURATION_ERROR';
  const malformed = error.type === 'entity.parse.failed';
  const oversized = error.type === 'entity.too.large';
  const code = known ? error.code : databaseConfiguration ? 'AUTH_DATABASE_CONFIGURATION_ERROR' : malformed || oversized ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
  const message = known ? error.message : databaseConfiguration ? 'Job/Application persistence requires an explicitly configured isolated database.' : malformed || oversized ? 'Nội dung gửi lên không hợp lệ hoặc quá dài.' : 'Có lỗi hệ thống. Vui lòng thử lại.';
  res.status(known ? error.status : databaseConfiguration ? 503 : malformed || oversized ? 400 : 500).json({
    success: false,
    error: { code, message, details: known ? error.details : [] },
  });
}
