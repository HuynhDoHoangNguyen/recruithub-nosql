# Kịch bản demo RecruiHub NoSQL cho giảng viên

> **Bản bám báo cáo Word:** ưu tiên [kịch bản theo UC-01–UC-16 và ma trận thực trạng](demo-theo-bao-cao-word-2026-11-16.md). Các mã UC ở bản này đã được đối chiếu theo mục 2.3.5 của Word; import/export/audit/backup được trình bày theo các chương và phần mở rộng, không tự gán mã UC của bộ tài liệu source khác.

Thời lượng đề xuất: 20–25 phút, cộng 5 phút hỏi đáp. Cập nhật sau sửa lỗi và nghiệm thu local ngày 16/11/2026: vòng đời tuyển dụng, hai Candidate, ba vai trò, audit, import/export và backup/restore đã được chạy bằng HTTP/Auth/CouchDB thật. Trình duyệt đã kiểm tra các dashboard, CV/lịch sử, xếp hạng, audit và tạo backup. Chưa thực hiện mọi thao tác nghiệp vụ bằng click UI; xem [báo cáo nghiệm thu](reports/integration/RP-demo-ready-2026-11-16.md) để phân biệt phạm vi.

## Bắt đầu nhanh với dữ liệu đã chuẩn bị

- Ứng dụng: `http://127.0.0.1:5178`.
- Tài khoản: `candidate.demo@example.invalid`, `recruiter.demo@example.invalid`, `admin.demo@example.invalid`. Mật khẩu ở [file local được Git ignore](demo-accounts.local.md), không trình chiếu `.env`.
- Job thực hành còn hai hồ sơ APPLIED: `job:010e40ff-c171-4c2f-a9e4-e10289ebf13b`, tiêu đề bắt đầu **DEMO Thực hành trước lớp 2026-11-16T03-13-33.251Z**. Recruiter → Xem ứng viên → Xếp hạng phù hợp: 100% và khoảng 75,83% (UI làm tròn 76%).
- Job đã chạy tới HIRED: `job:9cc9698a-1f11-4124-9932-da898392e69a`. Candidate dashboard có thể mở lại timeline và CV để chứng minh kết quả.
- Chuẩn bị một CV PDF của bạn để trình diễn upload; CV mẫu tạm đã được dọn.
- Database phục hồi đã xác minh: `recruithub_restore_demo_1794798948001`, 25.790 documents; bao gồm index và hai attachments. Ứng dụng vẫn dùng `recruitment_db`.
- Tạo và tải backup mới từ giao diện khi cần trình diễn validate/restore; bản backup tạm đã được dọn. Chỉ cần dùng nguồn audit nhỏ khi trình diễn nhanh; backup/validate/restore toàn dataset mất vài phút.
- Kết quả kiểm thử tổng hợp: [verification-summary.json](demo-evidence-2026-11-16/verification-summary.json). Các file kết quả chi tiết tạm đã được dọn.

Chạy lại sau khi khởi động máy: `docker compose up -d` tại root; `npm start` và `npm run audit:watch` trong hai terminal backend; `npm run dev` trong terminal frontend. Các tài khoản demo đã tạo vẫn nằm trong database. Script tạo/kiểm thử demo đã được dọn; không cần chạy lại để mở website. Tạm dừng audit worker và các thao tác ghi khi đang trình diễn backup business để tránh `SOURCE_CHANGED`; bật lại worker sau đó.

## 1. Chuẩn bị trước buổi demo

- Khởi động Docker/CouchDB, backend port 5000 và frontend `http://127.0.0.1:5178`.
- Kiểm tra `http://127.0.0.1:5178/api/health/database` trả `ready`.
- Chuẩn bị ba phiên trình duyệt riêng cho Candidate, Recruiter và Admin; không dùng tài khoản quản trị CouchDB để đăng nhập website.
- 10.150 user release gốc vẫn `RESET_REQUIRED`. Đã tạo riêng hai Candidate, một Recruiter và một Admin ACTIVE cho demo; không kích hoạt hàng loạt user lịch sử. Admin được tạo bằng script operator, không từ form đăng ký công khai.
- Chuẩn bị CV mẫu giả lập PDF/DOC/DOCX dưới 5 MB; dùng thông tin demo, không dùng CV thật của người khác.
- Chọn một Company/Department có sẵn cho Recruiter và ghi lại ID job do Recruiter đó sở hữu.
- Tạo ít nhất hai Candidate ứng tuyển cùng job để có dữ liệu xếp hạng. Chuẩn bị một đơn riêng cho thao tác rút/nộp lại, tránh làm mất ứng viên của luồng tuyển thành công.
- Chọn job còn hạn tại ngày trình bày. Không dùng số lượng hoặc hạn nộp từ ảnh lịch sử.
- Catalog đã kiểm chứng 204/204 ID duy nhất, không trùng; con số có thể tăng nếu tạo thêm job demo.
- Audit đã provision `recruithub_logs_demo`, tài khoản writer/reader/pruner và source worker riêng; cần giữ `npm run audit:watch` hoạt động để audit mới được giao sang kho log.
- Không refresh tab giữa các bước đã đăng nhập: token hiện lưu trong bộ nhớ, reload cần đăng nhập lại; token có TTL 15 phút, nên đăng nhập từng vai trò ngay trước phần trình bày.

## 2. Mở đầu — 1 phút

**Lời nói:** “Nhóm em xây dựng RecruiHub để quản lý một quy trình tuyển dụng: đăng tin, ứng tuyển, sàng lọc, phỏng vấn và theo dõi kết quả. Điểm nhấn của môn NoSQL là cách lưu hồ sơ linh hoạt dưới dạng JSON documents, truy vấn bằng Mango/index và tổng hợp bằng MapReduce views.”

**Thao tác:** Mở trang chủ, giới thiệu ba vai trò Candidate, Recruiter, Admin.

## 3. Kiến trúc và CouchDB — 3 phút

**Thao tác:** Mở sơ đồ kiến trúc trong `ARCHITECTURE.md`; mở Fauxton `http://127.0.0.1:5984/_utils/` và database đã cấu hình. Đăng nhập trực tiếp khi cần, tránh trình chiếu `.env` có secret.

**Lời nói:** “React gửi yêu cầu tới Express REST API. Backend xác thực JWT, kiểm tra vai trò và dữ liệu Zod trước khi truy cập CouchDB. Frontend không giữ mật khẩu CouchDB.”

Chọn lần lượt một document `candidate`, `job`, `application`, `interview`, `resume_analysis`. Chỉ rõ:

1. `_id` nhận diện document, `type` phân loại nghiệp vụ.
2. `_rev` dùng khi cập nhật để phát hiện xung đột phiên bản.
3. Candidate có cấu trúc lồng và mảng kỹ năng/học vấn/dự án; trường availability biểu diễn dữ liệu còn thiếu.
4. Application tham chiếu Candidate/Job bằng ID; `stage_history` giữ lịch sử trong cùng document.
5. Quan hệ không có foreign key vật lý như SQL; backend chịu trách nhiệm kiểm tra tham chiếu và quyền sở hữu.

Mở `_index`/design documents, chỉ index tuyển dụng và view `_design/job_application`; thống kê tài khoản dùng `_design/tv1_admin_statistics`. Đọc số thực tế trên màn hình; 25.750 là business release baseline, doc_count còn chứa design docs. Không tuyên bố đã có một view tổng quát thống kê mọi loại nếu chưa kiểm chứng.

## 4. Khách và tìm việc — 2 phút (Word UC-03–UC-04)

**Thao tác:** `/jobs` → tìm theo từ khóa → mở bộ lọc → chọn kỹ năng/ngành/địa điểm theo dữ liệu đang có → chuyển trang → mở chi tiết một job → xóa bộ lọc để trả về danh sách.

**Lời nói:** “Người chưa đăng nhập vẫn xem được các tin đang mở. Kết quả lấy từ CouchDB qua API, có phân trang và bộ lọc. Khi chọn nhiều kỹ năng, điều kiện kỹ năng là AND theo contract hiện hành.”

**Chứng minh:** Job detail có nội dung và yêu cầu; bấm ứng tuyển khi chưa đăng nhập dẫn tới luồng đăng nhập. Có thể mở Network cho thấy `/api/v1/jobs`, không lộ credentials database.

## 5. Recruiter tạo cơ hội — 3 phút (Word UC-01, UC-07, UC-13)

**Thao tác:** Đăng nhập Recruiter → `/recruiter/profile` để xem hồ sơ/công ty → `/recruiter/jobs/create` → nhập job “Demo Backend NoSQL” → kỹ năng theo form, kinh nghiệm, học vấn/dự án nếu form hỗ trợ, loại hợp đồng, địa điểm, lương, hạn nộp ở tương lai → lưu DRAFT → sửa → mở OPEN.

**Lời nói:** “Tin nháp được nhà tuyển dụng quản lý trước khi công khai. Hệ thống kiểm tra dữ liệu và gắn tin với tổ chức của người đang đăng nhập.”

**Chứng minh:** DRAFT xuất hiện trong dashboard của chủ tin; OPEN xuất hiện ở public catalog. Dùng job này xuyên suốt, ghi lại ID. Không dùng tài khoản Recruiter khác để sửa job không sở hữu.

## 6. Candidate hoàn thiện hồ sơ và nộp CV — 3 phút (Word UC-01, UC-02, UC-05–UC-06)

**Thao tác:** Đăng nhập Candidate → `/profile` → cập nhật kỹ năng, kinh nghiệm, học vấn/dự án, liên hệ → upload CV → mở lại job demo → nộp hồ sơ → `/user/dashboard` → mở timeline và CV đã nộp.

**Lời nói:** “CV đính kèm và dữ liệu hồ sơ được kiểm tra trước khi lưu. Mỗi đơn gắn với ứng viên và job; lịch sử trạng thái giúp ứng viên theo dõi kết quả.”

**Ca kiểm tra:** Thử nộp trùng một đơn còn hoạt động; phải bị chặn. Với đơn phụ đã chuẩn bị, rút đơn và xem trạng thái WITHDRAWN; nếu thực hiện nộp lại, kiểm tra lịch sử attempt và điều kiện UI đang cho phép. Không rút đơn dùng để diễn tiếp phỏng vấn.

## 7. Sàng lọc, tính điểm và xếp hạng — 4 phút (Word UC-08–UC-09, UC-11–UC-12)

**Thao tác:** Recruiter mở `/recruiter/jobs/<id>/applicants` → xem hai hồ sơ vừa nộp → mở CV → yêu cầu tính/cập nhật điểm theo nút hiện có → mở breakdown → mở bảng xếp hạng → chuyển đơn demo từ APPLIED sang SCREENING.

**Lời nói:** “Bộ chấm điểm hiện tại là thuật toán xác định theo quy tắc. Cùng đầu vào và phiên bản thuật toán sẽ cho cùng kết quả; không gọi mô hình ngôn ngữ bên ngoài để bịa điểm.”

**Công thức đúng theo source:**

`total_score = 0.50 × skill + 0.25 × experience + 0.10 × education + 0.15 × project`

Ví dụ minh họa phép tính: 80, 100, 100, 60 tương ứng cho tổng 84. Đây là ví dụ giải thích, không phải kết quả đã đo trên Candidate demo.

**Chỉ trên màn hình:** Kỹ năng khớp/thiếu, thành phần điểm, trạng thái COMPLETE/INCOMPLETE và freshness nếu hiển thị. Hồ sơ thiếu dữ liệu không được xem như đã đủ điều kiện xếp hạng.

**Xếp hạng theo source:** total_score giảm dần → skill giảm dần → applied_at tăng dần → application ID tăng dần. Chỉ các phân tích hợp lệ, COMPLETE, còn fresh và stage đủ điều kiện được đưa vào bảng; các hồ sơ khác có lý do loại.

**Ca kiểm tra:** Nếu có thời gian, cập nhật kỹ năng Candidate rồi xem trạng thái freshness/tính lại. Không hứa điểm luôn tăng: kết quả phụ thuộc toàn bộ input thực tế.

## 8. Phỏng vấn và quyết định — 3 phút (Word UC-09–UC-10)

**Thao tác:** Chuyển đơn SCREENING sang giai đoạn phỏng vấn → tạo lịch với ngày/giờ/hình thức/người phỏng vấn theo form → mở các vòng → nhập feedback/evidence và kết quả → chuyển tiếp theo điều kiện backend cho phép tới offer rồi hired.

**Lời nói:** “Lịch phỏng vấn và bằng chứng đánh giá gắn với đơn ứng tuyển. Các chuyển trạng thái được backend kiểm tra, và lịch sử vẫn được giữ để xem lại.”

Enum lưu thực tế là `APPLIED → SCREENING → INTERVIEW → OFFER → HIRED`, thêm `REJECTED` và `WITHDRAWN` cho nhánh kết thúc. Nhãn tiếng Việt có thể khác enum. Không cố nhảy từ APPLIED sang HIRED để tạo kết quả thành công. Nếu điều kiện feedback hoặc stage chưa đủ, sửa theo thông báo lỗi và giải thích ràng buộc.

Đổi sang Candidate và mở lại dashboard bằng điều hướng trong app để thấy tiến trình được cập nhật.

## 9. Admin, audit, backup/restore — 3–4 phút (Word UC-14, UC-16 và phần mở rộng)

Admin và phụ thuộc đã được chuẩn bị, các API thật và các màn hình quản trị đã được kiểm tra. Có thể dùng tài khoản và file mẫu ở phần bắt đầu nhanh.

**Admin:** `/admin/dashboard` → thống kê thực tế → danh sách user → tìm theo email/role → mở chi tiết → khóa rồi mở lại một tài khoản demo phụ. Không khóa tài khoản đang dùng cho phần chính. Chứng minh Candidate/Recruiter không vào được dashboard Admin.

**Audit/log:** Tạo một thao tác hỗ trợ audit như đổi stage/khóa tài khoản demo, chạy delivery theo tài liệu triển khai, mở tab nhật ký và đối chiếu actor/action/time/subject/correlation ID khi UI có. Không coi system log và audit trail là cùng một loại bản ghi.

**Backup/restore:** Chọn nguồn khả dụng → tạo backup → đợi COMPLETED → tải file RHBR → upload/validate → chọn tên database đích mới theo quy tắc form → xác nhận restore → xem kết quả và mở database mới để đối chiếu. Không chọn database nguồn làm đích, không xóa/ghi đè `recruitment_db`. Nguồn identity có thể báo `DUPLICATE_SOURCE` vì Auth và business cùng database; chọn nguồn business một lần.

Lỗi đường dẫn TEMP dạng Windows 8.3 đã được sửa mà vẫn giữ kiểm tra ACL/symlink. Backup business và restore private đã đạt thực tế; UI cũng tạo được backup audit 23 documents. Khi gặp `JOB_BUSY`, đợi tác vụ hiện tại kết thúc; khi gặp `SOURCE_CHANGED`, dừng thao tác ghi và thử lại, không bỏ cơ chế kiểm tra nhất quán.

## 10. Kết thúc — 1 phút

**Lời nói:** “Nhóm em đã minh họa vòng đời từ tin tuyển dụng tới hồ sơ, phân tích và phỏng vấn. CouchDB lưu document JSON linh hoạt; index/view phục vụ tìm kiếm và thống kê; `_rev` hỗ trợ kiểm soát xung đột. Phần còn hạn chế hiện tại được nhóm ghi rõ trong báo cáo kiểm tra, không lấy số liệu test lịch sử thay cho kết quả chạy hôm nay.”

## Câu hỏi thầy có thể hỏi

| Câu hỏi | Gợi ý trả lời |
|---|---|
| Vì sao chọn NoSQL? | Hồ sơ/kỹ năng/học vấn/dự án thay đổi cấu trúc; JSON document thuận tiện lưu dữ liệu lồng. Đổi lại cần validation, quản lý tham chiếu và thiết kế truy vấn tốt. |
| CouchDB khác MongoDB ở điểm nào trong đề tài? | Trình bày tính năng đang dùng: HTTP API, `_id`/`_rev`, Mango, MapReduce views. Không tuyên bố đã demo replication hoặc clustering khi chưa triển khai. |
| Có transaction nhiều document không? | Không dựa vào transaction ACID nhiều document như cơ sở dữ liệu quan hệ. Dùng validation/ràng buộc ứng dụng, ID xác định, kiểm soát revision; audit outbox nằm cùng document nghiệp vụ cho các mutation đã tích hợp. |
| Xử lý hai người sửa cùng lúc? | Gửi revision hiện tại; CouchDB trả 409 khi stale. Chỉ retry/refresh theo đúng implementation của từng thao tác, không ghi đè mù. |
| AI có gọi ChatGPT không? | Engine hiện tại chấm điểm theo quy tắc xác định, có phiên bản và fingerprint; không phải LLM tuyển người tự động. |
| CV thiếu dữ liệu xử lý sao? | Ghi availability/INCOMPLETE và lý do, không tạo tổng điểm giả hoặc đưa vào ranking như hồ sơ COMPLETE. |
| Mật khẩu lưu ở đâu? | User ứng dụng dùng Argon2id hash khi có credentials. JWT được ký bởi secret ở backend; CouchDB admin credentials ở `.env`, không gửi xuống frontend. |
| Bao nhiêu dữ liệu? | Đọc live. Release có 25.750 business docs; doc_count gồm cả design docs. Hiện 2.500 job, 200 job công khai duy nhất trong lần kiểm tra này. |
| Test có đạt hết không? | Bộ mặc định backend hiện 737 PASS, 0 FAIL, 9 SKIP (đã bao gồm Auth); frontend 255 Vitest + 7 Node PASS. Bảy ca integration Docker/CouchDB tùy chọn chạy riêng cũng PASS. Lint không còn cảnh báo; build PASS, còn cảnh báo kích thước JS chunk. Không khẳng định đã kiểm tra mọi tổ hợp dữ liệu có thể có. |

## Phương án trình bày ngắn 8–10 phút

Kiến trúc → Fauxton xem JSON/index/view → Candidate mở CV và timeline HIRED đã chuẩn bị → Recruiter mở hai ứng viên/xếp hạng/breakdown → Admin mở thống kê/audit → evidence backup/restore. Không chạy lại backup business lớn nếu thời gian ngắn; dùng nguồn audit để minh họa thao tác nhanh.
