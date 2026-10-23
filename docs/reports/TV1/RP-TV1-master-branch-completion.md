# RecruiHub NoSQL - TV1 Branch Completion (Stages 04C-11)

## 1. Stage information and overall status

- **Date:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Owner:** TV1; technical report compiled by Codex.
- **Overall acceptance:** **PARTIAL**. TV1-owned slices are implemented and targeted tests pass, but live persistence verification and cross-team integrations remain blocked by environment and contract dependencies.

## 2. Objective and scope

Complete the TV1 scope from Stage 04C through Stage 11 using the existing React and Express applications. Preserve the existing app structure, avoid changes to approved document schemas, do not write to the existing database, and identify work still owned by TV2/TV3. No commit, push, merge, reset, clean, fetch, or pull was performed.

## 3. Initial checks and constraints

- Confirmed branch `feature/identity-candidate-portal`.
- The working tree already contained uncommitted Stage 04A/04B changes; these were preserved. No staged changes were present at the start of this master task.
- Reviewed `AGENTS.md`, team assignment, DATA-02A, Shared Foundation Contract, TV1 Auth Module Contract, Technical Decision Register, and the relevant backend/frontend source and schemas.
- TV2 public Job/Application API contracts and TV3 Interview/Scoring/Audit implementations were not present for integration.
- Docker daemon was unavailable and CouchDB port 5984 was not listening during this task. The existing `recruitment_db` was not queried.
- Root `.env` contains the previously authorized local JWT key; its value was not displayed or logged. `AUTH_COUCHDB_DATABASE` is not configured.
- Port 5000 was not used. Backend was started on 5003. Port 5173 was occupied by another service and left untouched; the frontend task server was started on 5174.

## 4. Stage-by-stage outcome

| Stage | Outcome | Evidence and limits |
|---|---|---|
| 04C Auth runtime and E2E | **PARTIAL / environment-blocked** | Current backend source on port 5003: `/api/health` returns 200, `/api/v1/auth/me` returns 401 without a token, and valid-shape login/register requests return 503 `AUTH_DATABASE_CONFIGURATION_ERROR` before any CouchDB request. Live persistence E2E could not run without an isolated database. Fake-repository tests cover hashing, JWT, expiry, duplicates, account status, and partial writes. |
| 05 RBAC and ownership | **Implemented; isolated tests pass** | Server-verified principal, role, ownership, and scope middleware. Candidate profile queries use the authenticated user identity. No live identity store was available. |
| 06 Candidate Profile | **Implemented; persistence unverified** | `GET/PATCH /api/v1/candidate/profile/me`, strict field allowlist, merged DATA-02A validation, ETag/If-Match, and 409 handling without blind merge or automatic retry. Existing Profile page was reused with loading/error/success/edit states. |
| 07 Auth Frontend | **Implemented; browser E2E unverified** | Existing Login/Register/AuthContext/Navbar/ProtectedRoute and service structure reused. Access token is memory-only; 401 clears client session; logout is local. Build and helper tests pass. |
| 08 Public Job Portal | **PARTIAL; TV2 integration pending** | Existing Landing, JobList, and JobDetails pages reused with a development fixture adapter: OPEN-only data, search/filter/sort/page/detail and honest loading/empty/error states. No Job or Apply API was created. |
| 09 Admin User Management | **Implemented; live access pending** | ADMIN-only list/detail/status APIs, bounded search/filter/pagination, safe DTO, If-Match, ACTIVE/LOCKED transitions only, refusal to modify RESET_REQUIRED accounts, no role edits, and last-active-Admin protection. Existing Admin Dashboard reused. No Admin bootstrap policy/account exists. |
| 10 Admin Statistics | **Implemented; live values unverified** | User/Candidate/role/status counts are calculated from repository data. No fabricated Job/Application/Interview metrics were added because those APIs are owned by TV2/TV3. |
| 11 Integration and handoff | **PARTIAL** | Targeted backend/frontend tests, frontend build/lint, and guarded HTTP smoke checks completed. Handoffs and limitations documented. The legacy full backend suite was not run because it operates on shared scratch/release paths and has prior recorded failures. |

## 5. Implemented API surface

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/v1/auth/register` | Public Candidate registration |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/auth/me` | Valid Bearer token |
| GET | `/api/v1/candidate/profile/me` | ACTIVE CANDIDATE |
| PATCH | `/api/v1/candidate/profile/me` | ACTIVE CANDIDATE, requires `If-Match` |
| GET | `/api/v1/admin/users` | ACTIVE ADMIN |
| GET | `/api/v1/admin/users/:id` | ACTIVE ADMIN |
| PATCH | `/api/v1/admin/users/:id/status` | ACTIVE ADMIN, requires `If-Match` |
| GET | `/api/v1/admin/stats` | ACTIVE ADMIN |

These routes exist in source; live CouchDB persistence for protected domain operations was not verified. Auth logout remains frontend-local. There is no refresh/session store or server-side token revocation endpoint. A Public Job API is not implemented.

## 6. Database and data safety

- No successful Docker control command; Docker daemon unavailable. CouchDB was not listening on port 5984 at the time of verification.
- No CouchDB query or write was performed in this task. No database, index, view, seed, migration, or document was created or changed.
- `recruitment_db` was not touched. Auth configuration requires `AUTH_COUCHDB_DATABASE` to name a database other than `recruitment_db`; it does not create a database.
- Current document count was not verified in this task; earlier runtime counts are not treated as current evidence.
- The previously authorized random `JWT_ACCESS_SECRET` remains only in the ignored root `.env`; the value is omitted from this report. `.env.example` contains a placeholder only.

## 7. Tests and verification

| Command/check | Result |
|---|---|
| Backend: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 49/49**: auth, RBAC/ownership/scope, Candidate profile, Admin services/routes, and CouchDB Foundation, including the read-only `_all_docs` wrapper. |
| Frontend: `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4**: memory token/logout and public job filtering, sorting, paging, and OPEN-only model. |
| Frontend: `npm.cmd run build` | **PASS**: Vite production build. |
| Frontend: `npm.cmd run lint` | **PASS**: exit 0, 0 errors, 16 warnings. Remaining warnings are in legacy App/dashboard/job code; no warning was reported for the new Profile/Admin/JobList/JobDetails/auth modules. |
| Backend HTTP smoke on port 5003 | **PASS for guarded behavior**: health 200; unauthenticated `/auth/me` 401; valid-shape login/register 503 from the isolated database guard, before a CouchDB request. |
| Frontend URL | `http://127.0.0.1:5174/` returned HTTP 200. Port 5173 was occupied by another service and was left unchanged. |
| Legacy full `npm test` | **NOT RUN**: suite has shared scratch/release side effects and previously recorded data-pipeline failures. |

## 8. Files created or updated in the master scope

### Backend

- Added `backend/src/config/auth-database.config.js`, `backend/src/middleware/authorize.js`, `backend/src/schemas/candidate-profile.schema.js`, `backend/src/services/candidate-profile.service.js`, `backend/src/services/admin-user.service.js`, `backend/src/utils/send-api-error.js`, `backend/src/routes/candidate-profile.routes.js`, and `backend/src/routes/admin-user.routes.js`.
- Updated `backend/src/routes/auth.routes.js`, `backend/src/routes/api-v1.routes.js`, `backend/src/services/couchdb.client.js`, `backend/src/repositories/base.repository.js`, `backend/src/repositories/user.repository.js`, and `backend/src/repositories/candidate.repository.js`.
- Added isolated tests for Admin, authorization, Candidate profile, and domain routes; updated API and CouchDB Foundation tests.

### Frontend and documentation

- Reused/updated `frontend/src/pages/Profile.jsx`, `frontend/src/pages/Dashboard/AdminDashboard.jsx`, `frontend/src/pages/Jobs/JobList.jsx`, `frontend/src/pages/Jobs/JobDetails.jsx`, `frontend/src/pages/Landing.jsx`, and `frontend/src/routes/AppRoutes.jsx`.
- Added the development fixture/model adapter `frontend/src/mocks/publicJobs.js`, `frontend/src/services/publicJobsApi.js`, `frontend/src/services/publicJobsModel.js`, and public-job tests.
- Updated `docs/shared/TV1_AUTH_MODULE_CONTRACT.md` and `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`; created this report.
- No dataset, schema, manifest, Docker configuration, audit report, or real `.env` file was modified in this master task.

## 9. Decisions and team dependencies

- **TV2:** Public Job card/detail/list DTO, OPEN filter, public field allowlist, filters, stable sort/tie-breaker, cursor and status/error contract; Application apply/status API. Until then, the portal uses development fixtures only.
- **TV3:** Interview, Scoring, Ranking, and Audit DTOs/APIs, storage, retention, and access policy. No TV3 module was modified.
- **Group/maintainer:** acknowledgement of provisional Stage 04B Bearer-vs-cookie choice, Argon2 parameters, Candidate activation and partial-write reconciliation, API envelope/status, DATA-02A one conditional retry versus `AGENTS.md` three retries, Admin bootstrap/recovery, test isolation, and index governance.
- No default Admin was created. Existing RESET_REQUIRED accounts were not activated or modified.

## 10. Risks and blockers

- No local Docker/CouchDB service and no isolated auth DB; live registration, profile persistence, Admin actions, and DB-backed statistics cannot be verified.
- Admin bootstrap/recovery policy and account are absent; Admin features are protected and unit-tested only.
- Public Job/Apply integration depends on TV2; Interview/Audit integration depends on TV3.
- Admin listing/statistics use bounded built-in `_all_docs` prefix scans because custom indexes are not approved. The reads are bounded but can be expensive at scale; measure before production use.
- User and Candidate creation are two CouchDB writes, not a transaction. Partial failures leave a non-active User for operator reconciliation; there is no automatic delete compensation.
- Bearer JWT has no refresh/revocation. Local logout clears memory; a copied token remains usable until expiry. Rate limiting, reset flow, email verification, and audit persistence remain out of scope or pending.
- Frontend lint reports 16 non-fatal warnings. The legacy full backend suite remains unverified in this task.

## 11. Acceptance status

**PARTIAL.** TV1-owned source slices for auth, role/ownership, Candidate profile, public portal UI scaffold, Admin User actions, and data-derived User statistics are implemented, and the isolated targeted test suites pass. The branch is not ready for full acceptance because live persistence is blocked by unavailable isolated CouchDB, Admin bootstrap is pending, and TV2/TV3 contracts are not integrated. No claim of complete branch acceptance is made.

## 12. Git status and preservation

- Branch remains `feature/identity-candidate-portal`.
- No stage, commit, push, merge, reset, clean, fetch, or pull was performed.
- Initial uncommitted Stage 04A/04B changes were preserved. New TV1 files remain uncommitted; the local `.env` remains ignored.
- `git diff --check` passed. The complete final working-tree status is available from `git status --short --untracked-files=all`.

## 13. Next steps

1. Restore local Docker/CouchDB availability and inspect protected database names read-only. Separately authorize and prepare a uniquely named empty auth demo database; configure `AUTH_COUCHDB_DATABASE` only for that isolated database.
2. Start the current backend source on the agreed development port (never 5000) and verify Register -> Login -> Me -> local Logout, duplicate handling, expiry, and account status only against the isolated database.
3. Obtain Admin bootstrap/recovery approval before any live Admin account. Then verify User listing and statistics read-only and status changes only in the isolated database.
4. Obtain TV2 Public Job/Apply and TV3 contracts; replace the development fixture adapter only after the approved API contract and add consumer contract tests.
5. Isolate legacy data tests in a temporary repository, reconcile the revision retry policy, then run the final Stage 11 verification and update this report.
