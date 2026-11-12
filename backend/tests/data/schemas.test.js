/**
 * Unit tests for Zod Schemas (DATA-02B.1 Task D)
 * 
 * Verifies Candidate and Job schemas, partial profile semantics,
 * conditional requirements, availability consistency, and staged boundaries.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateDocumentSchema,
  stagedCandidateSchema,
} from '../../src/schemas/candidate.schema.js';
import {
  jobDocumentSchema,
  stagedJobSchema,
} from '../../src/schemas/job.schema.js';
import {
  AVAILABILITY_STATES,
  CANONICAL_DEGREES,
  DOCUMENT_TYPES,
  JOB_STATUSES,
  PROVENANCE_CLASSIFICATIONS,
  REQUIREMENT_STATUSES,
  SENIORITY_LEVELS,
} from '../../src/constants/document.constants.js';

/**
 * Generates a valid base candidate fixture for testing.
 */
function createValidCandidateFixture(overrides = {}) {
  return {
    _id: 'candidate:cms:R_000001',
    type: DOCUMENT_TYPES.CANDIDATE,
    user_id: 'user:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    source_resume_id: 'R_000001',
    profile: {
      role: 'Backend Engineer',
      seniority: SENIORITY_LEVELS.MID,
      industry: 'FinTech',
      years_experience: 4,
      experience_months: 48,
      summary: 'Experienced backend developer focusing on distributed systems.',
    },
    skills: [
      { name: 'Python', normalized: 'python' },
      { name: 'Node.js', normalized: 'node.js' },
      { name: 'Docker', normalized: 'docker' },
    ],
    education: [
      {
        degree: CANONICAL_DEGREES.BACHELOR,
      },
    ],
    experience_summary: {
      bullets: [
        'Built scalable microservices processing 10k req/s.',
        'Optimized database queries and storage schemas.',
        'Integrated third-party payment gateways.',
      ],
    },
    experience: [],
    projects: [],
    data_availability: {
      skills: AVAILABILITY_STATES.AVAILABLE,
      experience: AVAILABILITY_STATES.PARTIAL,
      education: AVAILABILITY_STATES.PARTIAL,
      projects: AVAILABILITY_STATES.UNAVAILABLE,
    },
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SOURCE,
      source_dataset: 'cms-job-resume-v1',
      source_file: 'resumes.parquet',
      source_ids: { resume_id: 'R_000001' },
      transform_version: 'DATA-02B.1',
    },
    ...overrides,
  };
}

/**
 * Generates a valid base job fixture for testing.
 */
function createValidJobFixture(overrides = {}) {
  return {
    _id: 'job:cms:J_000001',
    type: DOCUMENT_TYPES.JOB,
    company_id: 'company:syn:acme-corp',
    department_id: 'department:syn:engineering',
    recruiter_id: 'recruiter:syn:rec-001',
    source_job_id: 'J_000001',
    title: 'Senior Software Engineer',
    seniority: SENIORITY_LEVELS.SENIOR,
    industry: 'FinTech',
    description: 'We are seeking an experienced engineer to lead backend architecture.',
    responsibilities: [
      'Architect robust event-driven microservices.',
      'Mentor junior and mid-level engineers.',
      'Ensure high code quality and test coverage.',
    ],
    requirements: {
      general: ['Bachelor degree or equivalent practical experience.', 'Strong problem-solving skills.'],
      experience: {
        status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED,
        required_months: 60,
      },
      education: {
        status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED,
        minimum_degree: CANONICAL_DEGREES.BACHELOR,
      },
      project: {
        status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
        required_technologies: ['node.js', 'couchdb', 'docker'],
      },
    },
    required_skills: ['node.js', 'docker', 'couchdb'],
    optional_skills: ['kubernetes', 'redis'],
    status: JOB_STATUSES.OPEN,
    deadline: '2026-12-31T23:59:59Z',
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.MIXED,
      source_dataset: 'cms-job-resume-v1',
      source_file: 'jobs.parquet',
      source_ids: { job_id: 'J_000001' },
      transform_version: 'DATA-02B.1',
    },
    ...overrides,
  };
}

test('Zod Schemas - Task D Acceptance Tests', async (t) => {
  await t.test('8. Candidate and Job schemas enforce canonical skill consistency and uniqueness', () => {
    // Alias-equivalent duplicate in Candidate skills
    const candidateDuplicate = createValidCandidateFixture({
      skills: [
        { name: 'NodeJS', normalized: 'node.js' },
        { name: 'node.js', normalized: 'node.js' },
      ],
    });
    const candResult = candidateDocumentSchema.safeParse(candidateDuplicate);
    assert.equal(candResult.success, false);
    assert.match(candResult.error.issues[0].message, /Duplicate normalized skill detected \(canonical collision\)/);

    // Supplied normalized value must match the canonical value derived from name
    const candidateMismatch = createValidCandidateFixture({
      skills: [{ name: 'Python', normalized: 'java' }],
    });
    const mismatchResult = candidateDocumentSchema.safeParse(candidateMismatch);
    assert.equal(mismatchResult.success, false);
    assert.match(mismatchResult.error.issues[0].message, /must equal canonical value "python"/);

    const candidateDistinct = createValidCandidateFixture({
      skills: [
        { name: 'NodeJS', normalized: 'node.js' },
        { name: 'Python', normalized: 'python' },
      ],
    });
    assert.equal(candidateDocumentSchema.safeParse(candidateDistinct).success, true);

    // Alias-equivalent duplicate in Job required_skills
    const jobDuplicateReq = createValidJobFixture({
      required_skills: ['React', 'reactjs'],
    });
    const jobReqResult = jobDocumentSchema.safeParse(jobDuplicateReq);
    assert.equal(jobReqResult.success, false);
    assert.match(jobReqResult.error.issues[0].message, /Duplicate skill in required_skills/);

    // Alias-equivalent duplicate in Job optional_skills
    const jobDuplicateOpt = createValidJobFixture({
      optional_skills: ['Node', 'nodejs'],
    });
    const jobOptResult = jobDocumentSchema.safeParse(jobDuplicateOpt);
    assert.equal(jobOptResult.success, false);
    assert.match(jobOptResult.error.issues[0].message, /Duplicate skill in optional_skills/);
  });

  await t.test('9. Job schema rejects overlap between required_skills and optional_skills', () => {
    const jobOverlap = createValidJobFixture({
      required_skills: ['NodeJS', 'docker', 'couchdb'],
      optional_skills: ['node.js', 'redis'], // alias-equivalent overlap
    });
    const result = jobDocumentSchema.safeParse(jobOverlap);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /cannot be present in both required_skills and optional_skills/);

    const validDistinctJob = createValidJobFixture({
      required_skills: ['NodeJS', 'docker'],
      optional_skills: ['reactjs', 'redis'],
    });
    assert.equal(jobDocumentSchema.safeParse(validDistinctJob).success, true);
  });

  await t.test('TV3-UC19-007: Job project technologies enforce canonical uniqueness without mutating input', () => {
    for (const technologies of [['React', 'reactjs'], ['NodeJS', 'node.js']]) {
      const job = createValidJobFixture({
        requirements: {
          general: ['General requirement.'],
          experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM },
          education: { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
          project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: technologies },
        },
      });
      const original = structuredClone(job);
      const result = jobDocumentSchema.safeParse(job);

      assert.equal(result.success, false);
      const duplicateIssue = result.error.issues.find(issue => issue.message.includes('Duplicate technology'));
      assert.deepEqual(duplicateIssue?.path, ['requirements', 'project', 'required_technologies', 1]);
      assert.deepEqual(job, original);
    }

    const distinctJob = createValidJobFixture({
      requirements: {
        general: ['General requirement.'],
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['React', 'Python'] },
      },
    });
    const originalDistinctJob = structuredClone(distinctJob);
    assert.equal(jobDocumentSchema.safeParse(distinctJob).success, true);
    assert.deepEqual(distinctJob, originalDistinctJob);
  });

  await t.test('10. Candidate partial profile is valid with partial education and summary bullets', () => {
    const candidate = createValidCandidateFixture();
    const result = candidateDocumentSchema.safeParse(candidate);
    assert.equal(result.success, true);

    // Education contains degree only; no institution or field_of_study fabricated
    assert.equal(result.data.education[0].degree, CANONICAL_DEGREES.BACHELOR);
    assert.equal(result.data.education[0].institution, undefined);
    assert.equal(result.data.experience.length, 0);
  });

  await t.test('11. Job requirement REQUIRED missing conditional fields is rejected', () => {
    // Missing required_months when experience is REQUIRED
    const missingExpMonths = createValidJobFixture({
      requirements: {
        general: ['General requirement.'],
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
        project: { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT },
      },
    });
    const resExp = jobDocumentSchema.safeParse(missingExpMonths);
    assert.equal(resExp.success, false);
    assert.match(resExp.error.issues[0].message, /required_months is required/);

    // Missing minimum_degree when education is REQUIRED
    const missingEduDegree = createValidJobFixture({
      requirements: {
        general: ['General requirement.'],
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED },
        project: { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT },
      },
    });
    const resEdu = jobDocumentSchema.safeParse(missingEduDegree);
    assert.equal(resEdu.success, false);
    assert.match(resEdu.error.issues[0].message, /minimum_degree is required/);

    // Missing required_technologies when project is REQUIRED
    const missingProjTech = createValidJobFixture({
      requirements: {
        general: ['General requirement.'],
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED },
      },
    });
    const resProj = jobDocumentSchema.safeParse(missingProjTech);
    assert.equal(resProj.success, false);
    assert.match(resProj.error.issues[0].message, /required_technologies array cannot be empty/);

    // Conditional field provided when status is NO_MINIMUM is rejected
    const invalidExpNoMin = createValidJobFixture({
      requirements: {
        general: ['General requirement.'],
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM, required_months: 12 },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
        project: { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT },
      },
    });
    const resExpNoMin = jobDocumentSchema.safeParse(invalidExpNoMin);
    assert.equal(resExpNoMin.success, false);
    assert.match(resExpNoMin.error.issues[0].message, /must not be provided/);
  });

  await t.test('12. Availability state UNAVAILABLE is preserved and not coerced to 0 or null', () => {
    const candidate = createValidCandidateFixture({
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.PARTIAL,
        education: AVAILABILITY_STATES.PARTIAL,
        projects: AVAILABILITY_STATES.UNAVAILABLE,
      },
      projects: [],
    });
    const result = candidateDocumentSchema.safeParse(candidate);
    assert.equal(result.success, true);
    assert.equal(result.data.data_availability.projects, AVAILABILITY_STATES.UNAVAILABLE);
  });

  await t.test('13. Synthetic project missing provenance or availability inconsistency is rejected', () => {
    // Synthetic project missing provenance
    const candidateMissingProjProv = createValidCandidateFixture({
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.SYNTHETIC,
      },
      projects: [
        {
          name: 'Demo Project',
          technologies: ['node.js'],
          is_synthetic: true, // Missing provenance!
        },
      ],
    });
    const resProv = candidateDocumentSchema.safeParse(candidateMissingProjProv);
    assert.equal(resProv.success, false);
    assert.match(resProv.error.issues[0].message, /Synthetic project items must include item-level provenance/);

    // projects is UNAVAILABLE but projects array contains an item -> reject!
    const candidateUnavailableMismatch = createValidCandidateFixture({
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.UNAVAILABLE,
      },
      projects: [{ name: 'Unexpected Project', technologies: ['python'] }],
    });
    const resUnav = candidateDocumentSchema.safeParse(candidateUnavailableMismatch);
    assert.equal(resUnav.success, false);
    assert.match(resUnav.error.issues[0].message, /projects array must be empty when.*UNAVAILABLE/);

    // projects is NONE_DECLARED but projects array contains an item -> reject!
    const candidateNoneDeclaredMismatch = createValidCandidateFixture({
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.NONE_DECLARED,
      },
      projects: [{ name: 'Undeclared Project', technologies: ['python'] }],
    });
    const resNone = candidateDocumentSchema.safeParse(candidateNoneDeclaredMismatch);
    assert.equal(resNone.success, false);
    assert.match(resNone.error.issues[0].message, /projects array must be empty when.*NONE_DECLARED/);
  });

  await t.test('14. Final Candidate/Job missing required references rejected; Staged schema accepts staged data', () => {
    // Final Candidate missing user_id -> rejected
    const candWithoutUser = createValidCandidateFixture({ user_id: undefined });
    assert.equal(candidateDocumentSchema.safeParse(candWithoutUser).success, false);

    // Staged Candidate without user_id -> accepted!
    const stagedCandResult = stagedCandidateSchema.safeParse(candWithoutUser);
    assert.equal(stagedCandResult.success, true);
    assert.equal(stagedCandResult.data.user_id, undefined);

    // Final Job missing company_id -> rejected
    const jobWithoutCompany = createValidJobFixture({ company_id: undefined });
    assert.equal(jobDocumentSchema.safeParse(jobWithoutCompany).success, false);

    // Staged Job without company_id, department_id, recruiter_id -> accepted!
    const stagedJobWithoutRefs = createValidJobFixture({
      company_id: undefined,
      department_id: undefined,
      recruiter_id: undefined,
    });
    const stagedJobResult = stagedJobSchema.safeParse(stagedJobWithoutRefs);
    assert.equal(stagedJobResult.success, true);
    assert.equal(stagedJobResult.data.company_id, undefined);
  });

  await t.test('15. Legacy/unapproved fields are rejected by .strict() mode', () => {
    // Candidate with legacy / unapproved email field (email belongs only to User)
    const candWithEmail = createValidCandidateFixture({ email: 'fake@example.invalid' });
    assert.equal(candidateDocumentSchema.safeParse(candWithEmail).success, false);

    // Candidate with legacy phone / cv_url
    const candWithCv = createValidCandidateFixture({ cv_url: 'https://example.com/cv.pdf' });
    assert.equal(candidateDocumentSchema.safeParse(candWithCv).success, false);

    // Candidate with legacy match_score
    const candWithScore = createValidCandidateFixture({ match_score: 85 });
    assert.equal(candidateDocumentSchema.safeParse(candWithScore).success, false);

    // Job with legacy requirements.experience_required_months
    const jobWithLegacyExp = createValidJobFixture({
      requirements: {
        general: ['General requirement.'],
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 24 },
        experience_required_months: 24, // Legacy unapproved path
        education: { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM },
        project: { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT },
      },
    });
    assert.equal(jobDocumentSchema.safeParse(jobWithLegacyExp).success, false);

    // Job with legacy job.project instead of job.requirements.project
    const jobWithLegacyProj = createValidJobFixture({ project: { required: true } });
    assert.equal(jobDocumentSchema.safeParse(jobWithLegacyProj).success, false);
  });

  await t.test('16. OPEN Job requires deadline', () => {
    const openJobWithoutDeadline = createValidJobFixture({
      status: JOB_STATUSES.OPEN,
      deadline: undefined,
    });
    const res = jobDocumentSchema.safeParse(openJobWithoutDeadline);
    assert.equal(res.success, false);
    assert.match(res.error.issues[0].message, /An OPEN Job requires a deadline timestamp/);

    // DRAFT Job without deadline is valid
    const draftJobWithoutDeadline = createValidJobFixture({
      status: JOB_STATUSES.DRAFT,
      deadline: undefined,
    });
    assert.equal(jobDocumentSchema.safeParse(draftJobWithoutDeadline).success, true);
  });

  await t.test('17. Candidate and Job require updated_at >= created_at', () => {
    const invalidTimeCandidate = createValidCandidateFixture({
      created_at: '2026-10-21T12:00:00Z',
      updated_at: '2026-10-21T10:00:00Z', // Earlier than created_at
    });
    const candRes = candidateDocumentSchema.safeParse(invalidTimeCandidate);
    assert.equal(candRes.success, false);
    assert.match(candRes.error.issues[0].message, /updated_at cannot be earlier than created_at/);

    const invalidTimeJob = createValidJobFixture({
      created_at: '2026-10-21T12:00:00Z',
      updated_at: '2026-10-21T10:00:00Z', // Earlier than created_at
    });
    const jobRes = jobDocumentSchema.safeParse(invalidTimeJob);
    assert.equal(jobRes.success, false);
    assert.match(jobRes.error.issues[0].message, /updated_at cannot be earlier than created_at/);
  });
});
