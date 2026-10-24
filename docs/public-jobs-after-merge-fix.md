# Sửa dữ liệu Public Jobs không hiển thị sau merge

Kiểm chứng: **25/10/2026**, branch `feature/recruiter-management-application-lifecycle`, HEAD tham chiếu `875986a`. Không commit/push/reset/checkout, không import hoặc chỉnh business documents.

## Nguyên nhân và bản sửa

Dữ liệu không bị xóa. Sau merge, `createApp()` dùng `getAuthDatabaseConfig()` cho cả GET Public Jobs. Guard mới yêu cầu `AUTH_COUCHDB_DATABASE` riêng và từ chối `recruitment_db`/giá trị chưa cấu hình. Vì thế Landing/Jobs nhận 503 `AUTH_DATABASE_CONFIGURATION_ERROR` trong khi database health vẫn 200.

Đã sửa wiring trong `backend/src/app.js` và `backend/src/routes/job.routes.js`:

| Nhóm API | Nguồn dữ liệu / quyền |
|---|---|
| `GET /api/v1/jobs`, `/jobs/all`, `/jobs/:id` | `COUCHDB_DATABASE` theo cấu hình dataset hiện có, mặc định `recruitment_db`; facade chỉ có `get`, `find`, `scanPublicJobs` |
| Auth và Job/Application có tài khoản, thao tác ghi | Giữ repository/database riêng theo `AUTH_COUCHDB_DATABASE`, xác thực principal và scope hiện có |

Public catalog dùng `JobService` hiện có: giữ OPEN-only, newest-first theo created_at/_id, company_name, literal search/filter, validation và cursor. GET public không còn phụ thuộc cấu hình Auth. Facade nguồn public không cung cấp put/profile/initialize hoặc khả năng ghi dữ liệu.

Không sửa core Auth, không bật đăng ký Recruiter, không sửa `.env`, không dùng mock hoặc đổi `/api/v1` tùy tiện. Ảnh diff frontend không phải nguyên nhân hiện tại: client root `/api` cộng service `/v1/...` đã đúng URL và đang nhận JSON 503 từ backend.

## Bằng chứng live mới

[Kết quả JSON không mock](public-jobs-after-merge/results.json), [Landing](public-jobs-after-merge/landing.png), [Jobs](public-jobs-after-merge/jobs.png), [Detail](public-jobs-after-merge/detail.png), [Mobile](public-jobs-after-merge/jobs-mobile.png).

- Database `recruitment_db`: **25.761 documents**, gồm **25.750 business documents + 11 design docs**.
- Job: **2.500**, trong đó **200 OPEN, 2.300 DRAFT**, CLOSED = 0.
- Cả 200 OPEN thiếu published_at vẫn được API trả đúng.
- API qua 4 trang × 50: **200 ID khác nhau**, không trùng/bỏ sót; has_more đúng ở trang cuối.
- Landing, Jobs, Detail: hiển thị dữ liệu và đọc lại sau reload thành công trên `http://localhost:5173`.
- Tìm kiếm `python`: API 200 và trình duyệt hiển thị kết quả thật.
- Tablet/mobile không overflow; không có browser/runtime/API errors trong các trang public kiểm tra.
- **doc_count và update_seq trước/sau không đổi**: không có mutation trên database trong lần kiểm chứng này.

Browser verification: `node scripts/ui/verify-public-jobs-after-merge.cjs`; dùng Chrome và Playwright có sẵn ở OS temp, không intercept request hoặc giả lập phiên đăng nhập.

## Kiểm thử

- Foundation + Recruitment: **79/79 PASS**.
- Regression mới `backend/tests/recruitment/public-database-wiring.test.js`: CouchDB HTTP giả lập kiểm tra đúng tên database public, list/alias/search/detail đều hoạt động khi thiếu Auth config; yêu cầu ghi với JWT hợp lệ vẫn bị guard Auth chặn, không chạm nguồn public.
- Full backend `npm test`: **309 tests, 287 PASS, 22 FAIL**. 22 lỗi vẫn thuộc dataset/release/checksum/pyarrow có trước, không thay snapshot/manifests để làm xanh.
- Không thay frontend production code trong lượt sửa này. Giao diện đang chạy được kiểm chứng trực tiếp bằng Chrome với API/CouchDB thật.

## Giới hạn còn lại

Đây là khôi phục nguồn đọc tin công khai. Các workflow private vẫn cần cấu hình và dữ liệu Auth/Job/Application phù hợp. Chưa có cơ chế đồng bộ hai database; một Job chỉ có trong public dataset không tự được sao chép vào database Auth cho Apply. Không tuyên bố đã giải quyết toàn bộ tích hợp dữ liệu/Identity hoặc nghiệm thu private UC.

Không chạy lại import. Trên tab đang mở, bấm **Thử lại** hoặc tải lại trang ở **http://localhost:5173** để thay trạng thái lỗi cũ bằng dữ liệu đã đọc được.
