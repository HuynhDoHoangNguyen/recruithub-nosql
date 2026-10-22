import { Router } from 'express';
import { createCouchDbClient } from '../services/couchdb.client.js';
import { toApiError } from '../services/couchdb.errors.js';
import { successResponse } from '../utils/api-response.js';

export function createDatabaseHealthRouter({ clientFactory = createCouchDbClient } = {}) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const client = clientFactory();
      const readiness = await client.checkReadiness();
      const database = readiness.database;
      return res.status(200).json(successResponse({
        status: 'ready',
        database: {
          name: database.db_name ?? client.config.database,
          doc_count: database.doc_count,
        },
      }, 'CouchDB is ready'));
    } catch (error) {
      const mapped = toApiError(error);
      if (error?.code === 'INVALID_DATABASE_CONFIG') mapped.status = 503;
      return res.status(mapped.status).json(mapped.body);
    }
  });

  return router;
}

export default createDatabaseHealthRouter();
