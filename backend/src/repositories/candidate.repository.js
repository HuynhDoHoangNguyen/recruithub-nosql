import { candidateDocumentSchema } from '../schemas/candidate.schema.js';
import { DOCUMENT_TYPES } from '../constants/document.constants.js';
import { BaseRepository } from './base.repository.js';

/** Candidate persistence adapter. Authorization and profile policy stay in services. */
export class CandidateRepository extends BaseRepository {
  constructor({ client } = {}) {
    super({ client, schema: candidateDocumentSchema });
  }

  /**
   * Find candidate documents referencing a User. This Mango query may need an
   * approved index before production use; it is not executed by construction.
   */
  findByUserId(userId) {
    if (typeof userId !== 'string' || !/^user:[a-f0-9]{64}$/.test(userId)) {
      throw new TypeError('findByUserId requires a canonical User document ID.');
    }
    return this.find({ type: DOCUMENT_TYPES.CANDIDATE, user_id: userId }, { limit: 2 });
  }

  listByIdPrefix(options) {
    return this.client.listDocumentsByIdPrefix('candidate:', options);
  }
}
