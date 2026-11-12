# Kiểm tra hồ sơ Candidate/Recruiter và sửa upload CV

**Ngày:** 2026-11-12 (Asia/Saigon)  
**Phạm vi:** luồng cập nhật hồ sơ Candidate và Recruiter, nơi lưu ảnh/CV, quyền truy cập file, upload PDF và xem trước PDF/Word.  
**Trạng thái:** Đã sửa xử lý lỗi worker và xác minh bằng kiểm thử cô lập; chưa upload file vào hồ sơ thật hoặc kiểm tra thao tác qua browser đã đăng nhập.

## 1. Luồng và nơi lưu file

- Upload dùng `POST /api/v1/uploads/:kind` với `kind` là `resume`, `avatar` hoặc `company-logo`; giới hạn dưới 5 MiB và kiểm tra chữ ký/nội dung file.
- Backend tạo document `type=uploaded_asset`, đính kèm binary bằng CouchDB `_attachments.content`, kèm chủ sở hữu, mục đích, MIME, kích thước và SHA-256. Asset repository dùng cấu hình Auth database (`AUTH_COUCHDB_DATABASE`, hoặc cấu hình fallback của Auth); binary không lưu trong Git hay thư mục upload.
- Hồ sơ Candidate lưu tham chiếu `resume_file` và `avatar`; Company lưu `logo_asset`. Upload file tạo attachment ngay, còn nút Lưu hồ sơ gắn tham chiếu asset vào hồ sơ bằng revision hiện hành.
- Gỡ file khỏi hồ sơ gỡ liên kết, không xóa attachment. Cách này giữ nguyên CV của các lần ứng tuyển trước; asset chưa còn tham chiếu có thể tồn tại trong CouchDB vì hiện không có tác vụ dọn orphan.
- Candidate có thể tải file của chính mình. Recruiter chỉ đọc CV/avatar khi file gắn với ứng viên trong Application thuộc Job của Recruiter. Company logo được đọc qua endpoint media công khai; endpoint logo không trả CV.
- Kiểm tra GET-only tại `127.0.0.1:5178/api/health/database` xác nhận runtime hiện trỏ `recruitment_db` (25.782 documents tại thời điểm kiểm tra). Route preview upload qua cùng proxy trả 401 khi không có token, chứng minh route tồn tại và đang yêu cầu xác thực. Không có POST upload hay ghi dữ liệu.

## 2. Hồ sơ hiện có

**Candidate:** có các mục thông tin chung, kỹ năng/ngoại ngữ, kinh nghiệm/dự án, học vấn và CV đính kèm. Có thể chỉnh thông tin nghề nghiệp, tải/gỡ/thay ảnh đại diện và CV. Cập nhật yêu cầu đúng `ETag`/revision; API chỉ nhận allowlist theo Candidate schema. Thay CV hồ sơ không sửa snapshot CV của Application đã nộp.

**Recruiter:** có thông tin liên hệ cá nhân và hồ sơ Company gồm tên, ngành, website, địa chỉ, mô tả và logo. Cập nhật dùng `expected_rev`. Recruiter hiện không có trường/luồng ảnh đại diện cá nhân; phần header dùng thông tin tài khoản/company logo hoặc chữ viết tắt. Department hiển thị từ quan hệ hiện có, không cho tự sửa trong form này.

## 3. Nguyên nhân và sửa lỗi

PDF upload được parse trong worker bằng `pdf-lib`; Word preview dùng `word-extractor`. Môi trường backend local thiếu package `pdf-lib` dù dependency đã có trong `backend/package.json` và lockfile. Worker không khởi động được, khiến upload PDF thất bại; cùng worker đó cũng làm Word preview lỗi.

Đã cài lại dependency backend theo manifest vào `node_modules` cục bộ, không thay đổi `package.json` hoặc lockfile. Đồng thời sửa `document-reader.js`: nội dung PDF/Word lỗi vẫn trả lỗi nội dung tương ứng; worker không khởi tạo được, crash hoặc hết thời gian trả HTTP 503 `DOCUMENT_READER_UNAVAILABLE` với thông báo khởi động lại backend, thay vì báo nhầm file PDF không hợp lệ. Không log dữ liệu file.

PDF tiếp tục được lưu nguyên bytes sau khi parser xác nhận cấu trúc; xem trước dùng Blob URL có xác thực và thu hồi URL khi đóng. Word preview trả văn bản đã trích xuất, render bằng text node, không thực thi HTML trong tài liệu. Nếu trích xuất không khả dụng, nút tải file gốc vẫn có.

## 4. Kiểm tra

- Backend `tests/recruitment/uploads.test.js`, `tests/auth-foundation/candidate-profile.test.js`, `tests/recruitment/profile-validation.test.js`: **20/20 PASS**.
- Bao gồm PDF upload và đọc lại nguyên bytes, PDF hiện đại/BOM/padding, file giả/sai đuôi, giới hạn 5 MiB, quyền CV theo Candidate–Recruiter–Job, CV lịch sử, gắn/gỡ CV và avatar theo revision, Company logo, hash integrity, DOCX preview và trường hợp worker crash/thiếu runtime.
- Frontend `tests/uploads.test.jsx`, `tests/cv-preview-profile.test.jsx`, `tests/auth/candidate-profile-editor.test.jsx`: **17/17 PASS**. Các bài này kiểm tra upload component, PDF xem trong iframe bằng Blob, Word hiển thị như text, thông báo lỗi quyền, và editor Candidate.
- GET qua `http://127.0.0.1:5178`: `/api/health` **200**, `/api/health/database` **200** (`recruitment_db`, 25.782 documents), route upload preview không token **401** (đúng yêu cầu xác thực, route đi qua proxy). Không thực hiện POST upload hoặc cập nhật hồ sơ thật.
- Không ghi/xóa document, attachment, index hay view CouchDB trong lượt này. Không thực hiện E2E bằng tài khoản thật.

## 5. Cách thử lại

1. Dùng lại URL `http://127.0.0.1:5178`, đăng nhập Candidate và mở **Hồ sơ → CV đính kèm**.
2. Chọn PDF nhỏ hơn 5 MiB, chờ upload hoàn tất, lưu hồ sơ; tải lại trang để xác nhận tên CV còn hiển thị.
3. Chọn **Xem CV** để xem PDF; thử DOCX để xem nội dung trích xuất hoặc tải file gốc.
4. Nếu backend trả `DOCUMENT_READER_UNAVAILABLE`, khởi động lại backend trên cổng 5011 để worker nạp các dependency hiện có, giữ Vite proxy cổng 5178.
5. Với Recruiter, mở **Hồ sơ doanh nghiệp → Thông tin công ty**, tải logo và lưu; thông tin cá nhân lưu ở tab **Thông tin chung**.

## 6. Giới hạn còn lại

- Chưa kiểm tra upload với file người dùng trên CouchDB thật để không tạo dữ liệu mới trong hồ sơ thật.
- Chưa chạy browser E2E có đăng nhập; component và API integration test dùng dữ liệu fixture/in-memory.
- Orphan attachment chưa được dọn; gỡ liên kết không xóa file nhằm bảo toàn lịch sử ứng tuyển.
- Ảnh đại diện Recruiter cá nhân chưa nằm trong schema/form hiện tại; chỉ Company logo được hỗ trợ.
