# Kiểm tra cấu hình và chạy local — 16/11/2026

## Phạm vi và kết luận

Project được kiểm tra tại `E:\University\HK1-2026-2027\NoSQL\recruithub-nosql`. Node.js v22.23.4, npm 10.9.9, CouchDB thực tế 3.5.2. Backend và frontend đã khởi động. Cấu hình kết nối, Auth/JWT và proxy đã được cập nhật; chưa thể kết luận hệ thống không còn lỗi hoặc đã nghiệm thu đủ ba vai trò.

## Cấu hình đã cập nhật

- `.env` gốc: CouchDB loopback port 5984, database `recruitment_db`, credentials theo người dùng cung cấp; Auth cùng database và `AUTH_ALLOW_PRIMARY_DATABASE=true`.
- Tạo JWT secret ngẫu nhiên và backup signing key độc lập, không in ra log; signing key ID `local-demo-v1`.
- Backend port 5000, frontend origin chính xác `http://127.0.0.1:5178`.
- Bật đăng ký Recruiter ở cả backend và frontend cho môi trường demo local.
- `frontend/.env`: `VITE_API_BASE_URL=/api`; dùng proxy Vite, bỏ chế độ public fixtures nếu có.
- `.env.example`, `frontend/.env.example`, README được đồng bộ hướng dẫn. Mẫu giữ placeholder cho secret và giữ primary-write opt-in tắt mặc định.
- Hai file `.env` được Git ignore. Không hardcode mật khẩu vào JavaScript hoặc file tracked.
- Audit chưa provision: không bịa thông tin writer/reader, không tuyên bố UC26 chạy được trên database này.

Docker Desktop được khởi động; container CouchDB được recreate theo Compose để áp dụng credentials mới. Named volume `recruithub-nosql_couchdb_data` được giữ nguyên. Trước và sau recreate: 25.751 documents.

Chạy `npm run db:job-application` và `npm run db:admin-statistics` để cài index/view còn thiếu. Health sau setup: 25.762 documents; phần tăng thêm là design/index documents do setup. Không import lại dataset, không xóa database, không thay mật khẩu/status của các user ứng dụng.

## Kiểm chứng runtime

| Kiểm tra | Kết quả |
|---|---|
| CouchDB `/_session` | HTTP 200, user admin, role `_admin` |
| Backend `/api/health` | HTTP 200 |
| Qua Vite `/api/health/database` | HTTP 200, `ready`, `recruitment_db` |
| Qua Vite `/api/v1/jobs?limit=5` | HTTP 200, 5 items sau setup index |
| `/api/v1/jobs/metadata` | HTTP 200 |
| `/api/v1/companies?search=tech` | HTTP 200, 10 items |
| `/api/v1/auth/me` khi chưa đăng nhập | HTTP 401 đúng guard |
| Browser `/jobs` | Hiển thị 12 tin trên trang đầu và phân trang |
| Cấu hình Auth | `getAuthDatabaseConfig()` chấp nhận `recruitment_db` |
| Cấu hình backup key | `backupConfiguration()` chấp nhận; chưa đồng nghĩa backup runtime đạt |

## Tài khoản và dữ liệu

Đếm user qua CouchDB thực tế:

- 10.000 Candidate: `RESET_REQUIRED`, không có `password_hash`.
- 150 Recruiter: `RESET_REQUIRED`, không có `password_hash`.
- Không có Admin ứng dụng trong tập user hiện tại.

Không có mật khẩu plaintext để lấy từ dataset. Credentials CouchDB không thay thế email/password của website. Cần tạo tài khoản demo ứng dụng hoặc dùng quy trình reset/provision được hỗ trợ trước khi demo private flow. Chưa thực hiện tạo Admin hoặc kích hoạt hàng loạt user.

Các loại dữ liệu nghiệp vụ: user 10.150; candidate 10.000; recruiter 150; company 50; department 150; job 2.500; application 1.200; interview 350; resume_analysis 1.200. Tổng 25.750 business documents; tách biệt với doc_count gồm design docs.

## Kết quả kiểm thử

Sau `npm ci --no-audit --no-fund` tại backend và frontend:

| Bộ kiểm tra | Kết quả |
|---|---|
| Backend `npm test` | 685 tests: 649 PASS, 27 FAIL, 9 SKIP |
| Auth routes, CORS, database config, environment loader/readiness | 11/11 PASS |
| Frontend `npm test` — Vitest | 255 tests: 240 PASS, 15 FAIL; 7/31 files fail |
| Node frontend auth-helper/public-jobs chạy riêng | 7/7 PASS |
| Frontend lint | PASS: 0 errors, 2 warnings có sẵn (`App.jsx`, `vite.config.js`) |
| Frontend production build | PASS; JS chunk 1.074,24 kB, có cảnh báo vượt 500 kB |

Frontend script nối bằng `&&`, vì vậy phần Node không tự chạy sau khi Vitest fail; đã chạy riêng. Backend mặc định không bao gồm toàn bộ thư mục `tests/auth-foundation`; chỉ chạy bổ sung các file liên quan cấu hình, không coi đó là kết quả full auth suite.

Log đầy đủ (local, Git ignored): `backend-test-2026-11-16.log`, `frontend-test-2026-11-16.log` tại root project.

## Lỗi còn tồn tại

1. **Public catalog lặp khi hai nguồn cùng database.** Duyệt API với limit 50 qua 8 trang: 400 rows, 200 unique IDs, 200 rows trùng. `createApp` bật live catalog khi Auth hợp lệ nhưng `PublicJobCatalogService` tiếp tục đọc dataset trỏ cùng database. Chưa sửa logic này trong lượt cập nhật cấu hình.
2. **Chưa có tài khoản ứng dụng đăng nhập được từ release hiện tại.** Cấu hình Auth hợp lệ không tự tạo mật khẩu cho user `RESET_REQUIRED`.
3. **Backup/restore có test fail trên môi trường Windows hiện tại.** Nhiều ca `BACKUP_CONFIGURATION_ERROR` ở job store/API/restore; cần điều tra private spool/ACL và nguyên nhân gốc. Signing key đã có nhưng chưa xác minh backup runtime thành công.
4. **Dataset/scoring freshness:** 4 ca corpus fail, gồm freshness, invalidation, publication failure injection và idempotent publication. Không tái sinh snapshot để che lỗi.
5. **Foundation queryView:** test mong TypeError không nhận rejection.
6. **Public database wiring:** một ca fail; cần đối chiếu hợp đồng hiện hành với test, không quy toàn bộ lỗi cho `.env`.
7. **Frontend:** 15 ca fail trong Admin user list (7), recruiter enhancements (3), catalog lifecycle (1), job import/export modal (1), post-merge jobs (1), profile rules landing (1), public jobs list (1). Nhiều lỗi là truy vấn UI/nhãn không khớp; cần review riêng trước khi kết luận lỗi nghiệp vụ.
8. **Tài liệu chưa khớp source:** scoring thực tế dùng 50% skill + 25% experience + 10% education + 15% project; enum stage lưu `INTERVIEW`, `OFFER` thay vì tên minh họa `INTERVIEWING`, `OFFERED` trong một số tài liệu.

## Lệnh chạy lại

Tại root:

```powershell
docker compose up -d
```

Terminal backend:

```powershell
Set-Location E:\University\HK1-2026-2027\NoSQL\recruithub-nosql\backend
npm start
```

Terminal frontend:

```powershell
Set-Location E:\University\HK1-2026-2027\NoSQL\recruithub-nosql\frontend
npm run dev
```

Mở `http://127.0.0.1:5178`. Thay `.env` backend cần restart backend; Vite cũng cần tải lại cấu hình. Không chạy `docker compose down -v` hoặc import lại dataset để xử lý lỗi index.
