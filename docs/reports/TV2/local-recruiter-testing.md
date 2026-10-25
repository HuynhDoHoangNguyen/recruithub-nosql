# Tài khoản Recruiter local để test đăng tuyển

Chuẩn bị và kiểm chứng ngày **25/10/2026**. Dùng Identity thật và CouchDB thật trên máy local, không đổi role giả trên UI.

## Đăng nhập ngay

1. Mở **http://localhost:5173/login**.
2. Email: **recruiter.test@example.invalid**.
3. Mở file **`.env` ở root dự án**, copy giá trị của **`LOCAL_TEST_RECRUITER_PASSWORD`** vào ô mật khẩu. Mật khẩu sinh ngẫu nhiên, chỉ lưu trong cấu hình local được Git ignore; không ghi vào source hoặc báo cáo.
4. Bấm **Đăng nhập** → **Bảng Điều Khiển** hoặc **Đăng Tin Tuyển Dụng** trên header.
5. Điền tiêu đề, ngành nghề, mô tả và kỹ năng. Chọn **Lưu nháp** hoặc **Đăng tuyển ngay**; nếu mở tuyển cần hạn nộp tương lai. Sau gửi, Dashboard đọc lại tin từ database.

Có thể mở thẳng **http://localhost:5173/recruiter/jobs/create**; hệ thống sẽ chuyển sang Login và quay lại form sau đăng nhập thành công.

**Tải lại trang sẽ yêu cầu đăng nhập lại** theo chính sách token memory-only của Auth hiện có. Tin đã tạo vẫn còn; đăng nhập lại để xem Dashboard. Không cần đổi localStorage hoặc dùng tài khoản admin của CouchDB.

## Những gì đã chuẩn bị

- Database riêng **`recruithub_auth_local_test`**, được gán vào `AUTH_COUCHDB_DATABASE` trong `.env` local.
- JWT secret ngẫu nhiên hợp lệ qua `JWT_ACCESS_SECRET`, không hardcode vào source.
- Một User mới `RECRUITER` / `ACTIVE`, mật khẩu hash Argon2id bằng cấu hình Auth hiện có.
- Recruiter profile có User → Company → Department hợp lệ. Hai document tổ chức tương ứng được sao chép sang database test để Job service tự kiểm tra scope; source tổ chức trong dataset không bị sửa.
- Index và reduce view Job/Application trong database test.
- Thông tin tài khoản local nằm ở `LOCAL_TEST_RECRUITER_EMAIL` và `LOCAL_TEST_RECRUITER_PASSWORD` trong `.env`.
- Giữ public Recruiter registration tắt; tài khoản này được provision riêng theo yêu cầu test, không mở đăng ký Recruiter đại trà.

Database `recruitment_db` lịch sử giữ nguyên doc_count/update_seq trong lúc setup; không kích hoạt tài khoản seeded và không thay mật khẩu tài khoản cũ.

## Đã kiểm chứng bằng luồng thật

[Kết quả browser](local-recruiter-verification/results.json), [Form sau đăng nhập](local-recruiter-verification/create-form.png), [Dashboard đọc lại tin OPEN](local-recruiter-verification/dashboard-open-readback.png).

- `POST /api/v1/auth/login`: 200, role RECRUITER.
- `GET /api/v1/auth/me`: 200, User được server xác minh.
- Context công ty/phòng ban, danh sách và stats Recruiter: 200.
- Chrome: protected route → form Login thật → form đăng tin, không intercept API hoặc tự cấp JWT demo.
- Tạo DRAFT qua UI → Dashboard đọc lại → sửa → đăng OPEN.
- Reload → đăng nhập lại → tin OPEN và nội dung đã sửa vẫn tồn tại.
- Nút Đăng Tin Tuyển Dụng trên header mở form đúng.
- Không có browser runtime errors trong các bước kiểm chứng.

Tin kiểm chứng được giữ trong database test để làm mẫu. Tài khoản mới chỉ thấy các tin thuộc scope của chính mình, không thấy 2.500 Job của Recruiter khác để lấp Dashboard.

**Cập nhật luồng Candidate:** [đã nối tin OPEN của môi trường test vào Public Jobs và kiểm chứng nộp CV thật](local-candidate-testing.md). Tin đang nhận hồ sơ được ưu tiên; tin lịch sử vẫn có nhãn tham khảo. Không sao chép dữ liệu giữa hai database. Interview và các bước sau chưa được nghiệm thu trong lượt chuẩn bị tài khoản này.

## Công cụ thiết lập

- `node scripts/database/provision-local-recruiter.mjs`: chỉ hỗ trợ CouchDB local và database riêng; không ghi vào dataset chính. Rerun không tạo lại/nâng quyền tài khoản đã tồn tại hoặc đổi mật khẩu; tài khoản không khớp sẽ yêu cầu operator xử lý.
- `node scripts/ui/verify-local-recruiter.cjs`: test trình duyệt thật, tạo một tin kiểm chứng mới trong database test mỗi lần chạy. Không chạy lặp chỉ để xem Dashboard.

Không cần chạy lại hai công cụ trên để đăng nhập sử dụng hằng ngày. Backend đã nạp lại `.env`; dùng server hiện có tại cổng 5000 và frontend 5173.
