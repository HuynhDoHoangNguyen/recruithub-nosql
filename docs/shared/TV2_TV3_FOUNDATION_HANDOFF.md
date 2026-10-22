# TV2 / TV3 — Shared Foundation Handoff

**Date:** 2026-10-23  
**Status:** Integration guide based on current source; API/security proposals remain pending.  
**Foundation contract:** `docs/shared/SHARED_FOUNDATION_CONTRACT.md`

## 1. What is ready

TV1 provides a shared CouchDB config/client, BaseRepository, typed/sanitized CouchDB errors and a provisional readiness route. Import paths and behavior below are verified against current source. No TV2/TV3 business repository or service has been implemented as part of the foundation work.

Approved shared boundaries: nine business document types only, `type` discriminator, owning domain generates deterministic `_id` and `type`, no automatic mutation retries in the client, no foundation tests that write `recruitment_db`, no implicit database/index/view/document creation.

## 2. Shared imports and basic construction

From a backend service module, imports are:

```js
import { BaseRepository } from '../repositories/base.repository.js';
import { createCouchDbClient } from './couchdb.client.js';

const repository = new BaseRepository({
  client: createCouchDbClient(),
  schema: ownedDocumentSchema,
});
```

This example is illustrative. `ownedDocumentSchema` is supplied by the module owner; the example does not claim a particular schema export exists. Backend server startup loads env before app routes; if a test or non-server entry point constructs a client directly, provide config/process env explicitly. Construction itself does not connect to CouchDB. Each client call performs a request.

Repository calls:

```js
const document = await repository.getById(deterministicId);
const result = await repository.find(
  { type: ownedType, status: allowedStatus },
  { limit: 25, bookmark: priorBookmark },
);
const created = await repository.create(completeDocumentWithIdAndType);
const updated = await repository.update(document, currentRev);
const present = await repository.exists(deterministicId);
const databaseInfo = await repository.getDatabaseInfo();
```

The `find` example shows pass-through shape only; it is not a final cursor contract or guaranteed index-backed query. `create`/`update` perform writes, so do not call them against `recruitment_db` for foundation tests. Ensure schema validation, authorization, deterministic IDs and state rules in your domain layer.

## 3. TV2 handoff — Job and Application

TV2 owns Job/Application schema integration, repositories, services, HTTP endpoints, DTOs and lifecycle behavior. Reuse the foundation instead of creating another DB client/config/base repository/error mapper.

TV2 should provide to TV1:

- Public Job Card and Job Detail DTOs, including public-field allowlist and behavior for non-OPEN/not-found jobs.
- List filters, sort order, stable tie-breaker, page size cap and cursor semantics.
- Search semantics and supported fields based on actual schema/indexes; do not assume salary/location/full-text fields or indexes without evidence.
- Application summary/detail DTOs and which data/actions are visible to Candidate, scoped Recruiter and Admin.
- Endpoint paths, methods, success/error status mapping and request/response examples after shared API decisions are approved.
- Ownership mapping and the TV2 service entry points TV1's Candidate/Public Portal will consume.

TV2 responsibilities not supplied by Foundation: `status=OPEN` public visibility, company/recruiter scope, Job transitions, Candidate apply eligibility, lifetime Candidate–Job uniqueness, `current_stage` transitions, stage history, retry reconciliation and safe public DTOs.

Illustrative, not implemented:

```js
const jobRepository = new BaseRepository({
  client: createCouchDbClient(),
  schema: jobDocumentSchema,
});
const page = await jobRepository.find(
  { type: 'job', status: 'OPEN' },
  { limit: 25, bookmark },
);
```

TV2 must replace this rough query with its approved selector/sort/index and must not return repository documents directly as public API responses.

## 4. TV3 handoff — Interview, Scoring and Audit

TV3 owns Interview/Scoring/Audit business behavior, schemas, repository/service/API/DTO and audit semantics. Reuse the same shared foundation; do not create a parallel CouchDB client or implement job/application behavior owned by TV2.

TV3 should provide to TV1/TV2:

- Interview endpoints and DTOs: schedule, round, lifecycle/result fields and role/scope behavior.
- Scoring request/output DTO, algorithm/version, COMPLETE/INCOMPLETE representation, freshness/fingerprint and ranking contract.
- Which fields TV1/TV2 may consume and safe redaction of internal evaluation/audit information.
- Audit event proposal: actor/action/subject/time/correlation fields, storage choice, retention, PII policy, allowed readers and failure behavior. Any new CouchDB type needs a formally approved schema change.
- Endpoint/error/status/paging examples after shared API contract approval.

TV3 responsibilities not supplied by Foundation: Application must already be in approved `INTERVIEW` state before Interview creation; deterministic Application+round IDs; idempotent reconciliation; scoring correctness/freshness/ranking; audit persistence and access controls.

Illustrative, not implemented:

```js
const interviewRepository = new BaseRepository({
  client: createCouchDbClient(),
  schema: interviewDocumentSchema,
});
const interview = await interviewRepository.getById(interviewId);
```

## 5. Responsibilities not to duplicate

Do not implement a second copy of:

- Environment loader or DB config parsing.
- CouchDB URL/auth/timeout/Fetch/error mapping.
- BaseRepository CRUD delegation or Zod pass/fail wrapper.
- Readiness endpoint or general API error mapper.

Do implement in the owning module:

- Business IDs, `type`, schema fields and provenance decisions permitted by DATA-02A.
- Authentication principal and service-level authorization after policy approval.
- Domain validation, ownership/state transitions, idempotency and safe DTO projection.
- Mango selectors/filter allowlists and query-specific pagination semantics.
- Module-specific handling of typed DB errors and HTTP translation according to the approved API contract.

TV1's assigned product scope remains Identity, Candidate Profile, Public Portal and Admin; this Stage 03C handoff does not implement those features. TV1 does not own TV2 Job/Application logic or TV3 Interview/Scoring/Audit behavior.

## 6. Integration checklist

- [ ] Import existing `CouchDbClient`/`BaseRepository`; inject a fake client for unit tests.
- [ ] Attach only the owned Zod schema; remember BaseRepository validates create/update only and does not apply Zod transform output.
- [ ] Generate deterministic `_id` and correct `type` in the domain module; Foundation does not generate either.
- [ ] Authorize every request in service/middleware; do not trust `candidate_id`, `company_id` or role supplied by caller.
- [ ] Allowlist selector/sort fields and cap page size.
- [ ] Define stable sort and unique tie-breaker; handle CouchDB bookmark as opaque until shared cursor contract is approved.
- [ ] Handle `NOT_FOUND`, `DATABASE_NOT_FOUND`, `CONFLICT`, `NETWORK_ERROR`, `TIMEOUT`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `SERVER_ERROR` safely.
- [ ] For 409, re-read fresh document, recheck auth/state/idempotency, never blind merge; retry policy awaits group resolution of one vs three attempts.
- [ ] Test no secret/hash/token/raw upstream response reaches API or logs.
- [ ] Use only fake write clients for unit tests; obtain separate approval and DB for live write integration.
- [ ] Propose indexes/views from actual query workload with owner, validation and rollback plan; do not create them as part of repository startup.
- [ ] Return endpoint/DTO contract to consuming TV(s) before building cross-module UI integration.

## 7. Decisions requiring TV1/TV2/TV3 response

1. **Conflict retry:** choose DATA-02A's one conditional retry or reconcile `AGENTS.md`'s up-to-three rule; specify service vs shared client boundary (current client never retries).
2. **API prefix:** confirm `/api` for current MVP or choose `/api/v1`; preserve current health route until explicit migration plan.
3. **Envelope/status mapping:** approve success/error examples, validation details and 400/401/403/404/409/429/500/502/503/504 mapping.
4. **Cursor contract:** approve cursor payload/opacity, filter binding, sort tie-breakers, max page size and stale-cursor behavior.
5. **Auth principal:** define verified principal fields and how Recruiter company/department scope is resolved; no auth principal exists today.
6. **Readiness route:** decide whether internal route remains dev-only, is protected, or removed before wider deployment; currently it has no auth.
7. **Audit persistence:** TV3 proposes event contract/storage/retention/redaction; group approves whether a schema change is needed.
8. **Index lifecycle:** assign owner and review procedure after TV2/TV3 submit query workloads.
9. **Test isolation:** decide how legacy data/release tests will be isolated from shared scratch paths and line-ending-sensitive artifacts.

## 8. Environment and runtime

Backend entrypoint loads process environment first, then existing `backend/.env`, then root `.env`; it does not override process-supplied values or create/copy files. From repository root, set `$env:PORT='5002'` and run `npm.cmd --prefix backend run dev`. From `backend/`, set `$env:PORT='5002'` and run `npm.cmd run dev`.

`GET /api/health` confirms Express only. `GET /api/health/database` is implemented as a read-only, provisional internal check returning readiness, database name and count. It has no auth and must not be exposed publicly without a decision. It never creates DB/index/view/documents.

## 9. Current Foundation limits

- No authentication, route guard, auth principal, service authorization or domain DTO.
- No Job/Application/Interview/Scoring/Audit business repositories or endpoints.
- No stable cursor abstraction or guaranteed sort/index.
- No transactions, bulk method, delete, DB creation, migration, seed or index/view management.
- No client-side conflict retry; update requires caller's expected `_rev`.
- Zod is optional for writes; reads are not validated.
- Shared API prefix/envelope, exact HTTP policy, auth principal, cursor and readiness exposure remain pending.
- `npm.cmd test` is legacy data suite and has known path/checksum/release/failure-injection issues; Stage 03C uses isolated Foundation tests.
## Stage 03D decision update — acknowledge before integration

The current decision log is [`TECHNICAL_DECISION_REGISTER.md`](TECHNICAL_DECISION_REGISTER.md). The following are TV1-endorsed directions only and remain **APPROVED_BY_TV1 — PENDING_TEAM_ACK**, not group-approved:

- **DR-001:** new business routes target `/api/v1`; retain `/api/health` and `/api/health/database` as current operational routes. No domain `/api/v1` implementation exists yet. This supersedes the older Stage 03C `/api` proposal for future domain routes only.
- **DR-002:** JWT HttpOnly cookie and CSRF protection for unsafe methods; TTL, refresh, cookie flags and exact CSRF protocol are still **PENDING**.
- **DR-003:** public Candidate signup; provision Recruiter; no public Recruiter/Admin signup. Activation and invitation flow remain **PENDING**.
- **DR-004:** business-level conditional retry follows DATA-02A, at most once after fresh read, authorization/state/idempotency recheck; otherwise controlled 409. The shared client never retries. `AGENTS.md` still says up to three retries, so reconcile before coding retries.
- **DR-005:** target success `{success:true,data:{...},message?}` and error `{success:false,error:{code,message,details:null}}`; exact HTTP mapping remains **PENDING**. Current helpers are provisional and differ in `details` representation; do not assume runtime conformance.
- **DR-006:** backend RBAC and ownership with canonical `CANDIDATE`, `RECRUITER`, `ADMIN`; principal must be server-verified. Its `req.auth` shape and scope resolution remain **PENDING**.

### TV2 acknowledgement and deliverables

Please reply in the decision register with approver/role/date and:

- [ ] Acknowledge or amend DR-001, DR-004, DR-005 and DR-006 for Job/Application endpoints.
- [ ] Supply Public Job Card/Detail/List DTOs, public-field allowlist, OPEN-only behavior, filters, sort/tie-breaker, cursor/bookmark behavior and error examples.
- [ ] Supply Application create/read/transition/summary DTOs, ownership scope, idempotency and conflict behavior.
- [ ] Submit measured Mango selectors, expected volume and index/view needs for separate review.

### TV3 acknowledgement and deliverables

- [ ] Acknowledge or amend DR-001, DR-004, DR-005 and DR-006 for Interview/Scoring/Ranking endpoints.
- [ ] Supply Interview DTO/lifecycle, Scoring input/output/version/freshness and active/historical Ranking contracts, including safe public fields.
- [ ] Propose Audit event schema, storage, retention, redaction, reader permissions and failure behavior; no extra document type until approved.
- [ ] Submit measured Mango selectors, expected volume and index/view needs for separate review.

### Shared integration checklist

- [ ] Import the existing TV1 `CouchDbClient`, `BaseRepository`, `CouchDbError` and database config; do not fork or duplicate the shared layer.
- [ ] Keep business IDs, `type`, schemas, field allowlists and domain DTO mapping in the owning module.
- [ ] Keep service authorization, ownership, transition checks and idempotency outside BaseRepository.
- [ ] Do not implement a retry count until the `AGENTS.md` versus DATA-02A conflict is resolved; never retry blindly in CouchDbClient.
- [ ] Treat `/api/v1`, response envelope, status mapping, cursor and verified-principal details as target contract pending group acknowledgement; do not represent them as implemented.
- [ ] Keep readiness route internal; it currently has no authentication.
- [ ] Use fake clients for unit tests; do not write to `recruitment_db`. Live-write tests require an explicitly approved isolated database.
- [ ] Propose indexes/views separately with query evidence, review, verification and rollback plan.

TV1 needs the TV2/TV3 DTOs, examples and workload evidence above before it can safely finalize Portal consumers, cross-module error handling, cursor behavior and index coordination. Record every response in the decision register; do not infer agreement from implementation or silence.