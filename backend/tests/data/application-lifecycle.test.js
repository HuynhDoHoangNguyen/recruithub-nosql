/**
 * Unit tests for Application Lifecycle, State Machine & Job Eligibility (DATA-03.3A)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applicationDocumentSchema } from '../../src/schemas/application.schema.js';
import {
  APPLICATION_STAGES,
  DOCUMENT_TYPES,
  JOB_STATUSES,
  PROVENANCE_CLASSIFICATIONS,
  USER_ROLES,
} from '../../src/constants/document.constants.js';
import {
  isValidStageTransition,
  validateStageHistory,
  isJobEligibleForApplication,
  validateApplicationCreationScope,
  STAGE_ACTOR_ROLES,
  TERMINAL_STAGES,
} from '../../src/utils/application-lifecycle.utils.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';

/**
 * Fixture generator for a valid APPLIED Application document
 */
function createValidApplicationFixture(overrides = {}) {
  const candidate_id = 'candidate:cms:R_000001';
  const job_id = 'job:cms:J_000001';
  const _id = applicationIdFromPair(candidate_id, job_id);
  const applied_at = '2026-10-21T10:00:00Z';

  return {
    _id,
    type: DOCUMENT_TYPES.APPLICATION,
    candidate_id,
    job_id,
    current_stage: APPLICATION_STAGES.APPLIED,
    stage_history: [
      {
        from_stage: null,
        to_stage: APPLICATION_STAGES.APPLIED,
        timestamp: applied_at,
        actor_role: STAGE_ACTOR_ROLES.CANDIDATE,
        actor_id: 'user:1111111111111111111111111111111111111111111111111111111111111111',
      },
    ],
    applied_at,
    updated_at: applied_at,
    provenance: {
      classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
      generator_seed: 'recruithub:data:v1:20261021',
      generator_version: 'DATA-03.3A',
    },
    ...overrides,
  };
}

/**
 * Fixture generator for a valid Job
 */
function createValidJobFixture(overrides = {}) {
  return {
    _id: 'job:cms:J_000001',
    type: DOCUMENT_TYPES.JOB,
    status: JOB_STATUSES.OPEN,
    deadline: '2026-11-21T00:00:00Z',
    company_id: 'company:syn:aaaaaaaaaaaaaaaaaaaaaaaa',
    department_id: 'department:syn:bbbbbbbbbbbbbbbbbbbbbbbb',
    recruiter_id: 'recruiter:syn:cccccccccccccccccccccccc',
    ...overrides,
  };
}

test('DATA-03.3A: Application Schema & Identity Acceptance Tests', async (t) => {
  await t.test('1. Stable Application ID: same Candidate–Job pair generates identical ID', () => {
    const cId = 'candidate:cms:R_000001';
    const jId = 'job:cms:J_000001';

    const id1 = applicationIdFromPair(cId, jId);
    const id2 = applicationIdFromPair(cId, jId);
    assert.equal(id1, id2);
    assert.match(id1, /^application:pair:[a-f0-9]{64}$/);
  });

  await t.test('2. Application _id mismatch with Candidate–Job pair is rejected', () => {
    const badIdFixture = createValidApplicationFixture({
      _id: 'application:pair:0000000000000000000000000000000000000000000000000000000000000000',
    });
    const result = applicationDocumentSchema.safeParse(badIdFixture);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /does not match canonical pair hash/);
  });

  await t.test('3. APPLIED initialization: first event must be null -> APPLIED with timestamp === applied_at', () => {
    const validApp = createValidApplicationFixture();
    assert.equal(applicationDocumentSchema.safeParse(validApp).success, true);

    // Initial event from_stage not null
    const badInitialFrom = createValidApplicationFixture({
      stage_history: [
        {
          from_stage: APPLICATION_STAGES.APPLIED,
          to_stage: APPLICATION_STAGES.APPLIED,
          timestamp: '2026-10-21T10:00:00Z',
          actor_role: STAGE_ACTOR_ROLES.CANDIDATE,
        },
      ],
    });
    const resBadFrom = applicationDocumentSchema.safeParse(badInitialFrom);
    assert.equal(resBadFrom.success, false);
    assert.match(resBadFrom.error.issues[0].message, /First stage event must have from_stage = null/);

    // Initial timestamp mismatch with applied_at
    const timestampMismatch = createValidApplicationFixture({
      applied_at: '2026-10-21T10:00:00Z',
      stage_history: [
        {
          from_stage: null,
          to_stage: APPLICATION_STAGES.APPLIED,
          timestamp: '2026-10-21T11:00:00Z', // Mismatch!
          actor_role: STAGE_ACTOR_ROLES.CANDIDATE,
        },
      ],
      updated_at: '2026-10-21T11:00:00Z',
    });
    const resMismatch = applicationDocumentSchema.safeParse(timestampMismatch);
    assert.equal(resMismatch.success, false);
    assert.match(resMismatch.error.issues[0].message, /First stage event timestamp .* must equal applied_at/);
  });

  await t.test('4. Legacy fields "status" and "match_score" are strictly rejected', () => {
    const withStatus = createValidApplicationFixture({ status: 'APPLIED' });
    assert.equal(applicationDocumentSchema.safeParse(withStatus).success, false);

    const withMatchScore = createValidApplicationFixture({ match_score: 95.5 });
    assert.equal(applicationDocumentSchema.safeParse(withMatchScore).success, false);
  });

  await t.test('5. updated_at after final stage event due to metadata update is valid', () => {
    const metadataUpdatedApp = createValidApplicationFixture({
      recruiter_note: 'Updated candidate review note after screening',
      updated_at: '2026-10-21T12:00:00Z', // later than initial event 10:00:00Z
    });
    const result = applicationDocumentSchema.safeParse(metadataUpdatedApp);
    assert.equal(result.success, true);
  });

  await t.test('6. updated_at earlier than final stage event is rejected', () => {
    const invalidUpdatedAtApp = createValidApplicationFixture({
      updated_at: '2026-10-21T09:00:00Z', // earlier than initial event 10:00:00Z!
    });
    const result = applicationDocumentSchema.safeParse(invalidUpdatedAtApp);
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /cannot be earlier than the last stage event timestamp/);
  });
});

test('DATA-03.3A: 12 Approved Stage Transitions Acceptance Tests', async (t) => {
  await t.test('7. Transition 1: null -> APPLIED by CANDIDATE or SYSTEM is valid', () => {
    assert.equal(isValidStageTransition(null, APPLICATION_STAGES.APPLIED, STAGE_ACTOR_ROLES.CANDIDATE).valid, true);
    assert.equal(isValidStageTransition(null, APPLICATION_STAGES.APPLIED, STAGE_ACTOR_ROLES.SYSTEM).valid, true);
    assert.equal(isValidStageTransition(null, APPLICATION_STAGES.APPLIED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('8. Transition 2: APPLIED -> SCREENING by RECRUITER is valid', () => {
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.SCREENING, STAGE_ACTOR_ROLES.RECRUITER).valid, true);
    // Invalid actor: Candidate cannot move to screening
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.SCREENING, STAGE_ACTOR_ROLES.CANDIDATE).valid, false);
  });

  await t.test('9. Transitions 3, 6, 9: REJECTED transitions require reason code', () => {
    // APPLIED -> REJECTED
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER, { reasonCode: 'SCREENING_REJECTED' }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);

    // SCREENING -> REJECTED
    assert.equal(isValidStageTransition(APPLICATION_STAGES.SCREENING, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER, { reasonCode: 'SCREENING_REJECTED' }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.SCREENING, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);

    // INTERVIEW -> REJECTED
    assert.equal(isValidStageTransition(APPLICATION_STAGES.INTERVIEW, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER, { reasonCode: 'INTERVIEW_FAILED' }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.INTERVIEW, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('10. Transitions 4, 7, 10: WITHDRAWN transitions permitted from APPLIED, SCREENING, INTERVIEW by CANDIDATE', () => {
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.WITHDRAWN, STAGE_ACTOR_ROLES.CANDIDATE).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.SCREENING, APPLICATION_STAGES.WITHDRAWN, STAGE_ACTOR_ROLES.CANDIDATE).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.INTERVIEW, APPLICATION_STAGES.WITHDRAWN, STAGE_ACTOR_ROLES.CANDIDATE).valid, true);

    // Recruiter cannot impersonate candidate withdrawal
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.WITHDRAWN, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('11. Transition 5: SCREENING -> INTERVIEW by RECRUITER is valid', () => {
    assert.equal(isValidStageTransition(APPLICATION_STAGES.SCREENING, APPLICATION_STAGES.INTERVIEW, STAGE_ACTOR_ROLES.RECRUITER).valid, true);
  });

  await t.test('12. Transition 8: INTERVIEW -> OFFER requires evidence', () => {
    const validEvidence = { interview_id: 'interview:test:1', round: 1 };
    assert.equal(isValidStageTransition(APPLICATION_STAGES.INTERVIEW, APPLICATION_STAGES.OFFER, STAGE_ACTOR_ROLES.RECRUITER, { evidence: validEvidence }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.INTERVIEW, APPLICATION_STAGES.OFFER, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('13. Transition 11: OFFER -> HIRED requires acceptance evidence', () => {
    const validEvidence = { accepted_at: '2026-10-21T15:00:00Z', method: 'ELECTRONIC_SIGNATURE' };
    assert.equal(isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.HIRED, STAGE_ACTOR_ROLES.RECRUITER, { evidence: validEvidence }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.HIRED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('14. Transition 12: OFFER -> REJECTED requires reason code (e.g. OFFER_DECLINED, OFFER_EXPIRED)', () => {
    assert.equal(isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER, { reasonCode: 'OFFER_DECLINED' }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER, { reasonCode: 'OFFER_EXPIRED' }).valid, true);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.REJECTED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('15. Forbidden transition: OFFER -> WITHDRAWN is explicitly prohibited (Rule 110)', () => {
    const result = isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.WITHDRAWN, STAGE_ACTOR_ROLES.CANDIDATE);
    assert.equal(result.valid, false);
    assert.match(result.error, /Candidate withdrawal is prohibited in OFFER stage/);
  });

  await t.test('16. Forbidden transitions: Stage skips and backward transitions are rejected', () => {
    // Stage skips
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.INTERVIEW, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.APPLIED, APPLICATION_STAGES.OFFER, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.SCREENING, APPLICATION_STAGES.HIRED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);

    // Backward transitions
    assert.equal(isValidStageTransition(APPLICATION_STAGES.SCREENING, APPLICATION_STAGES.APPLIED, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.INTERVIEW, APPLICATION_STAGES.SCREENING, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
    assert.equal(isValidStageTransition(APPLICATION_STAGES.OFFER, APPLICATION_STAGES.INTERVIEW, STAGE_ACTOR_ROLES.RECRUITER).valid, false);
  });

  await t.test('17. Terminal states (HIRED, REJECTED, WITHDRAWN) cannot transition further', () => {
    for (const term of TERMINAL_STAGES) {
      for (const target of Object.values(APPLICATION_STAGES)) {
        const res = isValidStageTransition(term, target, STAGE_ACTOR_ROLES.RECRUITER);
        assert.equal(res.valid, false);
        assert.match(res.error, /Cannot transition from terminal stage/);
      }
    }
  });
});

test('DATA-03.3A: Stage History Ordering & Contiguity Acceptance Tests', async (t) => {
  const appliedAt = '2026-10-21T10:00:00Z';

  await t.test('18. Valid progression APPLIED -> SCREENING -> INTERVIEW -> OFFER -> HIRED passes', () => {
    const history = [
      { from_stage: null, to_stage: APPLICATION_STAGES.APPLIED, timestamp: appliedAt, actor_role: STAGE_ACTOR_ROLES.CANDIDATE },
      { from_stage: APPLICATION_STAGES.APPLIED, to_stage: APPLICATION_STAGES.SCREENING, timestamp: '2026-10-21T11:00:00Z', actor_role: STAGE_ACTOR_ROLES.RECRUITER },
      { from_stage: APPLICATION_STAGES.SCREENING, to_stage: APPLICATION_STAGES.INTERVIEW, timestamp: '2026-10-21T12:00:00Z', actor_role: STAGE_ACTOR_ROLES.RECRUITER },
      { from_stage: APPLICATION_STAGES.INTERVIEW, to_stage: APPLICATION_STAGES.OFFER, timestamp: '2026-10-21T13:00:00Z', actor_role: STAGE_ACTOR_ROLES.RECRUITER, evidence: { round: 1 } },
      { from_stage: APPLICATION_STAGES.OFFER, to_stage: APPLICATION_STAGES.HIRED, timestamp: '2026-10-21T14:00:00Z', actor_role: STAGE_ACTOR_ROLES.RECRUITER, evidence: { accepted: true } },
    ];

    const result = validateStageHistory(history, appliedAt, APPLICATION_STAGES.HIRED, '2026-10-21T14:00:00Z');
    assert.equal(result.valid, true);
  });

  await t.test('19. Disconnected chain (event[i].from_stage !== event[i-1].to_stage) is rejected', () => {
    const brokenChain = [
      { from_stage: null, to_stage: APPLICATION_STAGES.APPLIED, timestamp: appliedAt, actor_role: STAGE_ACTOR_ROLES.CANDIDATE },
      { from_stage: APPLICATION_STAGES.SCREENING, to_stage: APPLICATION_STAGES.INTERVIEW, timestamp: '2026-10-21T11:00:00Z', actor_role: STAGE_ACTOR_ROLES.RECRUITER }, // Disconnected!
    ];

    const result = validateStageHistory(brokenChain, appliedAt, APPLICATION_STAGES.INTERVIEW, '2026-10-21T11:00:00Z');
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /Broken stage history chain at event 1/);
  });

  await t.test('20. Decreasing or equal timestamps in history are rejected', () => {
    const nonMonotonic = [
      { from_stage: null, to_stage: APPLICATION_STAGES.APPLIED, timestamp: appliedAt, actor_role: STAGE_ACTOR_ROLES.CANDIDATE },
      { from_stage: APPLICATION_STAGES.APPLIED, to_stage: APPLICATION_STAGES.SCREENING, timestamp: appliedAt, actor_role: STAGE_ACTOR_ROLES.RECRUITER }, // Same timestamp!
    ];

    const result = validateStageHistory(nonMonotonic, appliedAt, APPLICATION_STAGES.SCREENING, appliedAt);
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /is not strictly greater than previous event/);
  });

  await t.test('21. Valid chain with unauthorized actor is rejected', () => {
    const badActor = [
      { from_stage: null, to_stage: APPLICATION_STAGES.APPLIED, timestamp: appliedAt, actor_role: STAGE_ACTOR_ROLES.CANDIDATE },
      // Candidate attempting to move to SCREENING (must be Recruiter)
      { from_stage: APPLICATION_STAGES.APPLIED, to_stage: APPLICATION_STAGES.SCREENING, timestamp: '2026-10-21T11:00:00Z', actor_role: STAGE_ACTOR_ROLES.CANDIDATE },
    ];

    const result = validateStageHistory(badActor, appliedAt, APPLICATION_STAGES.SCREENING, '2026-10-21T11:00:00Z');
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /Actor role "CANDIDATE" is not permitted/);
  });
});

test('DATA-03.3A: Job Application Eligibility Acceptance Tests (Rule F)', async (t) => {
  const appliedAt = '2026-10-21T10:00:00Z';

  await t.test('22. OPEN Job before deadline with organization references is eligible', () => {
    const eligibleJob = createValidJobFixture();
    const result = isJobEligibleForApplication(eligibleJob, appliedAt);
    assert.equal(result.eligible, true);
  });

  await t.test('23. Job in DRAFT status cannot receive Application', () => {
    const draftJob = createValidJobFixture({ status: JOB_STATUSES.DRAFT });
    const result = isJobEligibleForApplication(draftJob, appliedAt);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /Only OPEN jobs can receive applications/);
  });

  await t.test('24. Job in CLOSED status cannot receive Application', () => {
    const closedJob = createValidJobFixture({ status: JOB_STATUSES.CLOSED });
    const result = isJobEligibleForApplication(closedJob, appliedAt);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /Only OPEN jobs can receive applications/);
  });

  await t.test('25. Application submitted after Job deadline is rejected', () => {
    const expiredJob = createValidJobFixture({
      deadline: '2026-10-20T00:00:00Z', // Deadline was yesterday!
    });
    const result = isJobEligibleForApplication(expiredJob, appliedAt);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /Application time .* is past the job deadline/);
  });

  await t.test('26. Job missing organization references is rejected', () => {
    const noCompany = createValidJobFixture({ company_id: undefined });
    assert.equal(isJobEligibleForApplication(noCompany, appliedAt).eligible, false);

    const noDept = createValidJobFixture({ department_id: undefined });
    assert.equal(isJobEligibleForApplication(noDept, appliedAt).eligible, false);

    const noRecruiter = createValidJobFixture({ recruiter_id: undefined });
    assert.equal(isJobEligibleForApplication(noRecruiter, appliedAt).eligible, false);
  });

  await t.test('27. Cross-document creation validator rejects mismatched Candidate User ownership', () => {
    const job = createValidJobFixture();
    const candidate = {
      _id: 'candidate:cms:R_000001',
      user_id: 'user:1111111111111111111111111111111111111111111111111111111111111111',
    };
    const wrongUser = {
      _id: 'user:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      role: USER_ROLES.CANDIDATE,
    };

    const result = validateApplicationCreationScope({ candidate, job, user: wrongUser, appliedAt });
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /Candidate ownership mismatch/);
  });
});
