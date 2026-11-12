// Operator setup for a local Admin account. Writing to the primary database
// requires an explicit one-process opt-in in addition to AUTH_ALLOW_PRIMARY_DATABASE.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadBackendEnvironment } from '../../backend/src/config/load-environment.js';
import { getDatabaseConfig } from '../../backend/src/config/database.config.js';
import { getAuthDatabaseConfig } from '../../backend/src/config/auth-database.config.js';
import { userDocumentSchema } from '../../backend/src/schemas/user.schema.js';
import { userIdFromEmail, normalizeEmail } from '../../backend/src/utils/id.utils.js';
import { PASSWORD_HASH_OPTIONS } from '../../backend/src/services/auth.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argon2 = createRequire(new URL('../../backend/package.json', import.meta.url))('argon2');
const envPath = path.join(root, '.env');
const environment = loadBackendEnvironment({ env: { ...process.env } });
const primary = getDatabaseConfig(environment);

if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(primary.url).hostname)) {
  throw new Error('Only local CouchDB is supported.');
}
if (!fs.existsSync(envPath)) throw new Error('Configure root .env first.');

const authDatabase = environment.AUTH_COUCHDB_DATABASE && !/^(replace_with|change_me|your[-_])/i.test(environment.AUTH_COUCHDB_DATABASE)
  ? environment.AUTH_COUCHDB_DATABASE : 'recruithub_auth_demo';

const targetsPrimaryDatabase = authDatabase === primary.database;
const primaryWriteOptIn = environment.LOCAL_TEST_ADMIN_ALLOW_PRIMARY_DATABASE === 'true'
  && environment.AUTH_ALLOW_PRIMARY_DATABASE === 'true';

if ((targetsPrimaryDatabase || authDatabase === 'recruitment_db') && !primaryWriteOptIn) {
  throw new Error('Primary database provisioning requires LOCAL_TEST_ADMIN_ALLOW_PRIMARY_DATABASE=true and AUTH_ALLOW_PRIMARY_DATABASE=true.');
}

const email = environment.LOCAL_TEST_ADMIN_EMAIL || environment.TV1_DEMO_ADMIN_EMAIL;
const password = environment.LOCAL_TEST_ADMIN_PASSWORD || environment.TV1_DEMO_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error('Set LOCAL_TEST_ADMIN_EMAIL/PASSWORD or TV1_DEMO_ADMIN_EMAIL/PASSWORD in the environment.');
}

const authHeader = primary.username ? `Basic ${Buffer.from(`${primary.username}:${primary.password}`).toString('base64')}` : undefined;

async function http(resource, method = 'GET', body) {
  const response = await fetch(`${primary.url}/${resource}`, {
    method,
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
      'Content-Type': 'application/json'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`CouchDB operation failed (${response.status}) on ${resource}`);
  return response.json();
}

// Ensure auth database exists
if (!await http(encodeURIComponent(authDatabase))) {
  await http(encodeURIComponent(authDatabase), 'PUT');
}

const userId = userIdFromEmail(email);
const existing = await http(`${encodeURIComponent(authDatabase)}/${encodeURIComponent(userId)}`);

let passwordMatches = false;
if (existing) {
  if (existing.type !== 'user' || existing.role !== 'ADMIN') {
    throw new Error('A document already exists for this email and is not an Admin user; refusing to change its role.');
  }
  try {
    passwordMatches = Boolean(existing.password_hash && await argon2.verify(existing.password_hash, password));
  } catch {
    passwordMatches = false;
  }
  if (existing.account_status === 'ACTIVE' && passwordMatches) {
    console.log(JSON.stringify({ database: authDatabase, email, role: 'ADMIN', status: 'ACTIVE', created: false, unchanged: true, success: true }));
    process.exit(0);
  }
  if (environment.LOCAL_TEST_ADMIN_RESET_PASSWORD !== 'true') {
    throw new Error('Admin exists but is inactive or has a different password; set LOCAL_TEST_ADMIN_RESET_PASSWORD=true to explicitly update it.');
  }
}

const now = new Date().toISOString();
const provenance = { classification: 'derived', generated: false, transform_version: 'local-admin-test-v1' };

const userDoc = userDocumentSchema.parse({
  _id: userId,
  ...(existing?._rev ? { _rev: existing._rev } : {}),
  type: 'user',
  email,
  email_normalized: normalizeEmail(email),
  role: 'ADMIN',
  account_status: 'ACTIVE',
  password_hash: passwordMatches ? existing.password_hash : await argon2.hash(password, PASSWORD_HASH_OPTIONS),
  created_at: existing?.created_at || now,
  updated_at: now,
  provenance
});

await http(`${encodeURIComponent(authDatabase)}/${encodeURIComponent(userId)}`, 'PUT', userDoc);

// Persist credentials only when explicitly supplied as LOCAL_TEST_* overrides.
// Existing TV1_DEMO_* values remain the source otherwise; never print passwords.
if (environment.LOCAL_TEST_ADMIN_EMAIL || environment.LOCAL_TEST_ADMIN_PASSWORD) {
  let contents = fs.readFileSync(envPath, 'utf8');
  const entries = {
    LOCAL_TEST_ADMIN_EMAIL: email,
    LOCAL_TEST_ADMIN_PASSWORD: password,
  };
  for (const [key, val] of Object.entries(entries)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    contents = pattern.test(contents) ? contents.replace(pattern, () => `${key}=${val}`) : `${contents.trimEnd()}\n${key}=${val}\n`;
  }
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
}

console.log(JSON.stringify({
  database: authDatabase,
  email,
  role: 'ADMIN',
  status: 'ACTIVE',
  created: !existing,
  updated: Boolean(existing),
  credentialsLocation: environment.LOCAL_TEST_ADMIN_EMAIL || environment.LOCAL_TEST_ADMIN_PASSWORD
    ? '.env: LOCAL_TEST_ADMIN_EMAIL / LOCAL_TEST_ADMIN_PASSWORD'
    : '.env: TV1_DEMO_ADMIN_EMAIL / TV1_DEMO_ADMIN_PASSWORD',
  success: true
}));
