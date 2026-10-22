import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CouchDbError,
  couchDbErrorFromNetwork,
  couchDbErrorFromResponse,
  toApiError,
} from '../../src/services/couchdb.errors.js';

test('CouchDB responses map missing database, missing document and conflicts distinctly', () => {
  assert.equal(couchDbErrorFromResponse(404, 'database-info', { databaseRequest: true }).code, 'DATABASE_NOT_FOUND');
  assert.equal(couchDbErrorFromResponse(404, 'get-document').code, 'NOT_FOUND');
  assert.equal(couchDbErrorFromResponse(409, 'update-document').code, 'CONFLICT');
  assert.equal(couchDbErrorFromResponse(401, 'readiness').code, 'AUTHENTICATION_ERROR');
  assert.equal(couchDbErrorFromResponse(503, 'readiness').code, 'SERVER_ERROR');
});

test('network and timeout errors are distinct and do not include cause text', () => {
  assert.equal(couchDbErrorFromNetwork(new Error('secret endpoint'), 'get').code, 'NETWORK_ERROR');
  assert.equal(couchDbErrorFromNetwork(new Error('private'), 'get', true).code, 'TIMEOUT');
  const mapped = toApiError(new CouchDbError('CONFLICT', 'Revision conflict'));
  assert.equal(mapped.status, 409);
  assert.equal(mapped.body.error.code, 'CONFLICT');
  assert.equal(JSON.stringify(mapped).includes('secret endpoint'), false);
});

test('unknown errors become a sanitized generic API error', () => {
  const mapped = toApiError(new Error('password=never-expose'));
  assert.equal(mapped.status, 500);
  assert.equal(JSON.stringify(mapped).includes('never-expose'), false);
});
