import { userDocumentSchema } from '../schemas/user.schema.js';
import { userIdFromEmail } from '../utils/id.utils.js';
import { BaseRepository } from './base.repository.js';

/** User persistence adapter. Credential and lifecycle policy belongs to AuthService. */
export class UserRepository extends BaseRepository {
  constructor({ client } = {}) {
    super({ client, schema: userDocumentSchema });
  }

  /** Deterministic ID lookup; does not query CouchDB by email. */
  getByEmail(email) {
    return this.getById(userIdFromEmail(email));
  }

  listByIdPrefix(options) {
    return this.client.listDocumentsByIdPrefix('user:', options);
  }

  async countByFilters({ search = '', role, status } = {}) {
    const prefix = search.toLowerCase();
    const keyPrefix = [role ?? null, status ?? null];
    const result = await this.client.queryView('tv1_admin_statistics', 'user_count_by_filter', {
      startkey: [...keyPrefix, prefix],
      endkey: [...keyPrefix, prefix ? `${prefix}\ufff0` : {}],
    });
    const rows = result?.rows;
    if (!Array.isArray(rows) || rows.length > 1 || (rows.length === 1 && (!Number.isSafeInteger(rows[0].value) || rows[0].value < 0))) {
      const error = new Error('Admin user count view returned an invalid aggregate.');
      error.code = 'ADMIN_USER_COUNT_QUERY_FAILED';
      throw error;
    }
    return rows[0]?.value ?? 0;
  }

  async listByFilters({ search = '', role, status, afterKey, afterId, limit = 20 } = {}) {
    const prefix = search.toLowerCase();
    const keyPrefix = [role ?? null, status ?? null];
    const options = {
      startkey: afterKey ?? [...keyPrefix, prefix],
      endkey: [...keyPrefix, prefix ? `${prefix}\ufff0` : {}],
      include_docs: true,
      reduce: false,
      limit: limit + 1,
    };
    if (afterKey) {
      options.startkey_docid = afterId;
      options.skip = 1;
    }
    const result = await this.client.queryView('tv1_admin_statistics', 'user_count_by_filter', options);
    if (!Array.isArray(result?.rows) || result.rows.some((row) => !row.doc || !Array.isArray(row.key))) {
      const error = new Error('Admin user list view returned invalid rows.');
      error.code = 'ADMIN_USER_LIST_QUERY_FAILED';
      throw error;
    }
    return result.rows;
  }
}
