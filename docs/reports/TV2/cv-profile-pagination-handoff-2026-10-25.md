# Bàn giao: CV, hồ sơ ứng viên và phân trang Dashboard

Ngày: 25/10/2026. Thực hiện tiếp trên working tree hiện tại, giữ các thay đổi và tổ chức tài liệu đã có. Không commit hoặc chuyển nhánh.

## Các yêu cầu đã triển khai

| Phần | Kết quả |
|---|---|
| Upload PDF | Bỏ điều kiện header phải ở byte 0/EOF trong 1 KB cuối. Chấp nhận BOM/preamble trong 1.024 byte đầu và padding sau EOF; kiểm tra thêm cấu trúc PDF/page tree trước khi lưu. Giữ nguyên byte gốc và giới hạn **dưới 5 MiB**. |
| Xem CV | Thêm **Xem CV** làm thao tác chính trong hồ sơ, hồ sơ đã nộp, modal Recruiter và các lần ứng tuyển cũ; **Tải xuống** là thao tác riêng. |
| PDF | Hiển thị trong khung PDF của trình duyệt, có cuộn trang, zoom và công cụ trình duyệt hỗ trợ. Không tự tải file về máy khi bấm Xem CV. |
| DOC/DOCX | Xem nội dung văn bản ngay trong trang. Bản xem không giữ hình ảnh/bố cục Word; vẫn tải được file gốc. Không gửi file cho dịch vụ Google/Office bên ngoài. |
| Hồ sơ ứng viên | Header có avatar, thông tin thật, tiến độ hoàn thiện; mặc định chế độ xem; bấm **Chỉnh sửa hồ sơ** để sửa. Có **Lưu hồ sơ**, **Lưu thay đổi**, **Hủy thay đổi**. |
| Điều hướng hồ sơ | Đủ 5 mục: thông tin chung; kỹ năng/ngoại ngữ; kinh nghiệm/dự án; học vấn; CV đính kèm. Chuyển mục giữ bản sửa chưa lưu. |
| Ảnh đại diện | Khi chỉnh sửa, nút **Thay ảnh đại diện** nằm bên dưới ảnh. Hỗ trợ JPG/PNG/WEBP dưới 5 MiB. |
| Thông tin bổ sung | Phone/location và ngoại ngữ tùy chọn được validate/lưu qua API Candidate. Không tạo dữ liệu minh họa từ ảnh mẫu. |
| Dashboard ứng viên | Card có logo, địa điểm/lương nếu có, trạng thái, thanh tiến trình, nhóm nút, CV/lịch sử thu gọn. Chỉ dựng nội dung chi tiết khi người dùng mở. |
| Phân trang | **Ứng viên: 5 hồ sơ/trang. Nhà tuyển dụng: 5 tin/trang.** API nhận `limit=5`; dùng bookmark của backend, không lấy hết rồi cắt tại frontend. |
| Bộ lọc | Đổi stage/status sẽ quay về trang 1. Thống kê vẫn tính toàn bộ dữ liệu thuộc tài khoản, không dùng số lượng trên một trang. |
| Viền/nút | Card có viền xanh, dải màu, bóng nhẹ; nút có icon, gradient/viền, trạng thái hover/focus/disabled; phân trang có nút trước/sau và số trang hiện tại. |

## File và hợp đồng chính

- Backend: `src/utils/upload-validation.js`, `document-reader.js`, `document-worker.js`; `src/services/upload.service.js`; `src/routes/upload.routes.js`.
- API mới: `GET /api/v1/uploads/:id/preview` trả `{text, truncated}` cho Word, yêu cầu đăng nhập và cùng quyền truy cập với file gốc. PDF dùng endpoint nội dung đã có và Blob URL riêng trong trình duyệt. URL được hủy khi đóng khung xem.
- Parser chạy trong worker giới hạn 10 giây, 128 MB V8 heap; bản xem Word tối đa 500.000 ký tự. File hỏng không được trình bày như đã đọc thành công. Chỉ render text, không render HTML do tài liệu cung cấp.
- Candidate schema/PATCH bổ sung `profile.phone`, `profile.location`, `languages: [{name, proficiency?}]` tùy chọn. ETag/If-Match, kiểm tra owner, các collection cũ và scoring inputs được giữ nguyên.
- Backend thêm dependencies `pdf-lib`, `word-extractor` và lockfile. Tài liệu thư viện: [PDFDocument load](https://pdf-lib.js.org/docs/api/interfaces/loadoptions), [Word Extractor](https://github.com/morungos/node-word-extractor).
- Frontend: `src/components/uploads/ViewAssetButton.jsx`, `DownloadAssetButton.jsx`, `FileUpload.jsx`; `src/features/profile/ProfileSections.jsx`; `src/pages/Profile.jsx`; `src/features/applications/components/CandidateApplicationCard.jsx`, `ApplicationUI.jsx`; hai trang `src/pages/Dashboard/*Dashboard.jsx` liên quan; `dashboardStyles.js`.

## Kết quả kiểm chứng

- Backend liên quan: **112/112 pass**, gồm foundation, recruitment, Candidate Profile. Có regression PDF BOM/padding/object streams; signature giả bị chặn; quyền xem Word; metadata contact/languages và xung đột revision.
- Frontend: **103 Vitest + 7 Node tests pass**. Bao gồm xem PDF không tự tải, giải phóng Blob URL, Word text được escape, view/edit/tab/cancel và phân trang trước/sau/reset bộ lọc ở cả hai vai trò.
- `npm run lint`: 0 errors; còn 1 warning cũ ở `App.jsx` do import React không sử dụng.
- `npm run build`: pass; còn cảnh báo bundle chính lớn hơn 500 KB.
- Toàn bộ `backend/npm test`: **315 pass / 337 tests, 22 fail** ở nhóm dữ liệu/ETL có sẵn: thiếu release/pyarrow, checksum và số lượng snapshot không khớp. Không sửa snapshot để làm xanh test.
- Chạy thêm toàn bộ `tests/auth-foundation`: **36/43 pass**; 7 lỗi trong `recruiter-registration.test.js` vẫn kỳ vọng đăng ký tạo company/department mới, trong khi service hiện tại yêu cầu `company_id`/`department_id` đã tồn tại. Nhóm Candidate Profile trong đó pass 5/5; không sửa nghiệp vụ đăng ký Recruiter trong task này.
- Chrome thật, Identity/API/CouchDB thật: PDF từ hồ sơ upload được, bản xem PDF/Word phía Recruiter hoạt động; nút download giữ nguyên SHA-256; kiểm tra ảnh nằm trên nút thay ảnh và hồ sơ lưu thật; không có runtime error. Việc ghi thử chỉ ở database cô lập, khôi phục các lựa chọn hồ sơ và xóa mềm tin kiểm chứng.
- Phân trang Chrome dùng dữ liệu hiện có, chỉ đọc: trang 1 và trang 2 đều có 5 mục cho cả hai vai trò; không trùng giữa trang, lùi trang khôi phục danh sách, bộ lọc bỏ bookmark, mobile 390px không tràn ngang.
- Database chính giữ nguyên **25.761 documents (25.750 nghiệp vụ + 11 design)** và `update_seq` trước/sau kiểm chứng.

Kết quả và ảnh:

- [CV/hồ sơ: JSON kiểm chứng](../../cv-preview-profile-verification/results.json), [hồ sơ chung](../../cv-preview-profile-verification/candidate-profile-general.png), [PDF Recruiter](../../cv-preview-profile-verification/recruiter-pdf-preview.png), [Word Recruiter](../../cv-preview-profile-verification/recruiter-word-preview.png).
- [Phân trang: JSON kiểm chứng](../../dashboard-pagination-verification/results.json), [ứng viên trang 1](../../dashboard-pagination-verification/candidate-page-1.png), [trang 2](../../dashboard-pagination-verification/candidate-page-2.png), [Recruiter trang 1](../../dashboard-pagination-verification/recruiter-page-1.png), [trang 2](../../dashboard-pagination-verification/recruiter-page-2.png).

## Cách kiểm tra trên máy

1. Nếu vừa nhận code ở máy khác, chạy `npm ci` trong `backend` để có dependencies mới. Chạy backend bằng `npm run dev`, frontend bằng `npm run dev` như cấu hình hiện tại.
2. Vào `http://localhost:5173`, đăng nhập tài khoản Candidate local được bàn giao trước đó.
3. Hồ Sơ & CV → Chỉnh sửa hồ sơ → thay ảnh dưới avatar; mở CV Đính Kèm để tải PDF/DOC/DOCX → Lưu hồ sơ → Xem CV.
4. Bảng Điều Khiển Candidate → mỗi trang tối đa 5 hồ sơ → mở chi tiết để xem CV và lịch sử. Thử Trang sau/Trang trước và lọc stage.
5. Đăng nhập Recruiter → Bảng Điều Khiển → mỗi trang tối đa 5 tin → Xem ứng viên → Xem CV và xử lý → Xem CV. Chỉ tải file khi bấm Tải xuống.
6. Nếu cần chạy lại kiểm chứng: `node scripts/ui/verify-cv-preview-profile.cjs` (ghi test có khôi phục trong database cô lập), `node scripts/ui/verify-dashboard-pagination.cjs` (chỉ đọc). Scripts dùng credentials local trong `.env`, không ghi chúng ra báo cáo.

PDF của người dùng chưa được cung cấp trực tiếp; đã tái hiện và sửa nhóm PDF hợp lệ mà validator cũ từ chối. Nếu một file khác vẫn bị báo hỏng, cần kiểm tra cấu trúc file đó; không bỏ hoàn toàn validation.
