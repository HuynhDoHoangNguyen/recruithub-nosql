# Report tổng hợp TV2 — Recruiter Management & Application Lifecycle

Ngày rà soát: **25/10/2026** (Asia/Saigon). Nhánh: `feature/recruiter-management-application-lifecycle`. HEAD: `9e48dc7`. Phạm vi đánh giá gồm HEAD và các thay đổi chưa commit đang có trong working tree.

Nguồn đối chiếu: [phân công TV2, mục 3.2](../../recruithub-team-work-assignment.md), [use cases](../../recruithub-usecase-system.md), [quy tắc nghiệp vụ hiện hành](../../recruitment-business-rules.md), Zod schemas, routes/service và các màn hình thực sự được mount.

## 1. Kết luận nghiệm thu

**Phần lõi TV2 đã có đủ API và giao diện cho 7 use case được giao: UC08, UC09, UC10, UC11, UC12, UC13, UC16. Có thể commit phần đã triển khai và bàn giao để tích hợp.** Các kiểm thử liên quan hiện pass; đã có bằng chứng đăng nhập/API/CouchDB/Chrome thật cho các luồng chính.

**Chưa đủ cơ sở ghi “hoàn thành 100% toàn bộ luồng tuyển dụng/tích hợp”.** Còn các điểm cần phân biệt:

1. `ApplicationService` có hook phân tích, nhưng `export default createApp()` hiện không truyền `analyzeApplication`. Chấm điểm tự động sau Apply chưa được nối trong cấu hình chạy mặc định.
2. TV2 kiểm tra điều kiện `INTERVIEW → OFFER` dựa trên Interview thật. Router/màn hình tạo và hoàn tất Interview của TV3 chưa được mount trong ứng dụng đang rà soát. Vì vậy chưa thể nghiệm thu luồng mới Apply → Interview → Offer → Hired hoàn toàn bằng giao diện hiện tại.
3. Bộ kiểm thử toàn repository chưa xanh: còn lỗi dữ liệu/ETL và một nhóm test đăng ký Recruiter dùng contract cũ. Các lỗi này phải được giải quyết khi nghiệm thu tích hợp chung.

Kết luận phù hợp để báo cáo với nhóm: **“Hoàn thành triển khai phần lõi và kiểm thử phân hệ TV2; chờ tích hợp TV3 và xử lý các lỗi kiểm thử chung để nghiệm thu toàn hệ thống.”**

## 2. Đối chiếu 7 use case của thành viên 2

| Use case | Backend và nghiệp vụ | Giao diện | Đánh giá hiện tại |
|---|---|---|---|
| UC11 — Đăng tin | `POST /api/v1/jobs`; tạo DRAFT/OPEN, lấy Recruiter/Company/Department từ scope đã xác thực; validate schema, kỹ năng và deadline | `/recruiter/jobs/create`, `JobForm` | Đạt phần TV2; có kiểm chứng thật |
| UC12 — Sửa/đóng tin | PATCH Job/status với `expected_rev`; giữ deadline gốc khi không sửa; đóng tin bảo toàn hồ sơ | Dashboard, form sửa, hành động đăng/đóng; bổ sung mở lại và xóa mềm | Đạt phần TV2 |
| UC08 — Nộp hồ sơ | `POST /api/v1/applications`; Candidate ACTIVE, Job OPEN/deadline, ID theo Candidate–Job, chống trùng, request id, lưu CV/thư giới thiệu | JobDetails → ApplyModal; CV văn bản hoặc file, chọn CV đã lưu | Đạt luồng nộp; bước phân tích tự động còn phụ thuộc TV3 |
| UC09 — Theo dõi hồ sơ | My applications/detail/stats theo owner; stage filter, bookmark; lịch sử từng lần nộp | `/user/dashboard`, badge, timeline, CV, lịch sử; 5 hồ sơ/trang | Đạt phần TV2 |
| UC10 — Rút đơn | Withdraw chỉ ở APPLIED/SCREENING/INTERVIEW; kiểm tra stage/revision và ghi lịch sử | Nút xác nhận rút; disabled khi gửi, cập nhật sau thành công | Đạt; nộp lại sau WITHDRAWN có bảo toàn lần cũ |
| UC13 — Xem ứng viên | Applicants theo Job sở hữu, phân trang/lọc; DTO ứng viên và CV đúng scope | `/recruiter/jobs/:id/applicants`, bảng và modal xử lý | Đạt phần danh sách/CV. Điểm số UC14 và ranking UC15 thuộc TV3 |
| UC16 — Chuyển stage | State machine, quyền actor, expected stage/revision, reason/evidence; kiểm tra Interview trước OFFER và chấp nhận offer trước HIRED | Hành động theo `allowed_transitions`, form lý do/xác nhận, thông báo chặn OFFER | Đạt logic API/UI và kiểm thử fixture; chờ module Interview để nghiệm thu đường thành công tới HIRED trên ứng dụng thật |

**Enum đang persist theo schema:** `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`. Những chỗ trong use-case cũ ghi `INTERVIEWING`/`OFFERED` là khác tên so với contract thực tế; không đổi enum đang lưu chỉ để khớp ví dụ cũ.

## 3. Tổng hợp các hạng mục đã làm

### 3.1. Quản lý tuyển dụng

- Tạo, sửa, lưu nháp, đăng, đóng và mở lại tin; xóa mềm tin, giữ CV/Application và lịch sử.
- Cấp bậc tạo mới: Intern, Fresher, Junior, Senior; giữ khả năng đọc/sửa MID của dữ liệu cũ.
- Tách hình thức làm việc Hybrid/Remote/Onsite với loại hợp đồng Full time/Part time/Hợp đồng/Intern.
- Lương thỏa thuận hoặc khoảng min/max theo tháng, VND/USD; validate thứ tự và giới hạn.
- Địa điểm, kỹ năng và yêu cầu kinh nghiệm/học vấn/dự án đi theo schema/API.
- Dashboard có logo, trạng thái, số liệu toàn bộ dữ liệu thuộc scope và **5 tin/trang**. Bảng ứng viên theo từng tin vẫn có phân trang/lọc riêng (hiện request 20 hồ sơ/trang).
- Sửa lỗi mất giây/millisecond của deadline khi chỉ sửa tiêu đề/mô tả.

### 3.2. Nộp hồ sơ và vòng đời ứng tuyển

- Apply kiểm tra đăng nhập/role, owner, Job OPEN và thời hạn; CV văn bản/file và thư giới thiệu có validation.
- Dùng document ID xác định theo cặp Candidate–Job để chống tạo trùng; xử lý retry cùng `request_id` và xung đột nội dung.
- Rút đơn; nộp lại sau WITHDRAWN với revision hiện tại và request id mới. HIRED/REJECTED vẫn chặn nộp lại.
- Mỗi lần nộp lại bắt đầu lịch sử mới; lưu snapshot lần cũ trong `previous_attempts`, tăng `attempt_number`; giữ CV và quyết định cũ.
- Candidate theo dõi từng stage, xem lịch sử/CV, lọc và chuyển trang; phần chi tiết chỉ dựng khi bấm mở.
- Recruiter xem CV, duyệt sơ bộ, mời phỏng vấn, từ chối, gửi đề nghị hoặc xác nhận tuyển khi có đủ điều kiện.
- Chặn nhảy cóc/quay lui, sửa lịch sử của lần terminal, dùng bằng chứng Interview từ lần ứng tuyển cũ và chấp nhận offer sai thời điểm.
- Chuẩn bị/validate response reference trước write để tránh đã đổi stage nhưng API mới phát hiện dữ liệu tham chiếu sai.
- Giữ ghi chú nội bộ Recruiter ngoài DTO Candidate; xử lý 409 theo precondition và bảo toàn lịch sử của request thắng.

### 3.3. Upload và xem CV/ảnh

- CV DOC/DOCX/PDF và ảnh JPG/PNG/WEBP **dưới 5 MiB**; kiểm tra extension, nội dung/container và kích thước ảnh tại backend.
- File lưu bất biến bằng CouchDB attachment trong database ghi cô lập; hồ sơ/company/application giữ metadata reference.
- Candidate tải CV ở hồ sơ hoặc form ứng tuyển, chọn CV đã lưu; mỗi lần ứng tuyển giữ file riêng.
- Sửa validator PDF: hỗ trợ BOM/preamble/padding và PDF object streams; parse cấu trúc trước khi lưu, giữ nguyên bytes.
- Xem PDF trong trình duyệt; DOC/DOCX có bản xem nội dung văn bản; nút download riêng giữ nguyên file gốc.
- Word preview có giới hạn worker/thời gian/nội dung, render text an toàn; không gửi CV cho dịch vụ xem tài liệu bên ngoài.
- Quyền xem/tải CV dựa trên owner hoặc Application thuộc Job của Recruiter; kiểm tra SHA-256 khi đọc. Logo công ty có endpoint public riêng; CV không public.
- Logo công ty và ảnh Candidate chọn từ máy tính; lỗi ảnh có fallback.

### 3.4. Hồ sơ và giao diện bổ sung theo yêu cầu

- Candidate Profile có chế độ xem/sửa, header avatar/thông tin/progress, 5 mục điều hướng, Save/Cancel và nút thay ảnh dưới avatar.
- Có trang `/recruiter/profile` để sửa liên hệ và thông tin công ty, logo, website; email giữ nguyên.
- Kiểm tra số điện thoại Việt Nam, tên, website, năm kinh nghiệm, độ dài nội dung, ngày thực tế/khoảng ngày và kỹ năng/ngoại ngữ trùng ở frontend lẫn API.
- Hoàn thiện banner trang chủ, vùng tìm kiếm/gợi ý kỹ năng, thẻ việc làm tiêu biểu, nút/icon/viền và bố cục responsive.
- Nối tin runtime của Recruiter với catalog công khai; phân biệt tin dữ liệu tham khảo, giữ bộ lọc và API version nhất quán sau merge.
- Các phần Candidate Profile/Public Portal là phần hỗ trợ được thực hiện theo yêu cầu trực tiếp trong phiên, cần phối hợp TV1 khi merge để tránh ghi đè thay đổi song song.

## 4. An toàn dữ liệu và tích hợp

- Giữ dữ liệu lịch sử và template tham khảo; không chạy import lại/drop database hoặc đổi hàng loạt trạng thái tài khoản.
- Database chính đã kiểm chứng giữ **25.761 documents = 25.750 nghiệp vụ + 11 design docs** và `update_seq` trước/sau kiểm chứng browser.
- Các lần test ghi trước đây chỉ dùng database cô lập; ảnh/CV nộp trước đó là immutable snapshots. Các script kiểm chứng có ghi đã được mô tả rõ trong handoff tương ứng.
- Dùng Identity/JWT thật, kiểm tra `account_status`/scope và route guard; không tạo token giả để demo.
- `.env`, `backend/.env`, `frontend/.env` đang được ignore và không nằm trong tracked files của Git.
- Chưa có conflict marker trong `backend/src`, `frontend/src`; `git diff --check` đạt ở lần rà soát này.

## 5. Kết quả kiểm tra lại code hiện tại

| Kiểm tra | Kết quả |
|---|---|
| Backend foundation + recruitment + Candidate Profile | **116/116 pass** |
| Frontend Vitest | **108/108 pass**, 14 test files |
| Frontend Node tests | **7/7 pass** |
| Frontend lint | **0 errors**, 1 warning cũ: React import không dùng trong `App.jsx` |
| Frontend production build | **Pass**, cảnh báo bundle chính khoảng 581 KB (>500 KB) |
| Toàn bộ `backend/npm test` | **319/341 pass, 22 fail** ở nhóm dữ liệu/ETL có sẵn |
| Toàn bộ `tests/auth-foundation/*.test.js` chạy riêng | **36/43 pass, 7 fail** trong `recruiter-registration.test.js` |
| Chrome thật đã có bằng chứng | Đăng nhập, quản lý tin, Apply/rút/nộp lại, CV/ảnh/profile/validation, phân trang, responsive; không có runtime errors trong các kết quả mới nhất |

Không cộng các tổng backend trên với nhau: bộ scoped và bộ Auth riêng có test trùng nhau. `npm test` backend hiện chưa tự discovery thư mục `auth-foundation`; vì vậy đã chạy riêng khi rà soát.

**22 lỗi dữ liệu/ETL:** release/fixture thiếu hoặc không khớp checksum/số lượng, môi trường extraction/pyarrow và các assertion import/failure-injection. Các test phân hệ TV2 nằm trong bộ tổng vẫn pass. Không chỉnh snapshot hay skip test để lấy kết quả xanh.

**7 lỗi Identity:** bộ test đăng ký Recruiter còn kỳ vọng tạo company/department mới từ payload cũ, trong khi service chạy hiện tại yêu cầu `company_id` và `department_id` có sẵn. Cần TV1 cập nhật/chốt contract và test tương ứng.

Lệnh tái hiện các nhóm chính:

```powershell
# Tại thư mục backend
node --test tests/foundation/*.test.js tests/recruitment/*.test.js tests/auth-foundation/candidate-profile.test.js
npm test
node --test tests/auth-foundation/*.test.js

# Tại thư mục frontend
npm test
npm run lint
npm run build
```

## 6. Còn gì trước khi gọi là hoàn thành toàn bộ?

| Việc còn lại | Phụ trách/điểm tích hợp | Điều kiện đóng việc |
|---|---|---|
| Interview end-to-end | TV3, kết nối với Application TV2 | Có API/màn hình tạo và hoàn tất Interview đúng attempt; dùng dữ liệu thật để Recruiter chuyển OFFER thành công |
| Scoring sau Apply | TV3; truyền callback vào composition root | Nối `analyzeApplication`, bind attempt/fingerprint/freshness; đọc được analysis thật, xử lý lỗi theo contract; không dựng điểm giả |
| AI Match/Breakdown/Ranking | UC14/UC15/UC19–22, TV3 | Tích hợp UI/API tương ứng; không tính đây là phần UC13 đã hoàn thành của TV2 |
| Offer → Hired trên browser thật | Kiểm thử liên thành viên | Từ một đơn mới, hoàn tất Interview thực tế → OFFER → lưu bằng chứng chấp nhận → HIRED; kiểm tra terminal/history |
| Bộ test toàn kho | Nhóm dữ liệu + TV1 | Khôi phục release/môi trường đúng và cập nhật test đăng ký theo contract; chạy xanh bộ tổng sau tích hợp |

Các mục trên không được đánh dấu hoàn thành chỉ vì state machine hoặc test fixture đã pass. Phần thiếu của TV3 cần được giao/merge từ đúng module; lượt rà soát này không tự viết Interview hay scoring để vượt điều kiện nghiệm thu.

## 7. Summary để commit phần hiện tại

Nội dung sau mô tả phần đã triển khai, không tuyên bố toàn hệ thống đã nghiệm thu:

```text
feat(tv2): extend recruiter workflows and application lifecycle

- bổ sung loại hợp đồng, cấp bậc, lương, mở lại và xóa mềm tin tuyển dụng
- hoàn thiện nộp/rút/nộp lại hồ sơ, lưu lịch sử và CV riêng theo từng lần nộp
- thêm upload CV/ảnh/logo, xem PDF/Word trên trình duyệt và tải file theo quyền
- hoàn thiện hồ sơ Candidate/Recruiter và validation frontend/API
- làm mới trang chủ, thẻ việc làm và Dashboard phân trang 5 mục
- bổ sung kiểm thử hồi quy, kiểm chứng browser và tài liệu bàn giao TV2

Validation: backend liên quan 116/116; frontend 115/115; lint/build pass.
Integration pending: Interview/scoring TV3, full-backend ETL và test Auth cũ.
```

Trước khi commit cần bao gồm các file mới/untracked phục vụ tính năng (schemas/services/upload components/tests/scripts), `backend/package.json` và lockfile, cùng các tài liệu report được chuyển sang `docs/reports/TV2/`. Không chỉ chọn các file modified rồi bỏ sót file mới. Kiểm tra diff phần Public Portal/Candidate Profile với TV1 vì đây là các file có thể cùng được chỉnh ở nhánh khác.

**Lượt này chưa chạy `git add`, `git commit` hoặc `git push`.**

## 8. Tài liệu và bằng chứng chi tiết

- [Bàn giao catalog/lifecycle](recruihub-catalog-lifecycle-handoff-2026-10-25.md)
- [Form đăng tin/hồ sơ công ty/xóa tin](recruiter-ui-enhancements-2026-10-25.md)
- [Upload file](file-upload-handoff-2026-10-25.md)
- [CV preview/hồ sơ/phân trang](cv-profile-pagination-handoff-2026-10-25.md)
- [Validation và trang chủ](profile-validation-home-handoff-2026-10-25.md)
- [Tài khoản Candidate local](local-candidate-testing.md), [Recruiter local](local-recruiter-testing.md)
- [JSON CV/preview](../../cv-preview-profile-verification/results.json), [phân trang](../../dashboard-pagination-verification/results.json), [validation/trang chủ](../../profile-rules-home-verification/results.json)
- [Báo cáo tổng hợp lịch sử](RP-TV2-consolidated.md): giữ để truy vết; các kết luận theo ngày cũ trong đó được thay thế bởi report hiện tại khi đánh giá code ngày 25/10/2026.
