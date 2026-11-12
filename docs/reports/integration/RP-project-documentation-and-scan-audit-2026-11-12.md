# Audit tài liệu và quét dự án RecruiHub

**Ngày:** 12/11/2026  
**Phạm vi:** kiểm kê repo, rà soát toàn bộ Markdown, đối chiếu tài liệu chủ chốt với manifests/source, kiểm tra link nội bộ và chạy bộ test/build/lint sẵn có.  
**Kết luận:** phát hiện và sửa các mô tả sai hiện trạng trong README, Architecture, hướng dẫn agent và đặc tả UC01/UC25. Các liên kết nội bộ còn tồn tại đều hợp lệ; một số ảnh/JSON lịch sử không có trong checkout nên đã đổi thành ghi chú vắng mặt, không dựng lại evidence.

## Phạm vi và kiểm tra

- Repo có **486 file được Git theo dõi**; quét toàn bộ **54 file Markdown** trong trạng thái cuối.
- Quét các liên kết nội bộ trong toàn bộ Markdown. Đã sửa link trỏ sai thư mục khi đích tồn tại; **47 tham chiếu** tới evidence không còn trong checkout được chuyển thành ghi chú ghi rõ tên tệp bị thiếu.
- Kiểm tra cuối: **208 liên kết nội bộ, 0 đường dẫn hỏng**, 15 liên kết ngoài, 0 lỗi giải mã UTF-8 và không còn câu tiếng Việt bị thay ký tự bằng `?` trong phần văn bản.
- Đối chiếu `backend/package.json`, `frontend/package.json`, document type constants, AuthService, routes/repositories, schema và UC spec. Không kết nối hoặc ghi CouchDB.

## Sai sót tài liệu đã sửa

1. **README:** bỏ khẳng định 246 test PASS và stack Jest/Supertest; sửa theo Node test runner, Vitest, Zod 4 và CouchDB HTTP client hiện có. Sửa taxonomy thành 9 document type trong source (`user`, `candidate`, `recruiter`, `company`, `department`, `job`, `application`, `interview`, `resume_analysis`); số liệu 25.750 được ghi là baseline dataset cũ. Cập nhật phát biểu sai rằng Auth chưa tích hợp, và sửa đường dẫn `file:///`.
2. **UC01:** đổi form Recruiter từ nhập tên công ty sang chọn Company/Department có sẵn, kiểm tra Department thuộc Company; ghi rõ tạo hồ sơ rồi kích hoạt. Contract hiện không yêu cầu mã mời, OTP, xác minh email hoặc duyệt Admin. Sửa trường phân loại document thành `type`.
3. **UC25:** bỏ tổng document 25.750 hard-code. Thêm đối chiếu rõ rằng implementation hiện có thống kê User/Candidate và Job; chưa có view tổng quát đếm đủ mọi loại như đặc tả.
4. **ARCHITECTURE.md:** phân biệt thiết kế ban đầu với trạng thái triển khai, sửa `doc_type` thành `type`, sửa CouchDB client và đánh dấu view/index trong sơ đồ là thiết kế cần xác minh trên DB thật.
5. **AGENTS.md và audit database ngày 22/10:** chuyển link tuyệt đối `file:///` sang link tương đối, sửa đường dẫn `repositories/`, và đánh dấu dữ liệu/snapshot cũ để tránh đọc thành hiện trạng.
6. **Report TV1/TV2:** sửa các link có đích duy nhất hoặc thư mục xác minh đã di chuyển; thêm link tới báo cáo TV1 gọn trong README/consolidated cũ; sửa các tiêu đề bị mất dấu ở mục lục TV1/TV2. Các file thiếu được ghi rõ là evidence lịch sử không có trong checkout.

## Kết quả kiểm thử dự án

- **Backend `npm test`: 329/356 PASS, 26 FAIL, 1 SKIP.** Bộ test thoát mã lỗi. Các lỗi tập trung ở fixtures/release data thiếu hoặc checksum/count không khớp; một test CouchDB view kỳ vọng request không hợp lệ bị từ chối nhưng code không reject; một test database wiring nhận HTTP 400 thay vì 503. Không có thao tác CouchDB thật trong lệnh test này.
- **Frontend `npm test`: 122/137 PASS, 15 FAIL** trên 7 file test. Các nhóm lỗi gồm Admin user list, Public Job search, catalog lifecycle, post-merge Jobs, landing autocomplete, Recruiter enhancements và Import/Export modal. Do chuỗi script dừng khi Vitest fail, Node tests nối sau Vitest không chạy.
- **Frontend lint:** 0 lỗi, 4 cảnh báo unused import/state ở `App.jsx`, `AdminDashboard.jsx`, `vite.config.js`.
- **Frontend build:** PASS; Vite báo bundle JavaScript khoảng 638.37 kB, vượt ngưỡng advisory 500 kB.
- Browser E2E không được chạy trong lượt audit này; kết quả unit/component test không thay thế nghiệm thu browser.

## Còn lại

- Ảnh và JSON được nhắc trong một số report TV2 lịch sử không còn trong checkout. Báo cáo hiện đánh dấu vắng mặt; muốn khôi phục bằng chứng cần chạy lại các lượt browser tương ứng.
- Full backend/frontend suite chưa xanh. Cần phân loại lỗi data/release, test contract và selector/test runtime cũ; không tính các PASS riêng lẻ thành nghiệm thu toàn hệ thống.
- UC25 cần hoàn thiện hoặc thu hẹp đặc tả thống kê theo implementation đã được duyệt.
- Bản tổng hợp TV1 ngắn gọn: [RP-TV1-status-summary-2026-11-12.md](../TV1/RP-TV1-status-summary-2026-11-12.md). Báo cáo này không xóa hay thay đổi mã nguồn và dữ liệu CouchDB.
