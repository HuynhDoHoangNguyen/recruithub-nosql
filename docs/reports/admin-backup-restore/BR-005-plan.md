# BR-005 — Kiểm thử tích hợp và nghiệm thu vận hành backup/restore

## Phần A — Mini Plan trước khi thực hiện

**Task:** BR-005 — Kiểm thử tích hợp và nghiệm thu vận hành backup/restore.

**Status:** PLAN READY — chờ duyệt triển khai. Nghiệm thu cấu hình dự án thật còn gate chưa đủ điều kiện.

**Kết quả cần bàn giao:** real Auth/login/JWT → Admin UI → API → CouchDB roundtrip; kiểm thử quyền, toàn vẹn, lỗi và vòng đời tác vụ; bằng chứng browser; runbook và closure matrix tách isolated acceptance với deployment acceptance.

### 1. Hiện trạng và khoảng trống

| Hạng mục | Đã xác minh | Còn thiếu | Bằng chứng |
|---|---|---|---|
| Git | codex/admin-backup-restore, HEAD de65be49f7363317130a2f501094099deb6ac9ac; BR-001–004 chưa commit; BR-004 ACCEPTED | Bảo toàn thay đổi | Git status, AGENTS.local.md |
| Backend | BR-004 có40 focused PASS; BR-003 có real CouchDB integration | Real Auth + process lifecycle acceptance | backend/tests/recruitment/admin-*.test.js |
| UI |19 test mới, Edge24 checks/real CouchDB roundtrip12 docs | Browser trước dùng fixture login | BR-004-result.md; frontend/tests/browser/admin-backup-restore.mjs |
| Auth | Default app dùng JWT guard tải lại User; login dùng AuthService/repositories | Seed accounts Argon2/hợp schema, endpoint login thật | backend/src/app.js; routes/auth.routes.js; middleware/job-application.middleware.js |
| Config | Loader trả DATABASE_CONFIGURATION_MISMATCH và BACKUP_CONFIGURATION_ERROR; signing key/ID/audit absent | Môi trường deployment hợp lệ | backend/src/config/load-environment.js; auth-database.config.js; models/admin-backup.schema.js |
| Lifecycle | Service/unit restart/expiry/timeout/busy/partial đã có | Process crash/restart thật/cùng spool/đích CouchDB thật | admin-backup-job.test.js; admin-restore-runtime.test.js |
| Baseline | Frontend BR-004:240 PASS/11 FAIL, Node7; backend BR-003:632 PASS/26 FAIL/4 SKIP, auth46/10 | Đo mới/so tên ca lỗi | Reports BR-003/004 |

Probe chỉ in code/boolean trong process riêng theo loader hiện hành; không in secret, không persist config và không chứng minh runtime app đang chạy đã được nghiệm thu.

### 2. Phạm vi và quyết định thiết kế

#### Môi trường

- Docker CouchDB3.5.2.1 riêng, loopback/cổng ngẫu nhiên; source `br005_source_*`, target `recruithub_restore_test_*`; fixture tổng hợp, không production snapshot/PII.
- Hai ADMIN, RECRUITER, CANDIDATE hợp schema với password Argon2; login/me/JWT thật. Không injected authenticate, token giả hoặc fixture login endpoint trong luồng nghiệm thu chính.
- Child process app riêng, Auth/domain cùng source test, secrets random ngoài source/không log; tránh singleton auth dùng nhầm config giữa các ca.
- Private spool riêng, giữ cùng spool khi restart. Nếu dùng TEMP/TMP thì chỉ env child, không thay terminal/process dự án.
- Audit source nếu kiểm tra dùng fixture/config riêng, không bật worker/pruner/producer hoặc mở rộng UC26.

#### Ma trận kiểm chứng

1. Roundtrip đủ9 business types/arbitrary fields/design view/JSON Mango index/binary attachment Unicode và zero byte; empty DB/zero attachments. So ID set/canonical content/attachment hash/index definition, source seq, target private, không cutover. Đo time/size, không cam kết SLA chưa đo.
2. Cả7 endpoints: guest401; Candidate/Recruiter403; owner Admin thành công; Admin khác404 với ID không sở hữu; token expired/locked/changed canonical role bị chặn request kế tiếp. Chỉ sửa account fixture DB test, không thêm API đổi role.
3. Tamper signature/footer/payload, wrong key/version/counts, truncated gzip, duplicate ID, bad base64/metadata/index phải fail trước tạo target. Existing/protected/racing target không bị ghi; không tải partial backup.
4. Concurrent backup/upload/restore, double-submit, one-time validation; faults source changed/outage/bulk partial/ambiguous/deadline qua test adapter/proxy/seams sẵn có. Không debug endpoint production, không sửa nguồn thật để tạo lỗi.
5. Dừng PID backend do runner tạo ở phase xác định; restart cùng spool: JOB_INTERRUPTED, RESERVED→CONSUMED, target vẫn private, không resume/delete/overwrite. Không kill hàng loạt Node.
6. TTL/quota/ACL/path qua controlled clock/limits/disk fixtures; assert riêng defaults production TTL24h/deadline10 phút/128–512MiB. Không chờ24h, làm đầy disk thật hoặc sửa defaults để test; ghi rõ limits rút ngắn chỉ cho test.
7. Quy mô synthetic tới25.750 business docs ở DB test; design docs đếm riêng; streaming bounded, đo RAM/time/size. Không dùng export production để làm fixture.
8. Browser production build/real Auth/API/CouchDB: bốn states, upload/validation/confirm/restore, expiry/partial/reload/account isolation/keyboard;375×812,768×1024,1440×900; ảnh không chứa token/credentials/PII thật.

#### Gate deployment

- Preflight chỉ đọc config/health/source availability/Couch permissions/default security/OS account/spool/disk; login/me khi có account hợp lệ được phép dùng. Không tạo/khóa user dự án để test.
- Hai blocker hiện tại: Auth/domain lệch DB, thiếu signing key/ID. Không tự sửa .env, bật AUTH_ALLOW_PRIMARY_DATABASE hoặc đổi nguồn để làm login chạy.
- Phần cô lập thực hiện sau duyệt; deployment để NOT VERIFIED/NOT READY cho đến khi môi trường/cấu hình được chốt. Nếu cần thay config thật, trình phương án/tác động identity-business/cấp key-escrow/rollback và duyệt riêng trước áp dụng.
- Không đóng toàn ADMIN-BR chỉ từ isolated pass. Không tự export PII thật để thay cho authenticated acceptance.

#### Files dự kiến

**Mới:**

- backend/tests/helpers/admin-backup-operational-fixtures.js — Couch/seed/env/process/inventory.
- backend/tests/helpers/admin-backup-operational-server.mjs — real app test entry và test limits/clock rõ khi cần.
- backend/tests/recruitment/admin-backup-operational.integration.test.js — Auth/RBAC/owner/roundtrip/data.
- backend/tests/recruitment/admin-backup-recovery.integration.test.js — process/lifecycle/fault.
- frontend/tests/browser/admin-backup-restore-authenticated.mjs — production build/login thật.
- docs/admin-backup-restore-runbook.md — setup/preflight/thao tác/sự cố/escrow/retention/cutover boundaries.
- docs/reports/admin-backup-restore/BR-005-result.md và BR-005-evidence/ — sanitized logs/ảnh/closure matrix.

**Sửa:** AGENTS.local.md; test helper hiện có chỉ mở rộng khi cần và giữ ca cũ. Bug production phát hiện: ghi test tái hiện, khoanh file và báo điều chỉnh Mini Plan trước sửa; không sửa core Auth/User/Job/Application hoặc baseline failures ngoài scope.

Không sửa AGENTS.md, frontend guide, template, skills, dependencies, data/processed hoặc .env; không stage/commit/push/chuyển branch. Không tự dọn container cũ/xóa DB dự án. Test resources mới ghi inventory/stop/giữ review, cleanup destructive tách riêng. Backup thật không vào Git/evidence.

### 3. Các bước thực hiện

| Mini task | Dự kiến | Việc thực hiện | Đầu ra |
|---|---|---|---|
| BR-005A Preflight/baseline |30–60 phút| Hash/config/ACL/disk/resources/baseline | Sanitized preflight/gates |
| BR-005B Real Auth harness |60–90 phút| DB/accounts Argon2/env/process/spool | Login3 role/hai Admin/JWT/me thật |
| BR-005C Data/security |60–90 phút| Roundtrip/rights/owner/tamper/target/synthetic scale | Exact hash/private/source assertions |
| BR-005D Recovery/lifecycle |60–90 phút| Crash/restart/busy/validation/TTL/limits/fault | Interrupted/partial đúng, không resume/delete |
| BR-005E Browser |60–90 phút| Real Auth/UI/reload/expiry/error/dialog/3 viewports | RESULT/ảnh |
| BR-005F Runbook/closure |45–90 phút| Regression/baseline/runbook/resources/deployment gate | Report/closure matrix |

A→B→C/D→E→F. Nếu C/D vượt90 phút tách tiếp data/security và process/recovery thành mini task riêng, không bỏ test vector.

**Kiểm thử:**40 focused cũ + suites mới opt-in BR005_DOCKER_INTEGRATION=1; full backend npm test trên bản sao backend/scripts/data cô lập vì pipeline có thể ghi snapshot; Auth foundation chạy riêng ngoài glob npm test. Frontend focused/npm test/Node riêng nếu short-circuit/lint/build. Authenticated browser runner với Playwright/Edge có sẵn. Git diff check/protected hashes/counts-seq-ACL/resources trước-sau. Baseline/final cùng điều kiện, so tên FAIL; không cài dependency.

### 4. Acceptance Criteria

| AC | Điều kiện đạt | Bằng chứng | Trước triển khai |
|---|---|---|---|
|005-AC01|Preflight/config/ACL/disk rõ, không lộ secret|Sanitized preflight/hashes|NOT VERIFIED|
|005-AC02|Auth/JWT thật, role/owner/locked/expired đúng|HTTP matrix7 endpoints|NOT VERIFIED|
|005-AC03|Exact roundtrip/source unchanged/private target|ID/content/hash/index/seq/401|NOT VERIFIED|
|005-AC04|Tamper/invalid/existing/protected/race không ghi trái phép|Failure injection/before-after|NOT VERIFIED|
|005-AC05|Busy/one-time validation/restart đúng|Concurrent HTTP/process restart|NOT VERIFIED|
|005-AC06|TTL/timeout/quota/ACL/path fail closed|Clock/limits/path/ACL fixtures|NOT VERIFIED|
|005-AC07|Browser Auth thật/states/reload/responsive/keyboard|Edge3 viewports/ảnh|NOT VERIFIED|
|005-AC08|Test liên quan/lint/build đạt, baseline diff rõ|Logs/failure-name comparison|NOT VERIFIED|
|005-AC09|Runbook/resources/protected data/report đủ|Inventory/hash/report/ledger|NOT VERIFIED|
|005-AC10|Môi trường vận hành được chốt/nghiệm thu login-key-ACL-roundtrip|Authenticated operational checklist|NOT VERIFIED — config chưa sẵn sàng|

**Bước tiếp theo:** Duyệt A–F rồi triển khai A/B và phần cô lập không phụ thuộc deployment. AC10 chưa đủ điều kiện thì báo gate cụ thể, không tự đổi config hoặc đóng toàn ADMIN-BR.

## Phần B — Task Result của lượt lập kế hoạch

**Status: REVIEW READY — kế hoạch chờ duyệt; chưa triển khai BR-005.**

### Implemented

Ghi BR-004 ACCEPTED; rà contract/app/auth/config/tests/report; probe loader thật trong process riêng; chia A–F/tách gate deployment.

### Files Changed

Mới: BR-005-plan.md. Sửa: AGENTS.local.md. 0 source files frontend/backend thay đổi, không .env/DB. Nhánh giữ nguyên, không stage/commit/push.

### Tests Executed

|Kiểm chứng|Kết quả|
|---|---|
|Git/branch|codex/admin-backup-restore, bảo toàn BR-001–004|
|Contract/app/auth/tests|Default Auth/JWT thật; BR-004 browser fixture login|
|Config probe|DATABASE_CONFIGURATION_MISMATCH; BACKUP_CONFIGURATION_ERROR; key/ID/audit absent|
|git diff --check|PASS|
|Suites backend/frontend/browser BR-005|NOT RUN — chưa duyệt triển khai|

### Research Fidelity

- Source-confirmed: mismatch/thiếu key từ loader; app có real Auth/JWT; lifecycle tests đã có; browser BR-004 fixture login.
- Implementation inference: process/CouchDB/spool riêng, proxy/clock/limits kiểm soát; chờ duyệt.
- Unresolved: môi trường/config AC10 và key escrow, không bỏ guard để hết blocker.

### Acceptance Criteria

005-AC01–10 NOT VERIFIED trong planning. BR-004 ACCEPTED; toàn ADMIN-BR chưa đóng.

### Risks / Deviations

Deployment gate chưa đủ điều kiện; isolated tests làm được sau duyệt. Baseline full suites có lỗi cũ phải đo/so lại. Không tạo tài nguyên test mới trong lượt planning.

### Recommended Next Task

BR-005A Preflight/baseline → BR-005B Real Auth harness sau duyệt kế hoạch này.
