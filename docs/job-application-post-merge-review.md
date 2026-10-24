# Rà soát sau merge — Recruiter Management & Application Lifecycle

> Cập nhật xử lý ngày 23/10/2026: P1/P2/P3 đã được sửa và kiểm thử trong lượt tiếp theo. Foundation + Recruitment 46/46 PASS; UI 15/15 PASS; full suite 275 tests, 251 PASS/24 FAIL. Xem mục 9 của [tài liệu triển khai](job-application-implementation.md) để biết code sau sửa và phụ thuộc còn lại. Nội dung dưới đây được giữ làm bằng chứng lịch sử trước sửa, không phải trạng thái nghiệm thu hiện tại.

Ngày kiểm tra: **23/10/2026 (Asia/Saigon)**. Nhánh: `feature/recruiter-management-application-lifecycle`. Commit kiểm tra: `a832b08` (merge `dev`); commit triển khai phân hệ: `4f53349`.

## 1. Kết luận dành cho người phụ trách

**Có thể tiếp tục phát triển trên bản merge hiện tại, nhưng chưa đủ điều kiện tuyên bố hoàn thành/nghiệm thu toàn bộ công việc.**

Phạm vi TV2 đã có API và giao diện cho cả bảy use case UC08, UC09, UC10, UC11, UC12, UC13, UC16. Test phân hệ hiện có đều pass. Tuy nhiên, đã tái hiện được hai lỗi nghiệp vụ chưa được test hiện hành bắt, và luồng đăng nhập/cấp token thật vẫn chưa được tích hợp từ TV1. Luồng phỏng vấn/scoring còn phụ thuộc TV3.

Báo cáo này là kết quả đọc code và chạy kiểm thử, không phải xác nhận toàn hệ thống đã hoạt động end-to-end trên browser/CouchDB thật. Lượt này chỉ tạo tài liệu báo cáo, không sửa logic nghiệp vụ, không commit/push.

## 2. Bản merge của TV1 đã mang về những gì?

So với parent thứ nhất của merge, có 26 file thay đổi, chủ yếu là shared foundation và tài liệu:

- Config CouchDB, `loadBackendEnvironment()`, CouchDB client và ánh xạ lỗi an toàn.
- `BaseRepository`, helper response, route `GET /api/health/database`.
- 18 test Foundation và tài liệu hợp đồng/handoff giữa các thành viên.
- `app.js` vẫn giữ factory `createApp()` cùng Job/Application routes; thêm health database.
- `server.js` nạp môi trường trước khi import app, giữ thứ tự process environment → `backend/.env` → root `.env`.

**Merge này chưa cung cấp API đăng ký/đăng nhập/cấp JWT, Candidate Profile hoặc các chức năng Identity đầy đủ.** Không nên hiểu việc đã merge nhánh TV1 là tất cả chức năng của TV1 đã hoàn thành. Danh sách backend routes hiện có chỉ gồm health, database-health, job và application.

Không còn conflict marker trong `backend/src` và `frontend/src`. Git sạch khi bắt đầu rà soát. Repository Job/Application hiện vẫn dùng adapter riêng đã có; chưa chuyển sang `BaseRepository`. Hai phần cùng tồn tại và test hiện hành pass, không cần refactor chỉ để đổi sang foundation mới trong bước nghiệm thu này.

## 3. Đối chiếu công việc được giao

Nguồn đối chiếu: mục 3.2 của `recruithub-team-work-assignment.md`, prompt triển khai gốc, schemas/utilities thật, routes và tài liệu nghiệp vụ. File prompt là đặc tả dùng để đối chiếu; yêu cầu trực tiếp của lượt này là rà soát và đóng gói báo cáo.

| Use case | Backend đã có | Frontend đã có | Đánh giá |
|---|---|---|---|
| UC11 — Tạo tin | Tạo DRAFT/OPEN, kiểm tra scope, normalize skills, validate document | Form tạo tin, validation, trạng thái gửi | Đã triển khai; demo thật cần Identity |
| UC12 — Sửa/đăng/đóng tin | `_rev`, DRAFT → OPEN/CLOSED, OPEN → CLOSED, giữ hồ sơ | Dashboard, form sửa, thao tác trạng thái | Chưa nghiệm thu do lỗi mất giây deadline |
| UC08 — Nộp hồ sơ | Candidate ACTIVE, OPEN/deadline, ID xác định, chống trùng, lưu submission | ApplyModal nối JobDetails, gửi CV văn bản | Đã triển khai và kiểm thử fixture; chưa demo đăng nhập thật |
| UC09 — Theo dõi đơn | List/filter/bookmark/detail theo chủ sở hữu | Candidate Dashboard, timeline, loading/empty/error | Đã triển khai, chưa xác minh browser end-to-end thật |
| UC10 — Rút đơn | Chỉ APPLIED/SCREENING/INTERVIEW, giữ history, chặn nộp lại | Xác nhận rút đơn, disabled khi gửi | Đã triển khai và kiểm thử fixture |
| UC13 — Xem ứng viên | Scope Job/Recruiter, đọc Candidate/User canonical và CV | JobApplicantsPage, modal chi tiết, lọc/phân trang | Đã triển khai; reference ứng viên không hợp lệ trả lỗi |
| UC16 — Chuyển stage | State machine, history, revision, rejection/interview/acceptance evidence | Chọn hành động hợp lệ, lý do/evidence, reload sau 409 | Chưa nghiệm thu do lỗi ghi trước rồi báo lỗi |

Các route giao diện thực sự được mount trong `frontend/src/routes/AppRoutes.jsx`: recruiter dashboard, create, edit, applicants; candidate dashboard tại `/user/dashboard`; trang JobDetails để mở ApplyModal.

Chuẩn dữ liệu đang dùng là `type`, `account_status`, `current_stage`; stages persist là `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`. Không đổi thành INTERVIEWING/OFFERED theo ví dụ cũ. Application `submission` optional giữ tương thích hồ sơ lịch sử. Không cần đổi scoring engine trong phạm vi TV2.

## 4. Các vấn đề cần xử lý trước nghiệm thu

### P1 — Chuyển stage có thể đã ghi dữ liệu nhưng API trả lỗi

Vị trí: `backend/src/services/application.service.js:144`, `:149`; phần kiểm tra Candidate/User ở `:90–92`.

`transition()` ghi Application trước, sau đó gọi `dto()` để kiểm tra/đọc Candidate và User. Nếu Candidate reference đã không hợp lệ, lỗi được phát hiện sau write. Người thao tác nhận lỗi nhưng stage/history đã đổi, dễ hiểu sai kết quả và xử lý lại.

Đã chạy script trực tiếp với `createFixture()` và `ApplicationService`, không ghi database thật:

1. Candidate nộp hồ sơ; Recruiter chuyển APPLIED → SCREENING.
2. Trong fixture, đổi User mà Candidate tham chiếu sang role RECRUITER.
3. Recruiter yêu cầu SCREENING → INTERVIEW bằng revision hiện tại.
4. Kết quả: lỗi `INVALID_SCOPE` (mapping HTTP 409), **persistedStage = INTERVIEW**, **writes = 1**.

Đây là dữ liệu tham chiếu đã sai trước request, không phải chỉ giả thuyết race condition. Trường hợp thiếu Candidate cũng có nguy cơ phát hiện sau write theo cùng thứ tự gọi.

Hướng sửa: kiểm tra các reference bắt buộc và chuẩn bị dữ liệu response cần thiết trước write; tránh kiểm tra precondition nghiệp vụ lần đầu sau persist. Bổ sung regression tests cho role sai/Candidate thiếu, xác nhận stage/history/revision và số lần ghi không đổi khi từ chối. CouchDB vẫn không có transaction liên document; không tuyên bố giải quyết mọi race giữa User/Candidate/Application bằng việc đổi thứ tự kiểm tra.

### P2 — Chỉ sửa tiêu đề cũng làm thay đổi deadline

Vị trí: `frontend/src/features/jobs/jobFormModel.js:8`, `:14`, `:45`; form sử dụng model tại `frontend/src/features/jobs/components/JobForm.jsx`.

`toVietnamInput()` cắt thời gian đến phút; `jobPayload()` gửi lại với giây bằng 00. Đã chạy `fromJob()` → chỉ đổi title → `jobPayload()`:

```text
Deadline trước: 2026-10-30T23:59:59.000Z
Deadline sau:   2026-10-30T23:59:00.000Z
Sai lệch:      sớm hơn 59 giây
```

Điều này thay đổi cửa sổ nhận hồ sơ dù Recruiter không sửa hạn nộp. Hướng sửa: khi deadline không đổi trên form, giữ timestamp gốc hoặc không gửi field đó trong PATCH; khi người dùng sửa thật, chuyển giờ Việt Nam sang UTC theo quy ước đã chốt. Thêm regression test cho deadline có giây/millisecond và trường hợp sửa deadline có chủ đích.

### P3 — `npm test` chưa tự chạy Foundation tests sau merge

Vị trí: `backend/package.json:7`.

Script hiện tại chỉ chạy `tests/data/*.test.js` và `tests/recruitment/*.test.js`. 18 test mới trong `tests/foundation/` không nằm trong discovery. Lượt này đã chạy riêng và pass; nếu chỉ chạy npm test về sau sẽ bỏ sót chúng.

Hướng xử lý: thống nhất với nhóm thêm Foundation vào test discovery, giữ nguyên toàn bộ test cũ và không skip để lấy PASS.

### Tài liệu bàn giao cũ cần cập nhật

`docs/job-application-implementation.md` vẫn ghi kết quả ngày 22/10, thiếu cập nhật merge, môi trường và các lỗi vừa tái hiện. Sử dụng báo cáo này cho trạng thái rà soát ngày 23/10; tài liệu triển khai cũ vẫn hữu ích cho API contract và kiến trúc, không dùng các con số lịch sử làm kết quả hiện tại.

## 5. Kết quả kiểm thử thực tế trong lượt này

| Lệnh/check | Kết quả |
|---|---|
| Backend `node --test tests/foundation/*.test.js tests/recruitment/*.test.js` | **39/39 PASS**: 18 Foundation + 21 Recruitment |
| Backend `npm test` | **250 tests: 226 PASS, 24 FAIL**, exit 1 |
| Frontend `npm test` | **10/10 PASS**, 1 test file |
| Frontend `npm run lint` | Exit 0: **0 errors, 8 warnings** |
| Frontend `npm run build` | **PASS**, Vite 8.3.3 |
| Script tái hiện P1/P2 | Cả hai lỗi được tái hiện trên code hiện tại |
| Tìm conflict marker trong source | Không có |

Hai script tái hiện chạy trực tiếp Service/model với memory fixtures, không phải browser hoặc live CouchDB integration. Test pass hiện có không phủ hai ca này, nên không đủ cơ sở kết luận không còn lỗi.

24 lỗi full suite thuộc các nhóm dữ liệu/môi trường đã được ghi nhận trước đây: CouchDB `fetch failed`, thiếu Python `pyarrow`, thiếu input staged/release lịch sử, checksum release không khớp manifest. Riêng V04/V05/V06 trong nhóm import hiện lỗi kết nối. Lần kiểm tra merge trước có 228 PASS/22 FAIL khi CouchDB truy cập được; **không gọi 24 lỗi hiện tại là kết quả giống hệt lần trước**, và chưa có bằng chứng đó là regression Job/Application.

Không sửa snapshot/manifests để làm test xanh. Không chạy import/ETL hoặc sửa dữ liệu ứng viên để né lỗi. Không xác minh lại được số lượng business documents trên CouchDB thật trong lượt này; 25.750 là baseline release, không phải số đếm live vừa đo.

Log full suite được lưu cục bộ tại `$env:TEMP\recruithub-postmerge-backend.log`. Tệp log không phải tài liệu portable để bàn giao; kết quả và nguyên nhân chính đã được ghi trong báo cáo này.

## 6. Phụ thuộc cần phối hợp

| Phần | Hiện trạng | Điều kiện để demo/nghiệm thu |
|---|---|---|
| Identity — TV1 | Backend có adapter xác minh JWT HS256 và canonical User ACTIVE; chưa có API cấp token | TV1 cung cấp login/provisioning, claims/config tương thích, Candidate và Recruiter có profile/reference hợp lệ |
| Public Job — TV1 | TV2 có read adapter tối thiểu phục vụ Apply | Ghép contract public portal cuối cùng, giữ Job ID/ownership và response thống nhất |
| Shared Foundation — TV1 | Client/repository/health/env đã merge; tests pass | Bổ sung discovery test; việc di chuyển repository nghiệp vụ cần scope riêng nếu nhóm muốn |
| Interview — TV3 | TV2 kiểm tra biên bản thật trước OFFER, hiển thị SCHEDULING_REQUIRED | TV3 cung cấp tạo/lên lịch/hoàn tất vòng, dữ liệu reference/timeline đúng contract |
| Scoring — TV3 | Có hook inject và trạng thái chưa phân tích; production chưa nối engine qua `server.js` | TV3 cung cấp adapter; khi ghép cần test failure/retry và đọc analysis thật |

Không tự xây thêm Auth/Interview/Scoring core thay thành viên khác. Các phụ thuộc này không có nghĩa thiếu toàn bộ logic TV2, nhưng ngăn xác nhận demo toàn luồng thật. Không giả định users seeded RESET_REQUIRED có thể đăng nhập hoặc tự gán mật khẩu chung.

## 7. Checklist công việc tiếp theo

Thứ tự đề xuất để hoàn thành phạm vi của bạn:

1. Sửa P1 và bổ sung regression tests không ghi dữ liệu khi reference đã không hợp lệ.
2. Sửa P2 và bổ sung test bảo toàn timestamp khi chỉnh field khác.
3. Đưa Foundation tests vào discovery, cập nhật tài liệu triển khai theo contract sau merge.
4. Phối hợp TV1 để có hai tài khoản test hợp lệ và JWT cấp từ luồng thật, không dùng bypass.
5. Chuẩn bị CouchDB/input theo quy trình nhóm; xử lý lỗi full suite trong scope dữ liệu/môi trường riêng, không sửa snapshot tùy tiện.
6. Demo qua browser: tạo DRAFT → sửa → OPEN → Candidate nộp CV → reload → Recruiter đọc CV → SCREENING → INTERVIEW. Chỉ OFFER/HIRED khi có Interview và acceptance evidence thật.
7. Demo riêng rút đơn/chặn nộp trùng sau terminal; hai tab cùng thao tác phải bảo toàn history và tab thua nhận 409.
8. Kiểm tra keyboard/focus modal và responsive trên mobile/tablet/desktop. DOM tests/build chưa thay thế bước này.

Sau sửa phải chạy lại Backend npm test và bộ Foundation/Recruitment, Frontend test/lint/build; ghi rõ mọi lỗi môi trường còn tồn tại. Nghiệm thu phân hệ cần P1/P2 hết lỗi và luồng API/UI được kiểm chứng với Identity thật; nghiệm thu toàn hệ thống cần thêm phần của các thành viên còn lại.

## 8. Phạm vi thay đổi của lượt rà soát

Chỉ thêm file `docs/job-application-post-merge-review.md`. Script kiểm thử có tạo `data/scratch_bad_manifest.json`; artifact tạm này được dọn sau kiểm thử. Không sửa code sản phẩm, không thay cấu trúc hai nhánh, không commit/push hoặc chuyển branch.

Tài liệu liên quan: [Bàn giao triển khai](job-application-implementation.md), [Phân công nhóm](recruithub-team-work-assignment.md), [Business rules](recruitment-business-rules.md), [Shared foundation handoff](shared/TV2_TV3_FOUNDATION_HANDOFF.md).
