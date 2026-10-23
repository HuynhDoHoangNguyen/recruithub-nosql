# RecruiHub NoSQL — TV1 Final Commit & PR Readiness

## 1. Scope and Git state

- **Date:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **HEAD:** `f06f970`; local `dev` also points to `f06f970` (read-only comparison; no fetch).
- **Before this report:** 69 modified/untracked entries, no staged changes. This report makes 70 entries.
- No stage, commit, push, merge, reset, clean or stash was performed. All prior worktree changes were preserved.
- `.env` is ignored by `.gitignore` and is not tracked. `node_modules/` and `frontend/dist/` are ignored. No database dump, backup, runtime log or credential file is in the changed-file set. A scan found no embedded JWT/private-key pattern in source and reports; `.env` was excluded from scanning/output.
- `git diff --check` passes; Git prints standard LF-to-CRLF warnings. There is no staged content to validate yet. Re-run staged diff/secret checks after an authorized manual staging step.

## 2. File classification

All current changes are TV1 implementation, shared foundation, or TV1 documentation. No changed path belongs to TV2/TV3 backend business source. There are no additional unrelated or temporary source files. Build artifacts remain ignored.

### Proposed commit 1 — Shared CouchDB Foundation (6 files)

- `.env.example`
- `backend/src/app.js`
- `backend/src/repositories/base.repository.js`
- `backend/src/services/couchdb.client.js`
- `backend/tests/foundation/couchdb.client.test.js`
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`

These contain shared DB integration/config examples, repository/client behavior, app wiring and focused tests. `.env.example` also contains auth-related placeholders; it is intentionally shared. `app.js` contains both Foundation/CORS wiring and `/api/v1` mounting, so it overlaps with Auth and should stay in this foundational commit or be split only after reviewing its complete staged diff.

### Proposed commit 2 — TV1 Auth/Profile/Admin Backend (30 files)

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/config/auth-database.config.js`
- `backend/src/middleware/authenticate.js`
- `backend/src/middleware/authorize.js`
- `backend/src/middleware/validate-body.js`
- `backend/src/repositories/candidate.repository.js`
- `backend/src/repositories/user.repository.js`
- `backend/src/routes/admin-user.routes.js`
- `backend/src/routes/api-v1.routes.js`
- `backend/src/routes/auth.routes.js`
- `backend/src/routes/candidate-profile.routes.js`
- `backend/src/schemas/auth-request.schema.js`
- `backend/src/schemas/candidate-profile.schema.js`
- `backend/src/services/admin-user.service.js`
- `backend/src/services/auth.service.js`
- `backend/src/services/candidate-profile.service.js`
- `backend/src/services/jwt-access-token.js`
- `backend/src/services/user.dto.js`
- `backend/src/utils/send-api-error.js`
- `backend/tests/auth-foundation/admin-user.service.test.js`
- `backend/tests/auth-foundation/api-v1.test.js`
- `backend/tests/auth-foundation/auth-contract.test.js`
- `backend/tests/auth-foundation/auth-mvp.test.js`
- `backend/tests/auth-foundation/auth-routes.test.js`
- `backend/tests/auth-foundation/authorization.test.js`
- `backend/tests/auth-foundation/candidate-profile.test.js`
- `backend/tests/auth-foundation/cors.test.js`
- `backend/tests/auth-foundation/domain-routes.test.js`
- `backend/tests/auth-foundation/repositories.test.js`

Argon2 is the package/lockfile change. No credentials are part of this group. `backend/src/app.js` and `.env.example` are shared with commit 1, not duplicated here.

### Proposed commit 3 — TV1 Frontend and Public Job development adapter (23 files)

- `frontend/.env.example`
- `frontend/src/api/axiosClient.js`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/auth-context.js`
- `frontend/src/context/useAuth.js`
- `frontend/src/index.css`
- `frontend/src/mocks/publicJobs.js`
- `frontend/src/pages/Dashboard/AdminDashboard.jsx`
- `frontend/src/pages/Jobs/JobDetails.jsx`
- `frontend/src/pages/Jobs/JobList.jsx`
- `frontend/src/pages/Landing.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/services/api.js`
- `frontend/src/services/publicJobsApi.js`
- `frontend/src/services/publicJobsModel.js`
- `frontend/src/utils/authHelper.js`
- `frontend/tests/auth/auth-helper.test.js`
- `frontend/tests/public-jobs/public-jobs.test.js`

This group adapts the existing React shell and provides development-only public-job fixtures. `frontend/.env.example` is the only config overlap with backend integration; it contains a placeholder API URL, no secrets.

### Proposed commit 4 — Contracts and TV1 reports (11 files)

- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/reports/TV1/RP-TV1-final-review-pr-preparation.md`
- `docs/reports/TV1/RP-TV1-finalize-couchdb-real-mvp.md`
- `docs/reports/TV1/RP-TV1-frontend-backend-template-review.md`
- `docs/reports/TV1/RP-TV1-master-branch-completion.md`
- `docs/reports/TV1/RP-TV1-pre-merge-blocker-fix.md`
- `docs/reports/TV1/RP-TV1-runtime-ui-acceptance.md`
- `docs/reports/TV1/RP-TV1-stage-04a-auth-backend-infrastructure.md`
- `docs/reports/TV1/RP-TV1-stage-04b-auth-mvp-integration.md`
- `docs/reports/TV1/RP-TV1-final-commit-pr-readiness.md`

Reports can be kept in a separate documentation commit or omitted from the product PR by team agreement. Do not omit the contract/decision record while presenting unresolved policies as approved.

## 3. Frontend deletion review

The five substantially shortened pages total roughly 1,257 lines at HEAD and 518 lines in the working copy. Build and lint establish syntax/quality, not visual or product equivalence. The current routes still include Landing, Login, Register, Jobs, Job Details, Candidate Profile, Admin Dashboard and existing Recruiter/Job Seeker dashboards.

Diff review found these visible template capabilities removed or narrowed:

- **Landing:** the previous inline job search/location preview is gone; the page now links to the Jobs page.
- **Job List:** previous location, company, skills and work-mode filter controls and salary/location display are absent from the current fixture-backed page; current filters are search, industry and seniority.
- **Job Details:** previous salary/location/experience display and Apply/Withdraw UI are gone. The old calls targeted `/apply`, which is not implemented in this backend; TV2 owns that API and the replacement page explicitly says application integration is pending.
- **Candidate Profile:** the legacy location, resume-link and certification fields are not represented in the current DATA-02A profile form. The current page edits fields in the approved Candidate schema and supports education, experience, projects and skills.
- **Admin Dashboard:** the legacy All Jobs panel and delete-user/delete-job actions are gone. Those called `/admin/jobs`, user-delete and job-delete routes absent from the current backend; TV1 Admin scope now lists/details users and changes eligible non-Admin account status, while Job management is TV2-owned.

These removed calls were not backed by current server endpoints and some used legacy fields outside DATA-02A, so replacing them avoids presenting unsupported operations as working. Still, this is a material change from the prior template and the task explicitly asks to preserve existing UI. Browser visual comparison is unavailable. **Get TV1/product and TV2 acknowledgement that these legacy affordances may remain removed or be deferred before merge.** No source edits were made in this finalization review.

Public Job fixtures are gated by `import.meta.env.DEV`; production builds do not serve fixtures and instead report the TV2 API integration pending. No TV2/TV3 source was changed.

## 4. Final quality gate

| Check | Result |
|---|---|
| Backend Auth/Foundation tests | **PASS 52/52** — includes Admin-target status rejection/concurrency, CORS, auth/profile and Foundation behavior |
| Frontend tests | **PASS 4/4** |
| Frontend production build | **PASS** |
| Frontend lint | **PASS**, 0 errors, 16 warnings in existing general pages/components |
| `git diff --check` | **PASS**, LF/CRLF advisory warnings only |
| Root `.env` | ignored and untracked; no embedded JWT/private-key patterns found in source/report scan; `.env` was excluded and is ignored; staged area is empty |
| TV2/TV3 backend source | no changed paths found |
| Legacy data/release tests | not run; shared scratch/release side effects are documented |
| Browser E2E | not verified; no browser surface available |
| CouchDB metadata (read-only) | demo `recruithub_auth_demo`: 11 docs; `recruitment_db`: 25,750 docs |

The demo count includes three synthetic Candidate registrations from the prior runtime acceptance. This audit performed metadata reads only; it did not mutate CouchDB.

Admin service retains the restricted policy: all status changes targeting an ADMIN return 403 `ADMIN_STATUS_CHANGE_FORBIDDEN`; eligible Candidate/Recruiter changes require current `If-Match`; RESET_REQUIRED remains protected. CORS uses exact-origin allowlisting with `Authorization`, `Content-Type`, `If-Match` and exposed `ETag`.

## 5. Pending contracts and dependencies

- Candidate self-registration provenance classification/field origins: **PENDING** data-owner decision.
- Self-service Candidate ID convention `candidate:<sha256(user_id)>`: **PENDING** team acknowledgement; do not change DATA-02A silently.
- Mutation retry conflict between DATA-02A (one conditional retry) and `AGENTS.md` (up to three): **PENDING** reconciliation; Foundation does not retry mutations.
- TV2: Public Job/Apply API/DTO, OPEN-only policy, filters, pagination and error contract.
- TV3: Interview/Scoring/Audit API/DTO, storage, retention and redaction policy.
- Browser visual, interaction and responsive acceptance: **PENDING**.

No DATA-02A or shared business contract was edited in this task.

## 6. PR proposal and merge status

**Suggested title:** `feat(tv1): add identity, candidate profile and public portal MVP`

**Suggested description:** Implements the TV1 Shared CouchDB Foundation integration, Candidate registration/login/current-user and profile APIs, server-side authorization, Admin User/statistics APIs, and integration with the existing React app. Uses Argon2id and short-lived memory-only Bearer JWT under provisional TV1 decisions. Public Job fixtures are development-only; production waits for the TV2 API contract. Focused backend/frontend tests and frontend build pass. Runtime API E2E was exercised only against isolated `recruithub_auth_demo` (11 docs); `recruitment_db` stayed at 25,750 docs. Browser E2E and TV2/TV3 integrations remain pending.

**Status: BLOCKED pending UI-scope acknowledgement and browser review.** The implementation and targeted quality gates are green, but substantial prior-template behavior has been removed/narrowed, browser equivalence cannot be verified here, and the feature branch still points to the same commit as `dev` with all work unstaged. Before committing/merging, obtain acknowledgement on the removed/deferred UI affordances, complete the manual browser checklist, and agree how pending team decisions/dependencies are represented in the PR. Then stage only the four reviewed groups and inspect staged diffs (`git diff --cached --stat`, `git diff --cached --check`, and a secret scan) before creating commits.

