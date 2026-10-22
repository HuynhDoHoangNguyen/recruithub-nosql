/**
 * Unit tests for User & Organization Schemas and Cross-Document Validation (DATA-03.1)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { userDocumentSchema } from '../../src/schemas/user.schema.js';
import { companyDocumentSchema } from '../../src/schemas/company.schema.js';
import { departmentDocumentSchema } from '../../src/schemas/department.schema.js';
import {
  recruiterDocumentSchema,
  validateRecruiterOrganizationScope,
} from '../../src/schemas/recruiter.schema.js';
import { candidateDocumentSchema } from '../../src/schemas/candidate.schema.js';
import {
  DOCUMENT_TYPES,
  PROVENANCE_CLASSIFICATIONS,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../../src/constants/document.constants.js';
import {
  normalizeEmail,
  userIdFromEmail,
} from '../../src/utils/id.utils.js';

/**
 * Fixture factory for valid synthetic User
 */
function createValidUserFixture(overrides = {}) {
  const email = 'alex.chen@example.invalid';
  const email_normalized = normalizeEmail(email);
  return {
    _id: userIdFromEmail(email_normalized),
    type: DOCUMENT_TYPES.USER,
    email,
    email_normalized,
    role: USER_ROLES.CANDIDATE,
    account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: 'recruithub:data:v1:20261021',
      generator_version: 'DATA-03.1',
    },
    ...overrides,
  };
}

/**
 * Fixture factory for valid synthetic Company
 */
function createValidCompanyFixture(overrides = {}) {
  return {
    _id: 'company:syn:a1b2c3d4e5f6071829304152',
    type: DOCUMENT_TYPES.COMPANY,
    name: 'Nexus Dynamics Fictional',
    industry: 'Technology',
    website: 'https://nexusdynamics.example.invalid',
    address: '100 Innovation Way, Tech City',
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: 'recruithub:data:v1:20261021',
      generator_version: 'DATA-03.1',
    },
    ...overrides,
  };
}

/**
 * Fixture factory for valid synthetic Department
 */
function createValidDepartmentFixture(overrides = {}) {
  return {
    _id: 'department:syn:b2c3d4e5f607182930415263',
    type: DOCUMENT_TYPES.DEPARTMENT,
    company_id: 'company:syn:a1b2c3d4e5f6071829304152',
    name: 'Engineering',
    key: 'engineering',
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: 'recruithub:data:v1:20261021',
      generator_version: 'DATA-03.1',
    },
    ...overrides,
  };
}

/**
 * Fixture factory for valid synthetic Recruiter
 */
function createValidRecruiterFixture(overrides = {}) {
  return {
    _id: 'recruiter:syn:c3d4e5f60718293041526374',
    type: DOCUMENT_TYPES.RECRUITER,
    user_id: 'user:1111111111111111111111111111111111111111111111111111111111111111',
    company_id: 'company:syn:a1b2c3d4e5f6071829304152',
    department_id: 'department:syn:b2c3d4e5f607182930415263',
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: 'recruithub:data:v1:20261021',
      generator_version: 'DATA-03.1',
    },
    ...overrides,
  };
}

test('DATA-03.1: User Schema Acceptance Tests', async (t) => {
  await t.test('1. Valid synthetic User passes schema validation', () => {
    const fixture = createValidUserFixture();
    const result = userDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('2. User _id not matching email hash is rejected', () => {
    const fixture = createValidUserFixture({
      _id: 'user:0000000000000000000000000000000000000000000000000000000000000000',
    });
    const result = userDocumentSchema.safeParse(fixture);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /User _id .* does not match SHA-256 of email_normalized/);
  });

  await t.test('3. Canonical email changed while _id unchanged is rejected', () => {
    const originalFixture = createValidUserFixture();
    const modifiedFixture = {
      ...originalFixture,
      email: 'different.email@example.invalid',
      email_normalized: 'different.email@example.invalid',
      // _id kept as original
    };
    const result = userDocumentSchema.safeParse(modifiedFixture);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /User _id .* does not match SHA-256 of email_normalized/);
  });

  await t.test('4. Synthetic User missing valid email or not using example.invalid domain is rejected', () => {
    // Non-example.invalid domain
    const nonInvalidDomain = 'candidate@gmail.com';
    const norm = normalizeEmail(nonInvalidDomain);
    const fixtureBadDomain = createValidUserFixture({
      email: nonInvalidDomain,
      email_normalized: norm,
      _id: userIdFromEmail(norm),
    });
    const resBadDomain = userDocumentSchema.safeParse(fixtureBadDomain);
    assert.equal(resBadDomain.success, false);
    assert.match(resBadDomain.error.issues[0].message, /Synthetic User email must use domain "example.invalid"/);

    // Malformed email
    const fixtureMalformed = createValidUserFixture({
      email: 'not-an-email',
      email_normalized: 'not-an-email',
    });
    const resMalformed = userDocumentSchema.safeParse(fixtureMalformed);
    assert.equal(resMalformed.success, false);
  });

  await t.test('5. Synthetic User missing generator seed/version is rejected', () => {
    const missingSeed = createValidUserFixture({
      provenance: {
        classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
        generator_version: 'DATA-03.1',
      },
    });
    const resSeed = userDocumentSchema.safeParse(missingSeed);
    assert.equal(resSeed.success, false);
    assert.match(resSeed.error.issues[0].message, /Synthetic User provenance must include non-empty generator_seed/);

    const missingVersion = createValidUserFixture({
      provenance: {
        classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
        generator_seed: 'recruithub:data:v1:20261021',
      },
    });
    const resVersion = userDocumentSchema.safeParse(missingVersion);
    assert.equal(resVersion.success, false);
    assert.match(resVersion.error.issues[0].message, /Synthetic User provenance must include non-empty generator_version/);
  });

  await t.test('6. Seeded User ACTIVE without credentials is rejected; RESET_REQUIRED accepted', () => {
    const activeWithoutCreds = createValidUserFixture({
      account_status: USER_ACCOUNT_STATUSES.ACTIVE,
      password_hash: undefined,
    });
    const resActive = userDocumentSchema.safeParse(activeWithoutCreds);
    assert.equal(resActive.success, false);
    assert.match(resActive.error.issues[0].message, /Seeded User without credentials cannot have account_status ACTIVE/);

    // RESET_REQUIRED without credentials is valid
    const resetWithoutCreds = createValidUserFixture({
      account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
      password_hash: undefined,
    });
    const resReset = userDocumentSchema.safeParse(resetWithoutCreds);
    assert.equal(resReset.success, true);

    // ACTIVE with valid hash is valid
    const activeWithHash = createValidUserFixture({
      account_status: USER_ACCOUNT_STATUSES.ACTIVE,
      password_hash: '$2b$12$e8Y4J/3U2kXk1Xf6y8.xxeJ83eN4xQoE5s.1y4k3X8n1f7o0X8y2a',
    });
    const resActiveWithHash = userDocumentSchema.safeParse(activeWithHash);
    assert.equal(resActiveWithHash.success, true);
  });

  await t.test('7. Plaintext password inside password_hash or as extra field is rejected', () => {
    // Obvious plaintext inside password_hash
    const trivialPassword = createValidUserFixture({
      account_status: USER_ACCOUNT_STATUSES.ACTIVE,
      password_hash: 'password123',
    });
    const resTrivial = userDocumentSchema.safeParse(trivialPassword);
    assert.equal(resTrivial.success, false);
    assert.match(resTrivial.error.issues[0].message, /password_hash must be a secure hash, not a plaintext password/);

    // Plaintext password field rejected by strict mode
    const extraPasswordField = createValidUserFixture({
      password: 'PlaintextSecretPassword!',
    });
    const resExtra = userDocumentSchema.safeParse(extraPasswordField);
    assert.equal(resExtra.success, false);
  });

  await t.test('8. Incorrect ID prefix and wrong timestamp ordering are rejected', () => {
    // Incorrect prefix
    const badPrefix = createValidUserFixture({
      _id: 'recruiter:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
    const resPrefix = userDocumentSchema.safeParse(badPrefix);
    assert.equal(resPrefix.success, false);

    // updated_at < created_at
    const badTimestamp = createValidUserFixture({
      created_at: '2026-10-21T12:00:00Z',
      updated_at: '2026-10-21T10:00:00Z',
    });
    const resTimestamp = userDocumentSchema.safeParse(badTimestamp);
    assert.equal(resTimestamp.success, false);
    assert.match(resTimestamp.error.issues[0].message, /updated_at cannot be earlier than created_at/);
  });
});

test('DATA-03.1: Company Schema Acceptance Tests', async (t) => {
  await t.test('9. Valid Company passes schema validation', () => {
    const fixture = createValidCompanyFixture();
    const result = companyDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('10. Synthetic Company missing provenance is rejected', () => {
    const noProvenance = createValidCompanyFixture();
    delete noProvenance.provenance;
    const resNoProv = companyDocumentSchema.safeParse(noProvenance);
    assert.equal(resNoProv.success, false);

    const missingSeed = createValidCompanyFixture({
      provenance: {
        classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
        generator_version: 'DATA-03.1',
      },
    });
    const resSeed = companyDocumentSchema.safeParse(missingSeed);
    assert.equal(resSeed.success, false);
    assert.match(resSeed.error.issues[0].message, /Synthetic Company provenance must include non-empty generator_seed/);
  });

  await t.test('11. Company with incorrect ID prefix or unknown fields is rejected', () => {
    const badPrefix = createValidCompanyFixture({
      _id: 'department:syn:123456789012345678901234',
    });
    const resPrefix = companyDocumentSchema.safeParse(badPrefix);
    assert.equal(resPrefix.success, false);

    const unknownFields = createValidCompanyFixture({
      legacy_tax_id: 'US-9999999',
    });
    const resUnknown = companyDocumentSchema.safeParse(unknownFields);
    assert.equal(resUnknown.success, false);
  });
});

test('DATA-03.1: Department Schema Acceptance Tests', async (t) => {
  await t.test('12. Valid Department passes schema validation', () => {
    const fixture = createValidDepartmentFixture();
    const result = departmentDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('13. Department with invalid company_id prefix or invalid key format is rejected', () => {
    const badCompanyRef = createValidDepartmentFixture({
      company_id: 'dept:syn:111111111111111111111111',
    });
    const resCompanyRef = departmentDocumentSchema.safeParse(badCompanyRef);
    assert.equal(resCompanyRef.success, false);

    const badKey = createValidDepartmentFixture({
      key: 'Engineering Dept! With Spaces',
    });
    const resKey = departmentDocumentSchema.safeParse(badKey);
    assert.equal(resKey.success, false);
    assert.match(resKey.error.issues[0].message, /Department key must be lower-case alphanumeric slug/);
  });
});

test('DATA-03.1: Recruiter Schema Acceptance Tests', async (t) => {
  await t.test('14. Valid Recruiter passes schema validation', () => {
    const fixture = createValidRecruiterFixture();
    const result = recruiterDocumentSchema.safeParse(fixture);
    assert.equal(result.success, true);
  });

  await t.test('15. Recruiter missing required references is rejected', () => {
    const noUser = createValidRecruiterFixture();
    delete noUser.user_id;
    assert.equal(recruiterDocumentSchema.safeParse(noUser).success, false);

    const noCompany = createValidRecruiterFixture();
    delete noCompany.company_id;
    assert.equal(recruiterDocumentSchema.safeParse(noCompany).success, false);

    const noDept = createValidRecruiterFixture();
    delete noDept.department_id;
    assert.equal(recruiterDocumentSchema.safeParse(noDept).success, false);
  });

  await t.test('16. Recruiter rejecting unapproved fields: email, jobs array, and full_name at root', () => {
    // Email belongs only to User
    const withEmail = createValidRecruiterFixture({
      email: 'recruiter@example.invalid',
    });
    assert.equal(recruiterDocumentSchema.safeParse(withEmail).success, false);

    // Growing jobs array prohibited
    const withJobs = createValidRecruiterFixture({
      jobs: ['job:cms:J_000001', 'job:cms:J_000002'],
    });
    assert.equal(recruiterDocumentSchema.safeParse(withJobs).success, false);

    // full_name at root is prohibited (Rule D)
    const withFullName = createValidRecruiterFixture({
      full_name: 'John Recruiter',
    });
    assert.equal(recruiterDocumentSchema.safeParse(withFullName).success, false);
  });

  await t.test('17. Candidate schema also rejects duplicate canonical email', () => {
    const candidateWithEmail = {
      _id: 'candidate:cms:R_000001',
      type: DOCUMENT_TYPES.CANDIDATE,
      user_id: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      email: 'candidate@example.invalid', // unapproved top-level field!
      profile: {
        role: 'Engineer',
        seniority: 'MID',
        industry: 'Tech',
        years_experience: 3,
        experience_months: 36,
      },
      skills: [{ name: 'Go', normalized: 'go' }],
      education: [],
      experience: [],
      projects: [],
      data_availability: {
        skills: 'AVAILABLE',
        experience: 'UNAVAILABLE',
        education: 'UNAVAILABLE',
        projects: 'UNAVAILABLE',
      },
      created_at: '2026-10-21T10:00:00Z',
      updated_at: '2026-10-21T10:00:00Z',
      provenance: {
        classification: 'source',
        source_dataset: 'cms-job-resume-v1',
      },
    };
    const res = candidateDocumentSchema.safeParse(candidateWithEmail);
    assert.equal(res.success, false);
  });
});

test('DATA-03.1: Cross-Document Validation (Rule E)', async (t) => {
  const user = createValidUserFixture({
    _id: 'user:1111111111111111111111111111111111111111111111111111111111111111',
    role: USER_ROLES.RECRUITER,
    email: 'recruiter.jane@example.invalid',
    email_normalized: 'recruiter.jane@example.invalid',
  });
  // Update _id to match normalized email
  const userNormalized = normalizeEmail('recruiter.jane@example.invalid');
  const validUserId = userIdFromEmail(userNormalized);
  user.email_normalized = userNormalized;
  user._id = validUserId;

  const company = createValidCompanyFixture({
    _id: 'company:syn:aaaaaaaaaaaaaaaaaaaaaaaa',
  });

  const department = createValidDepartmentFixture({
    _id: 'department:syn:bbbbbbbbbbbbbbbbbbbbbbbb',
    company_id: company._id,
  });

  const recruiter = createValidRecruiterFixture({
    _id: 'recruiter:syn:cccccccccccccccccccccccc',
    user_id: user._id,
    company_id: company._id,
    department_id: department._id,
  });

  await t.test('18. Valid cross-document references and roles pass pure validation', () => {
    const res = validateRecruiterOrganizationScope({ recruiter, company, department, user });
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  await t.test('19. Recruiter pointing to correct Department but different Company is rejected', () => {
    const otherCompany = createValidCompanyFixture({
      _id: 'company:syn:999999999999999999999999',
    });
    const mismatchedRecruiter = {
      ...recruiter,
      company_id: otherCompany._id, // Points to otherCompany, but department belongs to original company!
    };

    const res = validateRecruiterOrganizationScope({
      recruiter: mismatchedRecruiter,
      company: otherCompany,
      department,
      user,
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.some((err) => err.includes('Scoping violation: department.company_id')));
  });

  await t.test('20. Recruiter pointing to wrong User ID is rejected', () => {
    const wrongUserRecruiter = {
      ...recruiter,
      user_id: 'user:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    };

    const res = validateRecruiterOrganizationScope({
      recruiter: wrongUserRecruiter,
      company,
      department,
      user,
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.some((err) => err.includes('Reference mismatch: recruiter.user_id')));
  });

  await t.test('21. User with CANDIDATE role referenced as Recruiter is rejected', () => {
    const candidateUser = {
      ...user,
      role: USER_ROLES.CANDIDATE,
    };

    const res = validateRecruiterOrganizationScope({
      recruiter,
      company,
      department,
      user: candidateUser,
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.some((err) => err.includes('Role invariant violated: referenced User role must be RECRUITER')));
  });

  await t.test('22. Malformed input document shape is caught before reference equality', () => {
    const malformedRecruiter = {
      ...recruiter,
      _id: 'bad:prefix:123',
    };

    const res = validateRecruiterOrganizationScope({
      recruiter: malformedRecruiter,
      company,
      department,
      user,
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.some((err) => err.includes('Invalid recruiter shape')));
  });

  await t.test('23. Pure validator functions in memory without asserting CouchDB foreign keys', () => {
    // Works with plain in-memory objects, returns result object without throwing when throwOnError is false
    const res = validateRecruiterOrganizationScope({ recruiter, company, department, user });
    assert.equal(typeof res.valid, 'boolean');
    assert.ok(Array.isArray(res.errors));

    // Throws with meaningful message when throwOnError is true
    assert.throws(() => {
      validateRecruiterOrganizationScope({
        recruiter: { ...recruiter, user_id: 'user:0000000000000000000000000000000000000000000000000000000000000000' },
        company,
        department,
        user,
      }, { throwOnError: true });
    }, /Recruiter organization scope validation failed/);
  });
});
