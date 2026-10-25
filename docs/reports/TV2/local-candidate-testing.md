# Tài khoản Candidate local để kiểm thử ứng tuyển

Đã thiết lập và kiểm chứng ngày **25/10/2026** bằng Identity thật và CouchDB local thật.

## Đăng nhập

- URL: **http://localhost:5173/login**.
- Email: **candidate.test@example.invalid**.
- Mật khẩu: lấy giá trị **`LOCAL_TEST_CANDIDATE_PASSWORD`** trong file **`.env` ở root dự án**. File này được Git ignore; mật khẩu không có trong source/báo cáo.
- Đăng nhập xong chọn **Hồ Sơ & CV**, **Bảng Điều Khiển**, hoặc **Việc Làm IT**.
- Token memory-only: reload cần đăng nhập lại. Hồ sơ và đơn đã nộp vẫn được giữ trong CouchDB.

## Tự thử nộp CV

Trong **Việc Làm IT**, chọn tin **“Tin để bạn tự thử nộp CV - JavaScript và CouchDB”**, có nhãn **Đang nhận hồ sơ**. Tin này đã được chuẩn bị OPEN và chưa có đơn của Candidate test.

1. Mở tin → **Nộp hồ sơ ứng tuyển**.
2. Nhập CV văn bản bắt buộc, thư giới thiệu tùy chọn → **Xác nhận nộp hồ sơ**.
3. Header **Bảng Điều Khiển** → mở chi tiết đơn, CV và lịch sử.
4. Có thể thử **Rút đơn ứng tuyển** rồi xác nhận. WITHDRAWN là kết thúc: không thể nộp lại cùng tin. Để thử lại từ đầu, đăng nhập Recruiter tạo một tin OPEN mới.

[Tin mới để tự thử](local-candidate-verification/fresh-test-job.json) ghi ID/URL cụ thể, không chứa mật khẩu. Tin cũ đã CLOSED được giữ nguyên, không tự mở lại.

## Đã kiểm chứng

[Kết quả browser](local-candidate-verification/results.json), [hồ sơ Candidate](local-candidate-verification/candidate-profile.png), [đơn và CV đã nộp](local-candidate-verification/candidate-submission.png), [Recruiter đọc CV](local-candidate-verification/recruiter-reads-candidate-cv.png).

- Tạo tài khoản Candidate qua `POST /api/v1/auth/register`, đăng nhập thật 200, role CANDIDATE, hồ sơ 200.
- Candidate không có quyền đăng tin của Recruiter.
- Header → Jobs → tin OPEN thực tế trong môi trường tích hợp → Apply với CV/cover letter.
- Reload → đăng nhập lại → CV và stage vẫn tồn tại.
- Recruiter đăng nhập riêng → xem ứng viên → đọc đúng CV Candidate vừa gửi.
- Đã nộp một đơn làm mẫu; chuẩn bị thêm một tin OPEN khác chưa nộp để người dùng tự test.
- Primary dataset giữ nguyên doc_count/update_seq khi chạy browser check; không kích hoạt hoặc sửa tài khoản seeded.

## Nối catalog để kiểm thử được toàn luồng

Trước đây, tin tuyển dụng test ở database riêng không xuất hiện trong Public Jobs. Đã nối danh sách/chi tiết qua `PublicJobCatalogService`:

- Ưu tiên tin OPEN từ database ứng dụng local (cùng nguồn ghi Job/Application) để Candidate nộp CV được.
- Giữ các Job lịch sử từ `recruitment_db`, gắn nhãn **Tin tham khảo từ bộ dữ liệu**. Những tin này không cho gửi đơn vào database khác.
- Phân trang nối hai nguồn, bookmark gắn với bộ lọc, không dùng số trên một trang làm tổng. Kiểm thử chuyển ranh giới nguồn và trang cuối đầy đủ.
- Public DTO chỉ trả thông tin Job được phép, thêm `catalog_source` và `application_available`; không đưa User/hash/CV riêng tư vào public catalog.
- Giữ riêng Auth và các thao tác ghi. Không clone 25.750 documents, không thay snapshot/checksum, không bỏ xác thực.

Tin lịch sử vẫn xem được, nhưng chỉ tin có nhãn **Đang nhận hồ sơ** được dùng để test nộp đơn trong môi trường này. Mỗi nguồn giữ thứ tự hiện có; tin đang nhận hồ sơ được ưu tiên trước nguồn tham khảo.

## Kiểm thử mã nguồn

- Foundation + Recruitment: **83/83 PASS**.
- Frontend: **75 Vitest + 7 Node tests PASS**; lint 0 errors, 1 warning; build PASS (cảnh báo bundle >500kB).
- Full backend: **313 tests, 291 PASS, 22 FAIL** dataset/ETL có trước, không sửa dữ liệu lịch sử để làm xanh.
- Regression mới cho cursor qua hai nguồn, ranh giới trang, nguồn historical-only khi chưa có Auth, filter mismatch, detail/source và lỗi database.
- UI regression: Apply của tin tham khảo bị vô hiệu hóa với giải thích rõ ràng.

Công cụ: `scripts/database/provision-local-candidate.mjs` (register thật; rerun chỉ xác minh tài khoản hiện có, không reset) và `scripts/ui/verify-local-candidate.cjs` (browser thật; phát sinh đơn kiểm thử). Không cần chạy lại để sử dụng tài khoản hằng ngày.
