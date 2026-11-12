# BR-003 — Kiểm tra file upload và Restore API

Ngày: 12/11/2026, Asia/Bangkok. Nhánh: `codex/admin-backup-restore`.

## Phần A — Mini Plan trước khi thực hiện

**Task:** BR-003 — Kiểm tra file upload và Restore API.
**Status trước thực hiện:** PLAN READY; người dùng nghiệm thu BR-002, duyệt và chỉ định thực hiện BR-003 trong chat.
**Kết quả cần bàn giao:** upload gzip RHBR, kiểm tra trước tạo database, validation dùng một lần, restore private target mới và đối chiếu nội dung. Chưa có UI trong BR-003.

### 1. Hiện trạng và khoảng trống

| Hạng mục | Đã xác minh trước task | Còn thiếu | Bằng chứng |
|---|---|---|---|
| Backup | RHBR writer/HMAC/readback đã có | Validator input không đáng tin cậy | BR-002-result.md; admin-backup-export.service.js |
| Admin | JWT/RBAC, owner-only jobs | Upload/restore APIs | admin-backup.routes.js |
| Job store | Private spool, busy, TTL, restart | VALIDATE/RESTORE và reservation durable | admin-backup-job.service.js |
| CouchDB | Reader chỉ đọc | Private target writer và verification | admin-backup-source.repository.js |
| Live app | Login config mismatch, key chưa provision | Rollout vận hành | BR-001/002 reports |

### 2. Phạm vi và quyết định thiết kế

Thực hiện BR-003A–F đã duyệt. Không sửa .env, auth/business logic, frontend, AGENTS.md, template hoặc skills. Không cài dependency. Không chuyển cấu hình ứng dụng sau restore. Nguồn/credentials lấy từ server config, không từ file hoặc client. Dùng chung backup job store và khóa single-process; validation reservation lưu trên đĩa. Chỉ validate RHBR v1 có HMAC hợp lệ.

Contract không thay đổi. Giới hạn MVP được ghi rõ: JSON indexes không partitioned; không suy diễn partition mode vì header v1 chưa lưu cấu hình partitioned database. File cần signing key ID hiện hành. Có thể phục hồi dữ liệu độc lập, chưa phải cutover hoặc backup toàn máy chủ.

### 3. Các bước thực hiện

| Mini task | Thực hiện | Điểm tích hợp | Kết quả |
|---|---|---|---|
| A | Restore schema/job types/one-time reservation | models/admin-restore.schema.js; backup job store | Strict payload và AVAILABLE/RESERVED/CONSUMED |
| B | Upload/stream validator | services/admin-backup-validation.service.js; upload controller | File kiểm tra đầy đủ trước create |
| C | Private target adapter | models/admin-restore.repository.js | Preflight quyền/default security; fresh create only |
| D | Worker/batch/error recovery | services/admin-restore.service.js | Bulk rows, bounded retry, no overwrite/delete/resume |
| E | Verification/API | verification service, restore routes/controller | Exact content/attachments/indexes và job status |
| F | Tests/report/ledger | 4 suites + Docker integration, helper | Baseline, protected hashes, tài nguyên và AC |

### 4. Acceptance Criteria và bằng chứng dự kiến

BR003-AC01–09 giữ mini plan đã duyệt: API/RBAC; invalid-file-before-create; streaming/cancel; validation lifecycle; private new target; partial/ambiguous writes; round-trip verification; restart/timeout; hồi quy/bàn giao. Kết quả thực tế ở Phần B.

## Phần B — Task Result

**Task Result**
**Status:** TECHNICAL PASS — chờ nghiệm thu BR-003. API/worker có fixture HTTP và integration CouchDB thật cô lập; chưa nghiệm thu giao diện hoặc môi trường production đang chạy.

### Implemented

| Endpoint | Hành vi |
|---|---|
| POST /api/v1/admin/backups/validate | application/octet-stream chứa gzip; 202 sau khi upload lưu xong; validation chạy nền |
| GET /api/v1/admin/backups/:id | Theo dõi BACKUP/VALIDATE; validation success trả summary/validation_id/TTL/state |
| POST /api/v1/admin/restores | Strict validation_id, target_database, confirm:true; 202 restore job |
| GET /api/v1/admin/restores/:id | Owner-only progress/result/error; restore không được đọc qua backup status route |

**Validation và file handling**

- Dùng nguyên JWT/Admin guard có sẵn cho cả upload và restore. Không tăng global JSON body limit; sai media type/Content-Encoding trả 415. Body quá lớn trả 413; client ngắt upload làm job thất bại, xóa partial và nhả khóa.
- Gzip được lưu vào private spool bằng tên server tạo. Streaming parser giới hạn compressed/uncompressed/record/doc/attachment sizes; strict UTF-8/no BOM, độ sâu JSON tối đa 64 và document ID tối đa 1024 bytes. Không giải nén ra cây thư mục và không thực thi design code khi validate.
- Kiểm tra strict envelope/header/version/key ID/record order, ID trùng, reserved metadata, base64, attachment bytes/hash, manifest counts, index reference/type, payload SHA-256 và timing-safe HMAC.
- File lỗi không tạo target. Kết quả thành công chỉ chứa summary, không đưa nội dung documents/attachments ra DTO. Validation upload không tải qua endpoint download backup.
- Trước restore validate lại toàn gói và đối chiếu digest gzip với digest đã lưu. Worker so digest từng document với bản đã kiểm tra; ghi normalized document, không dùng _rev nguồn.

**Tác vụ và bảo vệ target**

- Job types BACKUP/VALIDATE/RESTORE dùng chung khóa nặng. Lifecycle mutex ngăn cleanup/expiry đua với reserve/consume. Validation AVAILABLE -> RESERVED -> CONSUMED được lưu durable, chỉ owner sử dụng, không double-submit.
- Startup chuyển job bị gián đoạn thành FAILED/JOB_INTERRUPTED; reservation còn RESERVED thành CONSUMED. Restore gián đoạn báo đích có thể chưa hoàn chỉnh, không tự resume.
- Target regex `^recruithub_restore_[a-z0-9_]{1,64}$`, denylist mọi nguồn đã cấu hình kể cả unavailable. Không nhận URL, credentials hoặc _security từ archive.
- Repository kiểm tra server-admin session, CouchDB major 3 và cấu hình default_security của toàn bộ nodes. Giá trị không khai báo được hiểu theo documented CouchDB 3 default admin_only; nếu cấu hình công khai/không kiểm chứng được thì fail trước create.
- HEAD không tồn tại rồi PUT fresh create; race hoặc kết quả create không rõ không được tiếp quản target để viết. Sau create kiểm tra effective security private, ghi _security chỉ _admin rồi xác minh lại. Chỉ adapter đã xác nhận tạo thành công mới có quyền bulk/index/read target.

**Restore và đối chiếu**

- Đọc gzip hai lượt để ghi docs thường trước, design docs sau. Batch tối đa 200 docs/5 MiB, oversized single doc vẫn phải nằm trong giới hạn record. Không buffer toàn database.
- Kiểm tra từng row _bulk_docs. Conflict/partial error dừng, không overwrite mù. Nếu response không rõ, đọc ID và so content trước tối đa 3 lần ghi; nội dung khác thì fail.
- Kết quả thất bại phân biệt completed_batch_documents và known_written_documents_minimum, không coi số batch hoàn thành là tổng số đã ghi thực tế. Không tuyên bố rollback.
- Tạo index JSON còn thiếu, so định nghĩa; verification cuối không tạo thêm index. Exact ID set/count, canonical document content, attachment names/content types/data và design docs đều được so bằng digest. Sequence/private security kiểm tra đầu-cuối verification.
- Chỉ SUCCEEDED sau đối chiếu và lưu consumption. Kết quả có requires_manual_configuration=true; không đổi app config. Đích thất bại không bị DELETE.

### Files Changed

Danh sách dưới tính so với working tree BR-002 đã nghiệm thu, không tính lại các file skill/BR-001/BR-002 chưa commit có sẵn.

**Mới — 7 file runtime:**

- backend/src/models/admin-restore.schema.js
- backend/src/models/admin-restore.repository.js
- backend/src/services/admin-backup-validation.service.js
- backend/src/services/admin-restore.service.js
- backend/src/services/admin-restore-verification.service.js
- backend/src/controllers/admin-restore.controller.js
- backend/src/routes/admin-restore.routes.js

**Mới — 6 file test/helper:**

- backend/tests/helpers/admin-restore-fixtures.js
- backend/tests/recruitment/admin-backup-validation.test.js
- backend/tests/recruitment/admin-restore-runtime.test.js
- backend/tests/recruitment/admin-restore-api.test.js
- backend/tests/recruitment/admin-restore-verification.test.js
- backend/tests/recruitment/admin-restore.integration.test.js

**Mới — 1 báo cáo:** tài liệu này.

**Sửa — 7 file:** admin-backup.schema.js (safe errors), admin-backup-source.repository.js (Accept JSON/design URL), admin-backup-job.service.js (types/reservation/lifecycle/cleanup), admin-backup.service.js (restore facade/status), admin-backup.routes.js (upload/restore mount), admin-backup-export.test.js (regression reader), AGENTS.local.md (ledger).

Không cần sửa thêm app.js trong BR-003: router mới dùng điểm mount đã có của BR-002. Không stage, commit, push hoặc switch branch.

### Tests Executed

| Kiểm chứng | Kết quả thực tế | Bằng chứng |
|---|---|---|
| node --test tests/recruitment/admin-backup-*.test.js tests/recruitment/admin-restore-*.test.js | 40/40 PASS, exit 0 | focused log |
| BR003_DOCKER_INTEGRATION=1 node --test tests/recruitment/admin-restore.integration.test.js | 1/1 PASS trên CouchDB 3.5.2.1 | integration log |
| Final-source round-trip kiểm tra lại trên container đã giữ | PASS, 12 docs, source seq unchanged, anonymous 401 | final-roundtrip-verified.log; không tạo container mới |
| Full backend tương đương npm test, bản sao sạch | 662 tests: 632 PASS / 26 FAIL / 4 SKIP, exit 1 | final backend-test.log |
| Auth foundation trên bản sao | 46 PASS / 10 FAIL, exit 1 | auth-test.log |
| Tên lỗi so BR-002 | Backend và auth khớp chính xác sau normalize ordinal | comparison + appendix |
| Frontend lint/build | Cả hai exit 0; 2 lint warnings và chunk warning có sẵn | frontend logs |
| git diff --check | PASS | Output không có whitespace errors |
| Protected SHA-256 | 22/22 không đổi | snapshots, skills, AGENTS.md, frontend guide, contract/integration doc |
| GET metadata hai DB dự án | Business 25.761; demo 23; opaque sequences giữ giá trị BR-001/002 | Chỉ GET, không export/restore production |

Baseline BR-002 là 643 tests: 614/26/3. BR-003 thêm 18 ca mặc định đạt; integration thêm 1 ca skip mặc định, chạy riêng đạt. Không sửa 26 lỗi backend hoặc 10 lỗi auth đã có. Frontend test suite không chạy lại vì không sửa giao diện; không tuyên bố lỗi UI cũ được giải quyết.

### Integration thật và tài nguyên

- Integration tự tạo Docker container riêng, bind port ngẫu nhiên vào 127.0.0.1, credentials ngẫu nhiên truyền qua child environment, không ghi ra file/log/source. Không dùng CouchDB dự án ở port 5984 để ghi thử.
- Source tổng hợp br003_source_fixture: 9 docs thuộc 9 loại nghiệp vụ + 1 asset binary + 2 design docs (view và Mango index) = 12 docs. Export bằng reader thật, upload/validate, restore bằng adapter thật, đối chiếu 12/12; source update_seq không đổi. Anonymous GET target trả 401.
- Integration target: recruithub_restore_test_0a96b011dc1f4ef8ab439c2a97d9db17; final-source rerun target: recruithub_restore_test_9765c4a657744c1fb79a387af699a4f6; cùng container recruithub-br003-test-1e9a2e90. Test gọi service thật với CouchDB thật; HTTP/RBAC được kiểm tra ở suite API riêng. Không gọi đây là đăng nhập production xuyên suốt.
- Các lần chẩn đoán tạo tổng cộng 13 container có prefix recruithub-br003-test-. Tất cả đã dừng; giữ lại database/container cô lập để review, không gọi DELETE database hoặc tự remove dữ liệu. Danh sách container ở appendix. Việc dọn các tài nguyên giữ lại cần phạm vi vận hành riêng.
- Test HTTP fixture servers đóng sau test; spool tổng hợp rhbr-test-* được dọn bằng helper có kiểm tra resolved path. Bản sao baseline/log giữ ở TEMP ngoài Git để tái kiểm chứng.
- Một final-source harness ban đầu thiếu event-loop ref dừng sớm; rerun có ref đạt. Scratch tổng hợp còn tại C:/Users/HIENDANG/AppData/Local/Temp/rhbr-final-fEoiXC: automatic approval review chặn lệnh Remove-Item với lý do “blocked by policy”, không cung cấp chi tiết. Không thử lệnh khác để vượt chặn; giữ nguyên và ghi nhận. Không có production data ở scratch này.

### Research Fidelity

- **Source-confirmed:** schema/API/guards, streaming limits, one-time reservation, fresh private creation, bounded ambiguous-write reconciliation, content verification có code/tests; integration thật xác nhận attachment/index/security.
- **Implementation inference:** single-process job coordinator và hash/canonical comparison là implementation contract; không phải CouchDB transaction đa document.
- **Unresolved:** live login mismatch/signing-key provisioning vẫn là rollout dependency. POSIX filesystem runtime chưa chạy. Partitioned indexes chưa hỗ trợ vì RHBR v1 không mang đủ cấu hình partitioned database.
- Primary docs: https://docs.couchdb.org/en/stable/config/couchdb.html (default_security), https://docs.couchdb.org/en/stable/api/database/security.html, https://docs.couchdb.org/en/stable/api/database/common.html. CouchDB 3 mặc định admin_only khi không cấu hình; admin/member security có thể bỏ names hoặc admins rỗng nhưng vẫn effective server-admin-only. Adapter xác minh semantics rồi persist policy explicit.

### Acceptance Criteria

| AC | Trạng thái | Bằng chứng/phạm vi |
|---|---|---|
| BR003-AC01 | PASS | Upload/create/status strict API, role/session/owner tests |
| BR003-AC02 | PASS | Invalid/tampered records fail validation; altered validated file không khởi tạo repository/target |
| BR003-AC03 | PASS | Limits, truncated gzip, oversize HTTP 413, aborted upload releases lock |
| BR003-AC04 | PASS | TTL, reservation durable, double-submit, cleanup lifecycle mutex |
| BR003-AC05 | PASS | Protected/existing/race/default-security tests; real private target and anonymous 401 |
| BR003-AC06 | PASS | Bulk rows/conflict/ambiguous-response tests; failure result không giả rollback |
| BR003-AC07 | PASS | Real 12-doc round-trip có binary asset/index/view; content mismatch tests |
| BR003-AC08 | PASS | Deadline, stale RESTORE restart và RESERVED consumption; không resume |
| BR003-AC09 | PASS | Same baseline failure names, report/ledger, protected hashes |

AC BR-003 trong phạm vi API/non-partitioned data đạt; toàn ADMIN-BR vẫn chưa xong vì chưa có Admin UI/BR-004 và nghiệm thu ứng dụng cuối BR-005. Chưa ACCEPTED thay người dùng.

### Risks / Deviations

- Integration thật phát hiện lỗi BR-002: thiếu Accept: application/json làm CouchDB chọn multipart khi đọc attachment. Sửa đúng reader liên quan và thêm regression assertion; design document URL cũng giữ reserved _design/ prefix rõ ràng.
- Các lần thử ban đầu gặp cancellation của test harness do chỉ có unref fetch/deadline; integration giữ event-loop ref như HTTP server. Streaming parser đổi sang pipeline được dispose đầy đủ để lỗi gzip/consumer rejection không thành unhandled event hoặc promise treo.
- Default_security v3 có thể không xuất hiện trong config section và _security có thể thiếu names; implementation dùng documented defaults + effective ACL, sau đó ghi explicit _admin policy. Không tự thay server config để làm test pass.
- Restore không atomic; timeout/network failure có thể để lại target private chưa hoàn chỉnh. Không tự xóa, không auto cutover, không tự resume. Signed design docs được cài sau documents thường; validator không chạy code của chúng.
- Single backend process; không có distributed coordination. Local spool/key phải được bảo vệ ở môi trường triển khai. Gzip không mã hóa; signing key phải lưu riêng.
- Partitioned indexes trả UNSUPPORTED_INDEX; muốn hỗ trợ partitioned databases cần quyết định mở rộng format/contract riêng. Validator depth 64/ID 1024 bytes là giới hạn bảo vệ, có thể từ chối signed archive ngoài các giới hạn này.
- Không sửa auth config hoặc cấp key production. Live API acceptance vẫn phụ thuộc môi trường; không bypass guard để tuyên bố đạt.

### Recommended Next Task

**BR-004 — Giao diện Admin Sao lưu & khôi phục.** Đọc frontend guide/template và áp dụng skill UI phù hợp để lập Mini Plan trước code. UI dùng endpoints đã có: upload progress -> validation summary -> confirm fresh target -> restore polling/result. Bốn trạng thái và responsive; hiển thị file chứa dữ liệu nhạy cảm, validation một lần, target chưa cutover và partial failure. Chuẩn bị riêng lựa chọn cấu hình identity/domain/key cho BR-005, không ngầm đổi môi trường.

## Appendix — Artifacts và kiểm chứng

Đường dẫn/hash dưới đây nhận diện log thực tế; không lưu credentials hoặc production backup.

Final baseline root: C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-final-c1457f97228c4b80bcbe504b1d93af2e

| Artifact | SHA-256 |
|---|---|
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-final-c1457f97228c4b80bcbe504b1d93af2e\backend-test.log | f57f70564ae67f49e8b9b6a4b0553dd51ff1a6e32ebe9cc87a316ea4d06ff921 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-final-c1457f97228c4b80bcbe504b1d93af2e\auth-test.log | 207aefcc9cae43a01a425d3009d7a540f670f01f270d995f268a0aa9448b6736 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-focused.log | 9f73bfa01bedb33be38162b7319663d9487f41a0f6110d39a93e5b49359f0f53 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-integration.log | 72db9b9e0473f204176deca94f9bf791c9052364201bbf29586c47ea65ef8fd9 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-final-roundtrip-verified.log | 266c08816c4ab387ea9d5ca6857556ad71c7e208012afb9ac2d4e1255d2624f1 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-frontend-lint.log | 0ba9b011a6585d146e9bb43b87e377ca6d38aafbe695979258ac62b31e82976d |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br003-frontend-build.log | 2846e86abaefe6084a93b99e61238d0be1342231d876b28c144c70d1923056cd |

Backend/auth baseline fail names: EXACT MATCH với BR-002. Protected files: 22/22 unchanged.

### Focused cases

- all backup APIs require authenticated active Admin before validation or service calls
- Admin HTTP round-trip creates/polls/downloads signed RHBR; rejects other owner and bad inputs
- missing signing config disables feature without crashing HTTP server or exposing keys
- client-cancelled download closes streams and leaves the successful artifact reusable
- actual createApp mount uses real JWT guard and reloads Admin role/status
- backup configuration rejects missing, placeholder, reused keys and invalid key IDs without exposing inputs
- backup contracts reject unexpected payload fields, arbitrary sources and path-like IDs
- source registry deduplicates valid sources and sanitizes unavailable source configuration
- RHBR export round-trip independently verifies 9 types, arbitrary fields, design/index and binary attachment HMAC
- empty database exports header/indexes/footer and no fake documents
- readback verification detects altered payload/footer and truncated gzip before publication
- export rejects changed sequence, conflicts, duplicate IDs, unsupported indexes and incomplete attachment
- streaming export enforces document, record, attachment, total and compressed limits
- CouchDB reader performs only GET, pages by key and retrieves exact attachment revision
- reader sanitizes upstream failures, bounds responses and honors abort without retrying writes
- job admission serializes tasks; success is durable and artifacts are owner-only
- expired artifacts are removed; running jobs survive cleanup; retained metadata eventually expires
- restart fails stale jobs, removes partial artifacts and never resumes source work
- quota and insecure/symlink spool fail closed without following paths
- failed export removes partial output and sanitizes error details
- job timeout aborts source I/O and prevents publishing artifact
- metadata write failures stop publication and further admission instead of reporting success
- untrusted validator checks the complete signed document/attachment/index manifest
- validator rejects tamper, truncation, unknown keys/version, duplicate IDs, metadata, stub and extra records
- even correctly signed manifests must have correct counts and attachment checksums
- validator bounds compressed/decompressed bytes, documents, records and attachments
- upload and restore APIs apply role/session guard before accepting bytes or JSON
- HTTP upload -> validation -> restore -> status works and enforces owner and strict payload
- oversize binary upload returns 413 and leaves no reusable validation/target
- aborted binary upload fails job, removes partial and releases the shared lock
- backup/upload/validate/restore round-trip preserves documents and binary attachments; validation is one-time
- tampered validated file never creates target and is consumed after attempted restore
- protected/existing target, TTL and ownership checks prevent unsafe restore
- partial bulk errors fail target without retrying conflicts or claiming rollback
- ambiguous bulk response is reconciled by content; different saved content fails closed
- restart consumes RESERVED validation and fails interrupted restore without resuming
- concurrent restore submissions share the backup lock and cannot consume validation twice
- restore deadline aborts target I/O, consumes validation and never reports success
- target adapter preflights private defaults, rejects existing/racing target and never writes source
- verification detects missing/extra docs, wrong fields/attachments, indexes and concurrent changes

### Runtime/test source hashes — match final full-test copy

| File | SHA-256 |
|---|---|
| backend/src/app.js | 4a56232a25c0fb0d217b72f55fe0d795234a50db125e09a6fc6ed582934632ae |
| backend/src/models/admin-backup-source.repository.js | da5e6a82f3d4659b83904a50b78eb589923aaeef7e21f1b612a85ccd756c910f |
| backend/src/models/admin-backup.schema.js | 376ef61ee43521d90d76dd556bf5c61e0f6b83a4150348c71383f5d3dd40bc27 |
| backend/src/models/admin-restore.repository.js | 99b67511a4bccee3337f221ed6186e37579489060b807c34e43f849a644acc81 |
| backend/src/models/admin-restore.schema.js | 070702a2dcac03bc439077caad6684e3978d4b983745a4f405ac5064344b0b09 |
| backend/src/services/admin-backup-export.service.js | c8255f3715cd293dff929062efdd7de1387d6ca9e1f0790a1dd2a8076481aa10 |
| backend/src/services/admin-backup-job.service.js | 0b9e7b4ec50594f53c90ef4261cac44071fb052fe68e78c8f079d3b95e07082e |
| backend/src/services/admin-backup-source.service.js | 173f603afaddd383b3d0d9e7f982f1ea24c2ac23417ae566c15c1dbb7042390a |
| backend/src/services/admin-backup-validation.service.js | 97b15d5d06d309752503a0a9feb19e510f80323c9c6151a7ad11c3aaffa71fc4 |
| backend/src/services/admin-backup.service.js | 4872f64ff6d42ee902aaaf5f4f58189b679a6fe310b2dd3ac8618ce8368bfb17 |
| backend/src/services/admin-restore-verification.service.js | 27c647ef77120d89610eecefd207e247b39f698110d661b5d6512729d7adf079 |
| backend/src/services/admin-restore.service.js | 5baa433988bbd3e43101500934f642af1a1d04fc183fdbe70e78d07b68b192c2 |
| backend/src/controllers/admin-backup.controller.js | 614e0831e41b82b324dcdf9f0bfda1334cfb5c9b7e374b032bdfbe38f6b6f7bc |
| backend/src/controllers/admin-restore.controller.js | 1a9b88284d2b38d743e8e68e2a7a1000b74b5920dff47fa065fa3eb8d8b06a69 |
| backend/src/routes/admin-backup.routes.js | 6c3123c4e5453ee912d92aabdff605d1b98dd7ba9ede609dfb18c28c35f7e4a5 |
| backend/src/routes/admin-restore.routes.js | 36aa8a0739f7d821723904edbcd9187c853dc26f75dc964d031d0e16078e07d9 |
| backend/tests/recruitment/admin-backup-api.test.js | d82c7ef03f1fec867d4547d057d1b806a2e7275cee397bd1bfdc240c05316b59 |
| backend/tests/recruitment/admin-backup-contract.test.js | 45eb9f03e93c5c55e143827ded6a7e7322f3610411ad71f89684d2a65ac5e830 |
| backend/tests/recruitment/admin-backup-export.test.js | b3f0394a5dc47979c55d4ee077e8df5fe04e704df342dc354e778bc3259a6910 |
| backend/tests/recruitment/admin-backup-job.test.js | ea6031c0c06fe76cf2cbb073151dfa9c81cb166dbf0da04e90434d4b72ef5506 |
| backend/tests/recruitment/admin-backup-validation.test.js | eebaca8f5f24d88bdb3da6e7a00a4a916c6d2e7f73ba1d8dfee707a6f1aa44b5 |
| backend/tests/recruitment/admin-restore-api.test.js | 43195ee49ff8ca4592e5bd2ec5f8b411e757bd0e1d82aa10b7018f48cc49374b |
| backend/tests/recruitment/admin-restore-runtime.test.js | b1c3ad0a5b774027ad2c6943466079af014be56bda8cd7b6970c0dbf1c1473ab |
| backend/tests/recruitment/admin-restore-verification.test.js | c0953ffb82f6e18044e3ed40c3d9ea3b549055a730a3dfd2774b8bdb416a0226 |
| backend/tests/recruitment/admin-restore.integration.test.js | 6ecd935951855b8bc3c6c696c28bdd9ce8124d1a22317e356d8e329a079312ed |
| backend/tests/helpers/admin-restore-fixtures.js | 577665d96a1406b70282f4679c9b061d82546dcd4aeb944e0a3233afc155d552 |

### Retained test containers

- recruithub-br003-test-1e9a2e90 Exited (0) About a minute ago
- recruithub-br003-test-aef69b3e Exited (0) 10 minutes ago
- recruithub-br003-test-222b9dc4 Exited (0) 10 minutes ago
- recruithub-br003-test-50b08730 Exited (0) 11 minutes ago
- recruithub-br003-test-5fae1d5c Exited (0) 11 minutes ago
- recruithub-br003-test-6569133d Exited (0) 11 minutes ago
- recruithub-br003-test-dacb3013 Exited (0) 12 minutes ago
- recruithub-br003-test-eee8fe02 Exited (0) 12 minutes ago
- recruithub-br003-test-dff7f531 Exited (0) 13 minutes ago
- recruithub-br003-test-838e12d6 Exited (0) 13 minutes ago
- recruithub-br003-test-091c87ab Exited (0) 13 minutes ago
- recruithub-br003-test-8bd3ff77 Exited (137) 14 minutes ago
- recruithub-br003-test-0fae9529 Exited (143) 14 minutes ago

### Final-source real round-trip

{"result":"PASS","container":"recruithub-br003-test-1e9a2e90","source":"br003_source_fixture","target":"recruithub_restore_test_9765c4a657744c1fb79a387af699a4f6","verified":12,"sourceSequenceUnchanged":true,"anonymousStatus":401}
Stopped retained test container; no database DELETE.

