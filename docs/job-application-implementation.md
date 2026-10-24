# Quản lý tuyển dụng và vòng đời hồ sơ ứng tuyển

Ngày cập nhật: 23/10/2026. Phạm vi: UC08, UC09, UC10, UC11, UC12, UC13, UC16. Đã sửa P1/P2/P3 sau merge trên HEAD `a832b08`; xem mục 9.

## 1. Kết quả và giới hạn nghiệm thu

Đã triển khai API và giao diện cho tạo/sửa/đăng/đóng Job; nộp và đọc lại CV văn bản; theo dõi/rút đơn; duyệt ứng viên và chuyển stage có kiểm tra bằng chứng. Các thao tác dùng CouchDB thật trong production. Fixture store chỉ nằm trong tests.

Đã kiểm chứng bằng Express HTTP + JWT ký trong tests trên repository fixture có kiểm tra revision, cùng kiểm thử React với API mock. **Lượt xác minh sau sửa ngày 23/10 chưa kiểm chứng end-to-end với CouchDB/Identity thật**: cấu hình database parse hợp lệ, Express health 200 nhưng database health 503 NETWORK_ERROR. Không in credentials/token. Không có browser tool để kiểm tra responsive/focus thật. Không dùng kết quả đo dữ liệu hay live integration từ phiên trước làm bằng chứng của bản sửa này.

Identity chưa có endpoint cấp token/provisioning; Interview chưa có service lên lịch; Scoring chưa có application service để gọi sau Apply. Đây là các điểm phối hợp, không phải tính năng đã hoàn thành trong phân hệ này.

## 2. Kiến trúc và file

```text
React page → api/jobApplicationApi.js → api/axiosClient.js
  → /api/v1 routes → JWT/role/Zod middleware → thin controller
  → JobService / ApplicationService → JobApplicationRepository → CouchDB
```

| Nhóm | File chính |
|---|---|
| API | `backend/src/routes/job.routes.js`, `application.routes.js`; controllers tương ứng |
| Nghiệp vụ | `backend/src/services/job.service.js`, `application.service.js`, `job-application-scope.service.js` |
| Lưu trữ | `backend/src/repositories/job-application.repository.js`, `setup-job-application.js` |
| Validation/Auth | `backend/src/schemas/job-application-request.schema.js`, `middleware/job-application.middleware.js` |
| Extension | `backend/src/schemas/application.schema.js`: optional `submission` |
| Job UI | `frontend/src/pages/Jobs/CreateJob.jsx`, `JobDetails.jsx`, `JobList.jsx`, `JobApplicantsPage.jsx`; `features/jobs/` |
| Dashboard | `frontend/src/pages/Dashboard/RecruiterDashboard.jsx`, `JobSeekerDashboard.jsx` |
| Hồ sơ UI | `frontend/src/features/applications/components/ApplyModal.jsx`, `ApplicantDetailModal.jsx`, `ApplicationTimeline.jsx`, `WithdrawButton.jsx`, `ApplicationUI.jsx` |
| API client | `frontend/src/api/jobApplicationApi.js`, `axiosClient.js`; `services/api.js` re-export cùng client |
| Tests | `backend/tests/recruitment/`; `frontend/tests/job-application-ui.test.jsx`, `vitest.config.js` |

Thay đổi shared: `backend/src/app.js` thêm factory inject dependency và mount routes/error middleware; `server.js` đọc thêm root `.env`; `backend/package.json` mở rộng test discovery và thêm script setup. Frontend cập nhật router **đang chạy** `AppRoutes.jsx`, ánh xạ role ở ProtectedRoute/Navbar, hỗ trợ role Recruiter chuẩn trong Profile, bỏ endpoint refresh rỗng và logout tới server template bên ngoài. `.env.example`, `frontend/.env.example`, package scripts/lockfile được cập nhật cho cấu hình và UI tests. Không thay Auth/Profile/Admin business logic hoặc scoring/interview core.

Sai lệch tài liệu đã xử lý theo executable schema: discriminator `type`; stages `INTERVIEW`/`OFFER`; User `ACTIVE`/`LOCKED`/`RESET_REQUIRED`; chín loại nghiệp vụ gồm Company/Department, không thêm log/audit/reservation. Scoring giữ nguyên bốn thành phần 50/25/10/15. Repository dùng `repositories/`, không thêm tầng `models/` trùng lặp. Không lưu salary/location/jobType, CV URL giả, Application.status hoặc match_score.

## 3. API contract

Tất cả đường dẫn trong bảng có prefix `/api/v1`. Document ID trên URL phải qua `encodeURIComponent`.

| Method | Path | Quyền |
|---|---|---|
| GET | `/recruiter/jobs?status=OPEN&limit=20&bookmark=…` | Recruiter: Job của mình |
| GET | `/recruiter/jobs/:id` | Recruiter: đọc Job để sửa, kể cả DRAFT |
| GET | `/recruiter/stats` | Recruiter: thống kê trong scope |
| POST | `/jobs` | Recruiter |
| PATCH | `/jobs/:id` | Recruiter sở hữu |
| PATCH | `/jobs/:id/status` | Recruiter sở hữu |
| GET | `/jobs/:id/applicants?stage=SCREENING&limit=20&bookmark=…` | Recruiter sở hữu Job |
| POST | `/applications` | Candidate ACTIVE |
| GET | `/applications/context` | Candidate: hồ sơ và email canonical để xác nhận Apply |
| GET | `/applications/my-applications?stage=APPLIED&limit=20&bookmark=…` | Candidate: đơn của mình |
| GET | `/applications/my-applications?job_id=…` | Candidate: lookup trực tiếp pair ID để phục hồi trạng thái |
| GET | `/applications/:id` | Candidate sở hữu hoặc Recruiter của Job |
| PATCH | `/applications/:id/withdraw` | Candidate sở hữu |
| PATCH | `/applications/:id/stage` | Recruiter của Job |
| GET | `/jobs`, `/jobs/all` | Public: adapter tối thiểu liệt kê OPEN |
| GET | `/jobs/:id` | Public: OPEN/CLOSED; DRAFT trả 404 |

Static routes được đăng ký trước `/:id`. Admin không được bypass pipeline. Public adapter chưa triển khai tìm kiếm toàn văn/lương/địa điểm; cần ghép lại với Public Portal khi API đó sẵn sàng.

Success envelope:

```json
{"success":true,"data":{"items":[],"bookmark":"opaque-couchdb-bookmark","has_more":false},"message":"Đã tải hồ sơ ứng tuyển."}
```

Pagination dùng bookmark opaque, `limit` mặc định 20, tối đa 50. Đổi filter phải quay về bookmark đầu. `has_more=true` khi page đầy; trang kế tiếp có thể rỗng nếu tổng bằng đúng bội số limit. Không lấy tổng từ số item của page. Query không nhận raw Mango selector.

Tạo Job ví dụ:

```json
{
  "title":"Kỹ sư Backend",
  "seniority":"MID",
  "industry":"SaaS",
  "description":"Phát triển dịch vụ tuyển dụng.",
  "responsibilities":["Thiết kế REST API"],
  "requirements":{
    "general":["Hiểu hệ thống NoSQL"],
    "experience":{"status":"REQUIRED","required_months":24},
    "education":{"status":"NO_MINIMUM"},
    "project":{"status":"NO_REQUIREMENT"}
  },
  "required_skills":["JavaScript","CouchDB"],
  "optional_skills":["Docker"],
  "status":"OPEN",
  "deadline":"2026-11-30T16:59:00.000Z"
}
```

Company/Department/Recruiter được lấy từ tài khoản, không nhận qua DTO. Server tạo `job:<uuid>`, thời gian và provenance của dữ liệu nhập thực tế; không giả thành record nguồn CMS. Normalize kỹ năng bằng utility hiện có, từ chối trùng hoặc giao nhau sau normalize. OPEN cần deadline tương lai; Apply nhận cả đúng thời điểm deadline. UI nhập giờ Việt Nam UTC+7, request được chuẩn hóa UTC. Chỉ DRAFT → OPEN/CLOSED, OPEN → CLOSED; không mở lại/sửa CLOSED. Sửa nội dung dùng cùng trường nghiệp vụ như create, bỏ `status`, thêm `expected_rev`.

Đăng/đóng Job:

```json
{"status":"CLOSED","expected_rev":"<revision vừa đọc>"}
```

Nộp hồ sơ:

```json
{"job_id":"job:cms:J_000001","submission":{"resume_text":"Nội dung CV thực tế của ứng viên","cover_letter":"Thư giới thiệu tùy chọn"}}
```

DTO mới yêu cầu CV văn bản, tối đa 50.000 ký tự sau trim; cover letter tùy chọn, tối đa 10.000 ký tự. Chuỗi được cung cấp phải không rỗng. Document schema thêm object strict `submission` **optional**, cả hai field optional để tương thích và không yêu cầu migration. Application cũ không có submission vẫn parse được. Không cập nhật Candidate hoặc đầu vào scoring từ CV text. Request có owner/stage/history/score/provenance hoặc field lạ bị từ chối trước controller.

Response Apply trả Application DTO đã lưu, `_id`, `_rev`, `submission`, lịch sử, allowed transitions và `analysis_status`. Mặc định là `NOT_ANALYZED`, không có điểm giả. Candidate không nhận recruiter_note, note/evidence nội bộ, actor_id hoặc provenance; Recruiter trong scope đọc được CV và email từ User. Không trả password_hash.

Chuyển stage và rút đơn:

```json
{"expected_rev":"<revision vừa đọc>","expected_stage":"APPLIED","to_stage":"SCREENING","note":"Ghi chú nội bộ tùy chọn"}
```

```json
{"expected_rev":"<revision vừa đọc>","expected_stage":"SCREENING"}
```

Payload rút đơn không nhận `to_stage`; server luôn chọn WITHDRAWN. REJECTED phải có `reason_code` trong danh sách utility; riêng từ OFFER chỉ nhận OFFER_DECLINED/OFFER_EXPIRED. Từ stage khác không nhận hai lý do offer. UI lấy hành động từ `allowed_transitions` của server.

HIRED cần bằng chứng chấp nhận:

```json
{
  "expected_rev":"<revision vừa đọc>","expected_stage":"OFFER","to_stage":"HIRED",
  "evidence":{"accepted_at":"2026-10-22T12:15:00.000Z","method":"EMAIL","reference":"<tham chiếu xác nhận thực tế nếu có>"}
}
```

`method`: EMAIL, ELECTRONIC_SIGNATURE hoặc WRITTEN_CONFIRMATION. Với chữ ký có thể cung cấp `signed_document_id`; trường tham chiếu tối đa 500 ký tự. Service kiểm tra ngày chấp nhận từ thời điểm vào OFFER tới hiện tại. Đây là ghi nhận bằng chứng do Recruiter xác nhận, chưa tích hợp dịch vụ xác minh chữ ký/email bên ngoài.

INTERVIEW → OFFER không nhận evidence do client tự dựng: server truy vấn Interview của Application, validate schema, copied references, interviewer scope và timeline; dùng `validateInterviewEvidenceForOffer` để yêu cầu có vòng hoàn tất và không còn vòng chưa xử lý. Bằng chứng lưu là danh sách ID biên bản thật. Giữ nguyên semantics utility: không tự thêm quy tắc yêu cầu tất cả result phải PASSED.

Error envelope và mã lỗi chính:

```json
{"success":false,"error":{"code":"CONFLICT","details":[]},"message":"Tiến trình đã thay đổi. Vui lòng tải lại trước khi thao tác."}
```

| HTTP | Codes |
|---|---|
| 400 | VALIDATION_ERROR, INVALID_DEADLINE, INVALID_TRANSITION, INVALID_REASON, INVALID_EVIDENCE, INTERVIEW_EVIDENCE_REQUIRED, OFFER_ACCEPTANCE_REQUIRED, JOB_NOT_ELIGIBLE |
| 401 | UNAUTHENTICATED: thiếu/sai/hết hạn token, User không ACTIVE |
| 403 | FORBIDDEN, PROFILE_REQUIRED, INVALID_SCOPE |
| 404 | NOT_FOUND: resource/reference không tồn tại |
| 409 | DUPLICATE_APPLICATION, CONFLICT, JOB_CLOSED, INVALID_STORED_DOCUMENT, INVALID_HISTORY; INVALID_SCOPE khi tham chiếu Job không khớp |
| 503 | AUTH_NOT_CONFIGURED, DATABASE_UNAVAILABLE, DATABASE_NOT_INITIALIZED |

## 4. Tính toàn vẹn và CouchDB

Application ID gọi trực tiếp `applicationIdFromPair`. Concurrent Apply cùng pair ghi cùng ID: một lần thành công, lần gặp CouchDB 409 đọc lại document và trả DUPLICATE_APPLICATION. Không cho nộp lại sau bất kỳ stage terminal nào. Mất response sau write được phục hồi bằng endpoint lookup theo job_id, không tạo đơn thứ hai.

Cập nhật yêu cầu expected_rev; lifecycle thêm expected_stage. Append history và current_stage trong một `put` có `_rev`, validate toàn bộ document và history trước ghi. Timestamp sự kiện sau lớn hơn sự kiện trước và updated_at. Khi conflict, đọc lại và kiểm tra quyền; **không tự retry thao tác**, trả 409 cho client tải trạng thái mới. Đây là lựa chọn bảo thủ trong giới hạn tối đa một retry: không thể nhầm hai hành động cùng target là idempotent khi chưa có action receipt. Không trộn history cũ/mới.

CouchDB không có transaction liên document. Job có thể đóng giữa lần đọc precondition và lần tạo Application; Interview có thể thay đổi giữa kiểm tra và ghi OFFER. Không tuyên bố khóa/transaction liên Job–Application–Interview. Thao tác đóng Job giữ nguyên các Application đã có.

Setup tạo chín JSON indexes có ddoc/name rõ ràng, gồm recruiter/status/time, candidate/stage/applied_at, job/stage/applied_at, profile user lookup, interview application lookup và public jobs. `_design/job_application` có ba views: đếm Job theo recruiter/status; đọc ID Job theo recruiter; đếm Application theo job/stage. Thống kê đọc ID và reduced counts, không suy từ một page hoặc tải hồ sơ Candidate. Design documents là tài liệu kỹ thuật CouchDB, không phải business type thứ mười; `doc_count` kỹ thuật có thể tăng sau setup.

Chưa chạy setup trên recruitment_db do môi trường chưa sẵn sàng. Chưa có bằng chứng hiệu năng live. Khi chạy được, kiểm tra `_explain` cho selector/sort/use_index thực tế và ghi execution_time_ms, total_docs_examined, total_keys_examined, results_returned trước khi kết luận hiệu quả index.

## 5. Hợp đồng tích hợp

**Identity:** adapter production xác minh HS256 bằng Node crypto, exp bắt buộc; kiểm tra nbf và issuer/audience nếu cấu hình. `sub` hoặc `user_id` là canonical `user:<sha256>`; nếu có cả hai phải khớp. Role claim không cấp quyền: server lookup User và dùng role/account_status thực tế. `req.user` là User canonical; Candidate/Recruiter profile được lookup qua user_id và kiểm tra organization scope. `createApp({ authenticate })` chỉ dành cho trusted integration/test middleware, không có cờ/environment/header bypass production. UI dùng accessToken hiện có; ánh xạ role legacy chỉ tại ranh giới hiển thị. Không có endpoint refresh tự tạo.

**Public Portal:** adapter GET jobs/detail tối thiểu và màn hình JobDetails đã nối ApplyModal. Cần giữ envelope/ID encoding khi thay bằng Public Portal đầy đủ.

**Interview:** SCREENING → INTERVIEW được ghi trước, trả `interview_status=SCHEDULING_REQUIRED` khi chưa có biên bản. Phân hệ Interview tiếp nhận Application ID để tạo round theo stable ID `interviewIdFromRound`; việc lên lịch, idempotent scheduling và reconciliation vẫn do phân hệ đó sở hữu. Không tạo interview giả, không lùi stage khi thiếu lịch. OFFER đã nối đọc Interview qua CouchDB repository nhưng chưa được kiểm chứng live.

**Scoring:** factory hỗ trợ `analyzeApplication(applicationId)` để nhóm ghép service thật. Hiện chưa truyền hook trong production. Hook thành công trả REQUESTED; lỗi trả PENDING_RETRY và vẫn 201/giữ Application. Chưa có queue/retry worker hoặc readback trạng thái phân tích; các trạng thái REQUESTED/PENDING_RETRY là kết quả tức thời của hook, không persist vào Application. UI ghi rõ chưa tích hợp; không tính điểm từ CV hoặc thay engine hiện có.

## 6. Runtime configuration and startup

The Auth and Job/Application APIs share one explicitly configured CouchDB database. Set `AUTH_COUCHDB_DATABASE` to an already prepared isolated integration database; the API refuses an unset value and refuses `recruitment_db`. It does not create databases. Configure `COUCHDB_URL`, `COUCHDB_USER`, and `COUCHDB_PASSWORD` for the CouchDB endpoint. Do not place secrets in source control.

TV1 Auth is the sole identity contract. Set `JWT_ACCESS_SECRET` to the same strong secret used by Auth. Tokens use HS256 with the issuer, audience, subject, and 15-minute expiry defined by `TV1_AUTH_MODULE_CONTRACT.md`. Do not configure a second `JWT_SECRET` or `JWT_ALGORITHM` policy. Set `FRONTEND_URL` to the exact browser origin; wildcard CORS is not supported.

From the repository root in PowerShell:

```powershell
Set-Location backend
npm ci
npm run dev
```

In a second terminal:

```powershell
Set-Location frontend
npm ci
# Optional: VITE_API_BASE_URL=http://127.0.0.1:5002/api
npm run dev
```

All frontend modules share one Axios instance with a `/api` base URL; the TV1 and TV2 service paths add `/v1`. Development Public Jobs use explicitly labeled fixtures by default. Set `VITE_PUBLIC_JOBS_MODE=api` to exercise TV2's public endpoint in development; production always uses the API and never falls back to fixtures. Apply is disabled for fixture jobs.

`npm run db:job-application` creates Mango indexes and a design document. It is not part of application startup or tests. Run it only against an explicitly approved, prepared isolated database after separate approval for index/view creation; never run it against `recruitment_db`.
## 7. Kiểm thử và kết quả thực tế

| Lệnh | Kết quả sau sửa ngày 23/10/2026 |
|---|---|
| Backend `node --test tests/foundation/*.test.js tests/recruitment/*.test.js` | 46/46 PASS: 18 Foundation + 28 Recruitment, gồm 7 regression tests mới |
| Backend `npm test` | 275 tests: 251 PASS, 24 FAIL; discovery gồm data/foundation/recruitment, không skip |
| Frontend `npm test` | 15/15 PASS, gồm 5 ca deadline mới với helper và form thực tế |
| Frontend `npm run lint` | Exit 0; không có errors, còn 8 warnings đã có ở các file template/shared |
| Frontend `npm run build` | PASS với Vite 8.3.3 |
| `git diff --check` | PASS |

Baseline Backend: 229 tests, 205 PASS, 24 FAIL. Nguyên nhân lỗi cũ: không có CouchDB; thiếu Python pyarrow; thiếu releases/staged DATA-02B.2, DATA-03.2, DATA-03.3B; checksum release hiện có không khớp manifest. Kiểm tra read-only candidates.jsonl cho thấy raw checksum lệch, checksum khi chuẩn hóa CRLF thành LF khớp manifest. Không sửa snapshot/manifests để che lỗi này. Khi cần đối soát byte-level, nhóm phải khôi phục artifact nguyên gốc đúng checksum theo quy trình dữ liệu riêng.

Các test mới bao phủ Job scope/normalization/publish/close; inclusive deadline; duplicate tuần tự/đồng thời/sau terminal; CV round-trip/legacy/injection/limits; quyền riêng tư; stage skips/backward/terminal; Interview evidence/offer acceptance; concurrency và response loss; pagination/stats; JWT signature/algorithm/expiry/issuer/audience/ACTIVE; repository HTTP request shape và error sanitization. UI tests kiểm tra form, loading/empty/error/success/retry, duplicate feedback, disabled submit, xác nhận rút đơn, CV, reason validation, reload sau conflict, route thật và đọc lại sau remount.

Backend fixtures độc lập, không ghi recruitment_db; không xóa/skip test cũ. DOM tests không thay thế kiểm thử browser native dialog/focus trap hoặc responsive thủ công. CouchDB không kết nối được trong lần xác minh này; Identity provisioning và Interview scheduling còn thiếu nên không tuyên bố đã demo toàn luồng thật.

## 8. Demo sau khi các phụ thuộc sẵn sàng

1. Nhóm Identity cung cấp riêng một Recruiter ACTIVE có User/Company/Department/Recruiter hợp lệ và một Candidate ACTIVE có User/Candidate hợp lệ; cấp token đúng contract. Toàn bộ seeded users RESET_REQUIRED không được giả định đăng nhập được; không đổi hàng loạt trạng thái hoặc gán mật khẩu chung.
2. Recruiter vào `/recruiter/dashboard`, tạo DRAFT với hạn nộp tương lai, sửa nội dung, đăng tuyển. Kiểm tra lọc/phân trang và số đếm scope.
3. Candidate mở Job, đọc profile trong modal, nhập CV/cover letter và xác nhận. Refresh JobDetails và tracker để kiểm tra dữ liệu đã lưu; Apply lại phải 409.
4. Recruiter mở danh sách ứng viên, đọc CV, chuyển SCREENING rồi INTERVIEW. Nếu chưa có lịch, UI báo cần lên lịch; thử OFFER phải bị chặn.
5. Bộ phận Interview tạo/hoàn tất các vòng thật theo contract. Khi không còn vòng chưa xử lý, Recruiter chuyển OFFER; ghi bằng chứng chấp nhận thực tế để HIRED. Kiểm tra không chuyển tiếp hoặc nộp lại sau HIRED.
6. Với một Job khác, Candidate nộp rồi xác nhận rút đơn khi APPLIED/SCREENING/INTERVIEW; refresh thấy WITHDRAWN và toàn bộ lịch sử. Nộp lại vẫn bị chặn.
7. Mở hai tab cùng hồ sơ, thực hiện hai hành động cạnh tranh; tab thua nhận 409 và tải trạng thái mới, không mất sự kiện thắng.

Không commit/push, chuyển nhánh, thay template hoặc regenerate/import dữ liệu trong phiên triển khai này.

## 9. Sửa lỗi sau merge — 23/10/2026

### P1: chuẩn bị response trước write

`ApplicationService.transition()` validate document/history và dựng DTO của trạng thái dự kiến trước `repo.put()`. Reference Candidate/User, email và thông tin Interview cần cho response được đọc trước persist. Sau khi ghi thành công, response lấy DTO đã chuẩn bị cộng `_rev` trả về từ repository, không đọc lại reference để dựng response. Giữ expected_rev/expected_stage, kiểm tra ownership/evidence và cập nhật history/current_stage trong một write. Conflict vẫn đọc lại scope và trả lỗi, không overwrite lịch sử thắng.

Đã kiểm tra đường `create()` có cùng mẫu: sau write vẫn đọc Job để dựng DTO, có thể trả lỗi kết nối dù đơn đã tạo. Đường này cũng chuẩn bị DTO trước write, sau write chỉ ghép revision và kết quả hook phân tích. Hook lỗi vẫn trả PENDING_RETRY như contract cũ.

File test mới `backend/tests/recruitment/application-response.test.js`: ba ca Candidate→User sai role, Candidate thiếu, User thiếu xác minh HTTP 409 INVALID_SCOPE hoặc 404 NOT_FOUND và toàn bộ document/revision/history không đổi, số writes không tăng. Trước sửa, cả ba ca đều thất bại do document đã thay đổi. Hai ca response dựng trước write cho Apply/transition cũng thất bại trước sửa; sau sửa pass. Thêm ca cạnh tranh cùng revision (một 200, một 409, đúng một event mới) và ca PATCH deadline chính xác.

Không có transaction liên User/Candidate/Job/Application/Interview. Reference có thể thay đổi sau preflight; response phản ánh dữ liệu đọc trước write. Lỗi truyền mạng sau CouchDB commit vẫn có thể tạo kết quả không chắc chắn ở client; client phải reload/reconcile theo ID/revision hiện có, không coi lỗi mạng là rollback.

### P2: giữ nguyên timestamp nếu input deadline cuối cùng không đổi

`jobFormModel.jobPayload()` so sánh deadline hiện tại với giá trị hiển thị ban đầu theo UTC+7. Nếu bằng nhau, gửi timestamp gốc nguyên vẹn, gồm giây/millisecond. Nếu người dùng sửa thật, chuyển input sang UTC bằng offset `+07:00` tường minh, không phụ thuộc timezone máy. Đổi rồi phục hồi input về giá trị ban đầu cũng giữ timestamp gốc.

PATCH backend thực sự hỗ trợ partial fields (`editJobRequestSchema` và merge changes vào document); bản sửa vẫn gửi deadline gốc để giữ contract form hiện có. Không thay đổi create validation, hạn tương lai hoặc Apply nhận đúng thời điểm deadline. Tests kiểm tra title/description, giây/millisecond, đổi rồi phục hồi input, UTC đổi ngày khi tạo mới và payload qua JobForm thực tế.

### P3: test discovery

`backend/package.json` thêm `tests/foundation/*.test.js` vào npm test, giữ nguyên data/recruitment. Node runner hiện tại chạy được glob trên PowerShell. Output full suite có 18 Foundation và 7 regression tests mới; tổng tăng từ 250 lên 275.

### Phân loại lỗi full suite bằng chứng hiện tại

Log tại `$env:TEMP/recruithub-lifecycle-fixes-tests.log`; đã đối chiếu tên các mục `not ok` với log baseline trước sửa `$env:TEMP/recruithub-postmerge-backend.log`: không có tên lỗi mới. Đây là đối chiếu bằng output thực tế, không mặc định tất cả lỗi là lỗi cũ. Runner báo 24 failed tests; TAP còn có mục suite cha bị fail, không cộng các dòng `not ok` thành số test độc lập.

| Nhóm/test lỗi | Bằng chứng và phân loại |
|---|---|
| DATA-04B: V04 Missing database, V05 Empty database, V06 Non-empty database | `fetch failed`; health database riêng cũng 503 NETWORK_ERROR → môi trường kết nối |
| DATA-04B: V15 Source release files remain immutable | SHA-256 users.jsonl thực tế khác expected → dữ liệu/checksum |
| DATA-02B.3: N-01 Wrong source hash; N-02 Missing source | Python ModuleNotFoundError pyarrow xuất hiện trước assertion dự kiến → môi trường Python |
| DATA-02B.3: N-14 distinct immutable release; N-15 active release readable | Không có content-addressed release folder, existence false → input release thiếu |
| DATA-02B.2: 11/12/13 Published dataset counts; 15 Deterministic rerun | candidates.jsonl phải tồn tại / ENOENT staged/candidates.jsonl → dữ liệu thiếu |
| DATA-03.2: 1&2 Counts; 3&6 User references; 4&5 Job scope; 7&8 Duplicates; 9/10/11 Orphans/provenance; 12/13/14/15 Source facts; 16 Deterministic rerun | ENOENT DATA-03.2 hoặc DATA-02B.2 candidates/users/companies.jsonl → release lịch sử thiếu |
| DATA-03.2: Negative Input manifest checksum mismatch | Active release directory does not exist trước assertion checksum → dữ liệu thiếu |
| DATA-03.3B Recruitment Acceptance & Verification | ENOENT DATA-03.3B candidates.jsonl → release lịch sử thiếu |
| DATA-03.4B: 9 Real publication failure injection; 10 Publication idempotent | candidates.jsonl SHA-256 altered, expected khác actual → dữ liệu/checksum |

Không phát hiện regression mới trong các checks đã chạy; không tuyên bố full suite pass. Không sửa snapshot/manifests/checksum, không skip assertions. Artifact tạm `data/scratch_bad_manifest.json` do test tạo được dọn sau chạy.

### Điều kiện bàn giao và demo

- **Đủ bàn giao phần sửa P1/P2/P3** với regression tests, discovery và lint/build đã xác minh.
- Express thật trên cổng tạm: `/api/health` 200; `/api/health/database` 503 NETWORK_ERROR; chỉ đọc, không chạy setup/index/import vì kết nối chưa sẵn sàng.
- Các luồng tạo/sửa/đăng Job, Apply/readback, SCREENING/INTERVIEW, duplicate/terminal/withdraw, revision conflict và evidence OFFER/HIRED được kiểm chứng bằng Express + memory repository/JWT fixture và React API mock, không phải Identity/CouchDB demo thật.
- Chưa nghiệm thu end-to-end: cần CouchDB truy cập được, Identity cấp token và tài khoản/profile test hợp lệ, Interview/evidence thật để thử OFFER/HIRED. Chưa có browser tool trong phiên để kiểm tra responsive và keyboard/focus thật. Không tạo token demo hoặc Interview giả để vượt phụ thuộc.
- Scoring production chưa nối hook; không có điểm giả, không mở rộng core của thành viên khác. Khi các phụ thuộc sẵn sàng, thực hiện kịch bản ở mục 8 và cập nhật bằng chứng.

Commit đề xuất (chưa thực hiện):

```text
fix(recruitment): validate responses before writes and preserve job deadlines

Prepare Application DTO references before persistence and return the saved revision.
Preserve original deadline precision when edit form input is unchanged.
Include Foundation tests in npm test and add API/UI regression coverage.
Document verification results and remaining environment/integration blockers.
```
