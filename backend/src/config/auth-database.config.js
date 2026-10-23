import { getDatabaseConfig } from './database.config.js';
import { createCouchDbClient } from '../services/couchdb.client.js';
import { UserRepository } from '../repositories/user.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';

export function getAuthDatabaseConfig(environment = process.env) {
  const database = environment.AUTH_COUCHDB_DATABASE;
  if (
    typeof database !== 'string' ||
    !database.trim() ||
    /^(replace_with|change_me|your[-_])/i.test(database) ||
    database.trim().toLowerCase() === 'recruitment_db'
  ) {
    const error = new Error('Auth persistence requires an explicitly configured isolated database.');
    error.code = 'AUTH_DATABASE_CONFIGURATION_ERROR';
    throw error;
  }
  return getDatabaseConfig({ ...environment, COUCHDB_DATABASE: database.trim() });
}

export function createAuthRepositories({ environment = process.env, clientFactory = createCouchDbClient } = {}) {
  const client = clientFactory({ config: getAuthDatabaseConfig(environment) });
  return {
    users: new UserRepository({ client }),
    candidates: new CandidateRepository({ client }),
  };
}
