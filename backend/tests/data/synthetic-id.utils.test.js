/**
 * Unit tests for Deterministic Synthetic ID Utilities (DATA-03.1 / Rule A)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  companyIdFromKey,
  companyIdFromNaturalKey,
  departmentIdFromKey,
  departmentIdFromNaturalKey,
  recruiterIdFromNaturalKey,
  computeSyntheticDigest,
  DEFAULT_SYNTHETIC_SEED,
} from '../../src/utils/synthetic-id.utils.js';

test('Synthetic ID Utilities - DATA-03.1 Acceptance Tests', async (t) => {
  await t.test('1. Exact canonical serialization and digest derivation (Rule A)', () => {
    const seed = 'recruithub:data:v1:20261021';
    const industry = 'technology';
    const ordinal = 1;

    // Manual canonical derivation according to Rule A formula
    const canonicalKey = JSON.stringify([seed, industry, ordinal]);
    const payload = `recruithub:data:v1|company|${canonicalKey}`;
    const expectedDigest = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
    const expectedId = `company:syn:${expectedDigest}`;

    const computedId = companyIdFromKey({ seed, industry, ordinal });
    assert.equal(computedId, expectedId);
    assert.match(computedId, /^company:syn:[a-f0-9]{24}$/);
  });

  await t.test('2. Same Company natural key and seed produces identical ID', () => {
    const compA = companyIdFromKey({ industry: 'FinTech', ordinal: 42, seed: 'test-seed' });
    const compB = companyIdFromKey({ industry: 'fintech', ordinal: 42, seed: 'test-seed' });

    assert.equal(compA, compB);
    assert.match(compA, /^company:syn:[a-f0-9]{24}$/);
  });

  await t.test('3. Changing seed or Company ordinal produces different ID', () => {
    const base = companyIdFromKey({ industry: 'FinTech', ordinal: 1, seed: 'seed-1' });
    const diffSeed = companyIdFromKey({ industry: 'FinTech', ordinal: 1, seed: 'seed-2' });
    const diffOrdinal = companyIdFromKey({ industry: 'FinTech', ordinal: 2, seed: 'seed-1' });
    const diffIndustry = companyIdFromKey({ industry: 'HealthCare', ordinal: 1, seed: 'seed-1' });

    assert.notEqual(base, diffSeed);
    assert.notEqual(base, diffOrdinal);
    assert.notEqual(base, diffIndustry);
  });

  await t.test('4. Positional and object arguments for companyIdFromKey produce identical results', () => {
    const fromObj = companyIdFromKey({ industry: 'Retail', ordinal: 5 });
    const fromPos = companyIdFromKey('Retail', 5);
    const fromNat = companyIdFromNaturalKey({ industry: 'Retail', ordinal: 5 });

    assert.equal(fromObj, fromPos);
    assert.equal(fromObj, fromNat);
  });

  await t.test('5. Same Department key + Company produces identical ID', () => {
    const companyId = 'company:syn:a1b2c3d4e5f6071829304152';
    const dept1 = departmentIdFromKey(companyId, 'Engineering');
    const dept2 = departmentIdFromKey(companyId, 'engineering');
    const dept3 = departmentIdFromNaturalKey({ companyId, departmentKey: 'engineering' });

    assert.equal(dept1, dept2);
    assert.equal(dept2, dept3);
    assert.match(dept1, /^department:syn:[a-f0-9]{24}$/);
  });

  await t.test('6. Same Department key at different Company produces different ID', () => {
    const company1 = 'company:syn:111111111111111111111111';
    const company2 = 'company:syn:222222222222222222222222';

    const deptA = departmentIdFromKey(company1, 'engineering');
    const deptB = departmentIdFromKey(company2, 'engineering');

    assert.notEqual(deptA, deptB);
  });

  await t.test('7. Recruiter with same references produces stable, deterministic ID', () => {
    const refs = {
      userId: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      companyId: 'company:syn:111111111111111111111111',
      departmentId: 'department:syn:222222222222222222222222',
    };

    const rec1 = recruiterIdFromNaturalKey(refs);
    const rec2 = recruiterIdFromNaturalKey(refs);

    assert.equal(rec1, rec2);
    assert.match(rec1, /^recruiter:syn:[a-f0-9]{24}$/);
  });

  await t.test('8. Recruiter with different user_id or department produces different ID', () => {
    const base = recruiterIdFromNaturalKey({
      userId: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      companyId: 'company:syn:111111111111111111111111',
      departmentId: 'department:syn:222222222222222222222222',
    });

    const diffUser = recruiterIdFromNaturalKey({
      userId: 'user:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      companyId: 'company:syn:111111111111111111111111',
      departmentId: 'department:syn:222222222222222222222222',
    });

    const diffDept = recruiterIdFromNaturalKey({
      userId: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      companyId: 'company:syn:111111111111111111111111',
      departmentId: 'department:syn:333333333333333333333333',
    });

    assert.notEqual(base, diffUser);
    assert.notEqual(base, diffDept);
  });

  await t.test('9. Delimiter collision prevention: structured JSON serialization does not collide', () => {
    // String concat "comp1" + "2" vs "comp" + "12" would collide with naive delimiter
    const deptA = departmentIdFromKey('company:syn:10', 'engineering');
    const deptB = departmentIdFromKey('company:syn:1', '0engineering');

    assert.notEqual(deptA, deptB);
  });

  await t.test('10. Error cases and argument validation', () => {
    // Missing industry
    assert.throws(() => companyIdFromKey({ ordinal: 1 }), /Company industry must be a non-empty string/);
    // Negative ordinal
    assert.throws(() => companyIdFromKey({ industry: 'tech', ordinal: -1 }), /Company ordinal must be a non-negative integer/);
    // Invalid companyId prefix for department
    assert.throws(() => departmentIdFromKey('invalid:id', 'eng'), /Expected prefix "company:"/);
    // Invalid userId prefix for recruiter
    assert.throws(() => recruiterIdFromNaturalKey({
      userId: 'bad:user',
      companyId: 'company:syn:1',
      departmentId: 'department:syn:1',
    }), /Expected prefix "user:"/);
    // Invalid companyId prefix for recruiter
    assert.throws(() => recruiterIdFromNaturalKey({
      userId: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      companyId: 'bad:company',
      departmentId: 'department:syn:1',
    }), /Expected prefix "company:"/);
    // Invalid departmentId prefix for recruiter
    assert.throws(() => recruiterIdFromNaturalKey({
      userId: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      companyId: 'company:syn:1',
      departmentId: 'bad:dept',
    }), /Expected prefix "department:"/);
  });
});
