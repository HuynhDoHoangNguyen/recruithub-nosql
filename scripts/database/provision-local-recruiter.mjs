// Operator setup for an isolated local account. Never activates historical users.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadBackendEnvironment } from '../../backend/src/config/load-environment.js';
import { getDatabaseConfig } from '../../backend/src/config/database.config.js';
import { getAuthDatabaseConfig } from '../../backend/src/config/auth-database.config.js';
import { JobApplicationRepository } from '../../backend/src/repositories/job-application.repository.js';
import { userDocumentSchema } from '../../backend/src/schemas/user.schema.js';
import { companyDocumentSchema } from '../../backend/src/schemas/company.schema.js';
import { departmentDocumentSchema } from '../../backend/src/schemas/department.schema.js';
import { recruiterDocumentSchema, validateRecruiterOrganizationScope } from '../../backend/src/schemas/recruiter.schema.js';
import { userIdFromEmail } from '../../backend/src/utils/id.utils.js';
import { recruiterIdFromSelfRegistration } from '../../backend/src/utils/recruiter-registration-id.utils.js';
import { PASSWORD_HASH_OPTIONS } from '../../backend/src/services/auth.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argon2 = createRequire(new URL('../../backend/package.json', import.meta.url))('argon2');
const envPath = path.join(root, '.env');
const environment = loadBackendEnvironment({ env: { ...process.env } });
const primary = getDatabaseConfig(environment);
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(primary.url).hostname)) throw new Error('Only local CouchDB is supported.');
if (!fs.existsSync(envPath)) throw new Error('Configure root .env first.');
const authDatabase = environment.AUTH_COUCHDB_DATABASE && !/^(replace_with|change_me|your[-_])/i.test(environment.AUTH_COUCHDB_DATABASE)
  ? environment.AUTH_COUCHDB_DATABASE : 'recruithub_auth_local_test';
if (authDatabase === primary.database || authDatabase === 'recruitment_db') throw new Error('Testing requires a separate database.');
const email = environment.LOCAL_TEST_RECRUITER_EMAIL || 'recruiter.test@example.invalid';
const password = environment.LOCAL_TEST_RECRUITER_PASSWORD || `Rh!${randomBytes(18).toString('base64url')}9A`;
const jwtSecret = environment.JWT_ACCESS_SECRET && environment.JWT_ACCESS_SECRET.length >= 32 && !/^(replace_with|change_me)/i.test(environment.JWT_ACCESS_SECRET)
  ? environment.JWT_ACCESS_SECRET : randomBytes(48).toString('base64url');
const config = getAuthDatabaseConfig({ ...environment, AUTH_COUCHDB_DATABASE: authDatabase });
const authHeader = primary.username ? `Basic ${Buffer.from(`${primary.username}:${primary.password}`).toString('base64')}` : undefined;
async function http(resource, method = 'GET', body) {
  const response = await fetch(`${primary.url}/${resource}`, { method, headers: { ...(authHeader ? { Authorization: authHeader } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`CouchDB operation failed (${response.status}); no credentials logged.`);
  return response.json();
}
const primaryPath = encodeURIComponent(primary.database);
const before = await http(primaryPath);
if (!before) throw new Error('Existing dataset database not found.');
const companyResult = await http(`${primaryPath}/_find`, 'POST', { selector: { type: 'company' }, limit: 1 });
const company = companyDocumentSchema.parse(companyResult?.docs?.[0]);
const departmentResult = await http(`${primaryPath}/_find`, 'POST', { selector: { type: 'department', company_id: company._id }, limit: 1 });
const department = departmentDocumentSchema.parse(departmentResult?.docs?.[0]);
delete company._rev; delete department._rev;
const now = new Date().toISOString();
const provenance = { classification: 'derived', generated: false, transform_version: 'local-recruiter-test-v1' };
const user = userDocumentSchema.parse({ _id: userIdFromEmail(email), type: 'user', email, email_normalized: email.toLowerCase(), role: 'RECRUITER',
  account_status: 'ACTIVE', password_hash: await argon2.hash(password, PASSWORD_HASH_OPTIONS), created_at: now, updated_at: now, provenance });
const recruiter = recruiterDocumentSchema.parse({ _id: recruiterIdFromSelfRegistration(user._id, company._id, department._id), type: 'recruiter',
  user_id: user._id, company_id: company._id, department_id: department._id, created_at: now, updated_at: now, provenance });
if (!validateRecruiterOrganizationScope({ user, recruiter, company, department }).valid) throw new Error('Invalid organization scope.');
if (!await http(encodeURIComponent(authDatabase))) await http(encodeURIComponent(authDatabase), 'PUT');
const repository = new JobApplicationRepository({ ...config, authHeader });
const existingUser = await repository.get(user._id);
if (existingUser && (existingUser.provenance?.transform_version !== provenance.transform_version || existingUser.role !== 'RECRUITER'
  || existingUser.account_status !== 'ACTIVE' || !await argon2.verify(existingUser.password_hash, password))) {
  throw new Error('Existing account cannot be replaced or activated by this setup.');
}
// Preserve credentials before account writes so a partial setup can be reconciled.
let contents = fs.readFileSync(envPath, 'utf8');
const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'recruithub-env-before-local-auth-'));
fs.copyFileSync(envPath, path.join(backup, '.env'));
for (const [key, value] of Object.entries({ AUTH_COUCHDB_DATABASE: authDatabase, JWT_ACCESS_SECRET: jwtSecret,
  LOCAL_TEST_RECRUITER_EMAIL: email, LOCAL_TEST_RECRUITER_PASSWORD: password })) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  contents = pattern.test(contents) ? contents.replace(pattern, () => `${key}=${value}`) : `${contents.trimEnd()}\n${key}=${value}\n`;
}
fs.writeFileSync(envPath, contents, { mode: 0o600 });
for (const document of [company, department, recruiter]) {
  const existing = await repository.get(document._id);
  if (!existing) await repository.put(document);
  else if (document.type === 'recruiter' && (existing.user_id !== user._id || existing.company_id !== company._id || existing.department_id !== department._id)) {
    throw new Error('Existing Recruiter scope differs; operator review is required.');
  }
}
if (!existingUser) await repository.put(user);
await repository.initialize();
const after = await http(primaryPath);
if (after.doc_count !== before.doc_count || after.update_seq !== before.update_seq) throw new Error('Primary database changed during setup; inspect before continuing.');
fs.utimesSync(path.join(root, 'backend/src/server.js'), new Date(), new Date());
console.log(JSON.stringify({ database: authDatabase, email, role: 'RECRUITER', status: 'ACTIVE',
  credentialsLocation: '.env: LOCAL_TEST_RECRUITER_EMAIL / LOCAL_TEST_RECRUITER_PASSWORD', primaryDatabaseUnchanged: true, newAccountCreated: !existingUser }));
