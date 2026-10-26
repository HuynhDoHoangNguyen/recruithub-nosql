# TV1–TV2 Job Portal Handoff and Integration Audit

**Audit date:** 2026-10-26 (Asia/Saigon)  
**Scope:** read-only review of TV1/TV2 ownership, current frontend/backend integration, Git merge state, and safe GET-only runtime behavior.  
**Status:** PARTIAL. The public Job list is available against the configured database, but source/runtime mismatches and a CLOSED-detail regression remain. Browser interaction was not verified.

## 1. Safety and Git state

This audit did not modify application source, configuration, CouchDB documents, indexes, views, or databases. Runtime checks used GET requests only. No branch switch, merge completion, abort, reset, stash, stage, commit, or push was performed.

The repository is on `feature/admin-management` at `2c2610b`, with an active merge from `dev` (`MERGE_HEAD=522d3f5`). Four unresolved paths were present:

| Path | Git state | Finding / recommended resolution |
|---|---|---|
| `.env.example` | UU | Preserve both documented backend settings, reconcile duplicate/conflicting names, and keep placeholders only. Never copy local credentials. |
| `frontend/.env.example` | UU | Keep one canonical API base URL and document optional fixture mode as explicit development-only opt-in. |
| `frontend/vite.config.js` | UU | Combine non-overlapping Vite configuration and retain a single test/plugin setup; verify build and test behavior after resolution. |
| `docs/reports/TV1/RP-TV1-UC06-job-search-filter-pagination.md` | DU | Incoming branch deleted the report while current branch modified it. Retain the report content in the TV1 consolidated record or restore it as a standalone report, then update links consistently. |

At the time of the initial audit, these paths were unresolved. Following the user's explicit request to resolve the conflicts, the four paths were resolved and staged on 2026-10-26:

- Root environment example keeps public/read-only catalog on `recruitment_db` and uses a named isolated database for Auth/protected writes by default. No local credentials were copied.
- Frontend environment example uses the same-origin `/api` base path and documents the Vite proxy, optional development fixtures, and disabled Recruiter signup.
- Vite config combines the existing portal port 5177 and cache directory with the incoming `/api` proxy and environment-derived backend port.
- The UC06 report was restored from the incoming `dev` version, preserving the standalone report rather than dropping it.

All four paths are resolved in the index; no unmerged entries remain for them. The merge itself is still in progress and has not been committed.

## 2. Ownership and handoff

- **TV1 owns** the Public Job Portal frontend: list, filters, pagination, detail presentation, and the consumer adapter.
- **TV2 owns** Job/Application backend data and services: Job repository/service, public Job API, Application lifecycle, applicant and stage operations.
- TV1 should consume the TV2 public API and must not implement a parallel Job repository/service.
- TV3 owns Interview, scoring/ranking, and audit behavior; those are adjacent dependencies, not part of this Job Portal audit.

## 3. Source integration findings

The frontend adapter calls the shared Job API for list and detail requests. Local fixtures are used only when development mode is active and `VITE_PUBLIC_JOBS_MODE=fixtures` is explicitly selected. API errors do not silently fall back to fixtures. The local frontend env file points at the backend on port 5010 and does not enable fixture mode.

The backend mounts TV2 Job routes under `/api/v1`. The current list service returns OPEN, non-deleted jobs, supports bounded queries and bookmark pagination, and enriches list items with safe company data. The detail service currently rejects non-OPEN jobs with 404 and its returned DTO omits `company_logo_url`.

The frontend detail adapter is prepared to normalize both OPEN and CLOSED items. This is inconsistent with the current backend detail policy. TV2's merge-repair report describes CLOSED job history as available, while the current service source and test result disagree. The public detail DTO also lacks a company logo although TV2's status report calls this an outstanding issue.

## 4. Read-only runtime checks

| GET check | Result |
|---|---|
| `/api/health` on port 5010 | 200 |
| `/api/health/database` | 200; database reports `recruitment_db`, 25,755 documents |
| Public Job list, all cursor pages | 4 pages, 200 unique items, all OPEN |
| Detail for a listed OPEN job | 200, status OPEN |
| List filtered by a returned industry's exact value | 200, 5 items, all OPEN |
| List filtered by a returned seniority value | 200, 5 items, all OPEN |
| List with `q=developer` | 200, 0 results; one query alone does not establish a search defect |
| `/api/v1/jobs/metadata` | 400, despite a corresponding route in current source |
| Frontend `/jobs` on ports 5177 and 5173 | 200 HTML only; SPA fallback is not proof of browser rendering |

The running process identity was not established. The metadata 400 and its response shape differ from the current source expectations, so a stale/different running backend is a plausible explanation, not a proven one. Historical TV2 documents record 25,761 documents after prior design/index installation; this audit observed 25,755 via the current health route. No attempt was made to reconcile or change that difference.

## 5. Verification

Safe in-memory tests run for this audit:

- Backend `tests/recruitment/public-catalog.test.js`: **4/4 PASS**.
- Backend `tests/recruitment/public-jobs.test.js`: **1 PASS, 1 FAIL**. Pagination passed. The CLOSED-detail test expects 200 but receives 404, matching the current source's OPEN-only detail restriction.
- Frontend `tests/public-jobs/job-list.test.jsx`: **6/6 PASS** with mocked API behavior.

Full suites were not run. No CouchDB write or browser E2E was performed. Browser automation reported no available browser surface.

## 6. Required integration follow-up

1. Resolve the four Git conflicts under an explicitly scoped merge review; keep local secrets out of tracked examples.
2. TV2 and TV1 agree on whether CLOSED job detail is allowed for candidate application history. Align route/service/DTO, adapter, UI, and regression tests to that policy.
3. Add the approved company logo field to public detail responses, or remove the frontend expectation if that field is not part of the approved public DTO.
4. Investigate why the live metadata endpoint returns 400 and confirm which backend source/process is listening before claiming runtime parity.
5. Run the agreed frontend/backend integration and browser acceptance checks after merge resolution. Keep all destructive or write tests isolated from `recruitment_db` unless the project owner explicitly scopes them.

## 7. Answers to the requested review points

**A. Ownership:** TV1 owns the portal UI and API consumer; TV2 owns the Job/Application backend and public Job API; TV3 owns Interview/scoring/audit.

**B. Current connection:** the frontend source calls the TV2 Job API. In the inspected local setup, API mode is configured; fixture mode requires an explicit development flag. A 200 from Vite only proves the SPA fallback responds.

**C. Runtime:** the backend on port 5010 serves health and a real OPEN Job catalog from `recruitment_db`; four list pages returned 200 records. Metadata returned 400 and may reflect source/runtime drift. No browser validation was possible.

**D. Blockers:** CLOSED detail policy/test mismatch, missing company logo on detail, metadata endpoint mismatch, unresolved merge paths, and unavailable browser E2E.

**E. Data safety:** this audit sent only GET requests to CouchDB-backed APIs. It did not write documents, install design documents/indexes, or change the main database.

**F. Merge status:** the four identified paths have now been resolved and staged. The overall merge remains in progress and uncommitted; review the full staged merge before committing.

## 8. Conflict-resolution verification update

- Frontend production build: **PASS**. Vite 8 built successfully; it reported a non-fatal large-chunk warning (615.49 kB minified JavaScript bundle).
- Frontend lint: **PASS**, 0 errors and 3 warnings: unused React import in `App.jsx`; unused `FaEye` import and `resetCredentialCopied` state in `AdminDashboard.jsx`.
- `git ls-files -u` for the four conflict paths: **empty** after resolution.
- No backend tests or CouchDB operations were run as part of resolving these file conflicts.
- The separate AdminDashboard white/blue visual adjustment remains an unstaged working-tree change; it was not included in the four conflict resolutions.

## 9. Progress update — Job UI, database fields, and endpoint configuration

**Updated:** 2026-10-26 (Asia/Saigon). This section records work performed after the read-only audit above; the earlier sections remain the findings at their original audit point.

### Job UI and search scope

- Job search pages now omit the location selector. Public search continues to use keyword, skills, industry, and seniority. Existing backend location/work-mode filters are not removed from the API contract; the public UI does not advertise them while the current catalog has no values for those fields.
- Job cards and Job Detail show salary, location, and work mode only when the Job document contains those values. Empty metadata rows/placeholders are omitted.
- Job List and Job Detail use the white/blue presentation; loading/error/empty states remain visible and API failures do not switch to fixtures.
- Frontend production build after these UI changes: **PASS**. The bundle-size advisory remains. Browser rendering/E2E: **not verified**.

### CouchDB Job field audit — GET only

A direct read-only GET of the `recruitment_db` `_all_docs` Job ID range returned 2,500 `type=job` documents. Status counts were 2,300 `DRAFT` and 200 `OPEN`. For every one of the 2,500 documents, the properties `location`, `work_mode`, `salary`, and `employment_type` were **absent** (not present with `null` or an empty value). No document or database was changed. These are optional schema fields; the simplified public UI reflects the actual data rather than inventing values.

The earlier API-only check covered the 200 public OPEN jobs. The direct database GET extends the field-presence check to all 2,500 Job documents. `provenance.classification=mixed` was present for all 2,500; this label alone is not evidence that the UI/API is serving fixtures.

### Endpoint configuration map

| Layer | Effective/configured endpoint | Evidence and notes |
|---|---|---|
| Browser frontend | `http://127.0.0.1:5177` | `frontend/vite.config.js` binds Vite to port 5177 with `strictPort`. |
| Browser API base | Same-origin `/api` | `frontend/src/services/api.js` sets Axios `baseURL` to `/api`; API module paths append `/v1/...`, giving `/api/v1/...`. The client does not read `VITE_API_BASE_URL`. |
| Development proxy | `/api` → `http://127.0.0.1:<PORT>` | Vite reads `PORT` from `backend/.env` or root `.env`, in that order; falls back to 5000. `VITE_API_PROXY_TARGET` can explicitly override the target. |
| Backend listener | `PORT` from environment; default 5000 | `backend/src/server.js`. Current root `.env` sets 5010; tracked `.env.example` documents 5000. `FRONTEND_URL` is 5177 for CORS. |
| API namespace | `/api/v1` | Job list, metadata, and detail routes are mounted under the shared versioned router. Health routes remain `/api/health` and `/api/health/database`. |

`frontend/.env.local` contains a `VITE_API_BASE_URL` value pointing to port 5010, but the checked-out Axios client hard-codes `/api`; that variable does not control the current browser requests. The active local routing is therefore Vite 5177 → same-origin `/api` proxy → backend port 5010, while the example/default backend port is 5000. This distinction should be kept in the run instructions; there is one browser API base path, with Vite proxying to the backend.

### Metadata runtime status and remaining work

- The current source registers `GET /api/v1/jobs/metadata` before the parameterized `GET /api/v1/jobs/:id` route. The route is in [job.routes.js](../../../backend/src/routes/job.routes.js#L18). The live listener previously returned HTTP 400 by validating `metadata` as an `id`; its process/source identity was not established. Source/runtime drift is the supported conclusion; route order is **not** identified as a confirmed source defect.
- Backend syntax checks passed for the touched Job route/service. The backend has no build script; no backend test suite was run for this progress update.
- The backend listener has not been restarted and the metadata request has not been re-verified against the latest checkout. Restart the intended backend on port 5010, then GET `/api/health`, `/api/v1/jobs/metadata`, `/api/v1/jobs?limit=5`, and a returned OPEN Job detail. Do not treat the prior 400 as resolved until those GETs pass on the intended process.
- The latest source change adds canonical location/work-mode labels to public Job detail when those optional fields exist. The database currently has neither field on any Job; the labels will appear if future Job documents carry valid values.
- No CouchDB write, index/design installation, seed, migration, merge completion, staging, commit, or push was performed in this progress update.

## 10. Follow-up — Recruiter Job route and missing CouchDB indexes

**Updated:** 2026-10-26 (Asia/Saigon), after the runtime failure was reproduced in the browser.

- The browser URL on port `5178` was served by Vite, but its `/api` proxy reached the stale backend on port `5010`. That backend treated `/jobs/metadata` as an `:id` route and returned HTTP 400; recruiter context also returned 404. The checked-out Job route registers metadata before the parameterized detail route.
- Development endpoint configuration is now aligned to frontend port `5178` and backend port `5021`: Vite uses `5178`, root `.env` uses `PORT=5021` and `FRONTEND_URL=http://127.0.0.1:5178`, and the tracked `.env.example`/run instructions use the same frontend origin. Axios now reads `VITE_API_BASE_URL`; the local frontend value is `/api`, so browser modules use the same-origin Vite proxy rather than a stale direct URL to port `5010`.
- Before database repair, CouchDB's `recruitment_db/_index` exposed only `_all_docs`; `_design/job_application` contained three of the six views required by the current code. This caused public Job queries to return HTTP 503 and the recruiter dashboard to show missing index/view errors.
- Ran the repository's existing `npm run db:job-application` setup command. It added the nine declared Job/Application Mango indexes and updated the existing `job_application` design document with all six views. The script does not update business Job, Application, or user documents.
- Read-only verification through `http://127.0.0.1:5178`: `/api/health` **200**; `/api/health/database` **200**; `/api/v1/jobs/metadata` **200**; `/api/v1/jobs?limit=1` **200**. `_index` now lists the nine Job/Application indexes plus `_all_docs`, and the design document returns all six expected views. `/api/v1/recruiter/context` without an Authorization token returns **401**, as expected; authenticated recruiter browser flow was not exercised here.
- `doc_count` reports 25,764 after setup (previously 25,755). The setup command only wrote index/design metadata; it did not import or seed business records. Frontend production build and backend syntax check pass; browser visual/E2E acceptance is still outstanding.
