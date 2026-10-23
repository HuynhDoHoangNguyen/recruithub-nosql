# RecruiHub NoSQL — TV1 Final Review & PR Preparation

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; review do Codex tổng hợp, chưa gán cá nhân.
- **Mục tiêu:** kiểm tra thay đổi TV1 trước review/PR; không triển khai lại module, không thao tác dữ liệu.
- **Trạng thái:** **PARTIAL — NOT READY TO MERGE**.

## 2. Phạm vi

Đã rà Git status, source/API/Auth/RBAC/profile/admin/public-job adapter, schema DATA-02A, tài liệu, runtime CORS, CouchDB metadata read-only và các test/build/lint được yêu cầu. Không stage, commit, push, merge, reset, clean; không sửa source; không gọi CouchDB mutation. Browser automation không có browser/app surface trong môi trường hiện tại.

## 3. Git và phân loại thay đổi

- Branch đúng: `feature/identity-candidate-portal`.
- Local `dev` và feature branch cùng HEAD `f06f970`; chưa có commit feature mới. Thay đổi đang trong working tree, chưa thể tạo PR chỉ từ branch pointer hiện tại.
- Trước report này: **65 entries chưa stage** (25 modified + 40 untracked); staged diff rỗng. Report này tạo thêm một untracked file. Không stage hoặc sửa thay đổi có sẵn.
- `.env` được Git ignore, không tracked; credentials/JWT secret không xuất hiện trong status. `node_modules` và `frontend/dist` là ignored artifacts. Không thấy dump/backup/zip/log trong thay đổi Git.
- `git diff --check`: PASS; có cảnh báo chuẩn LF→CRLF.
- Backend TV2/TV3 source/routes không bị sửa. Public Job UI/adapter của TV1, Shared Foundation, Auth/Profile/Admin thuộc phạm vi TV1.

### Danh sách dự kiến cho commit TV1

**Shared Foundation / mẫu cấu hình (6):**

- `.env.example`
- `backend/src/app.js`
- `backend/src/repositories/base.repository.js`
- `backend/src/services/couchdb.client.js`
- `backend/tests/foundation/couchdb.client.test.js`
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`

**Auth, Candidate Profile, Admin API (18 source + 9 tests):**

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
- `backend/tests/auth-foundation/domain-routes.test.js`
- `backend/tests/auth-foundation/repositories.test.js`

**Dependency (2):** `backend/package.json`, `backend/package-lock.json` (Argon2).

**Frontend TV1 integration (23):**

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

**Documentation (8 including this report):**

- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/reports/TV1/RP-TV1-finalize-couchdb-real-mvp.md`
- `docs/reports/TV1/RP-TV1-frontend-backend-template-review.md`
- `docs/reports/TV1/RP-TV1-master-branch-completion.md`
- `docs/reports/TV1/RP-TV1-stage-04a-auth-backend-infrastructure.md`
- `docs/reports/TV1/RP-TV1-stage-04b-auth-mvp-integration.md`
- `docs/reports/TV1/RP-TV1-final-review-pr-preparation.md`

The lists cover the 65 existing entries plus this report. Exclude ignored `.env`, credentials, `node_modules`, `frontend/dist`, database files, and CouchDB data. Page diffs have substantial deletions (Landing, JobList, JobDetails, Profile, AdminDashboard); inspect visually before approval.

## 4. Code and architecture review

### Confirmed strengths

- Auth uses Argon2id (`memoryCost=65536`, `timeCost=3`, `parallelism=1`) and HS256 Bearer JWT with 15-minute expiry, issuer/audience and canonical User subject. Authentication reloads User and checks current ACTIVE status; authorization is server-side.
- Candidate registration does not accept role/status/IDs from the client. Deterministic IDs and existing User/Candidate Zod schemas are used. User is staged as RESET_REQUIRED, Candidate is created, then only the new User is conditionally activated. Partial failures leave an inactive staged account.
- Safe User DTO excludes password hash, `_rev` and provenance. Profile ownership derives from authenticated `sub`; patches are allowlisted and require the current ETag revision; CouchDB conflicts map to 409.
- Admin status changes require `If-Match`, cannot change RESET_REQUIRED accounts, and status DTO cannot mutate role. Admin routes require verified ADMIN principal.
- Foundation client uses deterministic IDs and expected `_rev`; it does not automatically retry mutations or create business documents/indexes. Tests use fake clients/repositories.
- Public Jobs is explicitly fixture-backed in development while TV2 API integration is pending; production mode does not silently present fixture data as live.

### Findings / blockers

1. **High — last active Admin protection has a cross-document race.** `AdminUserService.setAccountStatus()` counts ACTIVE Admin documents then updates a different User document. Two concurrent requests can both observe two active Admins, lock different accounts, and leave zero ACTIVE Admins. CouchDB `_rev` protects each document, not this cross-document invariant. No safe fix exists within the current 9-document contract without a coordination design. Do not claim the guard is concurrency-safe; resolve before enabling Admin status mutation in production.
2. **High — current dev CORS origin does not match the running Vite origin.** A read-only OPTIONS request from `http://127.0.0.1:5178` received `Access-Control-Allow-Origin: http://localhost:5173`. Root `.env` has no `FRONTEND_URL` key. Browser calls from the current URL will be blocked. Set `FRONTEND_URL` to the exact UI origin when launching the intended backend. This review did not edit `.env` or restart services; default `localhost:5173` works only for that exact origin.
3. **Medium — Browser UI is not verified.** Browser inventory has no apps/browsers. API/unit tests do not prove forms, navigation, responsive layout, loading/error presentation, or logout click. UI diffs remove substantial code; inspect visually.
4. **Medium — full backend suite remains unverified.** Targeted auth/Foundation tests pass. The legacy data/release suite was not run because prior reports document shared scratch/release side effects and failures; run only after isolation.
5. **Medium — Admin listing/statistics use `_all_docs` prefix scans.** Suitable for current MVP/demo size without unapproved indexes, but cost grows with data volume. Review query/index plan before production-scale use.
6. **Medium — partial registration requires operator reconciliation.** If Candidate creation or User activation fails after User creation, the staged RESET_REQUIRED User remains; retry is reported as duplicate rather than resumed. Safe from unintended activation, but support/reconciliation needs a runbook.
7. **Low/decision — logout is local token deletion only.** There is no server logout/revocation or refresh endpoint. A copied token remains valid until its 15-minute expiry; preserve this as an explicit provisional MVP limitation.
8. **Data contract — Candidate self-registration provenance.** Registration writes `provenance.classification=SOURCE` while `field_origins` says `candidate_self_registration`; DATA-02A describes `source` as directly observed source data. Schema accepts it, but lineage meaning conflicts and should be agreed before analytics rely on it.

No source fix was applied. The Admin locking race requires a shared invariant strategy beyond per-document revision checks; CORS requires exact local-origin configuration; provenance needs an explicit mapping. No speculative source or environment patch was made.

## 5. DATA-02A and integration review

- User type, normalized-email SHA-256 ID, canonical roles/status, Candidate reference and strict Zod validation are used.
- Self-service Candidate ID `candidate:<sha256(userId)>` passes current schema; DATA-02A explicitly documents `candidate:cms:R_<id>` for audited source records. Document the self-service ID variant in the shared contract.
- Registration creates a partial profile and does not fabricate education/employer/project history.
- TV2 owns Job/Application backend and must provide Public Job/Apply DTO/API, OPEN-only rule, filters, sort/cursor, and error contract. Current Job UI is fixture-backed in dev.
- TV3 owns Interview/Scoring/Audit; storage, event, retention and UI contracts remain dependencies. No TV2/TV3 backend source was changed.
- Conflict retry guidance differs (`AGENTS.md` up to 3 vs DATA-02A one conditional retry). Foundation does not retry. Resolve before adding mutation retries.

## 6. Runtime/database safety

- Read-only metadata confirms `recruithub_auth_demo` has 5 documents and `recruitment_db` has 25,750 documents.
- No database writes were made during this review. Previously approved E2E writes remain isolated to `recruithub_auth_demo`.
- No index/view, database, Docker volume or schema was changed.
- Root `.env` remains ignored and untracked; secret values were not displayed.

## 7. Test/build/lint results

| Check | Result |
|---|---|
| Backend auth + Foundation: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 49/49** |
| Frontend tests: `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4** |
| Frontend `npm.cmd run build` | **PASS** |
| Frontend `npm.cmd run lint` | **PASS, 0 errors, 16 warnings** (unused imports/variables and one missing hook dependency in existing pages) |
| `git diff --check` | **PASS**, with standard LF/CRLF warnings |
| CouchDB metadata | **PASS read-only**: demo=5, main=25,750 |
| Browser E2E | **NOT VERIFIED**: no browser surface |
| Legacy backend data/release suite | **NOT RUN**: shared scratch paths without isolation |

## 8. Manual browser acceptance checklist

Use a browser with backend/frontend configured for matching exact origins (`FRONTEND_URL` must equal the frontend origin). Use only the demo DB and synthetic accounts.

- [ ] Landing navigation links lead to `/login`, `/register`, `/jobs`.
- [ ] Register invalid/missing fields shows validation; valid Candidate registration succeeds once; duplicate email shows safe conflict message.
- [ ] Login wrong credentials shows generic error; valid Candidate login reaches Candidate profile/dashboard.
- [ ] Refresh clears memory-only session and protected page redirects; logout click clears local session and returns to public route.
- [ ] Candidate Profile loads, edits an allowed field, saves with latest ETag; stale update displays conflict/reload state.
- [ ] Admin route rejects Candidate; Admin can list/search/page Users, open details, update eligible status and view stats.
- [ ] RESET_REQUIRED and final ACTIVE Admin protections display safe errors.
- [ ] Public Jobs visibly identifies development fixtures; details expose OPEN jobs only; API mode reports pending integration until TV2 handoff.
- [ ] Check loading, empty, error, success; test 360px mobile, tablet and desktop widths.
- [ ] Network panel confirms correct API base/CORS origin and no token in localStorage/sessionStorage.

## 9. Commit grouping proposal (not executed)

1. **Shared Foundation:** CouchDB client/base repository, app wiring, Foundation tests and guide.
2. **TV1 Auth/Profile/Admin backend:** repositories, routes, services, schemas, middleware, tests, and Argon2 dependency lock.
3. **TV1 frontend/Auth/Public Portal:** auth context/API, Login/Register, Profile, Admin dashboard, explicitly fixture-backed Jobs adapter/pages/tests.
4. **Contracts/reports:** decision register, auth contract and TV1 reports. Review reports may be held outside the product commit if the team prefers.

Do not include `.env`, credentials, `node_modules`, `frontend/dist`, data dumps, or DB files. Stage files individually after review; no `git add .`.

### Suggested PR

- **Title:** `feat(tv1): deliver auth, candidate profile, admin and public portal MVP`
- **Description:** Adds the TV1 Shared CouchDB Foundation integration, Candidate registration/login/me with Argon2id and short-lived in-memory Bearer JWT, Candidate Profile GET/PATCH with ownership and ETag conflict checks, Admin User/statistics endpoints, and an explicitly development-only Public Job fixture adapter. Includes focused tests and handoff documentation. Persistence was exercised only against isolated `recruithub_auth_demo`; `recruitment_db` remained read-only. Open items: Admin lock concurrency invariant, browser/CORS verification, TV2 Job/Apply and TV3 Interview/Scoring/Audit contracts, and isolated legacy suite.

## 10. Merge readiness and next steps

**BLOCKED / NOT READY TO MERGE.** Scoped tests/build/lint pass and prior persistence E2E ran only on the approved demo DB. Before approval/merge:

1. Resolve concurrent last-Admin locking with an approved safe design and concurrency regression test.
2. Set matching `FRONTEND_URL`, complete browser acceptance, and visually review substantial page diffs.
3. Approve/correct Candidate provenance semantics and document the self-service Candidate ID variant.
4. Obtain TV2 Public Job/Apply and TV3 Interview/Scoring/Audit contracts; keep adapters gated until handoff.
5. Isolate and run legacy suite if full-suite PASS is a merge criterion.
6. Review and stage the exact file set. Feature and local `dev` currently point to the same commit, so create commit(s) before a PR can exist. No Git mutation was performed.

