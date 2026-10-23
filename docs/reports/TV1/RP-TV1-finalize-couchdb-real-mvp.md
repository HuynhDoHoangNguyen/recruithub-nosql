# RecruiHub NoSQL — TV1 Finalization: CouchDB Restore & Real MVP Verification

## 1. Stage information and status

- **Date:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Owner:** TV1; report compiled by Codex.
- **Acceptance:** **PARTIAL**. Auth, Candidate Profile, and Admin API E2E passed against the approved isolated CouchDB database. Browser interaction/logout and TV2/TV3 integration remain unverified or pending.
- **Scope:** inspect Docker/CouchDB and Compose, check demo database availability read-only, run safe API smoke and isolated tests, verify frontend build/lint, and preserve all existing data.

## 2. Objective and safety constraints

The purpose was to verify the already implemented TV1 MVP against a separate demo database without using `recruitment_db`. No database was created, no Admin user was created, no CouchDB writes/indexes/views/migrations were run, and no Docker service was started or stopped. No commit, push, merge, reset, clean, fetch, or pull was performed.

## 3. Environment and Docker findings

- `docker-compose.yml` declares only service `couchdb`, image `couchdb:3.5.2.1`, container name `recruithub-couchdb`, loopback binding `127.0.0.1:5984:5984`, and named volume `couchdb_data:/opt/couchdb/data`.
- `docker compose config --quiet` completed successfully: Compose syntax/interpolation is valid.
- `docker version` reports Docker CLI 29.6.2, but cannot connect to `npipe:////./pipe/docker_engine` (`permission denied`). `docker compose ps` fails for the same daemon permission. Docker Desktop / daemon processes or services were not visible in this environment.
- A read-only direct HTTP request to `http://127.0.0.1:5984/` returned HTTP 200 and CouchDB API version **3.5.2**. The root `.env` CouchDB credentials authenticated successfully; read-only `GET /_all_dbs` and database metadata requests succeeded.
- Endpoint identity was cross-checked against the expected existing local dataset: the only initial database was `recruitment_db`, with 25,750 docs, matching prior verified RecruiHub data. The endpoint URL resolves to loopback and CouchDB version matches the declared image family.
- **Configuration discrepancy:** the CouchDB config API reports `httpd.bind_address=127.0.0.1` and `httpd.port=5986`, while Compose declares host 5984 mapped to container 5984. Docker access is unavailable, so the responding process/container cannot be tied to the current Compose service. The authenticated local endpoint was used only for the explicitly authorized isolated DB and no existing DB writes.
- No container or volume was started, stopped, removed, or modified. Volume state and container state remain **not verified**.

## 4. Database demo status

- Before creation, the read-only database list contained only `recruitment_db`; `GET /recruithub_auth_demo` returned 404.
- Following the explicit user approval, exactly one database was created with `PUT /recruithub_auth_demo` (HTTP 201). Immediate metadata read showed `doc_count=0` and `update_seq=0`.
- The existing ignored root `.env` was extended by appending `AUTH_COUCHDB_DATABASE=recruithub_auth_demo`; existing keys/secrets were preserved. It remains ignored and untracked.
- One cryptographically random demo Admin email/password pair was generated and stored only in the ignored root `.env` as `TV1_DEMO_ADMIN_EMAIL` and `TV1_DEMO_ADMIN_PASSWORD` so it can be used locally. Values are intentionally omitted from terminal output and this report. Credentials are not in source or Git.
- Root `.env` also contains CouchDB user/password and `JWT_ACCESS_SECRET`; values were not read into report output.
- `.env.example` includes `AUTH_COUCHDB_DATABASE` with a placeholder only.
- `recruitment_db` was read only for metadata before and after testing. Its count remained 25,750; no document/query/write/index operation was sent to it.
- Final `recruithub_auth_demo` state: 5 documents total, comprising 1 synthetic ACTIVE Admin User, 2 Candidate User docs, and 2 Candidate docs. No indexes or views were created.

## 5. API runtime verification

The current backend source was started on port **5004** (port 5000 was not used), with `AUTH_COUCHDB_DATABASE=recruithub_auth_demo`. The frontend dev server was started on port **5178** with API base URL `http://127.0.0.1:5004/api`. Ports 5174-5177 were occupied during a prior launch attempt; they were left untouched. The Vite transformed API module confirmed base URL 5004.

| Request | Result | Meaning |
|---|---:|---|
| `GET /api/health` | 200 | Backend process is serving current source. |
| `GET /api/v1/auth/me` without token | 401 | Authentication middleware rejects unauthenticated access. |
| `GET /api/v1/candidate/profile/me` without token | 401 | Candidate profile route is protected. |
| `GET /api/v1/admin/users` without token | 401 | Admin user route is protected. |
| `GET /api/v1/admin/stats` without token | 401 | Admin stats route is protected. |
| Initial pre-database valid-shape `POST /api/v1/auth/login` | 503 | Isolated auth database configuration guard; returned before CouchDB access. |
| Initial pre-database valid-shape `POST /api/v1/auth/register` | 503 | Same guard; no user/candidate document was written by that smoke request. |
| Candidate registration on demo DB | 201 | Created a new Candidate and User with canonical IDs; response omitted credential hash and revision. |
| Duplicate Candidate registration | 409 | Duplicate email rejected. |
| Candidate login / `/auth/me` | 200 / 200 | Token issued and server reloaded the active User. |
| Wrong password / malformed JWT / expired JWT | 401 / 401 / 401 | Authentication was rejected. |
| Candidate Profile GET / PATCH | 200 / 200 | Own profile loaded and an allowed summary field updated with `If-Match`. |
| Stale profile revision | 409 | Stale `If-Match` rejected; no blind overwrite. |
| Candidate token on Admin API / Admin token on Candidate Profile | 403 / 403 | Role boundaries enforced server side. |
| Ownership query tamper | PASS | Candidate `/me` remained bound to the authenticated principal even when a different `user_id` query value was supplied; owner ID was absent from the DTO. |
| Admin login / list / detail | 200 / 200 / 200 | Synthetic demo Admin authenticated and loaded User list/detail. |
| Lock Candidate / reject old token / unlock Candidate | 200 / 401 / 200 | Admin status change used current revision; locked User could not use an already issued token. An initial test-driver unlock with a stale/missing revision was rejected; fetching the fresh ETag and retrying succeeded. |
| Lock the only active Admin | 409 | Last-active-Admin protection worked; Admin remained ACTIVE. |
| Admin statistics | 200 | Final counts: 3 Users, 2 Candidates, 1 Admin, 3 ACTIVE Users. |

The initial pre-database login/register smoke requests returned 503 before CouchDB. After authorized DB creation, all subsequent successful writes were confined to `recruithub_auth_demo`. No request wrote to `recruitment_db`.

## 6. Isolated tests, build, and lint

| Command | Result |
|---|---|
| Backend `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 49/49**. Covers fake-repository auth lifecycle, Argon2id settings, duplicate handling, invalid/expired JWT, account states, partial writes, RBAC/ownership, Candidate profile revision conflicts, Admin policy, Foundation and read-only client calls. |
| Frontend `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4**. Covers memory-only token/local logout and public-job fixture model filtering/sorting/pagination. |
| Frontend `npm.cmd run build` | **PASS**. Vite production build completed. |
| Frontend `npm.cmd run lint` | **PASS with 0 errors and 16 warnings**. Warnings are unused imports/variables and one hook dependency warning in existing app/dashboard/job code. |
| Legacy backend `npm test` | **NOT RUN**. It is the data/release suite with shared scratch-path side effects and prior recorded failures. |

These are isolated tests using fake repositories/client; they are not evidence of CouchDB persistence.

## 7. Frontend/UI verification

- Frontend dev URL: `http://127.0.0.1:5178/`; Vite returned HTTP 200 for the `/login` SPA route. The transformed `frontend/src/services/api.js` used `http://127.0.0.1:5004/api`.
- Build and unit tests passed, and API E2E requests were sent to the same backend port configured for Vite.
- Windows browser automation reported no available apps or browser surfaces. Consequently, visual rendering, navigation clicks, form interaction/validation, loading/error states, and responsive breakpoints were **not verified in a browser**. A Vite SPA HTTP 200 is not treated as proof that the UI flow works.
- Browser UI auth/profile/Admin E2E remains unverified because no browser surface is available, even though equivalent backend API flows passed.
- Logout has no backend endpoint or token revocation by design. Frontend logout is local memory clearing; the frontend auth-helper test passed, but an actual browser click/session flow could not be performed.

## 8. Admin verification

- One synthetic ACTIVE Admin was created only in the new demo database after confirming it was empty. The document passed the existing `userDocumentSchema`, used deterministic User ID from normalized email, role `ADMIN`, status `ACTIVE`, `example.invalid` email, Argon2id hash using existing `PASSWORD_HASH_OPTIONS`, and synthetic provenance fields. No source/schema change or public Admin registration was used.
- Generated local Admin credentials are stored in the ignored root `.env`; the values are not in the report or logs.
- No seeded `RESET_REQUIRED` account was activated or modified.
- Admin APIs returned 401 without a token, and authenticated Admin list/detail/stats/status flows were exercised against the demo DB. Locking the only active Admin returned 409; locking/unlocking a Candidate succeeded with current ETags.
- Existing RESET_REQUIRED accounts were not activated or modified. No Admin was created in `recruitment_db`.

## 9. Files and Git state

- Updated this report during the finalization task.
- Updated the ignored root `.env` by appending the authorized isolated DB name and generated demo Admin credentials; no existing variable was replaced.
- No source, Compose, schema, dataset, audit report, or Docker volume was changed during the finalization task. Exactly one CouchDB database and its authorized demo documents were created as described above.
- Branch is `feature/identity-candidate-portal`.
- `.env` is Git-ignored and not tracked. Final Git status contains 65 modified/untracked entries from existing Stage 04A/04B/master-task work plus this report; all remain unstaged/uncommitted. `git diff --cached --quiet` confirmed there is no staged diff.
- Git reported an ownership safety warning under the sandbox identity. Read-only branch/status commands were run with a per-command `safe.directory` override; no global Git configuration was changed.
- `git diff --check` passed after the report update; Git emitted only its standard LF-to-CRLF working-copy warnings.

## 10. Blockers and remaining risks

1. Docker Engine pipe access is denied, so container/volume state and Compose service status cannot be confirmed or controlled safely.
2. CouchDB reports internal HTTP port 5986 while Compose targets container port 5984; the actual service/container mapping is unknown, although local authenticated HTTP and expected database contents were verified.
3. Browser automation has no available browser surface; visual and interaction tests remain outstanding.
4. Frontend logout is local-only and cannot revoke a copied JWT until expiry.
5. TV2 Public Job/Apply API and TV3 Interview/Scoring/Audit contracts remain dependencies for full TV1 integration.
6. Lint has 16 warnings; the legacy backend data suite was not rerun.

## 11. Acceptance

**PARTIAL.** The isolated demo database and one-time Admin bootstrap were completed under explicit approval. Candidate register/login/me, duplicate rejection, invalid/expired token, Candidate Profile GET/PATCH, stale revision, ownership query binding, RBAC, Admin list/detail/status/last-Admin guard/statistics all passed live API verification. `recruitment_db` stayed at 25,750 docs. Browser interaction/responsive checks and a browser logout click remain unverified; TV2/TV3 integration is pending.

## 12. Review readiness and next steps

The TV1 backend auth/profile/Admin slice is **ready for focused code review**, with real persistence exercised only in `recruithub_auth_demo`. Overall TV1 acceptance remains **PARTIAL** because browser interaction was unavailable and Public Job/Apply plus Interview/Scoring/Audit integration depends on TV2/TV3.

1. In a browser-capable environment, verify navigation, registration/login forms, validation/loading/error states, responsive layout, and local logout.
2. Keep the generated Admin credential only in ignored local `.env`; rotate it if shared or exposed. Do not copy it into reports or commits.
3. Resolve Docker access and the Compose/CouchDB internal-port discrepancy in a separate environment task before attempting container operations.
4. Obtain TV2 Public Job/Apply and TV3 contracts, then complete their handoffs and integration tests.
5. Re-run the scoped tests after any implementation changes. Do not commit or push automatically.
