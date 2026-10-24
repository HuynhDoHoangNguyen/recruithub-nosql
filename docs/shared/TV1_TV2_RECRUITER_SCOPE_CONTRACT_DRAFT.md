# Kế hoạch MVP: Đăng ký Recruiter

**Phạm vi:** Tạo tài khoản Recruiter bằng cách chọn Company và Department đã có. Không tạo Company/Department mới trong form; không nhập trường Job khi đăng ký.

## Luồng người dùng

1. Nhập email, mật khẩu và một phần tên Company.
2. Hiện gợi ý Company khớp tên; mỗi kết quả hiển thị tên và lĩnh vực để phân biệt.
3. Chọn Company; tải danh sách Department thuộc Company đó.
4. Chọn Department và gửi đăng ký.
5. Nếu không có Company phù hợp, hiện: **“Hiện chưa hỗ trợ công ty này. Vui lòng liên hệ quản trị viên để được bổ sung.”** Không cho gửi đăng ký và không tự tạo Company.
6. Job title, mô tả, yêu cầu, kỹ năng và hạn tuyển được nhập sau ở luồng tạo Job của TV2.

## Trường đăng ký

| Trường | Bắt buộc? | Ghi chú |
|---|---|---|
| Email | Có | Định danh User. |
| Mật khẩu | Có | Backend chỉ lưu password hash. |
| Xác nhận mật khẩu | Form | Chỉ kiểm tra, không lưu. |
| Tên Company | Có | Chỉ dùng tìm và chọn kết quả có sẵn; không phải Company mới. |
| Company | Có | Backend dùng `company_id` của kết quả đã chọn; hiển thị tên/lĩnh vực để xác nhận. |
| Department | Có | Chọn từ danh sách được tải theo Company. |
| Website, địa chỉ | Không | Không cần cho đăng ký; Company schema cho phép thiếu. |
| Thông tin Job | Không | Bổ sung khi tạo Job. |

`role`, `account_status`, IDs, timestamps, provenance và các references do backend tạo. `full_name`/điện thoại của Recruiter chưa có trong User/Recruiter schema nên không thu thập trong MVP.

## Backend và frontend cần triển khai

1. `GET /api/v1/companies?search=<name>`: tìm theo tên, tối thiểu 2 ký tự, tối đa 10 gợi ý; trả DTO công khai `{id, name, industry}`.
2. `GET /api/v1/companies/:companyId/departments`: trả `{id, name}` cho các Department thuộc Company đó.
3. Frontend autocomplete có trạng thái loading, kết quả, không có kết quả và lỗi. Department bị khóa cho tới khi chọn Company; đổi Company sẽ xóa Department cũ và tải lại danh sách.
4. Registration API nhận email, mật khẩu, `company_id`, `department_id`; backend tải lại documents, xác thực tồn tại và quan hệ Department–Company rồi mới tạo User/Recruiter. Không tin object hay IDs chưa xác minh từ client.
5. Registration lỗi giữa chừng không tự xóa hoặc gắn tài khoản vào Company/Department khác; trả mã tham chiếu để operator đối soát. Chỉ bật feature flag sau khi có kiểm thử luồng ghi trên DB cô lập.

## Giới hạn dữ liệu hiện tại

- Company schema có `name`, `industry`, `website?`, `address?`; không có mã số thuế. Vì vậy MVP tìm theo tên, không yêu cầu mã số thuế.
- Company names có thể trùng; hiển thị `industry` để người dùng chọn đúng. Nếu vẫn không phân biệt được, không cho tự chọn ngẫu nhiên.
- Chưa có API Company search hoặc Department-by-Company; cần bổ sung hai API trên. Không có Company phù hợp nghĩa là hiện chưa hỗ trợ đăng ký với Company đó; quản trị viên cần bổ sung dữ liệu ngoài form.
- Dữ liệu audit trước đó có khoảng 50 Company và 150 Department. Có thể bắt đầu bằng truy vấn giới hạn cho dataset MVP; nếu quy mô tăng, thêm index theo query workload trong task riêng.

## Tiêu chí nghiệm thu

- Company suggestions xuất hiện khi nhập từ hai ký tự; kết quả hiển thị tên và lĩnh vực.
- Chọn Company chỉ tải Department của Company đó; đổi Company xóa Department đã chọn trước.
- Không tìm thấy Company thì hiện thông báo chưa hỗ trợ, không gửi request đăng ký.
- Backend từ chối Company/Department không tồn tại hoặc Department không thuộc Company đã chọn.
- Không thể giả mạo role/status/IDs/references bằng request body.
- Form đăng ký không có trường Job; các trường Job được nhập ở bước tạo Job.
- Kiểm thử persistence chỉ dùng database cô lập, không ghi `recruitment_db`.

**Trạng thái quyết định:** Nhóm đã thống nhất phạm vi đăng ký Recruiter tối thiểu và việc bổ sung Job fields sau khi đăng ký. Luồng chọn Company/Department hiện tại là kế hoạch triển khai cụ thể theo dữ liệu có sẵn; Company mới và xác minh pháp nhân nằm ngoài MVP.

## Trạng thái triển khai source

- Đã thêm API tìm Company theo tên và tải Department theo Company; chỉ trả DTO allowlist.
- Form Recruiter đã dùng autocomplete và dropdown Department; không còn nhập/tạo mới Company hoặc Department.
- Backend đăng ký xác minh lại hai references, tạo User ở trạng thái `RESET_REQUIRED`, tạo Recruiter rồi mới kích hoạt User. Company/Department không bị ghi.
- Company/Department lookup và kiểm tra liên kết đọc từ `COUCHDB_DATABASE` (mặc định `recruitment_db`); User/Recruiter ghi vào `AUTH_COUCHDB_DATABASE`. Luồng này không ghi vào `COUCHDB_DATABASE`.
- TV2 Job/Application scope hiện đọc Recruiter/Company/Department cùng database; trước khi Recruiter đăng ký mới dùng được các chức năng Job, TV2 cần xác nhận cách đọc Company/Department từ directory database hoặc triển khai trên một database tích hợp phù hợp. Không được copy/ghi tổ chức vào `recruitment_db` để né khác biệt này.
- Backend/frontend feature flags vẫn mặc định `false`. Tra cứu Company/Department dùng `COUCHDB_DATABASE`; User/Recruiter ghi vào `AUTH_COUCHDB_DATABASE`. Chưa bật đăng ký công khai cho tới khi cấu hình hai database và xác nhận TV2 Job/Application đọc được quan hệ Recruiter–Company–Department theo cách triển khai này.
