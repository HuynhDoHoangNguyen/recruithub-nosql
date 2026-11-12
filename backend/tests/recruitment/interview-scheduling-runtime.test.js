/**
 * TV3-UC17-001: Interview Scheduling Runtime Test Suite
 *
 * Verifies all 26 test vectors for interview scheduling domain service:
 *  1. createInterviewRequestSchema accepts valid payload and normalises scheduled_at to UTC ISO.
 *  2. createInterviewRequestSchema rejects invalid application_id formats.
 *  3. createInterviewRequestSchema rejects non-positive or non-integer round.
 *  4. createInterviewRequestSchema rejects unapproved interview_type.
 *  5. createInterviewRequestSchema rejects scheduled_at without timezone offset.
 *  6. createInterviewRequestSchema strictly rejects extra server/completion fields.
 *  7. listInterviewsQuerySchema accepts valid application_id and strictly rejects extra fields.
 *  8. InterviewService constructor validates repository contract.
 *  9. create() rejects non-recruiter roles with 403 ApiError('FORBIDDEN').
 * 10. create() rejects inactive recruiter with 403 ApiError('FORBIDDEN').
 * 11. create() rejects non-existent application and non-application document with 404.
 * 12. create() rejects recruiter who does not own the Job with 403 ApiError('FORBIDDEN').
 * 13. create() rejects application NOT in INTERVIEW stage with 422 ApiError('INVALID_APPLICATION_STAGE').
 * 14. create() rejects scheduled_at before the timestamp application entered INTERVIEW stage.
 * 15. create() for 0 interviews requires round: 1; round: 2 throws 422 ApiError('INVALID_ROUND').
 * 16. create() allows sequential round: 1 then round: 2; rejects round gap with 422.
 * 17. Attempt isolation: application on attempt 2 ignores attempt 1 interviews for sequence.
 * 18. Stored document has deterministic _id, attempt, references, timestamps, and provenance.
 * 19. Return safe DTO excludes _rev, candidate_id, job_id, interviewer_id, completion, and provenance.
 * 20. Idempotent identical retry returns created: false, idempotent: true with 0 extra writes.
 * 21. Divergent retry with same round but different type/time throws 409 ApiError('INTERVIEW_CONTENT_CONFLICT').
 * 22. CouchDB 409 conflict recovery during put() recovers if winner is semantically equal.
 * 23. CouchDB 409 conflict during put() throws 409 if winner is divergent.
 * 24. Existing document with corrupted schema, reference mismatch, or attempt mismatch throws 409.
 * 25. list() enforces RBAC & ownership; filters to current attempt; sorts ascending; computes next_round.
 * 26. list() throws 409 on corrupted stored interview or invalid round sequence (gaps/duplicates).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { baseTime, createFixture } from './fixtures.js';
import { applicationIdFromPair } from '../../src/utils/id.utils.js';
import {
  interviewIdFromRound,
  APPROVED_INTERVIEW_TYPES,
  validateInterviewCreationScope,
} from '../../src/utils/interview-validation.utils.js';
import { APPLICATION_STAGES } from '../../src/constants/document.constants.js';
import { ApiError } from '../../src/middleware/job-application.middleware.js';
import {
  InterviewService,
  createInterviewService,
} from '../../src/services/interview.service.js';
import {
  createInterviewRequestSchema,
  listInterviewsQuerySchema,
} from '../../src/schemas/interview-request.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApplicationInInterview(candidate, job, {
  attempt = 1,
  appliedAt = '2026-10-23T10:00:00.000Z',
  interviewEnteredAt = '2026-10-24T10:00:00.000Z',
  stage = APPLICATION_STAGES.INTERVIEW,
} = {}) {
  const appId = applicationIdFromPair(candidate._id, job._id);
  const t1 = appliedAt;
  const t2 = '2026-10-23T11:00:00.000Z';
  const t3 = interviewEnteredAt;

  let stage_history = [
    {
      from_stage: null,
      to_stage: APPLICATION_STAGES.APPLIED,
      timestamp: t1,
      actor_role: 'CANDIDATE',
    },
  ];

  let updatedAt = t1;

  if (stage === APPLICATION_STAGES.SCREENING) {
    updatedAt = t2;
    stage_history.push({
      from_stage: APPLICATION_STAGES.APPLIED,
      to_stage: APPLICATION_STAGES.SCREENING,
      timestamp: t2,
      actor_role: 'RECRUITER',
    });
  } else if (stage === APPLICATION_STAGES.INTERVIEW) {
    updatedAt = t3;
    stage_history.push(
      {
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t2,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t3,
        actor_role: 'RECRUITER',
      }
    );
  } else if (stage === APPLICATION_STAGES.OFFER) {
    const t4 = '2026-10-25T10:00:00.000Z';
    updatedAt = t4;
    stage_history.push(
      {
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t2,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t3,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: t4,
        actor_role: 'RECRUITER',
        evidence: { interview_completed: true },
      }
    );
  } else if (stage === APPLICATION_STAGES.HIRED) {
    const t4 = '2026-10-25T10:00:00.000Z';
    const t5 = '2026-10-26T10:00:00.000Z';
    updatedAt = t5;
    stage_history.push(
      {
        from_stage: APPLICATION_STAGES.APPLIED,
        to_stage: APPLICATION_STAGES.SCREENING,
        timestamp: t2,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.SCREENING,
        to_stage: APPLICATION_STAGES.INTERVIEW,
        timestamp: t3,
        actor_role: 'RECRUITER',
      },
      {
        from_stage: APPLICATION_STAGES.INTERVIEW,
        to_stage: APPLICATION_STAGES.OFFER,
        timestamp: t4,
        actor_role: 'RECRUITER',
        evidence: { interview_completed: true },
      },
      {
        from_stage: APPLICATION_STAGES.OFFER,
        to_stage: APPLICATION_STAGES.HIRED,
        timestamp: t5,
        actor_role: 'RECRUITER',
        evidence: { offer_signed: true },
      }
    );
  } else if (stage === APPLICATION_STAGES.REJECTED) {
    updatedAt = t2;
    stage_history.push({
      from_stage: APPLICATION_STAGES.APPLIED,
      to_stage: APPLICATION_STAGES.REJECTED,
      timestamp: t2,
      actor_role: 'RECRUITER',
      reason_code: 'SCREENING_REJECTED',
    });
  } else if (stage === APPLICATION_STAGES.WITHDRAWN) {
    updatedAt = t2;
    stage_history.push({
      from_stage: APPLICATION_STAGES.APPLIED,
      to_stage: APPLICATION_STAGES.WITHDRAWN,
      timestamp: t2,
      actor_role: 'CANDIDATE',
    });
  }

  let previous_attempts;
  if (attempt > 1) {
    const prevAppliedAt = '2026-10-20T10:00:00.000Z';
    const prevUpdatedAt = '2026-10-21T10:00:00.000Z';
    previous_attempts = [
      {
        attempt_number: 1,
        current_stage: 'WITHDRAWN',
        applied_at: prevAppliedAt,
        updated_at: prevUpdatedAt,
        stage_history: [
          {
            from_stage: null,
            to_stage: APPLICATION_STAGES.APPLIED,
            timestamp: prevAppliedAt,
            actor_role: 'CANDIDATE',
          },
          {
            from_stage: APPLICATION_STAGES.APPLIED,
            to_stage: APPLICATION_STAGES.WITHDRAWN,
            timestamp: prevUpdatedAt,
            actor_role: 'CANDIDATE',
          },
        ],
      },
    ];
  }

  return {
    _id: appId,
    type: 'application',
    candidate_id: candidate._id,
    job_id: job._id,
    attempt_number: attempt,
    current_stage: stage,
    applied_at: appliedAt,
    updated_at: updatedAt,
    submission: {
      resume_text: 'Kỹ sư phần mềm kinh nghiệm về JavaScript và CouchDB.',
    },
    stage_history,
    ...(previous_attempts ? { previous_attempts } : {}),
    provenance: {
      classification: 'derived',
      generated: false,
      transform_version: 'test-fixture',
    },
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

test('TV3-UC17-001: Interview Request & Query Schemas', async (t) => {
  const validAppId = 'application:pair:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  await t.test('Vector 01: createInterviewRequestSchema accepts valid payload and normalises scheduled_at to UTC ISO', () => {
    const parsed = createInterviewRequestSchema.parse({
      application_id: validAppId,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T09:30:00+07:00',
    });

    assert.equal(parsed.application_id, validAppId);
    assert.equal(parsed.round, 1);
    assert.equal(parsed.interview_type, 'TECHNICAL');
    assert.equal(parsed.scheduled_at, '2026-10-27T02:30:00.000Z');
  });

  await t.test('Vector 02: createInterviewRequestSchema rejects invalid application_id formats', () => {
    const invalidIds = [
      '',
      'invalid-id',
      'application:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'application:pair:short-hex',
      'application:pair:zzzz456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ];

    for (const badId of invalidIds) {
      assert.throws(
        () => createInterviewRequestSchema.parse({
          application_id: badId,
          round: 1,
          interview_type: 'TECHNICAL',
          scheduled_at: '2026-10-27T10:00:00.000Z',
        }),
        /application_id/
      );
    }
  });

  await t.test('Vector 03: createInterviewRequestSchema rejects non-positive or non-integer round', () => {
    const badRounds = [0, -1, -5, 1.5, '1', null, undefined];
    for (const badRound of badRounds) {
      assert.throws(
        () => createInterviewRequestSchema.parse({
          application_id: validAppId,
          round: badRound,
          interview_type: 'TECHNICAL',
          scheduled_at: '2026-10-27T10:00:00.000Z',
        }),
        /round/
      );
    }
  });

  await t.test('Vector 04: createInterviewRequestSchema rejects unapproved interview_type', () => {
    const unapproved = ['COFFEE_CHAT', 'INFORMAL', 'FINAL', 'technical', ''];
    for (const badType of unapproved) {
      assert.throws(
        () => createInterviewRequestSchema.parse({
          application_id: validAppId,
          round: 1,
          interview_type: badType,
          scheduled_at: '2026-10-27T10:00:00.000Z',
        }),
        /interview_type/
      );
    }
  });

  await t.test('Vector 05: createInterviewRequestSchema rejects scheduled_at without timezone offset', () => {
    const badDates = [
      '2026-10-27 10:00:00',
      '2026-10-27T10:00:00',
      'not-a-date',
      '27/10/2026',
    ];
    for (const badDate of badDates) {
      assert.throws(
        () => createInterviewRequestSchema.parse({
          application_id: validAppId,
          round: 1,
          interview_type: 'TECHNICAL',
          scheduled_at: badDate,
        }),
        /scheduled_at/
      );
    }
  });

  await t.test('Vector 06: createInterviewRequestSchema strictly rejects extra server/completion fields', () => {
    const forbiddenFields = [
      { _id: 'interview:something' },
      { _rev: '1-test' },
      { score: 95 },
      { feedback: 'Rất tốt' },
      { result: 'PASSED' },
      { completed_at: '2026-10-27T12:00:00.000Z' },
      { candidate_id: 'candidate:one' },
      { job_id: 'job:one' },
      { interviewer_id: 'recruiter:one' },
      { application_attempt: 1 },
      { provenance: {} },
      { extra_unknown_field: true },
    ];

    for (const field of forbiddenFields) {
      assert.throws(
        () => createInterviewRequestSchema.parse({
          application_id: validAppId,
          round: 1,
          interview_type: 'TECHNICAL',
          scheduled_at: '2026-10-27T10:00:00.000Z',
          ...field,
        }),
        /unrecognized_keys/i
      );
    }
  });

  await t.test('Vector 07: listInterviewsQuerySchema accepts valid application_id and strictly rejects extra fields', () => {
    const valid = listInterviewsQuerySchema.parse({ application_id: validAppId });
    assert.equal(valid.application_id, validAppId);

    assert.throws(
      () => listInterviewsQuerySchema.parse({ application_id: validAppId, extra: 'forbidden' }),
      /unrecognized_keys/i
    );
    assert.throws(
      () => listInterviewsQuerySchema.parse({ application_id: 'invalid-app-id' }),
      /application_id/
    );
  });
});

test('TV3-UC17-001: InterviewService Constructor Contract', async (t) => {
  const f = createFixture();

  await t.test('Vector 08: Constructor enforces repository contract', () => {
    assert.throws(() => new InterviewService(null), /requires a repository instance/);
    assert.throws(() => new InterviewService({}), /requires repository\.get/);
    assert.throws(() => new InterviewService({ get: () => {} }), /requires repository\.put/);
    assert.throws(() => new InterviewService({ get: () => {}, put: () => {} }), /requires repository\.profile/);
    assert.throws(() => new InterviewService({ get: () => {}, put: () => {}, profile: () => {} }), /requires repository\.allInterviews/);

    const service = createInterviewService(f.repo);
    assert.ok(service instanceof InterviewService);
  });
});

test('TV3-UC17-001: InterviewService.create RBAC & Scoping', async (t) => {
  await t.test('Vector 09: create() rejects non-recruiter roles with 403 ApiError(FORBIDDEN)', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    };

    await assert.rejects(
      async () => service.create(f.users.candidate, payload),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );

    await assert.rejects(
      async () => service.create(f.users.admin, payload),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('Vector 10: create() rejects inactive recruiter with 403 ApiError(FORBIDDEN)', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const inactiveUser = { ...f.users.recruiter, account_status: 'LOCKED' };
    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    };

    await assert.rejects(
      async () => service.create(inactiveUser, payload),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('Vector 11: create() rejects non-existent application and non-application document with 404', async () => {
    const f = createFixture();
    const service = createInterviewService(f.repo);

    const payload = {
      application_id: 'application:pair:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    };

    // Missing document
    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 404 && err.code === 'NOT_FOUND'
    );

    // Document exists but type is not 'application'
    f.repo.docs.set(payload.application_id, {
      _id: payload.application_id,
      type: 'user',
    });

    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 404 && err.code === 'NOT_FOUND'
    );
  });

  await t.test('Vector 12: create() rejects recruiter who does not own the Job with 403 ApiError(FORBIDDEN)', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    };

    // Attempted by otherRecruiter (recruiter-two)
    await assert.rejects(
      async () => service.create(f.users.otherRecruiter, payload),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('Vector 13: create() rejects application NOT in INTERVIEW stage with 422 ApiError(INVALID_APPLICATION_STAGE)', async () => {
    const f = createFixture();
    const service = createInterviewService(f.repo);

    const nonInterviewStages = [
      APPLICATION_STAGES.APPLIED,
      APPLICATION_STAGES.SCREENING,
      APPLICATION_STAGES.OFFER,
      APPLICATION_STAGES.HIRED,
      APPLICATION_STAGES.REJECTED,
      APPLICATION_STAGES.WITHDRAWN,
    ];

    for (const stage of nonInterviewStages) {
      const app = makeApplicationInInterview(f.candidate, f.job, { stage });
      f.repo.docs.set(app._id, app);

      const payload = {
        application_id: app._id,
        round: 1,
        interview_type: 'TECHNICAL',
        scheduled_at: '2026-10-26T10:00:00.000Z',
      };

      await assert.rejects(
        async () => service.create(f.users.recruiter, payload),
        (err) => err instanceof ApiError && err.status === 422 && err.code === 'INVALID_APPLICATION_STAGE'
      );
    }
  });

  await t.test('Vector 14: create() rejects scheduled_at earlier than the timestamp application entered INTERVIEW stage', async () => {
    const f = createFixture();
    const interviewEnteredAt = '2026-10-24T10:00:00.000Z';
    const app = makeApplicationInInterview(f.candidate, f.job, { interviewEnteredAt });
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    // scheduled_at is before interviewEnteredAt
    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-24T09:00:00.000Z',
    };

    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 422 && err.code === 'INVALID_SCHEDULE_TIMELINE'
    );
  });
});

test('TV3-UC17-001: Sequential Round Enforcement & Attempt Isolation', async (t) => {
  await t.test('Vector 15: create() for 0 interviews requires round: 1; round: 2 throws 422 ApiError(INVALID_ROUND)', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const payload = {
      application_id: app._id,
      round: 2,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    };

    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 422 && err.code === 'INVALID_ROUND'
    );
  });

  await t.test('Vector 16: create() allows sequential round: 1 then round: 2; rejects round gap with 422', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    // 1. Create round 1
    const res1 = await service.create(f.users.recruiter, {
      application_id: app._id,
      round: 1,
      interview_type: 'HR_SCREENING',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    });
    assert.equal(res1.created, true);
    assert.equal(res1.interview.round, 1);

    // 2. Request round 3 when only round 1 exists (gap!)
    await assert.rejects(
      async () => service.create(f.users.recruiter, {
        application_id: app._id,
        round: 3,
        interview_type: 'SYSTEM_DESIGN',
        scheduled_at: '2026-10-27T10:00:00.000Z',
      }),
      (err) => err instanceof ApiError && err.status === 422 && err.code === 'INVALID_ROUND'
    );

    // 3. Create round 2
    const res2 = await service.create(f.users.recruiter, {
      application_id: app._id,
      round: 2,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    });
    assert.equal(res2.created, true);
    assert.equal(res2.interview.round, 2);

    // 4. Request round 4 when only rounds 1 and 2 exist (gap!)
    await assert.rejects(
      async () => service.create(f.users.recruiter, {
        application_id: app._id,
        round: 4,
        interview_type: 'FINAL_ROUND',
        scheduled_at: '2026-10-28T10:00:00.000Z',
      }),
      (err) => err instanceof ApiError && err.status === 422 && err.code === 'INVALID_ROUND'
    );
  });

  await t.test('Vector 17: Attempt isolation: application on attempt 2 ignores attempt 1 interviews for sequence', async () => {
    const f = createFixture();
    const appAttempt2 = makeApplicationInInterview(f.candidate, f.job, { attempt: 2 });
    f.repo.docs.set(appAttempt2._id, appAttempt2);

    // Pre-populate an interview from attempt 1
    const attempt1InterviewId = interviewIdFromRound(appAttempt2._id, 1, 1);
    f.repo.docs.set(attempt1InterviewId, {
      _id: attempt1InterviewId,
      type: 'interview',
      application_id: appAttempt2._id,
      application_attempt: 1,
      candidate_id: f.candidate._id,
      job_id: f.job._id,
      interviewer_id: f.recruiter._id,
      round: 1,
      interview_type: 'HR_SCREENING',
      scheduled_at: '2026-10-20T10:00:00.000Z',
      created_at: '2026-10-20T10:00:00.000Z',
      updated_at: '2026-10-20T10:00:00.000Z',
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'test-fixture',
        field_origins: { round: 'server_derived' },
      },
    });

    const service = createInterviewService(f.repo);

    // Even though attempt 1 has round 1, attempt 2 has 0 interviews.
    // Therefore attempt 2 must start at round 1. Requesting round 2 must fail!
    await assert.rejects(
      async () => service.create(f.users.recruiter, {
        application_id: appAttempt2._id,
        round: 2,
        interview_type: 'TECHNICAL',
        scheduled_at: '2026-10-26T10:00:00.000Z',
      }),
      (err) => err instanceof ApiError && err.status === 422 && err.code === 'INVALID_ROUND'
    );

    // Creating round 1 for attempt 2 succeeds
    const res = await service.create(f.users.recruiter, {
      application_id: appAttempt2._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-26T10:00:00.000Z',
    });

    assert.equal(res.created, true);
    assert.equal(res.interview.round, 1);
    assert.equal(res.interview.application_attempt, 2);
    assert.equal(res.interview._id, interviewIdFromRound(appAttempt2._id, 1, 2));
  });
});

test('TV3-UC17-001: Deterministic Document Construction & Safe DTO', async (t) => {
  await t.test('Vector 18: Stored document has deterministic _id, attempt, references, timestamps, and provenance', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);

    const fixedTime = new Date('2026-10-26T12:00:00.000Z');
    const service = createInterviewService(f.repo, { now: () => fixedTime });

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'BEHAVIORAL',
      scheduled_at: '2026-10-27T14:00:00.000Z',
    };

    const res = await service.create(f.users.recruiter, payload);
    const expectedId = interviewIdFromRound(app._id, 1, 1);

    assert.equal(res.interview._id, expectedId);

    const stored = f.repo.docs.get(expectedId);
    assert.ok(stored, 'Document must be stored in repository');
    assert.equal(stored._id, expectedId);
    assert.equal(stored.type, 'interview');
    assert.equal(stored.application_attempt, 1);
    assert.equal(stored.application_id, app._id);
    assert.equal(stored.candidate_id, f.candidate._id);
    assert.equal(stored.job_id, f.job._id);
    assert.equal(stored.interviewer_id, f.recruiter._id);
    assert.equal(stored.round, 1);
    assert.equal(stored.interview_type, 'BEHAVIORAL');
    assert.equal(stored.scheduled_at, '2026-10-27T14:00:00.000Z');
    assert.equal(stored.created_at, fixedTime.toISOString());
    assert.equal(stored.updated_at, fixedTime.toISOString());
    assert.deepEqual(stored.provenance, {
      classification: 'derived',
      generated: false,
      transform_version: 'interview-scheduling-v1',
      field_origins: {
        round: 'server_derived',
        application_id: 'user_input',
        interview_type: 'user_input',
        scheduled_at: 'user_input',
      },
    });
  });

  await t.test('Vector 19: Return safe DTO excludes _rev, candidate_id, job_id, interviewer_id, completion, and provenance', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const res = await service.create(f.users.recruiter, {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    });

    assert.equal(res.created, true);
    assert.equal(res.idempotent, false);

    const allowedKeys = new Set([
      '_id',
      'application_id',
      'application_attempt',
      'round',
      'interview_type',
      'scheduled_at',
      'created_at',
      'updated_at',
    ]);

    const actualKeys = Object.keys(res.interview);
    assert.deepEqual(actualKeys.sort(), [...allowedKeys].sort());

    assert.equal(res.interview._rev, undefined);
    assert.equal(res.interview.candidate_id, undefined);
    assert.equal(res.interview.job_id, undefined);
    assert.equal(res.interview.interviewer_id, undefined);
    assert.equal(res.interview.score, undefined);
    assert.equal(res.interview.feedback, undefined);
    assert.equal(res.interview.result, undefined);
    assert.equal(res.interview.completed_at, undefined);
    assert.equal(res.interview.provenance, undefined);
  });
});

test('TV3-UC17-001: Idempotency & Concurrency Recovery', async (t) => {
  await t.test('Vector 20: Idempotent identical retry returns created: false, idempotent: true with 0 extra writes', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'CULTURE_FIT',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    };

    const first = await service.create(f.users.recruiter, payload);
    assert.equal(first.created, true);
    assert.equal(first.idempotent, false);

    const writeCountAfterFirst = f.repo.writes.length;

    // Retry with identical content
    const retry = await service.create(f.users.recruiter, payload);
    assert.equal(retry.created, false);
    assert.equal(retry.idempotent, true);
    assert.deepEqual(retry.interview, first.interview);

    // No extra write to repository
    assert.equal(f.repo.writes.length, writeCountAfterFirst);
  });

  await t.test('Vector 21: Divergent retry with same round but different type/time throws 409 ApiError(INTERVIEW_CONTENT_CONFLICT)', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    await service.create(f.users.recruiter, {
      application_id: app._id,
      round: 1,
      interview_type: 'CULTURE_FIT',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    });

    // Divergent interview_type
    await assert.rejects(
      async () => service.create(f.users.recruiter, {
        application_id: app._id,
        round: 1,
        interview_type: 'TECHNICAL',
        scheduled_at: '2026-10-27T10:00:00.000Z',
      }),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'INTERVIEW_CONTENT_CONFLICT'
    );

    // Divergent scheduled_at
    await assert.rejects(
      async () => service.create(f.users.recruiter, {
        application_id: app._id,
        round: 1,
        interview_type: 'CULTURE_FIT',
        scheduled_at: '2026-10-28T10:00:00.000Z',
      }),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'INTERVIEW_CONTENT_CONFLICT'
    );
  });

  await t.test('Vector 22: CouchDB 409 conflict recovery during put() recovers if winner is semantically equal', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const fixedTime = new Date('2026-10-26T12:00:00.000Z');
    const service = createInterviewService(f.repo, { now: () => fixedTime });

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    };

    let putAttempted = false;
    f.repo.beforePut = async (doc) => {
      if (!putAttempted) {
        putAttempted = true;
        const clone = structuredClone(doc);
        f.repo.docs.set(clone._id, { ...clone, _rev: '1-fixture' });
        throw new ApiError(409, 'CONFLICT', 'Dữ liệu đã thay đổi.');
      }
    };

    const res = await service.create(f.users.recruiter, payload);
    assert.equal(res.created, false);
    assert.equal(res.idempotent, true);
    assert.equal(res.interview.round, 1);
    assert.equal(res.interview.interview_type, 'TECHNICAL');
  });

  await t.test('Vector 23: CouchDB 409 conflict during put() throws 409 if winner is divergent', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    };

    f.repo.beforePut = async (doc) => {
      const divergentDoc = structuredClone(doc);
      divergentDoc.interview_type = 'BEHAVIORAL';
      f.repo.docs.set(divergentDoc._id, { ...divergentDoc, _rev: '1-fixture' });
      throw new ApiError(409, 'CONFLICT', 'Dữ liệu đã thay đổi.');
    };

    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'INTERVIEW_CONTENT_CONFLICT'
    );
  });

  await t.test('Vector 24: Existing document with corrupted schema, reference mismatch, or attempt mismatch throws 409', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);
    const stableId = interviewIdFromRound(app._id, 1, 1);

    const payload = {
      application_id: app._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T10:00:00.000Z',
    };

    // Case A: Corrupted schema (missing required fields)
    f.repo.docs.set(stableId, {
      _id: stableId,
      type: 'interview',
    });

    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'CORRUPTED_STORED_INTERVIEW'
    );

    // Case B: Reference mismatch (candidate_id doesn't match)
    f.repo.docs.set(stableId, {
      _id: stableId,
      type: 'interview',
      application_attempt: 1,
      application_id: app._id,
      candidate_id: 'candidate:two',
      job_id: f.job._id,
      interviewer_id: f.recruiter._id,
      round: 1,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-27T10:00:00.000Z',
      created_at: '2026-10-26T10:00:00.000Z',
      updated_at: '2026-10-26T10:00:00.000Z',
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'interview-scheduling-v1',
      },
    });

    await assert.rejects(
      async () => service.create(f.users.recruiter, payload),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'REFERENCE_MISMATCH'
    );

    // Case C: validateInterviewCreationScope enforces attempt check even without recruiter
    const scopeCheck = validateInterviewCreationScope({
      interview: {
        application_id: app._id,
        candidate_id: f.candidate._id,
        job_id: f.job._id,
        application_attempt: 1,
      },
      application: {
        _id: app._id,
        candidate_id: f.candidate._id,
        job_id: f.job._id,
        attempt_number: 2,
      },
      job: f.job,
    });
    assert.equal(scopeCheck.valid, false);
    assert.ok(scopeCheck.errors.some((e) => e.includes('current application attempt')));
  });
});

test('TV3-UC17-001: InterviewService.list & Invariants', async (t) => {
  await t.test('Vector 25: list() enforces RBAC & ownership; filters to current attempt; sorts ascending; computes next_round', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job, { attempt: 2 });
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const query = { application_id: app._id };

    // 1. RBAC: Candidate and Admin forbidden
    await assert.rejects(
      async () => service.list(f.users.candidate, query),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      async () => service.list(f.users.admin, query),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );

    // 2. Ownership: otherRecruiter forbidden
    await assert.rejects(
      async () => service.list(f.users.otherRecruiter, query),
      (err) => err instanceof ApiError && err.status === 403 && err.code === 'FORBIDDEN'
    );

    // 3. 0 interviews exist -> scheduling_required: true, next_round: 1
    const emptyList = await service.list(f.users.recruiter, query);
    assert.equal(emptyList.application_id, app._id);
    assert.equal(emptyList.application_attempt, 2);
    assert.deepEqual(emptyList.items, []);
    assert.equal(emptyList.next_round, 1);
    assert.equal(emptyList.scheduling_required, true);

    // 4. Pre-populate an attempt 1 interview (should be ignored)
    const att1Id = interviewIdFromRound(app._id, 1, 1);
    f.repo.docs.set(att1Id, {
      _id: att1Id,
      type: 'interview',
      application_id: app._id,
      application_attempt: 1,
      candidate_id: f.candidate._id,
      job_id: f.job._id,
      interviewer_id: f.recruiter._id,
      round: 1,
      interview_type: 'HR_SCREENING',
      scheduled_at: '2026-10-20T10:00:00.000Z',
      created_at: '2026-10-20T10:00:00.000Z',
      updated_at: '2026-10-20T10:00:00.000Z',
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'interview-scheduling-v1',
      },
    });

    // 5. Pre-populate attempt 2 interviews in reverse order (round 2 then round 1)
    const att2R2Id = interviewIdFromRound(app._id, 2, 2);
    f.repo.docs.set(att2R2Id, {
      _id: att2R2Id,
      type: 'interview',
      application_id: app._id,
      application_attempt: 2,
      candidate_id: f.candidate._id,
      job_id: f.job._id,
      interviewer_id: f.recruiter._id,
      round: 2,
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-28T10:00:00.000Z',
      created_at: '2026-10-26T10:00:00.000Z',
      updated_at: '2026-10-26T10:00:00.000Z',
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'interview-scheduling-v1',
      },
    });

    const att2R1Id = interviewIdFromRound(app._id, 1, 2);
    f.repo.docs.set(att2R1Id, {
      _id: att2R1Id,
      type: 'interview',
      application_id: app._id,
      application_attempt: 2,
      candidate_id: f.candidate._id,
      job_id: f.job._id,
      interviewer_id: f.recruiter._id,
      round: 1,
      interview_type: 'HR_SCREENING',
      scheduled_at: '2026-10-27T10:00:00.000Z',
      created_at: '2026-10-26T10:00:00.000Z',
      updated_at: '2026-10-26T10:00:00.000Z',
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'interview-scheduling-v1',
      },
    });

    const populatedList = await service.list(f.users.recruiter, query);
    assert.equal(populatedList.application_attempt, 2);
    assert.equal(populatedList.items.length, 2);
    assert.equal(populatedList.items[0].round, 1);
    assert.equal(populatedList.items[1].round, 2);
    assert.equal(populatedList.next_round, 3);
    assert.equal(populatedList.scheduling_required, false);

    assert.equal(populatedList.items[0]._rev, undefined);
    assert.equal(populatedList.items[0].candidate_id, undefined);
    assert.equal(populatedList.items[0].interviewer_id, undefined);
  });

  await t.test('Vector 26: list() throws 409 on corrupted stored interview or invalid round sequence (gaps/duplicates)', async () => {
    const f = createFixture();
    const app = makeApplicationInInterview(f.candidate, f.job);
    f.repo.docs.set(app._id, app);
    const service = createInterviewService(f.repo);

    const query = { application_id: app._id };

    // Case A: Corrupted document in current attempt
    const r1Id = interviewIdFromRound(app._id, 1, 1);
    f.repo.docs.set(r1Id, {
      _id: r1Id,
      type: 'interview',
      application_attempt: 1,
      application_id: app._id,
      // invalid schema! missing candidate_id, etc.
    });

    await assert.rejects(
      async () => service.list(f.users.recruiter, query),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'CORRUPTED_STORED_INTERVIEW'
    );

    // Remove the corrupted doc
    f.repo.docs.delete(r1Id);

    // Case B: Round sequence gap: round 2 exists without round 1
    const r2Id = interviewIdFromRound(app._id, 2, 1);
    f.repo.docs.set(r2Id, {
      _id: r2Id,
      type: 'interview',
      application_id: app._id,
      application_attempt: 1,
      candidate_id: f.candidate._id,
      job_id: f.job._id,
      interviewer_id: f.recruiter._id,
      round: 2, // gap! round 1 is missing
      interview_type: 'TECHNICAL',
      scheduled_at: '2026-10-28T10:00:00.000Z',
      created_at: '2026-10-26T10:00:00.000Z',
      updated_at: '2026-10-26T10:00:00.000Z',
      provenance: {
        classification: 'derived',
        generated: false,
        transform_version: 'interview-scheduling-v1',
      },
    });

    await assert.rejects(
      async () => service.list(f.users.recruiter, query),
      (err) => err instanceof ApiError && err.status === 409 && err.code === 'INVALID_ROUND_SEQUENCE'
    );
  });
});
