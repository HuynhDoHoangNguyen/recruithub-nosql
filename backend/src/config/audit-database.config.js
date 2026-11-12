import { getDatabaseConfig } from './database.config.js';

export function assertAuditDatabaseName(database, environment = process.env) {
  const businessDatabases = [environment.COUCHDB_DATABASE, environment.AUTH_COUCHDB_DATABASE];
  if (typeof database !== 'string' || !/^recruithub_logs_[a-z0-9_]+$/.test(database)
    || businessDatabases.some(name => name?.trim() === database)) {
    throw Object.assign(new Error('An isolated recruithub_logs_* database is required.'), { code: 'INVALID_AUDIT_DATABASE' });
  }
}

export function getAuditDatabaseConfig(environment = process.env) {
  const database = environment.AUDIT_COUCHDB_DATABASE;
  assertAuditDatabaseName(database, environment);
  if (!environment.AUDIT_COUCHDB_URL || !environment.AUDIT_COUCHDB_USER || !environment.AUDIT_COUCHDB_PASSWORD) {
    throw Object.assign(new Error('Explicit audit database connection and credentials are required.'), { code: 'INVALID_AUDIT_DATABASE' });
  }
  return getDatabaseConfig({
    COUCHDB_DATABASE: database,
    COUCHDB_URL: environment.AUDIT_COUCHDB_URL,
    COUCHDB_USER: environment.AUDIT_COUCHDB_USER,
    COUCHDB_PASSWORD: environment.AUDIT_COUCHDB_PASSWORD,
    COUCHDB_TIMEOUT_MS: environment.AUDIT_COUCHDB_TIMEOUT_MS,
  });
}
