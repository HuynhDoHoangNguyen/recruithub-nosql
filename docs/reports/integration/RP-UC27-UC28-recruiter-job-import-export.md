# Báo cáo triển khai UC27/UC28 — Import/Export Job cho Recruiter

**Ngày:** 2026-10-26 (Asia/Saigon)  
**Phạm vi:** API và giao diện nhập/xuất tin tuyển dụng cho Recruiter; kiểm thử ghi dữ liệu chỉ trên CouchDB test được chỉ định.  
**Trạng thái:** Đã kiểm thử end-to-end trên database test và chạy một lượt Import/Export smoke test trên `recruitment_db` sau khi được người dùng cho phép; chưa xác nhận giao diện qua browser thật.

## 1. An toàn dữ liệu và môi trường

- CouchDB được xác nhận tại `http://127.0.0.1:5984`.
- Database `recruitment_db` trả HTTP 200; trước khi có xác nhận mới của người dùng, database này chỉ được đọc. Sau yêu cầu rõ ràng cho phép chạy DB thật, đã thực hiện đúng một lần Import/Export smoke test trên database này.
- `recruithub_auth_demo` không được dùng làm đích ghi.
- Database `recruithub_import_export_test` được xác nhận chưa tồn tại trước khi tạo, sau đó khởi tạo riêng 9 Mango index và `_design/job_application` với 6 view.
- Không in username/password hoặc credentials ra log/báo cáo. Integration test chỉ chạy khi `JOB_IMPORT_EXPORT_TEST_DATABASE` được đặt đúng bằng tên database test và kiểm tra host phải là local.
- Không xóa document nào. Dữ liệu kiểm thử tổng hợp được giữ lại để phục vụ kiểm tra; chạy integration test lần nữa sẽ thêm một nhóm dữ liệu có ID duy nhất.

Snapshot GET sau lần integration test gần nhất: database test có 87 document, gồm 9 Mango index document và 1 design document; dữ liệu tổng hợp gồm 18 User, 12 Company, 12 Department, 12 Recruiter, 6 Candidate, 17 Job. Job có 11 DRAFT và 6 OPEN. Tất cả Job test được tạo bằng workflow có kiểm soát; các Job OPEN được publish qua endpoint status hiện có. Các lần chạy trước đó cũng được giữ lại, không xóa.

## 2. API contract

Prefix: `/api/v1`. Tất cả endpoint import/export yêu cầu access token hợp lệ và role `RECRUITER`; Candidate nhận 403.

| Method và endpoint | Nội dung |
|---|---|
| `GET /recruiter/jobs/import/template?format=csv\|json` | Tải template, `Content-Type` và `Content-Disposition` phù hợp. |
| `POST /recruiter/jobs/import/preview` | Body `{ format, fileName, content }`; phân tích, kiểm tra schema, phát hiện trùng, trả lỗi theo dòng và token preview ký HMAC hết hạn sau 15 phút. Không ghi DB. |
| `POST /recruiter/jobs/import/confirm` | Body preview cộng `previewToken`; kiểm tra lại file/token, tạo DRAFT từng dòng, tiếp tục nếu một dòng lỗi; trả `created/skipped/failed` và kết quả từng dòng. |
| `GET /recruiter/jobs/export?format=csv\|json&status=&q=&created_from=&created_to=` | Xuất toàn bộ trang tin của Recruiter hiện tại theo bộ lọc đã chọn; tối đa 5.000 Job. |

CSV dùng header allowlist theo mẫu, array encode dạng JSON trong cell CSV. JSON nhận mảng Job hoặc `{ "schema_version": 1, "jobs": [...] }`; wrapper export có thể chứa thêm `exported_at`. Các trường `_id`, `_rev`, owner, company, department, `deleted_at` và provenance bị từ chối. `status` chỉ là trường báo cáo; khi nhập luôn bị bỏ qua và Job được tạo ở DRAFT. Company/Department/Recruiter được xác định từ authenticated user và `JobService`.

Duplicate policy: trong cùng Recruiter, hai tin được xem là trùng khi tiêu đề và ngành nghề sau trim, gom khoảng trắng, và chuyển chữ thường giống nhau. Bản xem trước báo trùng trong file hoặc với Job đã có. ID Job import xác định từ user và duplicate key để hai lần confirm đồng thời không tạo hai document.

Export chỉ bao gồm các trường nghiệp vụ trong `JOB_IMPORT_FIELDS`, phân trang đầy đủ trong giới hạn 5.000, lọc status, từ khóa và ngày tạo theo UTC. CSV có UTF-8 BOM, CRLF, quote escaping, và thêm dấu nháy đơn trước giá trị có thể chạy thành công thức bảng tính.

## 3. Luồng trên giao diện

Trong Recruiter Dashboard → **Nhập / xuất**:

1. Tải mẫu CSV/JSON hoặc chọn file tối đa 256 KB.
2. Chọn **Xem trước và kiểm tra**. Preview không ghi DB, hiển thị số dòng sẵn sàng/bỏ qua/lỗi và chi tiết từng dòng.
3. Xác nhận tạo tin Nháp. Server kiểm tra chữ ký preview, nội dung file và quyền sở hữu rồi tạo từng Job qua `JobService.create`.
4. Dashboard tải lại danh sách và thống kê sau khi nhập.
5. Tab Xuất cho chọn CSV/JSON, status, từ khóa, ngày tạo.

Import giới hạn 50 dòng mỗi file. Trường salary, location, work mode, employment type không bắt buộc; requirements được chuẩn hóa theo schema Job hiện tại.

## 4. Kiểm thử và bằng chứng

- Backend UC27/UC28 unit tests: **10/10 PASS**.
- Backend integration thật với CouchDB local test DB: **1/1 PASS**. Đã kiểm tra CSV/JSON import, preview không ghi, confirm DRAFT, duplicate/idempotent replay, Candidate bị từ chối, cách ly dữ liệu Recruiter, JSON export → import sang Recruiter khác, CSV export/template, DRAFT không có trong public list và OPEN xuất hiện sau publish.
- Frontend import/export modal tests: **2/2 PASS**.
- Recruiter/Candidate dashboard pagination regression tests cùng modal tests: **4/4 PASS**.
- Frontend production build: **PASS**; còn cảnh báo chunk JavaScript 628.11 kB.
- Frontend lint: **0 lỗi, 3 cảnh báo đã có ở file khác** (`App.jsx`, `AdminDashboard.jsx`).
- Backend/frontend toàn bộ suite: **FAIL do lỗi ngoài các bài test mới**. Backend suite có các lỗi data/release/foundation và database-wiring cũ; frontend có 10 test fail trong tổng số 131 (các nhóm Admin user list, Public Job search, home autocomplete, archived job detail). Các bài test liên quan UC27/UC28 và dashboard chạy riêng đều PASS.

### Live database smoke test — sau xác nhận của người dùng

- Cấu hình Auth và Job được xác nhận cùng trỏ `recruitment_db` tại CouchDB local `127.0.0.1:5984`. Database có 150 Recruiter; một Recruiter `ACTIVE` với Company/Department hợp lệ được xác thực qua `JobService.context` trước khi chạy.
- Bật `JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE=true` chỉ trong tiến trình smoke test tạm thời trên loopback; không ghi thay đổi vào `.env` hay cấu hình mặc định. `recruithub_auth_demo` vẫn bị chặn.
- Import preview/confirm qua HTTP API: **1 Job created**. Job ID `job:8f82c16d9eb305cfad289cc049b03644`, tiêu đề `[UC27/UC28 LIVE TEST] Software Engineer 02510878c0`, status `DRAFT`; owner/company/department khớp Recruiter đã xác thực.
- Export JSON lọc đúng Job và không chứa `_id`/Company ID; export CSV trả HTTP 200, `text/csv; charset=utf-8`, tên file `recruithub-jobs-2026-10-25.csv`, UTF-8 BOM bytes `EF BB BF` và có đúng tin smoke test.
- Job DRAFT không xuất hiện trong public list. Document count tăng từ **25.764 lên 25.765** (đúng 1 document). GET kiểm tra sau đó: 2.501 Job, gồm 2.301 DRAFT và 200 OPEN; smoke test Job vẫn tồn tại và không bị xóa.
- Kiểm tra GET hiện tại: `/api/health` tại 5010 trả 200, nhưng import template tại 5010 và qua proxy Vite 5178 đều trả 404; `/jobs` trên Vite trả HTML 200. Vì vậy Vite đang proxy tới Backend cũ, chưa nạp route mới. Smoke test thật dùng một Express process tạm trên loopback rồi dừng process đó.
- `netstat` cho thấy PID 27632 (`node.exe`) đang LISTEN trên 5010. Lệnh đọc user/command line bị Windows trả `Access Denied` và `Get-NetTCPConnection` không trả listener; không dừng tiến trình vì chưa xác định được chủ sở hữu. Cần dừng Backend cũ trong terminal của người khởi chạy rồi nạp source mới.

Integration test được chạy bằng:

```powershell
cd backend
$env:JOB_IMPORT_EXPORT_TEST_DATABASE = 'recruithub_import_export_test'
node --test tests/recruitment/job-import-export.integration.test.js
```

Các unit test UC27/UC28:

```powershell
cd backend
$env:JOB_IMPORT_EXPORT_TEST_DATABASE = 'recruithub_import_export_test'
npm run test:job-import-export
```

Frontend xác minh:

```powershell
cd frontend
node_modules/.bin/vitest.cmd run tests/job-import-export-modal.test.jsx tests/dashboard-pagination.test.jsx
npm run build
npm run lint
```

## 5. File thuộc phạm vi UC27/UC28

- Backend mới: import/export schema, parser/CSV serializer, service, controller, routes, unit tests, opt-in integration test.
- Backend cập nhật: `src/app.js`, `src/services/job.service.js` (tùy chọn deterministic document ID để import có idempotency), `package.json` (test script).
- Frontend mới: Recruiter import/export modal và component tests.
- Frontend cập nhật: `src/api/jobApplicationApi.js`, `src/pages/Dashboard/RecruiterDashboard.jsx`.

Các thay đổi đang có sẵn ở `.env.example`, README khác, Vite config, API base config, Admin Dashboard và các báo cáo audit là thay đổi từ trước/ngoài UC27/UC28; không được quy chúng vào phần triển khai này.

## 6. Hạn chế còn lại

- Chưa thực hiện browser automation qua trình duyệt thật; frontend được kiểm tra bằng component test và production build.
- Listener hiện tại ở port 5010 chưa được khởi động lại; route UC27/UC28 trên URL giao diện hiện tại vẫn trả 404 cho đến khi backend source mới chạy cùng cấu hình `JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE=true`.
- Chưa chạy full backend/frontend test suite xanh; lỗi suite cũ cần được phân loại ở công việc riêng.
- Chưa bật UC27/UC28 mặc định trên môi trường production. Confirm ghi vào `recruitment_db` cần biến opt-in `JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE=true`; biến này mặc định tắt. `recruithub_auth_demo` luôn bị chặn. Lượt smoke test dùng opt-in chỉ trong tiến trình tạm thời, không đổi config mặc định.
- Dữ liệu synthetic trong DB test được giữ lại theo yêu cầu không xóa dữ liệu.

## 7. Cập nhật bảo vệ database thật

Sau khi người dùng cho phép chạy trên database thật, confirm được mở bằng opt-in rõ ràng theo tiến trình. Nếu database là `recruitment_db` và biến opt-in không đúng giá trị `true`, thao tác confirm bị từ chối. Database `recruithub_auth_demo` vẫn luôn bị từ chối. Preview và Export không bị thay đổi; chúng không ghi document.

Để nạp API source mới sau khi dừng backend cũ đang chiếm port 5010:

```powershell
cd backend
$env:PORT = '5010'
$env:JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE = 'true'
npm.cmd run dev
```

Opt-in chỉ cần trong process dùng DB thật. Nếu chỉ chạy bằng database cô lập, không bật biến này.

## 8. Cập nhật runtime local sau yêu cầu chạy trên DB thật

- Backend source hiện tại được khởi động song song ở `127.0.0.1:5011`; GET `/api/health` trả 200 và `/api/health/database` xác nhận kết nối `recruitment_db`, 25.765 documents.
- Tiến trình mới có `JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE=true` chỉ trong environment của process để Recruiter có thể dùng chức năng Import Confirm đã được người dùng cho phép. Không sửa `.env` production/root và không tạo thêm Job trong lần đồng bộ runtime này.
- GET template CSV/JSON trực tiếp qua 5011 trả 401 nếu không có access token; đây là route yêu cầu đăng nhập. GET `/jobs` và `/api/health` qua frontend Vite song song `127.0.0.1:5179` trả 200; template qua proxy trả 401, chứng minh route UC27/UC28 đã tới backend mới.
- Vite đang chạy tại `127.0.0.1:5178` vẫn trả 404 cho template vì chưa nạp lại proxy. `frontend/.env.local` đã đặt proxy target 5011 và `vite.config.js` hiện đọc biến từ thư mục frontend cố định, không phụ thuộc thư mục chạy lệnh. Cần restart Vite từ terminal đã khởi chạy để tiếp tục dùng URL `http://127.0.0.1:5178`; không dừng tiến trình không rõ chủ sở hữu. `5179` là cổng kiểm chứng tạm thời.
- Trình duyệt automation không có browser surface trong phiên này; chưa xác minh thao tác UI bằng trình duyệt thật hoặc luồng Import/Export đã đăng nhập. Không chạy thêm thao tác ghi. Job smoke test đã nêu ở mục 4 vẫn được giữ nguyên.

### Cập nhật giữ nguyên URL 5178

- Sửa Vite để luôn đọc `VITE_API_PROXY_TARGET` từ thư mục `frontend`, kể cả khi lệnh khởi động được chạy từ thư mục khác.
- Sau khi Vite nạp lại cấu hình, URL `http://127.0.0.1:5178` trả 200 cho `/jobs`, `/api/health` và `/api/health/database`; database là `recruitment_db`, 25.765 documents. Template Import qua proxy trả 401 do chưa gửi access token (đúng yêu cầu xác thực), thay cho 404 trước đó.
- Đã dừng frontend tạm ở 5179 do chính lượt này khởi chạy; Backend mới vẫn ở 5011 và 5178 proxy tới đó. Không có DB write mới.
