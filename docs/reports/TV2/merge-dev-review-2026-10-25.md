# Rà soát merge dev — giữ bản giao diện hiện tại

> Cập nhật sau phản hồi dữ liệu mất: [đã sửa nguồn đọc Public Jobs và kiểm chứng lại](public-jobs-after-merge-fix.md). Dữ liệu vẫn đủ 25.750 business docs; GET public hiện 200. Mục Jobs 503 bên dưới là lịch sử trước bản sửa.

Ngày: 25/10/2026. Nhánh: `feature/recruiter-management-application-lifecycle`. HEAD cuối lượt kiểm tra: **`875986a`**.

## Mốc được giữ và phạm vi

- Bản đã chấp nhận: `a5b5f21` — `feat(recruitment): align IT portal and add scoped dashboard context`.
- Dev đang merge: `018a0d5` — `Merge pull request #4 ... feature/public-job-portal`.
- Phát hiện 15 file unmerged. Đã giải quyết nội dung xung đột, giữ giao diện JobPortal IT, form và Dashboard hiện tại; ghép phần Identity/Profile/Public Search mới từ dev.
- Chưa triển khai UC mới; agent không chạy commit/push/checkout/reset. Trong lúc rà soát, Git được hoàn tất merge tại `875986a` (parents `a5b5f21`, `018a0d5`); không còn MERGE_HEAD hoặc unmerged entries. Giữ nguyên commit này; các sửa tương thích bổ sung hiện ở working tree, chưa được agent commit/stage.
- Đã sao lưu cả hai phiên bản và working copy của 15 file vào OS temp: `C:\Users\TANPHU~1\AppData\Local\Temp\recruithub-merge-review-kA5EIJ`.

## Quyết định gộp

| Phần | Bản được giữ / cách ghép |
|---|---|
| Navbar, font, màu, card, Landing | Giữ giao diện JobPortal IT từ nhánh hiện tại; không quay về “Find Your Dream Job” |
| JobForm, jobFormModel, CreateJob | Giữ nguyên so với `a5b5f21`, gồm deadline giây/ms, requirements và tổ chức server-owned |
| Candidate Dashboard | Giữ nguyên so với `a5b5f21`, gồm aggregate toàn scope, 7 stage, CV/history và withdraw |
| Recruiter Dashboard | Giữ bản hiện tại; thêm anchor `organization` cho thông tin công ty/phòng ban đã có |
| Job Details và Apply | Giữ layout/luồng hiện tại; chỉ nối hook Auth mới |
| Login/Register/Profile/Admin | Giữ chức năng mới từ dev; dùng chung theme hiện tại, không phục hồi API/fallback cũ đã hết hiệu lực |
| AuthContext/ProtectedRoute | Dùng principal được server xác thực từ dev, token memory-only; không quay lại suy quyền bằng JWT trong localStorage |
| API client | Một Axios instance từ `services/api.js`; root `/api`, mọi service gọi `/v1/...`; normalize được cấu hình cũ có `/api/v1` |
| Context và Candidate stats | Giữ `/v1/recruiter/context`, `/v1/applications/stats`; bổ sung `candidateStats` bị thiếu trong proxy repository lazy của app sau auto-merge |
| Public Job list | Giữ newest-first theo `created_at`/`_id` và company_name; không loại OPEN thiếu published_at |
| Public Search | Ghép literal search/filter/debounce/AbortController/cursor từ dev vào bố cục sidebar/card hiện tại; không bỏ phần tìm kiếm mới |
| Cursor | Ràng buộc bộ lọc và loại cursor; từ chối cursor sai/chuyển bộ lọc bằng 400, giữ has_more probe của dev |
| Fixtures | API thật mặc định; fixture phải opt-in rõ ràng ở development bằng `VITE_PUBLIC_JOBS_MODE=fixtures` |
| Hồ Sơ Doanh Nghiệp | Dẫn tới `/recruiter/dashboard#organization` để xem tổ chức hiện có; `/profile` mới của dev chỉ dành Candidate. Không dựng UC chỉnh sửa doanh nghiệp mới |

Những lỗi trùng phần lớn do cùng một vùng source được sửa theo hai hướng: giao diện TV2 mới và Auth/Public Portal TV1 mới. Không giữ hai client hoặc hai cơ chế phân quyền song song. Các module Auth/Profile mới được giữ nguyên core; phần sửa ở giao diện/client là nối tương thích.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Foundation + Recruitment | **78/78 PASS** |
| Frontend Vitest | **74/74 PASS**, 8 files |
| Frontend helper/model Node tests | **7/7 PASS** |
| Frontend lint | **0 errors, 1 warning** unused React trong App.jsx |
| Frontend production build | PASS; có cảnh báo bundle >500kB |
| Backend npm test theo cấu hình hiện tại | **308 tests: 286 PASS, 22 FAIL** dataset/ETL có trước |
| Chạy thêm Foundation + Recruitment + Auth Foundation | 121 tests: 114 PASS, 7 FAIL thuộc Recruiter registration |
| Auth Foundation nguyên gốc dev trong temp | **43 tests: 36 PASS, đúng 7 FAIL tương tự**; xác nhận lỗi đã có trên dev trước ghép |
| Browser thật 5173 | Landing/Jobs/Login/Register mở được, menu mobile hoạt động, không overflow và không lỗi runtime/module |

Baseline dev được lấy trực tiếp bằng `git archive MERGE_HEAD` vào temp, không checkout branch hoặc thay source hiện tại. Đã dùng cùng bộ dependency backend theo lockfile để đối chiếu. Log baseline: `C:\Users\TANPHU~1\AppData\Local\Temp\recruithub-dev-baseline-z2sNvY\test-results.log`.

7 lỗi Auth có sẵn thuộc `auth-routes.test.js` và `recruiter-registration.test.js`: fixture/test theo luồng tạo Company/Department cũ chưa khớp service chọn Company/Department hiện tại, trả `ORGANIZATION_NOT_SUPPORTED` hoặc 400. Không sửa core đăng ký hoặc đổi assertion thành PASS để che lỗi. Để lại cho lượt UC tiếp theo như yêu cầu.

22 lỗi full backend vẫn thuộc checksum/release thiếu/Python pyarrow và các kiểm tra ETL phụ thuộc. Không sửa snapshot/manifests để làm xanh.

## Trạng thái chạy thật sau merge

Frontend đã khởi động lại tại **http://localhost:5173**, backend đang trả health ở **http://localhost:5000**.

[Bằng chứng browser không mock](merge-dev-verification/smoke-results.json), [Landing](merge-dev-verification/landing.png), [Jobs](merge-dev-verification/jobs.png), [Login mới từ dev](merge-dev-verification/login.png).

| Endpoint thật | Kết quả |
|---|---|
| `/api/health` | 200 |
| `/api/health/database` | 200 |
| `/api/v1/auth/me` không đăng nhập | 401 `AUTHENTICATION_FAILED`, đúng bảo vệ |
| `/api/v1/jobs?limit=1` | 503 `AUTH_DATABASE_CONFIGURATION_ERROR` |

**Lưu ý cấu hình mới từ dev:** Identity và Job/Application nay dùng `AUTH_COUCHDB_DATABASE` riêng; guard hiện tại từ chối `recruitment_db` và giá trị chưa cấu hình. Đây là lý do Jobs thật đang hiện lỗi cấu hình sau merge, dù database health cho dataset cũ vẫn 200. Không đổi `.env` hoặc tự tạo/copy dữ liệu database trong lượt gộp này. Không dùng mock để che lỗi.

Hướng tích hợp database/Identity này cần được xử lý trước khi demo các UC còn lại. Các ảnh và kết quả Jobs live 200 ở báo cáo trước là bằng chứng của bản trước merge, không phải trạng thái runtime mới. Auth memory-only của dev cũng yêu cầu đăng nhập lại khi reload; không khôi phục JWT localStorage để thay chính sách đó.

## Bước sau

1. Review các sửa tương thích còn lại trên merge commit `875986a`; agent chưa tạo commit bổ sung.
2. Thống nhất/cấu hình database riêng và dữ liệu cho Auth/Job/Application theo contract hiện tại, giữ nguyên dataset lịch sử.
3. Rà soát 7 lỗi Recruiter registration đã có trong dev.
4. Sau đó tiếp tục nghiệm thu và hoàn thiện các UC còn lại; không coi merge này là hoàn thành toàn hệ thống.
