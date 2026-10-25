import { getDatabaseConfig } from './database.config.js';
import { createCouchDbClient } from '../services/couchdb.client.js';
import { UserRepository } from '../repositories/user.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { CompanyRepository, DepartmentRepository, RecruiterRepository } from '../repositories/organization.repository.js';

export function getAuthDatabaseConfig(environment = process.env) {
  const primaryDatabase = typeof environment.COUCHDB_DATABASE === 'string'
    ? environment.COUCHDB_DATABASE.trim()
    : undefined;
  const authDatabase = typeof environment.AUTH_COUCHDB_DATABASE === 'string'
    ? environment.AUTH_COUCHDB_DATABASE.trim()
    : undefined;
  const database = authDatabase || primaryDatabase;
  const primaryDatabaseOptIn = environment.AUTH_ALLOW_PRIMARY_DATABASE === 'true';
  if (authDatabase && primaryDatabase && authDatabase.toLowerCase() !== primaryDatabase.toLowerCase()) {
    const error = new Error('Auth and domain APIs must use the same CouchDB database.');
    error.code = 'DATABASE_CONFIGURATION_MISMATCH';
    throw error;
  }
  if (
    typeof database !== 'string' ||
    !database ||
    /^(replace_with|change_me|your[-_])/i.test(database) ||
    (database.toLowerCase() === 'recruitment_db' && !primaryDatabaseOptIn)
  ) {
    const error = new Error('Auth persistence requires one configured database; recruitment_db requires AUTH_ALLOW_PRIMARY_DATABASE=true.');
    error.code = 'AUTH_DATABASE_CONFIGURATION_ERROR';
    throw error;
  }
  return getDatabaseConfig({ ...environment, COUCHDB_DATABASE: database });
}

export function createAuthRepositories({ environment = process.env, clientFactory = createCouchDbClient } = {}) {
  const client = clientFactory({ config: getAuthDatabaseConfig(environment) });
  return {
    client,
    users: new UserRepository({ client }),
    candidates: new CandidateRepository({ client }),
    companies: new CompanyRepository({ client }),
    departments: new DepartmentRepository({ client }),
    recruiters: new RecruiterRepository({ client }),
  };
}
