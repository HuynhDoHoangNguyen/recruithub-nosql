# RecruiHub NoSQL — TV1 Auth & Recruiter Registration UI/UX

**Ngày:** 2026-10-24
**Phạm vi:** UI đăng ký/đăng nhập, lựa chọn Candidate/Recruiter và tổng quan đường đi tới khu vực Recruiter/Job.
**Trạng thái:** UI Auth hoàn tất; Recruiter signup được kiểm tra qua API trên DB demo; Job management còn vướng cách phân chia database.

## Tổng quan nhanh

UI Login/Register được làm mới theo bố cục Auth trong `docs/Job-Application-Portal-Frontend`, nhưng giữ React routes, AuthContext, API client và nghiệp vụ RecruiHub. Register hiển thị hai role cards. Recruiter card luôn có mặt; khi `VITE_RECRUITER_REGISTRATION_ENABLED` tắt, card bị khóa và nêu trạng thái. Khi bật, form cho phép tìm Company có sẵn, chọn Department của Company đó và gửi đăng ký.

Không thêm Company, Department hoặc Job trong form đăng ký. Job được tạo sau khi đăng nhập trong khu vực Recruiter.

## Vòng đời đăng ký và đăng nhập

1. **Mở Register và chọn loại tài khoản.** Candidate tiếp tục dùng các trường, validation và API Candidate hiện có. Recruiter chỉ chọn được khi feature flag UI bật.
2. **Điền thông tin Recruiter.** Nhập email/mật khẩu, tìm Company từ hai ký tự, chọn kết quả có sẵn và chọn Department được tải theo Company. Khi đổi Company, Department cũ bị xóa. Không tìm thấy Company/Department thì form hướng dẫn liên hệ quản trị viên và không gửi đăng ký.
3. **Gửi đăng ký Recruiter.** Frontend chỉ gửi `email`, `password`, `company_id`, `department_id`. Backend tải lại Company/Department, xác minh tồn tại và quan hệ Company–Department, sau đó tạo User role `RECRUITER` cùng Recruiter document. User chỉ được kích hoạt sau khi tạo liên kết thành công. Không tạo/ghi Company hoặc Department.
4. **Xử lý lỗi ghi một phần.** User và Recruiter là hai document writes, không phải transaction CouchDB. Nếu ghi hoặc kích hoạt thất bại, API trả lỗi `REGISTRATION_INCOMPLETE` kèm mã tham chiếu; không tự retry hoặc xóa bù.
5. **Đăng nhập.** Người dùng gửi email/mật khẩu. Backend xác thực User hiện hành, kiểm tra trạng thái và Recruiter relationship khi áp dụng, rồi trả access token và User DTO an toàn. Frontend giữ token trong memory, gọi `/auth/me` để xác minh và điều hướng theo role server trả về.
6. **Đi tới khu vực Recruiter.** Role `RECRUITER` được điều hướng vào Recruiter dashboard; Candidate và Admin đi tới khu vực tương ứng. Role guard phía frontend phục vụ điều hướng, quyền thực tế vẫn do backend xác minh.
7. **Tạo Job sau đăng ký.** TV2 Job API lấy Recruiter/Company/Department scope từ dữ liệu phía server. Form đăng ký không nhận Job title, mô tả, kỹ năng hoặc hạn tuyển.

## Thay đổi UI

- Dùng chung `AuthLayout` cho Login/Register: logo, heading/subtitle, card, giới hạn chiều rộng và nền sáng.
- Dùng role cards có selected/focus/disabled states, icon và nội dung mô tả; radio inputs hỗ trợ bàn phím.
- Chuẩn hóa input cao 48px, label, focus ring, nút submit và error/loading states.
- Thêm nút hiện/ẩn mật khẩu cho Login, Candidate Register và Recruiter Register.
- Recruiter Company autocomplete hỗ trợ loading/results/empty/error; có thể chọn gợi ý bằng Arrow Up/Down, Enter hoặc chuột. Department chỉ mở sau khi chọn Company và tải xong.
- Không thay đổi AuthContext, JWT lifecycle, API contract, route protection, role redirect, Candidate payload hoặc Recruiter backend contract.

## Kiểm thử và kết quả

| Kiểm tra | Kết quả |
|---|---|
| Frontend Vitest | **PASS 55/55** |
| Frontend Node tests | **PASS 4/4** |
| Frontend production build | **PASS** |
| Frontend lint | **PASS**, 0 lỗi; 2 cảnh báo React import cũ tại `App.jsx` và `Landing.jsx` |
| `git diff --check` | **PASS**, chỉ có cảnh báo chuẩn LF→CRLF |
| Browser visual/responsive review | Chưa xác minh do môi trường không có browser khả dụng |

API flow Recruiter đăng ký → duplicate registration → đăng nhập → `/auth/me` đã được chạy trên `recruithub_auth_demo`. Đăng ký thành công, email trùng trả 409, đăng nhập và `/auth/me` xác nhận role `RECRUITER`. Department không thuộc Company đã chọn bị từ chối 400 `ORGANIZATION_NOT_SUPPORTED` trước khi ghi.

Các thao tác ghi E2E chỉ dùng database demo cô lập: số document tăng từ 41 lên 43. `recruitment_db` giữ nguyên 25.750 documents. Không lưu thông tin đăng nhập test trong report.

## Điểm tích hợp Job còn mở

Trong layout hiện tại, Company/Department được tra cứu từ `COUCHDB_DATABASE`, còn User/Recruiter được lưu trong `AUTH_COUCHDB_DATABASE`. TV2 Job/Application scope đang tải Recruiter, Company và Department từ cùng database. Vì vậy API `GET /api/v1/recruiter/jobs` với Recruiter mới trả 404 `NOT_FOUND`: Company/Department được chọn không có trong auth database. Chưa thể xem toàn bộ vòng đời Job sau signup là đã tích hợp thành công.

TV1/TV2 cần thống nhất cách Job/Application đọc Company/Department từ directory database hoặc chọn cấu hình database tích hợp phù hợp. Không copy/ghi tổ chức vào `recruitment_db` để né khác biệt. Feature flags mặc định vẫn `false`; lượt E2E dùng cờ bật theo process riêng.

## File chính

- `frontend/src/components/auth/AuthLayout.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/components/auth/RecruiterRegistrationFields.jsx`
- `frontend/src/utils/recruiterRegistration.js`
- `frontend/tests/auth/auth-ui.test.jsx`
- `frontend/tests/auth/recruiter-registration-preview.test.jsx`

Chi tiết phối hợp scope Recruiter/Job nằm trong [TV1–TV2 Recruiter Scope Contract Draft](../../shared/TV1_TV2_RECRUITER_SCOPE_CONTRACT_DRAFT.md) và báo cáo tổng hợp [TV2](../TV2/RP-TV2-consolidated.md).
