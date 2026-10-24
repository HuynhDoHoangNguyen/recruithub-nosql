import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccessToken, removeAccessToken, setAccessToken } from '../../src/utils/authHelper.js';

test('access token is held in memory and local logout clears it', () => {
  removeAccessToken();
  assert.equal(getAccessToken(), null);
  setAccessToken('test-token');
  assert.equal(getAccessToken(), 'test-token');
  removeAccessToken();
  assert.equal(getAccessToken(), null);
});
