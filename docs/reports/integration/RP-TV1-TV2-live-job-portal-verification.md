# TV1–TV2 Live Job Portal Verification

**Date:** 2026-10-26 (Asia/Saigon)
**Status:** PARTIAL — the running frontend bundle is configured for the live API and GET responses match a CouchDB Job document, but browser rendering and the exact backend process source could not be verified. Metadata is broken at runtime; detail omits the company logo; CLOSED history policy is inconsistent.

## Scope and safety

Reviewed the preceding [TV1–TV2 audit](RP-TV1-TV2-job-portal-handover-audit.md), TV1 UC06 and UC07 reports, TV2 current-status, dev-handoff, merge-repair, public-job live-verification and consolidated reports, plus current frontend/backend source and tests.

No source, local environment, CouchDB data, index, or design document was changed. Runtime checks used GET only. The main database was not written. Browser inventory reported no available apps or browsers, so no browser interaction or screenshot evidence is claimed.

## 1. Git and merge state

- Branch: `feature/admin-management`.
- `MERGE_HEAD`: `522d3f5785d2845e5d010f2d8fb338c3d995fda8` (`dev`); merge remains uncommitted.
- `git ls-files -u`: empty — no unresolved index entries.
- Staged merge summary: **245 files changed, 8,450 insertions, 856 deletions**.
- `git diff --cached --check` reports four existing trailing-space lines in `docs/reports/TV2/RP-TV2-current-status-2026-10-25.md` (lines 3–6). This check did not report whitespace errors in the Job Portal files reviewed here.
- Existing unrelated/staged and unstaged changes were preserved. This verification report is a new untracked file; no Git state was staged or otherwise changed for this task.

## 2. Frontend configuration and data path

The running Vite server is reachable on port 5173. Its transformed GET response for `/src/services/publicJobsApi.js` identifies development mode and sets `VITE_API_BASE_URL` to `http://127.0.0.1:5010/api`. The transformed environment does not contain `VITE_PUBLIC_JOBS_MODE`. The adapter enables fixtures only when both `import.meta.env.DEV` and `VITE_PUBLIC_JOBS_MODE === 'fixtures'`; therefore this running bundle evaluates to API mode. The local `frontend/.env.local` also configures the 5010 API base and contains no fixture-mode setting.

Source path:

1. `frontend/src/pages/Jobs/JobList.jsx` calls `listPublicJobs()` and metadata hook `useJobMetadata()`.
2. `frontend/src/services/publicJobsApi.js` calls `jobApi.publicList()` in the observed API mode.
3. `frontend/src/api/jobApplicationApi.js` issues GET `/v1/jobs` and GET `/v1/jobs/:id` through the API client.
4. `frontend/src/services/api.js` uses the API base above; `frontend/src/pages/Jobs/JobDetails.jsx` calls `getPublicJob(id)`.

The checked-out Vite config uses port 5177 with an `/api` proxy, but listeners were observed on 5173 and not on 5177. The transformed 5173 module proves that server is serving an API-configured frontend bundle; the PID's launch command/current working directory could not be retrieved. Treat the running frontend as a different or older Vite process/configuration than the current checkout, not as confirmed current-source deployment.

## 8. Decision and implementation follow-up (2026-10-26)

The integration policy is now selected and reflected in source:

- Public Job list and public detail remain OPEN-only. A CLOSED Job is available to an authenticated Candidate only when it is embedded in that Candidate's own application-history record. This keeps archived applications readable without exposing closed listings through the public catalog.
- Apply remains unavailable for CLOSED Jobs. TV2's `GET /applications/my-applications?job_id=...` ownership filtering supplies the history record; TV1 does not add a parallel Job endpoint or repository.
- Public detail now includes the approved optional `company_logo_url` when a valid Company logo is available. Missing logos remain optional and the existing UI fallback is retained.
- `/jobs/metadata` is registered before the parameterized `/jobs/:id` detail route in the checked-out source. The live 400 response validates a path parameter named `id`, which is consistent with a listener running a different/older route order. Since the listener's source could not be identified, runtime drift is the best-supported explanation, not a proven process attribution. No route-order workaround was added to current source.

Implementation evidence: `backend/src/services/job.service.js`, `frontend/src/services/publicJobsApi.js`, `frontend/src/pages/Jobs/JobDetails.jsx`, and the in-memory ownership/public-catalog regression tests.

Verification after the changes:

- Backend syntax check for `src/services/job.service.js`: PASS. The backend package has no `build` script.
- Backend isolated recruitment/API tests: **29/29 PASS** (`public-catalog`, `public-jobs`, and `job-application-api`). These use in-memory repositories and make no CouchDB writes.
- Frontend focused Job Portal/post-merge tests: **16/16 PASS**.
- Frontend production build: **PASS** (Vite 8; existing large-chunk warning, 615.68 kB minified JS).
- `git diff --check` on the changed Job Portal files: PASS; only the normal LF-to-CRLF advisory appeared.
- No live backend restart, database request, CouchDB write, browser session, or UI screenshot was performed after the source changes. Browser status remains `BROWSER_NOT_VERIFIED`; the earlier HTTP 200 SPA response is not browser evidence.

Acceptance remains partial: source and isolated behavior now agree on OPEN-only public access plus owner-scoped CLOSED history, but the deployed listener and actual browser UI still require verification against the rebuilt source.

## 3. Backend process and GET evidence

`netstat` found a listener on port 5010, PID 27632. `Get-Process` identified `node.exe`; the process executable path was available, but `Win32_Process` command-line/source inspection returned Access Denied. The listening process therefore cannot be tied conclusively to the current checkout.

GET requests to `http://127.0.0.1:5010` returned:

| Request | Result |
|---|---|
| `/api/health` | 200, RecruiHub health response |
| `/api/v1/jobs?limit=5` | 200, 5 Jobs; first item `job:cms:J_000020`, “Business Development Manager”, status OPEN |
| `/api/v1/jobs/job%3Acms%3AJ_000020` | 200; same ID/title and status OPEN |
| `/api/v1/jobs/metadata` | 400 `VALIDATION_ERROR`, field `id` rejected against the Job ID pattern |

A separate direct CouchDB GET, using the configured database name `recruitment_db`, returned HTTP 200 for `job:cms:J_000020`: `type=job`, title “Business Development Manager”, status OPEN, and `created_at=2026-10-21T00:00:00Z`. The public API list and detail returned the same ID/title/status as that database document. Credentials were not printed. This is direct evidence that the returned Job exists in CouchDB and matches the API item; it does not prove a human browser rendered that item.

Additional GET-only API checks: `limit=2` returned two pages with two items each and four unique IDs; a search for `Business` returned five items; an exact `industry=Retail` filter returned five items, all matching the filter. These validate live API behavior, not browser controls.

### Metadata 400 diagnosis

The observed response says `metadata` was treated as an `id` path parameter and rejected by the Job ID validator. In the current checkout, `backend/src/routes/job.routes.js` registers GET `/jobs/metadata` before GET `/jobs/:id`, so that exact routing error should not occur from this source. This, plus the missing response fields below and the unidentifiable process command line, shows runtime/source drift. The precise server source/version remains unverified; do not “fix” the checked-out route based solely on this runtime response.

The current Vite-side `useJobMetadata` hook will surface a metadata error and leave metadata-derived filter options unavailable. The Job list request itself succeeds independently.

### Runtime/source parity signals

The current backend wraps public catalog responses with `catalog_source` and `application_available` in `PublicJobCatalogService`; neither field appeared in the observed runtime list/detail response. Current source detail also returns a `company` field. Runtime detail had `company` and `company_name`, but no `company_logo_url`. Taken together with metadata behavior, the live Node server is not demonstrably running the exact current source.

## 4. Fixture and logo behavior

- **Fixture mode:** source and the transformed running Vite module show no explicit fixture-mode flag; the bundle uses the API path. Fixture data is imported by the module but is not selected unless the explicit mode condition is true. No fixture fallback occurs on API error.
- **Job List without a logo:** `JobList.jsx` displays company initials, or a briefcase icon when there is no company name.
- **Job Detail without a logo:** `JobDetails.jsx` displays a briefcase icon placeholder.
- The reusable `CompanyLogo` component also falls back to company initials if an image fails to load.
- Backend `JobService.publicList()` includes `company_logo_url`; `JobService.publicDetail()` currently does not. The live detail response likewise omitted it. The UI degrades gracefully, but the public detail DTO remains short of the logo field TV2 reports as pending.

## 5. Browser status

**BROWSER_NOT_VERIFIED.** CUA inventory returned `apps=[]`, `browsers=[]`. No page was opened, no Network panel was inspected, and no screenshot or DOM assertion is available. Vite HTML 200 responses are not treated as proof of UI rendering.

Manual follow-up when a browser is available:

1. Start/open the intended Vite server and confirm its exact URL/API base in DevTools; the current checkout config expects port 5177, while the observed server was on 5173.
2. Open `/jobs`; in Network confirm GET `/api/v1/jobs` goes to port 5010 and contains `job:cms:J_000020` with the title above. Confirm no fixture-only values appear.
3. Confirm GET `/api/v1/jobs/metadata` and inspect whether the current 400 is still present; after an approved backend deployment it should match the metadata route contract.
4. Search for `Business`, select an industry/seniority filter, and use next/previous page. Confirm Network requests carry the expected query/bookmark and displayed IDs match their responses.
5. Open `job:cms:J_000020`; confirm the title and status match its API response and check the briefcase/initials fallback if the logo field is absent.
6. Verify loading, empty, and error/retry states by using controlled API responses or an isolated test environment; do not change production/main-database data to create these cases.

## 6. CLOSED detail decision — not changed

Evidence conflicts:

- TV1 UC07 and the public Job contract say only OPEN Jobs are publicly readable; DRAFT and CLOSED should return 404. The UC07 report records 2,300 DRAFT, 200 OPEN, and 0 CLOSED in its historical dataset snapshot.
- TV2's dev-merge-repair report says the frontend should read CLOSED Jobs for application history while preventing new applications.
- Current `JobService.publicDetail()` rejects every non-OPEN Job with 404.
- Current frontend `getPublicJob()` accepts OPEN and CLOSED and its comment says CLOSED is for application history.
- `backend/tests/recruitment/public-jobs.test.js` expects CLOSED detail to return 200, while the current service returns 404. The targeted in-memory run reproduced this failure.

Options for TV1/TV2/group decision:

1. **OPEN-only public detail:** retain 404 for CLOSED. Change the frontend adapter/history navigation and regression expectation to reflect that closed details cannot be publicly opened. This best matches the TV1 UC07 public exposure contract.
2. **CLOSED history detail:** permit read-only public detail for CLOSED Jobs; keep DRAFT private, and ensure Apply/re-apply remains disabled. Align source, DTO, UI copy, tests, and the Job/Application history access contract. This supports TV2's history path but exposes closed Job details through a public endpoint.

No policy was selected or changed during this read-only verification. TV1/TV2 should decide the intended access contract before code changes.

## 7. Test evidence

Tests run in this verification used memory fixtures/mocked frontend APIs and did not connect to CouchDB:

- Backend `node --test tests/recruitment/public-catalog.test.js tests/recruitment/public-jobs.test.js`: **5 PASS, 1 FAIL**. The failing test expects CLOSED detail 200; actual result is 404 at `public-jobs.test.js:22`. Pagination passed.
- Frontend `npm.cmd exec vitest run -- tests/public-jobs/job-list.test.jsx`: **6/6 PASS**. These tests mock API behavior and do not prove live browser display.
- No full suite, database-write test, or browser E2E was run.

## 8. Answers and acceptance

1. **Does Job List use CouchDB data?** The running frontend bundle is in API mode; the backend returned a Job whose ID/title/status match a direct CouchDB GET from `recruitment_db`. This verifies the live API data path. Browser rendering itself is not verified.
2. **Does Job Detail use CouchDB data?** The API detail GET returned the same Job ID/title/status as CouchDB. Frontend source calls this API for detail. Browser rendering is not verified.
3. **Why does metadata return 400?** Runtime treats `metadata` as a Job ID and applies the Job ID validator. Current checkout orders the metadata route before the parameter route, so the live process/source differs or is stale; its exact source could not be identified.
4. **API contract errors?** Yes: runtime metadata route is failing; the live response lacks the source/application markers expected from current catalog source; public detail omits the company logo field. CLOSED behavior is inconsistent across TV1/TV2 source and tests.
5. **TV1 follow-up:** inspect metadata/filter error presentation; align the frontend adapter and history navigation after the CLOSED policy is decided; verify actual browser rendering and Network responses; retain the graceful no-logo fallback.
6. **TV2 follow-up:** establish which backend process/build is serving 5010; repair the metadata route in the running deployment/source as appropriate; align public detail DTO/logo contract; implement the selected CLOSED policy and matching regression tests.
7. **UC05–UC07 acceptance:** **Not ready for full acceptance.** API list/detail data and search/filter/pagination GET behavior are evidenced, but browser UI is unverified, metadata fails, runtime/source parity is unknown, detail logo is absent, and CLOSED policy is unresolved. The prior TV1 UC06/UC07 and TV2 reports are historical targeted verification, not a substitute for this browser acceptance.
