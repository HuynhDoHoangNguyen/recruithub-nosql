# RecruiHub TV1 — Candidate Profile & Admin Dashboard UI Polish

## Mục tiêu

Sắp xếp lại trang Profile ứng viên và Admin Dashboard theo ảnh tham khảo: bố cục thẻ rõ ràng, khoảng cách gọn, đổ bóng nhẹ, responsive và giữ tông xanh hiện có.

## Thay đổi

- `frontend/src/pages/Profile.jsx`: chia hồ sơ thành các nhóm thông tin nghề nghiệp, kỹ năng, học vấn/kinh nghiệm/dự án; thêm thẻ tóm tắt hồ sơ, thanh mức độ hoàn thiện và thanh thao tác lưu cố định trên màn hình nhỏ.
- `frontend/src/pages/Dashboard/AdminDashboard.jsx`: làm rõ thẻ thống kê, bộ lọc, bảng User, badge vai trò/trạng thái và hộp chi tiết; thêm biểu đồ donut phân bổ vai trò và biểu đồ thanh so sánh trạng thái, lấy trực tiếp từ response thống kê; giữ thông báo trạng thái tài khoản Admin do operator quản lý.
- Giữ nguyên API Profile/Admin, kiểm tra quyền backend, cập nhật hồ sơ bằng `If-Match` và chính sách không cho thay đổi trạng thái tài khoản ADMIN. Không đổi schema, nghiệp vụ backend hoặc dữ liệu CouchDB.

## Kiểm tra

- Frontend production build sau khi thêm biểu đồ: **PASS**.
- Frontend lint: **0 errors, 16 warnings**; cảnh báo hiện có ở App, dashboard Recruiter/Job Seeker và Landing, không phát sinh từ hai trang vừa chỉnh.
- `git diff --check`: **PASS**; Git chỉ báo cảnh báo chuyển LF sang CRLF.
- Chưa thực hiện browser visual/responsive E2E trong lượt này.

## Trạng thái

**PARTIAL** — giao diện đã được cập nhật và build thành công; cần mở ứng dụng trong browser để xác nhận hình ảnh thực tế ở desktop, tablet và mobile.
