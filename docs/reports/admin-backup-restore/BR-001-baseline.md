# BR-001 — Hợp đồng backup/restore và baseline

Ngày thực hiện: 12/11/2026, Asia/Bangkok. Nhánh: codex/admin-backup-restore. Không sửa production code hoặc cấu hình môi trường.

## Phần A — Mini Plan đã duyệt

**Task:** BR-001 — Chốt hợp đồng backup/restore và baseline.
**Status trước thực hiện:** PLAN READY; người dùng đã yêu cầu thực hiện trong chat.
**Kết quả cần bàn giao:** kiểm kê nguồn/phụ thuộc, contract, baseline có tên lỗi, chẩn đoán login Admin, cập nhật ledger và đầu vào BR-002.

### 1. Hiện trạng và khoảng trống

| Hạng mục | Đã xác minh | Còn thiếu trước task | Bằng chứng |
|---|---|---|---|
| RBAC | Admin guard hiện có | Hợp đồng reuse | backend/src/routes/admin-user.routes.js:49–50 |
| Điều hướng | Ba tab Admin | Tab mới ở BR-004 | frontend/src/pages/Dashboard/AdminDashboard.jsx:523 |
| Nguồn | Business/identity cấu hình riêng | Runtime inventory | backend/src/config/auth-database.config.js:7 |
| Attachment | AssetRepository dùng auth config | Runtime count/phạm vi | backend/src/repositories/asset.repository.js:20 |
| Audit | Yêu cầu DB riêng | Cấu hình runtime | backend/src/config/audit-database.config.js:3 |
| Login | Trước đó trả 500 | Nguyên nhân | backend/src/routes/auth.routes.js:26–40 |

### 2. Phạm vi và quyết định thiết kế

Chỉ đọc dữ liệu, chạy baseline đã cô lập, viết hợp đồng và ledger. Không API/UI mới, không sửa auth/config, không tạo database. Quyết định người dùng duyệt: Admin-only, tab mới, restore đích mới, bảo vệ recruitment_db. Quyết định kỹ thuật cụ thể trong docs/admin-backup-restore-contract.md; đây là hợp đồng triển khai, chưa phải implementation evidence. Không thay đổi UC26 đã đóng.

### 3. Các bước thực hiện

| Bước | Việc thực hiện | Điểm tích hợp | Kết quả |
|---|---|---|---|
| 1 | Git/hướng dẫn | AGENTS.md, AGENTS.local.md | Đúng nhánh, clean trước thay đổi |
| 2 | Inventory chỉ đọc | Config/repositories/CouchDB GET | Hai DB đọc được, audit chưa cấu hình |
| 3 | Truy vết phụ thuộc | Asset/Auth/Upload/Audit | Asset theo identity; không snapshot đa DB |
| 4 | Chẩn đoán login | HTTP login + service probe | Mismatch config gây generic 500; demo Admin login được khi config khớp trong bộ nhớ |
| 5 | Baseline | Bản sao backend/scripts/data/frontend | Tổng hợp và danh sách lỗi bên dưới |
| 6 | Soạn contract | docs/admin-backup-restore-contract.md | Format/API/limits/security/jobs/restore/tests |
| 7 | Review và ledger | Tài liệu + AGENTS.local.md | Trạng thái REVIEW READY, BR-002 có thể triển khai bằng fixture |

### 4. Acceptance Criteria

AC BR001-AC01 đến AC08 được đánh giá riêng trong Phần B. Không coi các AC triển khai ADMIN-BR là đạt trong task rà soát này.

## Phần B — Task Result

**Task Result**
**Status:** REVIEW READY — hợp đồng và baseline hoàn tất, chờ nghiệm thu BR-001. Không TECHNICAL PASS cho backup/restore vì chưa triển khai.

### Implemented

Kiểm kê bằng GET metadata, phân trang _all_docs?include_docs=true (500 records/trang), _security, _index và _session. Không in nội dung hồ sơ, credentials hoặc token. Raw documents chỉ xử lý trong bộ nhớ để đếm type/attachment, không lưu dump.

| Nguồn | Runtime | Docs thường | Design docs | Attachments | Trạng thái tích hợp |
|---|---|---:|---:|---:|---|
| recruitment_db | GET 200, doc_count=25.761 | 25.750 | 11 | 0 | Business hợp lệ |
| recruithub_auth_demo | GET trực tiếp 200, doc_count=23 | 12 | 11 | 0 | getAuthDatabaseConfig từ chối do mismatch |
| Audit | AUDIT_COUCHDB_DATABASE/URL/user/password chưa cấu hình | Không xác minh | Không xác minh | Không xác minh | INVALID_AUDIT_DATABASE |

Business: user 10.150; candidate 10.000; company 50; department 150; recruiter 150; job 2.500; application 1.200; interview 350; resume_analysis 1.200. Demo: user 4; candidate 2; company/department/recruiter/job/application/resume_analysis mỗi loại 1. Không có interview trong demo tại thời điểm quét.

Business _index: 10 JSON indexes và 1 special _all_docs; 11 design docs không được đồng nhất với 10 index definitions. Dung lượng metadata business external=30.677.869 bytes, active=28.018.216 bytes, file=28.635.564 bytes; đây không phải dung lượng backup đã xuất.

CouchDB _session trả role _admin cho kết nối business: có căn cứ quyền server-admin cần thiết để tạo đích. Chưa thử PUT tạo database vì BR-001 chỉ đọc; quyền ghi thực tế vẫn phải integration test BR-003. Hai DB hiện có _security admins.roles/members.roles=['_admin'], không có tên user riêng. App role ADMIN là JWT role, khác CouchDB reserved role _admin.

#### Chẩn đoán login và giới hạn

- Health API 200; POST /api/v1/auth/login với Admin local trả 500 INTERNAL_SERVER_ERROR.
- Cấu hình primary=recruitment_db, auth=recruithub_auth_demo. getAuthDatabaseConfig ném DATABASE_CONFIGURATION_MISMATCH trước khởi tạo AuthService (config dòng 15–19).
- sendAuthError chưa map code này nên rơi vào generic 500 (routes/auth.routes.js:26–40). JWT secret có mặt và đạt tối thiểu độ dài, không ghi giá trị.
- Probe độc lập chỉ thay COUCHDB_DATABASE trong đối tượng environment trong bộ nhớ thành auth DB, khởi tạo cùng repositories/AuthService, gọi login: authenticated=true, role=ADMIN. Không ghi file, không persist token, login service không update document (auth.service.js:271–304).
- Kết luận: lỗi cấu hình được xác nhận; không phải bằng chứng mật khẩu Admin sai. Chưa sửa .env hay restart service. Cần chọn hướng triển khai môi trường: cùng một database cho identity/domain; không tùy tiện trỏ cả hệ thống sang demo rồi mất catalog production, cũng không tự chuyển tài khoản demo sang production.

#### Đầu ra hợp đồng

Contract chốt gzip NDJSON v1 bằng built-in Node, HMAC dedicated key ngoài file, strict streaming limits, source allowlist, API jobs, actor ownership, TTL/quota, private target, per-row bulk handling và content/attachment/index verification. Backup đơn nguồn; không archive toàn máy chủ/cutover/multi-DB snapshot. Upload từ deployment khác chỉ được nhận nếu có signing key phù hợp; checksum riêng không chứng minh authenticity. Provisioning key và quyền thư mục spool là điều kiện rollout, không tự sửa .env trong task này.

### Files Changed

- Mới: docs/admin-backup-restore-contract.md.
- Mới: docs/reports/admin-backup-restore/BR-001-baseline.md (tài liệu này, gồm appendix tên lỗi/hash log).
- Sửa: AGENTS.local.md, thêm ledger ADMIN-BR, giữ nguyên UC26 closed.
- Nhánh codex/admin-backup-restore; không stage, commit hoặc push.

### Tests Executed

| Lệnh hoặc kiểm chứng | Kết quả thực tế | Bằng chứng |
|---|---|---|
| git status --short, branch | Clean lúc bắt đầu; đúng nhánh | Output phiên BR-001 |
| git diff --check | PASS | Không có whitespace errors trong tracked diff; file mới kiểm tra bổ sung bằng quét whitespace |
| Backend npm test tương đương node --test tests/data/*.test.js tests/foundation/*.test.js tests/recruitment/*.test.js trên bản sao | 621 tests: 592 PASS, 26 FAIL, 3 SKIP | backend-test-corrected.log, tên lỗi ở appendix |
| node --test tests/auth-foundation/*.test.js | 56 tests: 46 PASS, 10 FAIL | auth-test.log |
| Frontend npm test | Vitest 232: 221 PASS, 11 FAIL; 5 file fail/22 file pass | frontend-test.log; chuỗi && không chạy Node suite |
| Frontend node --test tests/auth/auth-helper.test.js tests/public-jobs/public-jobs.test.js chạy riêng | 7/7 PASS | frontend-node-test.log |
| Frontend npm run lint | 0 errors, 2 warnings có sẵn | App.jsx React unused; vite.config.js process unused |
| Frontend npm run build | PASS, warning chunk >500 kB | frontend-build.log |
| Runtime đọc DB và health | PASS; login lỗi được chẩn đoán | Inventory và phần login phía trên |
| Backup/restore integration/browser | NOT RUN | Chưa có implementation, không tạo DB ở BR-001 |

Full backend fail names sau normalize khớp chính xác log lượt trước tại TEMP/recrui-test.log. Không gắn nhãn mọi lỗi là ETL: còn queryView expected rejection và public catalog protected-write routing. Auth/frontend là baseline mới đo trong task; không có dữ liệu tên lỗi cũ đủ để kết luận thời điểm chúng xuất hiện. Không sửa production code nên không có thay đổi implementation BR-001 gây các lỗi này.

### Cách cô lập và lần chạy hiệu chỉnh

Rà soát phát hiện recruitment-generator.test.js:345–346 gọi publication với manifests/releases mặc định, etl-negative cũng có publication; không chạy full suite trên snapshot gốc. Copy backend/scripts/data sang thư mục TEMP UUID, bỏ .env/node_modules; junction node_modules về dependencies gốc, không chạy install. Bổ sung bản sao frontend vì profile-validation test import frontend helper. Bản sao không copy secrets ra disk; lần backend hiệu chỉnh kế thừa env bằng loadBackendEnvironment trong parent process rồi spawn node --test. Live integration flags không bật (3 skip); không tạo test CouchDB.

Lần đầu sandbox thiếu frontend helper và credentials nên 618 tests: 586 PASS/29 FAIL/3 SKIP; không dùng làm baseline chính. Sau bổ sung frontend và env trong bộ nhớ: 621/592/26/3. Hai lỗi 401 và lỗi module của harness được loại trừ bằng lần chạy hiệu chỉnh, không sửa source. Auth baseline 46/10 không phụ thuộc bản frontend thiếu.

Frontend test/lint/build chạy trên workspace thật; chỉ sinh dist/cache ignored. Backend đọc CouchDB ở import tests; checksum nguồn sai khiến import preflight dừng, không đi tới ghi. Một số negative tests chỉ tạo/xóa scratch trong bản sao. Metadata doc_count và opaque update_seq hai DB sau kiểm tra khớp lúc trước quét; không có production write trong BR-001. Không sửa/xóa data/processed hoặc template trong workspace gốc.

Raw logs và bản sao tạm được giữ tại đường dẫn appendix để tái kiểm chứng; chưa dọn, không đưa data dump/secrets vào Git. Log hashes chỉ để nhận diện artifact, không phải chứng nhận test PASS.

### Research Fidelity

- **Source-confirmed:** Admin guard/tab có thật; identity/domain phải cùng DB; assets theo auth; audit tách riêng; service login read-only; DB counts và server-admin role qua GET.
- **Implementation inference:** RHBR format, HMAC, spool, job lifecycle và limits là lựa chọn thiết kế mới; cần test trong BR-002/003.
- **Unresolved:** Cấu hình môi trường thống nhất identity/domain do người dùng/owner TV1 quyết định trước live acceptance; dedicated signing key và private spool provisioning trước bật tính năng; audit integration riêng nếu muốn mở rộng UC26. Không có dependency mới.
- Official docs tham chiếu trong contract: bulk API non-atomic, security role, attachment/index behavior. Giới hạn tài nguyên không phải yêu cầu CouchDB.

### Acceptance Criteria

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| BR001-AC01 | PASS | Inventory runtime, counts, auth/audit unavailable và phụ thuộc assets |
| BR001-AC02 | PASS | Contract §1–2: scope, format, exclusions |
| BR001-AC03 | PASS | Contract §3–4: endpoints, DTO, limits, errors, lifecycle |
| BR001-AC04 | PASS | Contract §5: private new target, validation, bulk verification |
| BR001-AC05 | PASS | Baseline hiệu chỉnh, log hashes và tên lỗi appendix |
| BR001-AC06 | PASS | HTTP 500 + config throw + in-memory successful Admin login |
| BR001-AC07 | PASS | Contract §6–7, BR-002 đầu vào rõ |
| BR001-AC08 | PASS | Chỉ docs/ledger; copy cô lập; counts/update_seq DB không đổi |

AC của BR-001 là AC rà soát/tài liệu. Toàn ADMIN-BR chưa có implementation, mọi AC tính năng vẫn NOT VERIFIED; chưa ACCEPTED thay người dùng.

### Risks / Deviations

- Baseline backend không xanh; auth và frontend cũng còn fail. BR-002 phải so tên lỗi, không chỉ tổng số.
- Khôi phục attachment phải test bằng fixture vì live data hiện không có attachment.
- Quyền create DB mới suy từ server-admin, chưa thử ghi. Không chuyển configuration/source hoặc sửa login ở BR-001.
- Thêm signing-key prerequisite so với ý tưởng ban đầu để không thực thi design docs từ gói chỉ có checksum tự khai; v1 không nhận arbitrary JSON.
- Database bị cập nhật liên tục sẽ fail SOURCE_CHANGED; cần cửa sổ ít ghi, không quảng cáo online snapshot đa DB.
- Private spool ACL cần được chứng minh trên Windows ở BR-002; chưa có filesystem permission implementation.

### Recommended Next Task

**BR-002 — Backup API và tác vụ xuất dữ liệu.** Bắt đầu bằng Zod contract, test doubles, job store/spool permission và source allowlist. Tạo admin-backup.routes/controller/service/schema và tests; mount router mới không sửa logic core Auth/AdminUser. Chưa triển khai restore/UI trong BR-002. Giữ live Admin acceptance phụ thuộc lựa chọn cấu hình identity/domain; không bypass guard. Cập nhật ledger sau task, đối chiếu baseline và dùng lại Phần A/B.

## Appendix — Artifact và tên lỗi

Phần dưới được trích tự động từ log thực tế, chỉ giữ tên ca; raw log nằm ngoài repo.

Artifacts root: C:\Users\HIENDANG\AppData\Local\Temp\recruithub-br001-dfd0a256714247b8b65e33a716201846

| Log | SHA-256 |
|---|---|
| backend-test-corrected.log | ce4624b4c486cb1b91c33b05c335b6baa25f11d93d50fd9aae8a5ed8e6607dc3 |
| auth-test.log | 17935cfaa21e16d72904f5feefa84e71480a9b90466cfa6644d862c724bfa2f4 |
| frontend-test.log | d9abb80edc13eaceeb92e17fdcaa8e7d059c920e06b59f7ac21add821cf91661 |
| frontend-node-test.log | 219cdd9a537fd330b4e8ff2ee22f4ef2f1f17859fcf092783d99aec04a3ab102 |
| frontend-lint.log | 0ba9b011a6585d146e9bb43b87e377ca6d38aafbe695979258ac62b31e82976d |
| frontend-build.log | 2481f7ffaebb21484b12a90e2eb73ae96bfa9d8cce43d300099abc8cc38fcabc |

### backend-test-corrected.log

- V04: Missing database rejected if --create-db is not set
- V15: Source release files remain 100% immutable and match checksums
- DATA-04B: CouchDB Import & Verification Acceptance Tests
- N-01: Wrong source hash triggers extraction abort with exit code 1
- N-02: Missing source file triggers extraction abort with exit code 1
- N-14: Version/config change creates distinct immutable release
- N-15: Existing active release remains readable and intact after all test runs
- DATA-02B.3: Real Failure Injection & Release Safety Tests
- 11, 12, 13. Published dataset record counts match contract
- 15. Deterministic rerun produces identical output checksums
- DATA-02B.2: ETL Pipeline Integration Tests
- 1 & 2. Record counts match contract (23,000 total: 10,000 Candidates, 2,500 Jobs, 10,150 Users, etc.)
- 3 & 6. Every Candidate references CANDIDATE User; every Recruiter references RECRUITER User
- 4 & 5. All Job references exist and mutual scoping is strictly valid
- 7 & 8. Zero duplicate _id across all 23,000 docs; zero duplicate emails across all 10,150 users
- 9, 10, 11. Zero orphan references, synthetic provenance conforms, no credentials
- 12, 13, 14, 15. Source facts preserved: Candidate/Job content unchanged, no Application created
- 16. Deterministic rerun produces identical output checksums
- Negative: Input manifest checksum mismatch triggers failure
- DATA-03.2: Foundation Acceptance & Verification Tests
- DATA-03.3B: Recruitment Acceptance & Verification Tests
- 6. 100% of Resume Analyses are fresh against final candidate and job state
- 7. Scoring input mutation invalidates freshness
- 9. Rule I: Real publication failure injection integration test
- 10. Release publication is idempotent: rerun returns UNCHANGED
- DATA-03.4B: Resume Analysis & Final Corpus Acceptance Tests
- queryView uses a read-only GET and supports MapReduce group/group_level parameters
- public catalog reads the primary database without Auth config and never routes protected writes there

### auth-test.log

- Admin status changes keep ETag preconditions and update eligible accounts with _rev
- UC24 permits only ACTIVE to LOCKED and LOCKED to ACTIVE, with no automatic retry
- UC24 rejects missing targets and never retries a write conflict
- Recruiter registration endpoint stays disabled by default and validates a strict DTO when enabled
- registration validates and writes Company, Department, Recruiter, then ACTIVE User
- duplicate email and normalized Company are rejected without attaching to existing Company
- concurrent registrations for the same normalized Company never attach a second User
- partial write stops immediately, returns operator reference, and does not retry or compensate
- Recruiter login and existing tokens require a complete valid organization scope
- Recruiter login and existing tokens reject missing Company and mismatched Department ownership

### frontend-test.log

- × submits skill and industry drafts together, then keeps them when selecting a location
- × loads the user list and details without mutating status until confirmation
- × shows only eligible actions, asks for confirmation, and cancel does not PATCH
- × sends the current ETag after confirmation and updates the row on success
- × offers the eligible action in user details and keeps the updated status in the detail view
- × reports revision conflicts without retrying and offers a refresh
- × shows API failures and leaves account status unchanged
- × disables the status action while a mutation is pending
- × exports only after the recruiter selects the export view and submits filters
- × home autocomplete supports keyboard selection, escape and transfers canonical skill and location
- × keeps the dev detail layout and restores CV access, reapply revision and archived attempt history
