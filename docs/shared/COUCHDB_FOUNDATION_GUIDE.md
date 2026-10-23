# RecruiHub Shared CouchDB Foundation

## 1. Mục đích và phạm vi

Foundation cung cấp cấu hình, CouchDB HTTP client và BaseRepository dùng chung cho backend. TV1 sở hữu shared layer; TV2/TV3 xây repository nghiệp vụ của họ trên interface này. Module không tự kết nối khi import, không tự tạo database, không import dữ liệu và không tạo/sửa index, view hay document ngoài request được gọi rõ ràng.

Response helpers trong backend/src/utils/api-response.js là provisional. Chúng không được gắn vào route hiện tại cho đến khi nhóm phê duyệt envelope chung.

## 2. Sơ đồ dependency

    Express route/service
        -> TV1/TV2/TV3 repository
        -> BaseRepository
        -> CouchDbClient
        -> configured CouchDB database

    BaseRepository -> optional Zod document schema
    CouchDbClient -> database config
    CouchDbClient -> CouchDbError mapping
    Provisional response helpers - - not wired to routes

## 3. File ownership map

| File | Nhiệm vụ |
|---|---|
| backend/src/config/database.config.js | Validate and normalize environment configuration; no I/O |
| backend/src/services/couchdb.client.js | Native Fetch HTTP client, timeout, auth header, readiness, document/Mango methods |
| backend/src/services/couchdb.errors.js | Sanitized network/HTTP/CouchDB error types and provisional API error mapper |
| backend/src/repositories/base.repository.js | Shared repository operations with optional Zod validation |
| backend/src/utils/api-response.js | Provisional success/error envelope constructors; not wired to runtime routes |
| backend/tests/foundation/*.test.js | Config, client, repository and error tests using fake responses |

## 4. Environment variables

| Variable | Default | Description |
|---|---|---|
| COUCHDB_URL | http://127.0.0.1:5984 | CouchDB server root; credentials must not be embedded in URL |
| COUCHDB_DATABASE | recruitment_db | Existing database name; client never creates it |
| COUCHDB_USER | unset | Optional username; must be provided together with password |
| COUCHDB_PASSWORD | unset | Optional password; never logged |
| COUCHDB_TIMEOUT_MS | 5000 | Request timeout, 100?60000 ms |
| PORT | 5000 | Express listener port; supplied process value takes precedence |

The backend entrypoint reads existing `backend/.env` first and then the repository-root `.env`. Values already present in the parent process are never replaced; if a key exists in both files, `backend/.env` wins. Files are read only and are not created or copied. The loader resolves paths from its own source location, so behavior does not depend on whether the process starts from the repository root or `backend/`.

No credentials belong in source, this guide, terminal output or reports. Do not print environment objects or CouchDB client configuration.

## 5. Start CouchDB and Backend

CouchDB is managed separately. The backend foundation does not start Docker, create a database, or change containers.

From repository root in PowerShell, for the current local setup using port 5002:

    $env:PORT = '5002'
    npm.cmd --prefix backend run dev

From `backend/`:

    $env:PORT = '5002'
    npm.cmd run dev

Use `npm.cmd start` in place of `npm.cmd run dev` for the non-watch process. If no PORT is supplied, the backend keeps its existing default of 5000. A process-provided PORT is preserved by environment loading. Do not stop or replace another service that owns the selected port.

## 6. Readiness and diagnostics

`GET /api/health` remains the existing Express-only health check and does not verify CouchDB. Stage 03B adds `GET /api/health/database` as a **provisional internal diagnostics endpoint**. It is not the finalized shared API contract and has no authentication middleware; keep it limited to local/internal development until exposure is reviewed.

The database endpoint calls `checkReadiness()`, which performs read-only GET requests to CouchDB `/_` root and `/{database}`. It does not create missing resources or indexes. The endpoint returns only a readiness status, database name and document count; it does not return server UUID, URL, credentials or raw CouchDB responses. Client timeout is controlled by `COUCHDB_TIMEOUT_MS`. Errors are sanitized: missing/unavailable DB and network failures return 503, request timeout returns 504, and upstream server errors return a gateway error. A failed readiness request does not terminate Express.

Example request:

    GET http://127.0.0.1:5002/api/health/database

Example success response:

    {
      "success": true,
      "data": {
        "status": "ready",
        "database": { "name": "recruitment_db", "doc_count": 25750 }
      },
      "message": "CouchDB is ready"
    }

Example sanitized failure response:

    {
      "success": false,
      "error": {
        "code": "NETWORK_ERROR",
        "message": "CouchDB could not be reached.",
        "details": []
      }
    }

Troubleshooting: verify the selected PORT is free; confirm the existing CouchDB process responds at the configured URL; check that the configured database already exists; confirm the credential pair is complete; and check that the configured timeout is between 100 and 60000 ms. Do not paste credential values or full environment output into logs/issues. The backend never creates the database automatically.

## 7. CouchDB Client public API

- Constructor: CouchDbClient({ config?, fetchImpl? })
- checkReadiness()
- getDatabaseInfo()
- getDocument(id)
- find(mangoQuery)
- createDocument(document)
- updateDocument(document, expectedRev)
- exists(id)

createDocument requires the domain's deterministic _id and refuses _rev. updateDocument requires expectedRev; if document already has _rev, it must match. The client does not mutate input. find posts the caller's Mango query to /{db}/_find. No method creates database/index/view, deletes documents, or retries a mutation. exists reads a document and maps only a missing-document 404 to false; missing database/authentication/network/server errors remain errors.

### Readiness outside HTTP routes

Readiness remains explicit. The provisional internal GET /api/health/database route is the only runtime caller added in Stage 03B; existing GET /api/health remains unchanged and does not call CouchDB.

## 8. Base Repository public API

- Constructor: BaseRepository({ client, schema? })
- getById(id)
- find(selector, options?)
- create(document)
- update(document, expectedRev)
- exists(id)
- getDatabaseInfo()

If a Zod schema is supplied, create and update validate the document before delegating. The repository does not generate IDs, insert type, mutate documents, or merge unknown fields. find accepts a selector object and optional Mango query options. Callers must choose a schema that corresponds to their owned document type.

## 9. TV1 usage example

    import { userDocumentSchema } from '../schemas/user.schema.js';
    import { BaseRepository } from '../repositories/base.repository.js';
    import { CouchDbClient } from '../services/couchdb.client.js';
    const userRepository = new BaseRepository({
      client: new CouchDbClient(),
      schema: userDocumentSchema,
    });
    const user = await userRepository.getById(userId);
    // Map to a safe API DTO before responding; never expose password_hash.

## 10. TV2 JobRepository example (documentation only)

    class JobRepository extends BaseRepository {
      async findOpenJobs(filters, options = {}) {
      const selector = { ...filters, type: 'job', status: 'OPEN' };
        return this.find(selector, options);
      }
    }

TV2 owns Job filters, lifecycle, DTO, index choice and repository implementation. Do not pass arbitrary client fields directly into a selector; validate/allowlist them first.

## 11. TV3 InterviewRepository example (documentation only)

    class InterviewRepository extends BaseRepository {
      async findApplicationRounds(applicationId) {
        return this.find(
          { type: 'interview', application_id: applicationId },
          { sort: [{ application_id: 'asc' }, { round: 'asc' }] },
        );
      }
    }

TV3 owns interview lifecycle, round semantics, audit and scoring. The example does not implement those rules.

## 12. IDs, revisions and errors

- _id: domain creates deterministic IDs according to DATA-02A. Foundation requires an ID and never replaces it.
- _rev: CouchDB-managed optimistic concurrency value. A mutation caller reads the current revision and passes it as expectedRev.
- 404: NOT_FOUND for a missing document; DATABASE_NOT_FOUND when the server response identifies a missing database. exists returns false only for a missing document.
- 409: CONFLICT; caller must re-read, re-authorize/revalidate and apply the business rule. Foundation does not retry automatically.
- 401 / 403: sanitized authentication/authorization errors.
- Network / timeout / 5xx: NETWORK_ERROR, TIMEOUT, SERVER_ERROR; raw URL, response body and credentials are not included in messages.
- Delete is intentionally omitted until a domain need is explicitly approved. _bulk_docs is not a transaction and is deliberately not exposed by this base layer.

## 13. Index and query rules

- No index or design document is created by this foundation.
- Callers must use approved document type and query fields; never infer fields not in the schema.
- Before production use, TV2/TV3 should provide actual selectors, sort and pagination patterns, then the shared owner can prepare a separately reviewed index change and rollback plan.
- Avoid Mango full scans for large collections. bookmark pagination and stable sort fields must be coordinated with the owning module.
- Login can resolve User by deterministic ID derived from canonical email; do not query password/hash fields with an unindexed full scan.

## 14. Security and safe logging

- Keep credentials in environment variables; do not embed them in URLs or source.
- Basic authentication headers are created only per request and are not returned or logged.
- Error messages are sanitized; do not log raw fetch options, config, Authorization, password, token or CouchDB error body.
- Do not expose a raw CouchDB client to browser code.
- Validate user input before constructing Mango selectors; use role/ownership checks in the business service.
- Use TLS and an appropriately protected secret source outside local development.

## 15. Tests

Run all backend tests from backend/: npm.cmd test.

Foundation tests use fake Fetch responses for writes and do not modify CouchDB. Any live integration verification must be read-only against recruitment_db. Create/update/delete tests require a separately approved test database; do not create or drop one without approval.

## 16. Limits and open dependencies

- Shared ownership is assigned to TV1. Business modules remain owned by TV1, TV2 and TV3 respectively.
- JWT, registration, ADMIN bootstrap, API prefix, response envelope, audit storage and Public Job API remain open; this layer does not implement them.
- Provisional API response helpers are not wired into existing routes.
- Current runtime health route is not DB-backed; readiness must be requested explicitly.
- No CouchDB client dependency was added; implementation uses Node's Fetch API.
- Indexes/views, retries, transactions, bulk writes and domain repositories are outside the foundation scope.

## 17. Interface stability and TV2/TV3 integration checklist

The following public foundation signatures are unchanged in Stage 03B: `CouchDbClient` (`checkReadiness`, `getDatabaseInfo`, `getDocument`, `find`, `createDocument`, `updateDocument`, `exists`) and `BaseRepository` (`getById`, `find`, `create`, `update`, `exists`, `getDatabaseInfo`). No TV2/TV3 business repository or domain behavior is included.

`find(selector, options)` wraps the selector and passes Mango options through. The foundation does not promise stable sorting, page ordering, or a bookmark pagination policy: the owning module must specify `limit`, stable `sort` with a unique tie-breaker, and CouchDB `bookmark` handling for its query contract. Validate/allowlist caller filters before building selectors.

CouchDB 409 responses remain typed `CONFLICT` errors. The foundation does not retry mutations. A business service must re-read the latest document, re-check authorization and state, then apply only an explicitly valid retry under DATA-02A; never blind-merge or overwrite. `updateDocument` requires the caller's expected `_rev`.

TV2/TV3 integration checklist:

- [ ] Define owned document schema and pass the corresponding Zod schema to `BaseRepository`.
- [ ] Keep deterministic `_id` and `type` generation in the owning domain module.
- [ ] Define selectors, filter allowlist, stable sort, bookmark semantics and expected query volume.
- [ ] Request index/view changes separately with workload evidence and rollback plan; foundation creates none.
- [ ] Handle `NOT_FOUND`, `DATABASE_NOT_FOUND`, `CONFLICT`, timeout and network errors without leaking raw upstream details.
- [ ] Add fake-client tests for repository behavior; use only approved isolated databases for write integration tests.
- [ ] Keep authorization/ownership checks in the business service; the base repository does not enforce them.

Known test limitation: `npm.cmd test` runs only `tests/data/*.test.js` and includes legacy data pipeline, release publication and CouchDB acceptance cases. That suite has previously failed on missing release inputs/checksum mismatches and failure-injection assertions. It also creates and removes shared scratch paths under `data/`, so rerun only after verifying those paths and any pointer/release side effects are safe. Foundation and runtime route tests are run explicitly with `node --test tests/foundation/*.test.js`.


## Read-only ID-prefix scans (TV1 Stage 05?10)

`CouchDbClient.listDocumentsByIdPrefix(prefix, { afterId, limit })` is a read-only GET wrapper for CouchDB built-in `_all_docs`. It requires a colon-terminated safe prefix, validates `afterId` belongs to that prefix, and caps pages at 1,000 rows (default 250). It returns `{docs,lastId,hasMore}`; reads include full documents and should be limited to trusted backend service use. `BaseRepository.listByIdPrefix` delegates to it; UserRepository and CandidateRepository pin the prefix to their own document types. This does not create Mango indexes or views. Full-range scans cost more than indexed queries and should be replaced only after a separately reviewed index/query proposal.
