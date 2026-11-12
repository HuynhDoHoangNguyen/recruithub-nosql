# Báo cáo tổng hợp tiến độ TV1

**Cập nhật:** 12/11/2026  
**Phạm vi:** Tóm lược các báo cáo tiến độ, UC và audit tích hợp liên quan TV1. Đây là file đầu mối để xem trạng thái; báo cáo gốc được giữ nguyên làm bằng chứng chi tiết.  
**Kết luận:** TV1 đã có source và kiểm thử mục tiêu cho phần lớn giao diện được giao, nhưng chưa đủ bằng chứng để nghiệm thu toàn bộ luồng nghiệp vụ bằng trình duyệt. Không có cơ sở đáng tin để công bố phần trăm hoàn thành chung.

## Đã triển khai

- **Đăng ký/đăng nhập (UC01–UC02):** Có UI và API; Recruiter chọn Company/Department có sẵn, đăng ký tự kích hoạt theo nghiệp vụ đã thống nhất. Contract hiện không yêu cầu mã mời, OTP, xác minh email hoặc duyệt Admin. Bộ test UC01 ghi nhận Backend Foundation 54/54, route/registration/lookup 15/15, frontend 23/23 PASS. Chưa đăng ký thật hoặc xác minh luồng qua browser.
- **Hồ sơ (UC03–UC04):** Có trang hồ sơ Candidate/Recruiter, cập nhật thông tin, ảnh và CV; PDF/Word preview có xử lý và test. Audit upload ghi Backend 20/20, frontend 17/17; UI hồ sơ mới 20 test PASS, build/lint PASS. Chưa xác minh upload file người dùng thật lên CouchDB và tải/mở lại trên browser.
- **Public Job (UC05–UC07):** Có danh sách, tìm kiếm/lọc, cursor pagination và chi tiết tin theo API; giao diện ẩn trường không có dữ liệu. Chưa chốt xác minh runtime cho metadata, DTO logo và chính sách CLOSED detail.
- **Recruiter Job và Import/Export (UC11–UC12, UC27–UC28):** Có dashboard, tạo/quản lý tin và giao diện CSV/JSON import/export với preview, lỗi theo dòng, lọc và giới hạn hiển thị preview. Test UC27/28 được báo cáo: backend unit 10/10, integration DB test 1/1, UI modal 2/2, dashboard/modal 4/4 PASS. Một smoke test trước đây đã ghi 1 Job DRAFT vào `recruitment_db` sau khi người dùng cho phép; không xóa Job đó. Những số liệu database trong báo cáo là snapshot tại thời điểm kiểm tra, không phải số hiện hành.
- **Admin (UC23–UC25):** Có UI quản lý tài khoản, thao tác trạng thái/reset và thống kê; từng có kiểm thử mục tiêu và kiểm tra runtime. Source có views User/Candidate và Job, nhưng chưa có view tổng quát đếm đủ các loại dữ liệu như đặc tả UC25; cần xác minh design views và phạm vi thống kê trước nghiệm thu.

## Chưa đủ bằng chứng / phụ thuộc

- Chưa có một lượt browser E2E đăng nhập bao phủ đăng ký → hồ sơ → đăng tin → ứng tuyển → xử lý hồ sơ.
- UC08–UC22 và UC26 thuộc luồng TV2/TV3; báo cáo TV1 không đủ bằng chứng để kết luận các UC này hoàn tất.
- UC27/28 đã có bằng chứng test tự động và DB test; giao diện qua browser với tài khoản Recruiter chưa được xác minh end-to-end.
- Các full suite trước đây chưa xanh; có lỗi legacy ở frontend/backend. Các kết quả test mục tiêu trong những báo cáo khác thời điểm không thay thế một lần chạy full suite đồng bộ.
- Cần xác minh lại FE–BE runtime, đăng ký Recruiter, upload/tải lại CV và ảnh, Job DRAFT → OPEN → public, Apply và Admin trên database test cô lập.

## Bằng chứng và an toàn dữ liệu

- Các con số test trong báo cáo này là kết quả của những lượt chạy riêng, không cộng thành một lần kiểm thử tổng thể.
- Đăng ký và upload thật chưa được thực hiện trong các lượt audit được tổng hợp ở đây. Smoke test UC27/28 trên database chính là ngoại lệ đã được ghi rõ ở báo cáo tích hợp; không suy rộng thành xác nhận cho các luồng khác.
- Không thực hiện thao tác CouchDB trong lần tổng hợp báo cáo này.

## Báo cáo đã được tổng hợp

- Tiến độ và thay đổi TV1: [RP-TV1-progress-2026-10-26.md](RP-TV1-progress-2026-10-26.md); các hồ sơ UC cũ: [RP-TV1-consolidated.md](RP-TV1-consolidated.md).
- Public Job: [UC06](RP-TV1-UC06-job-search-filter-pagination.md), [UC07](RP-TV1-UC07-job-detail.md), [handoff TV1–TV2](../integration/RP-TV1-TV2-job-portal-handover-audit.md), [live verification](../integration/RP-TV1-TV2-live-job-portal-verification.md).
- Đăng ký Recruiter: [UC01 audit](../integration/RP-UC01-recruiter-registration-organization-audit.md).
- Hồ sơ và upload: [Candidate/Recruiter profile upload audit](../integration/RP-candidate-recruiter-profile-upload-audit-2026-11-12.md).
- Import/Export: [UC27/UC28 report](../integration/RP-UC27-UC28-recruiter-job-import-export.md).
- Admin runtime: [TV1 admin follow-up](RP-TV1-admin-real-database-runtime-follow-up.md).

**Cách dùng:** Dùng báo cáo này để nắm tiến độ TV1; chỉ mở các báo cáo nguồn khi cần xem log, contract hoặc bằng chứng chi tiết. Không xem các trạng thái lịch sử là trạng thái runtime hiện tại.
