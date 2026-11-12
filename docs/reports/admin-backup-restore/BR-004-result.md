# BR-004 — Giao diện Admin: Sao lưu & khôi phục

Ngày 12/11/2026 · Nhánh `codex/admin-backup-restore` · HEAD `de65be49f7363317130a2f501094099deb6ac9ac`.

## Phần A — Mini Plan trước khi thực hiện

**Task:** BR-004 — Giao diện Admin.

**Status trước triển khai:** PLAN READY — người dùng đã chốt BR-003, duyệt kế hoạch BR-004 và yêu cầu thực hiện A–E trong chat.

**Kết quả cần bàn giao:** tab thứ tư tại `/admin/dashboard`, kết nối API BR-002/003, có thể tạo/tải backup, tải file kiểm tra, xem trước và xác nhận khôi phục vào database mới; theo dõi trạng thái rõ ràng và kiểm thử responsive.

### 1. Hiện trạng và khoảng trống

| Hạng mục | Đã xác minh trước task | Còn thiếu | Bằng chứng |
|---|---|---|---|
| Admin | Route ADMIN và ba tab overview/audit/system log | Tab backup/restore | `frontend/src/pages/Dashboard/AdminDashboard.jsx`, `frontend/src/routes/AppRoutes.jsx` |
| Backup | Sources/create/status/download, owner/RBAC | Axios và UI | BR-002-result.md, `backend/src/routes/admin-backup.routes.js` |
| Restore | Binary upload, signed validation, private fresh target, readback | Upload/preview/dialog/status UI | BR-003-result.md, `backend/src/services/admin-restore.service.js` |
| UI | Font, card, buttons, inputs và Tailwind hiện hành | Ghép luồng mới theo template | frontend guide, template AdminDashboard/index.css |
| Theo dõi | API GET theo ID, không có list jobs | Danh sách các tác vụ đã biết của phiên | `admin-backup.controller.js`, `admin-restore.controller.js` |
| Vận hành | Baseline ghi nhận identity/domain mismatch, key chưa provision | Nghiệm thu cấu hình dự án thật | BR-001/002/003 reports |

### 2. Phạm vi và quyết định thiết kế

- Áp dụng `recruithub-ui-design` và `recruithub-ui-audit`, tuân thủ AGENTS.md và frontend guide. Mapping template → production: card trắng/viền slate/rounded-2xl, Plus Jakarta Sans/Inter, `.btn-primary`, `.btn-secondary`, `.input-field`; không nhập auth/API/mock của template. Không có xung đột guideline cần đổi chuẩn chung.
- Tái sử dụng `/admin/dashboard` và guard ADMIN. Thêm tab `Sao lưu & khôi phục`; không thêm navbar hoặc route mới. Bảo toàn nghiệp vụ quản trị User và hai log viewer.
- Hai card desktop và xếp dọc trên tablet/mobile. Có cảnh báo dữ liệu nhạy cảm, giới hạn single database/current state, cấu hình sử dụng đích là thao tác vận hành riêng.
- Axios dùng client tập trung hiện tại, base `/api` + đường dẫn `/v1/admin/...`. Upload raw File `application/octet-stream`; chỉ upload/download có timeout riêng 660 giây. POST không tự retry. Lỗi Blob JSON được đọc và ánh xạ thông báo an toàn.
- Poll tuần tự 2 giây, backoff đến tối đa 10 giây, không chồng request, dừng khi terminal/không có việc/mất quyền/unmount. Abort request client không hủy tác vụ server.
- sessionStorage chỉ lưu ID/type và tab theo canonical User ID. Token vẫn ở bộ nhớ theo auth hiện hành; reload yêu cầu đăng nhập lại. Không lưu file hoặc nội dung backup vào storage. Đây là các tác vụ đã mở trong phiên, không phải lịch sử toàn máy chủ.
- UI kiểm tra kích thước theo limits API; backend quyết định định dạng, HMAC, TTL và quyền. Upload % tách với validation progress. Đổi file bỏ validation cũ khỏi form. Tên đích theo regex hợp đồng, preview và dialog xác nhận trước POST `confirm:true`.
- Hiển thị riêng thành công đã đối chiếu, file hết hạn, validation dùng một lần và đích có thể ghi dở. Không có nút ghi đè, xóa, resume hoặc cutover.
- Native modal có vòng focus Tab/Shift+Tab rõ ràng, Escape, trả focus về nút mở; tab Admin hỗ trợ ArrowLeft/ArrowRight/Home/End.

### 3. Các bước thực hiện được duyệt

| Bước | Việc thực hiện | Điểm tích hợp | Kết quả |
|---|---|---|---|
| A | API adapter, định dạng và thông báo | adminBackupApi, backupRestorePresentation | Binary/progress/abort/error/filename-safe download |
| B | Theo dõi jobs | useBackupRestoreJobs | Poll/backoff/dedupe/storage theo tài khoản |
| C | Backup card và status | AdminBackupRestore, BackupJobStatus | Sources/loading/empty/error/create/download |
| D | Upload, preview, target và dialog | RestoreBackupForm, RestoreConfirmDialog | Validation → confirm → restore → verification/partial |
| E | Tab và nghiệm thu | AdminDashboard, tests, report, AGENTS.local | Tests, Edge, screenshots và hồ sơ bàn giao |

Không sửa backend, `.env`, core auth, global CSS, template, skills, AGENTS.md, frontend guide hoặc historical data. Không cài dependency/plugin/MCP. Không stage/commit/push/chuyển branch.

### 4. Acceptance Criteria trước thực hiện

AC01–09 ở trạng thái NOT VERIFIED: tab và navigation; backup; upload/validation; target/confirmation; kết quả/TTL; polling/storage/account; responsive/accessibility/states; test regression/lint/build; report/ledger. Kế hoạch được người dùng duyệt trước khi code.

## Phần B — Task Result sau khi thực hiện

**Task Result — Status: TECHNICAL PASS — chờ nghiệm thu BR-004.**

### Implemented

- Hoàn tất A–E như trên; backend BR-002/003 được sử dụng qua Axios, frontend không gọi CouchDB trực tiếp.
- Feature đã được kiểm tra bằng production build trên Edge headless, API/service thật và CouchDB 3.5.2.1 cô lập. Browser runner dùng **fixture đăng nhập riêng**, không phải nghiệm thu auth/config deployment thật.
- Roundtrip thực: nguồn synthetic có 9 loại nghiệp vụ + uploaded asset + view + Mango design (12 docs), gzip signed export → download → binary upload → strict validation → tạo private target → write/readback. Attachment, indexes và số tài liệu được đối chiếu. Nguồn giữ nguyên update sequence; anonymous target trả 401.
- Trong lần kiểm tra đầu, focus native dialog chưa khép vòng ở biên; đã thêm handler Tab/Shift+Tab và xác minh lại bằng Edge thật. Không còn lỗi này trong final run.

### Files Changed

**7 file source mới:**

| File | Mục đích |
|---|---|
| `frontend/src/api/adminBackupApi.js` | API, upload/download, lỗi Blob, lưu file |
| `frontend/src/features/admin/backupRestorePresentation.js` | Trạng thái/giờ Việt Nam/giới hạn/tên đích/tracking |
| `frontend/src/features/admin/useBackupRestoreJobs.js` | Poll/lifecycle/dedupe/storage |
| `frontend/src/features/admin/AdminBackupRestore.jsx` | Workspace và backup sources/create/download |
| `frontend/src/features/admin/components/BackupJobStatus.jsx` | Trạng thái và kết quả backup/restore |
| `frontend/src/features/admin/components/RestoreBackupForm.jsx` | Chọn file, validation preview, target |
| `frontend/src/features/admin/components/RestoreConfirmDialog.jsx` | Xác nhận và keyboard focus |

**4 file kiểm thử mới:** `frontend/tests/admin-backup-api.test.jsx`, `admin-backup-jobs.test.jsx`, `admin-backup-ui.test.jsx`, `frontend/tests/browser/admin-backup-restore.mjs`.

**2 file sửa:** `frontend/src/pages/Dashboard/AdminDashboard.jsx` (thêm tab, lưu tab theo User ID và keyboard navigation), `AGENTS.local.md` (BR-003 ACCEPTED, BR-004 technical result).

**Tài liệu/bằng chứng mới:** báo cáo này và `BR-004-evidence/` gồm 9 ảnh PNG, `RESULT.json`, `verification.json`. Các thay đổi BR-001/002/003/skills có sẵn trong working tree vẫn giữ nguyên; không tính là thay đổi của BR-004. Chưa stage, commit hoặc push; nhánh giữ nguyên.

### Tests Executed

| Lệnh/kiểm chứng | Kết quả thực tế | Bằng chứng |
|---|---|---|
| `npm test` frontend trước sửa | **221 PASS / 11 FAIL** | `%TEMP%/recruithub-br004-baseline.log` |
| `npx vitest run tests/admin-backup-api.test.jsx tests/admin-backup-jobs.test.jsx tests/admin-backup-ui.test.jsx tests/admin-log-viewer.test.jsx tests/admin-account-audit.test.jsx` | **26/26 PASS**, gồm **19 test mới** | `%TEMP%/recruithub-br004-focused.log` |
| `npm test` frontend sau sửa | **240 PASS / 11 FAIL**; không chạy tiếp Node do toán tử `&&` | `%TEMP%/recruithub-br004-final-tests.log` |
| Node auth-helper/public-jobs chạy riêng | **7/7 PASS** | `%TEMP%/recruithub-br004-node-tests.log` |
| `npm run lint` | **PASS**, 0 lỗi; 2 warning cũ App.jsx/vite.config.js | `%TEMP%/recruithub-br004-lint.log` |
| `npm run build` | **PASS**, còn warning chunk >500 kB | `%TEMP%/recruithub-br004-build.log` |
| 8 suite backend admin-backup/admin-restore qua `node --test` | **40/40 PASS** | `%TEMP%/recruithub-br004-backend.log` |
| `node tests/browser/admin-backup-restore.mjs` từ frontend | **24/24 checks PASS**, không uncaught page error | `BR-004-evidence/RESULT.json`, `%TEMP%/recruithub-br004-browser.log` |
| Git diff whitespace | **PASS** | `git diff --check` |
| Protected SHA256 | **22/22 giữ nguyên** so với snapshot BR-003 | `BR-004-evidence/verification.json` |
| Backend source so với bản final BR-003 | Không có thay đổi nội dung | So SHA256 với bản sao final BR-003 trong `%TEMP%` |

**Đối chiếu lỗi cũ:** 11 tên ca FAIL trước/sau trùng hoàn toàn. 7 ca thuộc `admin-user-list.test.jsx`; mỗi suite `catalog-lifecycle`, `job-import-export-modal`, `post-merge-jobs`, `public-jobs/job-list` có 1 ca. Danh sách tên đầy đủ nằm trong `verification.json`. Full frontend **chưa xanh**; không sửa các lỗi ngoài BR-004 để làm đẹp số liệu.

Backend full suite không chạy lại vì không thay đổi backend; dùng 40 ca trực tiếp liên quan và real CouchDB browser roundtrip. Kết quả full backend BR-003 vẫn là bằng chứng lịch sử, không gán thành kết quả chạy mới của BR-004.

**Test vectors chính:** payload/path/timeout/binary đúng hợp đồng; filename traversal fallback và ObjectURL cleanup; JSON Blob expiry; dedupe POST; poll không overlap và backoff; terminal/403/unmount; account switch và phản hồi cũ; storage unavailable; upload kích thước rỗng/quá lớn; upload percentage chưa phải validation success; validation expired/used; target regex; cancel/confirm; partial minimum count; download hết hạn; Admin tab lazy-load; route guard guest.

**Browser/visual QA:** Windows, Microsoft Edge headless qua Playwright 1.65.0 có sẵn, production Vite build. Test fixture tách biệt; không cài package. Ba viewport **375×812, 768×1024, 1440×900** kiểm tra cả Empty/Success và horizontal overflow. Loading, lỗi cấu hình thực 503 và dialog được kiểm tra/chụp ở mobile. Modal kiểm tra bounding box, focus loop, Escape/focus return. Reload yêu cầu login rồi phục hồi tab và tracking. Đã mở xem ảnh desktop/mobile; các card, nhãn, trạng thái và chuỗi tên DB dài hiển thị trong phạm vi màn hình. Hai log viewer/account có test regression; browser kiểm tra navigation sang audit. Không tuyên bố kiểm tra toàn portal/Candidate/Recruiter.

### Research Fidelity

- **Source-confirmed:** Backend có jobs theo ID, TTL và validation một lần; không có list lịch sử. Auth token memory-only, canonical User DTO `id`/`role`. Client tập trung giữ auth interceptor và 10 giây mặc định cho request bình thường.
- **Implementation inference trong plan đã duyệt:** Lưu ID/type theo user, tab Admin thứ tư, poll 2 giây/backoff, dialog và trạng thái partial. Đây là lựa chọn client; không thay hợp đồng nghiệp vụ hay máy chủ.
- **Unresolved:** Production login/configuration và signing-key provisioning là phụ thuộc vận hành đã ghi nhận BR-001–003. Không bypass guard hoặc ghi cấu hình thật trong task UI này. BR-005 cần kiểm tra lại chúng và xác định môi trường nghiệm thu được phép trước các thao tác thật.

### Acceptance Criteria

| AC | Kết quả BR-004 | Bằng chứng |
|---|---|---|
| AC01 Tab mới, bảo toàn navigation | **PASS** | 4 tab, lazy-load, tests Admin logs/account, browser audit |
| AC02 Sources → backup → status → download | **PASS** | API/UI tests, real signed gzip download trong browser |
| AC03 Upload, giới hạn, validation preview | **PASS** | 19 test mới, roundtrip chữ ký, docs/design/attachment preview |
| AC04 Target mới và xác nhận rõ ràng | **PASS** | Regex/cancel/confirm test; real private CouchDB target |
| AC05 Success/partial/expired/used rõ ràng | **PASS** | UI tests và kết quả readback 12 docs thực |
| AC06 Poll/recovery/owner session lifecycle | **PASS** | Fake-timer tests, abort/account-switch, browser reload/login/storage |
| AC07 Responsive, keyboard và 4 trạng thái | **PASS trong phạm vi đã kiểm tra** | 9 ảnh, 3 viewport, Loading/Empty/Error/Success, modal keys |
| AC08 Test/lint/build và đối chiếu baseline | **PASS theo baseline đã ghi nhận** | 26 focused, Node7, backend40, browser24; lint/build; full Vitest còn cùng 11 lỗi cũ |
| AC09 Report/ledger và không đổi phạm vi | **PASS** | Báo cáo, AGENTS.local, hashes và Git status |

**Trạng thái tổng ADMIN-BR:** BR-001/002/003 đã được người dùng chấp nhận; BR-004 TECHNICAL PASS chờ nghiệm thu. BR-005 và nghiệm thu cấu hình thật **chưa hoàn tất**, không đánh đồng với task UI này.

### Risks / Deviations

- Không nghiệm thu môi trường dự án thật bằng tài khoản Admin thật trong lượt này. Browser dùng test-only login adapter, giữ nguyên route guard và middleware RBAC thật của API; xác thực credentials/JWT trong deployment thuộc BR-005.
- Mất phản hồi POST có thể tạo tác vụ mà trình duyệt chưa nhận được ID. Không tự gửi lại; UI cảnh báo kiểm tra trước khi thao tác tiếp. API chưa có list endpoint để phục hồi trường hợp mất hoàn toàn ID.
- Single-process lock, RHBR v1 không hỗ trợ partitioned indexes, dedicated signing key/escrow, private spool và fresh target constraints giữ nguyên từ backend. UI chỉ giữ các jobs đã biết trong phiên; storage bị chặn vẫn dùng được trong bộ nhớ nhưng reload không phục hồi được.
- Sau lỗi restore, validation đã gửi được khóa ở form; kiểm tra file lại trước một tác vụ mới. Số ghi khi thất bại là **tối thiểu đã xác nhận**, không phải tổng chính xác của đích.
- Browser lần đầu phát hiện focus issue và đã được sửa/xác minh lại; thay đổi duy nhất bổ sung plan là handler focus rõ ràng cho modal và keyboard navigation tab trong cùng phạm vi a11y đã duyệt.
- Ba container test đã **dừng**, giữ để review: `recruithub-br004-test-1d68600b` (lần phát hiện focus issue), `recruithub-br004-test-654c0da0`, `recruithub-br004-test-f190fea1` (final). Không xóa database/container, không ghi vào recruitment_db dự án. Ba thư mục fixture synthetic `%TEMP%/rhbr-br004-browser-JmZcmS`, `...-XRwr7C`, `...-vMEtP5` được giữ. Server web/browser đã đóng; spool store đã close. Không chứa credentials/key trong source/report/screenshot; credentials random chỉ tồn tại trong môi trường test container/process.
- Raw logs ở `%TEMP%` và bằng chứng đã chọn trong repo. Runner hỗ trợ `BR004_PLAYWRIGHT_PATH` trỏ package có sẵn, yêu cầu Docker/image CouchDB và Edge; không tự cài dependency.

### Recommended Next Task

**BR-005 — Kiểm thử tích hợp và nghiệm thu vận hành backup/restore.** Bắt đầu bằng rà soát cấu hình identity/domain, signing key/key ID, quyền CouchDB/private spool và môi trường dữ liệu được phép. Sau đó lập Mini Plan cho authenticated acceptance, restart/expiry/concurrency, quyền ba role và handoff vận hành; chờ duyệt theo AGENTS.md. Không tự chuyển ứng dụng sang database restored.
