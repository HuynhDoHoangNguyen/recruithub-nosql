import test from 'node:test';
import assert from 'node:assert/strict';
import { backupConfiguration, backupParamsSchema, backupRequestSchema } from '../../src/models/admin-backup.schema.js';
import { BackupSourceRegistry } from '../../src/services/admin-backup-source.service.js';
import { environment } from '../helpers/admin-backup-fixtures.js';

test('backup configuration rejects missing, placeholder, reused keys and invalid key IDs without exposing inputs', () => {
  for (const env of [{}, { ...environment(), BACKUP_SIGNING_KEY: 'short' },
    { ...environment(), BACKUP_SIGNING_KEY_ID: '../escape' },
    { ...environment(), JWT_ACCESS_SECRET: environment().BACKUP_SIGNING_KEY },
    { ...environment(), COUCHDB_PASSWORD: environment().BACKUP_SIGNING_KEY }]) {
    assert.throws(() => backupConfiguration(env), error => error.code === 'BACKUP_CONFIGURATION_ERROR'
      && !error.message.includes(environment().BACKUP_SIGNING_KEY));
  }
  assert.equal(backupConfiguration(environment()).keyId, 'test-v1');
});

test('backup contracts reject unexpected payload fields, arbitrary sources and path-like IDs', () => {
  assert.equal(backupRequestSchema.safeParse({ source_id: 'business' }).success, true);
  for (const body of [{ source_id: 'business', url: 'http://attacker' }, { source_id: '_users' }, {}]) {
    assert.equal(backupRequestSchema.safeParse(body).success, false);
  }
  assert.equal(backupParamsSchema.safeParse({ id: '../job' }).success, false);
});

test('source registry deduplicates valid sources and sanitizes unavailable source configuration', () => {
  const env = { COUCHDB_DATABASE: 'demo', AUTH_COUCHDB_DATABASE: 'demo', COUCHDB_URL: 'http://127.0.0.1:5984',
    COUCHDB_USER: 'private-user', COUCHDB_PASSWORD: 'private-password' };
  const registry = new BackupSourceRegistry(env);
  const entries = registry.list();
  assert.equal(entries[0].available, true);
  assert.equal(entries[1].reason, 'DUPLICATE_SOURCE');
  assert.equal(entries[2].available, false);
  assert.equal(JSON.stringify(entries).includes('private-'), false);
  assert.equal(registry.resolve('business').database, 'demo');
  assert.throws(() => registry.resolve('_users'));
  assert.equal(new BackupSourceRegistry({ ...env, AUTH_COUCHDB_DATABASE: 'other' }).list()[1].available, false);
  assert.equal(new BackupSourceRegistry({ ...env, COUCHDB_DATABASE: '_users' }).list()[0].available, false);
});
