import { getAuthDatabaseConfig } from '../../backend/src/config/auth-database.config.js';
import { JobApplicationRepository } from '../../backend/src/repositories/job-application.repository.js';
import { provisionAuditSource } from '../../backend/src/repositories/job-application-audit-source.repository.js';

try {
  const config = getAuthDatabaseConfig();
  const worker = process.env.AUDIT_SOURCE_COUCHDB_USER;
  if (!config.username || !config.password || !worker || !/^[A-Za-z0-9_.-]{1,100}$/.test(worker) || worker === config.username) {
    throw new Error('Separate CouchDB provisioner and audit source worker accounts are required.');
  }
  const authHeader = 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64');
  const repository = new JobApplicationRepository({ ...config, authHeader });
  await provisionAuditSource(repository, worker);
  console.log('Audit source view and write guard are provisioned for Application, Job and User.');
} catch {
  console.error('AUDIT_SOURCE_PROVISION_FAILED');
  process.exitCode = 1;
}
