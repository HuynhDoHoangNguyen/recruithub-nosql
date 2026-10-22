/**
 * Unit tests for Stable ID Utilities (DATA-02B.1 Task D)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  userIdFromEmail,
  candidateIdFromResumeId,
  jobIdFromSourceId,
  applicationIdFromPair,
} from '../../src/utils/id.utils.js';

test('ID Utilities - Task D Acceptance Tests', async (t) => {
  await t.test('1. Email different casing and surrounding whitespace generates identical User ID', () => {
    const email1 = 'Candidate.Test@Example.Invalid';
    const email2 = 'candidate.test@example.invalid';
    const email3 = '  candidate.test@example.invalid  ';

    assert.equal(normalizeEmail(email1), 'candidate.test@example.invalid');
    assert.equal(normalizeEmail(email2), 'candidate.test@example.invalid');
    assert.equal(normalizeEmail(email3), 'candidate.test@example.invalid');

    const id1 = userIdFromEmail(email1);
    const id2 = userIdFromEmail(email2);
    const id3 = userIdFromEmail(email3);

    assert.equal(id1, id2);
    assert.equal(id2, id3);
    assert.match(id1, /^user:[a-f0-9]{64}$/);
  });

  await t.test('2. Different emails generate different User IDs', () => {
    const idA = userIdFromEmail('candidate.a@example.invalid');
    const idB = userIdFromEmail('candidate.b@example.invalid');

    assert.notEqual(idA, idB);
  });

  await t.test('3. Candidate/Job source IDs conform to DATA-02A namespace', () => {
    const candidateId = candidateIdFromResumeId('R_000001');
    assert.equal(candidateId, 'candidate:cms:R_000001');

    // Passing already prefixed ID
    assert.equal(candidateIdFromResumeId('candidate:cms:R_000001'), 'candidate:cms:R_000001');

    const jobId = jobIdFromSourceId('J_000001');
    assert.equal(jobId, 'job:cms:J_000001');

    // Passing already prefixed ID
    assert.equal(jobIdFromSourceId('job:cms:J_000001'), 'job:cms:J_000001');

    // Invalid format throws
    assert.throws(() => candidateIdFromResumeId('INVALID_ID'), /Invalid source resume_id format/);
    assert.throws(() => jobIdFromSourceId('INVALID_ID'), /Invalid source job_id format/);
  });

  await t.test('4. Same Candidate–Job pair generates identical Application ID (deterministic)', () => {
    const candidateId = 'candidate:cms:R_000042';
    const jobId = 'job:cms:J_000010';

    const appId1 = applicationIdFromPair(candidateId, jobId);
    const appId2 = applicationIdFromPair(candidateId, jobId);

    assert.equal(appId1, appId2);
    assert.match(appId1, /^application:pair:[a-f0-9]{64}$/);
  });

  await t.test('5. Changing Candidate or Job changes the Application ID', () => {
    const c1 = 'candidate:cms:R_000001';
    const c2 = 'candidate:cms:R_000002';
    const j1 = 'job:cms:J_000001';
    const j2 = 'job:cms:J_000002';

    const app1 = applicationIdFromPair(c1, j1);
    const app2 = applicationIdFromPair(c2, j1);
    const app3 = applicationIdFromPair(c1, j2);

    assert.notEqual(app1, app2);
    assert.notEqual(app1, app3);
    assert.notEqual(app2, app3);
  });

  await t.test('Regression: Email validation rejects malformed inputs', () => {
    assert.throws(() => normalizeEmail(''), /Email cannot be empty/);
    assert.throws(() => normalizeEmail('not-an-email'), /Invalid email format/);
    assert.throws(() => normalizeEmail('@example.com'), /Invalid email format/);
    assert.throws(() => normalizeEmail('test@'), /Invalid email format/);
    assert.throws(() => normalizeEmail(123), /Email must be a string/);
  });
});
