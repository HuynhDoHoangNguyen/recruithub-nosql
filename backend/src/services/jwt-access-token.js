import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const TOKEN_ISSUER = 'recruithub-api';
const TOKEN_AUDIENCE = 'recruithub-client';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input, secret) {
  return createHmac('sha256', secret).update(input).digest();
}

function decodeJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function assertSecret(secret) {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret, 'utf8') < 32 ||
    /^(replace_with|change_me|your[-_])/i.test(secret)
  ) {
    throw new TypeError('JWT signing secret must contain at least 32 bytes.');
  }
}

export function issueAccessToken({ sub, role }, { secret, nowMs = Date.now() } = {}) {
  assertSecret(secret);
  if (typeof sub !== 'string' || !/^user:[a-f0-9]{64}$/.test(sub)) {
    throw new TypeError('JWT subject must be a canonical User ID.');
  }
  const issuedAt = Math.floor(nowMs / 1000);
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    sub,
    role,
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
    jti: randomUUID(),
  });
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${signature(signingInput, secret).toString('base64url')}`;
}

export function verifyAccessToken(token, { secret, nowMs = Date.now() } = {}) {
  assertSecret(secret);
  if (typeof token !== 'string' || token.length > 8192) throw new TypeError('Invalid JWT.');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) throw new TypeError('Invalid JWT.');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const claims = decodeJson(encodedPayload);
  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') throw new TypeError('Unsupported JWT.');

  const expected = signature(`${encodedHeader}.${encodedPayload}`, secret);
  const received = Buffer.from(encodedSignature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new TypeError('Invalid JWT signature.');
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    claims?.iss !== TOKEN_ISSUER ||
    claims?.aud !== TOKEN_AUDIENCE ||
    typeof claims?.sub !== 'string' ||
    !/^user:[a-f0-9]{64}$/.test(claims.sub) ||
    typeof claims?.role !== 'string' ||
    !Number.isInteger(claims?.iat) ||
    !Number.isInteger(claims?.exp) ||
    claims.iat > nowSeconds + 60 ||
    claims.exp <= nowSeconds ||
    claims.exp - claims.iat > ACCESS_TOKEN_TTL_SECONDS ||
    typeof claims?.jti !== 'string'
  ) {
    throw new TypeError('Invalid or expired JWT claims.');
  }
  return claims;
}
