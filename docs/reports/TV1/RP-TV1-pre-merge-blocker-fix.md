# RecruiHub NoSQL — TV1 Pre-Merge Blocker Fix

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; báo cáo do Codex tổng hợp.
- **Mục tiêu:** đóng rủi ro khóa Admin đồng thời, sửa cấu hình CORS local, ghi nhận provenance và giữ UI/contract an toàn.
- **Trạng thái:** **PARTIAL** — các code blockers trong scope đã được sửa; CORS source/env đã kiểm chứng trên app mới, nhưng các backend process đang chạy vẫn dùng cấu hình cũ và cần restart có kiểm soát.

## 2. Phạm vi

Đã sửa Admin status policy ở service/UI, CORS origin/header policy, tests và tài liệu contract. Không đổi schema, business data, DB, source TV2/TV3 hoặc thiết kế UI. Không stage/commit/push/merge. Không chạy legacy data suite.

## 3. Fix đã thực hiện

### Admin status policy

- `AdminUserService.setAccountStatus()` từ chối mọi cập nhật status nhắm tới User có role `ADMIN`, bất kể yêu cầu lock hay unlock.
- Response: HTTP **403**, code ổn định `ADMIN_STATUS_CHANGE_FORBIDDEN`.
- Target role được xác định từ User document phía server; mọi ADMIN target luôn trả 403 ổn định (kể cả thiếu/stale `If-Match`). Candidate/Recruiter vẫn bắt buộc current revision: thiếu revision trả 428, revision stale trả 409.
- Loại bỏ check đếm Admin hoạt động rồi ghi một document khác. Do không còn Admin status mutation trong endpoint, race cross-document đó không thể xảy ra qua API này.
- Candidate/Recruiter status mutation vẫn hỗ trợ `ACTIVE`/`LOCKED`, yêu cầu revision hiện tại; `RESET_REQUIRED` vẫn không thể activate/chỉnh ở endpoint.
- Admin list/detail/statistics không đổi. Admin recovery/status change được ghi là operator-managed ngoài MVP.
- Admin Dashboard ẩn action thay status với Admin và hiển thị thông báo operator-managed; Candidate/Recruiter action giữ nguyên.

### CORS

- `backend/src/app.js` đọc `FRONTEND_URL` dạng danh sách comma-separated exact origins. Chỉ cho phép origin HTTP/HTTPS hợp lệ; từ chối wildcard và URL có path.
- CORS methods được khai báo rõ; request headers cho phép `Authorization`, `Content-Type`, `If-Match`; response expose `ETag` để React có thể đọc revision cho PATCH.
- `.env.example` có origin ổn định `http://localhost:5173`, không dùng random Vite port làm default.
- Root `.env` (ignored) được thêm `FRONTEND_URL` với các origin local đã quan sát: `localhost`/`127.0.0.1` tại ports 5173 và 5178. Không thay secrets hoặc CouchDB config; không ghi giá trị secrets vào log/report.
- App mới nạp root `.env` qua `loadBackendEnvironment()` và preflight PASS cho `127.0.0.1:5173` và `127.0.0.1:5178`, gồm PATCH, Authorization, If-Match và expose ETag; untrusted origin không nhận `Access-Control-Allow-Origin`.
- **Runtime limitation:** các process đang nghe ở 5002/5004 được xác minh vẫn trả origin cũ `http://localhost:5173` và không expose ETag. Không restart vì không xác minh được ownership/process control trong môi trường hiện tại. Restart backend RecruiHub đã được xác định và xác nhận owner trước khi browser E2E.

## 4. Candidate provenance và ID

- DATA-02A định nghĩa `SOURCE` là giá trị trực tiếp từ field Parquet đã audit, `DERIVED` là tính toán xác định từ input hợp lệ; `normalized` là chuẩn hóa xác định; `synthetic` là dữ liệu demo/generated có provenance. Candidate self-registration là user input, không phải audited Parquet `SOURCE`; `experience_months = years_experience * 12` là `DERIVED`; các mảng không được cung cấp và availability UNAVAILABLE/PARTIAL cần được giữ nguyên như hiện tại.
- Vì document gồm input, derived value và unavailable fields, mapping tổng thể có thể phù hợp với `mixed` và field origins riêng. Đây là đề xuất diễn giải, **PENDING nhóm/Data owner xác nhận**; không đổi schema, source provenance behavior hoặc documents trong task này.
- Read-only kiểm tra `recruithub_auth_demo` tìm thấy 2 Candidate documents dùng cùng ID strategy `candidate:<sha256(user_id)>`; một document có classification `mixed`, document còn lại `source`; field origins cho profile đều mô tả self-registration. Không đổi cả hai record.
- DATA-02A nêu ID source/import `candidate:cms:<resume_id>`; schema hiện chấp nhận thêm ID self-service `candidate:<64 hex>`. Shared contract đã ghi rõ ID self-service là convention triển khai TV1 và chờ acknowledgement; không tuyên bố đây là sửa đổi DATA-02A.

## 5. Files đã tạo/sửa

- **Sửa:** `backend/src/services/admin-user.service.js`.
- **Sửa:** `backend/src/app.js`.
- **Sửa:** `backend/tests/auth-foundation/admin-user.service.test.js`.
- **Sửa:** `backend/tests/auth-foundation/domain-routes.test.js`.
- **Tạo:** `backend/tests/auth-foundation/cors.test.js`.
- **Sửa:** `frontend/src/pages/Dashboard/AdminDashboard.jsx`.
- **Sửa:** `.env.example`, `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`, `docs/shared/TECHNICAL_DECISION_REGISTER.md`.
- **Sửa local ignored config:** root `.env` chỉ thêm `FRONTEND_URL`; giữ nguyên secrets và CouchDB settings.
- **Tạo:** báo cáo này.

Không sửa DATA-02A, schema Zod, JSONL/manifest, TV2/TV3 source, CouchDB, database hoặc index/view.

## 6. Test và verification

| Kiểm tra | Kết quả |
|---|---|
| Backend Auth/Foundation tests: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 52/52**; có test lock/unlock Admin, concurrent attempts, ETag preconditions, eligible Candidate updates và route error envelope |
| Frontend tests: `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4** |
| Frontend `npm.cmd run build` | **PASS** |
| Frontend `npm.cmd run lint` | **PASS**, 0 errors, 16 warnings (các cảnh báo cũ về unused imports/variables và hook dependency) |
| CORS preflight trên Express app source + root env | **PASS** cho 2 loopback UI origins; PATCH/Authorization/Content-Type/If-Match; ETag exposed; origin ngoài allowlist không được phép |
| CORS trên backend processes hiện đang chạy | **Chưa cập nhật**: 5002/5004 vẫn response theo app/config cũ. Không restart service vì không xác định được owner an toàn |
| CouchDB metadata read-only | **PASS**: `recruithub_auth_demo` 5 docs; `recruitment_db` 25,750 docs |
| Browser automation | **NOT VERIFIED**: không có browser/app surface |
| Legacy backend data/release suite | **NOT RUN**: dùng shared scratch/release paths |
| `git diff --check` | **PASS**; chỉ cảnh báo LF→CRLF |

Không có CouchDB write, DB count thay đổi, index/view hoặc migration.

## 7. Manual UI checklist

- [ ] Restart đúng backend RecruiHub với root env đã nạp; xác minh `FRONTEND_URL` runtime khớp origin đang mở.
- [ ] OPTIONS preflight từ đúng browser origin cho PATCH trả `Access-Control-Allow-Origin`, `Authorization`, `If-Match`; response profile/detail expose `ETag`.
- [ ] Admin list/detail/stats hoạt động; mở chi tiết Admin không có action lock/unlock và hiển thị operator-managed.
- [ ] Candidate/Recruiter có thể đổi status eligible với ETag hiện tại; stale ETag nhận 409.
- [ ] Candidate profile đọc ETag và PATCH thành công qua browser; stale revision hiển thị lỗi phù hợp.
- [ ] Test navigation/forms/logout và responsive 360px/tablet/desktop; không lưu token vào browser storage.

## 8. Pending decisions / blockers

1. DATA owner/nhóm xác nhận Candidate self-registration provenance classification/field-origin vocabulary; không sửa dữ liệu cũ trước quyết định.
2. Restart runtime RecruiHub đúng process để nạp `FRONTEND_URL`, rồi thực hiện browser E2E. Các process cũ trên 5002/5004 chưa được restart.
3. Browser visual/interaction checks chưa hoàn tất.
4. TV2 vẫn sở hữu Public Job/Apply API/DTO, OPEN-only policy, filters/pagination/error contract.
5. TV3 vẫn sở hữu Interview/Scoring/Audit API/storage/retention/redaction contracts.
6. Conflict retry policy khác nhau giữa `AGENTS.md` và DATA-02A; chưa có mutation retry tự động trong Foundation.

## 9. Git và nghiệm thu

- Branch: `feature/identity-candidate-portal`.
- Không có staged diff; không stage/commit/push/merge.
- Existing changes remain uncommitted; report và CORS test thêm untracked entries. Root `.env` ignored, không tracked.
- Admin lock concurrency risk được đóng bằng restricted policy ở backend service; Admin status/recovery hiện ngoài MVP và operator-managed.
- CORS source/config đã được test; live long-running processes yêu cầu restart có kiểm soát để nạp cấu hình mới.

**Trạng thái: PARTIAL.** Code-level Admin/CORS fixes, regression tests, frontend build/lint và read-only DB metadata đều đạt. Chưa PASS do runtime restart/browser UI chưa xác minh và Candidate provenance interpretation vẫn cần nhóm quyết định.

