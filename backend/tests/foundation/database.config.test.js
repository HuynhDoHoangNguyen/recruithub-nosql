import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabaseConfig } from '../../src/config/database.config.js';

test('database config provides safe local defaults without credentials', () => {
  assert.deepEqual(getDatabaseConfig({}), {
    url: 'http://127.0.0.1:5984',
    database: 'recruitment_db',
    username: undefined,
    password: undefined,
    timeoutMs: 5000,
  });
});

test('database config accepts separated credentials and timeout', () => {
  const config = getDatabaseConfig({
    COUCHDB_URL: 'https://couch.example.test/',
    COUCHDB_DATABASE: 'recruitment_db',
    COUCHDB_USER: 'local-user',
    COUCHDB_PASSWORD: 'not-printed',
    COUCHDB_TIMEOUT_MS: '1200',
  });
  assert.equal(config.url, 'https://couch.example.test');
  assert.equal(config.database, 'recruitment_db');
  assert.equal(config.username, 'local-user');
  assert.equal(config.timeoutMs, 1200);
});

test('database config rejects embedded credentials, invalid database and partial credential pairs', () => {
  assert.throws(
    () => getDatabaseConfig({ COUCHDB_URL: 'http://user:secret@127.0.0.1:5984' }),
    (error) => error.code === 'INVALID_DATABASE_CONFIG' && !error.message.includes('secret'),
  );
  assert.throws(() => getDatabaseConfig({ COUCHDB_DATABASE: 'UpperCase' }), {
    code: 'INVALID_DATABASE_CONFIG',
  });
  assert.throws(() => getDatabaseConfig({ COUCHDB_USER: 'user' }), {
    code: 'INVALID_DATABASE_CONFIG',
  });
});
