import { getDatabaseConfig } from '../config/database.config.js';
import {
  CouchDbError,
  couchDbErrorFromNetwork,
  couchDbErrorFromResponse,
} from './couchdb.errors.js';

function encodePathSegment(value) {
  return encodeURIComponent(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class CouchDbClient {
  constructor({
    config = getDatabaseConfig(),
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('A Fetch API implementation is required.');
    }
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async #request(path, {
    method = 'GET',
    body,
    operation = method.toLowerCase(),
    databaseRequest = true,
  } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const headers = { Accept: 'application/json' };

    if (this.config.username !== undefined) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`,
        'utf8',
      ).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      const response = await this.fetchImpl(`${this.config.url}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorPayload;
        try {
          errorPayload = JSON.parse(errorText);
        } catch {
          errorPayload = undefined;
        }
        const missingDatabase =
          response.status === 404 &&
          typeof errorPayload?.reason === 'string' &&
          /database does not exist/i.test(errorPayload.reason);
        throw couchDbErrorFromResponse(response.status, operation, {
          databaseRequest: databaseRequest || missingDatabase,
        });
      }

      if (response.status === 204) return null;
      const responseText = await response.text();
      if (!responseText) return null;
      try {
        return JSON.parse(responseText);
      } catch (cause) {
        throw new CouchDbError(
          'INVALID_RESPONSE',
          'CouchDB returned an invalid JSON response.',
          { status: response.status, operation, cause },
        );
      }
    } catch (error) {
      if (error instanceof CouchDbError) throw error;
      throw couchDbErrorFromNetwork(error, operation, controller.signal.aborted);
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkReadiness() {
    const server = await this.#request('/', {
      operation: 'server-readiness',
      databaseRequest: false,
    });
    const database = await this.getDatabaseInfo();
    return { ready: true, server, database };
  }

  getDatabaseInfo() {
    return this.#request(`/${encodePathSegment(this.config.database)}`, {
      operation: 'database-info',
      databaseRequest: true,
    });
  }

  async getDocument(id) {
    this.assertId(id);
    return this.#request(
      `/${encodePathSegment(this.config.database)}/${encodePathSegment(id)}`,
      { operation: 'get-document', databaseRequest: false },
    );
  }

  async find(query) {
    if (!isObject(query)) throw new TypeError('Mango query must be an object.');
    return this.#request(
      `/${encodePathSegment(this.config.database)}/_find`,
      { method: 'POST', body: query, operation: 'find', databaseRequest: false },
    );
  }

  async createDocument(document) {
    this.assertDocument(document);
    if (typeof document._id !== 'string' || document._id.length === 0) {
      throw new TypeError('Document creation requires a deterministic _id.');
    }
    if (document._rev !== undefined) {
      throw new TypeError('createDocument does not accept _rev; use updateDocument.');
    }
    return this.#request(
      `/${encodePathSegment(this.config.database)}/${encodePathSegment(document._id)}`,
      { method: 'PUT', body: document, operation: 'create-document', databaseRequest: false },
    );
  }

  async updateDocument(document, expectedRev) {
    this.assertDocument(document);
    if (typeof document._id !== 'string' || document._id.length === 0) {
      throw new TypeError('Document update requires a deterministic _id.');
    }
    if (typeof expectedRev !== 'string' || expectedRev.length === 0) {
      throw new TypeError('updateDocument requires the expected _rev.');
    }
    if (document._rev !== undefined && document._rev !== expectedRev) {
      throw new TypeError('Document _rev must match expectedRev.');
    }
    const payload = { ...document, _rev: expectedRev };
    return this.#request(
      `/${encodePathSegment(this.config.database)}/${encodePathSegment(document._id)}`,
      { method: 'PUT', body: payload, operation: 'update-document', databaseRequest: false },
    );
  }

  async exists(id) {
    this.assertId(id);
    try {
      await this.getDocument(id);
      return true;
    } catch (error) {
      if (error instanceof CouchDbError && error.code === 'NOT_FOUND') return false;
      throw error;
    }
  }

  assertId(id) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Document id must be a non-empty string.');
    }
  }

  assertDocument(document) {
    if (!isObject(document)) throw new TypeError('Document must be an object.');
  }
}

export function createCouchDbClient(options) {
  return new CouchDbClient(options);
}

export { CouchDbError };
