# DATA-02A — Data Schema Contract

## 1. Authority and status

This is the approved MVP target schema for DATA-02B. Authority and precedence are:

1. `dataset-audit.md` is authoritative for observed source values and statistics.
2. Phase 3 is the business baseline.
3. This approved DATA-02A contract is authoritative for the DATA-02B target schema.
4. `dataset-mapping.md` remains the DATA-01 mapping record; where its proposed target shape differs, this contract controls the implementation without changing DATA-01 source facts.

| Label | Meaning |
|---|---|
| `EXISTING_PHASE3` | Retained Phase 3 baseline |
| `APPROVED_MVP` | Locked by the DATA-02A Final Design Lock |
| `REJECTED_MVP` | Considered alternative that must not be implemented in the MVP |
| `source` | Direct value from an audited Parquet field |
| `normalized` | Deterministic normalization of a source value |
| `derived` | Deterministic calculation from valid inputs |
| `synthetic` | Generated demo/business value with provenance |
| `unavailable` | Not present or not verifiable from the source |

No item marked `REJECTED_MVP` is an implementation option. Exactly nine business document types are retained; no reservation or email-claim document is added.

## 2. Approved MVP decisions affecting the schema

| # | Approved contract | Status |
|---:|---|---|
| 1 | Candidate profiles may be partial; missing school, employer and project history is not fabricated. | `APPROVED_MVP` |
| 2 | User is the only canonical owner of email. Candidate and Recruiter reference User. | `APPROVED_MVP` |
| 3 | One lifetime Application exists per Candidate–Job pair; re-application is not supported. | `APPROVED_MVP` |
| 4 | `application.current_stage` is the only pipeline state; no mirrored `Application.status`. | `APPROVED_MVP` |
| 5 | Candidate withdrawal is allowed only from `APPLIED`, `SCREENING` and `INTERVIEW`. | `APPROVED_MVP` |
| 6 | Application enters `INTERVIEW` before Interview creation; retry is idempotent and reconciliation is required. | `APPROVED_MVP` |
| 7 | Optional skills do not increase Skill Score. | `APPROVED_MVP` |
| 8 | Experience uses EXP-A continuous capped ratio. | `APPROVED_MVP` |
| 9 | Education uses EDU-B binary minimum qualification. | `APPROVED_MVP` |
| 10 | Project uses PROJ-A required-technology coverage. | `APPROVED_MVP` |
| 11 | Demo scoring inputs may be synthetic with provenance; absent source-only inputs remain unavailable. | `APPROVED_MVP` |
| 12 | A missing component produces `INCOMPLETE` analysis without total, recommendation or ranking eligibility. | `APPROVED_MVP` |

Additional locked decisions:

- `_id` for User is derived from SHA-256 of canonical normalized email; email is immutable in the MVP.
- No technical reservation document and no tenth business document type are used.
- `Application.match_score` is not stored.
- Offer decline/expiry is `OFFER → REJECTED` with a reason code.
- Ranking uses only fresh, `COMPLETE` analysis documents.

## 3. Database-wide contract

### 3.1. Document types and IDs

| `type` | `_id` contract | Role |
|---|---|---|
| `user` | `user:<sha256(email_normalized)>` | Identity, role and account state |
| `candidate` | `candidate:cms:<resume_id>` for audited source records | Candidate profile |
| `recruiter` | `recruiter:<stable-id>` | Recruiter profile and scope |
| `company` | `company:<stable-id>` | Company |
| `department` | `department:<stable-id>` | Department |
| `job` | `job:cms:<job_id>` for audited source records | Job and requirements |
| `application` | `application:pair:<sha256(candidate_id + "\n" + job_id)>` | Candidate–Job lifecycle |
| `interview` | `interview:<application-key>:<round>` | Interview round |
| `resume_analysis` | `analysis:<application_id>` | Current analysis for one Application |

IDs use lowercase hexadecimal SHA-256 output where a digest is specified. Hash input is UTF-8. Prefix and `type` must agree. IDs are deterministic and must not depend on row order or wall-clock time.

Skills stay embedded in Candidate and Job. An alias dictionary may be versioned application configuration, but is not a business document.

### 3.2. Common fields

| Field | Contract |
|---|---|
| `_id` | Required, immutable, stable and unique |
| `_rev` | CouchDB-managed; required for updates and deletes |
| `type` | Required discriminator from the nine values above |
| `created_at` | UTC ISO-8601; deterministic scenario time for generated data |
| `updated_at` | UTC ISO-8601 and `updated_at >= created_at` |
| `provenance` | Required for seeded/source-derived documents and every synthetic scoring input |

Approved provenance shape:

```json
{
  "classification": "source|normalized|derived|synthetic|mixed",
  "source_dataset": "cms-job-resume-v1",
  "source_ids": { "resume_id": "R_000001", "job_id": "J_000001" },
  "source_hashes": { "resumes.parquet": "<sha256>" },
  "generator_seed": "recruithub:data:v1:20261021",
  "generator_version": "<version>",
  "transform_version": "<version>",
  "field_origins": { "profile.role": "source" }
}
```

Only applicable keys are present. Provenance must not contain passwords, secrets or sensitive personal information.

### 3.3. Availability states

Empty and missing are not interchangeable. Scoring-bearing fields use these states:

| State | Meaning |
|---|---|
| `AVAILABLE` | Verified input exists |
| `PARTIAL` | Verified source evidence exists but is incomplete |
| `NONE_DECLARED` | Candidate explicitly declared no items |
| `SYNTHETIC` | Demo input generated and labeled synthetic |
| `UNAVAILABLE` | Source/input does not provide verifiable evidence |

An empty project array with `NONE_DECLARED` is evidence of no declared projects. An empty project array with `UNAVAILABLE` is missing input and must not score as zero.

### 3.4. Idempotent write policy

1. Validate the entire document before persistence.
2. Create with the stable `_id` and without `_rev`.
3. On CouchDB `409`, read the existing document.
4. Compare type, natural key, provenance version and canonical content hash excluding `_rev`.
5. Identical content is `UNCHANGED`; divergent content requires an explicitly authorized update with current `_rev`.
6. Never blind-overwrite or silently merge business histories.

## 4. `user` contract and email uniqueness

### 4.1. Canonicalization and ID algorithm

Email belongs only to User. The exact MVP algorithm is:

1. Validate the supplied/generated email as an email address.
2. Produce `email_normalized` by trimming surrounding whitespace and lowercasing the complete address using locale-independent rules.
3. Encode `email_normalized` as UTF-8.
4. Compute SHA-256 and lowercase hexadecimal output.
5. Set `_id = "user:" + digest`.
6. Persist `email` for display and `email_normalized` for lookup/audit.

Email is immutable. A requested email change is rejected in the MVP; account migration is outside scope. Concurrent creates for the same normalized email target the same `_id`: one create succeeds and the other receives `409`, which is mapped to `EMAIL_ALREADY_EXISTS` after reading the existing User. No query-before-insert uniqueness assumption and no reservation document are used.

All synthetic Users, including Candidate, Recruiter and Admin Users, must generate their final `example.invalid` email first and then derive `_id` through this algorithm. This supersedes DATA-01's proposed natural-key User ID for the DATA-02B target only; source statistics and source IDs are unchanged.

### 4.2. Fields

| Field | Required | Contract | Origin |
|---|---:|---|---|
| `_id` | Yes | `user:<sha256(email_normalized)>` | `derived` |
| `type` | Yes | Constant `user` | `derived` |
| `email` | Yes | Valid display form; immutable | `synthetic`/user input |
| `email_normalized` | Yes | Trimmed, lowercase uniqueness input; immutable | `normalized` |
| `password_hash` | Conditional | Secure hash; never plaintext/shared seeded password | `unavailable` in source |
| `role` | Yes | `CANDIDATE`, `RECRUITER`, `ADMIN` | `synthetic`/business input |
| `account_status` | Yes | `ACTIVE`, `LOCKED`, `RESET_REQUIRED` | `synthetic`/business input |
| `created_at`, `updated_at` | Yes | UTC ISO-8601 | system/`synthetic` |
| `provenance` | Seeded data | Common provenance contract | `synthetic`/`mixed` |

Generated demo emails use `example.invalid`; reusable seeded credentials are prohibited.

## 5. `candidate` contract

A Candidate is valid with a partial profile when its identity/reference and present values are structurally valid. Missing source fields are omitted or represented through availability metadata, never placeholder strings or invented history.

| Field | Required | Contract | DATA-01 origin |
|---|---:|---|---|
| `_id` | Yes | `candidate:cms:<resume_id>` for dataset records | `normalized` |
| `type` | Yes | Constant `candidate` | `derived` |
| `user_id` | Yes | Existing Candidate-role User | `synthetic` reference |
| `profile.role` | Source import | Non-empty string | `source` |
| `profile.seniority` | Source import | `JUNIOR`, `MID`, `SENIOR` | `normalized` |
| `profile.industry` | Source import | Canonical industry key | `normalized` |
| `profile.years_experience` | Source import | Audited integer value | `source` |
| `profile.experience_months` | When years exist | `years_experience * 12` | `derived` |
| `profile.summary` | Optional | Non-empty when present | `source` |
| `profile.full_name` | Optional | User-entered or labeled synthetic; never inferred | `synthetic`/`unavailable` |
| `skills[]` | Yes | Unique `{name, normalized}` objects | `source` + `normalized` |
| `education[]` | Yes | Partial items; degree required when item exists | `source`/user input |
| `experience_summary` | Optional | Aggregate duration/source bullets | `source` + `derived` |
| `experience[]` | Yes | Detailed employment items; empty for current dataset | `unavailable`/user input |
| `projects[]` | Yes | Structured projects | user input/`synthetic`/`unavailable` |
| `data_availability` | Yes | Availability state for scoring-bearing groups | `derived`/input |
| `created_at`, `updated_at` | Yes | UTC ISO-8601 | system/`synthetic` |
| `provenance` | Yes | Common provenance contract | `mixed` |

Candidate and Recruiter do not store canonical email. School, employer, project, dates and personal identity details absent from the source must not be fabricated.

## 6. Organization and recruiter contracts

### 6.1. `company`

Required: `_id`, `type=company`, `name`, canonical `industry`, timestamps and seeded-data provenance. Demo name is fictional and `synthetic`. Website/address are omitted when unavailable.

### 6.2. `department`

Required: `_id`, `type=department`, existing `company_id`, `name`, and a normalized `key` unique within the Company. Uniqueness is validated by deterministic generation/service logic.

### 6.3. `recruiter`

Required: `_id`, `type=recruiter`, existing Recruiter-role `user_id`, `company_id`, `department_id`, timestamps and seeded-data provenance. The Department must belong to the Company. Email/account state remain on User. Job ownership is canonical on `job.recruiter_id`.

## 7. `job` contract

| Field | Required | Contract | DATA-01 origin |
|---|---:|---|---|
| `_id` | Yes | `job:cms:<job_id>` for dataset Jobs | `normalized` |
| `type` | Yes | Constant `job` | `derived` |
| `company_id`, `department_id`, `recruiter_id` | Yes | Existing, mutually scoped references | `synthetic` references |
| `title` | Yes | Non-empty | `source` |
| `seniority` | Yes | `JUNIOR`, `MID`, `SENIOR` | `normalized` |
| `industry` | Yes | Canonical industry | `normalized` |
| `description` | Yes | Non-empty | `source` |
| `responsibilities[]` | Yes | Non-empty unique normalized strings | `source` |
| `requirements.general[]` | Yes | General source requirements | `source` |
| `requirements.experience.status` | Yes | `REQUIRED`, `NO_MINIMUM`, `UNAVAILABLE` | input/`synthetic` |
| `requirements.experience.required_months` | Conditional | Positive integer only when `REQUIRED` | input/`synthetic` |
| `requirements.education.status` | Yes | `REQUIRED`, `NO_MINIMUM`, `UNAVAILABLE` | input/`synthetic` |
| `requirements.education.minimum_degree` | Conditional | Canonical degree only when `REQUIRED` | input/`synthetic` |
| `requirements.project.status` | Yes | `REQUIRED`, `NO_REQUIREMENT`, `UNAVAILABLE` | input/`synthetic` |
| `requirements.project.required_technologies[]` | Conditional | Non-empty normalized unique set when `REQUIRED` | input/`synthetic` |
| `required_skills[]` | Yes | Non-empty unique normalized set for scoring | `normalized` |
| `optional_skills[]` | Yes | Unique normalized set disjoint from required | `normalized` |
| `status` | Yes | `DRAFT`, `OPEN`, `CLOSED` | business input/`synthetic` |
| `deadline` | OPEN Job | UTC timestamp checked during Apply | business input/`synthetic` |
| `created_at`, `updated_at`, `published_at` | Conditional | UTC ISO-8601 | system/`synthetic` |
| `provenance` | Yes | Field-level origins for synthetic scoring requirements | `mixed` |

The nested requirement paths above are canonical. Earlier spellings such as `requirements.experience_required_months`, `requirements.education_required` or `job.project` must not be implemented.

An OPEN Job requires valid ownership, title, description, non-empty required skills and deadline. If a scoring requirement is `UNAVAILABLE`, analysis for that Job can only be `INCOMPLETE`. Requirements not observed in Parquet remain synthetic/user-entered and must not be presented as source facts.

## 8. `application` contract

| Field | Required | Contract |
|---|---:|---|
| `_id` | Yes | Deterministic lifetime Candidate–Job pair ID |
| `type` | Yes | Constant `application` |
| `candidate_id`, `job_id` | Yes | Existing eligible references |
| `current_stage` | Yes | `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN` |
| `stage_history[]` | Yes | Ordered append-only events |
| `applied_at` | Yes | Same instant as initial event |
| `updated_at` | Yes | Latest successful state mutation time |
| `recruiter_note` | Optional | Scoped recruiter text |
| `provenance` | Generated data | Must identify synthetic Application generation |

The first event is `null → APPLIED`; `current_stage` equals the final `to_stage`; timestamps strictly increase after the initial event. No `Application.status` and no `Application.match_score` are stored. Ground-truth pairs never create an Application by themselves.

## 9. `interview` contract

Required fields are `_id`, `type=interview`, `application_id`, matching `candidate_id`/`job_id`, scoped `interviewer_id`, positive unique sequential `round`, approved `interview_type`, `scheduled_at`, timestamps and seeded-data provenance. Optional completion fields are `score`, `feedback` and `result`.

Creation requires the referenced Application to be in `INTERVIEW`. The stable Application+round ID makes identical retry idempotent; divergent retry conflicts. Reconciliation must detect `INTERVIEW` Applications with no Interview and retry or flag them.

## 10. `resume_analysis` contract

| Field | Required | Contract |
|---|---:|---|
| `_id` | Yes | `analysis:<application_id>` |
| `type` | Yes | Constant `resume_analysis` |
| `application_id`, `candidate_id`, `job_id` | Yes | Must match the referenced Application |
| `analysis_status` | Yes | `COMPLETE` or `INCOMPLETE` |
| `matched_skills[]`, `missing_skills[]` | Valid skill input | Derived from required skills only |
| `scores.skill` | Conditional | Required for COMPLETE; 0–100 |
| `scores.experience` | Conditional | Required for COMPLETE; EXP-A; 0–100 |
| `scores.education` | Conditional | Required for COMPLETE; EDU-B; 0 or 100 |
| `scores.project` | Conditional | Required for COMPLETE; PROJ-A; 0–100 |
| `component_details` | Yes | Exact inputs, availability, formula ID and unrounded calculation |
| `missing_inputs[]` | Yes | Empty for COMPLETE; reason objects for INCOMPLETE |
| `total_score` | COMPLETE only | Unrounded weighted result used for ranking |
| `recommendation` | COMPLETE only | `HIGH`, `MEDIUM`, `LOW` |
| `algorithm_version` | Yes | Approved scoring/normalization configuration version |
| `input_fingerprint` | Yes | SHA-256 of canonical score-relevant payload and versions |
| `analyzed_at` | Yes | UTC ISO-8601 |
| `provenance` | Yes | Analysis and upstream origin metadata |

`INCOMPLETE` may retain valid component explanations but must omit `total_score` and `recommendation`, and is never rankable. Missing scores are omitted or `null` with explicit reasons; never replaced by zero, random, mean or median values.

Display values may be rounded to two decimals. Intermediate component values and `total_score` used for recommendation/ranking are not rounded. The business shorthand `skill_score` in ranking means canonical field `resume_analysis.scores.skill`; no duplicate top-level score is stored.

## 11. Reference, lifecycle and ranking invariants

| Source | Required invariant |
|---|---|
| Candidate | `user_id` exists and User role is `CANDIDATE` |
| Recruiter | `user_id` exists and User role is `RECRUITER` |
| Department | `company_id` exists |
| Recruiter | Department belongs to the same Company |
| Job | Organization/recruiter references exist and scope matches |
| Application | Candidate/Job exist; Candidate owns request; Job was eligible at Apply |
| Interview | Application exists in `INTERVIEW`; interviewer has Job scope; copied refs match |
| Resume Analysis | Application/Candidate/Job references match exactly |

Active ranking includes only Applications in `APPLIED`, `SCREENING`, `INTERVIEW` or `OFFER` with fresh COMPLETE analysis. Historical ranking is a separate API and may include `HIRED` and `REJECTED`. `WITHDRAWN` is excluded by default. Stable ordering is:

1. `resume_analysis.total_score DESC` using unrounded value.
2. `resume_analysis.scores.skill DESC` using unrounded value.
3. `application.applied_at ASC`.
4. `application._id ASC`.

An analysis is fresh only when its `input_fingerprint`, `algorithm_version`, Candidate reference and Job reference still match current score-relevant state.

## 12. Conflict and update rules

| Operation | Contract |
|---|---|
| User create | Deterministic email-derived `_id`; map same-email `409` to `EMAIL_ALREADY_EXISTS` |
| User email update | Reject; email is immutable in MVP |
| Candidate update | Use current `_rev`; do not overwrite on `409` |
| Job update/publish | Re-read lifecycle/ownership before at most one valid retry |
| Application create | Deterministic pair ID; map `409` to duplicate lifetime Application |
| Application transition | Validate expected stage and `_rev`; re-read and re-evaluate on conflict |
| Interview create | Stable round ID; identical retry is idempotent, divergent retry conflicts |
| Analysis upsert | Recompute fingerprint, use current `_rev`, never overwrite a newer valid analysis |

## 13. DATA-01 mapping reconciliation

DATA-01 remains the audit/mapping record. These approved target-schema resolutions apply when DATA-02B transforms that source:

| DATA-01 mapping/design point | Approved DATA-02A target resolution |
|---|---|
| User `_id` proposed from a Candidate/Recruiter natural key | Generate the final synthetic `email` first; normalize it; derive `user:<sha256(email_normalized)>` |
| Candidate email shown as synthetic/unavailable | Canonical email exists only on User; Candidate references `user_id` |
| Application `status` left unavailable/derived beside `current_stage` | Omit `status`; persist only `current_stage` |
| Application `match_score` described as an optional derived cache | Omit it; Resume Analysis is the only score source |
| Duplicate active Application remained the Phase 3 baseline | Enforce one lifetime Candidate–Job pair through deterministic Application ID |
| Experience/Education/Project scoring was blocked | Use EXP-A, EDU-B and PROJ-A only when the approved explicit inputs exist |
| Source-only project/Job requirement data was absent | Preserve `UNAVAILABLE` and produce `INCOMPLETE`; do not manufacture source facts |
| `PENDING_RULES` was a possible future state | Use only approved `COMPLETE` or `INCOMPLETE` |
| Job scoring fields had provisional names | Use the canonical nested `job.requirements.experience`, `.education` and `.project` paths in section 7 |

The audited counts, distributions, duplicate/orphan findings and Parquet hashes in DATA-01 are unchanged.

## 14. DATA-02B implementation contract

- Implement exactly nine business document discriminators.
- Keep prefix, type and natural key consistent.
- Apply the approved email normalization/hash algorithm to every User, including all synthetic Users.
- Preserve DATA-01 source values/statistics and field-level provenance.
- Validate no null/empty/normalized duplicate array items.
- Validate all references and organization/ownership scope before writes.
- Enforce one lifetime Application per Candidate–Job using deterministic `_id`.
- Persist only `current_stage`; do not persist Application `status` or `match_score`.
- Implement the approved transition matrix and Interview reconciliation.
- Produce COMPLETE only when all four approved component scores are valid.
- Produce INCOMPLETE with reasons and without total/recommendation when any component is missing.
- Recompute freshness before returning a score as current or including it in ranking.
- Never use ground-truth pairs as Application facts or score inputs.

The DATA-02A schema is locked and ready for DATA-02B implementation. DATA-02B must not reinterpret rejected alternatives without a new Business Owner decision.
