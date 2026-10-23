# RecruiHub NoSQL — TV1 Stage 04B: Auth MVP & Existing Frontend Integration

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; báo cáo tổng hợp bởi Codex.
- **Trạng thái:** **PARTIAL**.
- **Authority:** người yêu cầu phê duyệt các lựa chọn provisional cho Stage 04B; chưa có bằng chứng TV2/TV3/group acknowledgement.

## 2. Mục tiêu

Triển khai Candidate registration/login, Argon2id, Bearer JWT, `/api/v1/auth/me`, authentication/RBAC cơ bản và tích hợp trên UI hiện có; không đổi database trong công việc/test và không tạo frontend thay thế.

## 3. Phạm vi và yêu cầu

- Giữ Login/Register, AuthContext, ProtectedRoute, Navbar, routes, UI/CSS và service layer hiện tại.
- Public registration chỉ tạo Candidate; role/status/IDs do server quản lý.
- Dùng deterministic User/Candidate IDs và DATA-02A Zod schemas.
- Không sửa hoặc kích hoạt User cũ `RESET_REQUIRED`.
- Token 15 phút lưu memory-only; logout xóa token phía client.
- Không ghi `recruitment_db` trong tests; không commit/push.

## 4. Công việc đã thực hiện

### Backend

- Thêm `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- Argon2id: memory 65,536 KiB, time cost 3, parallelism 1; hash không trả về response/log.
- JWT HS256: claims `sub`, `role`, `iss`, `aud`, `iat`, `exp`, `jti`; TTL 15 phút. Signing key từ `JWT_ACCESS_SECRET`, không hardcode; tối thiểu 32 bytes và placeholder bị từ chối.
- Middleware xác minh Bearer token, reload User, yêu cầu status ACTIVE; `requireRole()` dùng principal server-verified và canonical uppercase roles.
- Strict registration DTO thu thập `full_name`, `candidate_role`, `industry`, `seniority`, `years_experience`; request không thể chọn role/status/IDs.
- Tạo User ở `RESET_REQUIRED`, validate/tạo Candidate bằng deterministic ID, rồi activate User mới tạo bằng `_rev` mới nhận. User cũ `RESET_REQUIRED` không bị đổi.
- Duplicate User trả 409 `EMAIL_ALREADY_REGISTERED`. Candidate/activation failure trả `REGISTRATION_INCOMPLETE` (409 khi conflict, 503 khi storage error); không blind retry/xóa compensation.
- API error không tiết lộ email tồn tại, hash hoặc thông tin nội bộ.

### Frontend

- Tái sử dụng Login/Register/AuthContext/ProtectedRoute/Navbar/routes hiện có; giữ phong cách và component tree.
- Register là Candidate-only và thu thập các trường cần để tạo Candidate document hợp lệ.
- Login gọi backend, giữ token trong memory rồi xác minh qua `/auth/me`; role map sang canonical uppercase.
- Logout chỉ xóa token memory, không gọi host ngoài dự án. Reload yêu cầu đăng nhập lại.
- Hợp nhất Axios thành một instance `services/api.js`; `api/axiosClient.js` re-export cùng instance. Default base URL `http://127.0.0.1:5002/api`; auth paths dùng `/v1/auth/...`.
- Cập nhật `.env.example` (placeholder JWT, API base 5002); không sửa `.env` thật.

## 5. Kết quả thực tế và bằng chứng

- Branch vẫn `feature/identity-candidate-portal`.
- Frontend `http://127.0.0.1:5173/` trả HTTP 200.
- Backend 5002: `GET /api/health` trả 200; `GET /api/v1/auth/me` trả 404. Runtime process hiện tại chưa phục vụ route Stage 04B; không restart process.
- Root `.env` tồn tại nhưng không có key `JWT_ACCESS_SECRET` hoặc `AUTH_COUCHDB_DATABASE` (chỉ kiểm tra key presence, không đọc/hiển thị giá trị); `frontend/.env` không tồn tại.
- Argon2id native module load/hash smoke check thành công.
- Toàn bộ registration/login fake tests dùng in-memory repository/client. Không gửi CouchDB write; database `recruitment_db` không được truy vấn lại trong task này.
- Auth persistence hiện yêu cầu `AUTH_COUCHDB_DATABASE` tách biệt và từ chối `recruitment_db`; code không tự tạo database.
- Người yêu cầu đã phê duyệt task-level provisional policy; vẫn pending team acknowledgement.

## 6. Files đã tạo hoặc sửa

### Backend

- **Thêm:** `backend/src/middleware/authenticate.js`, `backend/src/routes/auth.routes.js`, `backend/src/services/jwt-access-token.js`, `backend/src/services/user.dto.js`, `backend/tests/auth-foundation/auth-mvp.test.js`, `backend/tests/auth-foundation/auth-routes.test.js`.
- **Sửa cho Stage 04B:** `backend/src/routes/api-v1.routes.js`, `backend/src/schemas/auth-request.schema.js`, `backend/src/services/auth.service.js`, `backend/tests/auth-foundation/api-v1.test.js`, `backend/tests/auth-foundation/auth-contract.test.js`.
- **Dependency:** `backend/package.json` và `backend/package-lock.json` thêm `argon2@^0.45.1`; npm install script được allowlist trong manifest.
- `backend/src/app.js`, User/Candidate repositories và validation middleware đã có từ Stage 04A; không sửa các phần đó ở lượt này.

### Frontend và tài liệu

- **Thêm:** `frontend/src/context/auth-context.js`, `frontend/src/context/useAuth.js`, `frontend/tests/auth/auth-helper.test.js`.
- **Sửa:** `frontend/src/api/axiosClient.js`, `frontend/src/components/Navbar.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/context/AuthContext.jsx`, `frontend/src/index.css`, `frontend/src/pages/Jobs/JobDetails.jsx`, `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/routes/AppRoutes.jsx`, `frontend/src/services/api.js`, `frontend/src/utils/authHelper.js`, `frontend/.env.example`.
- **Tài liệu:** `docs/shared/TECHNICAL_DECISION_REGISTER.md`, `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`, báo cáo này.
- **Không sửa:** `.env` thật, CouchDB, dataset/manifest, Docker, code TV2/TV3.

## 7. Thay đổi CSDL/API/source

- Auth routes được thêm trong source nhưng chưa được xác minh trên live backend; runtime endpoint hiện trả 404.
- Runtime registration sẽ dùng CouchDB repositories. User và Candidate là hai writes riêng, không phải transaction.
- Tests dùng fake repositories/client; không write hoặc query database hiện hữu. Không tạo DB/index/view, seed hoặc migration.
- Không đổi 9 document types hoặc DATA-02A document schema.

## 8. Test/build/verification

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 36/36** — registration, duplicate, invalid password/token, expiry, account status, partial writes/conflict, isolated DB guard, RBAC, Foundation regression. |
| `node --test tests/auth/*.test.js` (frontend) | **PASS 1/1** — memory token và local logout clearing. |
| `npm.cmd run build` (frontend) | **PASS** — Vite production build. |
| `npm.cmd run lint` (frontend) | **PASS, 0 errors; 19 warnings** — warnings ở App/dashboard/job/landing/profile source (unused imports/variables và một hook dependency); auth context/Login/Register/Navbar/ProtectedRoute không cảnh báo. |
| `git diff --check` | **PASS**; có thông báo Git chuẩn về LF sẽ chuyển CRLF khi chạm lại một số file frontend. |
| HTTP smoke | Frontend 5173: 200; backend health 5002: 200; auth `/api/v1/auth/me`: 404. Không restart. |

Không chạy `npm test` legacy data suite vì các suite đã ghi nhận side effects trên data/release scratch paths; thay vào đó chạy auth + Foundation tests cô lập. Không chạy live registration.

## 9. Vấn đề và rủi ro

- Backend đang chạy chưa phục vụ route mới (`/api/v1/auth/me` 404); cần vận hành khởi chạy đúng source sau khi cấu hình secret. Không restart process trong task này.
- `JWT_ACCESS_SECRET` và `AUTH_COUCHDB_DATABASE` chưa được cấu hình trong root `.env`. Code sẽ trả lỗi cấu hình cho auth requests đến khi có JWT key và tên DB test cô lập hợp lệ. Câu hỏi riêng về việc thêm key vào ignored `.env` đang chờ lựa chọn; giá trị không được log/báo cáo.
- Không kiểm tra persistence bằng CouchDB vì không có DB test/demo riêng được xác nhận và không được ghi `recruitment_db`.
- User + Candidate không atomic. Partial failure giữ User `RESET_REQUIRED`, trả lỗi `REGISTRATION_INCOMPLETE`; cần operator reconciliation thủ công, hiện chưa có công cụ self-service.
- Logout không revoke token; token bị sao chép còn dùng được tối đa tới expiry. Chưa có refresh, email verification, password reset, rate limiting, audit, Admin bootstrap hoặc Recruiter signup.
- DR-002 trước đây hướng cookie+CSRF; Stage 04B dùng Bearer memory. Team acknowledgement vẫn bắt buộc.
- npm install báo tổng dependency tree có 3 high-severity advisories; chưa điều tra/remediate trong scope.

## 10. Quyết định cần nhóm xác nhận

- Bearer memory-only thay cookie+CSRF; 15 phút, không refresh/revocation.
- Argon2id parameters và password policy.
- Candidate activation sau khi tạo hai documents và operator reconciliation khi partial failure.
- API envelope/status/principal và RBAC integration contract.
- DR-004 retry policy chung; Stage 04B không tự retry mutation.

## 11. Công việc còn lại

- Cấu hình JWT secret và isolated `AUTH_COUCHDB_DATABASE` local; không commit secret, không tạo database trong task này.
- Khởi chạy đúng backend source trên cổng dev đã cấu hình sau khi xử lý secret; không can thiệp cổng 5000.
- Muốn kiểm tra persistence thì trước tiên duyệt/chuẩn bị DB test cô lập và cấu hình `AUTH_COUCHDB_DATABASE`; không dùng `recruitment_db`.
- TV2/TV3/group acknowledge provisional policy và auth contract.
- Thiết kế operator reconciliation procedure cho staged User/Candidate records.

## 12. Điều kiện nghiệm thu và trạng thái

**PARTIAL.** Auth service/routes/middleware và frontend flow đã triển khai; targeted backend tests 36/36, frontend helper 1/1, build PASS và lint exit 0. Chưa có full runtime E2E vì backend 5002 chưa nhận route mới, JWT secret/isolated database config chưa thiết lập, không có DB test riêng và chưa có team acknowledgement. Không có test write lên database hiện hữu.

## 13. Bước tiếp theo

Hoàn thành cấu hình JWT secret an toàn và một DB test/demo cô lập đã được duyệt; khởi chạy đúng backend trên cổng dev đã chỉ định; sau đó chạy Register → Login → Me → local Logout chỉ trên DB cô lập. Ghi nhận team acknowledgement trước khi nâng các lựa chọn provisional thành contract chung.


## Local JWT configuration follow-up (2026-10-23)

- Verified root `.env` exists, is ignored by `.gitignore`, and is not Git-tracked. Backend `loadBackendEnvironment()` resolves the repository root from its module path and loads root `.env` after `backend/.env`, without overriding parent-process variables.
- Added a cryptographically random local `JWT_ACCESS_SECRET` (64 bytes) to root `.env`; the value is intentionally omitted from this report and all command output. Existing environment settings were preserved.
- `.env.example` contains only the variable name with a placeholder; no secret is tracked.
- Ephemeral Express smoke using the real app source after loading root env: backend start PASS; `GET /api/health` 200; `GET /api/v1/auth/me` 401 without token; valid-shaped `POST /api/v1/auth/login` safely returns 503 `AUTH_DATABASE_CONFIGURATION_ERROR` because no isolated auth database is configured. The guard exits before CouchDB requests. No database was created, queried, or written.
- The already-running process on port 5002 was not restarted or modified; earlier observation that it serves old source and returns 404 for the new auth route remains. A controlled restart is still required to serve the updated code.
- Verification: backend auth + Foundation tests PASS 36/36; frontend auth test PASS 1/1; frontend build PASS; lint exits 0 with 19 warnings and 0 errors.
- Acceptance remains **PARTIAL**: secret configuration is complete, but live persistence/E2E requires an explicitly approved isolated CouchDB database and a controlled backend restart.
