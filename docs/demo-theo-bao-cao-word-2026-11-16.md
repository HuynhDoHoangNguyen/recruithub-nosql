# Kịch bản demo theo use case trong báo cáo Word và hiện trạng hệ thống

Nguồn đối chiếu: [báo cáo Word của nhóm](demo-evidence-2026-11-16/LopT2_Nhom8_XayDungHeThongQLTuyenDungVaPhanTichUngVien_Word.docx), đặc biệt mục 2.3.5, 2.6, 3.5–3.9 và Chương 4. Bản này dùng mã **UC-01 đến UC-16 trong Word**, thay cho bộ mã UC01–UC28 của một số tài liệu source khác. Không sửa file Word gốc.

Đối chiếu ngày 16/11/2026: ba tài khoản đăng nhập HTTP 200; health ready; job thực hành còn hai Application APPLIED. Số liệu tại lần đọc này: database 25.794 documents; Admin có 10.154 user, 10.002 Candidate, 151 Recruiter, 1 Admin; 2.507 job chưa soft-delete gồm 204 OPEN và 2.303 DRAFT. Đây là snapshot, phải đọc lại số trên màn hình khi demo.

## 1. Ma trận use case trong Word và hệ thống hiện tại

| Mã trong Word | Use case | Màn hình/thao tác thực tế | Mức đáp ứng và cách trình bày |
|---|---|---|---|
| UC-01 | Authentication | Login/Register, điều hướng theo role | Có. Ba demo login đã kiểm chứng; đăng ký Candidate/Recruiter có API/UI. Admin được provision bằng operator, không đăng ký công khai. |
| UC-02 | Manage Candidate Profile | Candidate → Cập nhật CV / Profile → Chỉnh sửa hồ sơ → Lưu hồ sơ | Có cập nhật hồ sơ và CV. Dùng các trường thực có; không giới thiệu mọi field của JSON mẫu Word là đã có trên form. |
| UC-03 | Browse / Search Job | Việc Làm IT, từ khóa, kỹ năng, ngành, địa điểm, hình thức, cấp độ, phân trang | Có. Catalog đã kiểm tra không lặp ID. |
| UC-04 | View Job Detail | Chọn thẻ việc làm → chi tiết | Có mô tả/yêu cầu/trạng thái/hạn nộp và thao tác ứng tuyển theo quyền. |
| UC-05 | Apply Job | Candidate → Job Detail → chọn CV → Xác nhận nộp hồ sơ | Có. Kiểm tra OPEN/deadline/quyền/nộp trùng; tạo Application APPLIED. |
| UC-06 | Track / Withdraw Application | Candidate dashboard → timeline/CV/lịch sử → Rút đơn; nộp lại khi hợp lệ | Có; previous attempts được giữ. Withdraw là nhánh trong UC-06 theo Word, không gán một mã UC mới. |
| UC-07 | Manage Job | Recruiter → Tạo/Chỉnh sửa → DRAFT → Đăng tuyển → Đóng/Mở lại | Có, kiểm soát revision và soft-delete. |
| UC-08 | View Applications | Recruiter → Xem ứng viên → lọc stage → Xem CV và xử lý | Có, đúng phạm vi Job thuộc Recruiter. |
| UC-09 | Update Recruitment Pipeline | Duyệt hồ sơ/Mời phỏng vấn/Gửi đề nghị/Xác nhận tuyển dụng/Từ chối | Có, mỗi thao tác phải xác nhận và tuân thủ transition/evidence. |
| UC-10 | Manage Interview | Trong chi tiết hồ sơ → Lịch phỏng vấn → lên lịch → ghi nhận đánh giá | Có cho current attempt. Giao diện nằm trong Application, không phải menu Interview riêng như mọi mockup. |
| UC-11 | Analyze Candidate | Huy hiệu điểm → bảng phân tích → Tính lại điểm | Có engine 50/25/10/15, COMPLETE/INCOMPLETE, freshness. Dữ liệu đầu vào là Candidate Profile có cấu trúc. |
| UC-12 | Rank Candidates | Xem ứng viên → Xếp hạng phù hợp | Có ranking theo Job, chỉ COMPLETE/fresh/hợp lệ và stage đang hoạt động; thêm ID làm tie-break cuối. Không quảng bá bộ lọc HIGH/MEDIUM/LOW riêng nếu UI không có. |
| UC-13 | View Recruitment Dashboard | Recruiter dashboard với Tin đang tuyển/Tổng hồ sơ/Đang phỏng vấn/Đã tuyển | **Có KPI cơ bản**, chưa có dashboard funnel, top skills, nguồn ứng viên, conversion đầy đủ như thiết kế. |
| UC-14 | Manage Users | Admin → Tổng quan → tìm/lọc user → Chi tiết → Khóa/Mở khóa/Reset mật khẩu | **Có quản lý status và xem role**, chưa có đổi role từ UI/API. Admin không được khóa/reset qua chức năng quản trị user MVP thông thường. |
| UC-15 | Manage Company / Department | Có lookup tổ chức khi đăng ký Recruiter và hồ sơ doanh nghiệp của Recruiter | **Chưa có màn hình/API Admin CRUD Company/Department độc lập.** Recruiter sửa thông tin công ty của mình không đồng nghĩa hoàn tất UC-15 của Admin. |
| UC-16 | View System Overview | Admin → Tổng quan, thống kê user/Candidate/role/status/job | Có tổng quan cơ bản. Không tuyên bố UI thống kê đầy đủ chín loại document, sức khỏe cluster hoặc benchmark. |

Word ghi “17 Use Case” ở mục 2.3.1 nhưng mục 2.3.5 đặc tả **16 mã từ UC-01 đến UC-16**. Sơ đồ còn tách Đăng ký/Đăng nhập và Theo dõi/Rút đơn thành các oval riêng, trong khi danh sách đặc tả gộp các thao tác này. Khi trình bày, dùng mã của mục 2.3.5, không tự đặt UC-17; nhóm cần thống nhất lại số lượng/nhóm chức năng trong báo cáo.

## 2. Những chỗ cần nói đúng khi đối chiếu Word

| Nội dung báo cáo | Hiện trạng và cách nói trước thầy |
|---|---|
| Mục 3.7: Backup/Restore bằng Replication | UI Admin hiện dùng file RHBR gzip có chữ ký và validate/restore target riêng. Đây là cơ chế khác với CouchDB `_replicate`. “Báo cáo trình bày phương án replication; bản demo triển khai thêm luồng file có chữ ký. Replication chưa được kiểm chứng trong phiên này.” |
| UC-14 có thay role/status | Demo tìm kiếm, xem role và khóa/mở status. “Thay role chưa được mở trong MVP hiện tại.” |
| UC-15 Admin quản lý tổ chức | Trình bày Should Have/chưa triển khai đủ; có thể cho xem document Company/Department và lookup, không gọi đó là CRUD Admin. |
| UC-13 KPI, funnel, charts | Chỉ chỉ ra bốn KPI đang có; funnel/top skills/conversion/source analytics là phạm vi còn thiếu. |
| UC-11 thiếu input thì dừng/báo lỗi | Source phân biệt INCOMPLETE và ghi missing inputs; không tạo tổng điểm giả, ranking loại trường hợp chưa đủ điều kiện. |
| Mục 2.6.10 tie-break | Thực tế: total_score DESC → skill DESC → applied_at ASC → application ID ASC; loại stage kết thúc, stale và dữ liệu không hợp lệ. |
| Chương 4 số liệu 12–13/11, còn FAIL | Là snapshot lịch sử. Dùng phụ lục evidence 16/11 cho kết quả mới, không nói các lượt cũ đã PASS và không cộng test trùng phạm vi thành tỷ lệ chung. |
| Bảng 4.1 ghi Node.js 24.18.0 | Lượt kiểm thử local 16/11 dùng Node.js 22.23.4. Ghi rõ máy/phiên chạy khi so sánh, không gọi phiên bản trong Word là môi trường hiện tại. |
| Bảng 3.2 endpoint thiết kế `/api/...` | Source chạy `/api/v1/...`; khi mở Network đọc request thật, không gõ endpoint minh họa trong Word rồi coi lỗi 404 là lỗi UI. |
| JSON mẫu và ID trong Word | Là thiết kế. Runtime có `profile.full_name`, `account_status`, ID User xác định từ email, Application theo pair và analysis theo application. Không sửa document thật theo JSON minh họa cũ. |
| Skills, scoring, CV | Engine dựa trên profile có cấu trúc; upload/xem CV không đồng nghĩa hệ thống đã hiểu CV bằng OCR/LLM. |
| ERD và bảng entity | ERD là khái niệm. SKILL được nhúng/chuẩn hóa; không cần giả định mỗi entity là một bảng hoặc collection vật lý. |

## 3. Chuẩn bị phiên demo

Mở `http://127.0.0.1:5178` ở ba tab, dùng ba email chính trong [bảng tài khoản local](demo-accounts.local.md). Tab thứ tư dành cho Fauxton `http://127.0.0.1:5984/_utils/`. Tài khoản quản trị CouchDB khác tài khoản website Admin.

Điều hướng bằng menu/liên kết trong app. Token lưu trong bộ nhớ; F5 hoặc điều hướng tải lại toàn trang cần login lại. Token TTL 15 phút; đăng nhập từng vai trò gần lúc cần trình bày. Audit worker cần chạy bằng `npm run audit:watch` tại backend để thao tác mới hiện trong audit viewer.

Chuẩn bị một CV PDF của bạn để trình diễn upload (CV giả lập tạm đã được dọn). Hai job có mục đích rõ ràng:

- **Job mới của buổi trình bày:** đặt tên `DEMO BAO CAO NHOM 8 - [ngày]`. Dùng để tạo mới, ứng tuyển mới, rút/nộp lại và chạy Pipeline đến HIRED.
- **Job xếp hạng có sẵn:** `DEMO Thực hành trước lớp 2026-11-16T03-13-33.251Z`, ID `job:010e40ff-c171-4c2f-a9e4-e10289ebf13b`. Có hai Candidate APPLIED, điểm 100% và 75,83% (UI 76%). Dùng minh họa ranking, không cần tạo thêm Candidate giữa buổi.

Mỗi lần diễn tập lưu thật trạng thái và dữ liệu. Nếu job buổi trước đã HIRED, tạo job mới cho lượt diễn tiếp; không sửa document để ép quay về APPLIED.

## 4. Kịch bản theo từng cảnh trên giao diện

### Cảnh 1 Giới thiệu và xác thực — UC-01 — 2 phút

**Báo cáo:** mục 1.3, 1.5, 2.3.5, ACT-01.

**Bấm:** Mở trang chủ → Đăng nhập → lần lượt dùng Candidate, Recruiter, Admin trong ba tab; chỉ ra dashboard khác nhau. Nếu thầy yêu cầu nhánh lỗi, nhập sai mật khẩu một lần rồi sửa đúng.

**Nói:** “Hệ thống có ba actor theo báo cáo. React gọi Express REST API; backend kiểm tra tài khoản, vai trò và quyền sở hữu trước khi truy cập CouchDB. Admin được cấp bởi operator; form đăng ký công khai chỉ phục vụ Candidate/Recruiter.”

**NoSQL:** User là document riêng, mật khẩu được hash. Backend giữ credentials database; frontend không truy cập CouchDB trực tiếp. Không trình chiếu `.env` hoặc password hash.

### Cảnh 2 Recruiter xem tổng quan và tạo tin — UC-13, UC-07 — 3 phút

**Báo cáo:** UC-07/UC-13, ACT-04, mục 2.5.6 và 2.5.9.

**Bấm:** Recruiter → Bảng Điều Khiển → chỉ bốn KPI → Tạo tin tuyển dụng. Nhập tên job mới ở trên; ngành Công nghệ thông tin; Hà Nội/Hybrid; mô tả ngắn; kỹ năng bắt buộc `JavaScript, Node.js, CouchDB`; ưu tiên `Docker`; yêu cầu 24 tháng kinh nghiệm, Cử nhân, dự án `Node.js, CouchDB`; hạn nộp trong tương lai. Lưu nháp bằng **Tạo tin tuyển dụng** → Chỉnh sửa → Lưu thay đổi → **Đăng tuyển**.

**Nói:** “UC-07 quản lý vòng đời tin DRAFT/OPEN/CLOSED. UC-13 hiện đã có KPI cơ bản; các biểu đồ funnel, top skills và conversion trong thiết kế chưa được hiện thực đầy đủ.”

**NoSQL:** Job nhúng mảng kỹ năng và object yêu cầu; tham chiếu Recruiter/Company/Department. Thông tin tổ chức hiển thị trên UI không chứng minh runtime đang nhúng snapshot đúng như JSON thiết kế; backend có bước đọc/enrich dữ liệu tổ chức.

### Cảnh 3 Candidate quản lý hồ sơ và tìm việc — UC-02, UC-03, UC-04 — 3 phút

**Báo cáo:** ACT-02, ACT-03, mục 2.5.2–2.5.4 và 2.6.7.

**Bấm:** Candidate → Cập nhật CV / Profile → **Chỉnh sửa hồ sơ** → đổi một thông tin liên hệ → **Lưu hồ sơ**. Cho xem skills/experience/education/projects và CV; giữ các dữ liệu chấm điểm đã chuẩn bị. Chọn **Tìm việc mới** → tìm tên job mới → thử địa điểm/kỹ năng → mở chi tiết.

**Nói:** “Candidate Profile có dữ liệu bán cấu trúc: mỗi người có số kỹ năng, kinh nghiệm và dự án khác nhau. Các phần được đọc cùng nhau được nhúng trong Candidate; Zod vẫn kiểm tra cấu trúc và quy tắc dữ liệu.”

**NoSQL:** Phân biệt flexible schema với không validation. Job List là truy vấn theo access pattern; phân trang sử dụng bookmark. Tìm kiếm từ khóa hiện không phải một search engine full-text độc lập.

### Cảnh 4 Nộp đơn và theo dõi — UC-05, UC-06 — 3 phút

**Báo cáo:** UC-05/UC-06, ACT-03, mục 2.5.5.

**Bấm:** Job mới → ứng tuyển → chọn CV từ hồ sơ hoặc PDF mẫu → **Xác nhận nộp hồ sơ**. Về Candidate dashboard → mở **Xem chi tiết, CV và lịch sử** → xem APPLIED và CV. Bấm **Rút đơn ứng tuyển**, xác nhận → **Xem việc làm** → **Ứng tuyển lại** → xác nhận. Mở lịch sử để chứng minh lần rút trước được giữ lại.

**Nói:** “Application giải quan hệ nhiều-nhiều giữa Candidate và Job. Backend kiểm tra tin đang mở, còn hạn và chống nộp trùng đơn hoạt động. Theo báo cáo, Withdraw là nhánh có điều kiện trong UC-06. Nộp lại giữ previous attempts thay vì xóa dấu vết lần trước.”

**NoSQL:** Mở document Application cùng ID với phản hồi Network nếu cần chứng minh UI → API → DB. `stage_history` được nhúng; Candidate/Job được tham chiếu bằng ID. Không gọi mọi lần nộp lại là một document độc lập mới: implementation giữ deterministic pair ID và archive attempt.

### Cảnh 5 Recruiter xem hồ sơ và phân tích — UC-08, UC-11, UC-12 — 4 phút

**Báo cáo:** ACT-07, mục 2.6.8–2.6.10, Bảng 2.5.

**Bấm:** Recruiter → job mới → **Xem ứng viên** → lọc trạng thái → **Xem CV và xử lý** → xem CV. Bấm huy hiệu điểm → xem matched/missing skills, các thành phần và freshness; dùng **Tính lại điểm** nếu cần. Sau đó về dashboard, mở **job xếp hạng có sẵn** → **Xếp hạng phù hợp** để chỉ hai hồ sơ 100% và 76%. Cuối cảnh quay lại job mới để tiếp tục Pipeline.

**Nói:** “UC-11 tính kết quả phân tích; UC-12 xếp hạng trong một Job, không phải quản lý Candidate độc lập. Công thức đúng theo báo cáo và source là 50% kỹ năng, 25% kinh nghiệm, 10% học vấn và 15% dự án. Ví dụ trong Word: 80/90/70/85 cho tổng 82,25; kết quả trên màn hình là tính từ dữ liệu demo thực tế nên không nhất thiết bằng ví dụ đó.”

**NoSQL:** `resume_analysis` là dữ liệu dẫn xuất, lưu riêng theo Application để đọc lại/tái tính. Fingerprint phát hiện input thay đổi; INCOMPLETE/stale không được đưa vào ranking như COMPLETE/fresh. Ranking hiện thu thập/lọc và sort ở backend, không phải toàn bộ là một Mango sort như thiết kế AQ1. Tie-break cuối là application ID để ổn định.

### Cảnh 6 Xử lý Pipeline và Interview — UC-09, UC-10 — 4 phút

**Báo cáo:** ACT-05/ACT-06; Application Detail/Recruitment Pipeline và Interview.

**Bấm:** Với hồ sơ ở job mới: **Duyệt hồ sơ** → **Xác nhận chuyển trạng thái** → **Mời phỏng vấn** → xác nhận. Trong chi tiết → **Lên lịch phỏng vấn** → chọn Kỹ thuật → chọn đầu phút kế tiếp → **Lưu lịch**. Đến thời gian đã chọn, bấm **Ghi nhận đánh giá vòng 1** → 5 sao → feedback “Ứng viên giải thích được revision conflict và thiết kế index cho truy vấn Application.” → Đạt → **Lưu đánh giá**.

**Lưu ý thời gian:** Nếu vào INTERVIEW lúc 14:30:20, chọn lịch 14:31 rồi chờ đến 14:31 mới hoàn tất feedback. Giao diện nhập tới phút nhưng backend kiểm tra timeline theo timestamp; không chọn 14:30 sớm hơn lúc vào stage.

**Bấm tiếp:** **Gửi đề nghị** → xác nhận → **Xác nhận tuyển dụng** → thời điểm chấp nhận ở đầu phút kế tiếp → chọn Xác nhận bằng văn bản, reference `DEMO-OFFER-001` → tích đã kiểm tra bằng chứng. Đợi đến thời điểm đã nhập rồi **Xác nhận chuyển trạng thái**. Candidate quay về dashboard để thấy HIRED.

**Nói:** “Enum hiện tại là APPLIED → SCREENING → INTERVIEW → OFFER → HIRED, cùng REJECTED và WITHDRAWN. Không thể nhảy APPLIED thẳng HIRED. OFFER cần bằng chứng phỏng vấn hợp lệ; HIRED cần bằng chứng chấp nhận và thời gian hợp lệ.”

**NoSQL:** Lịch sử cập nhật cùng Application; Interview tách riêng do quan hệ một-nhiều và có vòng/lượt ứng tuyển riêng. `_rev` hỗ trợ optimistic concurrency. CouchDB không cung cấp foreign key tự động cho các ID tham chiếu; backend kiểm tra scope và liên kết. Không gọi các bước xuyên nhiều document là một transaction ACID duy nhất.

### Cảnh 7 Admin quản trị và tổng quan — UC-14, UC-16; ghi nhận UC-15 — 3 phút

**Báo cáo:** sơ đồ Admin, mục 2.5.10, UC-14–UC-16 và mục 3.8.

**Bấm:** Admin → Tổng quan → chỉ số và biểu đồ role/status/job. Tìm `candidate2.demo@example.invalid` → Chi tiết/Thao tác → Khóa tài khoản → xác nhận → Mở khóa → xác nhận. Chọn **Vết kiểm toán** → **Áp dụng** để xem các thay đổi vừa tạo. Có thể chỉ Nhật ký hệ thống đang trống nếu không có sự cố; không bịa log.

**Nói:** “UC-14 hiện có tìm kiếm/lọc, xem role, khóa/mở và reset cho tài khoản đủ điều kiện. Đổi role chưa có UI/API. UC-16 đáp ứng tổng quan cơ bản bằng các view hiện có. UC-15 quản lý Company/Department là Should Have và chưa có CRUD Admin độc lập; nhóm trình bày đây là phần chưa hoàn thiện.”

**NoSQL:** Views `_design/tv1_admin_statistics` và `_design/job_application` map/reduce thống kê thực tế. Mango không có GROUP BY như SQL. Audit store tách `recruithub_logs_demo`, có writer/reader và source worker riêng; audit/log là phần triển khai bổ sung, không tự đặt lại số UC trong Word.

### Cảnh 8 Quản trị dữ liệu theo Chương 3 — 3–5 phút

**Import/Export, mục 3.6 và 3.9.3.6:** Recruiter → **Nhập / xuất** → Xuất → nhập từ khóa `DEMO` → **Xem trước số lượng và danh sách** → **Tải file JSON**. Sang Nhập có thể chọn chính file đó → **Xem trước và kiểm tra** để cho thấy các job trùng được bỏ qua. Nếu cần minh họa tạo mới, dùng bản sao file và sửa một title demo, kiểm tra READY rồi confirm; không kỳ vọng file xuất nguyên trạng tạo bản sao trùng. Nhập Job tạo DRAFT; không dùng thao tác import dataset hàng chục nghìn docs để minh họa tính năng Recruiter.

**Backup/Restore, mục 3.7 so với UI hiện tại:** Admin → **Sao lưu & khôi phục** → nguồn audit nhỏ → **Tạo bản sao lưu** → Hoàn tất → tải file. Chọn file vừa tải → **Tải lên và kiểm tra** → tên target mới `recruithub_restore_nhom8_YYYYMMDD_hhmm` → xem lại/xác nhận restore.

**Nói:** “Word đề xuất backup bằng replication. Luồng UI hiện tại là archive RHBR có chữ ký: export, validate và restore sang database riêng tư mới. Đây là hai phương án khác nhau. Phiên kiểm chứng 16/11 đã phục hồi 25.790 documents, index và hai attachments bằng archive, không ghi đè recruitment_db và không tự cutover.”

Nếu thầy yêu cầu đúng replication: mở chức năng Replication trong Fauxton để giải thích source/target/one-shot và nêu rõ chưa chạy trong bằng chứng 16/11; cần một bài nghiệm thu replication riêng trước khi nói đã hoàn thành mục này. Không đổi tên demo archive thành replication.

## 5. Phần NoSQL với Fauxton theo mục 2.6 và 3.5

Trong lúc chờ lịch/offer tới phút đã chọn, có thể trình bày phần này thay vì chờ im lặng.

1. Mở `recruitment_db`, đọc doc_count hiện tại; phân biệt tổng docs gồm design docs với business docs. Số 25.785 trong Word là khảo sát 13/11, không ép runtime phải khớp.
2. Mở Candidate demo: chỉ `profile`, các mảng được nhúng, `data_availability`; giải thích Embed theo access pattern. Không giới thiệu certificates/social_links hay các field của ví dụ Word là đã có UI nếu source không có.
3. Mở đúng Application của thao tác vừa làm: chỉ ID tham chiếu, current_stage, stage_history, previous_attempts, `_rev`. ERD là mô hình khái niệm, không có foreign key vật lý tự động.
4. Mở Interview và resume_analysis liên quan: một-nhiều cho Interview, analysis hiện hành xác định theo Application; điểm dẫn xuất có thể tính lại.
5. Xem indexes/design documents đang có; tên thực tế khác các tên `idx_*` đề xuất trong Word. Chỉ đúng index hiện có, không tạo index mới chỉ vì ảnh thiết kế có tên khác.
6. Chạy Mango ở dưới, rồi Explain để chứng minh lựa chọn index. Có index chưa đủ: selector/sort phải phù hợp; không suy ra hiệu năng tối ưu từ một lần trả HTTP 200.

File [word-mango-queries.json](demo-evidence-2026-11-16/word-mango-queries.json) có bốn truy vấn đã thay ID demo thật. Trong Fauxton Mango Query, chỉ copy object bên trong tên truy vấn; không paste cả object chứa bốn truy vấn.

| Bảng 3.4 trong Word | Cách trình bày và kết quả kiểm tra 16/11 |
|---|---|
| Q1 Job OPEN | Query đã căn selector/sort với `public_jobs_created_v2`; 5 docs, Explain dùng JSON index. |
| Q4 Application theo Job | Dùng job demo, điều kiện applied_at và sort phù hợp `job_applications`; 2 docs, Explain dùng index đó. |
| Q5 Application theo Candidate | Dùng Candidate demo, điều kiện applied_at và sort phù hợp `candidate_applications`; 4 docs, Explain dùng index đó. |
| AQ8 COMPLETE score ≥80 theo Job | Query trả 1 doc nhưng Explain dùng `_all_docs`, còn cảnh báo thiếu matching index. Trình bày là truy vấn chức năng, chưa tối ưu. |
| AQ1 Ranking | UI/backend có ranking; thuật toán thực tế lọc/tải theo Application và sort xác định, không khẳng định query sort minh họa Word là implementation. |
| AQ2, AQ3 | Hồ sơ nhiều kỹ năng và missing skills có dữ liệu; không có đủ bằng chứng rằng tất cả tổ hợp analytics trong bảng đã thành endpoint/UI riêng. |
| AQ4–AQ7 | Top skills, conversion và hiệu quả nguồn Candidate là thiết kế/phát triển tiếp; dashboard hiện chưa có đủ các biểu đồ đó. |

Kết quả `_find`/`_explain` tại [word-mango-results.json](demo-evidence-2026-11-16/word-mango-results.json) giữ cả lần selector ban đầu fallback và lần căn theo index, giúp giải thích tại sao cần kiểm tra access pattern thay vì chỉ liệt kê index.

## 6. Lời kết và trả lời khi thầy đối chiếu báo cáo

“Nhóm em đã hiện thực xương sống Candidate–Job–Application–Pipeline–Interview–Analysis–Ranking và quản trị tài khoản cơ bản. Các kết quả mới được ghi nhận ngày 16/11 trên môi trường local: backend 737 PASS, 0 FAIL, 9 SKIP; frontend 255 Vitest và 7 Node PASS; bảy integration Docker/CouchDB bổ sung PASS. Vòng đời nghiệp vụ và full backup/restore được chạy qua API thật; các dashboard, CV/lịch sử, ranking, audit và tạo backup đã được quan sát trên trình duyệt. Nhóm chưa khẳng định mọi nhánh UI end-to-end, tải đồng thời hoặc hiệu năng production đều đã được nghiệm thu.”

“Các phần còn thiếu so với thiết kế là Admin đổi role, CRUD Company/Department, dashboard analytics đầy đủ và bài kiểm chứng replication. Scoring hiện dựa trên profile có cấu trúc, không dùng OCR/LLM. Nhóm trình bày rõ phần đã chạy, phần mới có thiết kế và phần phát triển tiếp.”

Chương 4 của Word giữ kết quả ngày 12–13/11 (Backend 329 PASS/26 FAIL/1 SKIP; Frontend 122 PASS/15 FAIL). Đó là lịch sử, không xóa giá trị của evidence mới và cũng không tự biến thành kết quả PASS. Khi nộp báo cáo, nên bổ sung bản cập nhật theo ngày ở các bảng 3.8, 4.1–4.5 và phần kết luận; bản kịch bản này không tự sửa nội dung Word.

## 7. Checklist đối chiếu trước khi trình bày

- Đánh số theo UC-01–UC-16 ở Word; ghi nhận bất nhất “17” với danh sách 16 mã.
- Candidate: UC-01–UC-06; Recruiter: UC-01, UC-07–UC-13; Admin: UC-01, UC-14–UC-16.
- Không gán mã UC27/UC28 của source cho Word; import/export/audit/backup được giới thiệu theo chương chức năng tương ứng.
- UC-13/UC-14/UC-16 có phần đáp ứng giới hạn; UC-15 chưa có CRUD Admin.
- Không gọi RHBR archive là replication; không nói OCR/LLM đã chấm nội dung CV.
- Không đưa số test cũ hoặc số dataset đề xuất thành số runtime hiện tại.
- Giữ khác biệt rõ giữa kiểm chứng API toàn luồng, các màn hình đã kiểm tra và mọi nhánh UI chưa kiểm chứng hết.
