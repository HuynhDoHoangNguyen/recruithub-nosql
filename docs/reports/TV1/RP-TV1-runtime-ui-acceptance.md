# RecruiHub NoSQL — TV1 Runtime & UI Acceptance

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Mục tiêu:** xác minh source Backend hiện tại, API thực tế trên CouchDB demo, kết nối Frontend và các kiểm tra hồi quy; không thay đổi module hoặc schema.
- **Trạng thái:** **PARTIAL** — API E2E trên demo và tests/build/lint đạt; browser E2E chưa thể chạy do không có browser surface.

## 2. Runtime ownership và ports

- Trước khi khởi chạy, các probe HTTP đến các cổng RecruiHub đã dùng trước đây (`5002`, `5004`, `5173`, `5178`) không nhận phản hồi; `5000` không được probe hay sử dụng.
- Không thể lấy process metadata của tiến trình Windows: `Get-CimInstance Win32_Process` trả Access Denied; kiểm tra listener cũng không trả thông tin dùng được trong sandbox. Vì vậy không kết luận tiến trình cũ nào thuộc repo, và không dừng tiến trình nào.
- Khởi chạy **source hiện tại** trong các phiên do task này tạo:
  - Backend `npm.cmd start`, `PORT=5005`, `AUTH_COUCHDB_DATABASE=recruithub_auth_demo`.
  - Frontend Vite `127.0.0.1:5179`, `VITE_API_BASE_URL=http://127.0.0.1:5005/api`.
- Startup output xác nhận app mới bind thành công; SPA routes `/`, `/login`, `/register`, `/profile`, `/admin` đều trả HTML 200. Module API đã transform xác nhận base URL 5005.
- Backend loader nạp root `.env` theo đường dẫn source; process env được ưu tiên. Secrets không được in. CORS origin `http://127.0.0.1:5179` được đặt cho process backend của phiên này; không ghi thêm cổng động vào `.env`.

## 3. Backend API và CORS

- `GET /api/health`: **200**.
- `GET /api/v1/auth/me` không token: **401**.
- CORS OPTIONS preflight từ chính UI origin `http://127.0.0.1:5179` tới profile PATCH: **204**.
- Response headers xác minh:
  - `Access-Control-Allow-Origin: http://127.0.0.1:5179`
  - Methods có `PATCH` và `OPTIONS` (cùng GET/HEAD/POST/PUT/DELETE).
  - Allowed headers: `Authorization`, `Content-Type`, `If-Match`.
  - Exposed headers: `ETag`.
- Preflight từ `http://evil.invalid` không nhận `Access-Control-Allow-Origin`.
- App dùng exact-origin allowlist; không dùng wildcard.

## 4. API E2E trên database demo

Các thao tác ghi từ đăng ký/profile chỉ đi qua backend được cấu hình với database `recruithub_auth_demo`. Ba tài khoản Candidate tổng hợp được tạo trong các lượt chạy kiểm tra; thông tin đăng nhập không được lưu hoặc in. Một request harness đầu tiên dừng khi tạo token hết hạn do subject test không đúng định dạng canonical, sau khi các kiểm tra trước đó đã chạy; lần chạy hoàn chỉnh sau đó dùng subject hợp lệ và xác nhận kết quả dưới đây. Không seed/migrate hay tạo Admin mới.

| Luồng | Kết quả |
|---|---|
| Candidate registration | **201** |
| Duplicate registration | **409 `EMAIL_ALREADY_REGISTERED`** |
| Wrong password | **401** |
| Candidate login → `/auth/me` | **200 → 200**, role CANDIDATE |
| Candidate Profile GET | **200**, ETag có mặt |
| Candidate Profile PATCH bằng ETag | **200**, ETag mới có mặt |
| PATCH dùng ETag cũ | **409 `REVISION_CONFLICT`** |
| Candidate gọi Admin API | **403** |
| JWT malformed / expired | **401 / 401** |
| Admin login | **200** |
| Admin User list / detail / statistics | **200 / 200 / 200** |
| Admin status update nhắm tới Admin | **403 `ADMIN_STATUS_CHANGE_FORBIDDEN`**, không đổi trạng thái |
| Admin gọi Candidate Profile API | **403** |
| Logout | Không có endpoint revoke; client logout là xóa token trong memory. Helper unit test PASS; thao tác click trên browser chưa xác minh. |

## 5. Frontend acceptance

Browser automation surface inventory rỗng (`apps=[]`, `browsers=[]`), nên không thể xác nhận rendering trực quan, thao tác điều hướng/form, loading/error/success UI hoặc responsive. HTTP 200 của Vite và các API E2E không được xem là browser E2E.

### Manual browser checklist

Dùng browser mở `http://127.0.0.1:5179/`. Backend cùng phiên chạy ở `http://127.0.0.1:5005`, chỉ kết nối auth persistence tới `recruithub_auth_demo`.

- [ ] Landing: mở menu/nav, lần lượt đi tới Login, Register và Jobs; xác nhận đường dẫn và quay lại Landing.
- [ ] Register: submit thiếu trường/mật khẩu sai policy để kiểm tra validation; đăng ký Candidate tổng hợp mới; thử lại cùng email để thấy duplicate error.
- [ ] Login: thử mật khẩu sai, sau đó đăng nhập đúng; xác nhận trang protected mở. Refresh trang để xác nhận memory token bị xóa và route yêu cầu đăng nhập lại.
- [ ] Profile: tải profile, sửa summary, lưu; kiểm tra response ETag trong Network; thử stale revision nếu giao diện hỗ trợ và kiểm tra thông báo conflict.
- [ ] Logout: dùng nút logout; xác nhận token bị xóa và protected route đóng. Kiểm tra không có token trong localStorage/sessionStorage.
- [ ] Candidate route guard: mở Admin Dashboard khi đăng nhập Candidate; xác nhận bị từ chối/điều hướng.
- [ ] Admin: đăng nhập tài khoản demo hiện có; tải Dashboard, thống kê, danh sách, mở User detail. Với target ADMIN, xác nhận không có action lock/unlock và có thông báo operator-managed. Kiểm tra trạng thái Candidate/Recruiter đủ điều kiện nếu có tài khoản demo tương ứng.
- [ ] Kiểm tra loading, empty/error/success state; viewport 360px, tablet và desktop; xác nhận Network dùng API 5005 và không phát sinh CORS error.

## 6. Tests, build, lint và Git

| Kiểm tra | Kết quả |
|---|---|
| Backend `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 52/52** |
| Frontend `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4** |
| Frontend `npm.cmd run build` | **PASS** |
| Frontend `npm.cmd run lint` | **PASS**, 0 errors, 16 warnings |
| `git diff --check` trước khi thêm báo cáo | **PASS**, cảnh báo line ending LF→CRLF chuẩn |
| Legacy backend `npm test` | **Không chạy** do các test data/release dùng shared scratch paths; đã có ghi nhận rủi ro side effects |

Branch vẫn `feature/identity-candidate-portal`. Không stage/commit/push/merge/reset/clean. `.env` ignored; build output bị ignore. Các thay đổi trước đó trong working tree được giữ nguyên. Báo cáo này là file mới duy nhất của lượt hiện tại.

## 7. Database safety

Read-only metadata cuối qua CouchDbClient:

- `recruithub_auth_demo`: **11 documents** sau các luồng đăng ký E2E; chỉ tăng do các Candidate User/Profile tổng hợp vừa đăng ký và không có index/view.
- `recruitment_db`: **25,750 documents**, không đổi trong lượt này; chỉ truy vấn metadata.
- Không tạo/xóa database, không reset/seed/migrate, không tạo index/view, không thao tác Docker/volume. Không dùng `recruitment_db` cho auth.

## 8. Decisions/blockers còn mở

- Candidate self-registration provenance classification/field-origin semantics vẫn chờ DATA owner/nhóm xác nhận.
- Self-service Candidate ID convention cần acknowledgement trong contract chung.
- Quy tắc conflict retry giữa DATA-02A (conditional tối đa một lần) và `AGENTS.md` (tối đa ba lần) chưa thống nhất; Foundation hiện không tự retry.
- TV2 sở hữu Public Job/Apply API/DTO, OPEN-only behavior, filters/pagination/error contract.
- TV3 sở hữu Interview/Scoring/Audit API, storage, retention và redaction contracts.
- Browser visual/interaction/responsive E2E chưa xác minh.
- Các process cũ không được xác định ownership; process mới dùng port riêng. Docker container/volume identity không được kiểm tra trong task này.

## 9. Kết luận nghiệm thu

**PARTIAL.** Backend source mới chạy trên port riêng và được xác minh với exact-origin CORS. Candidate Auth/Profile và Admin APIs vượt qua các luồng E2E trên CouchDB demo riêng; `recruitment_db` giữ nguyên 25,750 docs. Backend/frontend targeted tests, build và lint đạt. UI thực tế trong browser còn phải hoàn tất theo checklist; TV2/TV3 và provenance/retry decisions vẫn pending. Runtime/API code sẵn sàng cho review có điều kiện; không tự commit/merge.
