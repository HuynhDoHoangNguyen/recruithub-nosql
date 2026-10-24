# TV1 Authentication MVP Contract — Stage 04B

**Status:** Implemented as a provisional TV1 MVP; pending team acknowledgement.
**Branch:** `feature/identity-candidate-portal`
**Authority:** Task-level approval authorizes this implementation for TV1. It does not supersede group policy until TV2/TV3 acknowledge it.

## Scope and ownership

TV1 owns User identity, Candidate registration and authentication. This stage reuses the existing React application, Express `/api/v1` namespace, User/Candidate repositories, DATA-02A schemas and shared CouchDB client. Job/Application APIs remain TV2-owned; Interview/Scoring/Audit remain TV3-owned.

### Recruiter registration proposal (not active)

TV1 proposes adding public Recruiter registration where the applicant declares a **new** Company and a Department belonging to it. No public Admin registration, existing-Company attachment, Company verification/approval workflow, onboarding document, or additional account status is proposed for the MVP. DR-003/DR-019 and TV2 Job ownership have not been approved for this change. A separate `/auth/register/recruiter` endpoint and Register option are implemented behind explicit disabled-by-default flags (`PUBLIC_RECRUITER_REGISTRATION_ENABLED` and `VITE_RECRUITER_REGISTRATION_ENABLED`). Keep both disabled until approvals and the recovery runbook are recorded. The existing `/auth/register` Candidate contract remains unchanged.

Before activation, the group must approve the Auth contract and TV2 must confirm Company/Department/Job ownership and recruiter scope. The current documents have no in-progress marker or idempotency record. Because CouchDB writes across User, Company, Department and Recruiter are not transactional, a partial write cannot safely be resumed automatically. The implemented coordinator stops at the first write error, returns `REGISTRATION_INCOMPLETE` with a non-secret reference and possible document IDs, and performs no retry or compensating delete. Operator reconciliation is required before a new attempt.

Auth denies Recruiter token issuance and rejects Recruiter access at `/auth/me` until it verifies the complete Recruiter, Company and Department references. TV2 Job/Application services independently check ACTIVE role and Recruiter organization scope before protected operations. The Company duplicate check uses NFKC, trim/collapsed whitespace and case-folded names; a match rejects registration and never attaches to the existing document. It scans Company IDs because the current schema has no normalized-name field/index, so this MVP check is linear in the number of Company documents.

The Job schema's ownership references are `recruiter_id`, `company_id`, and `department_id`. Current TV2 code derives these from the authenticated Recruiter on create, rejects client-supplied ownership references, and checks all three on owned Job/Application operations. Current Job routes grant no Admin override. These are observed implementation rules, not TV2 contract approval; confirm them with TV2 before enabling the Recruiter signup flags.

## Implemented API

All domain responses use the current provisional envelope `{success:true,data,message}` or `{success:false,error:{code,message,details}}`.

| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Strict Candidate-only registration. The server assigns `CANDIDATE`; the body cannot choose role/status or document IDs. Returns 201 with a safe User DTO; user signs in separately. |
| POST | `/api/v1/auth/login` | Public | Verifies Argon2id hash and ACTIVE status; returns 200 with in-memory Bearer `accessToken` and safe User DTO. Invalid credentials/status return generic 401. |
| GET | `/api/v1/auth/me` | Bearer | Verifies signature/issuer/audience/expiry, reloads User, checks ACTIVE status, and returns the server-current safe User DTO. |

There is no backend logout or refresh endpoint. Frontend logout clears the in-memory token. Any copied access token remains usable until its 15-minute expiry. A future server-side revocation policy requires a separately approved session store and contract.

## Provisional authentication decisions

- **Password:** Argon2id, 65,536 KiB memory, time cost 3, parallelism 1. The hash is never returned or logged.
- **Access token:** HS256 JWT, 15-minute expiry; claims include `sub`, `role`, `iss`, `aud`, `iat`, `exp`, and `jti`. Signing key comes from `JWT_ACCESS_SECRET`, is not hardcoded, and must contain at least 32 bytes.
- **Storage:** frontend memory only; reload clears authentication. No localStorage, cookie, refresh token, CSRF token, or revocation store.
- **Registration:** public Candidate only. A new User is initially written with `RESET_REQUIRED`; after Candidate creation and schema validation, the new User is activated. Existing `RESET_REQUIRED` accounts are not modified or activated.
- **Candidate fields:** registration collects `full_name`, `candidate_role`, `industry`, `seniority`, and `years_experience`; unprovided required collections remain `[]` with `data_availability` set to `UNAVAILABLE` or `PARTIAL`. Optional fields without values are omitted; no education, skills, or work history is fabricated.
- **IDs:** User uses `userIdFromEmail()`. For self-registration, Candidate ID is `candidateIdFromUserId(user_id)`, implementing `candidate:<sha256(user_id)>` from the canonical User ID. Imported CMS records retain `candidate:cms:<resume_id>`. These namespaces are distinct and accepted by the existing Candidate schema. Existing Candidate and Application IDs are not changed.
- **Provenance:** self-registration documents use classification `mixed`. Submitted profile fields use origin `candidate_self_registration`; `profile.experience_months` uses `derived`. Missing optional fields and empty required collections have no field-origin entry; availability is represented by `data_availability`. New writes reject `unavailable` as a document classification; shared stored-document validation accepts it only for historical compatibility, and PATCH preserves it. This decision was authorized by project-owner delegation for Phase B4.2B on 2026-10-24; it does not imply TV2/TV3 or full-group acknowledgement.
- **Admin account status:** Backend refuses status changes targeting any `ADMIN` account with 403 `ADMIN_STATUS_CHANGE_FORBIDDEN`; Admin list/detail/statistics remain available. Candidate/Recruiter status updates still require current `If-Match` and cannot activate `RESET_REQUIRED`. Admin recovery/status changes are operator-managed outside this MVP.
- **Local CORS:** `FRONTEND_URL` is a comma-separated allowlist of exact `http(s)` origins. The backend allows only configured origins, `Authorization`, `Content-Type`, and `If-Match`; it exposes `ETag` for browser revision handling. The tracked example uses stable `http://localhost:5173`; local root `.env` may list additional actual dev origins and is ignored.
- **RBAC:** `createAuthenticate` creates the server-verified principal after reloading User; `requireRole(...roles)` checks canonical uppercase roles. Frontend guards are UX only.
- **API prefix/envelope/statuses:** follows `/api/v1` and current provisional helper envelope. Cross-team acknowledgement remains pending.

These are implementation settings, not group-wide security approvals. In particular, they differ from DR-002’s earlier cookie/CSRF direction. DR-002/008/009/020 remain pending team acknowledgement.

## Partial writes and duplicate handling

User and Candidate are separate CouchDB documents and cannot be committed transactionally through the current Foundation. Registration stages a new User as `RESET_REQUIRED`, writes the Candidate, then activates the new User using the revision returned from create. Duplicate User IDs map to 409 `EMAIL_ALREADY_REGISTERED`. If Candidate creation or activation fails, registration returns `REGISTRATION_INCOMPLETE` (409 for a revision/ID conflict; 503 for other storage failure); the staged User remains non-login-capable. No blind retry, delete compensation, or activation of an existing reset-required User is performed. Such partial records require explicit operator reconciliation.

## Frontend integration

The existing Login, Register, Navbar, ProtectedRoute, routes, and visual classes are reused. Registration remains Candidate-only and gathers schema-required profile summary fields. The shared Axios client reads the token from memory and adds the Bearer header. The compatibility import `api/axiosClient.js` re-exports that same instance. Login calls `/auth/login`, then verifies `/auth/me`; logout is local and does not contact an external host.

The API base defaults to `http://127.0.0.1:5002/api`; override with `VITE_API_BASE_URL`. The backend requires a strong, random `JWT_ACCESS_SECRET` and an explicit `AUTH_COUCHDB_DATABASE` that is not `recruitment_db`. Auth persistence refuses to use the existing `recruitment_db` and does not create a database. Only placeholders are tracked in `.env.example`; the ignored local root `.env` contains a generated `JWT_ACCESS_SECRET`. No isolated auth database is configured, and the protected `recruitment_db` remains forbidden for auth writes.

## Security and limitations

- Never log passwords, Argon2 hashes, Authorization headers, JWTs, or CouchDB credentials.
- Auth route errors are sanitized; request validation does not return submitted values or Zod detail paths.
- Login does not expose whether an email exists or whether its account is inactive.
- JWT revocation is not available; local logout cannot invalidate a copied token before expiry.
- No rate limiting, email verification, password reset, lockout policy, refresh rotation, ADMIN bootstrap, Recruiter signup, or audit persistence is implemented.
- The existing local CouchDB database was not written during tests. No live write verification was run; tests use fake in-memory repositories.
- Targeted backend tests and frontend token helper tests are documented in the Stage 04B TV1 report. The legacy `npm test` suite is not part of this task because it operates on data/release scratch paths.

## Group decisions still required

TV2/TV3/group must acknowledge the Bearer-vs-cookie direction, 15-minute expiry/no refresh, Argon2 parameters, ACTIVE Candidate activation after two-document creation, API response/error envelope, conflict handling, and operational recovery for `REGISTRATION_INCOMPLETE`. Until then, treat all Stage 04B decisions as provisional TV1 implementation choices.


## Stage 05?10 TV1 API amendment (2026-10-23)

These routes are implemented in source and covered by fake-repository/unit route tests. Live CouchDB persistence remains unverified because no isolated auth database is available.

| Method | Path | Auth | Contract / boundary |
|---|---|---|---|
| GET | `/api/v1/candidate/profile/me` | ACTIVE CANDIDATE | Returns allowlisted Candidate profile fields only; revision is returned as ETag. |
| PATCH | `/api/v1/candidate/profile/me` | ACTIVE CANDIDATE | Strict allowlisted profile patch; requires `If-Match`; validates merged document against DATA-02A; 409 on stale revision; no automatic retry. |
| GET | `/api/v1/admin/users` | ACTIVE ADMIN | Search by normalized email prefix, role/status filter, bounded 1?50 page, filter-bound cursor; hashes/provenance are excluded. |
| GET | `/api/v1/admin/users/:id` | ACTIVE ADMIN | Safe User DTO and revision ETag. |
| PATCH | `/api/v1/admin/users/:id/status` | ACTIVE ADMIN | Only Candidate/Recruiter targets are eligible; requires `If-Match`; refuses RESET_REQUIRED changes. Any ADMIN target returns 403 `ADMIN_STATUS_CHANGE_FORBIDDEN`. Admin recovery/status changes are operator-managed outside the MVP. Role is immutable. |
| GET | `/api/v1/admin/stats` | ACTIVE ADMIN | Actual User/Candidate counts and User role/status distributions. No Job/Application/Interview metrics are fabricated. |

### Candidate profile DTO

```json
{
  "profile": { "full_name": "...", "role": "...", "industry": "...", "seniority": "MID", "years_experience": 3, "experience_months": 36, "summary": "..." },
  "skills": [{ "name": "React", "normalized": "react" }],
  "education": [],
  "experience": [],
  "projects": [],
  "data_availability": { "skills": "PARTIAL", "experience": "UNAVAILABLE", "education": "UNAVAILABLE", "projects": "UNAVAILABLE" }
}
```

### Admin DTO and status changes

User DTO contains only `id`, `email`, `role`, `account_status`, `created_at`, and `updated_at`. Admin APIs never return `password_hash`, `_rev` in JSON, or provenance. ETag carries the current revision for details/status updates. Existing RESET_REQUIRED seeded users remain unchanged and cannot be activated by this route. No ADMIN bootstrap or public Admin registration exists. Admin status changes and recovery are operator-managed outside the MVP.

### Authorization utilities

`requireRole(...roles)` uses the server-verified `req.auth` principal. `requireOwnership({loadResource,getOwnerId,getResourceId})` and `requireScope({resolveAllowedScopes,getRequestedScope})` are reusable middleware helpers. Candidate profile service independently resolves by principal User ID and verifies document ownership. TV2/TV3 must provide authoritative scope resolvers; callers must not trust owner IDs from request bodies.

### Public Job Portal status

Landing, JobList and JobDetails use `publicJobsApi`. In Vite development, the adapter defaults to isolated fixtures under `frontend/src/mocks/publicJobs.js` and visibly labels them as fixtures. Production mode returns an integration-pending error until TV2 supplies an approved public Job DTO/query/cursor contract. No TV2 Backend route or Apply API was created; the apply action is explicitly pending. Fixtures are not CouchDB documents and the adapter refuses to return them when `import.meta.env.DEV` is false.

### Read and pagination implementation notes

Admin listing/statistics use CouchDB built-in `_all_docs` ID-prefix range through `listDocumentsByIdPrefix` because the repository has no approved custom indexes. This scans matching documents in bounded batches and filters in the service. It is appropriate only for current MVP/dev scale; review an indexed list/stats strategy with query-volume evidence before production. No index, view, or design document is created.

## Current environment verification amendment

At the 2026-10-23 master-task verification, Docker daemon and CouchDB port 5984 were unavailable, and `AUTH_COUCHDB_DATABASE` was absent. Backend source was started on port 5003 (not port 5000); health returned 200, unauthenticated `/auth/me` returned 401, and valid-shaped login/register requests returned the isolated-database configuration guard (503) before any CouchDB request. Full Register ? Login ? Me ? Logout E2E against live persistence remains blocked.
