# Bàn giao RecruiHub — Catalog & Application Lifecycle

Ngày: **25/10/2026**. HEAD: **`9e48dc7`**, nhánh `feature/recruiter-management-application-lifecycle`. Giữ công việc có sẵn sau merge; không checkout/merge/reset/commit/push.

## 1. Kết quả theo prompt

Đã triển khai schema → API → CouchDB → React cho địa điểm/hình thức làm việc, nộp lại sau rút và mở lại tin. Đã đổi thương hiệu RecruiHub, dựng lại Job Details theo ảnh, bổ sung tìm kiếm trang chủ và nút xử lý ứng viên. Identity/CouchDB thật đang hoạt động; nhận định “chưa có Identity” trong bản bàn giao cũ là thông tin lịch sử.

Ứng dụng thật: **http://localhost:5173**. Backend: **http://localhost:5000**. Cổng 5174 là template tham khảo.

| Yêu cầu | Hiện trạng |
|---|---|
| Brand | Logo R/RecruiHub, bỏ slogan cũ và HOT tĩnh; trang chủ, title, mô tả và favicon thống nhất |
| Bộ lọc | Sidebar trắng, radio hình thức/cấp bậc, dropdown địa điểm/ngành, checkbox kỹ năng, cuộn, mở rộng/thu gọn, số đã chọn, Xóa lọc |
| Dữ liệu mới | Optional `location`/`work_mode`, tạo/sửa/lưu/đọc/lọc thật; dữ liệu cũ vẫn hợp lệ |
| Trang chủ | Gợi ý kỹ năng từ metadata, chuột/bàn phím/Escape, chọn địa điểm, chuyển query sang Jobs |
| Job Details | Breadcrumb, dải màu, nhận diện công ty, CTA gradient, bốn thẻ tóm tắt, hai cột và việc cùng ngành; mobile một cột |
| Application | Đủ 7 nhãn Việt, ngày nộp, CV, timeline, xác nhận rút đơn; nộp lại giữ lịch sử từng lần |
| Recruiter | Mở lại CLOSED bằng deadline hợp lệ; Duyệt hồ sơ/Từ chối và các hành động tiếp theo theo server |
| Kiểm chứng | Regression + Chrome desktop/mobile với Identity/CouchDB thật, không mock fallback |

Không bịa lương, benefits, quy mô công ty, Verified/HOT. Trường thiếu hiển thị **Chưa cập nhật**. Tin lịch sử là tin tham khảo, không nộp chéo sang database private.

## 2. Quy tắc cũ → mới

| Quy tắc | Cũ | Mới |
|---|---|---|
| Sau WITHDRAWN | Chặn vĩnh viễn | Cho lần mới nếu OPEN, còn hạn, profile/scope hợp lệ |
| Sau REJECTED/HIRED | Chặn | Giữ nguyên |
| Application ID | Một ID Candidate–Job | Giữ ID, lưu nhiều lần trong cùng document |
| History | Một pipeline | Mỗi lần độc lập; không append WITHDRAWN→APPLIED |
| Retry | Nhận lỗi trùng | Cùng request đã ghi trả document, không tạo lần nữa |
| CLOSED→OPEN | Bị chặn | Cho chủ sở hữu mở lại qua status command; kiểm tra đầy đủ trước khi ghi |
| Sửa CLOSED | Bị chặn | Vẫn chặn; luồng mở chỉ nhận status/revision/deadline |
| Thống kê | Đếm document | Giữ số cặp hiện hành, thêm tổng lần nộp/lần lịch sử riêng |

Đã cập nhật [business rules](recruitment-business-rules.md), mục 3 và bảng chính sách. Terminal semantics vẫn giữ **trong mỗi lần nộp**; không thêm ACCEPTED.

## 3. Thiết kế dữ liệu, API và tương thích

### Các lần ứng tuyển

Top-level giữ `current_stage`, `applied_at`, `updated_at`, `submission`, `stage_history` cho lần hiện tại. Bổ sung `attempt_number`, UUID `request_id` và `previous_attempts`. Mỗi snapshot cũ giữ số lần, request key nếu có, CV/thư, thời điểm, stage/history và recruiter_note nếu có. Document cũ không có trường mới tương đương lần 1.

Schema kiểm tra số lần liên tục, khóa không lặp, từng history hợp lệ, thời gian nối tiếp. DTO Candidate ẩn actor ID, ghi chú nội bộ/evidence trong cả history hiện tại và cũ. Recruiter đọc CV từng lần theo scope sở hữu.

Lần đầu vẫn tương thích client cũ; UI mới luôn gửi UUID. Nộp lại cần UUID mới và `expected_rev` của WITHDRAWN. CAS trên một document quyết định một request thắng, request khác nhận 409 và tải lại. Không retry bằng cách ghi đè history.

Retry cùng khóa và CV đã ghi trả document hiện tại, kể cả sau rút/đóng tin. Khóa thuộc snapshot cũ nhận `REQUEST_ALREADY_PROCESSED`; cùng khóa nhưng CV khác nhận `IDEMPOTENCY_CONFLICT`. Không có thêm attempt do mất response.

Interview có optional `application_attempt`, cũ mặc định 1. Lần đầu giữ ID cũ; lần sau dùng `interview:<digest>:attempt:<attempt>:<round>`. Status, scope và OFFER chỉ dùng Interview của lần hiện tại. Test kiểm tra cả việc loại Interview cũ và cho OFFER khi Interview mới hợp lệ. Server trả `offer_eligible`/`offer_blocker`; UI khóa Gửi đề nghị khi thiếu bằng chứng và giải thích điều kiện.

Không trả điểm cũ: hiện NOT_ANALYZED, hook phân tích nhận thêm số lần và submission mới. Dịch vụ/UI phân tích và lên lịch Interview của TV3 vẫn cần tích hợp; khóa freshness phải bao gồm attempt. Không tạo Interview giả để vượt OFFER.

### Job, metadata và filters

`location` dùng khóa cấu hình tại [job-catalog.constants.js](../backend/src/constants/job-catalog.constants.js), ví dụ VN-HN/VN-SG/VN-DN. `work_mode`: HYBRID/REMOTE/ONSITE. Form và search cùng lấy khóa/nhãn từ **GET `/api/v1/jobs/metadata`**. Trường optional; khi sửa, null xóa giá trị. Không rewrite Job lịch sử hoặc suy dữ liệu từ tên công ty.

Metadata lấy kỹ năng/ngành chuẩn hóa từ **toàn bộ OPEN** trong catalog live và lịch sử. Keyword, industry, seniority, location, work mode, skills kết hợp **AND**; nhiều skills cũng AND, tối đa 8. UI đưa kỹ năng đang chọn lên đầu, đổi bộ lọc reset cursor, query giữ lựa chọn khi reload/back, Xóa lọc xóa query/UI. Chỉ hiển thị số tin trên trang, không gọi đó là tổng toàn hệ thống.

Không lọc: Mango **public_jobs_created_v2**, đã xác minh `_explain` trên CouchDB thật. Có bộ lọc: `_all_docs` prefix Job, batch 100 document, xét hết tập dữ liệu; **không phải indexed full-text search**. Quy mô lớn hơn cần thiết kế search/index riêng. Hash cursor ràng buộc toàn bộ filters của cả hai nguồn.

Mở lại tin dùng **PATCH `/api/v1/jobs/:id/status`** với `{status:'OPEN', expected_rev, deadline?}`. Kiểm tra ownership, tổ chức, schema toàn bộ và deadline tương lai trước khi put. Chỉ nhận deadline khi status OPEN. Không sửa Application do đóng/mở tin. 409 tải lại và yêu cầu kiểm tra trạng thái mới.

Thống kê dùng reduce views theo khóa Candidate/Job thuộc Recruiter. `total_applications` đếm mỗi cặp ở trạng thái mới nhất một lần; `total_attempts` đếm tổng lần nộp; `historical_attempts` đếm phần đã lưu lịch sử. Không tải toàn bộ CV để đếm.

## 4. File chính

| Nhóm | File |
|---|---|
| Schemas | `backend/src/schemas/{job,application,interview,job-application-request}.schema.js` |
| Catalog/API | `backend/src/constants/job-catalog.constants.js`, `services/{job,public-job-catalog,job-application-scope}.service.js`, `controllers/job.controller.js`, `routes/job.routes.js`, `app.js` |
| Lifecycle | `backend/src/services/application.service.js`, `utils/interview-validation.utils.js`, `repositories/job-application.repository.js` |
| Public UI | `frontend/src/pages/Landing.jsx`, `pages/Jobs/{JobList,JobDetails}.jsx`, `features/jobs/components/{HomeJobSearch,JobFilterSidebar,PublicJobCard}.jsx`, `features/jobs/useJobMetadata.js` |
| Form/mở tin | `features/jobs/components/{JobForm,ReopenJobModal}.jsx`, `features/jobs/jobFormModel.js`, `pages/Dashboard/RecruiterDashboard.jsx` |
| Hồ sơ/duyệt | `features/applications/components/{ApplyModal,ApplicationAttempts,ApplicantDetailModal,WithdrawButton}.jsx`, `applicationPresentation.js`, `pages/Jobs/JobApplicantsPage.jsx`, `pages/Dashboard/JobSeekerDashboard.jsx` |
| API/brand | `frontend/src/api/jobApplicationApi.js`, `services/{publicJobsApi,publicJobsModel}.js`, `components/Navbar.jsx`, `frontend/index.html`, `frontend/public/recruihub.svg` |
| Regression | `backend/tests/recruitment/attempts-and-reopen.test.js`, `frontend/tests/catalog-lifecycle.test.jsx`, cập nhật tests cũ theo hợp đồng mới |
| Browser thật | [verify-catalog-lifecycle.cjs](../scripts/ui/verify-catalog-lifecycle.cjs), [results.json](catalog-lifecycle-verification/results.json) |

Các file tài khoản local, public catalog sau merge và kiểm chứng trước đó vẫn được giữ trong working tree.

## 5. Kiểm thử trên HEAD hiện tại

| Phép kiểm tra | Kết quả |
|---|---|
| Recruitment + Foundation | **91/91 PASS** |
| `cd backend; npm test` | **321: 299 PASS, 22 FAIL** |
| `cd frontend; npm test` | **83/83 Vitest + 7/7 Node PASS** |
| `npm run lint` frontend | **0 lỗi**, 1 cảnh báo React import chưa dùng có sẵn tại App.jsx |
| `npm run build` frontend | **PASS**, cảnh báo bundle JS >500 kB |
| `git diff --check` | **PASS** |
| Chrome localhost:5173 | **PASS**, Identity/CouchDB thật, desktop 1440px/mobile 390px, không pageerror |

22 lỗi full backend ở dataset/ETL/import/release: checksum `users.jsonl` không khớp manifest, release lịch sử không có trên máy và thiếu `pyarrow` cho extraction. Không sửa snapshot/manifests/import lại để làm xanh. **Không tuyên bố full suite đã PASS.**

P1: validation/response references vẫn trước khi ghi, regression response/scope PASS. P2: giữ giây/millisecond deadline nếu ô ngày không đổi, gồm cả mở lại tin. P3: backend `npm test` vẫn chứa `tests/foundation/*.test.js`.

### Đã chạy thật

- Login Candidate/Recruiter; không token giả hoặc localStorage bypass.
- Tạo tin địa điểm/hình thức, truy vấn kết hợp AND và đọc DTO; kiểm tra index thực tế.
- Apply → rút → CLOSED chặn nộp lại → deadline hết hạn chặn mở lại → mở hợp lệ; Application giữ nguyên.
- Hai request nộp lại đồng thời **201/409**; replay request đã ghi và replay sau rút không thêm attempt.
- UI nộp CV → APPLIED → xác nhận rút → nộp lại CV mới; đọc ba lịch sử cũ; reload/đăng nhập lại giữ dữ liệu.
- Recruiter đóng/mở qua modal; Duyệt hồ sơ → SCREENING; Từ chối kèm lý do → REJECTED.
- Form tạo nháp VN-HN/HYBRID; mở sửa khôi phục lựa chọn và lưu VN-SG/REMOTE xuống CouchDB.
- Trang chủ chọn skill bằng bàn phím/địa điểm → Jobs; radio/checkbox/dropdown, reload/back/reset; Job cũ thiếu dữ liệu hiển thị Chưa cập nhật.

`recruitment_db` giữ nguyên `doc_count` và `update_seq`: **25.750 business + 11 design = 25.761 documents**. Chỉ ghi dữ liệu thử/view/index trong `recruithub_auth_local_test`. Không sửa snapshot/template. Dữ liệu thử được giữ để xem; hồ sơ test cuối cố ý kết thúc REJECTED để kiểm tra từ chối.

## 6. Đối chiếu ảnh

| Đối chiếu tham khảo | Ảnh ứng dụng thật |
|---|---|
| Sidebar trắng, radio/checkbox/dropdown | [Jobs desktop](catalog-lifecycle-verification/jobs-filters-desktop.png), [Jobs mobile](catalog-lifecycle-verification/jobs-filters-mobile.png) |
| Job Details dải màu, summary, hai cột | [Desktop](catalog-lifecycle-verification/job-details-before-reapply.png), [Mobile](catalog-lifecycle-verification/job-details-mobile.png) |
| Thiếu field mới không tự gán | [Job lịch sử](catalog-lifecycle-verification/historical-missing-fields.png) |
| Tìm kiếm / tạo tin | [Trang chủ](catalog-lifecycle-verification/home-search.png), [Form thật](catalog-lifecycle-verification/job-form-canonical-options.png) |
| Lịch sử / xử lý | [Candidate](catalog-lifecycle-verification/candidate-applied-history.png), [Recruiter](catalog-lifecycle-verification/recruiter-screening-actions.png), [Mở lại](catalog-lifecycle-verification/reopen-job.png) |

Bố cục theo ảnh, nội dung theo schema/API thật; không sao chép salary/benefits minh họa.

## 7. Tự kiểm tra và tích hợp

1. Mở http://localhost:5173, Recruiter `recruiter.test@example.invalid`. Mật khẩu ở `LOCAL_TEST_RECRUITER_PASSWORD` trong [`.env` gốc](../.env), được Git ignore.
2. Đăng tin có địa điểm/hình thức và deadline tương lai. Candidate `candidate.test@example.invalid`, mật khẩu tại `LOCAL_TEST_CANDIDATE_PASSWORD` cùng file `.env`.
3. Chọn tin nhãn “Đang nhận hồ sơ”; thử nộp, rút, nộp lại. Xem CV/lịch sử ở Job Details hoặc Dashboard.
4. Recruiter → Bảng Điều Khiển → Xem ứng viên → Duyệt/Từ chối. Đóng rồi Mở lại để thử deadline.

JWT đang ở bộ nhớ nên reload có thể cần login lại; dữ liệu vẫn lưu CouchDB. Sang database private khác, chạy `cd backend; npm run db:job-application` cập nhật view/index trước khi dùng thống kê mới; không trỏ vào `recruitment_db`.

## 8. Commit đề xuất

```text
feat(recruitment): complete RecruiHub catalog and application attempts

- Add canonical location/work mode, metadata-driven AND filters and home skill search.
- Refresh branding and responsive Job Details using real API data.
- Support withdrawn reapplications with archived attempts, CAS and idempotent retries.
- Add validated job reopen and visible Recruiter pipeline actions.
- Isolate Interview evidence per attempt and separate current/historical counts.
- Add regression and real Identity/CouchDB browser verification with handoff.

Validation: recruitment/Foundation 91/91; frontend 83+7; lint/build/diff check pass.
Full backend: 299/321 pass; 22 dataset/ETL failures remain.
```

Chưa commit/push. Không xem đây là nghiệm thu mọi module TV1/TV3 ngoài prompt.
