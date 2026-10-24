# Sửa Public Jobs và kiểm chứng dữ liệu thật

Hoàn tất kiểm tra ngày **25/10/2026, Asia/Saigon** (bắt đầu điều tra tối 24/10). Branch hiện tại: `feature/recruiter-management-application-lifecycle`; HEAD tham chiếu `1127fb5`. Giữ nguyên toàn bộ thay đổi frontend có trước lượt này. Không checkout/merge/reset/commit/push.

## 1. Kết luận

**Đã sửa nguyên nhân Public Jobs rỗng và hiển thị được dữ liệu CouchDB thật trên server người dùng `http://localhost:5173`. Chưa nghiệm thu toàn phân hệ private.**

Có hai vấn đề độc lập:

1. Database Backend thực sự sử dụng là `recruitment_db`, lúc đầu chỉ có **10 design documents, 0 Job**, chưa có dữ liệu nghiệp vụ. HTTP 200/items rỗng khi đó không chứng minh truy vấn đúng.
2. `publicList()` còn yêu cầu `published_at >= ''`. Release lịch sử có Job hợp lệ thiếu trường optional này. Sau khi phục hồi nguồn hợp lệ, đo được **200 Job OPEN, cả 200 thiếu published_at**: selector cũ trả 0, selector mới trả đủ 200 ID khác nhau.

Đây là kết quả live vừa đo, không dùng baseline 200 thay cho việc đếm. [Bằng chứng dữ liệu](live-job-verification/data-evidence.json), [kết quả browser không mock](live-job-verification/browser-results.json), [ảnh Jobs thật](live-job-verification/jobs-desktop.png).

## 2. Đếm trước/sau trên đúng database

| Đại lượng | Trước khôi phục | Sau khôi phục và rollout index |
|---|---:|---:|
| `doc_count` CouchDB, gồm design docs | 10 | 25.761 |
| Business documents | 0 | 25.750 |
| Job | 0 | 2.500 |
| OPEN | 0 | 200 |
| DRAFT | 0 | 2.300 |
| CLOSED | 0 | 0 |
| OPEN có `published_at` | 0 | 0 |
| OPEN không có `published_at` | 0 | 200 |
| OPEN quá deadline tại thời điểm đo | 0 | 0 |
| Selector cũ sau khi có release | — | 0 |
| API mới qua tất cả bookmark | — | 200; unique IDs = 200 |

Số business documents đã được verifier hiện có phân loại và đọc lại: 10.150 users, 10.000 candidates, 50 companies, 150 departments, 150 recruiters, 2.500 jobs, 1.200 applications, 350 interviews, 1.200 resume analyses. Tổng 25.750. Sau thêm index v2 có 11 design documents, nên `doc_count` là 25.761 chứ không phải 25.750.

## 3. Nguồn dữ liệu và thao tác thật đã thực hiện

Working copy JSONL trên Windows có byte checksum khác manifest do line ending; không sửa những file đó và không sửa manifest/checksum để bỏ qua validation.

Đã thêm `scripts/database/restore-verified-release.js`:

1. Đối chiếu manifest đang dùng với manifest Git HEAD.
2. Lấy **byte nguyên gốc Git blob** của 9 JSONL thuộc `DATA-03.4B_7fdd3b34c4636367` vào OS temp; không normalize/regenerate nội dung.
3. Cả 9 SHA-256 khớp manifest; JSON parse và record count từng file khớp. Đây là nguồn release đã tồn tại, không phải dữ liệu giả tạo để lấp giao diện.
4. Chạy dry-run importer hiện có, rồi kiểm tra lại database cục bộ chỉ chứa design docs trước `--apply`.
5. Importer hiện có nạp theo thứ tự phụ thuộc: **25.750 inserted, 0 skipped, 0 errors**. Không ghi đè business document hiện hữu; script `--apply` từ chối khi database đã có business docs. Importer cũng không blind overwrite document cạnh tranh.
6. Chạy `runCouchDbVerification()` với `releaseDir` ở temp và **reportsDir ở temp**: PASS; không thiếu/thừa ID, đối chiếu nội dung 135 mẫu ở đủ 9 loại, cross-document referential integrity PASS.

Không tự kích hoạt users hoặc gán mật khẩu. Không xóa/drop database, design doc cũ hay snapshot. Không chạy ETL/regenerate. Các thao tác ghi thật trong lượt này là **khôi phục release hợp lệ và tạo index**; không có thao tác Recruiter/Candidate qua Identity thật.

Script khôi phục mặc định chỉ dry-run; `--apply` chỉ dành cho local `recruitment_db` không có business docs. Database hiện đã có dữ liệu, **không cần chạy lại import để khởi động ứng dụng**.

## 4. Truy vấn, index và pagination

Truy vấn cũ:

```js
{ type: 'job', status: 'OPEN', published_at: { $gte: '' } }
```

Truy vấn mới:

```js
{
  type: 'job', status: 'OPEN',
  created_at: { $gte: '' }, _id: { $gte: '' }
}
// sort: type DESC, status DESC, created_at DESC, _id DESC
// use_index: public_jobs_created_v2
```

`created_at` và `_id` là trường bắt buộc của schema; `published_at` optional nên không tham gia membership/sort. `_id` phân định thứ tự duy nhất khi trùng created_at. Không bổ sung published_at vào Job lịch sử. Job mới có published_at vẫn xuất hiện. Không lấy toàn corpus về frontend để sort/filter, không ghép dữ liệu của hai query khác nhau.

Rollout bằng `npm run db:job-application`: tạo `public_jobs_created_v2` trên `type/status/created_at/_id`, giữ index cũ trong database. `_explain` chọn đúng `public_jobs_created_v2`. Một lần đo cold query trả 50 kết quả, examined 51 keys/51 documents, 1503.912 ms; đây là phép đo cụ thể có thể bao gồm build/warm index, **không phải benchmark tổng quát**.

Pagination thật qua API server 5173 với limit 50 có page sizes `[50,50,50,50,0]`; tổng/unique IDs đều 200, không mất/lặp trong dataset đứng yên đã kiểm tra. `has_more` của adapter hiện bảo thủ khi page đầy nên có thể có một trang rỗng cuối. Không tuyên bố snapshot pagination khi Job đang bị thêm/đổi đồng thời. Bookmark thuộc selector/index mới; sau nâng cấp hãy tải lại từ trang 1, không tái dùng bookmark của query cũ. Hợp đồng cursor shared tổng quát vẫn pending, không bị sửa trạng thái phê duyệt trong lượt này.

List chỉ trả OPEN. Detail tiếp tục cho OPEN/CLOSED để đọc lại tin gắn với đơn cũ; DRAFT trả 404. CLOSED không cho Apply, sửa hoặc mở lại. Dataset live hiện không có CLOSED nên ca CLOSED list/detail được xác minh ở regression tests, không bịa một phép thử live.

## 5. Quyền tổ chức và dữ liệu tài khoản

Kiểm tra live read-only cho thấy **150 Recruiter hợp lệ, 0 reference scope lỗi**, và **0 Job sai liên kết Recruiter/Company/Department**. Toàn bộ 10.150 User đều `RESET_REQUIRED`; không có User ACTIVE trong nguồn vừa khôi phục.

Code hiện tại đã kiểm tra actor ACTIVE/RECRUITER, resolve đúng một Recruiter theo user_id; pure validator kiểm tra schema của Recruiter/User/Company/Department và Company–Department equality. Job trong scope phải khớp recruiter_id/company_id/department_id. Request strict không nhận owner từ client. Không phát hiện thiếu kiểm tra cần nới quyền; lượt này thêm tests thay vì đổi rule.

Tests mới từ chối Company/Department thiếu hoặc sai schema, Department của Company khác, profile Recruiter trùng, User LOCKED, owner injection và sửa Job người khác; tất cả xác nhận không có write ngoài quyền. Không dùng account bất kỳ để đọc Job của Recruiter khác nhằm làm đầy Dashboard.

Phân biệt các trường hợp:

- Public Jobs rỗng trước đây: database chưa có release và query có lỗi tương thích lịch sử.
- Dashboard rỗng với principal hợp lệ nhưng chưa có Job: kết quả scope đúng, không lấy public/cross-owner Job thay thế.
- Account thiếu Recruiter singleton hoặc Company/Department: PROFILE_REQUIRED/NOT_FOUND/INVALID_SCOPE; không giả dữ liệu organization.
- Account đọc/sửa Job Recruiter khác: 403, không sửa document.

## 6. Bảng UC08–UC13, UC16 và mức kiểm chứng

**A** = unit/fixture; **B** = API + CouchDB thật; **C** = browser đúng server 5173, Identity/CouchDB thật nếu là private. Không đánh đồng các lớp.

| UC | Entry point và route UI | API chính `/api/v1` | Service/repository | Dữ liệu cần | Hiện trạng/bằng chứng hoặc blocker |
|---|---|---|---|---|---|
| UC11 tạo tin | Menu Recruiter → Dashboard → Tạo tin; `/recruiter/jobs/create` | POST `/jobs` | JobService.create → JobApplicationRepository | User ACTIVE, Recruiter singleton, Company/Department hợp lệ | A pass DRAFT/OPEN; B/C private bị chặn bởi Identity/provisioning, không ký token demo |
| UC12 sửa/đăng/đóng | Card tin → Chỉnh sửa/Đăng tuyển/Đóng tin; `/:id/edit` | PATCH `/jobs/:id`, `/jobs/:id/status` | JobService.update → repository | Owned Job và expected_rev | A pass, giữ giây/millisecond deadline; CLOSED cấm sửa/mở; B/C private chưa nghiệm thu |
| UC08 nộp CV | `/jobs/:id` → ApplyModal | POST `/applications`, GET `/applications/context` | ApplicationService.create → repository | User ACTIVE CANDIDATE, Candidate, Job OPEN đúng deadline và reference hợp lệ | Public phần tiền đề đạt B/C với Job thật; nộp CV private mới đạt A, chờ Identity |
| UC09 tracker | Menu Hồ sơ ứng tuyển → `/user/dashboard` | GET `/applications/my-applications`, `/:id` | ApplicationService.mine/detail | Candidate sở hữu đơn và stage_history/submission | A pass reload/filter/page; B/C private chưa nghiệm thu |
| UC10 rút đơn | Tracker/Job detail → xác nhận rút | PATCH `/applications/:id/withdraw` | ApplicationService.transition(withdraw) | Owned Application ở APPLIED/SCREENING/INTERVIEW, revision/stage | A pass lịch sử/terminal/duplicate; B/C private chưa nghiệm thu |
| UC13 ứng viên | Dashboard → Xem ứng viên → `/recruiter/jobs/:id/applicants` | GET `/jobs/:id/applicants`, `/applications/:id` | ApplicationService.applicants/detail | Owned Job, Candidate/User canonical, CV/history | A pass privacy/scope; B/C private chưa nghiệm thu |
| UC16 chuyển stage | Applicants → Xem CV và xử lý → modal | PATCH `/applications/:id/stage` | ApplicationService.transition → repository | Revision/stage, actor scope, lý do/evidence, Interview thật khi OFFER | A pass state machine/conflict/evidence; B/C private chưa nghiệm thu, OFFER/HIRED còn cần TV3 |

P1/P2/P3 giữ nguyên: preflight/DTO trước write; timestamp deadline giữ chính xác; Foundation nằm trong npm test. Không mở thêm Auth, Interview, Scoring core, role enum hay document type.

## 7. Handoff Identity và phụ thuộc cụ thể

HEAD hiện có route health/database-health/job/application, không có route cấp token/login. Để nghiệm thu private cần TV1 cung cấp cơ chế reset/provisioning hợp lệ cho tài khoản thử và API cấp phiên thực tế. Không kích hoạt hàng loạt seeded users.

Adapter Job/Application hiện cần:

- Header `Authorization: Bearer <access token do Identity cấp>`; JWT HS256 được xác minh server-side, exp bắt buộc; nbf nếu có phải hợp lệ.
- `sub` hoặc `user_id` là canonical `user:<sha256>`; nếu có cả hai phải bằng nhau. issuer/audience phải khớp JWT_ISSUER/JWT_AUDIENCE nếu cấu hình.
- JWT_ALGORITHM=HS256; JWT_SECRET đủ dài theo cấu hình hiện tại, không ghi secret vào tài liệu/log. Đây là contract adapter đang chạy, không phải phê duyệt một chính sách session mới.
- Middleware lookup User canonical, account_status ACTIVE, lấy role thật và đặt `req.user`; không cấp quyền từ role/owner trong body hoặc tin role claim thay canonical User.
- Candidate phải có profile gắn user_id; Recruiter phải có đúng một profile và Company/Department đúng scope. Claims role cho UI cần canonical để menu hiển thị đúng; Backend vẫn kiểm tra lại quyền.

Cookie/CSRF, `req.auth` và các quyết định shared đang pending vẫn giữ nguyên pending. Không sửa bản DRAFT thành quyết định nhóm. TV3 cần cung cấp Interview/evidence thật để chạy OFFER/HIRED; Scoring hook production chưa nối và không hiển thị điểm giả.

## 8. Đối chiếu template và UI hiện tại

Không thiết kế lại giao diện trong lượt này khi chưa có khác biệt cụ thể mới. Đã giữ code khôi phục template từ lượt trước và kiểm tra trực tiếp màn hình public với dữ liệu thật. Bảng dưới không dùng fixture làm bằng chứng nghiệm thu private.

| Màn hình | Template nguồn | Đối chiếu và tình trạng |
|---|---|---|
| Recruiter Dashboard | `Dashboard/RecruiterDashboard.jsx` | Header tài khoản/avatar, card và action row theo template; stats scope bổ sung theo nghiệp vụ. Source/ảnh fixture đối chiếu trước còn hiệu lực về layout, chưa C private |
| Create/Edit Job | `Jobs/CreateJob.jsx` | Form dọc trắng max-w-3xl, nền xanh, heading/nút/field groups; field schema thay mẫu salary/location. P2 regression pass; chưa C private |
| Candidate Dashboard | `Dashboard/JobSeekerDashboard.jsx` | Header gradient/avatar, stats, filter panel và applications cards; bảy stages thật. Tổng trên page ghi rõ, không giả tổng corpus; chưa C private |
| JobApplicants | Expanded applicants trong Recruiter Dashboard + mockup nghiệp vụ | Trang riêng cùng palette/card/button, modal CV và stage controls; không có template page độc lập để tuyên bố khớp pixel; chưa C private |
| Apply/Applicant/Withdraw/Stage | Phong cách form/card của template + mockup | Dùng native modal/confirm, focus sau reload đã sửa ở lượt trước, allowed_transitions từ server; giữ regression; private vẫn chờ Identity |
| JobDetails | `Jobs/JobDetails.jsx` | Card max-w-4xl, tiêu đề xanh, metadata/icons, nội dung từ schema; **đã mở và reload Job CouchDB thật bằng Chrome** |
| Jobs/navigation liên quan | `Jobs/JobList.jsx`, `Navbar.jsx` | Layout filter 1/4 + list 3/4, card trắng và Navbar; **Jobs thật hiển thị**, desktop/tablet/mobile và menu tới Login đã kiểm chứng |

Landing/Login/Admin không được sửa lại trong lượt này vì không có lỗi mới ảnh hưởng truy vấn. Template gốc không đổi. [Đối chiếu source/ảnh chi tiết trước đó](frontend-template-restoration.md) mô tả những chỗ chưa thể so sánh success state khi thiếu API. Không tuyên bố mọi màn hình giống từng pixel.

## 9. Kết quả kiểm tra hiện tại

| Kiểm tra | Kết quả |
|---|---|
| Regression public Jobs trước sửa | 2/2 FAIL đúng lỗi thiếu published_at/lost historical results |
| Foundation + Recruitment sau sửa | **56/56 PASS**, gồm 10 tests mới public/scope |
| Frontend default fork worker lần đầu | Không đạt: 11 tests chạy, một worker timeout trước khi khởi động file còn lại; không tính là PASS |
| Frontend `npm test -- --pool=threads --maxWorkers=1` | **26/26 PASS**, không skip assertions |
| Frontend lint/build | PASS; lint 0 errors, 7 warnings có sẵn |
| Backend `npm test` | **285 tests: 263 PASS, 22 FAIL** |
| Import + verifier trên release Git bytes | PASS; 25.750 inserted; đúng ID/count/reference; content parity 135 sampled docs |
| API live pagination + `_explain` | PASS 200 unique Job IDs, dùng index v2 |
| Chrome `node scripts/ui/verify-live-jobs.cjs` | PASS, không mock, không session giả; Jobs/detail initial+reload, desktop/tablet/mobile, menu; không browser errors |
| `git diff --check` | PASS; có cảnh báo line endings của các file frontend có trước |

22 lỗi full suite không có tên mới so với log trước lượt sửa. Bằng chứng hiện tại vẫn là working-copy checksum khác manifest, thiếu pyarrow và release/staged lịch sử. Việc phục hồi **byte Git hợp lệ vào temp/CouchDB** không làm các assertion kiểm tra working-copy CRLF tự đổi kết quả. Không sửa manifest/checksum hoặc skip tests để lấy xanh.

Ảnh live: [Jobs desktop](live-job-verification/jobs-desktop.png), [detail](live-job-verification/job-detail-desktop.png), [tablet](live-job-verification/jobs-tablet.png), [mobile](live-job-verification/jobs-mobile.png). Các ảnh này lấy từ server 5173 dùng CouchDB thật, không phải ảnh MemoryRepository. Browser private không chạy ở lượt này vì chưa có Identity thật.

## 10. Sử dụng và bàn giao

1. Giữ Backend và Frontend đang chạy. Mở http://localhost:5173/jobs và Ctrl+F5 nếu tab đang giữ kết quả cũ.
2. Danh sách lấy 20 Job/page từ API. Chọn tin để đọc chi tiết; Trang sau/Trang trước dùng bookmark. Bộ lọc ghi rõ chỉ lọc trong page hiện tại.
3. Luồng Recruiter từ menu: Dashboard → Tạo tin → lưu DRAFT/OPEN → Chỉnh sửa/Đăng tuyển/Đóng tin → Xem ứng viên. Candidate: Việc làm → chi tiết → Apply → Tracker → rút đơn. Các bước private cần phiên Identity hợp lệ; không dùng tài khoản CouchDB admin để đăng nhập website.
4. Không chạy lại restore/import khi database đã có business docs. Khi cần kiểm tra nguồn chỉ dùng dry-run: `node scripts/database/restore-verified-release.js`.
5. Setup index có thể chạy theo hướng dẫn: `cd backend; npm run db:job-application`. Bookmark cũ cần bắt đầu lại trang 1 sau đổi query/index. Không xóa index cũ trong lượt này.

File mới/sửa chính: `backend/src/services/job.service.js`, `backend/src/repositories/job-application.repository.js`, `backend/tests/recruitment/public-jobs.test.js`, `organization-scope.test.js`, `scripts/database/restore-verified-release.js`, `scripts/ui/verify-live-jobs.cjs`, tài liệu và evidence live. Mọi thay đổi frontend sẵn có được bảo toàn. Artifact `data/scratch_bad_manifest.json` do full tests sinh ra được dọn sau kiểm tra.

Commit đề xuất, chưa thực hiện:

```text
fix(jobs): include historical open jobs and verify live release data

Replace optional published_at filtering with created_at/_id ordering and a versioned index.
Add historical visibility, pagination and organization-scope regression coverage.
Restore only verified Git release bytes into an empty local development database.
Record live CouchDB/browser evidence and explicit Identity blockers for private UCs.
```

Phần Public Jobs/dữ liệu thật đã đủ bàn giao theo bằng chứng trên. Không ghi hoàn thành toàn phân hệ: các luồng private vẫn chờ Identity và các phần evidence của Interview.
