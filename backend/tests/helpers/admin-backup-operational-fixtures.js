import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { fork, spawnSync } from 'node:child_process';
import argon2 from 'argon2';
import { createFixture } from '../recruitment/fixtures.js';
import { userIdFromEmail } from '../../src/utils/id.utils.js';
import { userDocumentSchema } from '../../src/schemas/user.schema.js';

export async function startOperationalServer(env) {
  const child = fork(fileURLToPath(new URL('./admin-backup-operational-server.mjs', import.meta.url)), [], { env, silent: true, windowsHide: true });
  child.stdout.resume(); child.stderr.resume();
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture backend readiness timeout')), 20000);
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Fixture backend exited before ready')); });
    child.once('message', message => { clearTimeout(timer); assert.equal(message.type, 'ready'); resolve(message.port); });
  });
  return { child, origin: `http://127.0.0.1:${port}` };
}

export async function stopOperationalServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.send({ type: 'stop' });
  const timer = setTimeout(() => child.kill(), 10000);
  await exited; clearTimeout(timer);
}

export async function operationalFixture(t) {
  const container = `recruithub-br005b-test-${randomUUID().slice(0, 8)}`;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rhbr-br005b-'));
  const password = randomBytes(24).toString('hex');
  const dockerEnv = { ...process.env, COUCHDB_USER: 'br005_admin', COUCHDB_PASSWORD: randomBytes(32).toString('hex') };
  const docker = args => {
    const result = spawnSync('docker', args, { env: dockerEnv, encoding: 'utf8', windowsHide: true, timeout: 25000 });
    assert.equal(result.status, 0, `Fixture docker ${args[0]} failed`); return result.stdout.trim();
  };
  docker(['run', '-d', '--name', container, '-p', '127.0.0.1::5984', '--env', 'COUCHDB_USER', '--env', 'COUCHDB_PASSWORD', 'couchdb:3.5.2.1']);
  t.after(() => { docker(['stop', container]); t.diagnostic(`Stopped fixture ${container}; retained ${root}`); });
  const couch = `http://${docker(['port', container, '5984/tcp']).split('\n')[0]}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(couch, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Isolated CouchDB ready');
  const headers = { Authorization: `Basic ${Buffer.from(`${dockerEnv.COUCHDB_USER}:${dockerEnv.COUCHDB_PASSWORD}`).toString('base64')}`, 'Content-Type': 'application/json' };
  const couchCall = async (endpoint, method = 'GET', body) => {
    const response = await fetch(couch + endpoint, { method, headers, signal: AbortSignal.timeout(10000), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `Fixture CouchDB ${method} returned ${response.status}`); return response.json();
  };
  const database = 'br005_source_' + randomUUID().replaceAll('-', '');
  await couchCall('/' + database, 'PUT');
  const fixture = createFixture();
  const hash = await argon2.hash(password);
  const users = { admin: fixture.users.admin, candidate: fixture.users.candidate, recruiter: fixture.users.recruiter };
  users.otherAdmin = { ...users.admin, email: 'br005-second-admin@example.invalid', email_normalized: 'br005-second-admin@example.invalid', _id: userIdFromEmail('br005-second-admin@example.invalid') };
  const docs = [...fixture.repo.docs.values(), users.otherAdmin].map(original => {
    const doc = structuredClone(original); delete doc._rev;
    if (doc.type === 'user') { doc.password_hash = hash; userDocumentSchema.parse(doc); }
    return doc;
  });
  const rows = await couchCall(`/${database}/_bulk_docs`, 'POST', { docs }); assert.ok(rows.every(row => row.ok));
  // Only generated fixture secrets enter child env. Never load project .env.
  const env = { ...process.env, COUCHDB_URL: couch, COUCHDB_DATABASE: database, AUTH_COUCHDB_DATABASE: database,
    COUCHDB_USER: dockerEnv.COUCHDB_USER, COUCHDB_PASSWORD: dockerEnv.COUCHDB_PASSWORD,
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'), BACKUP_SIGNING_KEY: randomBytes(48).toString('base64url'),
    BACKUP_SIGNING_KEY_ID: 'br005-test', BR005_SPOOL: path.join(root, 'spool'),
    AUDIT_COUCHDB_URL: '', AUDIT_COUCHDB_DATABASE: '', AUDIT_COUCHDB_USER: '', AUDIT_COUCHDB_PASSWORD: '' };
  let running = await startOperationalServer(env);
  t.after(async () => {
    await stopOperationalServer(running.child);
  });
  const request = (endpoint, { token, body, method = body === undefined ? 'GET' : 'POST', raw = false, headers: suppliedHeaders = {} } = {}) => fetch(running.origin + '/api/v1' + endpoint, {
    method, signal: AbortSignal.timeout(20000), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': raw ? 'application/octet-stream' : 'application/json' }), ...suppliedHeaders },
    ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
  });
  const restart = async () => { await stopOperationalServer(running.child); running = await startOperationalServer(env); };
  const stop = () => stopOperationalServer(running.child);
  return { root, container, database, users, password, request, couchCall, env, restart, stop };
}
