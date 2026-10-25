# BÁO CÁO TỔNG HỢP CÔNG VIỆC THÀNH VIÊN 2

**Dự án:** RecruiHub NoSQL — Nhóm 8  
**Phân hệ:** Recruiter Management & Application Lifecycle  
**Ngày tổng hợp:** 25/10/2026, Asia/Saigon  
**Nhánh:** `feature/recruiter-management-application-lifecycle`  
**Mốc mã nguồn:** `04e07a8` — `fix UI`

## 1. Mục đích và kết luận hiện tại

Báo cáo tổng hợp lại **16 file Markdown có sẵn trong `docs/reports/TV2/`**, đối chiếu thêm tài liệu triển khai, phân công, handoff liên thành viên, code và kết quả kiểm tra gần nhất. Các báo cáo cũ ghi nhận những phiên bản khác nhau; nội dung trong báo cáo này mô tả trạng thái tại mốc mã nguồn nêu trên, không cộng dồn mọi kết luận lịch sử thành trạng thái đã hoàn thành.

**TV2 đã triển khai Backend và Frontend cho cả 7 use case được giao**, cùng các phần mở rộng về CV, hồ sơ, quản lý tin và giao diện theo yêu cầu. Những luồng chính đã có kiểm thử tự động và bằng chứng sử dụng Identity/API/CouchDB thật trên môi trường local.

**Chưa đủ điều kiện xác nhận hoàn thành 100% hoặc merge như một bản đã nghiệm thu đầy đủ.** Còn hai lỗi tích hợp sau merge: đọc chi tiết tin CLOSED không khớp luồng lịch sử ứng tuyển, và DTO chi tiết public thiếu logo công ty. Ngoài ra còn phụ thuộc Interview/scoring TV3, các lỗi kiểm thử dữ liệu/ETL và đăng ký Recruiter, cùng việc đưa bằng chứng local vào bộ bàn giao.

Trong lượt tổng hợp này chỉ đọc tài liệu/code và viết report; **không sửa nghiệp vụ, không chạy lại kiểm thử hoặc ghi dữ liệu**, không stage/commit/push. Kết quả kiểm thử sử dụng lần rà soát liền trước trên cùng HEAD, được ghi trong [báo cáo trước khi gộp dev](dev-handoff-review-2026-10-25.md).

## 2. Phạm vi trách nhiệm và kiến trúc

Theo [phân công nhóm](../../recruithub-team-work-assignment.md), TV2 phụ trách UC08, UC09, UC10, UC11, UC12, UC13 và UC16. Authentication, Candidate Profile, Public Portal thuộc TV1; Interview, scoring, ranking và audit thuộc TV3. Một số phần Profile/Public Portal đã được hỗ trợ theo yêu cầu trực tiếp, cần phối hợp khi tích hợp thay đổi song song.

Các tính năng được nối theo lát cắt dọc:

```text
React page/component → Axios/API service → /api/v1
  → JWT/role/Zod middleware → controller → domain service
  → repository → CouchDB document/index/reduce view
```

| Tầng | Thành phần chính |
| --- | --- |
| Schema và dữ liệu | Job, Application, submission/attempt, Recruiter/Company profile, uploaded asset và request schemas |
| Lưu trữ | `JobApplicationRepository`, `AssetRepository`, Mango indexes, reduce views |
| Nghiệp vụ | `JobService`, `ApplicationService`, `RecruiterProfileService`, `UploadService`, `PublicJobCatalogService` |
| API | Job/Application/Recruiter Profile/Upload routes và controllers |
| Giao diện | Hai Dashboard, Create/Edit Job, Applicants, Apply/Applicant modals, timeline, Candidate/Recruiter Profile |
| Kiểm chứng | Backend API/domain tests, React tests, Node helper tests và browser scripts |

Repository nghiệp vụ hiện có vẫn được giữ; không xem việc chưa chuyển toàn bộ sang `BaseRepository` là thiếu chức năng. Các đề xuất trong handoff Foundation không tự trở thành quyết định nhóm đã phê duyệt chỉ vì đã có code.

## 3. Ma trận 7 use case TV2

| Use case | Backend/API đã triển khai | Frontend và khả năng sử dụng | Đánh giá tại mốc hiện tại |
| --- | --- | --- | --- |
| **UC11 — Đăng tin** | Tạo DRAFT/OPEN; tổ chức lấy từ principal; validate nội dung, kỹ năng, requirements, deadline và dữ liệu bổ sung | `/recruiter/jobs/create`, form chia nhóm, loading/error/success | Đã triển khai; có bằng chứng local bằng tài khoản thật |
| **UC12 — Cập nhật/đóng tin** | PATCH có revision; publish/close, bảo toàn deadline và Application; mở rộng reopen/soft delete | Dashboard, form sửa, nút đăng/đóng/mở lại/xóa, xác nhận thao tác | Core đã triển khai; contract đọc CLOSED sau đóng còn lỗi tích hợp |
| **UC08 — Nộp hồ sơ** | Candidate ACTIVE, tin đủ điều kiện; chống trùng, request key, CV text/file, cover letter | JobDetails → ApplyModal; chọn CV mới hoặc CV hồ sơ | Đã triển khai; phân tích tự động sau Apply còn phụ thuộc TV3 |
| **UC09 — Theo dõi hồ sơ** | List/detail/stats theo Candidate; stage filter, bookmark, history/attempt DTO | `/user/dashboard`, badge, tiến trình, CV/lịch sử, 5 đơn/trang | Đã triển khai; đường mở lại chi tiết tin CLOSED cần xử lý |
| **UC10 — Rút đơn** | Owner, stage/revision preconditions; ghi WITHDRAWN và giữ lịch sử | Xác nhận rút, trạng thái đang gửi, cập nhật kết quả; có nộp lại theo chính sách mới | Đã triển khai và có kiểm chứng luồng thật |
| **UC13 — Xem ứng viên** | Applicants theo Job sở hữu; lọc/phân trang; Candidate/User/CV đúng scope | `/recruiter/jobs/:id/applicants`, bảng và modal đọc hồ sơ/CV | Đã triển khai phần danh sách/hồ sơ; điểm số và ranking thuộc TV3 |
| **UC16 — Chuyển stage** | State machine, lý do, bằng chứng, revision; kiểm tra Interview trước OFFER và acceptance trước HIRED | Hành động theo `allowed_transitions`, thông báo chặn và form xử lý | Đã triển khai logic API/UI và test fixture; chưa nghiệm thu Interview → OFFER → HIRED bằng browser với đầy đủ module thật |

“Đã triển khai” thể hiện tính năng có code Backend/Frontend; không đồng nghĩa mọi đường nghiệp vụ đã được nghiệm thu tích hợp trên phiên bản sau merge.

## 4. Kết quả thực hiện theo nhóm chức năng

### 4.1. Quản lý tin tuyển dụng

- Tạo nháp, đăng tuyển, sửa tin, đóng và mở lại; xóa mềm bằng `deleted_at` cùng trạng thái CLOSED trong một lần ghi.
- Xóa mềm ẩn tin khỏi danh sách/thống kê phù hợp, chặn sửa/mở lại/nộp mới; không xóa dây chuyền Application, CV hoặc lịch sử.
- Cấp bậc tạo mới: **Intern, Fresher, Junior, Senior**. MID giữ để tương thích dữ liệu cũ, không tự đổi cấp bậc lịch sử.
- **Hình thức làm việc** Hybrid/Remote/Onsite độc lập với **loại hợp đồng** Full time/Part time/Hợp đồng/Intern.
- Lương tùy chọn: chưa cập nhật, thỏa thuận hoặc khoảng min/max theo tháng, VND/USD; kiểm tra min/max hợp lệ.
- Địa điểm và work mode dùng khóa/nhãn từ metadata; giữ Job cũ hợp lệ khi thiếu trường mới.
- Sửa title/description không làm mất giây/millisecond của deadline. Khi sửa thời gian thật, chuyển giờ Việt Nam sang UTC theo quy ước form.
- Company/Department/Recruiter do server xác định từ tài khoản, không nhận owner do client tự chọn.

### 4.2. Nộp, rút và nộp lại hồ sơ

- Chỉ nhận hồ sơ khi Candidate, Job, deadline và liên kết tổ chức hợp lệ; không gửi đơn trống.
- Một document Application cho mỗi cặp Candidate–Job, ID xác định bằng hash; không tạo nhiều document để tránh kiểm tra trùng.
- Lần hiện tại nằm ở top-level; lần cũ lưu trong `previous_attempts`, có `attempt_number`, CV/cover letter, stage/history và thông tin liên quan.
- **WITHDRAWN được nộp lại** nếu tin OPEN, còn hạn và các điều kiện khác hợp lệ. REJECTED/HIRED vẫn chặn nộp lại.
- Nộp lại cần `expected_rev` hiện tại và UUID `request_id` mới; bắt đầu history mới, không append một transition WITHDRAWN → APPLIED vào history đã kết thúc.
- Retry cùng khóa/nội dung đã ghi không tạo thêm attempt; khóa cũ hoặc nội dung không khớp được xử lý riêng. Request cạnh tranh không ghi đè lịch sử của request thắng.
- Thay CV trong hồ sơ không làm thay đổi file của những lần đã ứng tuyển.

### 4.3. Pipeline bảy trạng thái và kiểm soát ghi

Enum persist theo schema đang chạy:

```text
APPLIED → SCREENING → INTERVIEW → OFFER → HIRED

REJECTED: kết thúc do từ chối theo các transition được phép.
WITHDRAWN: ứng viên rút ở APPLIED / SCREENING / INTERVIEW.
```

Các tên `INTERVIEWING` / `OFFERED` trong một số tài liệu tổng quát không phải tên field persist hiện tại. Không đổi schema/dữ liệu chỉ để khớp tên mô tả cũ.

- Chặn nhảy cóc, quay lui và tiếp tục transition trong một attempt terminal.
- Chuyển stage có `expected_rev`/`expected_stage`, vai trò/ownership và lý do/bằng chứng theo từng hành động.
- OFFER dùng Interview thuộc **đúng lần ứng tuyển hiện tại**; không tái sử dụng bằng chứng của attempt cũ.
- HIRED cần thông tin chấp nhận offer trong thời gian hợp lệ; đây là ghi nhận bằng chứng, chưa phải tích hợp xác minh chữ ký/email bên ngoài.
- Chuẩn bị reference/DTO cần thiết trước khi ghi Application để tránh đã thay stage rồi mới phát hiện dữ liệu tham chiếu sai.
- Xung đột trả 409 để client đọc lại và kiểm tra trạng thái; không merge history hoặc retry mù với revision cũ.
- CouchDB không có transaction liên Job–Application–Interview. Không tuyên bố đã loại bỏ mọi race liên document.

### 4.4. Upload và xem CV, avatar, logo

| Nội dung | Hiện trạng |
| --- | --- |
| CV | PDF, DOC, DOCX; chọn từ máy/kéo thả hoặc dùng CV đã lưu trong hồ sơ; vẫn hỗ trợ CV văn bản |
| Giới hạn | **Nhỏ hơn 5 × 1024 × 1024 bytes**; bằng hoặc vượt ngưỡng bị từ chối |
| Avatar/logo | JPEG/PNG/WEBP, kiểm tra nội dung và kích thước ảnh; có fallback khi thiếu/lỗi |
| PDF | Sửa validator để nhận các PDF hợp lệ có BOM/preamble/padding/object streams; parse cấu trúc trước khi lưu, không bỏ kiểm tra file hỏng |
| Xem PDF | Khung xem trong trình duyệt qua Blob URL riêng; download là thao tác tách biệt |
| Xem DOC/DOCX | Nội dung văn bản trong trang; không bảo đảm giữ hình ảnh/bố cục Word; vẫn tải được file gốc |
| Giới hạn parser | Worker 10 giây, 128 MB V8 heap; bản xem Word tối đa 500.000 ký tự; render text, không thực thi HTML từ file |
| Lưu trữ | CouchDB attachment trong document runtime `uploaded_asset`; hồ sơ/Application/Company giữ reference và metadata |
| Tính toàn vẹn | Kiểm tra kích thước/SHA-256 khi đọc; CV/private response có kiểm soát cache và nosniff |
| Phân quyền | Chủ file hoặc Recruiter có Application liên quan thuộc Job sở hữu; logo có endpoint public riêng, không dùng endpoint đó để đọc CV |

Bỏ lựa chọn file chỉ gỡ liên kết; không xóa attachment đang được Application lịch sử tham chiếu. **Chưa có tác vụ dọn file upload nhưng không được tham chiếu.** Bản xem Word/PDF chưa đồng nghĩa CV đã được trích xuất và chấm điểm tự động.

### 4.5. Hồ sơ và validation

- Candidate Profile mặc định chế độ xem; có Chỉnh sửa, Lưu/Hủy, avatar và nút thay ảnh bên dưới khi sửa.
- Đủ năm mục: thông tin chung; kỹ năng/ngoại ngữ; kinh nghiệm/dự án; học vấn; CV đính kèm. Chuyển tab giữ dữ liệu chưa lưu, Hủy phục hồi dữ liệu ban đầu.
- Recruiter có trang riêng `/recruiter/profile`, gồm thông tin liên hệ và thông tin công ty; không còn dùng link về Dashboard làm trang sửa hồ sơ.
- Logo công ty tải từ máy. URL lịch sử còn được đọc; không yêu cầu nhập URL logo trên form mới.
- Email chỉ đọc; API chặn thay đổi role, User/Company/Department IDs và membership qua các endpoint profile.
- Validation frontend và API cho số điện thoại Việt Nam, họ tên, website HTTP/HTTPS không chứa credentials, số năm kinh nghiệm, độ dài, collection trùng và ngày/khoảng ngày.
- Số điện thoại là tùy chọn khi chưa cung cấp; khi nhập phải đúng định dạng portal. Đây là kiểm tra định dạng, **không phải xác minh OTP/chủ thuê bao**.
- Hồ sơ cũ vẫn mở được để sửa; PATCH chặt hơn nhưng không làm schema đọc từ chối hàng loạt dữ liệu lịch sử.
- Completion tính từ dữ liệu thực tế, không dùng phần trăm mẫu trong ảnh tham khảo.

### 4.6. Dashboard, catalog và UI hiện tại

- **Recruiter Dashboard: 5 tin/trang. Candidate Dashboard: 5 đơn/trang.** Dùng `limit=5` và bookmark server, không tải tất cả rồi cắt trên trình duyệt.
- Applicants theo Job có phân trang riêng, hiện request 20 hồ sơ/trang; không nhầm với yêu cầu 5 mục của hai Dashboard.
- Đổi bộ lọc reset trang/cursor; thống kê tính toàn scope, phân biệt số document hiện hành, tổng attempts và lịch sử.
- Public catalog ưu tiên Job runtime có thể ứng tuyển, sau đó Job lịch sử có nhãn tham khảo. Không nộp chéo vào database khác chỉ vì xem được tin.
- Keyword, kỹ năng, ngành, cấp bậc, địa điểm và work mode kết hợp theo contract; nhiều kỹ năng là AND. Cursor ràng buộc bộ lọc.
- Tìm kiếm hiện là literal search/scan backend theo batch khi có filter, **chưa phải indexed full-text search**. Không tuyên bố đã hỗ trợ tìm kiếm/lọc lương nếu API chưa có.
- Giữ Public Job List/Details mới từ dev; sửa import/state bị trộn sau merge và nối lại filter, CV, lịch sử, route quay về sau login.
- UI mới nhất dùng nền **navy/indigo `#233D7A` → `#1C3266` → `#17284F`**, chuyển sắc radial nhẹ, card sáng, border/shadow mềm, icon và focus/disabled rõ.
- Áp dụng ở bảy trang, gồm `/profile` đủ năm tab. Trên Landing chỉ đổi section việc làm tiêu biểu; hero/header/các section khác giữ nguyên trong lượt theme.
- Không đưa mock toolbar đổi role, điểm AI, nhãn verified hoặc số liệu marketing giả vào production.

## 5. Các vấn đề đã xử lý qua các giai đoạn

| Vấn đề | Cách xử lý và ý nghĩa |
| --- | --- |
| Sai phiên bản template | Tách bản “Find Your Dream Job” cũ với JobPortal IT tham khảo; không dùng ảnh/nhận định của bản cũ để nghiệm thu UI hiện tại |
| Màn hình trắng | Xác định lỗi module/cache Vite `Outdated Optimize Dep`; tách cache, prebundle và kiểm tra đúng server đang chạy |
| Public Jobs rỗng | Phân biệt database chưa có business docs với query loại OPEN thiếu `published_at`; dùng `created_at`/`_id` và index v2 |
| Sau merge báo “mất dữ liệu” | Tách repository public đọc dataset khỏi database private bắt buộc cấu hình; lỗi 503 cấu hình không có nghĩa document bị xóa |
| Không đăng nhập để thử nghiệp vụ | Tài khoản local Candidate/Recruiter với Identity/JWT thật, database ghi cô lập; không đổi role bằng toolbar/token giả |
| Ghi rồi mới trả lỗi reference | Dựng/validate response cần thiết trước write, thêm regression no-write khi dữ liệu tham chiếu sai |
| Sửa title làm lệch deadline | Giữ nguyên timestamp đầy đủ khi input deadline không đổi |
| Bỏ sót Foundation tests | Bổ sung Foundation vào discovery backend; Auth Foundation vẫn cần chạy riêng |
| PDF hợp lệ bị từ chối | Sửa điều kiện nhận diện quá chặt và thêm kiểm tra cấu trúc PDF |
| Import/state trùng sau merge mới | Gộp imports/state, giữ layout dev, nối lại API/filter/CV và test hồi quy |

Các lỗi trong bảng đã có báo cáo xử lý theo từng mốc; không dùng điều đó để bỏ qua hai lỗi tích hợp đang tồn tại ở mục 8.

## 6. Dữ liệu NoSQL, môi trường và quyền truy cập

### 6.1. Phân biệt dataset và dữ liệu ứng dụng

- Dataset lịch sử: `recruitment_db`, theo cấu hình `COUCHDB_DATABASE`.
- Auth, Job/Application runtime và tài sản: database ghi cấu hình tường minh bằng `AUTH_COUCHDB_DATABASE`; môi trường local đã kiểm chứng dùng `recruithub_auth_local_test`.
- Public catalog ghép hai nguồn qua DTO/cursor, không clone toàn dataset hoặc tự chuyển Application sang database khác.
- Tài khoản CouchDB admin là tài khoản hạ tầng, không phải tài khoản đăng nhập website.
- Token frontend memory-only; reload có thể cần login lại. Dữ liệu đã lưu vẫn nằm trong CouchDB.
- Bí mật ở `.env` được ignore; report chỉ hướng dẫn tên biến, không chứa password/JWT/CouchDB credentials.

### 6.2. Mốc dữ liệu đã được kiểm chứng

| Loại | Số lượng ở mốc dataset được ghi nhận |
| --- | ---: |
| User | 10.150 |
| Candidate | 10.000 |
| Company / Department / Recruiter | 50 / 150 / 150 |
| Job | 2.500, gồm 200 OPEN và 2.300 DRAFT |
| Application / Interview / Resume Analysis | 1.200 / 350 / 1.200 |
| Tổng business documents | **25.750** |
| `doc_count` gồm 11 design documents | **25.761** |

Đây là số liệu có bằng chứng tại các lần kiểm chứng trước, không phải số đếm database mới trong lượt viết report. Số tin/đơn thử trong database private thay đổi khi người dùng test; không gộp chúng vào số lượng dataset lịch sử.

Đã từng khôi phục release Git đúng checksum vào local database chỉ có design docs ở giai đoạn đầu. Thao tác đó được ghi riêng trong [Public Jobs live](public-jobs-live-verification.md); **không phải bước khởi động hằng ngày và không được hiểu là mọi giai đoạn đều không có database write**. Những lượt kiểm chứng sau ghi rõ count/update_seq dataset không đổi; thao tác nghiệp vụ thử chỉ dùng database cô lập.

### 6.3. Giới hạn tích hợp tổ chức mới

Luồng đăng ký Recruiter của TV1 dùng directory Company/Department từ nguồn dataset và ghi User/Recruiter vào database Auth. TV2 hiện resolve Company/Department qua repository nghiệp vụ private. Tài khoản local được provision với tổ chức hợp lệ trong database đó không chứng minh mọi Recruiter tự đăng ký theo topology hai database đã dùng được Job/Application. Cần chốt cách đọc references giữa TV1/TV2 trước khi bật/nghiệm thu luồng này rộng hơn; không copy/ghi vào dataset lịch sử để né vấn đề.

## 7. Kết quả kiểm thử mới nhất

Kết quả dưới đây lấy từ lần rà soát trên **HEAD `04e07a8`**, thay cho các tổng 26/28/108 tests hoặc 116/116 trong report cũ.

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend Vitest | **120/120 PASS**, 16 files |
| Frontend Node helper/model tests | **7/7 PASS** |
| Tổng frontend | **127/127 PASS** |
| Frontend lint | 0 errors; 1 warning import React không dùng trong `App.jsx` |
| Frontend build | PASS; còn cảnh báo bundle JS khoảng 598 kB |
| Backend Foundation + Recruitment + Candidate Profile | **115/117 PASS, 2 FAIL** |
| Backend `npm test` | **318/342 PASS, 24 FAIL** |
| Auth Foundation chạy riêng | **36/43 PASS, 7 FAIL** |
| Presentation source contract | Hooks/handlers/fields/API attributes của 14 file không đổi |
| Browser UI đã lưu | **33 cặp** desktop/tablet/mobile; năm tab profile, filters, pagination, menu, modal/focus, reduced motion; 0 lỗi JavaScript trong lượt đó |
| Dữ liệu trong lượt kiểm tra UI | 0 request ghi nghiệp vụ; primary count/update_seq không đổi |

Không cộng các tổng backend: các bộ có tests trùng nhau; `npm test` backend chưa tự bao gồm `auth-foundation`. Không đếm mọi dòng TAP `not ok` thành test độc lập vì có cả suite cha.

Browser có hai nhóm bằng chứng: các lượt nghiệp vụ có tạo dữ liệu thử trong database cô lập, và lượt theme chỉ đọc dữ liệu/bật tắt CSS. Các ảnh trước/sau dùng cùng DOM/dữ liệu đang hiển thị, không mock để làm đẹp. Kiểm tra chữ trên nền navy ghi nhận mẫu thấp nhất 5.1:1 theo nền tham chiếu bảo thủ của script; không thay cho đánh giá accessibility toàn ứng dụng.

Lệnh tái hiện được lưu trong [review trước gộp dev](dev-handoff-review-2026-10-25.md). Một số script browser cần Chrome/Playwright ở OS temp và credentials local trong `.env`; không phải công cụ đã được đóng gói tự chạy trên mọi máy clone.

## 8. Lỗi hiện tại và việc còn lại

| Vấn đề | Bằng chứng/ảnh hưởng | Việc cần hoàn tất |
| --- | --- | --- |
| **Chi tiết CLOSED không khớp FE/lịch sử** | `JobService.publicDetail` trả 404 cho non-OPEN; `public-jobs.test.js:22` kỳ vọng 200. Candidate từ Dashboard mở tin đã đóng gặp trang không khả dụng | Chốt contract TV1/TV2; giữ public policy phù hợp và có đường đọc lịch sử theo quyền; đồng bộ API/FE/test, không chỉ đổi assertion |
| **Public detail thiếu logo** | `recruiter-enhancements.test.js:56` nhận `company_logo_url=undefined`; JobDetails dùng field đó nên rơi về icon mặc định | Bổ sung DTO logo an toàn, giữ fields/layout mới của dev; kiểm tra asset upload và URL cũ |
| **Bộ dữ liệu/ETL chưa xanh** | Thiếu release/staged, checksum working copy không khớp, thiếu `pyarrow`; thuộc các failure trong full backend | Xử lý trong phạm vi dữ liệu/môi trường; không sửa snapshot/checksum hoặc skip test để làm xanh |
| **7 lỗi Auth** | 1 ở `auth-routes.test.js`, 6 ở `recruiter-registration.test.js`; kỳ vọng contract tổ chức cũ không khớp triển khai hiện tại | TV1 đối chiếu lại contract, service và tests; kiểm tra thêm topology directory/private với TV2 |
| **Interview/scoring chưa nối đầy đủ** | Hook phân tích chưa được truyền vào cấu hình mặc định; thiếu luồng Interview thật hoàn chỉnh để nghiệm thu OFFER/HIRED | TV3 cung cấp API/UI, evidence đúng attempt và scoring/freshness/readback; kiểm thử liên thành viên |
| **Artifact local chưa vào Git** | Hai thư mục `docs/dev-merge-repair-verification/` và `docs/surface-polish-verification/` còn untracked | Chọn bộ bằng chứng cần chia sẻ hoặc điều chỉnh link; tránh bản clone thiếu baseline/gallery/JSON mà script/report tham chiếu |
| **Giới hạn mở rộng** | Chưa có dọn upload mồ côi, indexed full-text search, queue/retry worker scoring | Ghi rõ phạm vi MVP; triển khai riêng khi được giao, không ghi là đã hoàn thành |

**Chưa khuyến nghị merge như bản đã nghiệm thu đầy đủ.** Có thể mở PR để nhóm review phần đã triển khai, kèm danh sách lỗi/phụ thuộc và điều kiện nghiệm thu rõ ràng.

## 9. Quy tắc cũ được thay thế hoặc cần đọc theo thời điểm

| Ghi nhận trong tài liệu cũ | Trạng thái dùng cho báo cáo hiện tại |
| --- | --- |
| WITHDRAWN không bao giờ được nộp lại | Cho attempt mới sau WITHDRAWN nếu đủ điều kiện; history của attempt cũ vẫn terminal |
| CLOSED không được mở lại | Chủ sở hữu được reopen bằng status command, revision và deadline hợp lệ |
| Form công ty nhập URL logo | Form mới upload ảnh từ máy; vẫn tương thích URL lịch sử |
| CV chỉ nhận text | Nhận text hoặc file hợp lệ; có dùng CV từ hồ sơ |
| Bấm CV để tải xuống | Có xem trong trình duyệt và download tách biệt |
| Public filter chỉ trên page đã tải | Filter/scan ở backend theo contract; chưa phải indexed full-text search |
| `has_more` chỉ dựa page đầy | Repository đã lookahead; catalog cursor còn gắn nguồn và filters |
| Chưa có Identity/tài khoản thật | Local Candidate/Recruiter đã kiểm chứng bằng Identity thật; không suy rộng ra mọi tổ chức/luồng đăng ký |
| Website dùng JWT trong Web Storage | Memory-only theo Auth hiện tại; không khôi phục localStorage để bỏ qua policy |
| Profile đi về Dashboard hoặc `/users/me` | Candidate dùng `/profile` + `/candidate/profile/me`; Recruiter có `/recruiter/profile` riêng |
| API public luôn đọc CLOSED | Không còn đúng sau merge hiện tại; đây là lỗi contract phải xử lý, không được tiếp tục ghi đã đạt |
| “Backend liên quan 116/116 đạt” | Kết quả mới là 115/117; phải dùng số mới để đánh giá mốc `04e07a8` |
| Giao diện JobPortal cũ, nền xanh nhạt | Brand RecruiHub; giữ Public List/Details mới của dev, theme navy chỉ trong phạm vi đã chỉnh |

Các mô tả “chưa commit/push”, port 5002/5174, JWT/env hoặc trạng thái DRAFT trong report cũ là snapshot tại thời điểm viết. Cấu hình đang dùng ưu tiên code/env hiệu lực và ghi nhận mới; không sao chép các ví dụ cũ làm hướng dẫn bắt buộc cho mọi máy.

## 10. Checklist bàn giao và nghiệm thu tiếp

1. Xử lý hai lỗi tích hợp CLOSED/logo, bổ sung hoặc giữ regression tương ứng; chạy lại nhóm bị ảnh hưởng.
2. Chốt contract tổ chức giữa TV1/TV2 cho Recruiter mới; giữ ownership và database isolation.
3. Rà lại các file phối hợp Profile/Public Portal với TV1, bảo toàn giao diện và chức năng mới từ dev.
4. Chọn artifact báo cáo/ảnh/JSON để bàn giao; không đưa `.env`, mật khẩu, token hoặc dependencies local vào Git.
5. Tách xử lý lỗi ETL/release và Auth theo chủ phân hệ; ghi kết quả thực tế, không biến full suite đang fail thành PASS trong summary.
6. Ghép Interview/scoring TV3, chạy luồng mới Apply → Interview thực → OFFER → acceptance → HIRED; kiểm tra attempt/freshness/history và quyền.
7. Nghiệm thu lại tạo/sửa/đóng/mở/xóa mềm Job; nộp/rút/nộp lại; stale revision/hai tab; CV cũ/mới; filters/pagination; desktop/tablet/mobile.

Summary phù hợp khi mở PR review:

```text
feat(tv2): extend recruitment workflows and polish portal UI

- Extend Job creation/edit/status, compensation, reopen and soft deletion.
- Support apply/withdraw/reapply with immutable CV and attempt history.
- Add scoped CV/image uploads, browser previews and profile validation.
- Add five-item dashboards and integrate the latest dev portal UI.
- Polish seven pages with navy/indigo surfaces and responsive interactions.
- Add regression coverage and verification handoff.

Pending: CLOSED history contract, public detail logo, shared Auth/ETL failures
and TV3 Interview/scoring integration. Full backend acceptance is not complete.
```

## 11. Danh mục 16 tài liệu TV2 đã đọc

| Tài liệu | Nội dung được tổng hợp / cách sử dụng |
| --- | --- |
| [RP-TV2-consolidated.md](RP-TV2-consolidated.md) | Lịch sử review hậu merge, P1/P2/P3 và hướng dẫn tích hợp TV1/TV2 |
| [frontend-template-restoration.md](frontend-template-restoration.md) | Khôi phục layout giai đoạn đầu, phân biệt fixture/live, xử lý Vite màn hình trắng |
| [public-jobs-live-verification.md](public-jobs-live-verification.md) | Điều tra dataset/query, phục hồi release hợp lệ, index và bằng chứng public thật |
| [recruitment-it-template-handoff.md](recruitment-it-template-handoff.md) | Đúng phiên bản tham khảo IT, navigation/context/stats và ma trận bảy UC giai đoạn trước Identity |
| [merge-dev-review-2026-10-25.md](merge-dev-review-2026-10-25.md) | Quyết định giữ/ghép UI, Auth/Public Search và giới hạn database sau merge |
| [public-jobs-after-merge-fix.md](public-jobs-after-merge-fix.md) | Sửa nguồn đọc public bị buộc dùng private database, không coi lỗi cấu hình là mất dữ liệu |
| [local-recruiter-testing.md](local-recruiter-testing.md) | Provision tài khoản local, scope tổ chức và kiểm chứng tạo/sửa/đăng tin thật |
| [local-candidate-testing.md](local-candidate-testing.md) | Candidate thật, catalog hai nguồn, Apply/readback; quy tắc không nộp lại trong bản này là lịch sử |
| [recruihub-catalog-lifecycle-handoff-2026-10-25.md](recruihub-catalog-lifecycle-handoff-2026-10-25.md) | Metadata/filter, attempt/idempotency, reopen, scope Interview theo attempt |
| [recruiter-ui-enhancements-2026-10-25.md](recruiter-ui-enhancements-2026-10-25.md) | Cấp bậc, loại hợp đồng, lương, soft delete, profile công ty; form URL logo đã được upload thay thế |
| [file-upload-handoff-2026-10-25.md](file-upload-handoff-2026-10-25.md) | Attachment bất biến, validation, quyền đọc, avatar/logo/CV và giới hạn lưu trữ |
| [cv-profile-pagination-handoff-2026-10-25.md](cv-profile-pagination-handoff-2026-10-25.md) | Sửa PDF, browser preview, năm tab profile, Dashboard 5 mục |
| [profile-validation-home-handoff-2026-10-25.md](profile-validation-home-handoff-2026-10-25.md) | Validation hai vai trò, dữ liệu cũ, banner/home card từ API thật |
| [TV2-review-and-commit-summary-2026-10-25.md](TV2-review-and-commit-summary-2026-10-25.md) | Tổng hợp bảy UC trước merge mới; các số test/kết luận đạt phân hệ cần đọc theo thời điểm |
| [dev-merge-repair-2026-10-25.md](dev-merge-repair-2026-10-25.md) | Sửa import/state/filter/CV sau merge; câu mô tả đọc CLOSED phải đối chiếu lỗi Backend hiện tại |
| [dev-handoff-review-2026-10-25.md](dev-handoff-review-2026-10-25.md) | Nguồn kết quả test mới nhất tại HEAD `04e07a8`, hai lỗi tích hợp và điều kiện gộp dev |

Tài liệu bổ sung đã đọc/đối chiếu: [triển khai Job/Application](../../job-application-implementation.md), [phân công nhóm](../../recruithub-team-work-assignment.md), [Foundation TV2/TV3](../../shared/TV2_TV3_FOUNDATION_HANDOFF.md), [contract tổ chức TV1/TV2](../../shared/TV1_TV2_RECRUITER_SCOPE_CONTRACT_DRAFT.md) và [UI navy/bằng chứng](../../surface-polish-verification/README.md).

Giữ nguyên các tài liệu nguồn để truy vết. Báo cáo này là bản tổng hợp hiện trạng; không thay thế bằng chứng kiểm thử hoặc xác nhận phê duyệt các quyết định liên thành viên còn đang chờ.
