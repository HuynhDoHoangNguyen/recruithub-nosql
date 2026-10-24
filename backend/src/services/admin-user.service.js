import { z } from 'zod';
import { DOCUMENT_TYPES, USER_ACCOUNT_STATUSES, USER_ROLES } from '../constants/document.constants.js';
import { AuthServiceError } from './auth.service.js';
import { toSafeUserDto } from './user.dto.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(4096).optional(),
  search: z.string().trim().max(100).optional(),
  role: z.enum([USER_ROLES.CANDIDATE, USER_ROLES.RECRUITER, USER_ROLES.ADMIN]).optional(),
  status: z.enum([USER_ACCOUNT_STATUSES.ACTIVE, USER_ACCOUNT_STATUSES.LOCKED, USER_ACCOUNT_STATUSES.RESET_REQUIRED]).optional(),
}).strict();

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
    const identity = { search: normalizedSearch, role: role ?? null, status: status ?? null };
    let afterId;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded || typeof decoded !== 'object' || !decoded.identity || typeof decoded.identity !== 'object' ||
          JSON.stringify(decoded.identity) !== JSON.stringify(identity) || typeof decoded.afterId !== 'string' || !/^user:[a-f0-9]{64}$/.test(decoded.afterId)) {
        throw new AuthServiceError(400, 'INVALID_CURSOR', 'The page cursor does not match these filters.');
      }
      afterId = decoded.afterId;
    }
    const visible = [];
    let hasMore = false;
    let scanAfter = afterId;
    for (let pageNumber = 0; pageNumber < 10000; pageNumber += 1) {
      const page = await this.users.listByIdPrefix({ afterId: scanAfter, limit: 250 });
      const pageDocs = page.docs ?? [];
      for (const doc of pageDocs) {
        scanAfter = doc._id;
        if (doc.type !== DOCUMENT_TYPES.USER) continue;
        if (role && doc.role !== role) continue;
        if (status && doc.account_status !== status) continue;
        if (normalizedSearch && !doc.email_normalized?.toLowerCase().startsWith(normalizedSearch)) continue;
        visible.push(doc);
        if (visible.length > limit) { hasMore = true; break; }
      }
      if (hasMore || !page.hasMore || pageDocs.length === 0 || page.lastId === afterId || page.lastId === scanAfter && pageDocs.length === 0) break;
      scanAfter = page.lastId;
    }
    const pageUsers = visible.slice(0, limit).map(toSafeUserDto);
    const nextAfterId = visible.length > limit ? visible[limit - 1]._id : null;
    return {
      users: pageUsers,
      nextCursor: hasMore && nextAfterId ? encodeCursor({ identity, afterId: nextAfterId }) : null,
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
    if (current.account_status === accountStatus) return { user: toSafeUserDto(current), revision: current._rev };
    const updated = { ...current, account_status: accountStatus, updated_at: new Date(this.now()).toISOString() };
    try {
      const result = await this.users.update(updated, expectedRevision);
      return { user: toSafeUserDto(updated), revision: result?.rev ?? expectedRevision };
    } catch (error) {
      if (error?.code === 'CONFLICT') throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The account changed. Reload it and try again.');
      throw error;
    }
  }

  async getStatistics() {
    const [users, candidates] = await Promise.all([
      this.#collectByIdPrefix(this.users, 'user:', DOCUMENT_TYPES.USER),
      this.#collectByIdPrefix(this.candidates, 'candidate:', DOCUMENT_TYPES.CANDIDATE),
    ]);
    const roles = Object.fromEntries(Object.values(USER_ROLES).map((role) => [role, 0]));
    const statuses = Object.fromEntries(Object.values(USER_ACCOUNT_STATUSES).map((status) => [status, 0]));
    for (const user of users) {
      if (Object.hasOwn(roles, user.role)) roles[user.role] += 1;
      if (Object.hasOwn(statuses, user.account_status)) statuses[user.account_status] += 1;
    }
    return { totalUsers: users.length, totalCandidates: candidates.length, roles, statuses };
  }

  async #collectByIdPrefix(repository, prefix, expectedType) {
    const docs = [];
    let afterId;
    for (let page = 0; page < 10000; page += 1) {
      const result = await repository.listByIdPrefix({ afterId, limit: 500 });
      const pageDocs = result.docs ?? [];
      docs.push(...pageDocs.filter((doc) => doc.type === expectedType));
      if (!result.hasMore || pageDocs.length === 0 || result.lastId === afterId) break;
      afterId = result.lastId;
    }
    return docs;
  }
}

export { querySchema as adminUserQuerySchema };
