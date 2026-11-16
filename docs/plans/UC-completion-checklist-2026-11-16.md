# Checklist hoàn thiện use case theo báo cáo Word

Ngày lập: 16/11/2026. Nhánh làm việc: `codex/usecase-completion-2026-11-16`, tạo từ `dev` tại `228f386`.

**Trạng thái: chỉ lập kế hoạch, chưa triển khai các hạng mục dưới đây.** Các checkbox thể hiện việc cần làm, không phải chứng nhận đã đạt. Lượt lập checklist không thay đổi code, `.env`, database hoặc báo cáo Word.

Nguồn phạm vi: [ma trận use case theo Word và thực trạng](../demo-theo-bao-cao-word-2026-11-16.md). Baseline kiểm chứng trước khi lập kế hoạch: [báo cáo demo local](../reports/integration/RP-demo-ready-2026-11-16.md), [kết quả kiểm thử](../demo-evidence-2026-11-16/verification-summary.json). Dùng mã UC-01–UC-16 theo mục 2.3.5 của Word; không tự thêm UC-17 từ chênh lệch số lượng trong phần tổng quan.

## 1. Tổng quan kế hoạch

| Thứ tự | Hạng mục | Kết quả cần bàn giao | Ước lượng | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 1 | UC-15 Company/Department | Admin quản lý tổ chức qua UI/API, kiểm tra ràng buộc tham chiếu | 1–2 giờ | Chốt quy tắc tổ chức và xóa | Chưa triển khai |
| 2 | UC-14 đổi role | Luồng đổi role có quản lý hồ sơ, quyền và trạng thái nhất quán | 1–2 giờ | UC-15; chốt chính sách chuyển role | Chưa triển khai |
| 3 | UC-13 analytics Recruiter | Funnel, conversion, top skills, biểu đồ theo đúng scope | 1,5–3 giờ | Chốt công thức/cohort/dữ liệu | Chưa triển khai |
| 4 | UC-16 thống kê document | Thống kê loại document và đối chiếu tổng theo từng database | 45–90 phút | Chốt định nghĩa các tổng | Chưa triển khai |
| 5 | Replication theo báo cáo | One-shot replication và phục hồi target mới có bằng chứng | 30–60 phút | Database thử nghiệm, quy tắc target private | Chưa triển khai |
| 6 | Kiểm thử tích hợp và tài liệu | Regression, diễn tập UI ba role, cập nhật evidence/kịch bản | 30–60 phút | Các hạng mục trước | Chưa triển khai |

Tổng cộng sơ bộ **5 giờ 15 phút đến 10 giờ 30 phút**. Đây là ước lượng lập kế hoạch, chưa phải cam kết thời gian. Các mục 1–2 có thể tăng nếu cần thay schema, migration dữ liệu hoặc thay cơ chế phiên đăng nhập. Unit/integration tests của từng tính năng nằm trong thời gian tính năng đó; mục 6 dành cho hồi quy và luồng xuyên nhiều phân hệ.

Triển khai theo từng phần có thể review: đọc/chốt contract → database/schema/repository → service/API → UI → kiểm thử → evidence. Một mục lớn chia thành các phần 30–90 phút; nghiệm thu từng phần trước khi coi toàn bộ UC hoàn thành.

## 2. Checklist chuẩn bị trước khi triển khai

- [ ] P-01 Kiểm tra lại nhánh, HEAD, trạng thái Git; ghi nhận những thay đổi hiện có và không ghi đè chúng.
- [ ] P-02 Đọc AGENTS.md, AGENTS.local.md và các schema/API hiện hành liên quan.
- [ ] P-03 Lập danh sách file dự kiến thay đổi theo từng UC; đánh dấu contract dùng chung giữa TV1/TV2/TV3.
- [ ] P-04 Lưu baseline test và bộ dữ liệu demo đã có; các số 737/255/7 là kết quả lịch sử 16/11, cần ghi kết quả chạy thực tế khi triển khai.
- [ ] P-05 Chọn database/tài khoản thử nghiệm cho mutation, migration và replication; đặt tên nhận diện rõ ràng.
- [ ] P-06 Chốt các quyết định nghiệp vụ còn mở ở mục 9 trước khi thực hiện bước phụ thuộc.
- [ ] P-07 Giữ nguyên snapshot và manifests trong `data/processed/`; không import lại để che lỗi, không drop database nguồn.
- [ ] P-08 Không commit/push/chuyển nhánh tiếp nếu người dùng chưa yêu cầu.

## 3. UC-15 Admin quản lý Company và Department

**Hiện trạng:** có document/schema tổ chức, lookup khi đăng ký Recruiter và Recruiter sửa công ty của mình; chưa có Admin CRUD độc lập.

**Phạm vi dự kiến:** routes/services/repositories/schema request cho Admin organization, tab/màn hình Admin, API client và tests. Tái sử dụng contract Company/Department; không tự thêm field không được schema chấp nhận.

### Phần A Contract và dữ liệu

- [ ] U15-01 Chốt trường tạo/sửa Company theo schema thực tế: tên, ngành và thông tin liên hệ được hỗ trợ; ID/timestamps/provenance do server quản lý.
- [ ] U15-02 Chốt trường Department: `company_id`, `name`, `key`; quy tắc chuẩn hóa và tính duy nhất của key trong một Company.
- [ ] U15-03 Chốt quy tắc tên trùng; tránh giả định Mango index tạo unique constraint tự động.
- [ ] U15-04 Chốt phạm vi đọc: tìm kiếm, lọc Company, phân trang và giới hạn kết quả.
- [ ] U15-05 Chốt thao tác xóa: không xóa dây chuyền; chặn tổ chức còn được Department/Recruiter/Job tham chiếu. Nếu dùng soft-delete cần mở rộng schema và lookup nhất quán.
- [ ] U15-06 Không cho đổi `Department.company_id` khi còn tham chiếu nghiệp vụ, trừ khi đã có migration được thiết kế riêng.
- [ ] U15-07 Thiết kế cách xử lý yêu cầu tạo trùng đồng thời và kiểm tra ràng buộc lúc xóa; không tuyên bố kiểm tra trước khi ghi là transaction đa document.

### Phần B API và giao diện

- [ ] U15-08 Tạo API Admin-only để list/detail/create/update và thao tác xóa theo policy đã chốt.
- [ ] U15-09 Validate payload chặt, kiểm tra Company tồn tại khi tạo Department.
- [ ] U15-10 Cập nhật bằng revision hiện hành; stale revision trả 409, không ghi đè im lặng.
- [ ] U15-11 Ghi audit cho các mutation theo contract; cập nhật allowlist event/subject, source guard và delivery nếu cần.
- [ ] U15-12 Tạo tab/màn hình Admin quản lý Company/Department, form tạo/sửa, bộ lọc/phân trang.
- [ ] U15-13 Hiển thị Loading/Empty/Error/Success và thông báo cụ thể khi còn ràng buộc dữ liệu.
- [ ] U15-14 Sau tạo tổ chức mới, lookup đăng ký Recruiter đọc được đúng Company/Department; không thay scope của Recruiter cũ.

### Phần C Kiểm thử và nghiệm thu

- [ ] U15-15 Guest trả 401; Candidate/Recruiter trả 403 cho API quản trị tổ chức.
- [ ] U15-16 Test tạo/sửa hợp lệ, field sai, Department sai Company, key trùng, yêu cầu đồng thời và conflict revision.
- [ ] U15-17 Test xóa có ràng buộc bị chặn; thao tác được phép chỉ tác động document đã chọn.
- [ ] U15-18 Test UI gửi đúng payload/revision, hủy không ghi, lỗi không mất dữ liệu đang nhập.
- [ ] U15-19 Demo bằng Admin: tạo Company → tạo Department → sửa → kiểm tra lookup → minh họa một ca bị chặn do ràng buộc.

**Đạt khi:** có đầy đủ UI/API/DB và evidence cho happy path, phân quyền, conflict và tham chiếu. Chỉ có lookup hoặc Recruiter company editor chưa đủ để đánh dấu UC-15 hoàn tất.

## 4. UC-14 Đổi role và bảo đảm hồ sơ quyền tương ứng

**Hiện trạng:** đã xem user/role, khóa/mở/reset đủ điều kiện; chưa có đổi role. Role nằm trên User; Candidate/Recruiter có profile và các tham chiếu riêng. Không thể chỉ thêm dropdown đổi `user.role`.

**Phạm vi dự kiến:** Admin user API/service, cơ chế chuyển hồ sơ, auth guard/DTO, giao diện xác nhận và các tests liên quan.

### Phần A Chính sách chuyển role

- [ ] U14-01 Lập ma trận chuyển role được phép; đề xuất MVP xem xét Candidate ↔ Recruiter. Việc cấp/hạ quyền ADMIN phải được quyết định riêng, không tự đưa vào dropdown thông thường.
- [ ] U14-02 Chốt xử lý tài khoản hiện tại đang đăng nhập, Admin cuối cùng, tài khoản LOCKED và RESET_REQUIRED; không cho đổi role làm tự kích hoạt tài khoản.
- [ ] U14-03 Liệt kê hồ sơ và dữ liệu liên quan: Candidate, Recruiter, Job, Application, Interview, assets và audit.
- [ ] U14-04 Chốt quy tắc với tài khoản đã có lịch sử nghiệp vụ: chặn chuyển kèm lý do cụ thể hoặc dùng migration đã duyệt; không xóa/mất lịch sử để đổi role.
- [ ] U14-05 Chốt xử lý profile role cũ: giữ/lưu trữ/chuyển đổi theo schema và validator. Không để document profile mâu thuẫn với User role hoặc tạo orphan.
- [ ] U14-06 Khi sang Recruiter, bắt buộc Company/Department hợp lệ và khớp nhau; khi sang Candidate, phải có profile tối thiểu hợp lệ.

### Phần B Nhất quán dữ liệu và phiên đăng nhập

- [ ] U14-07 Thiết kế thứ tự tạo profile/đổi role và cơ chế thất bại an toàn khi ghi nhiều document; tài khoản không được ACTIVE ở role mới khi profile chưa sẵn sàng.
- [ ] U14-08 Chốt cơ chế retry/idempotency/reconciliation cho thao tác chuyển bị gián đoạn; không mô tả là transaction nguyên tử đa document.
- [ ] U14-09 Giữ nguyên canonical User ID/email; không tạo user thứ hai hoặc thay mật khẩu ngoài yêu cầu chuyển role.
- [ ] U14-10 Kiểm tra cả auth middleware TV1 và adapter domain TV2 đều nạp User mới từ server.
- [ ] U14-11 Chốt chính sách token cũ: từ chối/đăng nhập lại hoặc áp dụng role server hiện hành. Kiểm chứng đúng policy, không chỉ dựa vào role trong JWT/client state.
- [ ] U14-12 Cập nhật route guard/menu/context phía client để không giữ quyền và màn hình role cũ.
- [ ] U14-13 Bổ sung audit đổi role và các contract event/schema/worker cần thiết; actor lấy từ server.

### Phần C UI kiểm thử và nghiệm thu

- [ ] U14-14 UI Admin hiển thị các lựa chọn hợp lệ, dữ liệu tổ chức/profile cần bổ sung và lý do thao tác bị chặn.
- [ ] U14-15 Có bước xác nhận nêu rõ role cũ/mới và tác động phiên đăng nhập; hủy không mutation.
- [ ] U14-16 Test chuyển được phép, chuyển bị cấm, thiếu profile, sai Company/Department, stale revision và request trùng.
- [ ] U14-17 Test lỗi sau từng bước ghi không để lại account/profile không nhất quán; có đường phục hồi được kiểm chứng.
- [ ] U14-18 Test token/phiên cũ sau đổi role, login role mới, route quyền cũ và mới; không có nâng quyền từ payload client.
- [ ] U14-19 Demo bằng tài khoản thử riêng; xác minh User, profile, menu/quyền và audit sau chuyển.

**Đạt khi:** chuyển role được phép có profile hợp lệ, quyền đúng, lịch sử được bảo toàn và lỗi ghi được xử lý nhất quán. Có thể coi policy chặn tài khoản nhiều ràng buộc là kết quả hợp lệ nếu được chốt trước; không gọi đó là đã hỗ trợ migration mọi tài khoản.

## 5. UC-13 Funnel conversion top skills và biểu đồ

**Hiện trạng:** có bốn KPI cơ bản và thống kê stage; chưa có analytics đầy đủ. Stage hiện tại không đồng nghĩa đã từng đi qua stage đó.

**Phạm vi dự kiến:** contract analytics Recruiter, MapReduce views/backend aggregation, API và biểu đồ trên Recruiter dashboard.

### Phần A Định nghĩa chỉ số

- [ ] U13-01 Chốt bộ lọc và cohort: theo Job thuộc Recruiter, khoảng ngày nào, ngày nộp hay ngày chuyển stage; ghi rõ trong API/UI.
- [ ] U13-02 Tách số application hiện hành, số lượt ứng tuyển và previous attempts; chọn đơn vị cho từng biểu đồ, không cộng trùng.
- [ ] U13-03 Định nghĩa funnel theo các mốc đã đạt trong `stage_history`, không dùng trực tiếp số đơn có current_stage bằng mốc làm conversion funnel.
- [ ] U13-04 Chốt cách tính APPLIED → INTERVIEW và INTERVIEW → HIRED trên cùng cohort/attempt; quyết định xử lý WITHDRAWN/REJECTED và dữ liệu lịch sử thiếu history.
- [ ] U13-05 Mẫu số bằng 0 trả trạng thái không đủ dữ liệu/null hoặc quy ước được ghi rõ; không hiện NaN/Infinity hoặc tỷ lệ gây hiểu lầm.
- [ ] U13-06 Chốt top skills là kỹ năng bắt buộc của Job hay kỹ năng Candidate; đề xuất tách rõ top required skills và top missing skills nếu cùng triển khai.
- [ ] U13-07 Chuẩn hóa skill/alias; đếm một skill tối đa một lần trong cùng đơn vị thống kê; quy định Top N và tie-break.
- [ ] U13-08 Phân tích nguồn Candidate chỉ triển khai khi có field/source đáng tin cậy; không suy diễn nền tảng tuyển dụng từ nhãn provenance synthetic/mixed/derived.

### Phần B Truy vấn API và UI

- [ ] U13-09 Thiết kế view/index và aggregation theo access pattern; hạn chế payload, giới hạn filter range và tránh tải toàn bộ hồ sơ cá nhân để thống kê.
- [ ] U13-10 Kiểm tra quyền sở hữu trước truy vấn và thống kê, không lẫn Job/Candidate của Recruiter khác.
- [ ] U13-11 Endpoint trả KPI/funnel/conversion/top skills kèm thời điểm, phạm vi và định nghĩa đếm đủ để UI giải thích.
- [ ] U13-12 Tích hợp biểu đồ funnel, conversion và top skills với số liệu/nhãn đơn vị rõ ràng.
- [ ] U13-13 Giữ KPI hiện có và bộ lọc đồng bộ; đủ loading/empty/error/success, responsive và có số liệu dạng text để dễ đọc/demo.

### Phần C Kiểm thử và nghiệm thu

- [ ] U13-14 Dùng fixture có APPLIED/INTERVIEW/HIRED/REJECTED/WITHDRAWN, tái ứng tuyển và lịch sử thiếu dữ liệu; tính tay kỳ vọng.
- [ ] U13-15 Test hai Recruiter độc lập, filter Job/ngày và biên thời gian theo UTC/giờ Việt Nam.
- [ ] U13-16 Test mẫu số 0, skill alias/trùng, tie-break Top N và giới hạn dữ liệu.
- [ ] U13-17 Đối chiếu biểu đồ/UI với API và view/fixture; chỉ thay filter không tạo mutation dữ liệu nghiệp vụ.
- [ ] U13-18 Demo một thay đổi Pipeline làm chỉ số thay đổi đúng định nghĩa; giải thích được tử số/mẫu số của conversion.

**Đạt khi:** có biểu đồ từ dữ liệu thật, số liệu tính đúng và đúng quyền. Không đánh dấu đạt nếu chỉ thêm chart mock hoặc gọi current-stage counts là funnel đã đi qua.

## 6. UC-16 Mở rộng thống kê document

**Hiện trạng:** Admin có user/Candidate/role/status/job; chưa có tổng quan đầy đủ các loại document.

**Phạm vi dự kiến:** repository/service thống kê Admin, design document setup idempotent, API/DTO và UI tổng quan.

- [ ] U16-01 Chốt danh mục chín loại lõi: user, candidate, recruiter, company, department, job, application, interview, resume_analysis.
- [ ] U16-02 Chốt cách hiển thị document bổ sung như asset và loại chưa nhận diện; audit store có thể phân loại bằng `kind`, cần nhãn và database riêng.
- [ ] U16-03 Tách business docs, design docs, unknown/other và tombstone metadata; phân biệt soft-delete nghiệp vụ với CouchDB `_deleted`.
- [ ] U16-04 Nếu Auth và business cùng database, đếm một lần; thống kê audit database riêng không trộn mẫu số không giải thích.
- [ ] U16-05 Định nghĩa phép đối chiếu với `doc_count`; không hardcode 25.750 hoặc số snapshot cũ.
- [ ] U16-06 Thiết kế MapReduce View đếm theo loại/bucket; deploy bằng script riêng có kiểm tra, không tạo index/view trong GET stats.
- [ ] U16-07 Giữ các thống kê hiện có; API Admin-only trả số liệu, database scope, timestamp và trạng thái từng nguồn.
- [ ] U16-08 Quy định hành vi khi audit DB không cấu hình hoặc view chưa cài: báo unavailable/partial có nhãn, không thay lỗi thành số 0.
- [ ] U16-09 UI có tổng, phân bố theo loại, chú giải scope và thao tác tải lại; đủ bốn trạng thái giao diện.
- [ ] U16-10 Test unknown type, asset, design docs, soft-delete, nguồn trùng, nguồn thiếu và không có dữ liệu.
- [ ] U16-11 Đối chiếu số API/UI với CouchDB thực tế trên môi trường kiểm thử, giải thích được mọi phần chênh lệch.
- [ ] U16-12 Kiểm tra guest/Candidate/Recruiter không đọc được thống kê quản trị.

**Đạt khi:** thống kê động đủ các nhóm đã chốt, không đếm đôi và có đối chiếu nguồn. Tổng quan document không được giới thiệu thành health/monitoring/benchmark cluster nếu chưa triển khai các chức năng đó.

## 7. Kiểm chứng replication theo báo cáo

**Hiện trạng:** RHBR backup/restore đã có evidence; chưa có bài nghiệm thu CouchDB replication trong lượt kiểm tra này. Hai cơ chế phải được ghi tách biệt.

- [ ] R-01 Chốt kịch bản one-shot replication trên môi trường thử nghiệm và tên database backup/restore mới, không trùng nguồn hay database hệ thống.
- [ ] R-02 Chuẩn bị dữ liệu có chín loại lõi hoặc tập fixture đại diện, Unicode, design docs/index và attachment; lưu count/checksum/mốc nguồn trước chạy.
- [ ] R-03 Nếu cần chứng minh đúng source `recruitment_db` của báo cáo, lập bước riêng chỉ đọc nguồn và ghi target mới; không sử dụng restore ghi đè nguồn.
- [ ] R-04 Xác định nguồn có filter/selector hay không, có lấy design docs không; ghi rõ phạm vi và những gì replication không thay thế trong quy trình vận hành.
- [ ] R-05 Chuẩn bị quyền và `_security` để target private từ lúc tạo; không giả định `_security` được sao chép tự động chỉ vì replication document thành công.
- [ ] R-06 Chạy one-shot source → backup target; thu lại kết quả, trạng thái và error từ CouchDB mà không lộ credentials.
- [ ] R-07 Chạy backup → restore target mới; không cutover ứng dụng tự động.
- [ ] R-08 Đối chiếu count theo loại, document IDs/nội dung, attachments, design docs và truy vấn đại diện; giải thích chênh lệch design/tombstone nếu có.
- [ ] R-09 Xác minh truy cập anonymous bị chặn, source không bị mutation bởi quy trình và ứng dụng vẫn dùng database nguồn.
- [ ] R-10 Kiểm tra cấu hình sai/quyền thiếu/target đã tồn tại không dẫn tới ghi đè ngoài phạm vi; ghi rõ policy xử lý target có sẵn.
- [ ] R-11 Chạy lại one-shot trên dữ liệu không đổi để kiểm tra không tạo bản ghi trùng, đối chiếu trạng thái/checkpoint trong phạm vi cơ chế.
- [ ] R-12 Viết hướng dẫn Fauxton/REST, ảnh và kết quả theo ngày; đặt cạnh bằng chứng RHBR, không dùng chung nhãn “đã kiểm chứng replication” cho archive.

**Đạt khi:** có bằng chứng riêng cho cả hai chiều, target mới private, dữ liệu/attachment/design được đối chiếu và nguồn được bảo toàn.

## 8. Kiểm thử tích hợp cập nhật hướng dẫn và nghiệm thu

- [ ] V-01 Chạy tests mục tiêu sau mỗi tính năng và xử lý lỗi liên quan, không bỏ/tắt test để đạt chỉ tiêu.
- [ ] V-02 Chạy `npm test` backend có auth-foundation; báo riêng PASS/FAIL/SKIP và lý do skip.
- [ ] V-03 Chạy frontend `npm test`, `npm run lint`, `npm run build`; ghi rõ warning còn tồn tại.
- [ ] V-04 Chạy integration CouchDB/Docker phù hợp với mutation tổ chức, role, analytics và replication; dùng dữ liệu thử nhận diện được.
- [ ] V-05 Diễn tập bằng UI thật: Admin tạo tổ chức → chuyển role được phép → người dùng đăng nhập/quyền đúng → Recruiter xem analytics → Admin xem thống kê.
- [ ] V-06 Regression luồng đang có: Candidate apply → Pipeline → Interview → scoring/ranking → HIRED; CV, withdraw/reapply và lịch sử vẫn đúng.
- [ ] V-07 Regression quyền sở hữu, token cũ, trạng thái tài khoản, 409 và lỗi backend; không chỉ kiểm tra happy path.
- [ ] V-08 Đối chiếu UI ↔ API ↔ document/view, lưu ảnh/JSON có cùng IDs và mốc phiên; không lưu mật khẩu/token vào evidence.
- [ ] V-09 Cập nhật ma trận UC-13–UC-16, kịch bản demo và hạn chế theo kết quả thực tế; không đánh dấu tất cả PASS chỉ vì tồn tại màn hình.
- [ ] V-10 Soạn nội dung cập nhật Word cho các mục use case/kiến trúc/query/replication/kiểm thử; ghi ngày mới và giữ phân biệt snapshot cũ. Chỉ sửa Word khi nằm trong phạm vi triển khai được yêu cầu.
- [ ] V-11 Chốt thống nhất “17 use case” với danh sách UC-01–UC-16 của Word, tên enum stage và endpoint thực tế.
- [ ] V-12 Review diff, schema compatibility, secrets, migration và tài nguyên test; snapshot/manifests gốc giữ nguyên.
- [ ] V-13 Bàn giao lệnh chạy, tài khoản local, trạng thái worker, dữ liệu demo mới và danh sách tài nguyên test được giữ lại.
- [ ] V-14 Báo cáo cuối: phần đạt/chưa đạt, checks thực sự chạy, các quyết định nghiệp vụ, giới hạn và bước tiếp theo. Commit/push chỉ khi người dùng yêu cầu.

**Đạt khi:** các UC được nghiệm thu theo acceptance criteria từng mục, regression không phát sinh lỗi mới chưa giải quyết và người demo có thể lặp lại các bước theo hướng dẫn.

## 9. Các quyết định cần chốt khi bắt đầu từng hạng mục

Đây là danh sách quyết định trong kế hoạch, không phải yêu cầu người dùng trả lời ngay ở lượt lập checklist.

- [ ] D-01 Tổ chức: policy xóa/chặn/soft-delete, key trùng và chuyển Department giữa Company.
- [ ] D-02 Role: cho chuyển những cặp nào, có chạm ADMIN không, xử lý tài khoản có lịch sử và profile cũ ra sao.
- [ ] D-03 Nhất quán: điều kiện account/profile hợp lệ trước/sau chuyển; cơ chế thất bại giữa các bước và policy token cũ.
- [ ] D-04 Analytics: cohort theo application hay attempt, filter thời gian, funnel đã đạt và định nghĩa top skills/conversion.
- [ ] D-05 Thống kê: buckets, nguồn dữ liệu, cách tính soft-delete/design/unknown và partial availability.
- [ ] D-06 Replication: môi trường, source/target, quyền, phạm vi document và tiêu chí đối chiếu.
- [ ] D-07 Nghiệm thu: phần bắt buộc theo Word, phần Should Have và phần mở rộng; không gộp “demo được” với “đã kiểm tra mọi trường hợp”.

## 10. Phiếu nghiệm thu cho mỗi đợt

Sao chép mẫu này khi bắt đầu thực hiện; giữ trống trong lượt planning.

| Trường | Nội dung cần ghi |
|---|---|
| Mục và checkbox IDs | Ví dụ UC-15, U15-01 đến U15-19 |
| Phạm vi được chốt | Contract/quyết định D tương ứng |
| File thay đổi | API/service/repository/schema/UI/test |
| Database và dữ liệu thử | Nguồn/target, ID nhận diện, tài nguyên giữ lại |
| Kiểm thử | Lệnh, kết quả thực tế, skip và warning |
| Bằng chứng | UI/API/document/view IDs và timestamp cùng phiên |
| Chưa hoàn thành | Checklist còn trống và lý do |
| Kết luận | Đạt / cần sửa / chưa triển khai |
