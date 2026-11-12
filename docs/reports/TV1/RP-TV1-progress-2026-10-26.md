# Báo cáo tiến độ công việc — Nhánh TV1

**Ngày cập nhật:** 2026-10-26 (Asia/Saigon)  
**Nhánh đang mở:** `feature/admin-management`  
**Commit nền gần nhất:** `9f70df6` — `feat(job-portal): tinh gọn tìm kiếm và giao diện tin tuyển dụng`  
**Trạng thái:** Đang triển khai. Các phần Public Job Portal và một số màn hình Recruiter/Admin đã có source; xác minh browser end-to-end và hoàn tất đăng ký Recruiter còn thiếu.

## 1. Phạm vi TV1

TV1 phụ trách frontend Public Job Portal và các giao diện người dùng được phân công: tìm kiếm danh sách Job, chi tiết Job, Recruiter Dashboard consumer, Admin UI và kết nối API. Job/Application persistence, lifecycle và API nghiệp vụ thuộc TV2; Interview/scoring thuộc TV3. Các thay đổi backend dùng chung được ghi là dependency, không tính thành công việc frontend TV1.

## 2. Đã triển khai

### Public Job Portal — UC06/UC07

- Trang `/jobs` gọi Public Job API, hỗ trợ tìm từ khóa, kỹ năng, ngành nghề, cấp độ và phân trang cursor.
- UI đã được tinh gọn theo bộ trường có trong dữ liệu: không hiển thị bộ lọc location/salary khi nguồn dữ liệu không có giá trị; card chỉ hiện metadata khi có dữ liệu.
- Trang `/jobs/:id` trình bày chi tiết Job, Company và Apply theo DTO hiện hành; ẩn các mục rỗng, giữ trạng thái loading/error/retry và không bịa location/salary.
- Tài liệu chi tiết: [UC06](RP-TV1-UC06-job-search-filter-pagination.md), [UC07](RP-TV1-UC07-job-detail.md).

### Recruiter Dashboard và UC27/UC28 UI

- Recruiter Dashboard tiêu thụ API Job hiện có và có khu vực **Nhập / xuất**.
- Modal Import hỗ trợ chọn CSV/JSON, tải mẫu, xem trước kết quả validate theo dòng, xác nhận tạo tin Nháp và tải lại danh sách sau khi nhập.
- Modal Export có bộ lọc status, từ khóa và ngày tạo. Đã bổ sung bước xem trước số tin khớp cùng danh sách mẫu; mặc định hiển thị 8 dòng, có thể mở toàn bộ hoặc thu gọn. Đổi bộ lọc sẽ xóa preview cũ để tránh dùng nhầm kết quả.
- Import preview hiển thị tổng số dòng hợp lệ, trùng/bỏ qua và lỗi; bảng mặc định gọn 8 dòng, có nút xem toàn bộ.
- Tạo hai file mẫu trong [docs/samples/job-import](../../samples/job-import/): CSV và JSON. Cả hai được xác minh bằng logic preview cục bộ với kết quả 1 hợp lệ, 0 bỏ qua, 0 lỗi. Kiểm tra dùng repository giả trong bộ nhớ; không gọi CouchDB và không ghi database.
- Giao diện xuất gọi endpoint JSON hiện có để đếm và dựng preview; khi tải, gọi endpoint theo định dạng người dùng chọn. Backend giới hạn tối đa 5.000 tin mỗi lần xuất.
- Báo cáo API/backend và bằng chứng tích hợp UC27/UC28: [RP-UC27-UC28](../integration/RP-UC27-UC28-recruiter-job-import-export.md). Phần API/job persistence thuộc tích hợp TV2.

### Admin UI và tích hợp API

- Có các màn hình quản lý User, trạng thái tài khoản, reset credential và thống kê Admin theo contract hiện hành.
- Client dùng same-origin `/api`; Vite proxy chuyển tiếp tới backend theo cấu hình môi trường. Các endpoint cần đăng nhập phải trả 401 khi gọi thiếu token; đây là hành vi xác thực dự kiến.
- Báo cáo runtime Admin: [TV1 Admin runtime follow-up](RP-TV1-admin-real-database-runtime-follow-up.md).

## 3. Đăng ký Recruiter — trạng thái và giới hạn

- Người dùng đã chọn phương án **tự gia nhập ngay** và muốn chọn Company/Department có sẵn.
- Source có route đăng ký và lookup Company/Department; payload hiện dùng `company_id` và `department_id`, backend xác thực Department thuộc Company.
- Tuy nhiên, self-service hiện có thể tạo tài khoản `ACTIVE` gắn vào tổ chức sẵn có mà chưa có invite, membership approval, xác minh domain hoặc Company Admin. Vì vậy chưa thể ghi nhận luồng đăng ký Recruiter là hoàn tất/an toàn chỉ dựa trên việc bật cờ UI/API.
- Cần chốt quy tắc cho phép gia nhập Company và quyền bật các feature flags trên môi trường local trước khi xác nhận nghiệm thu. Audit và các lỗi contract/test cũ được ghi tại [UC01 registration audit](../integration/RP-UC01-recruiter-registration-organization-audit.md).

## 4. Kiểm thử và mức độ xác minh

| Hạng mục | Trạng thái hiện có |
|---|---|
| Public Job list component tests | 6/6 PASS theo audit UC06 đã ghi |
| Public catalog backend tests | 4/4 PASS theo audit tích hợp |
| UC27/UC28 backend unit tests | 10/10 PASS theo báo cáo tích hợp |
| UC27/UC28 backend test DB integration | 1/1 PASS theo báo cáo tích hợp; không chạy lại trong lần cập nhật này |
| Import/Export UI tests và dashboard pagination | PASS theo báo cáo tích hợp trước đó; chưa chạy lại sau thay đổi preview mới |
| Frontend production build/lint | Các kết quả PASS được ghi trong báo cáo trước; chưa chạy lại sau thay đổi preview mới |
| Browser E2E đã đăng nhập | Chưa xác minh trong phiên hiện tại |
| Live DB write trong lần cập nhật report này | Không thực hiện |

Kết quả trong các báo cáo trước là snapshot theo thời điểm chạy, không được hiểu là kiểm thử mới cho những thay đổi preview vừa bổ sung. Full backend/frontend suite trước đây còn lỗi ở các nhóm legacy đã nêu trong báo cáo UC27/UC28.

## 5. Cấu hình và an toàn dữ liệu

- Không ghi thêm document, index hoặc design document vào CouchDB trong lần cập nhật này.
- Các file mẫu là dữ liệu tổng hợp; Company, Department và Recruiter thật vẫn phải được backend lấy từ authenticated context khi tạo Job.
- Job Import luôn tạo `DRAFT`; muốn hiển thị công khai cần dùng workflow publish hiện hành để chuyển Job sang `OPEN`.
- `recruitment_db` đã có một Job smoke test từ lần xác minh trước theo cho phép riêng của người dùng; report này không tạo, sửa hoặc xóa Job đó.
- Không stage, commit, push, checkout, reset hoặc stash trong lần ghi báo cáo này.

## 6. Việc còn lại

1. Chạy lại component test và production build cho modal sau khi có yêu cầu xác minh; xác nhận UI thực tế trên URL local đang dùng.
2. Xác minh thao tác Import/Export qua trình duyệt với Recruiter đã đăng nhập; chỉ dùng confirm nếu người dùng muốn tạo dữ liệu thật.
3. Khép kín chính sách membership/approval cho Recruiter trước khi ghi nhận public self-registration là hoàn chỉnh.
4. Đồng bộ runtime backend/Vite theo cổng đã chốt và cập nhật kết quả GET/browser tương ứng; không đổi URL người dùng đang dùng nếu chưa cần.
5. Phân loại các lỗi full-suite cũ ngoài phạm vi TV1/UC27/UC28.
