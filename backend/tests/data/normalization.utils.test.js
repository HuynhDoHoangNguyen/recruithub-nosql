/**
 * Unit tests for Normalization & Canonical Hashing Utilities (DATA-02B.1 Task D)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSkill,
  normalizeDegree,
  canonicalHash,
} from '../../src/utils/normalization.utils.js';
import { CANONICAL_DEGREES } from '../../src/constants/document.constants.js';

test('Normalization Utilities - Task D Acceptance Tests', async (t) => {
  await t.test('6. Skill normalization is deterministic with alias mapping', () => {
    // Basic trimming, lowercasing, and collapsing internal whitespace
    assert.equal(normalizeSkill('  JavaScript  '), 'javascript');
    assert.equal(normalizeSkill('REST   APIs'), 'rest apis');
    assert.equal(normalizeSkill('  A/B   Testing  '), 'a/b testing');

    // Versioned alias mapping
    assert.equal(normalizeSkill('  React.js  '), 'react');
    assert.equal(normalizeSkill('reactjs'), 'react');
    assert.equal(normalizeSkill('node'), 'node.js');
    assert.equal(normalizeSkill('NodeJS'), 'node.js');
    assert.equal(normalizeSkill('Golang'), 'go');
    assert.equal(normalizeSkill('postgres'), 'postgresql');
    assert.equal(normalizeSkill('k8s'), 'kubernetes');

    // Custom alias map support
    const customMap = { 'vue.js': 'vue' };
    assert.equal(normalizeSkill('Vue.js', customMap), 'vue');

    // Input error handling
    assert.throws(() => normalizeSkill(''), /Skill cannot be empty/);
    assert.throws(() => normalizeSkill('   '), /Skill cannot be empty/);
    assert.throws(() => normalizeSkill(null), /Skill must be a string/);
  });

  await t.test('7. Degree normalization matches approved DATA-02A mappings', () => {
    assert.equal(normalizeDegree('BSc'), CANONICAL_DEGREES.BACHELOR);
    assert.equal(normalizeDegree('BA'), CANONICAL_DEGREES.BACHELOR);
    assert.equal(normalizeDegree('Bachelor'), CANONICAL_DEGREES.BACHELOR);
    assert.equal(normalizeDegree("Bachelor's"), CANONICAL_DEGREES.BACHELOR);

    assert.equal(normalizeDegree('MSc'), CANONICAL_DEGREES.MASTER);
    assert.equal(normalizeDegree('MBA'), CANONICAL_DEGREES.MASTER);
    assert.equal(normalizeDegree('Master'), CANONICAL_DEGREES.MASTER);

    assert.equal(normalizeDegree('High School'), CANONICAL_DEGREES.HIGH_SCHOOL);
    assert.equal(normalizeDegree('high_school'), CANONICAL_DEGREES.HIGH_SCHOOL);
    assert.equal(normalizeDegree('secondary'), CANONICAL_DEGREES.HIGH_SCHOOL);

    assert.equal(normalizeDegree('PhD'), CANONICAL_DEGREES.DOCTORATE);
    assert.equal(normalizeDegree('Doctorate'), CANONICAL_DEGREES.DOCTORATE);

    // Direct canonical input
    assert.equal(normalizeDegree('BACHELOR'), CANONICAL_DEGREES.BACHELOR);

    // Unrecognized or invalid
    assert.throws(() => normalizeDegree('Unknown Degree'), /Unrecognized degree/);
    assert.throws(() => normalizeDegree(''), /Degree cannot be empty/);
    assert.throws(() => normalizeDegree(undefined), /Degree must be a string/);
  });

  await t.test('Regression: Canonical hashing is deterministic across object key order', () => {
    const obj1 = { z: 'last', a: 1, m: { nested_b: 2, nested_a: 1 } };
    const obj2 = { a: 1, m: { nested_a: 1, nested_b: 2 }, z: 'last' };

    const hash1 = canonicalHash(obj1);
    const hash2 = canonicalHash(obj2);

    assert.equal(hash1, hash2);
    assert.match(hash1, /^[a-f0-9]{64}$/);
  });

  await t.test('Regression: Canonical hashing preserves array order (does not sort arrays)', () => {
    const listA = [1, 2, 3];
    const listB = [3, 2, 1];

    const hashA = canonicalHash(listA);
    const hashB = canonicalHash(listB);

    assert.notEqual(hashA, hashB);

    const docA = { stages: ['APPLIED', 'SCREENING'] };
    const docB = { stages: ['SCREENING', 'APPLIED'] };

    assert.notEqual(canonicalHash(docA), canonicalHash(docB));
  });
});
