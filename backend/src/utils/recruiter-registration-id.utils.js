import { createHash } from 'node:crypto';

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Canonical form used only for duplicate comparison and the self-signup ID key. */
export function normalizeCompanyName(value) {
  if (typeof value !== 'string') throw new TypeError('Company name must be a string.');
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi');
  if (!normalized) throw new Error('Company name cannot be empty.');
  return normalized;
}

export function normalizeCompanyDisplayName(value) {
  if (typeof value !== 'string') throw new TypeError('Company name must be a string.');
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!normalized) throw new Error('Company name cannot be empty.');
  return normalized;
}

export function normalizeDepartmentDisplayName(value) {
  if (typeof value !== 'string') throw new TypeError('Department name must be a string.');
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!normalized) throw new Error('Department name cannot be empty.');
  return normalized;
}

export function departmentKeyFromName(value) {
  const key = normalizeDepartmentDisplayName(value)
    .toLocaleLowerCase('vi')
    .replace(/đ/gu, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (!key) throw new Error('Department name does not produce a valid key.');
  return key;
}

export function companyIdFromSelfRegistration(companyName) {
  return `company:user:${digest(normalizeCompanyName(companyName))}`;
}

export function departmentIdFromSelfRegistration(companyId, departmentKey) {
  if (!/^company:[a-z0-9_:-]+$/.test(companyId)) throw new TypeError('Invalid Company ID.');
  if (!/^[a-z0-9_-]+$/.test(departmentKey)) throw new TypeError('Invalid Department key.');
  return `department:user:${digest(`${companyId}\n${departmentKey}`)}`;
}

export function recruiterIdFromSelfRegistration(userId, companyId, departmentId) {
  if (!/^user:[a-f0-9]{64}$/.test(userId)) throw new TypeError('Invalid User ID.');
  if (!/^company:[a-z0-9_:-]+$/.test(companyId)) throw new TypeError('Invalid Company ID.');
  if (!/^department:[a-z0-9_:-]+$/.test(departmentId)) throw new TypeError('Invalid Department ID.');
  return `recruiter:user:${digest(`${userId}\n${companyId}\n${departmentId}`)}`;
}
