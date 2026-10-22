# RecruiHub NoSQL — TV1 Stage 03A: CouchDB Client & Base Repository

**Ngày hoàn tất verification:** 2026-10-23 (Asia/Saigon)

## 1. Mục tiêu

Triển khai shared backend foundation do TV1 sở hữu: CouchDB config/client, repository cơ sở, lỗi dùng chung, tests và tài liệu handoff cho TV2/TV3; không xây repository nghiệp vụ.

## 2. Quyết định ownership

Prompt Stage 03A chốt TV1 là owner của Shared Backend Foundation, gồm CouchDB Client, DB config, Base Repository, common DB errors, response/error helpers khi contract rõ, foundation tests, documentation và handoff. Phân công này chỉ chốt ownership; không phê duyệt JWT, registration, ADMIN bootstrap, API prefix, audit storage hay Public Job API.

## 3. Trạng thái trước khi triển khai

- Branch feature/auth-profile-portal.
- Git staged trước khi làm: A docs/ARCHITECTURE_DATABASE_AUDIT.md (giữ nguyên). Hai báo cáo Stage 02 hiện có trong docs/reports/TV1/ là untracked và được giữ nguyên.
- Backend dùng npm, có package-lock.json, Node ES modules, Express 5, Zod; chưa có Nano/CouchDB dependency. package.json không có build/lint scripts.
- Source có config directory, repository directory dạng placeholder; chưa thấy CouchDB client/config/repository triển khai.
- Existing app chỉ mount health/root. Không có DB readiness trong endpoint và không có auth.
- Docker CLI preflight bị từ chối quyền kết nối Docker Engine trong shell này; chưa xác nhận trạng thái container qua Docker CLI.
- Root .env được phát hiện tồn tại, nhưng nội dung và giá trị credentials không được hiển thị.

## 4. Công việc đã thực hiện

- Thêm Zod-validated DB configuration cho server URL, database name, credential pair và timeout.
- Thêm native Fetch CouchDB client với Basic auth per request, timeout, readiness/database metadata, document GET, Mango find, deterministic create, expected-revision update và exists.
- Thêm sanitized CouchDB error types/mapping cho missing database/document, 409 conflict, authentication, network, timeout và 5xx.
- Thêm BaseRepository có optional Zod document validation và CRUD delegation.
- Thêm success/error helper provisional nhưng không gắn vào Express app hoặc thay đổi health response.
- Thêm foundation unit tests dùng fake Fetch/client; không chạy write requests lên CouchDB.
- Thêm guide và handoff examples cho TV1/TV2/TV3.

## 5. File tạo/sửa

### Tạo

- backend/src/config/database.config.js
- backend/src/services/couchdb.client.js
- backend/src/services/couchdb.errors.js
- backend/src/repositories/base.repository.js
- backend/src/utils/api-response.js
- backend/tests/foundation/database.config.test.js
- backend/tests/foundation/couchdb.errors.test.js
- backend/tests/foundation/couchdb.client.test.js
- backend/tests/foundation/base.repository.test.js
- docs/shared/COUCHDB_FOUNDATION_GUIDE.md
- docs/reports/TV1/RP-TV1-couchdb-client-repository.md

### Không sửa

Không sửa package manifests/lockfile, source business schemas/constants, Express app/routes/health, .env, Compose, dataset/manifest/importer, CouchDB data, indexes/views hoặc staged audit.

## 6. Cấu trúc module và public interfaces

### CouchDbClient

- checkReadiness()
- getDatabaseInfo()
- getDocument(id)
- find(mangoQuery)
- createDocument(document) — yêu cầu deterministic _id, từ chối _rev
- updateDocument(document, expectedRev) — yêu cầu revision, không mutation input
- exists(id)

### BaseRepository

- getById(id), find(selector, options), create(document)
- update(document, expectedRev)
- exists(id), getDatabaseInfo()
- Optional schema cho Zod validation create/update.

Client không generate ID/type, không tạo database/index/view, không tự retry mutation, không cung cấp delete khi chưa được duyệt, không expose _bulk_docs và không xem bulk là transaction.

### Error/response

CouchDbError dùng code ổn định như DATABASE_NOT_FOUND, NOT_FOUND, CONFLICT, AUTHENTICATION_ERROR, NETWORK_ERROR, TIMEOUT, SERVER_ERROR. toApiError() trả sanitized provisional format. Helpers response chưa được route nào sử dụng; runtime /api/health không đổi.

## 7. Cách cấu hình

Environment variables:

- COUCHDB_URL (default http://127.0.0.1:5984)
- COUCHDB_DATABASE (default recruitment_db)
- COUCHDB_USER và COUCHDB_PASSWORD (phải cùng có/cùng vắng)
- COUCHDB_TIMEOUT_MS (default 5000; range 100–60000)

Không đặt credential trong URL hoặc log. dotenv/config phụ thuộc working directory; khi chạy từ backend/, cung cấp các biến qua process environment hoặc ignored backend/.env. Không in hoặc sao chép giá trị root .env.

Chi tiết và ví dụ: docs/shared/COUCHDB_FOUNDATION_GUIDE.md.

## 8. Test results

- Foundation tests: node --test tests/foundation/*.test.js — PASS 15/15 ở lần chạy cuối.
- Full backend tests: npm.cmd test — FAIL; legacy data/pipeline tests báo nhiều lỗi ngoài Foundation. Xem mục 9.
- Không dùng live write tests.
- Fake-client coverage: config invalid, secret-safe errors, GET/metadata, CRUD request shapes, missing resource, conflict, network/timeout và Zod validation.

## 9. Verification results

- Foundation tests: PASS 15/15.
- Full backend suite: FAIL. Output có lỗi DATA-04B V04/V15; DATA-02B.3 failure-injection/release checks; DATA-02B.2 checksum/path checks; DATA-03.2 manifest checksum case; DATA-03.3B thiếu release input; DATA-03.4B publication checksum/idempotency cases. Các lỗi nhắc thiếu release paths, expected checksum không khớp working copy và một số failure-injection không đạt expected assertion. Không sửa dữ liệu để làm xanh suite.
- Review test code xác nhận các test live database trong V04/V05/V06 chỉ kiểm tra sự tồn tại/metadata; V04 đặt createDb=false và bị chặn trước thao tác ghi. Read-only metadata sau suite vẫn xác nhận 25,750 docs.
- Legacy test bị assertion sớm nên để lại data/scratch_bad_manifest.json; file này do chính test tạo, đã xóa đúng file test-artifact sau kiểm tra. Git status sau cleanup không còn data changes.
- Read-only CouchDB verification qua CouchDbClient: readiness PASS, CouchDB API version 3.5.2, database recruitment_db, doc_count 25,750; một document sample type resume_analysis xác thực Zod PASS.
- Docker CLI không được quyền truy cập Docker Engine trong shell preflight; không gọi lệnh điều khiển container.
- Runtime verification chỉ dùng GET server/database/document và Mango _find (HTTP POST chỉ đọc); không gọi POST ghi tài liệu, PUT, DELETE, importer hay index API.
- Backend package không định nghĩa build/lint scripts; không có lệnh build/lint để chạy.

## 10. Backend runtime và Git diff

- Existing Express app/routes không được sửa; không đổi prefix hoặc response contract.
- Git branch: feature/auth-profile-portal.
- Audit staged được giữ là A docs/ARCHITECTURE_DATABASE_AUDIT.md.
- Các file Foundation/report không tự git add; không commit/push.
- Những thay đổi dự kiến chỉ gồm các file mới liệt kê ở mục 5; Git status sau verification ghi ở kết luận.

## 11. Rủi ro và điểm cần TV2/TV3 phối hợp

- Database credentials cần có trong process environment; root .env không tự được dotenv nạp khi process chạy ở backend working directory.
- Client dùng native Fetch HTTP implementation, không Nano; không thêm dependency để tránh thay lockfile/network.
- Authentication/registration/ADMIN/prefix/API envelope/audit storage còn mở; provisional response helper không nên dùng làm contract chung trước freeze.
- TV2/TV3 phải xác nhận selectors, paging/sort và indexes theo query workloads; foundation không tạo indexes.
- find nhận Mango query; lớp nghiệp vụ phải allowlist input và enforce ownership.
- Readiness GET / + GET /{db} là read-only nhưng health route hiện không gọi nó.
- Docker CLI verification có thể bị chặn bởi policy/quyền Windows; HTTP readiness độc lập vẫn có thể xác minh service.

## 12. Acceptance criteria

- [x] Config validates protocol, URL userinfo, database name, credential pair and timeout without exposing values.
- [x] Client distinguishes database missing, document missing, conflict, authentication, network, timeout and server errors.
- [x] CRUD request behavior respects deterministic _id and caller-provided _rev, without blind retry.
- [x] BaseRepository delegates methods and applies optional Zod validation without adding business fields.
- [x] Response helpers remain provisional and existing health/root runtime behavior is unchanged.
- [x] Foundation unit tests PASS; full backend suite result recorded.
- [x] Read-only DB metadata confirms database remains at 25,750 docs; no write test was run against it.
- [x] Guide covers required TV1/TV2/TV3 handoff, env, interfaces, safety and limitations.
- [x] Branch/audit staged state unchanged; no unrelated files modified.

## 13. Trạng thái nghiệm thu

**PARTIAL.** Foundation fake-client tests và read-only CouchDB verification đạt; full backend suite thất bại trong data-pipeline/release tests không thuộc Foundation. Docker container state không xác minh được bằng Docker CLI do quyền daemon, nhưng CouchDB HTTP endpoint và database metadata đọc thành công. Không có evidence database count drift.

## 14. Bước tiếp theo

Sau khi review foundation, TV2 có thể implement JobRepository và TV3 InterviewRepository bằng BaseRepository/fake-client contract. TV1 tiếp tục Stage 03B cho readiness integration/config loading only after approved runtime contract; authentication/session work remains gated by Stage 02.5 decisions.
