# TV1 UC07 — Job Detail

**Ngày:** 2026-10-25  
**Phạm vi:** Trang công khai `/jobs/:id`, endpoint `GET /api/v1/jobs/:id` và bàn giao luồng Apply hiện có. Không thay đổi schema, Job lifecycle, dữ liệu, index, database hoặc workflow Job/Application của TV2.

## 1. Khám phá schema và dữ liệu

Đọc `jobDocumentSchema`, `companyDocumentSchema`, API Job/Application hiện hành và CouchDB `recruitment_db` bằng các request GET. Quét dải ID `job:` theo các batch có giới hạn, không tải các document ngoài tập Job. Không thực hiện lệnh ghi.

### Job field matrix

| Field | Kiểu / bắt buộc | Public | Hiển thị / xử lý |
|---|---|---|---|
| `_id` | string, required; dạng `job:cms:J_######` hoặc `job:<id>` | Có trong DTO detail | Dùng làm định danh route; không cần phô raw ID trên UI. |
| `type` | literal `job`, required | Không | Chỉ xác thực document. |
| `title` | string không rỗng, required | Có | Tiêu đề trang. |
| `industry` | string không rỗng, required | Có | Header và tóm tắt. |
| `description` | string không rỗng, required | Có | Nội dung xuống dòng; React escape mặc định. |
| `responsibilities` | mảng string, required | Có | Mục trách nhiệm; ẩn section khi rỗng. |
| `required_skills` | mảng string, required, tối thiểu một phần tử | Có | Chip kỹ năng bắt buộc. |
| `optional_skills` | mảng string, required; có thể rỗng | Có | Chip ưu tiên; ẩn section khi rỗng. |
| `seniority` | enum `JUNIOR`, `MID`, `SENIOR`, required | Có | Cấp độ ở header và summary. |
| `status` | enum `DRAFT`, `OPEN`, `CLOSED`, required | Chỉ tin `OPEN` | API ẩn `DRAFT`/`CLOSED` bằng 404. |
| `deadline` | ISO datetime, optional theo schema; bắt buộc với Job `OPEN` | Có | Hiển thị hạn nộp; CTA tắt nếu đã hết hạn. |
| `requirements` | object required; `general[]`, `experience`, `education`, `project` | Có | Yêu cầu chung và chuyên môn; trạng thái `UNAVAILABLE` được ẩn. |
| `created_at`, `updated_at` | ISO datetime, required | DTO công khai hiện có | Giữ tương thích; không dùng làm hạn nộp. |
| `published_at` | ISO datetime, optional | DTO công khai hiện có | Không cần trình bày trên trang. |
| `source_job_id` | string, optional | Không | Không nằm trong public DTO. |
| `company_id`, `department_id`, `recruiter_id` | string reference, required | Không | Company được resolve server-side; IDs không trả ra. |
| `_rev` | CouchDB revision, optional | Không | Bị loại khỏi DTO. |
| `provenance` | object required | Không | Bị loại khỏi DTO. |

`experience`, `education`, `project` có status riêng; giá trị điều kiện chỉ xuất hiện khi status là `REQUIRED`. UI không dựng địa điểm, lương, phúc lợi, loại hình công việc, hình thức làm việc, số lượng tuyển hoặc thông tin liên hệ Recruiter vì không có trường tương ứng trong Job schema.

### Kết quả đọc CouchDB

- `recruitment_db`: `doc_count=25.750`; dải Job có 2.500 documents. Tất cả Job trong dải xác thực thành công bằng strict Job schema.
- Status tại thời điểm kiểm tra: `OPEN=200`, `DRAFT=2.300`, `CLOSED=0`.
- Cả 2.500 Job có Company reference resolve được; OPEN Job đều có deadline.
- Company schema có `name`, `industry`, `website?`, `address?`; mẫu đọc có website hợp lệ, address không hiện diện. Company address không được xem là Job location.
- Không cần đọc Department cho detail công khai. Một Company GET theo lần mở detail; danh sách UC06 không lookup Company theo từng Job.
- Không sửa/ghi `recruitment_db`, tạo index hoặc thay đổi dữ liệu.

## 2. Company relationship

Job trỏ tới Company bằng `company_id`. Endpoint đọc Company theo ID, xác thực type, `_id` khớp reference và strict `companyDocumentSchema`, sau đó chỉ trả `{name, industry, website?}`. Website chỉ được đưa ra khi URL dùng HTTP/HTTPS. `address` không đưa ra DTO công khai để tránh bị hiểu nhầm là Job location. Nếu reference thiếu hoặc Company không hợp lệ, detail vẫn trả Job với `company: null`; lỗi hạ tầng khác vẫn được trả lỗi.

Department không cần thiết cho thông tin công khai trang detail. Job cards UC06 tiếp tục không gọi Company API theo từng card.

## 3. Quy tắc public và API

- Tái sử dụng `GET /api/v1/jobs/:id`; không tạo Apply endpoint mới.
- API chỉ trả Job có `status === OPEN`. `DRAFT`, `CLOSED` và ID không tồn tại trả `404 NOT_FOUND`; params sai định dạng trả `400 VALIDATION_ERROR`.
- Job document không hợp lệ trả `409 INVALID_STORED_DOCUMENT`; Company thiếu/invalid được biểu diễn `company: null`.
- Public Job DTO giữ allowlist hiện hữu và bổ sung `company` an toàn cùng `company_name` tương thích ngược. Không trả `_rev`, provenance, recruiter/department/company IDs hay raw Company document.
- Detail vẫn xem được Job `OPEN` đã qua deadline; UI hiển thị “Đã hết hạn” và disable Apply. Không sửa lifecycle/status trong DB.

## 4. Giao diện chi tiết

- Breadcrumb, header title/company/status và metadata ngành nghề/cấp độ/deadline.
- Desktop tối đa 1200px, hai cột: nội dung chính và sidebar summary/company/apply; mobile một cột, không sticky CTA che nội dung.
- Nội dung gồm mô tả, trách nhiệm, yêu cầu chung, kỹ năng bắt buộc/ưu tiên và yêu cầu chuyên môn có dữ liệu.
- Sidebar có summary, hạn nộp, Apply CTA và Company info nếu API có. Không render section rỗng; không thêm salary/location giả.
- Loading skeleton, lỗi kết nối có retry, trạng thái 404/unavailable, Company thiếu và tin fixture dev có thông báo rõ.
- Nội dung Job là text React escaped, không dùng `dangerouslySetInnerHTML`. Website chỉ nhận HTTP/HTTPS và mở tab an toàn.

## 5. Application handoff

- Guest xem Job OPEN; CTA Login truyền intended path hiện tại qua router state. Sau login, helper chỉ cho Candidate trở lại Job detail ID hợp lệ, từ chối external/open redirect và role khác.
- Candidate dùng `applicationApi.mine`, `ApplyModal`, `applicationApi.apply`, timeline và withdraw hiện hữu. Không nhân đôi API hoặc giả lập thành công.
- Recruiter/Admin không có CTA Apply. CTA Candidate bị disable khi deadline đã qua.
- Chế độ fixture development thông báo đây là dữ liệu minh họa và không gửi Apply.

## 6. Files

- Cập nhật `backend/src/services/job.service.js`: chỉ công khai OPEN, resolve Company an toàn, tạo DTO allowlist.
- Cập nhật `backend/tests/recruitment/job-application-api.test.js`: OPEN detail, CLOSED/DRAFT/missing/invalid IDs, missing Company và regression khi đóng Job.
- Thiết kế lại `frontend/src/pages/Jobs/JobDetails.jsx` theo template hai cột, responsive, safe text và trạng thái Apply.
- Cập nhật `frontend/src/services/publicJobsModel.js` để giữ `requirements` khi chuẩn hóa fixture/API Job.
- Cập nhật `frontend/src/utils/authNavigation.js`: chỉ Candidate được trở về Job detail hợp lệ sau login.
- Thêm `frontend/tests/public-jobs/job-details.test.jsx`; cập nhật điều hướng đăng nhập và các selector UC06 cũ để khớp UI `/jobs` đã tinh chỉnh.

## 7. Kiểm thử

- Backend `node --test tests/recruitment/*.test.js`: **PASS 46/46**.
- Frontend `npm.cmd test`: **PASS 70/70 Vitest + 7/7 Node tests**.
- Frontend `npm.cmd run lint`: **PASS**, 0 lỗi; 2 cảnh báo React import cũ tại `App.jsx` và `Landing.jsx`.
- Frontend `npm.cmd run build`: **PASS**; bundler có cảnh báo chunk JS lớn hơn 500 kB.
- `git diff --check`: **PASS**, chỉ advisory LF→CRLF.
- Backend API tests dùng fixture in-memory; Frontend tests dùng mock API. Không có test ghi CouchDB.
- Không chạy browser E2E; người dùng tự mở `/jobs/:id` để đánh giá giao diện.

## 8. Hướng dẫn tự kiểm thử

1. Chạy API và frontend theo cấu hình development hiện có, mở `/jobs` rồi chọn một tin đang mở.
2. Kiểm tra Company, ngành nghề/cấp độ, mô tả nhiều dòng, trách nhiệm và kỹ năng; mục thiếu dữ liệu phải được ẩn.
3. Mở trực tiếp ID không tồn tại hoặc Job `DRAFT`/`CLOSED`: trang báo tin không khả dụng, không lộ nội dung nội bộ.
4. Khi chưa đăng nhập, chọn “Đăng nhập để ứng tuyển”; sau login Candidate quay lại đúng Job detail. Recruiter/Admin không được nộp.
5. Kiểm tra Apply Modal và hồ sơ đã nộp bằng luồng Application hiện có; tin quá deadline không cho mở Apply.

**Trạng thái:** UC07 Job Detail triển khai trên endpoint hiện có. Không thay schema/dataset/index; `recruitment_db` chỉ đọc. Lương, địa điểm và benefits phụ thuộc thay đổi hợp đồng/schema riêng do TV2 sở hữu.
