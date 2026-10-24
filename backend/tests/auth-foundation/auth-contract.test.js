import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  candidateRegistrationRequestSchema,
  loginRequestSchema,
  validateAuthRequest,
} from '../../src/schemas/auth-request.schema.js';
import { toSafeUserDto } from '../../src/services/auth.service.js';
import { validateBody } from '../../src/middleware/validate-body.js';

test('login DTO validates structure and rejects unknown fields', () => {
  assert.equal(validateAuthRequest(loginRequestSchema, {
    email: 'person@example.com', password: 'provided-secret',
  }).success, true);
  assert.equal(validateAuthRequest(loginRequestSchema, {
    email: 'bad-email', password: 'x', role: 'ADMIN',
  }).success, false);
});

test('Candidate registration DTO cannot choose role or account status', () => {
  assert.equal(validateAuthRequest(candidateRegistrationRequestSchema, {
    email: 'person@example.com', password: 'StrongPass1', full_name: 'Person',
    candidate_role: 'Analyst', industry: 'Technology', seniority: 'JUNIOR', years_experience: 0,
  }).success, true);
  assert.equal(validateAuthRequest(candidateRegistrationRequestSchema, {
    email: 'person@example.com', password: 'StrongPass1', full_name: 'Person',
    candidate_role: 'Analyst', industry: 'Technology', seniority: 'JUNIOR', years_experience: 0,
    role: 'ADMIN', account_status: 'ACTIVE',
  }).success, false);
});

test('safe User DTO excludes credential hash and internal provenance', () => {
  const dto = toSafeUserDto({
    _id: 'user:abc', email: 'person@example.com', role: 'CANDIDATE',
    account_status: 'ACTIVE', created_at: 'now', updated_at: 'now',
    password_hash: 'must-not-escape', provenance: { source_ids: { id: 'private' } },
  });
  assert.deepEqual(dto, {
    id: 'user:abc', email: 'person@example.com', role: 'CANDIDATE',
    account_status: 'ACTIVE', created_at: 'now', updated_at: 'now',
  });
  assert.equal(JSON.stringify(dto).includes('must-not-escape'), false);
});

test('body validation integrates shared error helper without exposing submitted values', async (t) => {
  const app = express();
  app.use(express.json());
  app.post('/validate', validateBody(loginRequestSchema), (req, res) => {
    res.json({ email: req.validatedBody.email });
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', password: 'private-value' }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.deepEqual(body, {
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: null },
  });
  assert.equal(JSON.stringify(body).includes('private-value'), false);
});
