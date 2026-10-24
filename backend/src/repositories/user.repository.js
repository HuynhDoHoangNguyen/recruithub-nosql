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
}
