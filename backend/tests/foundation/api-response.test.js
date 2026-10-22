import test from 'node:test';
import assert from 'node:assert/strict';
import { errorResponse, successResponse } from '../../src/utils/api-response.js';

test('provisional response helpers use the documented envelope', () => {
  assert.deepEqual(successResponse({ id: 'candidate:1' }, 'Loaded'), {
    success: true,
    data: { id: 'candidate:1' },
    message: 'Loaded',
  });
  assert.deepEqual(errorResponse('VALIDATION_ERROR', 'Invalid input', [{ path: 'email' }]), {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: [{ path: 'email' }],
    },
  });
});
