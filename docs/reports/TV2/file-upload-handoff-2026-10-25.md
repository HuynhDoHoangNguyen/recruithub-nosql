# Bàn giao tải CV, logo và ảnh đại diện

Ngày: **25/10/2026**. HEAD nền `9e48dc7`. Giữ các sửa đổi và việc tổ chức lại tài liệu đang có; không commit/push/chuyển nhánh.

## Chức năng đã hoàn thiện

- **Form ứng tuyển:** chọn hoặc kéo thả CV từ máy; hỗ trợ `.doc`, `.docx`, `.pdf` **dưới 5 MB**. Có tiến độ tải, tên/kích thước, trạng thái lỗi, thay/bỏ file. Có thể chọn **Dùng CV từ hồ sơ**. CV văn bản được giữ để tương thích; phải có file hoặc nội dung CV, không gửi đơn trống.
- **Hồ sơ Candidate:** lưu CV đính kèm và ảnh đại diện từ máy, xem trước ảnh, tải CV đã lưu, thay/bỏ lựa chọn. Bấm Lưu hồ sơ để ghi liên kết bằng If-Match. Chỉ đổi file không buộc sửa các thông tin nghề nghiệp còn thiếu trong dữ liệu cũ.
- **Hồ sơ công ty:** ô nhập URL logo đã được thay bằng tải ảnh từ máy và xem trước. Logo hiển thị trên danh sách/chi tiết tin sau khi lưu. Dữ liệu URL cũ vẫn đọc được, giao diện không yêu cầu nhập URL nữa.
- **Ảnh:** JPG/JPEG/PNG/WEBP dưới 5 MB, tối đa 8192 px mỗi chiều và 40 megapixel. Khi chưa có hoặc ảnh lỗi, dùng chữ viết tắt.
- **Xem hồ sơ ứng tuyển:** Candidate và Recruiter có quyền được tải file thật. Mỗi lần nộp có file riêng trong lịch sử; thay CV hồ sơ không thay file đã gửi.
- Form có khung bo góc, viền nét đứt, icon, trạng thái tải/lỗi/thành công, nút khóa khi đang gửi file và phần xác nhận ứng tuyển thuận tiện khi cuộn. Có giao diện mobile.

Frontend/backend cùng dùng **size < 5 × 1024 × 1024 bytes**; bằng ngưỡng bị từ chối. Backend kiểm tra cả chữ ký/khung PDF, Word, ZIP DOCX và ảnh, không chỉ tên đuôi. File rỗng, giả đuôi, SVG và Office container không phù hợp bị chặn trước khi ghi. Không thực thi hoặc giải nén nội dung Office.

## Sử dụng

1. Candidate → **Hồ Sơ & CV** → chọn CV/ảnh → **Lưu hồ sơ**.
2. Mở tin đang nhận hồ sơ → **Ứng tuyển ngay** → chọn file mới hoặc CV từ hồ sơ → xác nhận.
3. Recruiter → **Hồ Sơ Doanh Nghiệp → Thông tin công ty** → **Tải logo công ty từ máy tính** → **Lưu thay đổi**.
4. Recruiter → Xem ứng viên → Xem CV và xử lý → **Tải CV**; mở từng lần nộp trong lịch sử để tải CV cũ.

Không cần dependency hoặc thư mục uploads mới. File nằm trong CouchDB private hiện đang cấu hình và còn sau khi khởi động lại ứng dụng.

## Thiết kế dữ liệu và quyền

File là **CouchDB attachment** trong document runtime `uploaded_asset` có UUID, chủ sở hữu, mục đích, tên file, MIME xác minh, kích thước, SHA-256. Không lưu binary trong Git hoặc JSON Candidate/Application. Chỉ ghi database private `AUTH_COUCHDB_DATABASE`, không ghi snapshot `recruitment_db`.

Candidate có optional `resume_file` và `avatar`; Company có optional `logo_asset`; `Application.submission.resume_file` giữ metadata/tham chiếu bất biến. Các document cũ vẫn hợp lệ. Reapply lưu metadata file trong từng attempt, giữ ID cặp, revision và request key; retry không thêm lần nộp.

CV/ảnh Candidate yêu cầu Bearer token. Chủ file được đọc; Recruiter chỉ đọc CV gắn với Application của Job thuộc scope của mình, gồm CV của các lần cũ. CV chỉ lưu trong hồ sơ chưa nộp không tự chia sẻ. Khách và tài khoản ngoài scope bị chặn. Logo là ảnh công khai; endpoint logo không đọc CV. File được kiểm tra size/hash trước khi trả, có nosniff; CV trả attachment/private/no-store.

Bỏ file ở hồ sơ/form gỡ liên kết, không xóa attachment có thể đang được Application tham chiếu. File đã upload nhưng hủy form có thể còn trong kho; hiện chưa có tác vụ dọn file không được tham chiếu. Đợt này bổ sung đính kèm/xem/tải, chưa bổ sung trích văn bản PDF/Word để chấm điểm tự động.

| API | Hợp đồng |
|---|---|
| POST `/api/v1/uploads/:kind` | resume/avatar/company-logo; body binary, Content-Type application/octet-stream, X-File-Name mã hóa URL; kiểm tra vai trò/mục đích |
| GET `/api/v1/uploads/:id/content` | File riêng tư theo quyền, cần token |
| GET `/api/v1/media/company-logos/:id` | Chỉ ảnh purpose company-logo |
| Candidate profile PATCH | Thêm resume_file_id/avatar_asset_id hoặc null để bỏ; If-Match |
| Company PATCH | Thêm logo_asset_id hoặc null; expected_rev |
| Application POST | submission.resume_file_id và/hoặc resume_text; server lấy metadata, không tin metadata file do client tự khai |

## File chính

- Backend mới: `schemas/upload.schema.js`, `utils/upload-validation.js`, `repositories/asset.repository.js`, `services/upload.service.js`, `routes/upload.routes.js`; wiring tại `app.js`.
- Mở rộng schema/DTO/service của Candidate, Company, Application; Candidate profile route truyền kho file private vào service.
- Frontend mới: `api/assetApi.js`, `components/uploads/{FileUpload,PrivateAssetImage,DownloadAssetButton}.jsx`, `components/uploads/fileValidation.js`.
- Tích hợp trong Profile, RecruiterProfile, ApplyModal, ApplicantDetailModal, JobDetails, Candidate Dashboard, ApplicationAttempts, AccountHeader.
- Regression: `backend/tests/recruitment/uploads.test.js`, `backend/tests/helpers/upload-fixtures.js`, `frontend/tests/uploads.test.jsx`, các selector/form tests liên quan.

## Kết quả kiểm chứng mới

| Kiểm tra | Kết quả |
|---|---|
| Backend phân hệ + Foundation | **104/104 PASS** |
| Full backend npm test | **334 tests: 312 PASS, 22 FAIL** |
| Frontend npm test | **98/98 Vitest + 7/7 Node PASS** |
| Lint | **0 lỗi**, 1 cảnh báo React import chưa dùng có sẵn tại App.jsx |
| Build | **PASS**, cảnh báo bundle >500 kB |
| Git diff check | **PASS** |
| Chrome / Identity / CouchDB thật | **PASS**, localhost:5173, có mobile, không pageerror |

22 lỗi full backend vẫn ở dataset/ETL/release có sẵn: checksum users.jsonl, release lịch sử và pyarrow. Không sửa snapshot hoặc import lại để làm xanh.

Kiểm thử bao gồm: file sai đuôi/nội dung giả/rỗng, DOC/DOCX/PDF, sát dưới/bằng/vượt ngưỡng, quyền theo Candidate–Recruiter–Job, purpose logo/avatar, revision conflict, integrity mismatch, CV mỗi attempt và file-only profile update.

Trình duyệt thật đã chọn file qua input: lưu CV/ảnh rồi reload/đăng nhập lại, nộp DOCX không nhập text, rút/nộp lại bằng PDF lưu sẵn; Recruiter tải đúng cả hai và so SHA-256. JPEG/WEBP/PNG gửi thật, logo xuất hiện trên card, khách tải CV bị chặn 401. Database lịch sử giữ nguyên doc_count/update_seq. Lựa chọn file hồ sơ/logo trước kiểm thử đã được khôi phục; tin thử được ẩn, CV/history thử vẫn giữ.

Kết quả: [results.json](../../file-upload-verification/results.json). Script: [verify-local-file-uploads.cjs](../../../scripts/ui/verify-local-file-uploads.cjs).

Ảnh: [Form ứng tuyển](../../file-upload-verification/apply-file-upload.png), [Hồ sơ Candidate](../../file-upload-verification/candidate-profile-files.png), [Mobile](../../file-upload-verification/candidate-upload-mobile.png), [Tải logo](../../file-upload-verification/company-logo-upload.png), [Recruiter tải CV từng lần](../../file-upload-verification/recruiter-downloads-attempts.png), [Logo trên tin](../../file-upload-verification/uploaded-logo-job-card.png).

Commit đề xuất:

```text
feat(uploads): support private CV attachments and profile image uploads

- Validate PDF/DOC/DOCX and raster images strictly below 5 MiB.
- Store immutable CouchDB attachments and authorize scoped downloads.
- Add Candidate CV/avatar and Company logo forms with previews.
- Preserve CV files across profile replacements and application attempts.
- Add boundary, permission, integrity and real-browser regressions.
```

Chưa commit/push.
