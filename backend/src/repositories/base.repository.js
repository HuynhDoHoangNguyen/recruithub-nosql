import { ZodError } from 'zod';
import { newDocumentProvenanceSchema } from '../schemas/common.schema.js';

export class RepositoryValidationError extends Error {
  constructor(issues) {
    super('Document does not satisfy its configured schema.');
    this.name = 'RepositoryValidationError';
    this.code = 'DOCUMENT_VALIDATION_FAILED';
    this.issues = issues;
  }
}

export class BaseRepository {
  constructor({ client, schema } = {}) {
    if (!client) throw new TypeError('BaseRepository requires a CouchDbClient-compatible client.');
    this.client = client;
    this.schema = schema;
  }

  async getById(id) {
    return this.client.getDocument(id);
  }

  async find(selector, options = {}) {
    if (!selector || typeof selector !== 'object' || Array.isArray(selector)) {
      throw new TypeError('find requires a Mango selector object.');
    }
    const query = { ...options, selector };
    return this.client.find(query);
  }

  async listByIdPrefix(prefix, options = {}) {
    if (typeof this.client.listDocumentsByIdPrefix !== 'function') {
      throw new TypeError('The configured client does not support ID-prefix scans.');
    }
    return this.client.listDocumentsByIdPrefix(prefix, options);
  }

  async create(document) {
    this.validate(document);
    this.validateNewProvenance(document);
    return this.client.createDocument(document);
  }

  async update(document, expectedRev) {
    this.validate(document);
    if (!expectedRev) throw new TypeError('update requires expectedRev.');
    return this.client.updateDocument(document, expectedRev);
  }

  async exists(id) {
    return this.client.exists(id);
  }

  async getDatabaseInfo() {
    return this.client.getDatabaseInfo();
  }

  validate(document) {
    if (!this.schema) return;
    const result = this.schema.safeParse(document);
    if (!result.success) {
      const issues = result.error instanceof ZodError ? result.error.issues : [];
      throw new RepositoryValidationError(issues);
    }
  }

  validateNewProvenance(document) {
    if (document?.provenance === undefined) return;
    const result = newDocumentProvenanceSchema.safeParse(document.provenance);
    if (!result.success) {
      const issues = result.error instanceof ZodError ? result.error.issues : [];
      throw new RepositoryValidationError(issues);
    }
  }
}

