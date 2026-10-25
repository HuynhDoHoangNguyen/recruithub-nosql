# Báo cáo tổng hợp TV2 — Review hậu merge và hướng dẫn kiểm thử tích hợp

> **Rà soát mới nhất 25/10/2026:** [Report tổng hợp công việc, ma trận 7 UC TV2 và commit summary](TV2-review-and-commit-summary-2026-10-25.md). Phần lõi TV2 đã có API/UI và kiểm thử; còn phụ thuộc Interview/scoring TV3 và lỗi kiểm thử chung trước nghiệm thu toàn hệ thống.

Ngày cập nhật phần lịch sử: 2026-10-24. Tài liệu này gom báo cáo hậu merge của TV2 và hướng dẫn kiểm thử chung TV1 + TV2. Các kết quả bên dưới được giữ theo thời điểm báo cáo. Tài liệu triển khai TV2 vẫn ở [job-application-implementation.md](../../job-application-implementation.md).

## Danh m?c

- [Review h?u merge TV2](#rp-tv2-post-merge-review)
- [H??ng d?n t?i kho?n v? ki?m th? t?ch h?p TV1 + TV2](#rp-tv1-tv2-merge-test-guide)


<a id="rp-tv2-post-merge-review"></a>

## Rà soát sau merge — Recruiter Management & Application Lifecycle

_Source: job-application-post-merge-review.md. Original report text is retained._

> Cập nhật xử lý ngày 23/10/2026: P1/P2/P3 đã được sửa và kiểm thử trong lượt tiếp theo. Foundation + Recruitment 46/46 PASS; UI 15/15 PASS; full suite 275 tests, 251 PASS/24 FAIL. Xem mục 9 của [tài liệu triển khai](../../job-application-implementation.md) để biết code sau sửa và phụ thuộc còn lại. Nội dung dưới đây được giữ làm bằng chứng lịch sử trước sửa, không phải trạng thái nghiệm thu hiện tại.

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

Tài liệu liên quan: [Bàn giao triển khai](../../job-application-implementation.md), [Phân công nhóm](../../recruithub-team-work-assignment.md), [Business rules](../../recruitment-business-rules.md), [Shared foundation handoff](../../shared/TV2_TV3_FOUNDATION_HANDOFF.md).

---

<a id="rp-tv1-tv2-merge-test-guide"></a>

## RecruiHub NoSQL — Hướng dẫn tài khoản, kiểm thử chức năng và báo cáo tích hợp TV1 + TV2

_Source: RP-TV1-TV2-merge-test-guide.md. Original report text is retained._

## 1. Mục đích và trạng thái

Tài liệu này hướng dẫn thành viên cài cấu hình local, tạo tài khoản Candidate, đăng nhập và kiểm thử các luồng TV1 + TV2. Phần cuối ghi nhận công việc tích hợp Backend, Frontend và kiểm thử.

- **Ngày ghi nhận:** 2026-10-24 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phạm vi:** TV1 Identity/Profile/Admin và TV2 Job/Application.
- **Trạng thái Git cập nhật 2026-10-24:** merge commit `260cf4a` (`feat(tv1-tv2): integrate authentication, jobs, and applications`) đã có trên `feature/identity-candidate-portal`. `dev` và `origin/dev` vẫn ở parent `91f8346`; vì vậy thay đổi đã merge vào feature branch nhưng chưa được đưa vào nhánh `dev`. Working tree sạch trước khi cập nhật tài liệu này.
- **Cơ sở dữ liệu:** API Auth, Job, Application chỉ dùng `AUTH_COUCHDB_DATABASE` được cấu hình tường minh. Không dùng `recruitment_db` cho luồng ghi.
- **UI E2E:** các bước dưới đây là checklist để thành viên tự kiểm thử bằng browser; không ghi nhận là browser E2E đã chạy thành công.

## 2. Chuẩn bị môi trường local

### 2.1. Điều kiện

- Node.js phiên bản 20 trở lên và npm.
- CouchDB đang chạy, có thể truy cập bằng `COUCHDB_URL`.
- Một database riêng đã được tạo trước trong CouchDB cho tích hợp local. Database phải khác `recruitment_db`; ứng dụng không tự tạo database.
- Tài khoản CouchDB có quyền cần thiết trên database tích hợp.

Mỗi thành viên dùng CouchDB/database của môi trường mình. Database `recruithub_auth_demo` trong máy phát triển trước đây là database local, không tự có khi clone project. Có thể đặt tên khác, miễn database đã tồn tại và cấu hình Auth/Job/Application cùng trỏ vào nó.

### 2.2. Cấu hình backend

Tạo file `.env` ở thư mục gốc từ `.env.example`, sau đó điền giá trị riêng của môi trường. Không commit `.env`, không gửi mật khẩu/JWT secret qua chat hoặc đưa chúng vào report.

Các khóa liên quan:

| Khóa | Giá trị cần đặt |
|---|---|
| `COUCHDB_URL` | URL CouchDB, ví dụ local `http://127.0.0.1:5984` |
| `COUCHDB_USER`, `COUCHDB_PASSWORD` | Cặp tài khoản CouchDB của môi trường; để trống chỉ khi CouchDB không yêu cầu xác thực |
| `COUCHDB_DATABASE` | Dùng cho tiện ích/diagnostic chung; không quyết định DB ghi của Auth/Job/Application |
| `AUTH_COUCHDB_DATABASE` | Tên database tích hợp đã tồn tại; không được đặt là `recruitment_db` |
| `JWT_ACCESS_SECRET` | Chuỗi ngẫu nhiên riêng, tối thiểu 32 bytes; không dùng giá trị mẫu |
| `FRONTEND_URL` | Origin chính xác của Vite, mặc định `http://localhost:5173` |
| `PORT` | Tùy chọn; dùng cổng chưa bị chương trình khác chiếm, không dừng tiến trình lạ để lấy cổng |

Backend đọc `backend/.env` trước rồi mới đến `.env` ở root; biến đã có trong process được giữ nguyên. Tránh đặt cùng một khóa ở nhiều nơi nếu chưa xác định rõ giá trị nào sẽ có hiệu lực.

### 2.3. Cài dependencies và khởi chạy

Từ thư mục gốc PowerShell:

```powershell
npm.cmd --prefix backend install
npm.cmd --prefix frontend install

$env:PORT = '5002'
npm.cmd --prefix backend run dev
```

Mở terminal PowerShell thứ hai:

```powershell
npm.cmd --prefix frontend run dev -- --host 127.0.0.1
```

Mở URL Vite mà terminal hiển thị, thường là `http://localhost:5173`. Nếu dùng origin/cổng khác, thêm đúng origin đó vào `FRONTEND_URL` rồi khởi động lại Backend. Frontend lấy API base URL mặc định từ `frontend/.env.example` (`http://127.0.0.1:5002/api`).

Kiểm tra Backend:

```powershell
Invoke-RestMethod http://127.0.0.1:5002/api/health
```

`/api/health` chỉ xác nhận Express đang chạy, không chứng minh CouchDB/database đã sẵn sàng. Không gửi toàn bộ nội dung `.env` vào terminal/log để kiểm tra.

### 2.4. Index cho Job/Application

Nếu database tích hợp chưa có index/design document cần thiết, script dưới đây có thể tạo/cập nhật chúng **trên database do `AUTH_COUCHDB_DATABASE` cấu hình**:

```powershell
npm.cmd --prefix backend run db:job-application
```

Chỉ chạy sau khi xác minh biến hiệu lực trỏ đúng database tích hợp riêng và đã được phép ghi index ở môi trường đó. Script không phải lệnh tạo database. Không chạy script này khi cấu hình đang trỏ `recruitment_db`.

## 3. Tạo tài khoản và đăng nhập

### 3.1. Candidate — tự đăng ký trên giao diện

1. Mở `/register` trên frontend.
2. Điền **Full Name**, **Email**, **Password**, **Desired role**, **Industry**, **Seniority** và **Years experience**.
3. Dùng email mới trong database tích hợp. Mật khẩu phải có ít nhất 6 ký tự, một chữ hoa và một chữ số.
4. Nhấn đăng ký. Đăng ký thành công tạo tài khoản `CANDIDATE`; đăng ký trùng email trả lỗi xung đột.
5. Vào `/login`, dùng đúng email/mật khẩu vừa đăng ký.
6. Xác nhận chuyển tới khu vực đã đăng nhập; có thể kiểm tra phiên qua `GET /api/v1/auth/me`.

Trường **Desired role** là nghề/chức danh mong muốn của Candidate, không phải quyền tài khoản. Public registration chỉ tạo Candidate; không thể chọn `ADMIN` hay `RECRUITER` bằng form/API.

### 3.2. Recruiter và Admin

Recruiter và Admin không có public registration. Dùng tài khoản synthetic đã được người quản lý môi trường cấp và provision sẵn trong database tích hợp. Không tự nâng role cho Candidate bằng UI, request hoặc sửa document trực tiếp. Nếu môi trường mới chưa có hai loại tài khoản này, cần người quản lý cấp/provision theo schema và quy trình dự án trước khi kiểm thử các màn hình tương ứng.

Thông tin đăng nhập chỉ chia sẻ trực tiếp với người được phép, không ghi vào tài liệu này. Status `RESET_REQUIRED` không đăng nhập được cho tới khi được xử lý theo quy trình operator.

### 3.3. Đăng xuất

Nút đăng xuất xóa token khỏi bộ nhớ frontend. JWT không bị thu hồi phía server; session kết thúc trên UI nhưng token đã sao chép vẫn có thể còn hiệu lực tới khi hết hạn. Token không được lưu trong `localStorage` hoặc `sessionStorage`.

## 4. Checklist kiểm thử nghiệp vụ

Thực hiện trên database tích hợp riêng và dùng dữ liệu synthetic. Ghi lại thời điểm, vai trò đang đăng nhập, kết quả mong đợi/thực tế; không ghi password hoặc JWT vào bằng chứng.

### 4.1. Candidate và Public Jobs

1. Mở Landing, đi tới Register/Login và Public Jobs.
2. Thử đăng ký thiếu trường, mật khẩu thiếu chữ hoa/chữ số, rồi đăng ký Candidate hợp lệ.
3. Đăng ký lại cùng email; xác nhận API báo duplicate và không tạo tài khoản thứ hai.
4. Đăng nhập sai mật khẩu rồi đúng mật khẩu; xác nhận `/api/v1/auth/me` trả principal Candidate.
5. Mở `/profile`; tải profile, chỉnh sửa trường được phép và lưu. Kiểm tra response có `ETag`. Dùng tab cũ/stale revision nếu có thể để xác nhận conflict được báo.
6. Mở `/jobs`; lọc/tìm kiếm và đổi trang. Job public chỉ hiển thị tin `OPEN`; mở chi tiết một Job.
7. Đăng xuất, thử vào lại route được bảo vệ; xác nhận bị yêu cầu đăng nhập. Kiểm tra token không nằm trong Web Storage.

### 4.2. Candidate Apply

1. Đăng nhập Candidate và mở chi tiết một Job `OPEN` chưa hết hạn.
2. Nộp CV text thực tế của tài khoản synthetic; không nhập dữ liệu cá nhân thật khi không cần thiết.
3. Kiểm tra Application xuất hiện trong “Đơn ứng tuyển của tôi”, stage ban đầu là `APPLIED`.
4. Thử Apply lại cùng Candidate–Job; xác nhận bị từ chối như duplicate.
5. Rút đơn khi stage cho phép; xác nhận lịch sử stage được giữ và không thể nộp lại cùng cặp Candidate–Job.
6. Job `DRAFT`, `CLOSED` hoặc hết hạn không nhận Apply.

### 4.3. Recruiter — Job và Application lifecycle

1. Đăng nhập bằng Recruiter synthetic được cấp; mở dashboard.
2. Tạo Job `DRAFT`, kiểm tra danh sách Job của Recruiter.
3. Publish Job hợp lệ sang `OPEN` với deadline tương lai; xác nhận xuất hiện trong Public Jobs.
4. Sửa Job bằng revision mới; thử revision cũ để xác nhận conflict. Chỉ chủ sở hữu được sửa, publish hoặc close Job.
5. Mở applicants của Job do Recruiter sở hữu; xem danh sách/chi tiết Applicant trong scope.
6. Chuyển stage theo `allowed_transitions` do API trả về; thử stale revision và transition bị cấm.
7. Đóng Job; xác nhận Apply mới bị chặn nhưng Application đã có vẫn còn xem/quản lý theo policy.
8. Nếu có Recruiter thứ hai được cấp, thử mở/sửa Job/Application thuộc Recruiter đầu; yêu cầu bị từ chối và dữ liệu không đổi.

### 4.4. Admin và phân quyền

1. Đăng nhập bằng Admin synthetic đã được cấp; kiểm tra dashboard, thống kê, User list và User detail.
2. Xác nhận thao tác khóa/mở khóa không khả dụng với target có role ADMIN; Admin recovery thuộc quy trình operator ngoài MVP.
3. Đăng nhập Candidate rồi mở route Admin/Recruiter; xác nhận bị chặn.
4. Đăng nhập Recruiter rồi mở route Admin; xác nhận bị chặn.
5. Không thử cập nhật trạng thái hoặc sửa User bằng công cụ trực tiếp trên production/shared DB.

### 4.5. ETag, lỗi và CORS

- Kiểm tra request trình duyệt gọi đúng `VITE_API_BASE_URL`.
- Với profile/job/application mutation, xác nhận `If-Match`/`expected_rev` theo endpoint và response ETag đúng contract.
- Kiểm tra preflight từ đúng origin cho `Authorization`, `Content-Type`, `If-Match`; không dùng wildcard origin.
- Với các request không có quyền, kiểm tra status/error envelope; xác nhận revision/content của tài liệu không đổi.
- Thử viewport mobile khoảng 360 px, tablet và desktop; ghi lỗi UI cụ thể nếu có.

## 5. API tham khảo

Tất cả endpoint dưới đây có prefix `/api/v1`:

| Nghiệp vụ | Method/path | Quyền |
|---|---|---|
| Đăng ký Candidate | `POST /auth/register` | Công khai, chỉ tạo Candidate |
| Đăng nhập / tài khoản hiện tại | `POST /auth/login`, `GET /auth/me` | Login công khai; `/me` cần Bearer token |
| Candidate Profile | `GET /candidate/profile/me`, `PATCH /candidate/profile/me` | Candidate; PATCH cần revision hiện hành |
| Public Job | `GET /jobs`, `GET /jobs/:id` | Công khai; listing chỉ `OPEN` |
| Recruiter Jobs | `GET /recruiter/jobs`, `POST /jobs`, `PATCH /jobs/:id`, `PATCH /jobs/:id/status` | Recruiter; mutation theo owner và revision |
| Applicants theo Job | `GET /jobs/:id/applicants` | Recruiter sở hữu Job |
| Candidate Applications | `POST /applications`, `GET /applications/context`, `GET /applications/my-applications` | Candidate |
| Application detail/withdraw | `GET /applications/:id`, `PATCH /applications/:id/withdraw` | Candidate sở hữu hoặc Recruiter trong scope; withdraw là Candidate owner |
| Chuyển application stage | `PATCH /applications/:id/stage` | Recruiter sở hữu Job |
| Admin Users/statistics | `GET /admin/users`, `GET /admin/users/:id`, `GET /admin/stats` | Admin |

## 6. Báo cáo công việc tích hợp TV1 + TV2

### TV1 — Identity, Profile và Admin

- Candidate registration/login, Argon2id password hash, JWT ngắn hạn và `/auth/me`.
- Candidate Profile đọc/cập nhật theo ownership, allowlist và ETag/revision.
- Admin User list/detail/statistics và server-side authorization.
- Không cho phép public Admin/Recruiter registration; không cho đổi status nhắm tới ADMIN qua API.

### TV2 — Recruiter Job và Candidate Application

- Recruiter tạo/sửa Job, quản lý trạng thái `DRAFT`/`OPEN`/`CLOSED` và xem applicants.
- Public Job listing/detail chỉ hiển thị tin phù hợp trạng thái public.
- Candidate Apply/duplicate protection/withdraw và Recruiter stage transition với lịch sử, revision và quyền ownership.
- Frontend được ghép qua API service/Axios hiện có; không dùng fixture để Apply.

### Điểm tích hợp chung

- Auth, Candidate, Job và Application dùng cùng `AUTH_COUCHDB_DATABASE` tường minh.
- Job/Application xác minh JWT theo contract TV1, sau đó nạp User canonical và kiểm tra role/status hiện hành.
- API dùng prefix `/api/v1`, response envelope chung và error handler; CORS allowlist origin chính xác và expose `ETag`.
- Application ID xác định từ cặp Candidate–Job để ngăn tạo nhiều Application cho cùng cặp.
- Pagination dùng CouchDB bookmark; `has_more` được xác định bằng lookahead khi trang chính đầy.
- TV3 Interview/Scoring/Audit không nằm trong phạm vi merge TV1 + TV2 này.

### Verification ghi nhận

| Kiểm tra | Kết quả |
|---|---:|
| Backend Auth/Foundation | 54/54 PASS |
| Backend Recruitment | 41/41 PASS |
| Frontend Node tests | 4/4 PASS |
| Frontend production build | PASS |
| Frontend lint | 0 lỗi, 2 cảnh báo |
| Full backend `npm test` | Chưa PASS; không được tuyên bố full-suite đạt |
| Browser UI E2E | Chưa được xác nhận trong báo cáo này; chạy manual checklist ở trên |

Full backend suite còn vướng thiếu release fixtures `DATA-02B.2`, `DATA-03.2`, `DATA-03.3B`; file JSONL `DATA-03.4B` trong checkout có CRLF trong khi manifest/blob chuẩn là LF. Không tự sinh dữ liệu và không sửa checksum để làm xanh test.

## 7. An toàn dữ liệu và Git

- Không cấu hình Auth/Job/Application về `recruitment_db`; backend từ chối database này cho các write-capable API.
- Chỉ kiểm thử nghiệp vụ trên database tích hợp riêng đã được chuẩn bị và cho phép.
- Không đưa `.env`, mật khẩu demo, JWT hoặc CouchDB credentials vào commit/report.
- Tài liệu này không chứa thông tin đăng nhập; hãy nhận tài khoản Recruiter/Admin từ người quản lý môi trường.
- Trạng thái merge được nêu ở mục 1 là snapshot tại ngày lập tài liệu; cần chạy `git status` lại trước khi commit hoặc hoàn tất merge.

---

## Trạng thái tích hợp hiện tại

Merge commit `260cf4a` có trên `feature/identity-candidate-portal`; `dev` và `origin/dev` vẫn ở parent `91f8346`. Kiểm tra gần nhất: Auth/Foundation 54/54, Recruitment 41/41, Frontend Node 4/4, build PASS, lint 0 lỗi/2 cảnh báo. Full backend suite chưa PASS do release fixtures bị thiếu và CRLF checkout; chưa có xác nhận browser E2E toàn luồng.
