export const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

export function formatPasswordResetHash(expiresAt, passwordHash) {
  if (!Number.isSafeInteger(expiresAt) || typeof passwordHash !== 'string' || !passwordHash.startsWith('$argon2id$')) {
    throw new TypeError('A valid expiry and Argon2id hash are required.');
  }
  return `reset$v1$${expiresAt}${passwordHash}`;
}

export function parsePasswordResetHash(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('$');
  if (parts[0] !== 'reset' || parts[1] !== 'v1' || !/^\d{13}$/.test(parts[2] ?? '')) return null;
  const expiresAt = Number(parts[2]);
  const passwordHash = `$${parts.slice(3).join('$')}`;
  if (!Number.isSafeInteger(expiresAt) || !passwordHash.startsWith('$argon2id$')) return null;
  return { expiresAt, passwordHash };
}
