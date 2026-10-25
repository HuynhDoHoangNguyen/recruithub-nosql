import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadBackendEnvironment } from '../../backend/src/config/load-environment.js';
import { getAuthDatabaseConfig } from '../../backend/src/config/auth-database.config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = loadBackendEnvironment({ env: { ...process.env } });
const config = getAuthDatabaseConfig(env);
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.url).hostname)) throw new Error('Local testing only.');
const email = env.LOCAL_TEST_CANDIDATE_EMAIL || 'candidate.test@example.invalid';
const password = env.LOCAL_TEST_CANDIDATE_PASSWORD || `Rh!${randomBytes(18).toString('base64url')}9A`;
const base = `http://127.0.0.1:${env.PORT || 5000}/api/v1`;
async function post(route, body) {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
let login = await post('/auth/login', { email, password });
let created = false;
if (login.status === 401) {
  const envPath = path.join(root, '.env');
  let contents = fs.readFileSync(envPath, 'utf8');
  for (const [key, value] of Object.entries({ LOCAL_TEST_CANDIDATE_EMAIL: email, LOCAL_TEST_CANDIDATE_PASSWORD: password })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    contents = pattern.test(contents) ? contents.replace(pattern, () => `${key}=${value}`) : `${contents.trimEnd()}\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  const registration = await post('/auth/register', { email, password, full_name: 'Ứng viên kiểm thử local',
    candidate_role: 'Backend Developer', industry: 'Công nghệ thông tin', seniority: 'MID', years_experience: 2 });
  if (registration.status !== 201) throw new Error(`Candidate registration stopped (${registration.status}, ${registration.body.error?.code}); existing accounts are never reset.`);
  created = true;
  login = await post('/auth/login', { email, password });
}
if (login.status !== 200 || login.body.data?.user?.role !== 'CANDIDATE') throw new Error('A verified Candidate login is required.');
const profile = await fetch(base + '/candidate/profile/me', { headers: { Authorization: `Bearer ${login.body.data.accessToken}` } });
if (profile.status !== 200) throw new Error('Candidate profile is not available.');
console.log(JSON.stringify({ email, role: 'CANDIDATE', database: config.database, newAccountCreated: created,
  loginStatus: login.status, profileStatus: profile.status, credentialsLocation: '.env: LOCAL_TEST_CANDIDATE_PASSWORD' }));
