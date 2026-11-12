import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { DOCUMENT_TYPES, USER_ACCOUNT_STATUSES, USER_ROLES } from '../constants/document.constants.js';
import { AuthServiceError, PASSWORD_HASH_OPTIONS } from './auth.service.js';
import { formatPasswordResetHash, PASSWORD_RESET_TTL_MS } from './password-reset.js';
import { toSafeUserDto } from './user.dto.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(4096).optional(),
  search: z.string().trim().max(100).optional(),
  role: z.enum([USER_ROLES.CANDIDATE, USER_ROLES.RECRUITER, USER_ROLES.ADMIN]).optional(),
  status: z.enum([USER_ACCOUNT_STATUSES.ACTIVE, USER_ACCOUNT_STATUSES.LOCKED, USER_ACCOUNT_STATUSES.RESET_REQUIRED]).optional(),
}).strict();

const MAX_SCAN_DOCUMENTS_PER_REQUEST = 5000;
const SCAN_PAGE_SIZE = 250;

function encodeCursor(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function decodeCursor(cursor) {
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); }
  catch { throw new AuthServiceError(400, 'INVALID_CURSOR', 'The page cursor is invalid.'); }
}
export class AdminUserService {
  constructor({ userRepository, candidateRepository, now = () => Date.now() }) {
    if (!userRepository || !candidateRepository) throw new TypeError('AdminUserService requires User and Candidate repositories.');
    this.users = userRepository;
    this.candidates = candidateRepository;
    this.now = now;
  }

  async list(input = {}) {
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) throw new AuthServiceError(400, 'VALIDATION_ERROR', 'User filters are invalid.');
    const { limit, cursor, search = '', role, status } = parsed.data;
    const normalizedSearch = search.toLowerCase();
    const totalCount = typeof this.users.countByFilters === 'function'
      ? await this.users.countByFilters({ search: normalizedSearch, role, status })
      : null;
    const identity = { limit, search: normalizedSearch, role: role ?? null, status: status ?? null };
    let afterId;
    let afterKey;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded || typeof decoded !== 'object' || !decoded.identity || typeof decoded.identity !== 'object' ||
          JSON.stringify(decoded.identity) !== JSON.stringify(identity) || typeof decoded.afterId !== 'string' || !/^user:[a-f0-9]{64}$/.test(decoded.afterId)) {
        throw new AuthServiceError(400, 'INVALID_CURSOR', 'The page cursor does not match these filters.');
      }
      afterId = decoded.afterId;
      afterKey = decoded.afterKey;
      if (afterKey !== undefined && (!Array.isArray(afterKey) || afterKey.length !== 3 ||
          afterKey[0] !== (role ?? null) || afterKey[1] !== (status ?? null) ||
          typeof afterKey[2] !== 'string' || !afterKey[2].startsWith(normalizedSearch))) {
        throw new AuthServiceError(400, 'INVALID_CURSOR', 'The page cursor does not match these filters.');
      }
    }
    if (typeof this.users.listByFilters === 'function') {
      const rows = await this.users.listByFilters({ search: normalizedSearch, role, status, afterKey, afterId, limit });
      const visibleRows = rows.slice(0, limit);
      const lastRow = visibleRows.at(-1);
      const hasMore = rows.length > limit;
      return {
        users: visibleRows.map((row) => toSafeUserDto(row.doc)),
        nextCursor: hasMore && lastRow
          ? encodeCursor({ identity, afterKey: lastRow.key, afterId: lastRow.doc._id })
          : null,
        totalCount,
      };
    }
    const visible = [];
    let hasMore = false;
    let scanAfter = afterId;
    let scannedDocuments = 0;
    while (scannedDocuments < MAX_SCAN_DOCUMENTS_PER_REQUEST) {
      const scanLimit = Math.min(SCAN_PAGE_SIZE, MAX_SCAN_DOCUMENTS_PER_REQUEST - scannedDocuments);
      const page = await this.users.listByIdPrefix({ afterId: scanAfter, limit: scanLimit });
      const pageDocs = page.docs ?? [];
      for (const doc of pageDocs) {
        scanAfter = doc._id;
        scannedDocuments += 1;
        if (doc.type !== DOCUMENT_TYPES.USER) continue;
        if (role && doc.role !== role) continue;
        if (status && doc.account_status !== status) continue;
        if (normalizedSearch && !doc.email_normalized?.toLowerCase().startsWith(normalizedSearch)) continue;
        visible.push(doc);
        if (visible.length > limit) { hasMore = true; break; }
      }
      if (hasMore || !page.hasMore || pageDocs.length === 0) break;
      if (page.lastId === scanAfter && pageDocs.length === 0) break;
    }
    const pageUsers = visible.slice(0, limit).map(toSafeUserDto);
    const scanBudgetExhausted = scannedDocuments >= MAX_SCAN_DOCUMENTS_PER_REQUEST && scanAfter !== afterId;
    const nextAfterId = visible.length > limit ? visible[limit - 1]._id : scanBudgetExhausted ? scanAfter : null;
    return {
      users: pageUsers,
      nextCursor: (hasMore || scanBudgetExhausted) && nextAfterId ? encodeCursor({ identity, afterId: nextAfterId }) : null,
      totalCount,
    };
  }

  async getDetails(id) {
    const user = await this.users.getById(id);
    if (user.type !== DOCUMENT_TYPES.USER) throw new AuthServiceError(404, 'USER_NOT_FOUND', 'User was not found.');
    return { user: toSafeUserDto(user), revision: user._rev };
  }

  async setAccountStatus(id, accountStatus, expectedRevision) {
    if (![USER_ACCOUNT_STATUSES.ACTIVE, USER_ACCOUNT_STATUSES.LOCKED].includes(accountStatus)) {
      throw new AuthServiceError(400, 'VALIDATION_ERROR', 'Only ACTIVE or LOCKED status can be selected.');
    }
    const current = await this.users.getById(id);
    if (current.type !== DOCUMENT_TYPES.USER) throw new AuthServiceError(404, 'USER_NOT_FOUND', 'User was not found.');
    if (current.role === USER_ROLES.ADMIN) {
      throw new AuthServiceError(403, 'ADMIN_STATUS_CHANGE_FORBIDDEN', 'Admin account status is managed by an operator outside this MVP.');
    }
    if (!expectedRevision) throw new AuthServiceError(428, 'PRECONDITION_REQUIRED', 'If-Match with the current revision is required.');
    if (current._rev !== expectedRevision) throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The account changed. Reload it and try again.');
    if (current.account_status === USER_ACCOUNT_STATUSES.RESET_REQUIRED) {
      throw new AuthServiceError(409, 'RESET_REQUIRED_PROTECTED', 'RESET_REQUIRED accounts cannot be activated or changed here.');
    }
    if (current.account_status === accountStatus) {
      throw new AuthServiceError(409, 'INVALID_STATUS_TRANSITION', 'The account is already in the requested status. Reload it before choosing the opposite action.');
    }
    const updated = { ...current, account_status: accountStatus, updated_at: new Date(this.now()).toISOString() };
    try {
      const result = await this.users.update(updated, expectedRevision);
      return { user: toSafeUserDto(updated), revision: result?.rev ?? expectedRevision };
    } catch (error) {
      if (error?.code === 'CONFLICT') throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The account changed. Reload it and try again.');
      throw error;
    }
  }

  async issuePasswordReset(id, expectedRevision) {
    const current = await this.users.getById(id);
    if (current.type !== DOCUMENT_TYPES.USER) throw new AuthServiceError(404, 'USER_NOT_FOUND', 'User was not found.');
    if (![USER_ROLES.CANDIDATE, USER_ROLES.RECRUITER].includes(current.role)) {
      throw new AuthServiceError(403, 'PASSWORD_RESET_FORBIDDEN', 'Admin and unsupported account roles cannot be reset here.');
    }
    if (current.account_status !== USER_ACCOUNT_STATUSES.RESET_REQUIRED) {
      throw new AuthServiceError(409, 'PASSWORD_RESET_NOT_REQUIRED', 'Only RESET_REQUIRED accounts can receive a reset credential.');
    }
    if (!expectedRevision) throw new AuthServiceError(428, 'PRECONDITION_REQUIRED', 'If-Match with the current revision is required.');
    if (current._rev !== expectedRevision) throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The account changed. Reload it and try again.');

    const temporaryPassword = randomBytes(32).toString('base64url');
    const expiresAt = this.now() + PASSWORD_RESET_TTL_MS;
    const temporaryPasswordHash = await argon2.hash(temporaryPassword, PASSWORD_HASH_OPTIONS);
    const updated = {
      ...current,
      password_hash: formatPasswordResetHash(expiresAt, temporaryPasswordHash),
      updated_at: new Date(this.now()).toISOString(),
    };
    try {
      const result = await this.users.update(updated, expectedRevision);
      return {
        user: toSafeUserDto(updated),
        revision: result?.rev ?? expectedRevision,
        temporaryPassword,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    } catch (error) {
      if (error?.code === 'CONFLICT') throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The account changed. Reload it and try again.');
      throw error;
    }
  }

}

export { querySchema as adminUserQuerySchema };
