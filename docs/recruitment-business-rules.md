# DATA-02A — Recruitment Business Rules

## 1. Final design status

This document is the approved MVP business contract for DATA-02B.

| Label | Meaning |
|---|---|
| `EXISTING_PHASE3` | Retained Phase 3 baseline |
| `APPROVED_MVP` | Locked by the DATA-02A Final Design Lock |
| `REJECTED_MVP` | Reviewed alternative that is not permitted in the MVP |

The approved rules refine Phase 3 where Phase 3 left duplicate-application scope, transition details, missing scoring data or ranking lifecycle unspecified. They do not alter the audited Parquet source.

## 2. Actors and authorization

| Actor | Permitted responsibility | Explicit exclusions |
|---|---|---|
| Candidate | Apply, read own Applications, withdraw own eligible Application, update own profile | Cannot move recruiter stages, create Interview or access another Candidate's data |
| Recruiter | Manage owned/scoped Jobs, inspect their Applications, transition pipeline, create/update Interviews, request analysis | Cannot act outside Company/Department/Job scope or impersonate Candidate withdrawal |
| Admin | Manage User role/account state and approved organization administration | Does not participate directly in the Application pipeline or scoring |

Authentication establishes User identity. Authorization is checked before every business read or mutation; frontend visibility is not authorization.

Ownership/scope checks:

- Candidate operations require `application.candidate_id` to reference the Candidate owned by the authenticated Candidate User.
- Recruiter operations require the Job's `recruiter_id`, Company and Department scope to authorize the authenticated Recruiter.
- Admin status does not bypass Candidate withdrawal authorship or create recruitment history events unless a separately approved administrative recovery operation exists.
- Referenced User, Candidate, Recruiter, Company, Department and Job documents must exist and have compatible roles/scope.

## 3. Apply and duplicate Application

### 3.1. Preconditions

All conditions are required:

1. Authenticated User is active, has role `CANDIDATE` and owns `candidate_id`.
2. Candidate and Job exist and pass schema validation.
3. Job `status == OPEN`.
4. Apply time is not later than Job `deadline`; the inclusive boundary is evaluated in UTC.
5. Job has valid Company, Department and Recruiter references.
6. No lifetime Application exists for the Candidate–Job pair.
7. Client does not provide `_id`, `current_stage`, history or score; Backend constructs them.

Failure creates no partial Application.

### 3.2. Lifetime uniqueness and concurrency

`APPROVED_MVP`:

- Exactly one lifetime Application is allowed for each Candidate–Job pair.
- Re-application remains prohibited after `HIRED`, `REJECTED` or `WITHDRAWN`.
- The deterministic pair ID is `application:pair:<sha256(candidate_id + "\n" + job_id)>`.
- Concurrent Apply requests target the same ID. One create succeeds; the other receives CouchDB `409`, reads the existing document and returns `DUPLICATE_APPLICATION`.
- A Mango query is not an atomic uniqueness boundary.

`REJECTED_MVP`: allowing a new cycle after a terminal state. It needs an application-cycle key and a separate atomic active-cycle constraint, increasing concurrency and generator complexity.

## 4. Application state definitions

| Stage | Meaning | Terminal | Primary actor entering stage |
|---|---|---:|---|
| `APPLIED` | Application accepted by the system | No | Candidate/system |
| `SCREENING` | Recruiter screens the profile | No | Recruiter |
| `INTERVIEW` | Candidate is in the interview process | No | Recruiter |
| `OFFER` | Offer issued and awaiting outcome | No | Recruiter |
| `HIRED` | Recruitment completed successfully | Yes | Recruiter |
| `REJECTED` | Recruitment ended without hire | Yes | Recruiter |
| `WITHDRAWN` | Candidate ended participation | Yes | Candidate |

`current_stage` is the only persisted Application lifecycle state. Terminality is derived from membership in `{HIRED, REJECTED, WITHDRAWN}`. `Application.status` and `Application.match_score` are not stored.

## 5. Approved transition matrix

| From | To | Actor | Preconditions | Result/history |
|---|---|---|---|---|
| — | `APPLIED` | Candidate/system | Apply preconditions pass; lifetime pair does not exist | Create Application; initial Candidate event |
| `APPLIED` | `SCREENING` | Recruiter | Job scope valid; revision/current stage match | Append `SCREENING_STARTED` |
| `APPLIED` | `REJECTED` | Recruiter | Scope valid; rejection reason code present | Append terminal rejection |
| `APPLIED` | `WITHDRAWN` | Candidate | Own Application; revision/current stage match | Append terminal withdrawal |
| `SCREENING` | `INTERVIEW` | Recruiter | Scope valid; screening completed; Candidate/Job accessible | Append `INTERVIEW_SELECTED`; create Interview afterward |
| `SCREENING` | `REJECTED` | Recruiter | Scope valid; rejection reason code present | Append terminal rejection |
| `SCREENING` | `WITHDRAWN` | Candidate | Own Application; revision/current stage match | Append terminal withdrawal |
| `INTERVIEW` | `OFFER` | Recruiter | Scope valid; at least one required Interview completed; no unresolved required round | Append `OFFER_ISSUED` |
| `INTERVIEW` | `REJECTED` | Recruiter | Scope valid; rejection reason code present | Append terminal rejection |
| `INTERVIEW` | `WITHDRAWN` | Candidate | Own Application; revision/current stage match | Append terminal withdrawal |
| `OFFER` | `HIRED` | Recruiter | Scope valid; approved offer-acceptance evidence recorded | Append terminal hire |
| `OFFER` | `REJECTED` | Recruiter | Scope valid; reason code records declined or expired offer | Append terminal rejection |

No other transition is permitted.

Legend: `R` Recruiter, `C` Candidate, `—` forbidden, `T` terminal row.

| From \ To | APPLIED | SCREENING | INTERVIEW | OFFER | HIRED | REJECTED | WITHDRAWN |
|---|---:|---:|---:|---:|---:|---:|---:|
| APPLIED | — | R | — | — | — | R | C |
| SCREENING | — | — | R | — | — | R | C |
| INTERVIEW | — | — | — | R | — | R | C |
| OFFER | — | — | — | — | R | R | — |
| HIRED | T | T | T | T | T | T | T |
| REJECTED | T | T | T | T | T | T | T |
| WITHDRAWN | T | T | T | T | T | T | T |

Additional locked semantics:

- Backward transitions and stage skips are forbidden.
- Creating another Interview round while already in `INTERVIEW` does not add a duplicate stage transition.
- Candidate withdrawal is allowed only in `APPLIED`, `SCREENING` and `INTERVIEW`.
- Candidate cannot withdraw in `OFFER`.
- Offer declined/expired is `OFFER → REJECTED` with a required reason code such as `OFFER_DECLINED` or `OFFER_EXPIRED`.
- `HIRED`, `REJECTED` and `WITHDRAWN` cannot transition further.

`REJECTED_MVP`: add a distinct `DECLINED` stage or allow `OFFER → WITHDRAWN`. Both would change the approved seven-stage model.

## 6. Stage history invariants

1. History is non-empty and append-only through Service operations.
2. First event is `null → APPLIED`; its timestamp equals `applied_at`.
3. Adjacent events connect: event `n.from_stage == event n-1.to_stage`.
4. Last `to_stage == current_stage`.
5. Transition timestamps are UTC ISO-8601 and strictly increasing after the initial event.
6. Actor User exists, role is permitted and ownership/scope is valid at operation time.
7. `REJECTED` requires a reason code; notes cannot replace it.
8. A terminal event is the last event.
9. Clients request an action/target and never submit replacement history arrays.
10. History append and `current_stage` update occur in one Application document update using one `_rev`.

## 7. `_rev` conflict behavior

For transitions:

1. Read Application and current `_rev`.
2. Check actor, ownership/scope, expected stage, transition and preconditions.
3. Construct the event and updated document.
4. Save with the read `_rev`.
5. On `409`, read the latest Application.
6. If an equivalent action already produced the requested state/event, return an idempotent result.
7. Otherwise re-evaluate authorization and validity from the latest state.
8. Retry at most once only when still unambiguously valid; otherwise return controlled `CONFLICT`.

Never calculate an event from stale state, reuse stale `_rev`, blindly merge histories or overwrite a winning transition.

## 8. Interview creation, retry and reconciliation

`APPROVED_MVP` sequence:

1. Transition Application `SCREENING → INTERVIEW` with the current `_rev`.
2. After success, create round 1 using the deterministic Application+round Interview ID.
3. Create later rounds only while Application remains `INTERVIEW`.

Interview invariants:

- Application exists and is `INTERVIEW` at creation time.
- Recruiter has scope over the Job.
- Round is positive, unique and sequential.
- Copied `candidate_id` and `job_id` match Application.
- `scheduled_at` is not earlier than the transition into `INTERVIEW`.
- Interview result is not a Resume Analysis component input.

CouchDB has no transaction across Application and Interview. If transition succeeds but creation fails:

- retry the identical stable Interview ID;
- treat identical existing content as success;
- reject divergent content for the same round as conflict;
- reconciliation finds `INTERVIEW` Applications with zero Interview documents and retries or flags them;
- never roll Application backward to `SCREENING`.

`REJECTED_MVP`: create Interview while Application is `SCREENING` and transition afterward. It can leave a scheduled Interview attached to SCREENING and weakens the creation invariant.

## 9. Resume Analysis eligibility and ranking

Only an analysis that is both `COMPLETE` and fresh is rankable. `INCOMPLETE`, stale or reference-invalid analysis has no current ranking value.

### 9.1. Active ranking

Active ranking is scoped to one Job and includes only Applications whose `current_stage` is one of:

```text
APPLIED, SCREENING, INTERVIEW, OFFER
```

It excludes `HIRED`, `REJECTED` and `WITHDRAWN`.

### 9.2. Historical ranking

Historical ranking is exposed through a separate API/explicit mode and may include `HIRED` and `REJECTED`. `WITHDRAWN` is excluded by default. Historical inclusion never bypasses COMPLETE/fresh/reference validation.

### 9.3. Stable order

1. `resume_analysis.total_score DESC` using the unrounded value.
2. `resume_analysis.scores.skill DESC` using the unrounded value.
3. `application.applied_at ASC`.
4. `application._id ASC`.

The phrase `skill_score` in the business decision maps to canonical field `resume_analysis.scores.skill`. Ground-truth Resume–Job pairs never establish Application eligibility, component scores, total score or rank.

## 10. Approved decision register

All twelve rows are locked as `APPROVED_MVP`. Rejected alternatives are preserved for traceability.

| # | Decision | Approved MVP | Rejected alternative | Selection reason | Impact | Status |
|---:|---|---|---|---|---|---|
| 1 | Partial profile schema | Permit partial `education`, aggregate `experience_summary`, empty detailed arrays with availability | Require full school/employer/project objects | Matches audited source without fabrication | Zod optionality and generator | `APPROVED_MVP` |
| 2 | Canonical email ownership | User only; Candidate/Recruiter reference User | Duplicate email in profile documents | Avoids conflicting canonical values | User ID, lookup and response composition | `APPROVED_MVP` |
| 3 | Re-application policy | One lifetime Application per Candidate–Job | New cycle after terminal state | Deterministic ID gives atomic duplicate protection | Application identity/cardinality | `APPROVED_MVP` |
| 4 | Pipeline state | Persist only `current_stage` | Mirror `current_stage` in `status` | Single source of truth | Schema, queries and APIs | `APPROVED_MVP` |
| 5 | Withdraw transitions | APPLIED/SCREENING/INTERVIEW only | Also allow OFFER | Preserves seven-stage model and explicit offer outcome | Transition constants/tests | `APPROVED_MVP` |
| 6 | Interview recovery | Transition first; idempotent create and reconciliation | Create during SCREENING then transition | Keeps Interview creation invariant simple | Service orchestration and repair | `APPROVED_MVP` |
| 7 | Optional skills | Ignore in Skill Score | Add capped bonus | Preserves required-skill coverage and 0–100 meaning | Scoring config/tests | `APPROVED_MVP` |
| 8 | Experience | EXP-A continuous capped ratio | EXP-B score bands | More granular and monotonic | Explicit Job months required | `APPROVED_MVP` |
| 9 | Education | EDU-B binary minimum | EDU-A ordinal partial credit | Simple minimum-qualification rule; no arbitrary 60-point credit | Degree normalization and Job minimum | `APPROVED_MVP` |
| 10 | Project | PROJ-A required-technology coverage | PROJ-B hybrid coverage/count | Fewer synthetic fields and no project-count threshold | Project technology requirements | `APPROVED_MVP` |
| 11 | Synthetic scoring inputs | Labeled synthetic demo inputs; source-only missing stays unavailable | Treat missing source as populated fact or block all demo scoring | Enables demo without misrepresenting source capability | Generator/provenance/UI | `APPROVED_MVP` |
| 12 | Missing components | Persist `INCOMPLETE`; omit total/recommendation/ranking | Reject analysis creation entirely | Preserves diagnostics without fabricated score | Analysis schema/API/ranking | `APPROVED_MVP` |

## 11. Additional approved decisions

| Decision | Approved MVP | Rejected alternative | Status |
|---|---|---|---|
| Email uniqueness | User ID is SHA-256 of normalized immutable email | Query-before-insert, mutable email ID, reservation document | `APPROVED_MVP` |
| Offer decline | `OFFER → REJECTED` with reason code | New pipeline stage | `APPROVED_MVP` |
| Ranking lifecycle | Separate active and historical semantics | One ambiguous ranking filter | `APPROVED_MVP` |
| Application score cache | Omit `match_score` | Mirror analysis total | `APPROVED_MVP` |
| Ranking tie-break | Total DESC, skill DESC, applied time ASC, Application ID ASC | Non-deterministic ties | `APPROVED_MVP` |
| Scoring freshness | COMPLETE and matching fingerprint/version required | Treat any stored analysis as current | `APPROVED_MVP` |

## 12. Acceptance scenarios for DATA-02B

| ID | Scenario | Expected result |
|---|---|---|
| BR-01 | First eligible Apply | One APPLIED Application and initial event |
| BR-02 | Concurrent duplicate Apply | One create; other maps `409` to duplicate |
| BR-03 | Reapply after WITHDRAWN | Rejected under lifetime policy |
| BR-04 | Candidate withdraws APPLIED | WITHDRAWN terminal event |
| BR-05 | Candidate withdraws INTERVIEW | WITHDRAWN terminal event |
| BR-06 | Candidate withdraws OFFER | Rejected; no mutation |
| BR-07 | Recruiter skips SCREENING | Rejected; no mutation |
| BR-08 | Recruiter transitions terminal state | Rejected; no mutation |
| BR-09 | Unauthorized Recruiter transitions | Forbidden; no mutation |
| BR-10 | Transition uses stale `_rev` | Controlled conflict/re-evaluation; no lost update |
| BR-11 | INTERVIEW transition then Interview create | Stage and round 1 consistent |
| BR-12 | Interview create times out then retries | Same Interview; no duplicate |
| BR-13 | Reconciliation finds INTERVIEW with zero rounds | Idempotent retry or explicit flag |
| BR-14 | Broken history chain | Validation fails |
| BR-15 | INCOMPLETE or stale analysis enters ranking | Excluded/rejected |
| BR-16 | Offer declined | REJECTED with `OFFER_DECLINED` |
| BR-17 | Same normalized email created concurrently | One User; loser receives `EMAIL_ALREADY_EXISTS` |
| BR-18 | Ranking scores tie | Earlier `applied_at`, then lexical `application._id` wins |

## 13. Implementation lock

DATA-02B must implement this matrix and these decisions without introducing a tenth business document type, re-application cycles, mirrored Application state/score fields, inferred scoring requirements or ground-truth-derived behavior. Any change requires a new Business Owner decision.
