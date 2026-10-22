import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import healthRoutes from '../../src/routes/health.routes.js';
import { createDatabaseHealthRouter } from '../../src/routes/database-health.routes.js';
import { CouchDbError } from '../../src/services/couchdb.errors.js';
import { loadBackendEnvironment } from '../../src/config/load-environment.js';

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('database readiness endpoint exposes only allowlisted metadata and preserves health route', async () => {
  const calls = [];
  const app = express();
  app.use('/api/health', healthRoutes);
  app.use('/api/health/database', createDatabaseHealthRouter({
    clientFactory: () => ({
      config: { database: 'recruitment_db', username: 'private-user', password: 'private-password' },
      checkReadiness: async () => {
        calls.push('readiness');
        return {
          ready: true,
          server: { uuid: 'must-not-leak' },
          database: { db_name: 'recruitment_db', doc_count: 25750, sizes: { file: 123 } },
        };
      },
    }),
  }));

  await withServer(app, async (baseUrl) => {
    const oldHealth = await fetch(`${baseUrl}/api/health`);
    assert.equal(oldHealth.status, 200);
    assert.deepEqual(await oldHealth.json(), {
      success: true,
      message: 'RecruiHub Backend is running',
    });

    const readiness = await fetch(`${baseUrl}/api/health/database`);
    assert.equal(readiness.status, 200);
    const body = await readiness.json();
    assert.deepEqual(body, {
      success: true,
      data: { status: 'ready', database: { name: 'recruitment_db', doc_count: 25750 } },
      message: 'CouchDB is ready',
    });
    assert.equal(JSON.stringify(body).includes('must-not-leak'), false);
    assert.equal(JSON.stringify(body).includes('private-password'), false);
    assert.deepEqual(calls, ['readiness']);
  });
});

test('database readiness endpoint returns sanitized temporary failure without crashing the app', async () => {
  const app = express();
  app.use('/api/health/database', createDatabaseHealthRouter({
    clientFactory: () => ({
      checkReadiness: async () => {
        throw new CouchDbError('NETWORK_ERROR', 'CouchDB could not be reached.');
      },
    }),
  }));

  await withServer(app, async (baseUrl) => {
    const unavailable = await fetch(`${baseUrl}/api/health/database`);
    assert.equal(unavailable.status, 503);
    const body = await unavailable.json();
    assert.equal(body.error.code, 'NETWORK_ERROR');
    assert.equal(JSON.stringify(body).includes('private endpoint'), false);
    assert.equal(JSON.stringify(body).includes('password'), false);

    const alive = await fetch(`${baseUrl}/api/health/database`);
    assert.equal(alive.status, 503);
  });
});

test('environment loader uses backend then root files and never overrides process values', (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recruithub-env-'));
  const backendDir = path.join(rootDir, 'backend');
  fs.mkdirSync(backendDir);
  fs.writeFileSync(path.join(rootDir, '.env'), 'SOURCE=root\nROOT_ONLY=root-value\nPARENT=from-root\n', 'utf8');
  fs.writeFileSync(path.join(backendDir, '.env'), 'SOURCE=backend\nBACKEND_ONLY=backend-value\nPARENT=from-backend\n', 'utf8');
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const env = { PARENT: 'process-value' };
  loadBackendEnvironment({ env, backendDir, rootDir });

  assert.deepEqual(env, {
    PARENT: 'process-value',
    SOURCE: 'backend',
    BACKEND_ONLY: 'backend-value',
    ROOT_ONLY: 'root-value',
  });
});

