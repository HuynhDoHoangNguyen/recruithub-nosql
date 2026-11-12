# BR-002 — Backup API và tác vụ xuất dữ liệu

Ngày: 12/11/2026, Asia/Bangkok. Nhánh: `codex/admin-backup-restore`.

## Phần A — Mini Plan trước khi thực hiện

**Task:** BR-002 — Backup API và tác vụ xuất dữ liệu.
**Status trước khi thực hiện:** PLAN READY, người dùng đã chỉ định thực hiện trong chat.
**Kết quả cần bàn giao:** bốn endpoint Admin, source allowlist, job store/spool private, xuất RHBR v1 có HMAC và kiểm thử. Không upload/restore/UI trong task này.

### 1. Hiện trạng và khoảng trống

| Hạng mục | Đã xác minh trước task | Còn thiếu | Bằng chứng |
|---|---|---|---|
| Contract | BR-001 được người dùng nghiệm thu | Implementation | docs/admin-backup-restore-contract.md |
| Admin | JWT guard, role guard có sẵn | Backup router | backend/src/middleware/job-application.middleware.js:27; middleware/authenticate.js:44 |
| Nguồn | Business hợp lệ; identity mismatch; audit thiếu cấu hình | Source registry | BR-001-baseline.md |
| Job/export | Chưa có | Private spool, lifecycle, writer | Chưa có trước task |
| Baseline | Backend 592/26/3, auth 46/10 | Đối chiếu sau thay đổi | BR-001 logs |

### 2. Phạm vi và quyết định thiết kế

Áp dụng contract RHBR v1 đã duyệt, không thay định dạng hoặc giới hạn. Dùng built-in Node và Zod hiện có; không thêm dependency. Tái sử dụng JWT guard đang tải User hiện hành và requireRole('ADMIN'). Store mặc định singleton trong một backend process; chỉ một job nặng trên một spool root. Service khởi tạo lười để thiếu key/ACL không làm backend crash. Trước job mới phải hoàn tất initialization/reconciliation.

Các nguồn không hợp lệ bị unavailable, không bypass getAuthDatabaseConfig. Không sửa .env hoặc lỗi đăng nhập; đó là phụ thuộc live acceptance. Giữ skill files và tài liệu frontend nguyên trạng. Mount backup router trước router Admin cũ để tránh factory Auth cũ chặn request backup trước khi tới guard mới.

### 3. Các bước thực hiện

| Mini task | File/điểm tích hợp | Đầu ra |
|---|---|---|
| A — Schema/config/sources | models/admin-backup.schema.js; services/admin-backup-source.service.js | Strict payload/UUID; dedicated key; nguồn sanitized/deduplicate |
| B — Job/spool | services/admin-backup-job.service.js | ACL, atomic metadata, ownership, busy, TTL/quota/restart |
| C — Export | models/admin-backup-source.repository.js; services/admin-backup-export.service.js | Read-only GET, streaming gzip, attachments, indexes, signature, readback |
| D — API | service/controller/routes; app.js | Bốn endpoint, guard và download |
| E — Test/report | Bốn suites + helper, báo cáo này, AGENTS.local.md | Fixture/HTTP tests và baseline comparison |

### 4. Acceptance Criteria và bằng chứng dự kiến

BR002-AC01–09 giữ nguyên mini plan đã duyệt: API; RBAC/owner; sources; đủ dữ liệu; integrity; lifecycle/spool; download; không hồi quy/ghi nguồn; bàn giao. Đánh giá thực tế ở Phần B.

## Phần B — Task Result

**Task Result**
**Status:** TECHNICAL PASS — chờ nghiệm thu BR-002. Đạt phạm vi export API bằng fixture/HTTP và NTFS ACL thực tế; chưa nghiệm thu live Admin/database export và chưa hoàn thành toàn ADMIN-BR.

### Implemented

| API | Kết quả |
|---|---|
| GET /api/v1/admin/backups/sources | Nguồn allowlist, unavailable reason, giới hạn; không lộ connection config |
| POST /api/v1/admin/backups | Strict source_id; 202 job_id; busy 409; admission kiểm tra tài nguyên |
| GET /api/v1/admin/backups/:id | Trạng thái/tiến trình/kết quả sanitized, owner-only |
| GET /api/v1/admin/backups/:id/download | Gzip attachment, no-store/nosniff/Content-Length; chỉ SUCCEEDED, chưa hết hạn |

- Authentication chạy lại mỗi request. Test thực tế qua createApp với JWT ký hợp lệ xác nhận đổi role thành Candidate bị 403, account LOCKED bị 401; fixture repository không có mutation.
- Signing config yêu cầu BACKUP_SIGNING_KEY và BACKUP_SIGNING_KEY_ID; từ chối key ngắn/placeholder hoặc trùng JWT/CouchDB/audit password. Không phát sinh key hoặc persist config trong task.
- Source reader chỉ có GET, redirect:error, timeout/AbortSignal, giới hạn bytes response; _all_docs key pagination 500 IDs rồi GET từng document theo revision chính xác, attachments đầy đủ. Không có method ghi CouchDB.
- Export streaming gzip NDJSON: header → documents → indexes → footer; giữ trường nghiệp vụ, bỏ revision metadata; checksum attachments/payload và HMAC footer. Kiểm tra nguồn sequence/count đầu-cuối, conflicts, duplicate IDs, loại index không hỗ trợ và giới hạn tài nguyên.
- File hoàn tất được đọc/giải nén streaming để kiểm tra cấu trúc, payload digest/HMAC và document count trước rename/publish. Đây là readback file do server tạo, không phải validator upload BR-003.
- Job có QUEUED/RUNNING/SUCCEEDED/FAILED/EXPIRED, phase EXPORTING/VERIFYING. Metadata ghi file mới bằng wx, sync rồi atomic rename. Mutex read/save theo job tránh lỗi Windows khi rename trong lúc file đang mở; retry EPERM/EBUSY có giới hạn.
- Spool mặc định os.tmpdir()/recruithub-backups-v1. NTFS: kiểm tra owner SID, thiết lập protected DACL chỉ SID backend FullControl và kiểm chứng lại; child files kế thừa. PowerShell helper windowsHide=true, không nhận command từ client. POSIX dùng owner/mode 0700 nhưng chưa kiểm chứng runtime trên POSIX.
- TTL 24h; metadata 7 ngày; cleanup mỗi 15 phút và startup/admission. Job đang chạy không bị cleanup. Startup chuyển stale QUEUED/RUNNING thành FAILED/JOB_INTERRUPTED, xóa artifact dở, không tự resume.
- Quota/disk preflight, một job nặng, deadline 10 phút, metadata failure fail closed; raw error không ra DTO/log. Download hủy giữa chừng đóng handle và không làm hỏng artifact.

### Files Changed

**Mới — 8 file runtime:**

- backend/src/models/admin-backup.schema.js — schemas, limits, config, canonical JSON và safe errors.
- backend/src/models/admin-backup-source.repository.js — adapter CouchDB chỉ đọc.
- backend/src/services/admin-backup-source.service.js — source registry.
- backend/src/services/admin-backup-job.service.js — filesystem/job lifecycle.
- backend/src/services/admin-backup-export.service.js — RHBR writer và readback.
- backend/src/services/admin-backup.service.js — điều phối, deadline và fail-closed.
- backend/src/controllers/admin-backup.controller.js — response và download streams.
- backend/src/routes/admin-backup.routes.js — endpoints, guards, validation.

**Mới — 5 file test:** tests/helpers/admin-backup-fixtures.js và tests/recruitment/admin-backup-{contract,export,job,api}.test.js dưới backend/.

**Mới — 1 file báo cáo:** tài liệu này.

**Sửa — 2 file:** backend/src/app.js (mount router, injectable backupService để test); AGENTS.local.md (nghiệm thu BR-001 và trạng thái BR-002).

Không chỉnh frontend/backend code khác, package/lockfile, .env, AGENTS.md, frontend guide, skills hoặc contract. Các file BR-001/skills chưa commit có sẵn được giữ nguyên. Không stage/commit/push/chuyển nhánh.

### Tests Executed

| Lệnh/kiểm chứng | Kết quả thực tế | Bằng chứng |
|---|---|---|
| node --test tests/recruitment/admin-backup-*.test.js | 22/22 PASS, exit 0 | focused log |
| Full backend tương đương npm test trên bản sao sạch | 643 tests: 614 PASS / 26 FAIL / 3 SKIP, exit 1 | final backend-test.log |
| node --test tests/auth-foundation/*.test.js trên bản sao | 56 tests: 46 PASS / 10 FAIL, exit 1 | final auth-test.log |
| So tên lỗi backend/auth với BR-001 | Khớp chính xác cả hai nhóm sau normalize test ordinal | Comparison command + appendix |
| Frontend npm run lint | exit 0; 0 error/2 warnings có sẵn | frontend-lint.log |
| Frontend npm run build | exit 0; chunk-size warning có sẵn | frontend-build.log |
| git diff --check | PASS | Output trống |
| Hash protected files | 21/21 không đổi | data/processed + .agents + AGENTS.md/frontend guide/integration doc |
| CouchDB GET metadata cuối task | recruitment_db 25.761 docs, seq giữ giá trị BR-001; demo 23 docs, seq giữ giá trị BR-001 | Runtime GET |
| Live authenticated export/browser | NOT RUN | Login config mismatch và signing key chưa provision; UI ngoài BR-002 |

Focused coverage: strict config/payload, source dedup/unavailable, guest/role/expired/locked/owner, createApp real JWT, independent HMAC round-trip (9 types + arbitrary fields + binary/Unicode attachment + view/index), empty DB, changed seq/conflict/duplicate/index/stub/base64, file/record/count/attachment limits, readback tamper/truncate, read-only HTTP pagination/upstream limits, concurrency, durable status, restart/TTL/retention, symlink/path traversal/quota, failure sanitation, timeout, metadata failure và canceled download.

### Cô lập, tài nguyên và các lần hiệu chỉnh

- Full backend chạy trên bản sao backend/scripts/data/frontend tại TEMP UUID, không chạy publication tests trên snapshot gốc. Node_modules junction chỉ dùng dependencies đã có; không install. Env được truyền trong bộ nhớ từ loader; không copy .env. Live write integration flags bị bỏ, 3 ca vẫn skip.
- Fixture HTTP servers dùng port ngẫu nhiên và được close. Test spool dùng rhbr-test-* dưới TEMP; helper kiểm tra resolved parent/prefix trước recursive cleanup; các spool được dọn qua t.after. Không tạo CouchDB test DB hoặc chạy thao tác ghi nguồn.
- Bản sao baseline và log giữ ngoài repo để kiểm chứng; đường dẫn/hash trong appendix. Không lưu production backup hay PII vào repo. Build chỉ sinh ignored dist/cache.
- Lần kiểm thử đầu phát hiện module Get-Acl tự nạp sai khi kế thừa PSModulePath từ PowerShell khác; sửa bằng import từ PSHOME của Windows PowerShell. Set-Acl gặp yêu cầu SeSecurityPrivilege không cần thiết; dùng Directory.SetAccessControl để chỉ đổi DACL, không đổi owner/SACL.
- Test concurrency phát hiện Windows rename metadata khi có reader: thêm mutex read/save và bounded retry. Download FileHandle được chuyển sang handle.createReadStream để tránh double-close. Các lỗi này đã sửa và final suites đạt.
- Không sửa các lỗi baseline backend/auth. Frontend tests không chạy lại vì không sửa UI; baseline Vitest BR-001 vẫn là 221 PASS/11 FAIL, không tuyên bố đã giải quyết.

### Research Fidelity

- **Source-confirmed:** mount/guards, GET-only reader, key-based paging, HMAC/readback, private ACL và lifecycle có code/tests tương ứng. Baseline tên lỗi so khớp trực tiếp với log BR-001.
- **Implementation inference:** single-process coordinator, bounded resources và NTFS helper là implementation của contract. Readback không đồng nghĩa đã triển khai upload validator hoặc restore.
- **Unresolved:** live Admin config, signing key provisioning/escrow, live full-dataset throughput, POSIX filesystem behavior. Các phần này không được ghi là PASS runtime.

### Acceptance Criteria

| AC | Trạng thái | Bằng chứng/phạm vi |
|---|---|---|
| BR002-AC01 | PASS | Bốn APIs, strict schema, envelopes và createApp integration |
| BR002-AC02 | PASS | Role/ownership/expired/locked tests; real JWT reload |
| BR002-AC03 | PASS | Registry config unavailable/deduplicate/sanitized |
| BR002-AC04 | PASS | Independent fixture verification: 9 types, arbitrary fields, design/index/attachment |
| BR002-AC05 | PASS | Hash/HMAC, readback tamper, failure cleanup, changed seq/conflict tests |
| BR002-AC06 | PASS | Concurrency, Windows ACL, timeout, TTL/quota/restart/metadata failure tests; POSIX runtime chưa xác minh |
| BR002-AC07 | PASS | Headers, owner, not-ready/expired, cancelled-download reuse |
| BR002-AC08 | PASS | No source writes; protected hashes unchanged; same backend/auth failure names |
| BR002-AC09 | PASS | Báo cáo, ledger, hướng dẫn rollout và đầu vào BR-003 |

AC BR-002 trên fixtures/HTTP đạt; live deployment acceptance còn phụ thuộc. Toàn ADMIN-BR chưa hoàn thành vì chưa có validate-upload, restore và UI.

### Risks / Deviations

- Một backend process; không vận hành nhiều worker/process dùng chung spool. Coordinator không phải distributed lock.
- Metadata ghi sync + atomic rename để chịu process restart; chưa cam kết power-loss durability toàn filesystem. Orphan directory/corrupted metadata không đọc được sẽ fail closed và cần vận hành kiểm tra, không tự xóa dữ liệu không rõ nguồn.
- Gói gzip không mã hóa, có thể chứa PII/password hashes. Dedicated HMAC key phải được giữ riêng để restore sau mất môi trường; mất key không verify được gói.
- Database có ghi liên tục có thể SOURCE_CHANGED. Live performance 25.750 documents chưa benchmark; per-doc GET ưu tiên revision/attachment correctness trong deadline.
- Không thay auth configuration, không thêm audit actions vào UC26, không giao diện/lịch sử job list mới trong BR-002.

### Cách bật và thử API sau provisioning

1. Owner môi trường thống nhất database identity/domain theo guard đang có; không tự sao chép tài khoản hoặc chuyển production sang demo.
2. Cấp BACKUP_SIGNING_KEY ngẫu nhiên >=32 byte và BACKUP_SIGNING_KEY_ID phù hợp vào environment của backend; giữ bản key riêng ngoài backup. Không ghi secret trong tài liệu/source hoặc gửi lên frontend.
3. Khởi động lại backend theo quy trình của người vận hành. Thiếu cấu hình chỉ khiến backup trả 503, không ngăn health/public API.
4. Dùng JWT Admin hiện hành gọi GET sources; POST {source_id:'business'}; poll job_id; download khi SUCCEEDED. Không dùng token trong URL; không log token/file contents.
5. Tải lại trang/đóng HTTP client không hủy export; BR-004 sẽ bổ sung UI theo dõi.

### Recommended Next Task

**BR-003 — Upload validation và restore API.** Tái sử dụng limits, canonical/HMAC format, source allowlist và job store; xây validator cho input không đáng tin cậy (khác readback nội bộ), one-time validation ID và restore chỉ private new database. Không viết vào nguồn. Trước BR-004/005 cần xử lý live login config và key provisioning. Cập nhật ledger và dùng tiếp mẫu Phần A/B.

## Appendix — Logs và đối chiếu

Các đường dẫn và hashes dưới đây nhận diện log kiểm thử, không thay cho kết luận PASS/FAIL.

Final isolated baseline root: C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br002-verified-84ca093df4a84693ad235e064d1ef675

| Artifact | SHA-256 |
|---|---|
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br002-focused.log | f0e382927695bd7864d381bb21211608aeb44bf15a45d66112fbe46d50255c12 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br002-verified-84ca093df4a84693ad235e064d1ef675\backend-test.log | 1c2661d5ad4c3a55f0895b8c3a4924125df132ba80c7f7035fc570c3c61b6e51 |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br002-verified-84ca093df4a84693ad235e064d1ef675\auth-test.log | 0d221aad8af771fe8d8aabb15a5932996e07c2edb8af02640f9abd88b772e6db |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br002-a13f4c10dc024f56b0fb39d7002012dc\frontend-lint.log | 0ba9b011a6585d146e9bb43b87e377ca6d38aafbe695979258ac62b31e82976d |
| C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br002-a13f4c10dc024f56b0fb39d7002012dc\frontend-build.log | 145b19e5a278be612a1c374f745bde3cf2fa9ebd3f6f34541bfb032bbc306b19 |

Backend và auth fail-name comparison với BR-001: **EXACT MATCH** (bỏ ordinal, giữ tên đầy đủ).

### Focused tests

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

### Source hashes — khớp bản sao chạy full tests

| File | SHA-256 |
|---|---|
| backend/src/app.js | 4a56232a25c0fb0d217b72f55fe0d795234a50db125e09a6fc6ed582934632ae |
| backend/src/controllers/admin-backup.controller.js | 614e0831e41b82b324dcdf9f0bfda1334cfb5c9b7e374b032bdfbe38f6b6f7bc |
| backend/src/routes/admin-backup.routes.js | 88ffe46aeb876fd3810f8d5302944aec79b342d486663e1fd165a53740649cb6 |
| backend/src/models/admin-backup.schema.js | 6914c8e07cf30a45280f0d0ed4748b4df6d99ce001425add8b3a7e401d3f2db4 |
| backend/src/models/admin-backup-source.repository.js | 7051d8823fbead25b0b61211a6dbc53f8718f48ff26ea54694cd30f3651b2baf |
| backend/src/services/admin-backup.service.js | cd345bc5d1422b9fbdfb229ee70d70094adbbc303ea77612db9cdfe04a5ebe00 |
| backend/src/services/admin-backup-source.service.js | 173f603afaddd383b3d0d9e7f982f1ea24c2ac23417ae566c15c1dbb7042390a |
| backend/src/services/admin-backup-job.service.js | 8166e52d539d92a2235d7d1179639adaa4ed8b4898826538b1d6f640fe69f582 |
| backend/src/services/admin-backup-export.service.js | c8255f3715cd293dff929062efdd7de1387d6ca9e1f0790a1dd2a8076481aa10 |
| backend/tests/helpers/admin-backup-fixtures.js | 27e836131b8b11944bbf996f78ad3bea6b41271809bf50e98afe3a21917b26fb |
| backend/tests/recruitment/admin-backup-api.test.js | d82c7ef03f1fec867d4547d057d1b806a2e7275cee397bd1bfdc240c05316b59 |
| backend/tests/recruitment/admin-backup-contract.test.js | 45eb9f03e93c5c55e143827ded6a7e7322f3610411ad71f89684d2a65ac5e830 |
| backend/tests/recruitment/admin-backup-export.test.js | a54a3a45f527643093373a5d46c173a9ff2870c378162a72777842e8c6a56715 |
| backend/tests/recruitment/admin-backup-job.test.js | ea6031c0c06fe76cf2cbb073151dfa9c81cb166dbf0da04e90434d4b72ef5506 |

Protected hashes rechecked: 21/21 unchanged.
