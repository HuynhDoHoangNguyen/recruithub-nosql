# Báo cáo tổng hợp TV1 — Toàn bộ hồ sơ giai đoạn

Ngày cập nhật: 2026-10-24. Tài liệu này gom nguyên văn 16 báo cáo TV1 trước đây để lưu một bản duy nhất. Các trạng thái trong phụ lục là trạng thái lịch sử tại thời điểm từng báo cáo; trạng thái tích hợp hiện tại là merge commit `260cf4a` trên `feature/identity-candidate-portal`. Nhánh `dev` hiện vẫn ở parent `91f8346`. Full backend suite chưa PASS; các subset test không thay thế kết quả full suite.

Báo cáo TV1 + TV2 và hướng dẫn kiểm thử được chuyển sang [báo cáo tổng hợp TV2](../TV2/RP-TV2-consolidated.md#rp-tv1-tv2-merge-test-guide). Contract hiện hành: [TV1 Auth contract](../../shared/TV1_AUTH_MODULE_CONTRACT.md), [CouchDB Foundation guide](../../shared/COUCHDB_FOUNDATION_GUIDE.md).

## Danh m?c ph? l?c

1. [RP-TV1-couchdb-client-repository.md](#rp-tv1-couchdb-client-repository)
2. [RP-TV1-database-schema-api-contract.md](#rp-tv1-database-schema-api-contract)
3. [RP-TV1-final-commit-pr-readiness.md](#rp-tv1-final-commit-pr-readiness)
4. [RP-TV1-final-review-pr-preparation.md](#rp-tv1-final-review-pr-preparation)
5. [RP-TV1-finalize-couchdb-real-mvp.md](#rp-tv1-finalize-couchdb-real-mvp)
6. [RP-TV1-frontend-backend-template-review.md](#rp-tv1-frontend-backend-template-review)
7. [RP-TV1-master-branch-completion.md](#rp-tv1-master-branch-completion)
8. [RP-TV1-pre-merge-blocker-fix.md](#rp-tv1-pre-merge-blocker-fix)
9. [RP-TV1-profile-admin-ui-polish.md](#rp-tv1-profile-admin-ui-polish)
10. [RP-TV1-runtime-integration-verification.md](#rp-tv1-runtime-integration-verification)
11. [RP-TV1-runtime-ui-acceptance.md](#rp-tv1-runtime-ui-acceptance)
12. [RP-TV1-shared-foundation-contract-handoff.md](#rp-tv1-shared-foundation-contract-handoff)
13. [RP-TV1-stage-04a-auth-backend-infrastructure.md](#rp-tv1-stage-04a-auth-backend-infrastructure)
14. [RP-TV1-stage-04b-auth-mvp-integration.md](#rp-tv1-stage-04b-auth-mvp-integration)
15. [RP-TV1-technical-decision-freeze.md](#rp-tv1-technical-decision-freeze)
16. [RP-TV1-technical-decision-register.md](#rp-tv1-technical-decision-register)


<a id="rp-tv1-couchdb-client-repository"></a>

## RecruiHub NoSQL — TV1 Stage 03A: CouchDB Client & Base Repository

_Source: RP-TV1-couchdb-client-repository.md. Original report text is retained; internal links point to the corresponding consolidated section._

**Ngày hoàn tất verification:** 2026-10-23 (Asia/Saigon)

## 1. Mục tiêu

Triển khai shared backend foundation do TV1 sở hữu: CouchDB config/client, repository cơ sở, lỗi dùng chung, tests và tài liệu handoff cho TV2/TV3; không xây repository nghiệp vụ.

## 2. Quyết định ownership

Prompt Stage 03A chốt TV1 là owner của Shared Backend Foundation, gồm CouchDB Client, DB config, Base Repository, common DB errors, response/error helpers khi contract rõ, foundation tests, documentation và handoff. Phân công này chỉ chốt ownership; không phê duyệt JWT, registration, ADMIN bootstrap, API prefix, audit storage hay Public Job API.

## 3. Trạng thái trước khi triển khai

- Branch feature/auth-profile-portal.
- Git staged trước khi làm: A docs/ARCHITECTURE_DATABASE_AUDIT.md (giữ nguyên). Hai báo cáo Stage 02 hiện có trong docs/reports/TV1/ là untracked và được giữ nguyên.
- Backend dùng npm, có package-lock.json, Node ES modules, Express 5, Zod; chưa có Nano/CouchDB dependency. package.json không có build/lint scripts.
- Source có config directory, repository directory dạng placeholder; chưa thấy CouchDB client/config/repository triển khai.
- Existing app chỉ mount health/root. Không có DB readiness trong endpoint và không có auth.
- Docker CLI preflight bị từ chối quyền kết nối Docker Engine trong shell này; chưa xác nhận trạng thái container qua Docker CLI.
- Root .env được phát hiện tồn tại, nhưng nội dung và giá trị credentials không được hiển thị.

## 4. Công việc đã thực hiện

- Thêm Zod-validated DB configuration cho server URL, database name, credential pair và timeout.
- Thêm native Fetch CouchDB client với Basic auth per request, timeout, readiness/database metadata, document GET, Mango find, deterministic create, expected-revision update và exists.
- Thêm sanitized CouchDB error types/mapping cho missing database/document, 409 conflict, authentication, network, timeout và 5xx.
- Thêm BaseRepository có optional Zod document validation và CRUD delegation.
- Thêm success/error helper provisional nhưng không gắn vào Express app hoặc thay đổi health response.
- Thêm foundation unit tests dùng fake Fetch/client; không chạy write requests lên CouchDB.
- Thêm guide và handoff examples cho TV1/TV2/TV3.

## 5. File tạo/sửa

### Tạo

- backend/src/config/database.config.js
- backend/src/services/couchdb.client.js
- backend/src/services/couchdb.errors.js
- backend/src/repositories/base.repository.js
- backend/src/utils/api-response.js
- backend/tests/foundation/database.config.test.js
- backend/tests/foundation/couchdb.errors.test.js
- backend/tests/foundation/couchdb.client.test.js
- backend/tests/foundation/base.repository.test.js
- docs/shared/COUCHDB_FOUNDATION_GUIDE.md
- docs/reports/TV1/RP-TV1-couchdb-client-repository.md

### Không sửa

Không sửa package manifests/lockfile, source business schemas/constants, Express app/routes/health, .env, Compose, dataset/manifest/importer, CouchDB data, indexes/views hoặc staged audit.

## 6. Cấu trúc module và public interfaces

### CouchDbClient

- checkReadiness()
- getDatabaseInfo()
- getDocument(id)
- find(mangoQuery)
- createDocument(document) — yêu cầu deterministic _id, từ chối _rev
- updateDocument(document, expectedRev) — yêu cầu revision, không mutation input
- exists(id)

### BaseRepository

- getById(id), find(selector, options), create(document)
- update(document, expectedRev)
- exists(id), getDatabaseInfo()
- Optional schema cho Zod validation create/update.

Client không generate ID/type, không tạo database/index/view, không tự retry mutation, không cung cấp delete khi chưa được duyệt, không expose _bulk_docs và không xem bulk là transaction.

### Error/response

CouchDbError dùng code ổn định như DATABASE_NOT_FOUND, NOT_FOUND, CONFLICT, AUTHENTICATION_ERROR, NETWORK_ERROR, TIMEOUT, SERVER_ERROR. toApiError() trả sanitized provisional format. Helpers response chưa được route nào sử dụng; runtime /api/health không đổi.

## 7. Cách cấu hình

Environment variables:

- COUCHDB_URL (default http://127.0.0.1:5984)
- COUCHDB_DATABASE (default recruitment_db)
- COUCHDB_USER và COUCHDB_PASSWORD (phải cùng có/cùng vắng)
- COUCHDB_TIMEOUT_MS (default 5000; range 100–60000)

Không đặt credential trong URL hoặc log. dotenv/config phụ thuộc working directory; khi chạy từ backend/, cung cấp các biến qua process environment hoặc ignored backend/.env. Không in hoặc sao chép giá trị root .env.

Chi tiết và ví dụ: docs/shared/COUCHDB_FOUNDATION_GUIDE.md.

## 8. Test results

- Foundation tests: node --test tests/foundation/*.test.js — PASS 15/15 ở lần chạy cuối.
- Full backend tests: npm.cmd test — FAIL; legacy data/pipeline tests báo nhiều lỗi ngoài Foundation. Xem mục 9.
- Không dùng live write tests.
- Fake-client coverage: config invalid, secret-safe errors, GET/metadata, CRUD request shapes, missing resource, conflict, network/timeout và Zod validation.

## 9. Verification results

- Foundation tests: PASS 15/15.
- Full backend suite: FAIL. Output có lỗi DATA-04B V04/V15; DATA-02B.3 failure-injection/release checks; DATA-02B.2 checksum/path checks; DATA-03.2 manifest checksum case; DATA-03.3B thiếu release input; DATA-03.4B publication checksum/idempotency cases. Các lỗi nhắc thiếu release paths, expected checksum không khớp working copy và một số failure-injection không đạt expected assertion. Không sửa dữ liệu để làm xanh suite.
- Review test code xác nhận các test live database trong V04/V05/V06 chỉ kiểm tra sự tồn tại/metadata; V04 đặt createDb=false và bị chặn trước thao tác ghi. Read-only metadata sau suite vẫn xác nhận 25,750 docs.
- Legacy test bị assertion sớm nên để lại data/scratch_bad_manifest.json; file này do chính test tạo, đã xóa đúng file test-artifact sau kiểm tra. Git status sau cleanup không còn data changes.
- Read-only CouchDB verification qua CouchDbClient: readiness PASS, CouchDB API version 3.5.2, database recruitment_db, doc_count 25,750; một document sample type resume_analysis xác thực Zod PASS.
- Docker CLI không được quyền truy cập Docker Engine trong shell preflight; không gọi lệnh điều khiển container.
- Runtime verification chỉ dùng GET server/database/document và Mango _find (HTTP POST chỉ đọc); không gọi POST ghi tài liệu, PUT, DELETE, importer hay index API.
- Backend package không định nghĩa build/lint scripts; không có lệnh build/lint để chạy.

## 10. Backend runtime và Git diff

- Existing Express app/routes không được sửa; không đổi prefix hoặc response contract.
- Git branch: feature/auth-profile-portal.
- Audit staged được giữ là A docs/ARCHITECTURE_DATABASE_AUDIT.md.
- Các file Foundation/report không tự git add; không commit/push.
- Những thay đổi dự kiến chỉ gồm các file mới liệt kê ở mục 5; Git status sau verification ghi ở kết luận.

## 11. Rủi ro và điểm cần TV2/TV3 phối hợp

- Database credentials cần có trong process environment; root .env không tự được dotenv nạp khi process chạy ở backend working directory.
- Client dùng native Fetch HTTP implementation, không Nano; không thêm dependency để tránh thay lockfile/network.
- Authentication/registration/ADMIN/prefix/API envelope/audit storage còn mở; provisional response helper không nên dùng làm contract chung trước freeze.
- TV2/TV3 phải xác nhận selectors, paging/sort và indexes theo query workloads; foundation không tạo indexes.
- find nhận Mango query; lớp nghiệp vụ phải allowlist input và enforce ownership.
- Readiness GET / + GET /{db} là read-only nhưng health route hiện không gọi nó.
- Docker CLI verification có thể bị chặn bởi policy/quyền Windows; HTTP readiness độc lập vẫn có thể xác minh service.

## 12. Acceptance criteria

- [x] Config validates protocol, URL userinfo, database name, credential pair and timeout without exposing values.
- [x] Client distinguishes database missing, document missing, conflict, authentication, network, timeout and server errors.
- [x] CRUD request behavior respects deterministic _id and caller-provided _rev, without blind retry.
- [x] BaseRepository delegates methods and applies optional Zod validation without adding business fields.
- [x] Response helpers remain provisional and existing health/root runtime behavior is unchanged.
- [x] Foundation unit tests PASS; full backend suite result recorded.
- [x] Read-only DB metadata confirms database remains at 25,750 docs; no write test was run against it.
- [x] Guide covers required TV1/TV2/TV3 handoff, env, interfaces, safety and limitations.
- [x] Branch/audit staged state unchanged; no unrelated files modified.

## 13. Trạng thái nghiệm thu

**PARTIAL.** Foundation fake-client tests và read-only CouchDB verification đạt; full backend suite thất bại trong data-pipeline/release tests không thuộc Foundation. Docker container state không xác minh được bằng Docker CLI do quyền daemon, nhưng CouchDB HTTP endpoint và database metadata đọc thành công. Không có evidence database count drift.

## 14. Bước tiếp theo

Sau khi review foundation, TV2 có thể implement JobRepository và TV3 InterviewRepository bằng BaseRepository/fake-client contract. TV1 tiếp tục Stage 03B cho readiness integration/config loading only after approved runtime contract; authentication/session work remains gated by Stage 02.5 decisions.

---

<a id="rp-tv1-database-schema-api-contract"></a>

## RecruiHub NoSQL — TV1 Stage 02: Database Schema & API Contract

_Source: RP-TV1-database-schema-api-contract.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Thông tin công đoạn

- **Công đoạn:** TV1 Stage 02 — Database Schema Audit & API Contract Design
- **Ngày lập:** 2026-10-22
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1; báo cáo kỹ thuật do Codex tổng hợp, chưa gán cá nhân
- **Trạng thái nghiệm thu:** **PARTIAL**
- **Căn cứ trạng thái:** schema và dữ liệu được đối chiếu; API nghiệp vụ chưa có route chạy, nhiều quyết định auth/session và hợp đồng liên nhóm còn mở.

## 2. Mục tiêu

Đối chiếu CouchDB `recruitment_db`, JSONL DATA-03.4B, các Zod schema và tài liệu hợp đồng; ghi lại mô hình dữ liệu thực, quan hệ, điểm không thống nhất và hợp đồng API cần phối hợp trước TV1 Stage 03.

## 3. Phạm vi và yêu cầu

- Audit chỉ đọc; không tạo/cập nhật document, index, view, database hoặc source.
- Đối chiếu đủ 9 document types và số lượng; kiểm tra tham chiếu, trạng thái, ID và Zod.
- Phân tách sự thật runtime/source khỏi đề xuất API/index.
- Không xem endpoint đề xuất là API đã triển khai.

## 4. Công việc đã thực hiện

- Kiểm tra CouchDB local và database `recruitment_db`; đọc 9 JSONL đã phục hồi nguyên bytes từ Git blob ở thư mục tạm ngoài repo.
- Đếm document, parse JSON và xác thực từng document bằng Zod schema tương ứng.
- Kiểm tra liên kết giữa User, Candidate, Recruiter, Company, Department, Job, Application, Interview và Resume Analysis.
- Đọc `docs/data-schema-contract.md`, `docs/recruitment-business-rules.md`, `docs/resume-scoring-design.md`, kiến trúc, import guide, assignment và source schemas.
- So sánh index hiện có với các truy vấn cần cho TV1/TV2/TV3.

## 5. Kết quả thực tế và bằng chứng

### 5.1 Runtime và xác thực

| Kiểm tra | Kết quả |
|---|---|
| CouchDB HTTP | `http://127.0.0.1:5984`, CouchDB API version `3.5.2` trả lời; container `recruithub-couchdb` dùng image `couchdb:3.5.2.1` |
| Database | `recruitment_db` tồn tại; `_all_dbs`/metadata đọc được; `doc_count=25750` |
| Document count | 25.750, tổng khớp manifest/release |
| Zod validation | 25.750/25.750 hợp lệ theo 9 schema; 0 lỗi |
| Quan hệ tham chiếu | Candidate→User 10.000/10.000; Recruiter→User/Company/Department 150/150; Department→Company 150/150; Job→Recruiter/Company/Department 2.500/2.500; Application→Candidate/Job 1.200/1.200; Interview→Application/Candidate/Job 350/350; Analysis→Application/Candidate/Job 1.200/1.200; không phát hiện orphan hoặc scope mismatch |
| Mango indexes | Chỉ `_all_docs` mặc định; 0 design docs và 0 Mango index tùy chỉnh |
| Backend API thực tế | `GET http://127.0.0.1:5002/api/health` trả 200; Express source chỉ mount health và root. Không có API nghiệp vụ/CouchDB repository trong app runtime |

### 5.2 Document types và schema đầy đủ

Các trường `_rev` là metadata CouchDB do server quản lý, không phải trường trong JSONL nguồn. Tất cả document có `_id`, `type`, `created_at`, `updated_at`, `provenance` nếu bảng ghi; schema có thể cho phép một số trường tùy chọn nêu rõ. Tên trường và discriminator thực tế là `type`.

| Type / số lượng | ID và trường cấp cao nhất | Cấu trúc và ghi chú |
|---|---|---|
| `user` / 10.150 | `user:<sha256(email_normalized)>`; `_id,type,email,email_normalized,password_hash?,role,account_status,created_at,updated_at,provenance?` | `role`: `CANDIDATE`,`RECRUITER`,`ADMIN`; `account_status`: `ACTIVE`,`LOCKED`,`RESET_REQUIRED`. Email chuẩn hóa là canonical duy nhất. `password_hash` tùy chọn trong schema nhưng vắng ở cả 10.150 seeded docs; mọi account seeded là `RESET_REQUIRED`; dataset không có ADMIN. Email dùng domain `example.invalid`. |
| `candidate` / 10.000 | `candidate:cms:<resume_id>`; `_id,type,source_resume_id?,profile,skills,education,experience_summary?,experience,projects,data_availability,created_at,updated_at,provenance,user_id` | `profile`: `role,seniority,industry,years_experience,experience_months,summary?,full_name?`; experience months = years × 12. `skills[]`: item kỹ năng có `name,normalized`; `education[]`: các item học vấn một phần, gồm degree theo schema; `experience_summary` có bullets; `experience[]` là employment items; `projects[]` là project items; availability gồm `skills,experience,education,projects`. Dataset: experience/projects arrays rỗng ở toàn bộ 10.000; skills AVAILABLE, experience PARTIAL, education PARTIAL, projects UNAVAILABLE. Partial data không được tự điền. |
| `company` / 50 | `company:<stable-id>`; `_id,type,name,industry,website?,address?,created_at,updated_at,provenance` | Website/address tùy chọn theo schema; provenance bắt buộc. Tài liệu mapping cũ có thể không liệt kê `address`; không có trong các bản ghi dataset đã khảo sát. |
| `department` / 150 | `department:<stable-id>`; `_id,type,company_id,name,key,created_at,updated_at,provenance` | `company_id` tham chiếu Company. Mỗi Department trong dataset thuộc đúng Company được tham chiếu bởi Recruiter/Job liên quan. |
| `recruiter` / 150 | `recruiter:<stable-id>`; `_id,type,user_id,company_id,department_id,created_at,updated_at,provenance` | Ba reference lần lượt tới User, Company, Department; account role phải là RECRUITER; company/department scope của recruiter và job nhất quán. |
| `job` / 2.500 | `job:cms:<job_id>`; `_id,type,source_job_id,title,seniority,industry,description,responsibilities,requirements,required_skills,optional_skills,status,created_at,updated_at,provenance,company_id,department_id,recruiter_id,deadline?` | Seniority `JUNIOR/MID/SENIOR`; status `DRAFT/OPEN/CLOSED`. `requirements`: `general[]`, `experience{status,required_months?}`, `education{status,minimum_degree?}`, `project{status,required_technologies?}`. DRAFT=2.300, OPEN=200, CLOSED=0; deadline có ở 200 OPEN và vắng ở 2.300 DRAFT. Requirement status observed: experience UNAVAILABLE=2.350, REQUIRED=134, NO_MINIMUM=16; education UNAVAILABLE=2.350, REQUIRED=114, NO_MINIMUM=36; project UNAVAILABLE=2.350, REQUIRED=50, NO_REQUIREMENT=100. |
| `application` / 1.200 | `application:pair:<sha256(candidate_id + "\n" + job_id)>`; `_id,type,candidate_id,job_id,current_stage,stage_history,applied_at,updated_at,provenance` | Không có `status` hay `match_score`. Stage là nguồn sự thật duy nhất: `APPLIED,SCREENING,INTERVIEW,OFFER,HIRED,REJECTED,WITHDRAWN`. History item có `from_stage` (null lúc đầu), `to_stage`, `timestamp`, `actor_role`, `actor_id`, `evidence?`, `reason_code?`. Count: APPLIED 300, SCREENING 250, INTERVIEW 120, OFFER 60, HIRED 40, REJECTED 350, WITHDRAWN 80. ID xác định một lifetime Candidate–Job pair. |
| `interview` / 350 | `interview:<application-key>:<round>`; `_id,type,application_id,candidate_id,job_id,interviewer_id,round,interview_type,scheduled_at,completed_at?,score?,feedback?,result?,created_at,updated_at,provenance` | Round số nguyên dương; `interview_type` theo enum schema; interviewer là recruiter/user ID hợp lệ. Dataset có 310 interview đã hoàn tất với `completed_at,score,feedback,result`; 40 chưa hoàn tất và thiếu các trường này. `result` là PASSED/FAILED khi hoàn tất. Không có `status` field. |
| `resume_analysis` / 1.200 | `analysis:<application_id>`; `_id,type,application_id,candidate_id,job_id,analysis_status,scores,matched_skills,missing_skills,component_details,missing_inputs,algorithm_version,input_fingerprint,analyzed_at,provenance,total_score?,recommendation?` | `scores` gồm skill/experience/education/project (có thể null theo INCOMPLETE). `component_details` mang công thức và đầu vào từng component; `missing_inputs[]` giải thích thiếu. `algorithm_version` là `recruithub-scoring-mvp-v1`; fingerprint SHA-256. COMPLETE=591 có total/recommendation; INCOMPLETE=609 không có total/recommendation. Recommendation HIGH=23, MEDIUM=65, LOW=503. |

### 5.3 API contract đề xuất — chưa triển khai

Backend hiện chỉ có `GET /`, `GET /api/health`; không có auth, profile, jobs, admin hay CouchDB API nghiệp vụ. Bảng dưới là contract cần freeze với nhóm, không phải API đang chạy.

| Method / route đề xuất | Actor | Mục đích / quyền | Trạng thái |
|---|---|---|---|
| `POST /api/auth/register/candidate` | Public | Tạo User + Candidate; không nhận role tùy ý; trả DTO an toàn | Đề xuất, cần freeze transaction/partial failure và credential/session policy |
| `POST /api/auth/register/recruiter` | Invite/admin-provision candidate | Tạo User + Recruiter trong Company/Department được cấp quyền | Cần nhóm xác nhận public hay invited/approved |
| `POST /api/auth/login` | Public | Xác thực credential, phát session theo chính sách được duyệt | Cần freeze cookie/JWT/CSRF/expiry |
| `POST /api/auth/logout` | Authenticated | Xóa session cookie; thu hồi refresh/session nếu store được duyệt | Cần freeze revocation semantics |
| `POST /api/auth/refresh` | Refresh session | Cấp access token mới theo refresh rotation nếu được duyệt | Chưa có session store/route |
| `GET /api/users/me` | Authenticated | Trả user identity an toàn, không có hash/token | Đề xuất |
| `GET/PATCH /api/candidates/me` | Candidate owner | Đọc/cập nhật Candidate được liên kết với chính user | Đề xuất; cập nhật dùng `_rev` |
| `GET /api/jobs` và `GET /api/jobs/:id` | Public | Chỉ công bố OPEN jobs; TV2 sở hữu backend Job API | Chờ contract TV2; không hứa salary/location/full text vì schema hiện không bảo đảm |
| `/api/admin/...` | Admin | User/document overview và thao tác admin trong allowlist | Chờ ADMIN bootstrap và permission contract |

**Envelope đề xuất để nhóm chốt:** thành công `{ "success": true, "data": ..., "message": "..." }`; lỗi `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`. Dùng HTTP 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 rate-limited, 500 generic server error; không trả stack, hash hay token. Collection response đề xuất `{items, pageInfo:{nextCursor,hasMore}}`, cursor opaque dựa trên Mango bookmark và thứ tự ổn định `_id` làm tie-breaker. Envelope, cursor và status mapping cần được thống nhất; không xem là chốt API.

## 6. Các khác biệt giữa dataset, source và tài liệu kiến trúc

| Vấn đề | Dataset / Zod / hợp đồng ưu tiên | Tài liệu lệch hoặc cũ | Hệ quả |
|---|---|---|---|
| Discriminator | `type` | `ARCHITECTURE.md`/README có ví dụ `doc_type` | Ví dụ tài liệu không dùng làm query/schema cho dữ liệu hiện tại. |
| Application stages | `INTERVIEW`, `OFFER` | Assignment/AGENTS có `INTERVIEWING`, `OFFERED` | TV2 và UI phải dùng enum DATA-02A; cập nhật tài liệu trước tích hợp. |
| IDs | `candidate:cms:...`, `job:cms:...`, `application:pair:<sha256>`, `analysis:<application_id>` | Kiến trúc có ID minh họa kiểu `cand_...`, `app_...` | Không suy ID mới từ ví dụ cũ. |
| User credentials | Không có `password_hash` ở 10.150 docs; `RESET_REQUIRED`; không có ADMIN | Tài liệu tổng quan nêu JWT/auth nhưng không mô tả bootstrap/cấp credential | Không bật seeded user trực tiếp; cần quy trình credential được phê duyệt. |
| Audit/system log | Chính xác 9 business types, không có audit document | Master prompt có `system_log`/`audit_trail` | Không tự thêm type thứ 10; TV3 cần quyết định storage/retention. |
| DB indexes | Runtime chỉ `_all_docs` | Kiến trúc nói Mango/View | Cần index plan và tạo có phê duyệt; chưa có query performance guarantee. |
| Import tracking | Git track JSONL/manifest (Stage01); raw blob hash là nguồn bytes chuẩn | `COUCHDB_IMPORT_GUIDE.md` ghi file release không track | Guide stale; không ảnh hưởng schema, nhưng cần sửa ở task tài liệu riêng. |
| API prefix / auth frontend | Backend runtime `/api/health`; frontend service fallback `/api/v1`, AuthContext dùng localStorage JWT và authHelper gọi URL ngoài RecruiHub | Architecture nói `/api/v1` và JWT chung, backend chưa triển khai | Prefix/session không nhất quán; frontend hiện không thể được xem là client tích hợp backend auth. |

### 6.1 Quan hệ document đã xác minh

- Mỗi Candidate trỏ một User role CANDIDATE; các user_id duy nhất.
- Mỗi Recruiter trỏ một User role RECRUITER và đúng Company/Department; 150/150 liên kết đúng scope.
- Job trỏ Recruiter, Company, Department tương thích nhau.
- Application trỏ Candidate và Job; deterministic pair ID đúng; không lặp Candidate–Job pair.
- Interview sao chép đúng application/candidate/job refs; interviewer là Recruiter; round duy nhất trong Application.
- Resume Analysis sao chép đúng Application/Candidate/Job refs và có ID `analysis:<application_id>`.

## 7. Permission Matrix đề xuất

Quyền domain theo business rules được duyệt; API endpoint cụ thể vẫn cần triển khai và contract freeze. Server phải kiểm tra role và ownership ở mỗi request; frontend guard không phải ranh giới bảo mật.

| Tài nguyên/thao tác | Public | Candidate | Recruiter | Admin |
|---|---|---|---|---|
| Job list/detail | Chỉ đọc Job OPEN | Đọc OPEN | Đọc OPEN và job thuộc scope của mình | Đọc/overview theo allowlist |
| Candidate profile | Không | CRUD giới hạn trên profile của mình | Không đọc private fields nếu không có ứng tuyển/quyền nghiệp vụ được duyệt | Đọc/quản trị theo policy được duyệt |
| Application | Không | Tạo một lần cho chính mình; đọc own; withdraw chỉ APPLIED/SCREENING/INTERVIEW | Đọc application thuộc job/company scope; stage transitions theo rules | Overview/audit theo quyền được duyệt |
| Job management | Không | Không | Job trong recruiter/company scope | Admin oversight; không thay owner logic của TV2 |
| Interview / analysis | Không | Chỉ nội dung hiển thị được phê duyệt cho own application | Chỉ application thuộc scope; feedback/rating theo TV3 rules | Audit/overview nếu storage contract được duyệt |
| User administration | Đăng ký Candidate theo chính sách được chốt | Không nâng role | Không nâng role | Quản lý theo allowlist; không cho tự khóa admin cuối |

“Chỉ đọc OPEN”, quyền ứng viên và ownership guard phù hợp business rules. Các ô quản trị, recruiter self-registration, lộ feedback/analysis và field-level redaction vẫn cần nhóm chốt; bảng không tự cấp quyền production.

## 8. Dependency Matrix TV1/TV2/TV3

| Module | Owner | Depends on | Điều kiện / blocking |
|---|---|---|---|
| Identity, Candidate profile, Public Portal, Admin | TV1 | CouchDB foundation; User/Candidate schemas; session/error contract; Job card/detail & paging từ TV2; audit storage decision từ TV3 cho admin trail | Auth flows, ADMIN bootstrap và API envelope/prefix là blocker; job browse integration chờ TV2 DTO |
| Recruiter, Job, Application | TV2 | User/Candidate refs và ownership từ TV1; approved stage transitions; CouchDB repository; Interview integration từ TV3 | Chốt DTO/enums, stage update semantics, ownership, public Job filter/cursor |
| Interview, Scoring, Audit | TV3 | Application/Job/Candidate contracts TV1/TV2; approved scoring rules; decision về audit persistence | Interview create/retry reconciliation đã có business rules; audit storage/type chưa chốt |
| Shared platform | Chưa được giao | DB client/config, Zod, response/errors, auth principal, logging, index ownership | Điểm nghẽn chung; cần owner và contract trước vertical slice tích hợp |

## 9. Index / View Proposal — chưa tạo

Đây là thiết kế theo query dự kiến, chưa được cài vào CouchDB. Chốt Mango selectors, sort, index names và đo query trước khi tạo:

| Mục đích | Mango index field proposal |
|---|---|
| Candidate theo user | `type, user_id` |
| Public job browse | `type, status, created_at, _id` (thêm industry/seniority/company/department chỉ theo query/filter được TV2 chốt) |
| User admin filter | `type, role, account_status, created_at, _id` |
| Candidate application history | `type, candidate_id, applied_at, _id` |
| Recruiter job pipeline | `type, job_id, current_stage, applied_at, _id` |
| Interview rounds theo application | `type, application_id, round` |
| Analysis theo job/status/rank | `type, job_id, analysis_status, total_score, _id` |

Lookup login không cần Mango index riêng nếu email chuẩn hóa luôn ánh xạ deterministic tới User `_id`; lookup trực tiếp document ID. Đề xuất view: type counts; OPEN jobs theo filter/sort; applications theo job+stage; users theo role+status. View/Mango đều cần TV2/TV3 query requirements, index validation trên dataset và phê duyệt trước khi ghi DB. Không đề xuất index cho full-text search cho tới khi giải pháp tìm kiếm được chọn.

## 10. Các file đã tạo, sửa hoặc đọc

- **Tạo:** file báo cáo này.
- **Đã đọc/đối chiếu:** `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, `docs/data-schema-contract.md`, `docs/recruitment-business-rules.md`, `docs/resume-scoring-design.md`, `docs/COUCHDB_IMPORT_GUIDE.md`, tài liệu assignment, các file `backend/src/schemas/*.schema.js`, `backend/src/constants/document.constants.js`, backend app/server, frontend API/auth sources, manifest và 9 JSONL release từ thư mục temp.
- **Không sửa:** source, dataset, manifest, DB, index/view, file audit đang staged.

## 11. Thay đổi CSDL/API/source

Không có. Kết nối CouchDB và GET verification là read-only; không gọi importer, không tạo database/index/view/document. Không thêm hoặc sửa API route. Các endpoint trong mục 5 là proposal.

## 12. Test, build và verification

- 9/9 JSONL parse; 25.750 documents hợp lệ Zod; 0 validation errors.
- Các kiểm tra quan hệ nêu mục 5.1 đạt toàn bộ số lượng; 0 orphan/scope mismatch.
- CouchDB runtime và backend health endpoint được đọc; `_index` xác nhận chưa có custom Mango indexes.
- Không chạy test suite, build hay lint; không thuộc phạm vi audit này.
- Git đầu/cuối khi bắt đầu báo cáo: branch `feature/auth-profile-portal`; chỉ `docs/ARCHITECTURE_DATABASE_AUDIT.md` staged (`A`). Báo cáo cần được giữ ngoài staged state, không tự `git add`.

## 13. Vấn đề và rủi ro

- Không có credential/hash cho seeded users; toàn bộ phải ở RESET_REQUIRED. Rủi ro kích hoạt nhầm tài khoản nếu auth bypass trạng thái này.
- Không có ADMIN; thiếu bootstrap an toàn, không thể nghiệm thu admin flow.
- Session policy chưa khóa: vị trí JWT, expiry, CSRF, refresh/revocation, logout.
- Frontend API client có base `/api/v1`, token localStorage và external logout URL; backend chỉ có `/api/health`. Không dùng như bằng chứng API tích hợp.
- TV2 public jobs chưa có DTO/query/cursor contract; TV1 không sở hữu backend Job API.
- TV3 audit storage chưa thống nhất, trong khi schema khóa đúng 9 business types.
- Không có custom indexes; browse/pipeline/ranking query có thể cần index trước workload thực.
- Tài liệu kiến trúc và assignment chứa discriminator/stage/ID cũ; nguy cơ nhóm sinh code không tương thích dữ liệu.

## 14. Quyết định cần nhóm xác nhận

1. ADMIN first-user bootstrap và chính sách không khóa admin cuối.
2. Candidate registration public; Recruiter đăng ký bằng invite, admin provisioning hay approval; cách cấp trạng thái mà không thêm enum trái hợp đồng.
3. Password hashing algorithm/parameters; seeded RESET_REQUIRED activation/reset procedure.
4. Cookie/JWT lifetime, CSRF, refresh rotation/store, logout/revocation semantics.
5. `/api` hay `/api/v1` làm prefix chuẩn; đồng bộ frontend/backend/TV2.
6. Success/error envelope, mã lỗi, pagination cursor/sort.
7. TV2 public Job DTO/filter/search/sort/cursor và ownership giữa recruiter/company.
8. TV3 audit events, storage, retention, field redaction; có cho phép business doc type bổ sung ngoài chín type đã duyệt không.
9. Index names/fields và owner chịu trách nhiệm apply/rollback.

## 15. Công việc còn lại và blockers trước Stage 03

**Blocker trước phần auth tích hợp:** freeze account registration/activation, password hash, session/cookie/CSRF/logout, ADMIN bootstrap, API prefix và response/error contract. Không nên triển khai auth endpoints theo suy đoán.

**Blocker trước portal job integration:** TV2 xác nhận Job card/detail DTO, chỉ OPEN, filters, stable sort/cursor và lỗi. Không tự thêm lương/vị trí khi dữ liệu không bảo đảm.

**Blocker trước audit persistence/admin trail:** TV3 và nhóm chọn audit storage/retention/PII; không tạo `audit_log` document tự ý.

**Còn lại:** giao owner shared platform; cập nhật tài liệu lệch ở task riêng; lập index plan theo truy vấn và xin duyệt trước thao tác ghi DB; thiết kế tests hợp đồng. Có thể bắt đầu thuần DTO/mapping/profile validation theo schema đã duyệt nếu vẫn cô lập và không giả định các quyết định đang mở.

## 16. Điều kiện nghiệm thu và trạng thái

**PARTIAL** — đạt phần audit schema, counts, Zod, integrity và contract proposal; chưa đạt hoàn tất Stage 02 vì API nghiệp vụ chưa triển khai và các quyết định tích hợp nêu trên chưa được phê duyệt. Không tuyên bố API đề xuất đã tồn tại.

Nghiệm thu Stage 02 đầy đủ khi TV1/TV2/TV3 chốt các mục 14, có owner cho shared DB/API foundations, xác nhận tài liệu enum/type chuẩn, và có contract review được ký nhận. Bất kỳ thao tác ghi DB/index cần nằm trong task có phạm vi/phê duyệt riêng.

## 17. Bước triển khai tiếp theo — đề xuất

Thực hiện Stage 02.5 technical decision freeze. Sau khi nhóm xác nhận blockers, Stage 03 có thể triển khai auth/profile skeleton và tests theo contract, rồi tích hợp Public Job API với TV2 và audit theo quyết định TV3. Các bước này là đề xuất, chưa được thực hiện trong báo cáo.

---

<a id="rp-tv1-final-commit-pr-readiness"></a>

## ﻿# RecruiHub NoSQL — TV1 Final Commit & PR Readiness

_Source: RP-TV1-final-commit-pr-readiness.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Scope and Git state

- **Date:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **HEAD:** `f06f970`; local `dev` also points to `f06f970` (read-only comparison; no fetch).
- **Before this report:** 69 modified/untracked entries, no staged changes. This report makes 70 entries.
- No stage, commit, push, merge, reset, clean or stash was performed. All prior worktree changes were preserved.
- `.env` is ignored by `.gitignore` and is not tracked. `node_modules/` and `frontend/dist/` are ignored. No database dump, backup, runtime log or credential file is in the changed-file set. A scan found no embedded JWT/private-key pattern in source and reports; `.env` was excluded from scanning/output.
- `git diff --check` passes; Git prints standard LF-to-CRLF warnings. There is no staged content to validate yet. Re-run staged diff/secret checks after an authorized manual staging step.

## 2. File classification

All current changes are TV1 implementation, shared foundation, or TV1 documentation. No changed path belongs to TV2/TV3 backend business source. There are no additional unrelated or temporary source files. Build artifacts remain ignored.

### Proposed commit 1 — Shared CouchDB Foundation (6 files)

- `.env.example`
- `backend/src/app.js`
- `backend/src/repositories/base.repository.js`
- `backend/src/services/couchdb.client.js`
- `backend/tests/foundation/couchdb.client.test.js`
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`

These contain shared DB integration/config examples, repository/client behavior, app wiring and focused tests. `.env.example` also contains auth-related placeholders; it is intentionally shared. `app.js` contains both Foundation/CORS wiring and `/api/v1` mounting, so it overlaps with Auth and should stay in this foundational commit or be split only after reviewing its complete staged diff.

### Proposed commit 2 — TV1 Auth/Profile/Admin Backend (30 files)

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/config/auth-database.config.js`
- `backend/src/middleware/authenticate.js`
- `backend/src/middleware/authorize.js`
- `backend/src/middleware/validate-body.js`
- `backend/src/repositories/candidate.repository.js`
- `backend/src/repositories/user.repository.js`
- `backend/src/routes/admin-user.routes.js`
- `backend/src/routes/api-v1.routes.js`
- `backend/src/routes/auth.routes.js`
- `backend/src/routes/candidate-profile.routes.js`
- `backend/src/schemas/auth-request.schema.js`
- `backend/src/schemas/candidate-profile.schema.js`
- `backend/src/services/admin-user.service.js`
- `backend/src/services/auth.service.js`
- `backend/src/services/candidate-profile.service.js`
- `backend/src/services/jwt-access-token.js`
- `backend/src/services/user.dto.js`
- `backend/src/utils/send-api-error.js`
- `backend/tests/auth-foundation/admin-user.service.test.js`
- `backend/tests/auth-foundation/api-v1.test.js`
- `backend/tests/auth-foundation/auth-contract.test.js`
- `backend/tests/auth-foundation/auth-mvp.test.js`
- `backend/tests/auth-foundation/auth-routes.test.js`
- `backend/tests/auth-foundation/authorization.test.js`
- `backend/tests/auth-foundation/candidate-profile.test.js`
- `backend/tests/auth-foundation/cors.test.js`
- `backend/tests/auth-foundation/domain-routes.test.js`
- `backend/tests/auth-foundation/repositories.test.js`

Argon2 is the package/lockfile change. No credentials are part of this group. `backend/src/app.js` and `.env.example` are shared with commit 1, not duplicated here.

### Proposed commit 3 — TV1 Frontend and Public Job development adapter (23 files)

- `frontend/.env.example`
- `frontend/src/api/axiosClient.js`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/auth-context.js`
- `frontend/src/context/useAuth.js`
- `frontend/src/index.css`
- `frontend/src/mocks/publicJobs.js`
- `frontend/src/pages/Dashboard/AdminDashboard.jsx`
- `frontend/src/pages/Jobs/JobDetails.jsx`
- `frontend/src/pages/Jobs/JobList.jsx`
- `frontend/src/pages/Landing.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/services/api.js`
- `frontend/src/services/publicJobsApi.js`
- `frontend/src/services/publicJobsModel.js`
- `frontend/src/utils/authHelper.js`
- `frontend/tests/auth/auth-helper.test.js`
- `frontend/tests/public-jobs/public-jobs.test.js`

This group adapts the existing React shell and provides development-only public-job fixtures. `frontend/.env.example` is the only config overlap with backend integration; it contains a placeholder API URL, no secrets.

### Proposed commit 4 — Contracts and TV1 reports (11 files)

- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/reports/TV1/RP-TV1-final-review-pr-preparation.md`
- `docs/reports/TV1/RP-TV1-finalize-couchdb-real-mvp.md`
- `docs/reports/TV1/RP-TV1-frontend-backend-template-review.md`
- `docs/reports/TV1/RP-TV1-master-branch-completion.md`
- `docs/reports/TV1/RP-TV1-pre-merge-blocker-fix.md`
- `docs/reports/TV1/RP-TV1-runtime-ui-acceptance.md`
- `docs/reports/TV1/RP-TV1-stage-04a-auth-backend-infrastructure.md`
- `docs/reports/TV1/RP-TV1-stage-04b-auth-mvp-integration.md`
- `docs/reports/TV1/RP-TV1-final-commit-pr-readiness.md`

Reports can be kept in a separate documentation commit or omitted from the product PR by team agreement. Do not omit the contract/decision record while presenting unresolved policies as approved.

## 3. Frontend deletion review

The five substantially shortened pages total roughly 1,257 lines at HEAD and 518 lines in the working copy. Build and lint establish syntax/quality, not visual or product equivalence. The current routes still include Landing, Login, Register, Jobs, Job Details, Candidate Profile, Admin Dashboard and existing Recruiter/Job Seeker dashboards.

Diff review found these visible template capabilities removed or narrowed:

- **Landing:** the previous inline job search/location preview is gone; the page now links to the Jobs page.
- **Job List:** previous location, company, skills and work-mode filter controls and salary/location display are absent from the current fixture-backed page; current filters are search, industry and seniority.
- **Job Details:** previous salary/location/experience display and Apply/Withdraw UI are gone. The old calls targeted `/apply`, which is not implemented in this backend; TV2 owns that API and the replacement page explicitly says application integration is pending.
- **Candidate Profile:** the legacy location, resume-link and certification fields are not represented in the current DATA-02A profile form. The current page edits fields in the approved Candidate schema and supports education, experience, projects and skills.
- **Admin Dashboard:** the legacy All Jobs panel and delete-user/delete-job actions are gone. Those called `/admin/jobs`, user-delete and job-delete routes absent from the current backend; TV1 Admin scope now lists/details users and changes eligible non-Admin account status, while Job management is TV2-owned.

These removed calls were not backed by current server endpoints and some used legacy fields outside DATA-02A, so replacing them avoids presenting unsupported operations as working. Still, this is a material change from the prior template and the task explicitly asks to preserve existing UI. Browser visual comparison is unavailable. **Get TV1/product and TV2 acknowledgement that these legacy affordances may remain removed or be deferred before merge.** No source edits were made in this finalization review.

Public Job fixtures are gated by `import.meta.env.DEV`; production builds do not serve fixtures and instead report the TV2 API integration pending. No TV2/TV3 source was changed.

## 4. Final quality gate

| Check | Result |
|---|---|
| Backend Auth/Foundation tests | **PASS 52/52** — includes Admin-target status rejection/concurrency, CORS, auth/profile and Foundation behavior |
| Frontend tests | **PASS 4/4** |
| Frontend production build | **PASS** |
| Frontend lint | **PASS**, 0 errors, 16 warnings in existing general pages/components |
| `git diff --check` | **PASS**, LF/CRLF advisory warnings only |
| Root `.env` | ignored and untracked; no embedded JWT/private-key patterns found in source/report scan; `.env` was excluded and is ignored; staged area is empty |
| TV2/TV3 backend source | no changed paths found |
| Legacy data/release tests | not run; shared scratch/release side effects are documented |
| Browser E2E | not verified; no browser surface available |
| CouchDB metadata (read-only) | demo `recruithub_auth_demo`: 11 docs; `recruitment_db`: 25,750 docs |

The demo count includes three synthetic Candidate registrations from the prior runtime acceptance. This audit performed metadata reads only; it did not mutate CouchDB.

Admin service retains the restricted policy: all status changes targeting an ADMIN return 403 `ADMIN_STATUS_CHANGE_FORBIDDEN`; eligible Candidate/Recruiter changes require current `If-Match`; RESET_REQUIRED remains protected. CORS uses exact-origin allowlisting with `Authorization`, `Content-Type`, `If-Match` and exposed `ETag`.

## 5. Pending contracts and dependencies

- Candidate self-registration provenance classification/field origins: **PENDING** data-owner decision.
- Self-service Candidate ID convention `candidate:<sha256(user_id)>`: **PENDING** team acknowledgement; do not change DATA-02A silently.
- Mutation retry conflict between DATA-02A (one conditional retry) and `AGENTS.md` (up to three): **PENDING** reconciliation; Foundation does not retry mutations.
- TV2: Public Job/Apply API/DTO, OPEN-only policy, filters, pagination and error contract.
- TV3: Interview/Scoring/Audit API/DTO, storage, retention and redaction policy.
- Browser visual, interaction and responsive acceptance: **PENDING**.

No DATA-02A or shared business contract was edited in this task.

## 6. PR proposal and merge status

**Suggested title:** `feat(tv1): add identity, candidate profile and public portal MVP`

**Suggested description:** Implements the TV1 Shared CouchDB Foundation integration, Candidate registration/login/current-user and profile APIs, server-side authorization, Admin User/statistics APIs, and integration with the existing React app. Uses Argon2id and short-lived memory-only Bearer JWT under provisional TV1 decisions. Public Job fixtures are development-only; production waits for the TV2 API contract. Focused backend/frontend tests and frontend build pass. Runtime API E2E was exercised only against isolated `recruithub_auth_demo` (11 docs); `recruitment_db` stayed at 25,750 docs. Browser E2E and TV2/TV3 integrations remain pending.

**Status: BLOCKED pending UI-scope acknowledgement and browser review.** The implementation and targeted quality gates are green, but substantial prior-template behavior has been removed/narrowed, browser equivalence cannot be verified here, and the feature branch still points to the same commit as `dev` with all work unstaged. Before committing/merging, obtain acknowledgement on the removed/deferred UI affordances, complete the manual browser checklist, and agree how pending team decisions/dependencies are represented in the PR. Then stage only the four reviewed groups and inspect staged diffs (`git diff --cached --stat`, `git diff --cached --check`, and a secret scan) before creating commits.

---

<a id="rp-tv1-final-review-pr-preparation"></a>

## RecruiHub NoSQL — TV1 Final Review & PR Preparation

_Source: RP-TV1-final-review-pr-preparation.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; review do Codex tổng hợp, chưa gán cá nhân.
- **Mục tiêu:** kiểm tra thay đổi TV1 trước review/PR; không triển khai lại module, không thao tác dữ liệu.
- **Trạng thái:** **PARTIAL — NOT READY TO MERGE**.

## 2. Phạm vi

Đã rà Git status, source/API/Auth/RBAC/profile/admin/public-job adapter, schema DATA-02A, tài liệu, runtime CORS, CouchDB metadata read-only và các test/build/lint được yêu cầu. Không stage, commit, push, merge, reset, clean; không sửa source; không gọi CouchDB mutation. Browser automation không có browser/app surface trong môi trường hiện tại.

## 3. Git và phân loại thay đổi

- Branch đúng: `feature/identity-candidate-portal`.
- Local `dev` và feature branch cùng HEAD `f06f970`; chưa có commit feature mới. Thay đổi đang trong working tree, chưa thể tạo PR chỉ từ branch pointer hiện tại.
- Trước report này: **65 entries chưa stage** (25 modified + 40 untracked); staged diff rỗng. Report này tạo thêm một untracked file. Không stage hoặc sửa thay đổi có sẵn.
- `.env` được Git ignore, không tracked; credentials/JWT secret không xuất hiện trong status. `node_modules` và `frontend/dist` là ignored artifacts. Không thấy dump/backup/zip/log trong thay đổi Git.
- `git diff --check`: PASS; có cảnh báo chuẩn LF→CRLF.
- Backend TV2/TV3 source/routes không bị sửa. Public Job UI/adapter của TV1, Shared Foundation, Auth/Profile/Admin thuộc phạm vi TV1.

### Danh sách dự kiến cho commit TV1

**Shared Foundation / mẫu cấu hình (6):**

- `.env.example`
- `backend/src/app.js`
- `backend/src/repositories/base.repository.js`
- `backend/src/services/couchdb.client.js`
- `backend/tests/foundation/couchdb.client.test.js`
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`

**Auth, Candidate Profile, Admin API (18 source + 9 tests):**

- `backend/src/config/auth-database.config.js`
- `backend/src/middleware/authenticate.js`
- `backend/src/middleware/authorize.js`
- `backend/src/middleware/validate-body.js`
- `backend/src/repositories/candidate.repository.js`
- `backend/src/repositories/user.repository.js`
- `backend/src/routes/admin-user.routes.js`
- `backend/src/routes/api-v1.routes.js`
- `backend/src/routes/auth.routes.js`
- `backend/src/routes/candidate-profile.routes.js`
- `backend/src/schemas/auth-request.schema.js`
- `backend/src/schemas/candidate-profile.schema.js`
- `backend/src/services/admin-user.service.js`
- `backend/src/services/auth.service.js`
- `backend/src/services/candidate-profile.service.js`
- `backend/src/services/jwt-access-token.js`
- `backend/src/services/user.dto.js`
- `backend/src/utils/send-api-error.js`
- `backend/tests/auth-foundation/admin-user.service.test.js`
- `backend/tests/auth-foundation/api-v1.test.js`
- `backend/tests/auth-foundation/auth-contract.test.js`
- `backend/tests/auth-foundation/auth-mvp.test.js`
- `backend/tests/auth-foundation/auth-routes.test.js`
- `backend/tests/auth-foundation/authorization.test.js`
- `backend/tests/auth-foundation/candidate-profile.test.js`
- `backend/tests/auth-foundation/domain-routes.test.js`
- `backend/tests/auth-foundation/repositories.test.js`

**Dependency (2):** `backend/package.json`, `backend/package-lock.json` (Argon2).

**Frontend TV1 integration (23):**

- `frontend/.env.example`
- `frontend/src/api/axiosClient.js`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/auth-context.js`
- `frontend/src/context/useAuth.js`
- `frontend/src/index.css`
- `frontend/src/mocks/publicJobs.js`
- `frontend/src/pages/Dashboard/AdminDashboard.jsx`
- `frontend/src/pages/Jobs/JobDetails.jsx`
- `frontend/src/pages/Jobs/JobList.jsx`
- `frontend/src/pages/Landing.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/services/api.js`
- `frontend/src/services/publicJobsApi.js`
- `frontend/src/services/publicJobsModel.js`
- `frontend/src/utils/authHelper.js`
- `frontend/tests/auth/auth-helper.test.js`
- `frontend/tests/public-jobs/public-jobs.test.js`

**Documentation (8 including this report):**

- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/reports/TV1/RP-TV1-finalize-couchdb-real-mvp.md`
- `docs/reports/TV1/RP-TV1-frontend-backend-template-review.md`
- `docs/reports/TV1/RP-TV1-master-branch-completion.md`
- `docs/reports/TV1/RP-TV1-stage-04a-auth-backend-infrastructure.md`
- `docs/reports/TV1/RP-TV1-stage-04b-auth-mvp-integration.md`
- `docs/reports/TV1/RP-TV1-final-review-pr-preparation.md`

The lists cover the 65 existing entries plus this report. Exclude ignored `.env`, credentials, `node_modules`, `frontend/dist`, database files, and CouchDB data. Page diffs have substantial deletions (Landing, JobList, JobDetails, Profile, AdminDashboard); inspect visually before approval.

## 4. Code and architecture review

### Confirmed strengths

- Auth uses Argon2id (`memoryCost=65536`, `timeCost=3`, `parallelism=1`) and HS256 Bearer JWT with 15-minute expiry, issuer/audience and canonical User subject. Authentication reloads User and checks current ACTIVE status; authorization is server-side.
- Candidate registration does not accept role/status/IDs from the client. Deterministic IDs and existing User/Candidate Zod schemas are used. User is staged as RESET_REQUIRED, Candidate is created, then only the new User is conditionally activated. Partial failures leave an inactive staged account.
- Safe User DTO excludes password hash, `_rev` and provenance. Profile ownership derives from authenticated `sub`; patches are allowlisted and require the current ETag revision; CouchDB conflicts map to 409.
- Admin status changes require `If-Match`, cannot change RESET_REQUIRED accounts, and status DTO cannot mutate role. Admin routes require verified ADMIN principal.
- Foundation client uses deterministic IDs and expected `_rev`; it does not automatically retry mutations or create business documents/indexes. Tests use fake clients/repositories.
- Public Jobs is explicitly fixture-backed in development while TV2 API integration is pending; production mode does not silently present fixture data as live.

### Findings / blockers

1. **High — last active Admin protection has a cross-document race.** `AdminUserService.setAccountStatus()` counts ACTIVE Admin documents then updates a different User document. Two concurrent requests can both observe two active Admins, lock different accounts, and leave zero ACTIVE Admins. CouchDB `_rev` protects each document, not this cross-document invariant. No safe fix exists within the current 9-document contract without a coordination design. Do not claim the guard is concurrency-safe; resolve before enabling Admin status mutation in production.
2. **High — current dev CORS origin does not match the running Vite origin.** A read-only OPTIONS request from `http://127.0.0.1:5178` received `Access-Control-Allow-Origin: http://localhost:5173`. Root `.env` has no `FRONTEND_URL` key. Browser calls from the current URL will be blocked. Set `FRONTEND_URL` to the exact UI origin when launching the intended backend. This review did not edit `.env` or restart services; default `localhost:5173` works only for that exact origin.
3. **Medium — Browser UI is not verified.** Browser inventory has no apps/browsers. API/unit tests do not prove forms, navigation, responsive layout, loading/error presentation, or logout click. UI diffs remove substantial code; inspect visually.
4. **Medium — full backend suite remains unverified.** Targeted auth/Foundation tests pass. The legacy data/release suite was not run because prior reports document shared scratch/release side effects and failures; run only after isolation.
5. **Medium — Admin listing/statistics use `_all_docs` prefix scans.** Suitable for current MVP/demo size without unapproved indexes, but cost grows with data volume. Review query/index plan before production-scale use.
6. **Medium — partial registration requires operator reconciliation.** If Candidate creation or User activation fails after User creation, the staged RESET_REQUIRED User remains; retry is reported as duplicate rather than resumed. Safe from unintended activation, but support/reconciliation needs a runbook.
7. **Low/decision — logout is local token deletion only.** There is no server logout/revocation or refresh endpoint. A copied token remains valid until its 15-minute expiry; preserve this as an explicit provisional MVP limitation.
8. **Data contract — Candidate self-registration provenance.** Registration writes `provenance.classification=SOURCE` while `field_origins` says `candidate_self_registration`; DATA-02A describes `source` as directly observed source data. Schema accepts it, but lineage meaning conflicts and should be agreed before analytics rely on it.

No source fix was applied. The Admin locking race requires a shared invariant strategy beyond per-document revision checks; CORS requires exact local-origin configuration; provenance needs an explicit mapping. No speculative source or environment patch was made.

## 5. DATA-02A and integration review

- User type, normalized-email SHA-256 ID, canonical roles/status, Candidate reference and strict Zod validation are used.
- Self-service Candidate ID `candidate:<sha256(userId)>` passes current schema; DATA-02A explicitly documents `candidate:cms:R_<id>` for audited source records. Document the self-service ID variant in the shared contract.
- Registration creates a partial profile and does not fabricate education/employer/project history.
- TV2 owns Job/Application backend and must provide Public Job/Apply DTO/API, OPEN-only rule, filters, sort/cursor, and error contract. Current Job UI is fixture-backed in dev.
- TV3 owns Interview/Scoring/Audit; storage, event, retention and UI contracts remain dependencies. No TV2/TV3 backend source was changed.
- Conflict retry guidance differs (`AGENTS.md` up to 3 vs DATA-02A one conditional retry). Foundation does not retry. Resolve before adding mutation retries.

## 6. Runtime/database safety

- Read-only metadata confirms `recruithub_auth_demo` has 5 documents and `recruitment_db` has 25,750 documents.
- No database writes were made during this review. Previously approved E2E writes remain isolated to `recruithub_auth_demo`.
- No index/view, database, Docker volume or schema was changed.
- Root `.env` remains ignored and untracked; secret values were not displayed.

## 7. Test/build/lint results

| Check | Result |
|---|---|
| Backend auth + Foundation: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 49/49** |
| Frontend tests: `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4** |
| Frontend `npm.cmd run build` | **PASS** |
| Frontend `npm.cmd run lint` | **PASS, 0 errors, 16 warnings** (unused imports/variables and one missing hook dependency in existing pages) |
| `git diff --check` | **PASS**, with standard LF/CRLF warnings |
| CouchDB metadata | **PASS read-only**: demo=5, main=25,750 |
| Browser E2E | **NOT VERIFIED**: no browser surface |
| Legacy backend data/release suite | **NOT RUN**: shared scratch paths without isolation |

## 8. Manual browser acceptance checklist

Use a browser with backend/frontend configured for matching exact origins (`FRONTEND_URL` must equal the frontend origin). Use only the demo DB and synthetic accounts.

- [ ] Landing navigation links lead to `/login`, `/register`, `/jobs`.
- [ ] Register invalid/missing fields shows validation; valid Candidate registration succeeds once; duplicate email shows safe conflict message.
- [ ] Login wrong credentials shows generic error; valid Candidate login reaches Candidate profile/dashboard.
- [ ] Refresh clears memory-only session and protected page redirects; logout click clears local session and returns to public route.
- [ ] Candidate Profile loads, edits an allowed field, saves with latest ETag; stale update displays conflict/reload state.
- [ ] Admin route rejects Candidate; Admin can list/search/page Users, open details, update eligible status and view stats.
- [ ] RESET_REQUIRED and final ACTIVE Admin protections display safe errors.
- [ ] Public Jobs visibly identifies development fixtures; details expose OPEN jobs only; API mode reports pending integration until TV2 handoff.
- [ ] Check loading, empty, error, success; test 360px mobile, tablet and desktop widths.
- [ ] Network panel confirms correct API base/CORS origin and no token in localStorage/sessionStorage.

## 9. Commit grouping proposal (not executed)

1. **Shared Foundation:** CouchDB client/base repository, app wiring, Foundation tests and guide.
2. **TV1 Auth/Profile/Admin backend:** repositories, routes, services, schemas, middleware, tests, and Argon2 dependency lock.
3. **TV1 frontend/Auth/Public Portal:** auth context/API, Login/Register, Profile, Admin dashboard, explicitly fixture-backed Jobs adapter/pages/tests.
4. **Contracts/reports:** decision register, auth contract and TV1 reports. Review reports may be held outside the product commit if the team prefers.

Do not include `.env`, credentials, `node_modules`, `frontend/dist`, data dumps, or DB files. Stage files individually after review; no `git add .`.

### Suggested PR

- **Title:** `feat(tv1): deliver auth, candidate profile, admin and public portal MVP`
- **Description:** Adds the TV1 Shared CouchDB Foundation integration, Candidate registration/login/me with Argon2id and short-lived in-memory Bearer JWT, Candidate Profile GET/PATCH with ownership and ETag conflict checks, Admin User/statistics endpoints, and an explicitly development-only Public Job fixture adapter. Includes focused tests and handoff documentation. Persistence was exercised only against isolated `recruithub_auth_demo`; `recruitment_db` remained read-only. Open items: Admin lock concurrency invariant, browser/CORS verification, TV2 Job/Apply and TV3 Interview/Scoring/Audit contracts, and isolated legacy suite.

## 10. Merge readiness and next steps

**BLOCKED / NOT READY TO MERGE.** Scoped tests/build/lint pass and prior persistence E2E ran only on the approved demo DB. Before approval/merge:

1. Resolve concurrent last-Admin locking with an approved safe design and concurrency regression test.
2. Set matching `FRONTEND_URL`, complete browser acceptance, and visually review substantial page diffs.
3. Approve/correct Candidate provenance semantics and document the self-service Candidate ID variant.
4. Obtain TV2 Public Job/Apply and TV3 Interview/Scoring/Audit contracts; keep adapters gated until handoff.
5. Isolate and run legacy suite if full-suite PASS is a merge criterion.
6. Review and stage the exact file set. Feature and local `dev` currently point to the same commit, so create commit(s) before a PR can exist. No Git mutation was performed.

---

<a id="rp-tv1-finalize-couchdb-real-mvp"></a>

## RecruiHub NoSQL — TV1 Finalization: CouchDB Restore & Real MVP Verification

_Source: RP-TV1-finalize-couchdb-real-mvp.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Stage information and status

- **Date:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Owner:** TV1; report compiled by Codex.
- **Acceptance:** **PARTIAL**. Auth, Candidate Profile, and Admin API E2E passed against the approved isolated CouchDB database. Browser interaction/logout and TV2/TV3 integration remain unverified or pending.
- **Scope:** inspect Docker/CouchDB and Compose, check demo database availability read-only, run safe API smoke and isolated tests, verify frontend build/lint, and preserve all existing data.

## 2. Objective and safety constraints

The purpose was to verify the already implemented TV1 MVP against a separate demo database without using `recruitment_db`. No database was created, no Admin user was created, no CouchDB writes/indexes/views/migrations were run, and no Docker service was started or stopped. No commit, push, merge, reset, clean, fetch, or pull was performed.

## 3. Environment and Docker findings

- `docker-compose.yml` declares only service `couchdb`, image `couchdb:3.5.2.1`, container name `recruithub-couchdb`, loopback binding `127.0.0.1:5984:5984`, and named volume `couchdb_data:/opt/couchdb/data`.
- `docker compose config --quiet` completed successfully: Compose syntax/interpolation is valid.
- `docker version` reports Docker CLI 29.6.2, but cannot connect to `npipe:////./pipe/docker_engine` (`permission denied`). `docker compose ps` fails for the same daemon permission. Docker Desktop / daemon processes or services were not visible in this environment.
- A read-only direct HTTP request to `http://127.0.0.1:5984/` returned HTTP 200 and CouchDB API version **3.5.2**. The root `.env` CouchDB credentials authenticated successfully; read-only `GET /_all_dbs` and database metadata requests succeeded.
- Endpoint identity was cross-checked against the expected existing local dataset: the only initial database was `recruitment_db`, with 25,750 docs, matching prior verified RecruiHub data. The endpoint URL resolves to loopback and CouchDB version matches the declared image family.
- **Configuration discrepancy:** the CouchDB config API reports `httpd.bind_address=127.0.0.1` and `httpd.port=5986`, while Compose declares host 5984 mapped to container 5984. Docker access is unavailable, so the responding process/container cannot be tied to the current Compose service. The authenticated local endpoint was used only for the explicitly authorized isolated DB and no existing DB writes.
- No container or volume was started, stopped, removed, or modified. Volume state and container state remain **not verified**.

## 4. Database demo status

- Before creation, the read-only database list contained only `recruitment_db`; `GET /recruithub_auth_demo` returned 404.
- Following the explicit user approval, exactly one database was created with `PUT /recruithub_auth_demo` (HTTP 201). Immediate metadata read showed `doc_count=0` and `update_seq=0`.
- The existing ignored root `.env` was extended by appending `AUTH_COUCHDB_DATABASE=recruithub_auth_demo`; existing keys/secrets were preserved. It remains ignored and untracked.
- One cryptographically random demo Admin email/password pair was generated and stored only in the ignored root `.env` as `TV1_DEMO_ADMIN_EMAIL` and `TV1_DEMO_ADMIN_PASSWORD` so it can be used locally. Values are intentionally omitted from terminal output and this report. Credentials are not in source or Git.
- Root `.env` also contains CouchDB user/password and `JWT_ACCESS_SECRET`; values were not read into report output.
- `.env.example` includes `AUTH_COUCHDB_DATABASE` with a placeholder only.
- `recruitment_db` was read only for metadata before and after testing. Its count remained 25,750; no document/query/write/index operation was sent to it.
- Final `recruithub_auth_demo` state: 5 documents total, comprising 1 synthetic ACTIVE Admin User, 2 Candidate User docs, and 2 Candidate docs. No indexes or views were created.

## 5. API runtime verification

The current backend source was started on port **5004** (port 5000 was not used), with `AUTH_COUCHDB_DATABASE=recruithub_auth_demo`. The frontend dev server was started on port **5178** with API base URL `http://127.0.0.1:5004/api`. Ports 5174-5177 were occupied during a prior launch attempt; they were left untouched. The Vite transformed API module confirmed base URL 5004.

| Request | Result | Meaning |
|---|---:|---|
| `GET /api/health` | 200 | Backend process is serving current source. |
| `GET /api/v1/auth/me` without token | 401 | Authentication middleware rejects unauthenticated access. |
| `GET /api/v1/candidate/profile/me` without token | 401 | Candidate profile route is protected. |
| `GET /api/v1/admin/users` without token | 401 | Admin user route is protected. |
| `GET /api/v1/admin/stats` without token | 401 | Admin stats route is protected. |
| Initial pre-database valid-shape `POST /api/v1/auth/login` | 503 | Isolated auth database configuration guard; returned before CouchDB access. |
| Initial pre-database valid-shape `POST /api/v1/auth/register` | 503 | Same guard; no user/candidate document was written by that smoke request. |
| Candidate registration on demo DB | 201 | Created a new Candidate and User with canonical IDs; response omitted credential hash and revision. |
| Duplicate Candidate registration | 409 | Duplicate email rejected. |
| Candidate login / `/auth/me` | 200 / 200 | Token issued and server reloaded the active User. |
| Wrong password / malformed JWT / expired JWT | 401 / 401 / 401 | Authentication was rejected. |
| Candidate Profile GET / PATCH | 200 / 200 | Own profile loaded and an allowed summary field updated with `If-Match`. |
| Stale profile revision | 409 | Stale `If-Match` rejected; no blind overwrite. |
| Candidate token on Admin API / Admin token on Candidate Profile | 403 / 403 | Role boundaries enforced server side. |
| Ownership query tamper | PASS | Candidate `/me` remained bound to the authenticated principal even when a different `user_id` query value was supplied; owner ID was absent from the DTO. |
| Admin login / list / detail | 200 / 200 / 200 | Synthetic demo Admin authenticated and loaded User list/detail. |
| Lock Candidate / reject old token / unlock Candidate | 200 / 401 / 200 | Admin status change used current revision; locked User could not use an already issued token. An initial test-driver unlock with a stale/missing revision was rejected; fetching the fresh ETag and retrying succeeded. |
| Lock the only active Admin | 409 | Last-active-Admin protection worked; Admin remained ACTIVE. |
| Admin statistics | 200 | Final counts: 3 Users, 2 Candidates, 1 Admin, 3 ACTIVE Users. |

The initial pre-database login/register smoke requests returned 503 before CouchDB. After authorized DB creation, all subsequent successful writes were confined to `recruithub_auth_demo`. No request wrote to `recruitment_db`.

## 6. Isolated tests, build, and lint

| Command | Result |
|---|---|
| Backend `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 49/49**. Covers fake-repository auth lifecycle, Argon2id settings, duplicate handling, invalid/expired JWT, account states, partial writes, RBAC/ownership, Candidate profile revision conflicts, Admin policy, Foundation and read-only client calls. |
| Frontend `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4**. Covers memory-only token/local logout and public-job fixture model filtering/sorting/pagination. |
| Frontend `npm.cmd run build` | **PASS**. Vite production build completed. |
| Frontend `npm.cmd run lint` | **PASS with 0 errors and 16 warnings**. Warnings are unused imports/variables and one hook dependency warning in existing app/dashboard/job code. |
| Legacy backend `npm test` | **NOT RUN**. It is the data/release suite with shared scratch-path side effects and prior recorded failures. |

These are isolated tests using fake repositories/client; they are not evidence of CouchDB persistence.

## 7. Frontend/UI verification

- Frontend dev URL: `http://127.0.0.1:5178/`; Vite returned HTTP 200 for the `/login` SPA route. The transformed `frontend/src/services/api.js` used `http://127.0.0.1:5004/api`.
- Build and unit tests passed, and API E2E requests were sent to the same backend port configured for Vite.
- Windows browser automation reported no available apps or browser surfaces. Consequently, visual rendering, navigation clicks, form interaction/validation, loading/error states, and responsive breakpoints were **not verified in a browser**. A Vite SPA HTTP 200 is not treated as proof that the UI flow works.
- Browser UI auth/profile/Admin E2E remains unverified because no browser surface is available, even though equivalent backend API flows passed.
- Logout has no backend endpoint or token revocation by design. Frontend logout is local memory clearing; the frontend auth-helper test passed, but an actual browser click/session flow could not be performed.

## 8. Admin verification

- One synthetic ACTIVE Admin was created only in the new demo database after confirming it was empty. The document passed the existing `userDocumentSchema`, used deterministic User ID from normalized email, role `ADMIN`, status `ACTIVE`, `example.invalid` email, Argon2id hash using existing `PASSWORD_HASH_OPTIONS`, and synthetic provenance fields. No source/schema change or public Admin registration was used.
- Generated local Admin credentials are stored in the ignored root `.env`; the values are not in the report or logs.
- No seeded `RESET_REQUIRED` account was activated or modified.
- Admin APIs returned 401 without a token, and authenticated Admin list/detail/stats/status flows were exercised against the demo DB. Locking the only active Admin returned 409; locking/unlocking a Candidate succeeded with current ETags.
- Existing RESET_REQUIRED accounts were not activated or modified. No Admin was created in `recruitment_db`.

## 9. Files and Git state

- Updated this report during the finalization task.
- Updated the ignored root `.env` by appending the authorized isolated DB name and generated demo Admin credentials; no existing variable was replaced.
- No source, Compose, schema, dataset, audit report, or Docker volume was changed during the finalization task. Exactly one CouchDB database and its authorized demo documents were created as described above.
- Branch is `feature/identity-candidate-portal`.
- `.env` is Git-ignored and not tracked. Final Git status contains 65 modified/untracked entries from existing Stage 04A/04B/master-task work plus this report; all remain unstaged/uncommitted. `git diff --cached --quiet` confirmed there is no staged diff.
- Git reported an ownership safety warning under the sandbox identity. Read-only branch/status commands were run with a per-command `safe.directory` override; no global Git configuration was changed.
- `git diff --check` passed after the report update; Git emitted only its standard LF-to-CRLF working-copy warnings.

## 10. Blockers and remaining risks

1. Docker Engine pipe access is denied, so container/volume state and Compose service status cannot be confirmed or controlled safely.
2. CouchDB reports internal HTTP port 5986 while Compose targets container port 5984; the actual service/container mapping is unknown, although local authenticated HTTP and expected database contents were verified.
3. Browser automation has no available browser surface; visual and interaction tests remain outstanding.
4. Frontend logout is local-only and cannot revoke a copied JWT until expiry.
5. TV2 Public Job/Apply API and TV3 Interview/Scoring/Audit contracts remain dependencies for full TV1 integration.
6. Lint has 16 warnings; the legacy backend data suite was not rerun.

## 11. Acceptance

**PARTIAL.** The isolated demo database and one-time Admin bootstrap were completed under explicit approval. Candidate register/login/me, duplicate rejection, invalid/expired token, Candidate Profile GET/PATCH, stale revision, ownership query binding, RBAC, Admin list/detail/status/last-Admin guard/statistics all passed live API verification. `recruitment_db` stayed at 25,750 docs. Browser interaction/responsive checks and a browser logout click remain unverified; TV2/TV3 integration is pending.

## 12. Review readiness and next steps

The TV1 backend auth/profile/Admin slice is **ready for focused code review**, with real persistence exercised only in `recruithub_auth_demo`. Overall TV1 acceptance remains **PARTIAL** because browser interaction was unavailable and Public Job/Apply plus Interview/Scoring/Audit integration depends on TV2/TV3.

1. In a browser-capable environment, verify navigation, registration/login forms, validation/loading/error states, responsive layout, and local logout.
2. Keep the generated Admin credential only in ignored local `.env`; rotate it if shared or exposed. Do not copy it into reports or commits.
3. Resolve Docker access and the Compose/CouchDB internal-port discrepancy in a separate environment task before attempting container operations.
4. Obtain TV2 Public Job/Apply and TV3 contracts, then complete their handoffs and integration tests.
5. Re-run the scoped tests after any implementation changes. Do not commit or push automatically.

---

<a id="rp-tv1-frontend-backend-template-review"></a>

## RecruiHub NoSQL — TV1 Frontend/Backend Template Review

_Source: RP-TV1-frontend-backend-template-review.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Phạm vi và kết quả nhanh

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Mục tiêu:** chạy thử và đánh giá template FE/BE hiện có; không triển khai chức năng mới.
- **Kết quả:** Frontend đã chạy ở `http://127.0.0.1:5173/`; không khởi chạy tiến trình trùng. Backend health trả lời tại port 5002. UI chỉ được rà soát bằng source và HTTP vì không có browser surface khả dụng qua CUA.
- **Thay đổi:** chỉ tạo báo cáo này; không sửa FE/BE, DB, audit, `.env`, dependencies hay cấu hình.

## 2. Repository và package setup

Repo là `BaoCao/recruithub-nosql`, branch `feature/identity-candidate-portal`. Working tree đã có các thay đổi chưa commit từ Stage 04A; không có thay đổi Frontend. Xem `git status` sau công việc để phân biệt với báo cáo mới.

| Phần | Dependencies | Scripts chính | Lock/install state |
|---|---|---|---|
| Frontend | React 19, React Router 7, Vite 8, Axios, Tailwind 3, React Toastify, lucide/react-icons | `dev`, `build`, `lint`, `preview` | `node_modules` và `package-lock.json` tồn tại |
| Backend | Express 5, Zod, CORS, dotenv; nodemon dev dependency | `dev`, `start`, legacy data `test`, ETL/foundation/recruitment/corpus/db scripts | `node_modules` và `package-lock.json` tồn tại |

Runtime: Node `v24.18.0`, npm `11.16.0`. `frontend/vite.config.js` không cấu hình port; Vite default là 5173. `frontend/.env.example` trỏ `VITE_API_BASE_URL` tới `http://localhost:5000/api`, nhưng `frontend/.env` không tồn tại. `frontend/src/services/api.js` fallback dùng `http://localhost:5000/api/v1`. Không thay đổi các giá trị này.

Lệnh cài đặt khi cần:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Trong lần kiểm tra này dependencies đã có và Vite đang phục vụ port 5173, nên không chạy cài đặt hoặc khởi chạy thêm process. Nếu máy sạch, Backend scripts là `npm.cmd ci`, `npm.cmd run dev` hoặc `npm.cmd start`; source hiện mặc định port 5000, không nên dùng port đó khi dịch vụ khác đang chiếm. Runtime hiện tại được truy cập qua 5002.

## 3. Routes, pages và components

`frontend/src/main.jsx` render `App.jsx`. Active tree là `App.jsx` → `AuthProvider` + `Navbar` + `AppRoutes` + toast container. `AppRoutes.jsx` đang được dùng; `routes/AppRouter.jsx` là một router bootstrap riêng chỉ có HomePage/404 và không được import từ `App.jsx`.

| Route | Page/component | Trạng thái hiện tại theo source |
|---|---|---|
| `/` | `Landing.jsx` | Landing template có hero, search UI, feature cards, hardcoded statistics và footer. Recent jobs chỉ được fetch nếu user đã có; request cần API chưa có. |
| `/login` | `Login.jsx` | Form và trạng thái loading/error; gọi `/auth/login` nhưng Backend không có route. UI dùng tiếng Anh. |
| `/register` | `Register.jsx` | Form registration; gọi `/auth/register` nhưng Backend không có route. |
| `/jobs` | `Jobs/JobList.jsx` | Search/filter/list template, gọi Job API không có trong Backend. |
| `/jobs/:id` | `Jobs/JobDetails.jsx` | Detail/apply/status UI; các API Job/Application chưa có trong Backend. |
| `/profile` | `Profile.jsx` | Profile editor gọi GET/PUT `/users/me`; endpoint không có. Data model dùng các field legacy camelCase/education/internships/resumeUrl, không khớp DATA-02A Candidate schema. |
| `/admin/dashboard` | `Dashboard/AdminDashboard.jsx` | Dashboard/table/actions; cần `/admin/stats`, `/admin/users`, `/admin/jobs` chưa có. |
| `/recruiter/dashboard` | `Dashboard/RecruiterDashboard.jsx` | Dashboard/job management; API chưa có. |
| `/recruiter/jobs/create` | `Jobs/CreateJob.jsx` | Job create form; API chưa có. |
| `/user/dashboard` | `Dashboard/JobSeekerDashboard.jsx` | Application dashboard; APIs chưa có. |

Shared components: `Navbar.jsx`, `ProtectedRoute.jsx`; context: `AuthContext.jsx`; API clients: `services/api.js`, `api/axiosClient.js`. Có assets tĩnh (`hero.png`, `jobSearch.png`, SVG logos). Không thấy thư mục mock data thực trong `features/`; các thư mục feature chủ yếu là `.gitkeep`.

HTTP GET tới `/`, `/login`, `/register`, `/jobs`, `/jobs/J_TEST`, `/profile`, `/admin/dashboard`, `/recruiter/dashboard` và `/user/dashboard` đều nhận Vite `index.html` với 200. Đây chỉ xác nhận dev server trả SPA fallback; do không có browser surface, không khẳng định từng React route render thành công.

## 4. Template, dữ liệu giả và khả năng dùng

- **Visual template tương đối hoàn chỉnh:** landing/marketing layout; login/register form layout; jobs list/detail shell; candidate/recruiter/admin dashboard layouts; profile editor layout. Điều này đánh giá source structure, không phải screenshot QA.
- **Mock/static values:** Landing hiển thị số `10K+ Active Jobs`, `5K+ Companies`, `50K+ Job Seekers`, `95% Success Rate` hardcoded. Landing feature copy và social links cũng là placeholder/template content. Không có bằng chứng các con số này là production metrics.
- **API-dependent, chưa có backend tương ứng:** login/register, jobs, profile, recruiter/job workflows, candidate applications, admin data/statistics. Không thấy mock adapter tách biệt để các trang này hoạt động độc lập.
- **Auth mock/legacy:** `AuthContext` đọc/giải mã token phía client và `authHelper` lưu token trong `localStorage`; `ProtectedRoute` dùng legacy role strings (`job-seeker`, `admin`, `recruiter`). Đây chỉ là client-side gating, không phải server authorization.
- **Navigation inconsistency:** active `AppRoutes` có `Landing`; `AppRouter` có `HomePage` nhưng không active. Trang HomePage riêng gọi `/health` bằng Axios client không có API base URL nếu `.env` vắng, do đó không phải landing đang chạy theo active route tree.

## 5. Backend và HTTP checks

Backend source route inventory: `GET /`, `GET /api/health`, `GET /api/health/database`; `/api/v1` router trống; không có auth, candidate profile, job, application hoặc admin API.

| Request | Kết quả | Nhận xét |
|---|---|---|
| `GET http://127.0.0.1:5173/` | 200, Vite HTML | Frontend server đang chạy, default port 5173. |
| `GET http://127.0.0.1:5173/api/health` | 200, `text/html` Vite SPA fallback | Đây không phải Backend response JSON. |
| `GET http://127.0.0.1:5002/` | 200 JSON welcome | Backend-like service đang nghe tại 5002. |
| `GET http://127.0.0.1:5002/api/health` | 200 JSON `{success:true,message:"RecruiHub Backend is running"}` | Read-only process check đạt. |
| `GET http://127.0.0.1:5002/api/health/database` | 404 `Cannot GET` | Không khớp source checkout có mount database readiness. Không restart service; process metadata không đọc được để xác định build đang chạy. CouchDB readiness chưa xác minh qua route này. |
| `GET http://127.0.0.1:5002/api/v1` | 404 | Router v1 không có root endpoint; phù hợp trạng thái hạ tầng rỗng. |
| `GET/POST http://127.0.0.1:5002/api/v1/auth/login` | 404 | Không có auth endpoint. POST này là body `{}` trong probe; không có credential hay dữ liệu người dùng. |
| Port 5000 | Có listener; GET thử trả 404 cho các đường dẫn probe | Giữ nguyên, không dừng hoặc cấu hình lại. `.env` frontend nếu sử dụng hiện trỏ tới port này, vì vậy không submit form trong trạng thái hiện tại. |

**Probe cần ghi nhận:** trong lượt kiểm tra, có một POST rỗng `{}` tới `http://127.0.0.1:5000/api/v1/auth/login`; nó trả 404. Không gửi credential, không thử lại và không can thiệp process/port 5000. Vì dịch vụ thuộc ứng dụng khác và process logs không được kiểm tra, không thể khẳng định nội bộ của dịch vụ ngoài không ghi request log; không thấy dấu hiệu endpoint xử lý request.

Backend process trên 5002 có health response phù hợp, nhưng database readiness 404 cho thấy runtime không khớp checkout; nguyên nhân chưa xác định. Không gửi POST có dữ liệu, không ghi CouchDB, và không kiểm tra trực tiếp database trong lượt này.

## 6. Đánh giá UI theo phạm vi TV1

| Phạm vi | Hiện trạng | Hành động đề xuất |
|---|---|---|
| Auth | Login/Register form và AuthContext có sẵn nhưng kết nối API giả định, localStorage token và logout host ngoài repo. | Giữ bố cục làm tham khảo; sửa auth state, API adapter, cookie/CSRF và route guards sau khi policy backend được duyệt. Không tái dùng cách lưu bearer token làm thiết kế đích. |
| Candidate Profile | Có editor nhiều mục nhưng schema/field model cũ, submit toàn object tới API không có. | Giữ layout/interaction tham khảo; xây lại data binding theo Candidate schema, allowlist PATCH, availability/provenance semantics và ownership contract. |
| Public Job Portal | Landing, list, detail, search/filter UI có khung; data/API chưa có, một số recent jobs chỉ hiện với authenticated user. | Giữ hero/card/list/detail presentation có chọn lọc; nối TV2 public DTO/filter/pagination và chỉ hiển thị OPEN jobs sau khi contract được cung cấp. |
| Admin Users | Admin dashboard có user/job tables và delete actions nhưng dữ liệu đều phụ thuộc API chưa tồn tại; bootstrap/Admin policy pending. | Giữ table shell; xây mới DTO, permissions và controls theo policy; không giữ destructive action trước khi backend authorization/API được duyệt. |
| Admin Dashboard / Statistics | KPI cards và dashboard layout có sẵn; Landing KPI là hardcoded, Admin cards fetch stats API không tồn tại. | Giữ layout/chart/card concept; thay mọi số mẫu bằng API thật; chỉ bật metrics liên module khi TV2/TV3 thống nhất định nghĩa. |

## 7. Lỗi, hạn chế và rủi ro

1. **API base URL sai/không hiệu lực:** `frontend/.env` vắng; fallback của `services/api.js` dùng port 5000 thay vì runtime 5002. `frontend/.env.example` khác suffix (`/api` so với `/api/v1`).
2. **Không có backend domain APIs:** form submit/profile/job/admin requests không thể hoàn tất.
3. **Live backend/source mismatch:** `/api/health/database` 404 dù route có trong source; cần xác định đúng process/deployment trước khi dựa vào readiness. Không tự restart.
4. **Frontend auth insecure/legacy:** token trong localStorage, JWT decode client-side, role strings lowercase và logout gọi domain ngoài dự án. Không nhập credential hoặc submit form khi thử template.
5. **Public UI data mismatch:** landing KPI giả; Job screens chưa thể xác minh OPEN-only server filtering.
6. **Candidate Profile không khớp schema:** nhiều field legacy/camelCase và data shapes khác Candidate document.
7. **UI copy/accessibility:** nhiều labels tiếng Anh; template chưa được đánh giá bằng browser screenshot do không có browser surface CUA trong session.
8. **Port 5000:** process khác đang listen; không dừng hay cấu hình lại. Frontend API fallback hiện có nguy cơ gửi request tới dịch vụ này.

## 8. Đề xuất tận dụng template

- **Giữ:** visual layout của Landing, login/register form shell, responsive cards/tables, profile section navigation, dashboard card/table patterns và shared Navbar sau khi đối chiếu role model.
- **Chỉnh:** API client thành một cấu hình `/api/v1` thống nhất trỏ backend 5002 trong dev; auth context chuyển sang server session; protected route chỉ là UX guard; copy/brand thống nhất RecruiHub; xóa KPI hardcode; bỏ logout host ngoài; mapping field theo canonical DTO.
- **Xây mới hoặc thay phần data/logic:** auth transport/session + CSRF, Candidate profile form theo schema được duyệt, public Job adapter với TV2, admin users/statistics API adapters; có loading/empty/error/success states lấy từ response thật.
- Tách template UI khỏi data-access service để các adapter có thể được kiểm thử bằng fixtures/mock thuộc khu vực development riêng. Không dùng số giả trong production.

## 9. Git và thay đổi

- Branch: `feature/identity-candidate-portal`.
- Trước khi tạo report, source/test/docs Stage 04A từ công đoạn trước đang uncommitted; Frontend files không có thay đổi.
- Tạo report này trong `docs/reports/TV1/`; không sửa source/UI/API/DB/audit/manifest, không stage/commit/push.
- Frontend port 5173 và service 5002 đã chạy sẵn; không khởi động tiến trình khác và không dừng bất kỳ listener nào.

## 10. Kết luận

**Frontend template chạy được ở `http://127.0.0.1:5173/`, Backend process tại 5002 trả health 200.** Giao diện có nhiều page shell dùng được làm nền, nhưng phần lớn nghiệp vụ chỉ là template kết nối tới API chưa tồn tại. Public Job/Stats còn placeholder; Profile chưa theo schema; Auth hiện dùng localStorage/token và host ngoài. Backend source có health/readiness + empty `/api/v1`, nhưng runtime readiness 404 cần được xác minh riêng.

Visual screenshot review chưa hoàn tất do session không có browser khả dụng qua CUA. Không thay đổi UI hoặc nghiệp vụ trong công đoạn này.

---

<a id="rp-tv1-master-branch-completion"></a>

## RecruiHub NoSQL - TV1 Branch Completion (Stages 04C-11)

_Source: RP-TV1-master-branch-completion.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Stage information and overall status

- **Date:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Owner:** TV1; technical report compiled by Codex.
- **Overall acceptance:** **PARTIAL**. TV1-owned slices are implemented and targeted tests pass, but live persistence verification and cross-team integrations remain blocked by environment and contract dependencies.

## 2. Objective and scope

Complete the TV1 scope from Stage 04C through Stage 11 using the existing React and Express applications. Preserve the existing app structure, avoid changes to approved document schemas, do not write to the existing database, and identify work still owned by TV2/TV3. No commit, push, merge, reset, clean, fetch, or pull was performed.

## 3. Initial checks and constraints

- Confirmed branch `feature/identity-candidate-portal`.
- The working tree already contained uncommitted Stage 04A/04B changes; these were preserved. No staged changes were present at the start of this master task.
- Reviewed `AGENTS.md`, team assignment, DATA-02A, Shared Foundation Contract, TV1 Auth Module Contract, Technical Decision Register, and the relevant backend/frontend source and schemas.
- TV2 public Job/Application API contracts and TV3 Interview/Scoring/Audit implementations were not present for integration.
- Docker daemon was unavailable and CouchDB port 5984 was not listening during this task. The existing `recruitment_db` was not queried.
- Root `.env` contains the previously authorized local JWT key; its value was not displayed or logged. `AUTH_COUCHDB_DATABASE` is not configured.
- Port 5000 was not used. Backend was started on 5003. Port 5173 was occupied by another service and left untouched; the frontend task server was started on 5174.

## 4. Stage-by-stage outcome

| Stage | Outcome | Evidence and limits |
|---|---|---|
| 04C Auth runtime and E2E | **PARTIAL / environment-blocked** | Current backend source on port 5003: `/api/health` returns 200, `/api/v1/auth/me` returns 401 without a token, and valid-shape login/register requests return 503 `AUTH_DATABASE_CONFIGURATION_ERROR` before any CouchDB request. Live persistence E2E could not run without an isolated database. Fake-repository tests cover hashing, JWT, expiry, duplicates, account status, and partial writes. |
| 05 RBAC and ownership | **Implemented; isolated tests pass** | Server-verified principal, role, ownership, and scope middleware. Candidate profile queries use the authenticated user identity. No live identity store was available. |
| 06 Candidate Profile | **Implemented; persistence unverified** | `GET/PATCH /api/v1/candidate/profile/me`, strict field allowlist, merged DATA-02A validation, ETag/If-Match, and 409 handling without blind merge or automatic retry. Existing Profile page was reused with loading/error/success/edit states. |
| 07 Auth Frontend | **Implemented; browser E2E unverified** | Existing Login/Register/AuthContext/Navbar/ProtectedRoute and service structure reused. Access token is memory-only; 401 clears client session; logout is local. Build and helper tests pass. |
| 08 Public Job Portal | **PARTIAL; TV2 integration pending** | Existing Landing, JobList, and JobDetails pages reused with a development fixture adapter: OPEN-only data, search/filter/sort/page/detail and honest loading/empty/error states. No Job or Apply API was created. |
| 09 Admin User Management | **Implemented; live access pending** | ADMIN-only list/detail/status APIs, bounded search/filter/pagination, safe DTO, If-Match, ACTIVE/LOCKED transitions only, refusal to modify RESET_REQUIRED accounts, no role edits, and last-active-Admin protection. Existing Admin Dashboard reused. No Admin bootstrap policy/account exists. |
| 10 Admin Statistics | **Implemented; live values unverified** | User/Candidate/role/status counts are calculated from repository data. No fabricated Job/Application/Interview metrics were added because those APIs are owned by TV2/TV3. |
| 11 Integration and handoff | **PARTIAL** | Targeted backend/frontend tests, frontend build/lint, and guarded HTTP smoke checks completed. Handoffs and limitations documented. The legacy full backend suite was not run because it operates on shared scratch/release paths and has prior recorded failures. |

## 5. Implemented API surface

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/v1/auth/register` | Public Candidate registration |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/auth/me` | Valid Bearer token |
| GET | `/api/v1/candidate/profile/me` | ACTIVE CANDIDATE |
| PATCH | `/api/v1/candidate/profile/me` | ACTIVE CANDIDATE, requires `If-Match` |
| GET | `/api/v1/admin/users` | ACTIVE ADMIN |
| GET | `/api/v1/admin/users/:id` | ACTIVE ADMIN |
| PATCH | `/api/v1/admin/users/:id/status` | ACTIVE ADMIN, requires `If-Match` |
| GET | `/api/v1/admin/stats` | ACTIVE ADMIN |

These routes exist in source; live CouchDB persistence for protected domain operations was not verified. Auth logout remains frontend-local. There is no refresh/session store or server-side token revocation endpoint. A Public Job API is not implemented.

## 6. Database and data safety

- No successful Docker control command; Docker daemon unavailable. CouchDB was not listening on port 5984 at the time of verification.
- No CouchDB query or write was performed in this task. No database, index, view, seed, migration, or document was created or changed.
- `recruitment_db` was not touched. Auth configuration requires `AUTH_COUCHDB_DATABASE` to name a database other than `recruitment_db`; it does not create a database.
- Current document count was not verified in this task; earlier runtime counts are not treated as current evidence.
- The previously authorized random `JWT_ACCESS_SECRET` remains only in the ignored root `.env`; the value is omitted from this report. `.env.example` contains a placeholder only.

## 7. Tests and verification

| Command/check | Result |
|---|---|
| Backend: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 49/49**: auth, RBAC/ownership/scope, Candidate profile, Admin services/routes, and CouchDB Foundation, including the read-only `_all_docs` wrapper. |
| Frontend: `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4**: memory token/logout and public job filtering, sorting, paging, and OPEN-only model. |
| Frontend: `npm.cmd run build` | **PASS**: Vite production build. |
| Frontend: `npm.cmd run lint` | **PASS**: exit 0, 0 errors, 16 warnings. Remaining warnings are in legacy App/dashboard/job code; no warning was reported for the new Profile/Admin/JobList/JobDetails/auth modules. |
| Backend HTTP smoke on port 5003 | **PASS for guarded behavior**: health 200; unauthenticated `/auth/me` 401; valid-shape login/register 503 from the isolated database guard, before a CouchDB request. |
| Frontend URL | `http://127.0.0.1:5174/` returned HTTP 200. Port 5173 was occupied by another service and was left unchanged. |
| Legacy full `npm test` | **NOT RUN**: suite has shared scratch/release side effects and previously recorded data-pipeline failures. |

## 8. Files created or updated in the master scope

### Backend

- Added `backend/src/config/auth-database.config.js`, `backend/src/middleware/authorize.js`, `backend/src/schemas/candidate-profile.schema.js`, `backend/src/services/candidate-profile.service.js`, `backend/src/services/admin-user.service.js`, `backend/src/utils/send-api-error.js`, `backend/src/routes/candidate-profile.routes.js`, and `backend/src/routes/admin-user.routes.js`.
- Updated `backend/src/routes/auth.routes.js`, `backend/src/routes/api-v1.routes.js`, `backend/src/services/couchdb.client.js`, `backend/src/repositories/base.repository.js`, `backend/src/repositories/user.repository.js`, and `backend/src/repositories/candidate.repository.js`.
- Added isolated tests for Admin, authorization, Candidate profile, and domain routes; updated API and CouchDB Foundation tests.

### Frontend and documentation

- Reused/updated `frontend/src/pages/Profile.jsx`, `frontend/src/pages/Dashboard/AdminDashboard.jsx`, `frontend/src/pages/Jobs/JobList.jsx`, `frontend/src/pages/Jobs/JobDetails.jsx`, `frontend/src/pages/Landing.jsx`, and `frontend/src/routes/AppRoutes.jsx`.
- Added the development fixture/model adapter `frontend/src/mocks/publicJobs.js`, `frontend/src/services/publicJobsApi.js`, `frontend/src/services/publicJobsModel.js`, and public-job tests.
- Updated `docs/shared/TV1_AUTH_MODULE_CONTRACT.md` and `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`; created this report.
- No dataset, schema, manifest, Docker configuration, audit report, or real `.env` file was modified in this master task.

## 9. Decisions and team dependencies

- **TV2:** Public Job card/detail/list DTO, OPEN filter, public field allowlist, filters, stable sort/tie-breaker, cursor and status/error contract; Application apply/status API. Until then, the portal uses development fixtures only.
- **TV3:** Interview, Scoring, Ranking, and Audit DTOs/APIs, storage, retention, and access policy. No TV3 module was modified.
- **Group/maintainer:** acknowledgement of provisional Stage 04B Bearer-vs-cookie choice, Argon2 parameters, Candidate activation and partial-write reconciliation, API envelope/status, DATA-02A one conditional retry versus `AGENTS.md` three retries, Admin bootstrap/recovery, test isolation, and index governance.
- No default Admin was created. Existing RESET_REQUIRED accounts were not activated or modified.

## 10. Risks and blockers

- No local Docker/CouchDB service and no isolated auth DB; live registration, profile persistence, Admin actions, and DB-backed statistics cannot be verified.
- Admin bootstrap/recovery policy and account are absent; Admin features are protected and unit-tested only.
- Public Job/Apply integration depends on TV2; Interview/Audit integration depends on TV3.
- Admin listing/statistics use bounded built-in `_all_docs` prefix scans because custom indexes are not approved. The reads are bounded but can be expensive at scale; measure before production use.
- User and Candidate creation are two CouchDB writes, not a transaction. Partial failures leave a non-active User for operator reconciliation; there is no automatic delete compensation.
- Bearer JWT has no refresh/revocation. Local logout clears memory; a copied token remains usable until expiry. Rate limiting, reset flow, email verification, and audit persistence remain out of scope or pending.
- Frontend lint reports 16 non-fatal warnings. The legacy full backend suite remains unverified in this task.

## 11. Acceptance status

**PARTIAL.** TV1-owned source slices for auth, role/ownership, Candidate profile, public portal UI scaffold, Admin User actions, and data-derived User statistics are implemented, and the isolated targeted test suites pass. The branch is not ready for full acceptance because live persistence is blocked by unavailable isolated CouchDB, Admin bootstrap is pending, and TV2/TV3 contracts are not integrated. No claim of complete branch acceptance is made.

## 12. Git status and preservation

- Branch remains `feature/identity-candidate-portal`.
- No stage, commit, push, merge, reset, clean, fetch, or pull was performed.
- Initial uncommitted Stage 04A/04B changes were preserved. New TV1 files remain uncommitted; the local `.env` remains ignored.
- `git diff --check` passed. The complete final working-tree status is available from `git status --short --untracked-files=all`.

## 13. Next steps

1. Restore local Docker/CouchDB availability and inspect protected database names read-only. Separately authorize and prepare a uniquely named empty auth demo database; configure `AUTH_COUCHDB_DATABASE` only for that isolated database.
2. Start the current backend source on the agreed development port (never 5000) and verify Register -> Login -> Me -> local Logout, duplicate handling, expiry, and account status only against the isolated database.
3. Obtain Admin bootstrap/recovery approval before any live Admin account. Then verify User listing and statistics read-only and status changes only in the isolated database.
4. Obtain TV2 Public Job/Apply and TV3 contracts; replace the development fixture adapter only after the approved API contract and add consumer contract tests.
5. Isolate legacy data tests in a temporary repository, reconcile the revision retry policy, then run the final Stage 11 verification and update this report.

---

<a id="rp-tv1-pre-merge-blocker-fix"></a>

## RecruiHub NoSQL — TV1 Pre-Merge Blocker Fix

_Source: RP-TV1-pre-merge-blocker-fix.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; báo cáo do Codex tổng hợp.
- **Mục tiêu:** đóng rủi ro khóa Admin đồng thời, sửa cấu hình CORS local, ghi nhận provenance và giữ UI/contract an toàn.
- **Trạng thái:** **PARTIAL** — các code blockers trong scope đã được sửa; CORS source/env đã kiểm chứng trên app mới, nhưng các backend process đang chạy vẫn dùng cấu hình cũ và cần restart có kiểm soát.

## 2. Phạm vi

Đã sửa Admin status policy ở service/UI, CORS origin/header policy, tests và tài liệu contract. Không đổi schema, business data, DB, source TV2/TV3 hoặc thiết kế UI. Không stage/commit/push/merge. Không chạy legacy data suite.

## 3. Fix đã thực hiện

### Admin status policy

- `AdminUserService.setAccountStatus()` từ chối mọi cập nhật status nhắm tới User có role `ADMIN`, bất kể yêu cầu lock hay unlock.
- Response: HTTP **403**, code ổn định `ADMIN_STATUS_CHANGE_FORBIDDEN`.
- Target role được xác định từ User document phía server; mọi ADMIN target luôn trả 403 ổn định (kể cả thiếu/stale `If-Match`). Candidate/Recruiter vẫn bắt buộc current revision: thiếu revision trả 428, revision stale trả 409.
- Loại bỏ check đếm Admin hoạt động rồi ghi một document khác. Do không còn Admin status mutation trong endpoint, race cross-document đó không thể xảy ra qua API này.
- Candidate/Recruiter status mutation vẫn hỗ trợ `ACTIVE`/`LOCKED`, yêu cầu revision hiện tại; `RESET_REQUIRED` vẫn không thể activate/chỉnh ở endpoint.
- Admin list/detail/statistics không đổi. Admin recovery/status change được ghi là operator-managed ngoài MVP.
- Admin Dashboard ẩn action thay status với Admin và hiển thị thông báo operator-managed; Candidate/Recruiter action giữ nguyên.

### CORS

- `backend/src/app.js` đọc `FRONTEND_URL` dạng danh sách comma-separated exact origins. Chỉ cho phép origin HTTP/HTTPS hợp lệ; từ chối wildcard và URL có path.
- CORS methods được khai báo rõ; request headers cho phép `Authorization`, `Content-Type`, `If-Match`; response expose `ETag` để React có thể đọc revision cho PATCH.
- `.env.example` có origin ổn định `http://localhost:5173`, không dùng random Vite port làm default.
- Root `.env` (ignored) được thêm `FRONTEND_URL` với các origin local đã quan sát: `localhost`/`127.0.0.1` tại ports 5173 và 5178. Không thay secrets hoặc CouchDB config; không ghi giá trị secrets vào log/report.
- App mới nạp root `.env` qua `loadBackendEnvironment()` và preflight PASS cho `127.0.0.1:5173` và `127.0.0.1:5178`, gồm PATCH, Authorization, If-Match và expose ETag; untrusted origin không nhận `Access-Control-Allow-Origin`.
- **Runtime limitation:** các process đang nghe ở 5002/5004 được xác minh vẫn trả origin cũ `http://localhost:5173` và không expose ETag. Không restart vì không xác minh được ownership/process control trong môi trường hiện tại. Restart backend RecruiHub đã được xác định và xác nhận owner trước khi browser E2E.

## 4. Candidate provenance và ID

- DATA-02A định nghĩa `SOURCE` là giá trị trực tiếp từ field Parquet đã audit, `DERIVED` là tính toán xác định từ input hợp lệ; `normalized` là chuẩn hóa xác định; `synthetic` là dữ liệu demo/generated có provenance. Candidate self-registration là user input, không phải audited Parquet `SOURCE`; `experience_months = years_experience * 12` là `DERIVED`; các mảng không được cung cấp và availability UNAVAILABLE/PARTIAL cần được giữ nguyên như hiện tại.
- Vì document gồm input, derived value và unavailable fields, mapping tổng thể có thể phù hợp với `mixed` và field origins riêng. Đây là đề xuất diễn giải, **PENDING nhóm/Data owner xác nhận**; không đổi schema, source provenance behavior hoặc documents trong task này.
- Read-only kiểm tra `recruithub_auth_demo` tìm thấy 2 Candidate documents dùng cùng ID strategy `candidate:<sha256(user_id)>`; một document có classification `mixed`, document còn lại `source`; field origins cho profile đều mô tả self-registration. Không đổi cả hai record.
- DATA-02A nêu ID source/import `candidate:cms:<resume_id>`; schema hiện chấp nhận thêm ID self-service `candidate:<64 hex>`. Shared contract đã ghi rõ ID self-service là convention triển khai TV1 và chờ acknowledgement; không tuyên bố đây là sửa đổi DATA-02A.

## 5. Files đã tạo/sửa

- **Sửa:** `backend/src/services/admin-user.service.js`.
- **Sửa:** `backend/src/app.js`.
- **Sửa:** `backend/tests/auth-foundation/admin-user.service.test.js`.
- **Sửa:** `backend/tests/auth-foundation/domain-routes.test.js`.
- **Tạo:** `backend/tests/auth-foundation/cors.test.js`.
- **Sửa:** `frontend/src/pages/Dashboard/AdminDashboard.jsx`.
- **Sửa:** `.env.example`, `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`, `docs/shared/TECHNICAL_DECISION_REGISTER.md`.
- **Sửa local ignored config:** root `.env` chỉ thêm `FRONTEND_URL`; giữ nguyên secrets và CouchDB settings.
- **Tạo:** báo cáo này.

Không sửa DATA-02A, schema Zod, JSONL/manifest, TV2/TV3 source, CouchDB, database hoặc index/view.

## 6. Test và verification

| Kiểm tra | Kết quả |
|---|---|
| Backend Auth/Foundation tests: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 52/52**; có test lock/unlock Admin, concurrent attempts, ETag preconditions, eligible Candidate updates và route error envelope |
| Frontend tests: `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4** |
| Frontend `npm.cmd run build` | **PASS** |
| Frontend `npm.cmd run lint` | **PASS**, 0 errors, 16 warnings (các cảnh báo cũ về unused imports/variables và hook dependency) |
| CORS preflight trên Express app source + root env | **PASS** cho 2 loopback UI origins; PATCH/Authorization/Content-Type/If-Match; ETag exposed; origin ngoài allowlist không được phép |
| CORS trên backend processes hiện đang chạy | **Chưa cập nhật**: 5002/5004 vẫn response theo app/config cũ. Không restart service vì không xác định được owner an toàn |
| CouchDB metadata read-only | **PASS**: `recruithub_auth_demo` 5 docs; `recruitment_db` 25,750 docs |
| Browser automation | **NOT VERIFIED**: không có browser/app surface |
| Legacy backend data/release suite | **NOT RUN**: dùng shared scratch/release paths |
| `git diff --check` | **PASS**; chỉ cảnh báo LF→CRLF |

Không có CouchDB write, DB count thay đổi, index/view hoặc migration.

## 7. Manual UI checklist

- [ ] Restart đúng backend RecruiHub với root env đã nạp; xác minh `FRONTEND_URL` runtime khớp origin đang mở.
- [ ] OPTIONS preflight từ đúng browser origin cho PATCH trả `Access-Control-Allow-Origin`, `Authorization`, `If-Match`; response profile/detail expose `ETag`.
- [ ] Admin list/detail/stats hoạt động; mở chi tiết Admin không có action lock/unlock và hiển thị operator-managed.
- [ ] Candidate/Recruiter có thể đổi status eligible với ETag hiện tại; stale ETag nhận 409.
- [ ] Candidate profile đọc ETag và PATCH thành công qua browser; stale revision hiển thị lỗi phù hợp.
- [ ] Test navigation/forms/logout và responsive 360px/tablet/desktop; không lưu token vào browser storage.

## 8. Pending decisions / blockers

1. DATA owner/nhóm xác nhận Candidate self-registration provenance classification/field-origin vocabulary; không sửa dữ liệu cũ trước quyết định.
2. Restart runtime RecruiHub đúng process để nạp `FRONTEND_URL`, rồi thực hiện browser E2E. Các process cũ trên 5002/5004 chưa được restart.
3. Browser visual/interaction checks chưa hoàn tất.
4. TV2 vẫn sở hữu Public Job/Apply API/DTO, OPEN-only policy, filters/pagination/error contract.
5. TV3 vẫn sở hữu Interview/Scoring/Audit API/storage/retention/redaction contracts.
6. Conflict retry policy khác nhau giữa `AGENTS.md` và DATA-02A; chưa có mutation retry tự động trong Foundation.

## 9. Git và nghiệm thu

- Branch: `feature/identity-candidate-portal`.
- Không có staged diff; không stage/commit/push/merge.
- Existing changes remain uncommitted; report và CORS test thêm untracked entries. Root `.env` ignored, không tracked.
- Admin lock concurrency risk được đóng bằng restricted policy ở backend service; Admin status/recovery hiện ngoài MVP và operator-managed.
- CORS source/config đã được test; live long-running processes yêu cầu restart có kiểm soát để nạp cấu hình mới.

**Trạng thái: PARTIAL.** Code-level Admin/CORS fixes, regression tests, frontend build/lint và read-only DB metadata đều đạt. Chưa PASS do runtime restart/browser UI chưa xác minh và Candidate provenance interpretation vẫn cần nhóm quyết định.

---

<a id="rp-tv1-profile-admin-ui-polish"></a>

## RecruiHub TV1 — Candidate Profile & Admin Dashboard UI Polish

_Source: RP-TV1-profile-admin-ui-polish.md. Original report text is retained; internal links point to the corresponding consolidated section._

## Mục tiêu

Sắp xếp lại trang Profile ứng viên và Admin Dashboard theo ảnh tham khảo: bố cục thẻ rõ ràng, khoảng cách gọn, đổ bóng nhẹ, responsive và giữ tông xanh hiện có.

## Thay đổi

- `frontend/src/pages/Profile.jsx`: chia hồ sơ thành các nhóm thông tin nghề nghiệp, kỹ năng, học vấn/kinh nghiệm/dự án; thêm thẻ tóm tắt hồ sơ, thanh mức độ hoàn thiện và thanh thao tác lưu cố định trên màn hình nhỏ.
- `frontend/src/pages/Dashboard/AdminDashboard.jsx`: làm rõ thẻ thống kê, bộ lọc, bảng User, badge vai trò/trạng thái và hộp chi tiết; thêm biểu đồ donut phân bổ vai trò và biểu đồ thanh so sánh trạng thái, lấy trực tiếp từ response thống kê; giữ thông báo trạng thái tài khoản Admin do operator quản lý.
- Giữ nguyên API Profile/Admin, kiểm tra quyền backend, cập nhật hồ sơ bằng `If-Match` và chính sách không cho thay đổi trạng thái tài khoản ADMIN. Không đổi schema, nghiệp vụ backend hoặc dữ liệu CouchDB.

## Kiểm tra

- Frontend production build sau khi thêm biểu đồ: **PASS**.
- Frontend lint: **0 errors, 16 warnings**; cảnh báo hiện có ở App, dashboard Recruiter/Job Seeker và Landing, không phát sinh từ hai trang vừa chỉnh.
- `git diff --check`: **PASS**; Git chỉ báo cảnh báo chuyển LF sang CRLF.
- Chưa thực hiện browser visual/responsive E2E trong lượt này.

## Trạng thái

**PARTIAL** — giao diện đã được cập nhật và build thành công; cần mở ứng dụng trong browser để xác nhận hình ảnh thực tế ở desktop, tablet và mobile.

---

<a id="rp-tv1-runtime-integration-verification"></a>

## RecruiHub NoSQL — TV1 Stage 03B: Runtime Integration & Foundation Verification

_Source: RP-TV1-runtime-integration-verification.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Mục tiêu

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1 — Shared Backend Foundation; báo cáo do Codex tổng hợp, chưa gán cá nhân.
- **Mục tiêu:** nạp môi trường nhất quán cho Backend từ repo root hoặc `backend/`, tích hợp CouchDB readiness vào Express bằng route kỹ thuật chỉ đọc, review public Foundation interfaces, và xác minh runtime an toàn để handoff TV2/TV3.
- **Trạng thái:** **PARTIAL**.

## 2. Trạng thái trước triển khai

- Branch là `feature/auth-profile-portal`.
- `docs/ARCHITECTURE_DATABASE_AUDIT.md` đang staged dạng add (`A`). Working copy khớp index trước và sau công việc; staged entry không bị sửa.
- Các file Stage 03A, Stage 02 và guide/report đang untracked trước công việc; được giữ nguyên ngoài các file được Stage 03B yêu cầu cập nhật.
- Repo root có `.env`; `backend/.env` không có. Không đọc hoặc ghi giá trị credentials trong báo cáo.
- Backend `server.js` dùng `dotenv/config`, phụ thuộc current working directory. Khi chạy từ `backend/`, root `.env` không được nạp tự động.
- Backend runtime hiện có ở port 5002; `GET /api/health` trả 200 với body hiện hành. CouchDB HTTP tại `127.0.0.1:5984` phản hồi.
- `backend/package.json` định nghĩa `npm test` là `node --test tests/data/*.test.js`; không khai báo build/lint script.

## 3. Phạm vi và file đã thay đổi

### Đã tạo hoặc sửa

- `backend/src/config/load-environment.js` — loader đọc `backend/.env`, rồi root `.env`, không ghi đè biến do process cung cấp.
- `backend/src/server.js` — gọi loader trước khi dynamic-import Express app để CORS/config đọc được env đã nạp.
- `backend/src/routes/database-health.routes.js` — route factory cho readiness GET, lỗi sanitized và metadata allowlist.
- `backend/src/app.js` — mount route kỹ thuật `/api/health/database`, không đổi route health hiện có.
- `backend/tests/foundation/runtime-integration.test.js` — route/env loader tests dùng server ephemeral và file env tạm trong OS temp.
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md` — runtime env, cách chạy, route readiness, troubleshooting, stability và handoff.
- `docs/reports/TV1/RP-TV1-runtime-integration-verification.md` — báo cáo này.

Không sửa package manifest/lockfile, business schema, dataset/manifest, importer, Docker Compose, `.env`, CouchDB documents, index/view, hay logic TV2/TV3. Không thêm dependency.

## 4. Runtime configuration

`loadBackendEnvironment()` xác định đường dẫn theo vị trí source, không theo `process.cwd()`:

1. Biến đã có trong parent process được giữ nguyên.
2. Nếu thiếu, giá trị `backend/.env` được nạp.
3. Nếu vẫn thiếu, giá trị root `.env` được nạp.

Loader chỉ đọc file hiện có, không tạo file và không in giá trị. Root `.env` được dùng mà không copy credentials sang backend. CORS và `PORT` được đọc sau khi loader chạy. Import module client/route không tạo kết nối CouchDB; client chỉ được tạo khi readiness endpoint nhận request.

Default port vẫn là 5000 nếu không có `PORT`; môi trường hiện tại tiếp tục dùng 5002. Guide ghi lệnh từ repo root và từ `backend/`.

## 5. Express integration

- Giữ nguyên `GET /api/health`: 200, `{ "success": true, "message": "RecruiHub Backend is running" }`.
- Thêm **provisional internal diagnostics endpoint** `GET /api/health/database` dưới prefix `/api` hiện có; API prefix/envelope dùng chung vẫn chưa freeze.
- Route gọi `checkReadiness()`, chỉ phát sinh CouchDB GETs (`/` và `/{database}`). Không có create/update/delete/import/index/view operation.
- Thành công chỉ trả `{status, database:{name, doc_count}}`; không trả URL, userinfo, credentials, CouchDB UUID hoặc raw response.
- Lỗi CouchDB/network/timeout được ánh xạ sang response an toàn; handler bắt lỗi nên CouchDB unavailable không dừng Express.
- Route không có auth middleware. Do đó guide giới hạn endpoint này ở local/internal dev; cần review access control trước khi public/deploy.

## 6. Foundation contract review

| Interface | Nhận xét | Handoff guidance |
|---|---|---|
| `CouchDbClient` | Config được inject; Fetch có timeout; error mapping không đưa raw URL/body/cause ra response. `checkReadiness`, database metadata, document GET, Mango find, deterministic create, expected-revision update và exists. Không kết nối lúc import. | Có thể dùng cho repository nghiệp vụ; không giả định transaction, bulk API, delete, index management hoặc mutation retry. |
| `BaseRepository` | `getById`, `find`, `create`, `update`, `exists`, `getDatabaseInfo`; client và optional Zod schema được inject. Create/update validate trước khi delegate. | TV2/TV3 gắn schema thuộc sở hữu module mình; repository không tự tạo `_id`/`type`, không enforce ownership. |
| `find(selector, options)` | Selector phải là object; options được ghép vào Mango body và chuyển nguyên trạng. Không có validate/allowlist cho field lọc hoặc sort. | Service phải allowlist input, giới hạn `limit`, xác định selector/sort hợp lệ. Bookmark phải được truyền và xử lý ở caller. |
| Pagination/stable order | Client không tự thêm sort, tie-breaker, bookmark hoặc pagination invariant. | Contract từng query cần stable sort có trường tie-breaker duy nhất, bookmark semantics và test cho trang kế tiếp. |
| Zod | Schema tùy chọn ở BaseRepository; lỗi validation giữ issues trong lỗi nội bộ. | Không gửi issues chứa field nhạy cảm thẳng ra API/log nếu chưa sanitize. |
| `_rev` conflict | 409 được map thành typed `CONFLICT`; client không retry mutation hoặc blind merge. Update yêu cầu caller cung cấp `expectedRev`. | Service đọc lại revision, kiểm tra lại quyền/state và chỉ retry theo chính sách được phê duyệt. |
| Dependency injection | Fetch implementation/config/client đều inject được; BaseRepository nhận client-compatible object. | Phù hợp fake-client unit tests; live write test chỉ với DB test riêng đã phê duyệt. |
| Secret safety | Authorization chỉ tạo per-request; endpoint trả allowlist metadata. | Không log config/header/raw response; mọi module phải map document sang DTO an toàn. |

Không thực hiện breaking interface changes. Có khác biệt cần nhóm làm rõ: `AGENTS.md` yêu cầu tối đa 3 retries khi revision conflict, trong khi DATA-02A contract quy định chỉ một retry có điều kiện. Foundation hiện không retry. TV1/TV2/TV3 cần thống nhất chính sách service trước khi triển khai mutation có cạnh tranh.

## 7. Test và verification

- `node --test tests/foundation/*.test.js` — **PASS 18/18**.
- Test mới bao gồm success route với metadata allowlist, giữ nguyên response `/api/health`, sanitized network failure/server tiếp tục phục vụ request, precedence env và giữ nguyên process env.
- Runtime smoke dùng Express app trên port OS cấp tạm, không dừng/restart backend đang chạy ở 5002:
  - `GET /api/health` — 200, body không đổi.
  - `GET /api/health/database` — 200, database `recruitment_db`, `doc_count: 25750`.
  - Read-only client gọi database metadata và GET một document đầu tiên từ release `users.jsonl`; document tồn tại, `type=user`.
  - Chỉ đọc; không có write request.
- Kiểm tra trực tiếp database metadata trước/sau cùng verification: 25.750 documents.
- `core.autocrlf=true`: đã đọc 9 JSONL. SHA-256 từng Git blob khớp manifest; SHA-256 working copy không khớp manifest cho cả 9 file.
- Không chạy Docker CLI vì HTTP readiness đủ xác minh CouchDB và prompt không yêu cầu Docker status. Không tạo custom index/view.
- Không chạy lại `npm.cmd test`; phân tích an toàn và kết quả lần chạy Stage 03A ở mục 8.
- Không có build/lint script trong backend package.

## 8. Phân loại lỗi full suite

`npm.cmd test` đã **FAIL** trong lần chạy Stage 03A. Lần chạy Stage 03B này không chạy lại full suite; vì vậy không khẳng định trạng thái mới hoặc baseline trước Stage 03A. Test output trước đó báo DATA-04B V04/V15, DATA-02B.3 failure-injection/release checks, DATA-02B.2 checksum/path checks, DATA-03.2 manifest checksum, DATA-03.3B thiếu release input, và DATA-03.4B checksum/idempotency.

| Nhóm yêu cầu | Kết luận có bằng chứng |
|---|---|
| Lỗi đã có trước Stage 03A | **Chưa chứng minh được**: không có lần chạy baseline trước Stage 03A được lưu để so sánh. Không gọi các lỗi này là pre-existing. |
| Path/working directory | Một số lỗi thiếu path/input được báo; chưa đủ bằng chứng nói cwd là nguyên nhân duy nhất. Các test import hiện tính repo root tương đối từ file test. |
| CRLF / SHA-256 | **Đã xác minh:** `core.autocrlf=true`; cả 9 Git blob khớp manifest, còn cả 9 working-copy bytes mismatch. Hash kiểm tra bytes nên CRLF checkout làm sai checksum so với LF blob. |
| Thiếu release input | DATA-03.3B được báo thiếu release input trong lần chạy cũ. Cần xác minh release artifact đúng trước khi chạy lại, không tạo giả input. |
| Failure-injection | DATA-02B.3 có assertion failure-injection/release thất bại; chưa cô lập được nguyên nhân ở lần này. Không chỉnh tests ngoài scope. |
| Regression từ Foundation | **Không có bằng chứng regression:** 18 Foundation tests pass; lỗi đã báo nằm ở data/release suites. Tuy vậy không kết luận baseline vì full suite không được chạy ở Stage 03B. |

**Lý do không chạy full suite lần này:** test suite thao tác trực tiếp các scratch path dưới `data/`; một test xóa `data/test_scratch` trước khi tạo, test khác ghi/xóa `data/scratch_bad_manifest.json`, và release tests tạo/xóa `data/staging_test_rerun`. Có bài publication/failure-injection dùng manifest/pointer thật. Rủi ro với file đang có và các lần test đồng thời không cần thiết cho kiểm tra Foundation; vì thế chỉ chạy nhóm Foundation cô lập. Các đường dẫn scratch đã kiểm tra hiện không tồn tại, nhưng điều đó không loại bỏ rủi ro do suite có side effects lên repo.

**Remediation đề xuất cho task riêng:** (1) chạy mỗi data suite trong temp repo/fixture cách ly; (2) khôi phục bytes gốc từ Git blob vào temp release bên ngoài repo, không tắt checksum; (3) cung cấp release input đúng qua fixture/manifest test-only; (4) xác minh test không sửa active pointer/release; (5) tách và điều tra failure-injection Windows/atomic-rename độc lập. Không remediation nào được thực hiện ở Stage 03B.

## 9. Database safety verification

- CouchDB endpoint `127.0.0.1:5984` phản hồi HTTP; readiness API hoạt động.
- Database tồn tại: `recruitment_db`; `doc_count=25,750` trước/sau.
- Đọc một document `user` đã tồn tại từ release sample ID.
- Không tạo DB, không ghi documents, không seed/import/migrate, không tạo index/view, không xóa volume/container.
- Port 5000 và container/service khác không bị tác động.
- Docker daemon/container state không được kiểm tra bằng CLI; HTTP readiness là bằng chứng runtime của CouchDB API, không phải trạng thái Docker container.

## 10. Hướng dẫn handoff cho TV2/TV3

1. Inject `CouchDbClient` vào `BaseRepository`; gắn Zod schema của document module mình sở hữu.
2. Tự tạo deterministic ID/type theo DATA-02A; Foundation không bổ sung trường nghiệp vụ.
3. Với Mango, allowlist filter, đặt limit, quy định sort ổn định + tie-breaker, bookmark và index proposal dựa trên query thật.
4. Xử lý `DATABASE_NOT_FOUND`, `NOT_FOUND`, `CONFLICT`, `TIMEOUT`, `NETWORK_ERROR` ở service; không retry mutation vô điều kiện.
5. Chỉ dùng fake client trong unit tests; write integration cần database cô lập và phê duyệt riêng.
6. Không coi route `/api/health/database` hay response helper provisional là API contract đã được duyệt.
7. Không đưa audit/session/business docs bổ sung vào DB khi schema 9 document types chưa được thay đổi chính thức.

## 11. Blockers và rủi ro

- API prefix/envelope, auth/session và public exposure của readiness route vẫn chưa freeze.
- Chính sách conflict retry giữa `AGENTS.md` (tối đa 3) và DATA-02A (tối đa 1 có điều kiện) chưa thống nhất.
- Pagination/bookmark/stable sort phải được module consumer xác định; Foundation không áp đặt.
- Full legacy suite còn FAIL theo lần chạy Stage 03A; baseline trước Stage 03A chưa có bằng chứng.
- 9 JSONL working copies mismatch manifest do line ending; importer/verifier cần bytes gốc hoặc release fixture sạch.
- Docker CLI status chưa xác minh; HTTP CouchDB và DB metadata đã xác minh.
- Readiness endpoint không có auth; chỉ dùng local/internal cho tới khi threat/access review.

## 12. Acceptance checklist

- [x] Nạp env từ root hoặc `backend/` theo đường dẫn ổn định; parent process không bị override.
- [x] Không copy hoặc in credentials, không tạo/chỉnh `.env`.
- [x] Giữ nguyên response `GET /api/health`.
- [x] Thêm endpoint readiness GET chỉ đọc, timeout/error map và allowlist response.
- [x] Không tạo DB/index/view hoặc kết nối lúc module import.
- [x] Foundation + route tests PASS 18/18.
- [x] Runtime readiness và document GET PASS; document count vẫn 25.750.
- [x] Guide và handoff được cập nhật.
- [x] Branch giữ nguyên; audit staged giữ nguyên; không add/commit/push.
- [ ] Full backend suite PASS — **chưa đạt; không rerun vì legacy suite side effects và lỗi đã biết**.
- [ ] Nhóm thống nhất retry policy, API contract và production access control — **chưa đạt**.

## 13. Trạng thái nghiệm thu

**PARTIAL.** Environment loading, endpoint integration, foundation contract review, 18/18 targeted tests và read-only runtime checks đạt. Chưa đạt PASS do legacy full suite vẫn có lần chạy FAIL chưa có baseline so sánh, line-ending/release fixture issues còn mở, Docker container state chưa xác minh qua CLI, và một số shared API/security/revision decisions cần nhóm chốt.

## 14. Bước tiếp theo

- Nhóm xác nhận API prefix/envelope và readiness route có được giữ trong dev hay phải gate/remove trước deploy.
- TV1/TV2/TV3 hòa giải conflict retry 1-vs-3 theo DATA-02A và `AGENTS.md`.
- Chuẩn bị full-suite test isolation và line-ending-safe fixture trong task data-pipeline riêng; không thay manifest/checksum.
- TV2/TV3 gửi query/sort/bookmark workload trước khi đề xuất index/view.
- Sau đó TV2/TV3 có thể dùng BaseRepository trên fake client để phát triển module độc lập; CouchDB write integration chờ test DB và task được phê duyệt.

---

<a id="rp-tv1-runtime-ui-acceptance"></a>

## ﻿# RecruiHub NoSQL — TV1 Runtime & UI Acceptance

_Source: RP-TV1-runtime-ui-acceptance.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Mục tiêu:** xác minh source Backend hiện tại, API thực tế trên CouchDB demo, kết nối Frontend và các kiểm tra hồi quy; không thay đổi module hoặc schema.
- **Trạng thái:** **PARTIAL** — API E2E trên demo và tests/build/lint đạt; browser E2E chưa thể chạy do không có browser surface.

## 2. Runtime ownership và ports

- Trước khi khởi chạy, các probe HTTP đến các cổng RecruiHub đã dùng trước đây (`5002`, `5004`, `5173`, `5178`) không nhận phản hồi; `5000` không được probe hay sử dụng.
- Không thể lấy process metadata của tiến trình Windows: `Get-CimInstance Win32_Process` trả Access Denied; kiểm tra listener cũng không trả thông tin dùng được trong sandbox. Vì vậy không kết luận tiến trình cũ nào thuộc repo, và không dừng tiến trình nào.
- Khởi chạy **source hiện tại** trong các phiên do task này tạo:
  - Backend `npm.cmd start`, `PORT=5005`, `AUTH_COUCHDB_DATABASE=recruithub_auth_demo`.
  - Frontend Vite `127.0.0.1:5179`, `VITE_API_BASE_URL=http://127.0.0.1:5005/api`.
- Startup output xác nhận app mới bind thành công; SPA routes `/`, `/login`, `/register`, `/profile`, `/admin` đều trả HTML 200. Module API đã transform xác nhận base URL 5005.
- Backend loader nạp root `.env` theo đường dẫn source; process env được ưu tiên. Secrets không được in. CORS origin `http://127.0.0.1:5179` được đặt cho process backend của phiên này; không ghi thêm cổng động vào `.env`.

## 3. Backend API và CORS

- `GET /api/health`: **200**.
- `GET /api/v1/auth/me` không token: **401**.
- CORS OPTIONS preflight từ chính UI origin `http://127.0.0.1:5179` tới profile PATCH: **204**.
- Response headers xác minh:
  - `Access-Control-Allow-Origin: http://127.0.0.1:5179`
  - Methods có `PATCH` và `OPTIONS` (cùng GET/HEAD/POST/PUT/DELETE).
  - Allowed headers: `Authorization`, `Content-Type`, `If-Match`.
  - Exposed headers: `ETag`.
- Preflight từ `http://evil.invalid` không nhận `Access-Control-Allow-Origin`.
- App dùng exact-origin allowlist; không dùng wildcard.

## 4. API E2E trên database demo

Các thao tác ghi từ đăng ký/profile chỉ đi qua backend được cấu hình với database `recruithub_auth_demo`. Ba tài khoản Candidate tổng hợp được tạo trong các lượt chạy kiểm tra; thông tin đăng nhập không được lưu hoặc in. Một request harness đầu tiên dừng khi tạo token hết hạn do subject test không đúng định dạng canonical, sau khi các kiểm tra trước đó đã chạy; lần chạy hoàn chỉnh sau đó dùng subject hợp lệ và xác nhận kết quả dưới đây. Không seed/migrate hay tạo Admin mới.

| Luồng | Kết quả |
|---|---|
| Candidate registration | **201** |
| Duplicate registration | **409 `EMAIL_ALREADY_REGISTERED`** |
| Wrong password | **401** |
| Candidate login → `/auth/me` | **200 → 200**, role CANDIDATE |
| Candidate Profile GET | **200**, ETag có mặt |
| Candidate Profile PATCH bằng ETag | **200**, ETag mới có mặt |
| PATCH dùng ETag cũ | **409 `REVISION_CONFLICT`** |
| Candidate gọi Admin API | **403** |
| JWT malformed / expired | **401 / 401** |
| Admin login | **200** |
| Admin User list / detail / statistics | **200 / 200 / 200** |
| Admin status update nhắm tới Admin | **403 `ADMIN_STATUS_CHANGE_FORBIDDEN`**, không đổi trạng thái |
| Admin gọi Candidate Profile API | **403** |
| Logout | Không có endpoint revoke; client logout là xóa token trong memory. Helper unit test PASS; thao tác click trên browser chưa xác minh. |

## 5. Frontend acceptance

Browser automation surface inventory rỗng (`apps=[]`, `browsers=[]`), nên không thể xác nhận rendering trực quan, thao tác điều hướng/form, loading/error/success UI hoặc responsive. HTTP 200 của Vite và các API E2E không được xem là browser E2E.

### Manual browser checklist

Dùng browser mở `http://127.0.0.1:5179/`. Backend cùng phiên chạy ở `http://127.0.0.1:5005`, chỉ kết nối auth persistence tới `recruithub_auth_demo`.

- [ ] Landing: mở menu/nav, lần lượt đi tới Login, Register và Jobs; xác nhận đường dẫn và quay lại Landing.
- [ ] Register: submit thiếu trường/mật khẩu sai policy để kiểm tra validation; đăng ký Candidate tổng hợp mới; thử lại cùng email để thấy duplicate error.
- [ ] Login: thử mật khẩu sai, sau đó đăng nhập đúng; xác nhận trang protected mở. Refresh trang để xác nhận memory token bị xóa và route yêu cầu đăng nhập lại.
- [ ] Profile: tải profile, sửa summary, lưu; kiểm tra response ETag trong Network; thử stale revision nếu giao diện hỗ trợ và kiểm tra thông báo conflict.
- [ ] Logout: dùng nút logout; xác nhận token bị xóa và protected route đóng. Kiểm tra không có token trong localStorage/sessionStorage.
- [ ] Candidate route guard: mở Admin Dashboard khi đăng nhập Candidate; xác nhận bị từ chối/điều hướng.
- [ ] Admin: đăng nhập tài khoản demo hiện có; tải Dashboard, thống kê, danh sách, mở User detail. Với target ADMIN, xác nhận không có action lock/unlock và có thông báo operator-managed. Kiểm tra trạng thái Candidate/Recruiter đủ điều kiện nếu có tài khoản demo tương ứng.
- [ ] Kiểm tra loading, empty/error/success state; viewport 360px, tablet và desktop; xác nhận Network dùng API 5005 và không phát sinh CORS error.

## 6. Tests, build, lint và Git

| Kiểm tra | Kết quả |
|---|---|
| Backend `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 52/52** |
| Frontend `node --test tests/auth/*.test.js tests/public-jobs/*.test.js` | **PASS 4/4** |
| Frontend `npm.cmd run build` | **PASS** |
| Frontend `npm.cmd run lint` | **PASS**, 0 errors, 16 warnings |
| `git diff --check` trước khi thêm báo cáo | **PASS**, cảnh báo line ending LF→CRLF chuẩn |
| Legacy backend `npm test` | **Không chạy** do các test data/release dùng shared scratch paths; đã có ghi nhận rủi ro side effects |

Branch vẫn `feature/identity-candidate-portal`. Không stage/commit/push/merge/reset/clean. `.env` ignored; build output bị ignore. Các thay đổi trước đó trong working tree được giữ nguyên. Báo cáo này là file mới duy nhất của lượt hiện tại.

## 7. Database safety

Read-only metadata cuối qua CouchDbClient:

- `recruithub_auth_demo`: **11 documents** sau các luồng đăng ký E2E; chỉ tăng do các Candidate User/Profile tổng hợp vừa đăng ký và không có index/view.
- `recruitment_db`: **25,750 documents**, không đổi trong lượt này; chỉ truy vấn metadata.
- Không tạo/xóa database, không reset/seed/migrate, không tạo index/view, không thao tác Docker/volume. Không dùng `recruitment_db` cho auth.

## 8. Decisions/blockers còn mở

- Candidate self-registration provenance classification/field-origin semantics vẫn chờ DATA owner/nhóm xác nhận.
- Self-service Candidate ID convention cần acknowledgement trong contract chung.
- Quy tắc conflict retry giữa DATA-02A (conditional tối đa một lần) và `AGENTS.md` (tối đa ba lần) chưa thống nhất; Foundation hiện không tự retry.
- TV2 sở hữu Public Job/Apply API/DTO, OPEN-only behavior, filters/pagination/error contract.
- TV3 sở hữu Interview/Scoring/Audit API, storage, retention và redaction contracts.
- Browser visual/interaction/responsive E2E chưa xác minh.
- Các process cũ không được xác định ownership; process mới dùng port riêng. Docker container/volume identity không được kiểm tra trong task này.

## 9. Kết luận nghiệm thu

**PARTIAL.** Backend source mới chạy trên port riêng và được xác minh với exact-origin CORS. Candidate Auth/Profile và Admin APIs vượt qua các luồng E2E trên CouchDB demo riêng; `recruitment_db` giữ nguyên 25,750 docs. Backend/frontend targeted tests, build và lint đạt. UI thực tế trong browser còn phải hoàn tất theo checklist; TV2/TV3 và provenance/retry decisions vẫn pending. Runtime/API code sẵn sàng cho review có điều kiện; không tự commit/merge.

---

<a id="rp-tv1-shared-foundation-contract-handoff"></a>

## RecruiHub NoSQL — TV1 Stage 03C: Shared Foundation Contract Freeze & Handoff

_Source: RP-TV1-shared-foundation-contract-handoff.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Công đoạn và mục tiêu

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1 — Shared Backend Foundation Owner; tổng hợp bởi Codex, chưa gán cá nhân.
- **Mục tiêu:** đối chiếu tài liệu với Foundation source, chuẩn hóa public contract ở mức source-verified, tách quyết định approved khỏi proposal/pending, và bàn giao ranh giới tích hợp cho TV2/TV3.
- **Phạm vi:** documentation, contract review và handoff. Không triển khai auth, Job/Application, Interview/Scoring, không thay đổi CouchDB.
- **Trạng thái nghiệm thu:** **PARTIAL**.

## 2. Tài liệu và source đã review

- `AGENTS.md`, `ARCHITECTURE.md`, `docs/data-schema-contract.md`, `docs/recruitment-business-rules.md`.
- Báo cáo TV1 Stage 02 database/API contract, Stage 02.5 decision freeze, Stage 03A CouchDB client/repository, Stage 03B runtime verification.
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`.
- Toàn bộ Foundation source: database config, env loader, CouchDB client/errors, BaseRepository, response helpers, DB readiness route, app/server and current health route/controller.
- Toàn bộ `backend/tests/foundation/*.test.js`.

Source là căn cứ cho interface đang chạy. Architecture diagrams và báo cáo cũ không được dùng để khẳng định implementation nếu source không có.

## 3. Decisions đã chốt và trạng thái

| Quyết định | Phân loại | Căn cứ |
|---|---|---|
| TV1 sở hữu Shared Foundation | **APPROVED** | Ownership Stage 03A |
| TV2 phụ trách Job/Application | **APPROVED** | Phân công nhóm |
| TV3 phụ trách Interview/Scoring/Audit | **APPROVED** | Phân công nhóm |
| Chỉ 9 business document types; discriminator `type` | **APPROVED** | DATA-02A |
| Foundation không tự tạo business `_id`/`type` | **APPROVED + IMPLEMENTED** | DATA-02A và client/repository source |
| Foundation không tự retry mutation | **APPROVED + IMPLEMENTED** | DATA-02A boundary và client behavior |
| Không write-test lên `recruitment_db` | **APPROVED** | Stage 03A/03C task safety |
| Không tự tạo index/view/document type | **APPROVED + IMPLEMENTED** | DATA-02A boundary; không có API đó trong Foundation |

## 4. Contract/interface matrix

Bảng đầy đủ theo method, input/output, errors, preconditions, side effects và module owner nằm trong `docs/shared/SHARED_FOUNDATION_CONTRACT.md` mục 5–7. Các điểm cốt yếu được xác nhận:

- `getById`, `exists`, `getDatabaseInfo` là GET-backed reads; `find` dùng HTTP POST `_find` nhưng là query-only.
- `find(selector, options)` chỉ kiểm tra selector là object, chuyển Mango options nguyên trạng và không bảo đảm bookmark pagination/stable sort.
- `create`/`update` là writes; cần `_id` caller-supplied, update yêu cầu `expectedRev`, optional Zod validation chỉ chạy ở create/update. Repository không áp dụng parsed transform output.
- `CouchDbError` codes/status mapping, config parsing và readiness endpoint outputs/errors được ghi dựa trên source. Readiness route hiện không có auth, chỉ được coi là internal/provisional.
- BaseRepository không thay thế service authorization, ownership check, business validation, idempotency, DTO mapping hay audit policy.

## 5. Revision conflict decision

Có mâu thuẫn trong nguồn chỉ dẫn: `AGENTS.md` yêu cầu tối đa 3 retries; DATA-02A yêu cầu một retry có điều kiện sau fresh read và revalidation. Đề xuất đưa ra theo yêu cầu là dùng luật chặt hơn của DATA-02A ở business mutation:

1. Đọc revision mới nhất.
2. Recheck authorization và ownership.
3. Recheck transition/business state.
4. Xác nhận action idempotent hoặc kết quả tương đương đã hoàn tất.
5. Retry tối đa một lần nếu vẫn hợp lệ; nếu conflict tiếp tục thì trả 409.

**Trạng thái: PROPOSED, chưa được nhóm phê duyệt.** Foundation client hiện không retry và chỉ trả typed `CONFLICT`; không sửa `AGENTS.md`/business rules.

## 6. API integration decision matrix

| Hạng mục | Trạng thái hiện tại | Proposal / pending |
|---|---|---|
| API prefix | `/api/health` và `/api/health/database` IMPLEMENTED; tài liệu/frontend còn `/api/v1` | Giữ `/api` cho MVP hiện tại là **PROPOSED**; team chốt trước domain API integration |
| Success/error envelope | Helper success/error tồn tại; health cũ khác envelope; readiness dùng success helper | `{success:true,data,message?}` / `{success:false,error:{code,message,details}}` là **PROPOSED** |
| HTTP status | Một số CouchDbError đã map | Chuẩn 400/401/403/404/409/429/500/502/503/504 là **PROPOSED**, cần approve per-code |
| Cursor pagination | Không có abstraction | Opaque cursor bind với Mango bookmark + selector/sort, capped limit, stable sort + unique tie-breaker: **PENDING** |
| Error sanitization | CouchDbError/toApiError có sanitization | Bảo toàn không stack/secret/raw body; policy validation detail cần freeze |
| Auth principal | Không có middleware/principal | `req.auth={userId,role}` từ identity server-verified; ownership resolve từ authoritative docs: **PENDING** |
| Readiness route | `GET /api/health/database` IMPLEMENTED, trả allowlisted name/count | Policy exposure PENDING; route hiện không auth, giới hạn local/internal |

Không thay đổi route/frontend/API trong công đoạn này.

## 7. Handoff checklist và dependencies

### TV2

- Dùng chung BaseRepository/CouchDbClient; không tạo DB client/base repo khác.
- Gửi TV1 Public Job Card/Detail DTO, filter/query/sort/cursor/error contract và public-field allowlist.
- Gửi ownership/scope rules và application summary/detail DTO khi portal cần consume.
- Nộp query workload trước đề xuất index/view.

### TV3

- Dùng chung BaseRepository/CouchDbClient; không xây lại DB foundation.
- Gửi Interview endpoint/DTO/lifecycle và Scoring input/output/freshness/ranking contract.
- Đề xuất audit event/storage/retention/redaction/access; không thêm document type khi chưa được approve.
- Nộp query workload và yêu cầu index/view.

### Handoff checklist

- [x] Method signatures và lỗi common được đối chiếu source.
- [x] Owner/module boundaries và illustrative examples được ghi.
- [x] Những gì không thuộc Foundation được nêu rõ.
- [ ] TV2/TV3 xác nhận DTO/query/cursor contract.
- [ ] Nhóm phê duyệt retry count, API prefix/envelope/statuses, auth principal và readiness exposure.
- [ ] Chỉ định index owner và test DB/test isolation policy.

## 8. Tests và bằng chứng

- Lệnh: `node --test tests/foundation/*.test.js` từ `backend/`.
- Kết quả: **PASS 18/18**, 0 fail, 0 skipped.
- Test set cover config validation, CouchDbError mapping, Fake Fetch request semantics, CRUD/revision guards, BaseRepository delegation/Zod, provisional envelope, readiness route allowlist/health compatibility/network failure, và env precedence.
- Không chạy legacy `npm.cmd test`: suite có side effects lên shared `data/` scratch/release paths; Stage 03B report ghi rõ lý do và historical failures. Không có CouchDB writes trong Stage 03C.
- Không chạy Docker, không query/mutate CouchDB, không tạo index/view.

## 9. Files

### Chỉ tạo trong Stage 03C

- `docs/shared/SHARED_FOUNDATION_CONTRACT.md`
- `docs/shared/TV2_TV3_FOUNDATION_HANDOFF.md`
- `docs/reports/TV1/RP-TV1-shared-foundation-contract-handoff.md`

Không sửa source, API routes, guide hiện có, schemas, business rules, JSONL/manifest, database, Docker hoặc các báo cáo stage trước.

## 10. Git status và preservation

- Branch giữ nguyên `feature/auth-profile-portal`.
- `docs/ARCHITECTURE_DATABASE_AUDIT.md` vẫn staged dạng add; working copy khớp index trước/sau.
- Thay đổi `backend/src/app.js`, `backend/src/server.js`, Foundation files/tests, `docs/shared/COUCHDB_FOUNDATION_GUIDE.md` và Stage 03B report đã tồn tại từ bước trước; Stage 03C không chỉnh các file đó.
- Ba file Stage 03C là untracked mới; không git add/commit/push.
- Snapshot `git status --short` sau khi tạo báo cáo:

  ```text
   M backend/src/app.js
   M backend/src/server.js
  A  docs/ARCHITECTURE_DATABASE_AUDIT.md
  ?? backend/src/config/database.config.js
  ?? backend/src/config/load-environment.js
  ?? backend/src/repositories/base.repository.js
  ?? backend/src/routes/database-health.routes.js
  ?? backend/src/services/couchdb.client.js
  ?? backend/src/services/couchdb.errors.js
  ?? backend/src/utils/api-response.js
  ?? backend/tests/foundation/
  ?? docs/reports/
  ?? docs/shared/
  ```

  Các status ngoài ba tài liệu Stage 03C là trạng thái có sẵn hoặc được tạo ở Stage 03A/03B. Không stage thêm file.

## 11. Risks và blockers

- API prefix `/api` vs `/api/v1` và success/error envelope chưa được duyệt.
- Retry count DATA-02A (1 conditional) vs AGENTS.md (up to 3) cần group decision.
- Cursor, stable sort, page cap, query-specific index/view chưa được chuẩn hóa.
- Không có auth principal; readiness endpoint không auth, không public/deploy rộng.
- TV2/TV3 chưa cung cấp DTO/query contracts để portal và cross-module integration freeze.
- Testing legacy suite còn limitations được ghi ở Stage 03B; không ảnh hưởng kết quả Foundation-only tests nhưng chưa được giải quyết.

## 12. Acceptance criteria

- [x] Đọc input docs, Foundation source và tests; phân biệt implementation với design docs.
- [x] Ghi đủ public interface methods với inputs, outputs, errors, preconditions, effects, examples and owners trong contract.
- [x] Mô tả 9 approved types và `type` discriminator.
- [x] Ghi rõ authorization/business validation thuộc service, không thuộc BaseRepository.
- [x] Phân tích 1-vs-3 retry conflict; đề xuất DATA-02A rule nhưng giữ trạng thái pending.
- [x] Viết API integration proposals và label IMPLEMENTED/APPROVED/PROPOSED/PENDING.
- [x] Tạo TV2/TV3 handoff checklist và feedback requests.
- [x] Foundation tests PASS 18/18; không ghi DB.
- [x] Giữ staged audit, branch và các file có trước.

## 13. Trạng thái nghiệm thu

**PARTIAL.** Contract/source review, documentation, handoff boundaries và Foundation test verification đạt. Chưa thể ghi PASS cho “freeze” vì retry policy, API prefix/envelope/statuses, cursor, auth principal, readiness exposure và index ownership còn chờ nhóm phê duyệt/TV2-TV3 input. Các đề xuất trong tài liệu không được coi là quyết định chính thức.

## 14. Bước tiếp theo

1. TV1/TV2/TV3 phản hồi Decision Register trong `SHARED_FOUNDATION_CONTRACT.md`.
2. Approve một conflict retry rule và service boundary; không đặt retry vào shared client.
3. Freeze API prefix, envelope/status mapping, principal interface và cursor semantics.
4. TV2 gửi Job DTO/query/filter/cursor; TV3 gửi Interview/Scoring/Audit DTO/query requirements.
5. Sau contract review, mỗi owner triển khai module riêng; index/view và live-write test ở task riêng có evidence, owner và rollback/isolation plan.

---

<a id="rp-tv1-stage-04a-auth-backend-infrastructure"></a>

## RecruiHub NoSQL — TV1 Stage 04A: Authentication Backend Infrastructure

_Source: RP-TV1-stage-04a-auth-backend-infrastructure.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; báo cáo tổng hợp bởi Codex, chưa gán cá nhân.
- **Trạng thái nghiệm thu:** **PARTIAL**.
- **Mục tiêu:** xây phần hạ tầng backend Stage 04A có thể làm mà không tự quyết các chính sách bảo mật còn pending; giữ nguyên operational health và không ghi CouchDB.

## 2. Phạm vi và yêu cầu

Được làm: router namespace `/api/v1`, User/Candidate repositories tái sử dụng Shared Foundation, strict request DTO/schema, body validation, safe User response mapping, fake-client tests và module contract documentation.

Bị chặn: xác thực hoạt động (login/register/logout), password hash, JWT/refresh/session, cookie/CSRF, principal/RBAC và seeded account activation vì các quyết định liên quan chưa được nhóm duyệt đầy đủ. Task không bao gồm Stage 04B–11.

## 3. Audit trước triển khai

- `git status --short --untracked-files=all`: working tree sạch.
- `git branch --show-current`: `feature/identity-candidate-portal`, đúng nhánh yêu cầu; không đổi nhánh.
- `git log -5 --oneline`: HEAD `f06f970 Merge pull request #1 from HuynhDoHoangNguyen/feature/auth-profile-portal`; các commit trước gồm shared Foundation/contracts, frontend scaffold và database pipeline.
- Shared Foundation source có DB config/env loader, CouchDbClient, CouchDbError, BaseRepository, provisional response helpers và database health route.
- Backend trước công việc chỉ có health/root routes; không có auth middleware/controller/service/repository nghiệp vụ hoặc `/api/v1` router.
- Có `userDocumentSchema`, `candidateDocumentSchema`, deterministic `userIdFromEmail`, roles/status constants theo DATA-02A.
- Backend `package.json`: không có lint/build script; `npm test` gọi `tests/data/*.test.js` (legacy data suite). Dependencies hiện có Express 5, Zod; không có Argon2/JWT/session dependency.
- Frontend có legacy login/register/AuthContext lưu access token ở localStorage và logout helper gọi host ngoài dự án; frontend không được sửa trong Stage 04A.
- Đã rà `AGENTS.md`, team assignment, Foundation guide/contract/handoff, Technical Decision Register, schema/business contract và báo cáo TV1 liên quan.

## 4. Kế hoạch và phần đã thực hiện

### Thực hiện được

1. Thêm empty API v1 router mount; không có auth handler.
2. Thêm `UserRepository` kế thừa `BaseRepository`, dùng Zod User schema; email lookup chuyển qua deterministic User ID, không query email bằng Mango.
3. Thêm `CandidateRepository` kế thừa `BaseRepository`, dùng Candidate schema; `findByUserId` giới hạn `type` và canonical user ID, `limit: 2`.
4. Thêm strict login/Candidate registration request schemas; role/account status không được nhận từ client.
5. Thêm provisional body validation middleware tích hợp shared response helper; response validation generic để không lộ input hoặc Zod details.
6. Thêm allowlist mapper `toSafeUserDto` để không trả password hash, `_rev` hay provenance.
7. Thêm tests fake-client/ephemeral HTTP; không có write lên CouchDB.
8. Tạo module contract và báo cáo Stage 04A.

### Không thực hiện

Không triển khai login/register/logout route, password hashing, JWT, refresh/session, cookies, CSRF, authorization principal/RBAC, User/Candidate writes, Candidate profile API, index/view, database changes hoặc frontend changes.

## 5. Files tạo/sửa

### Backend source — tạo

- `backend/src/repositories/user.repository.js`
- `backend/src/repositories/candidate.repository.js`
- `backend/src/schemas/auth-request.schema.js`
- `backend/src/middleware/validate-body.js`
- `backend/src/services/auth.service.js` (safe DTO helper only)
- `backend/src/routes/api-v1.routes.js` (empty router)

### Backend source — sửa

- `backend/src/app.js` — mount `/api/v1`; giữ nguyên `/api/health` và `/api/health/database`.

### Tests — tạo

- `backend/tests/auth-foundation/api-v1.test.js`
- `backend/tests/auth-foundation/auth-contract.test.js`
- `backend/tests/auth-foundation/repositories.test.js`

### Documentation — tạo

- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/reports/TV1/RP-TV1-stage-04a-auth-backend-infrastructure.md`

Không sửa package/lockfiles, User/Candidate document schema, business rules, shared Foundation, database, dataset, `.env`, Docker, frontend, audit report hoặc TV2/TV3 code.

## 6. Test / verification results

- Lệnh từ `backend/`: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` — **PASS 25/25**, fail 0, skipped 0.
- Bao gồm deterministic User lookup, Candidate selector, strict DTO, role/status spoof rejection, secret-safe DTO, generic validation error, API mount/health compatibility và toàn bộ Foundation regression tests.
- Runtime smoke dùng Express port OS cấp tạm; health vẫn 200 với body hiện hành; `POST /api/v1/auth/login` vẫn 404 (cố ý chưa triển khai).
- Không chạy `npm test` vì đó là legacy data suite có side effects trên scratch/release paths; không có backend lint/build/typecheck script.
- Không thực hiện CouchDB request nào; không tạo database/index/view hoặc ghi document.

## 7. Decisions đang pending

- DR-001…006 mang trạng thái `APPROVED_BY_TV1 — PENDING_TEAM_ACK`, không phải team approval. Các mục gồm `/api/v1`, JWT cookie+CSRF hướng tổng quát, Candidate-only public signup, retry DATA-02A tối đa một lần, target envelope, RBAC/principal boundary.
- DR-007…020 vẫn `PENDING`: Admin bootstrap, access/refresh TTL và storage, Argon2id params, CSRF details, cookie flags, seeded user claim/reset, cursor/index lifecycle, test isolation, readiness exposure, audit, status mapping, Recruiter invitation/activation, logout/revocation.
- `AGENTS.md` yêu cầu tối đa ba retries trong khi DATA-02A chỉ cho một conditional retry. Chưa code retry nào; cần nhóm/maintainer giải quyết.

## 8. Rủi ro và xác nhận cần TV2/TV3

- `CandidateRepository.findByUserId` là Mango query trên `type` + `user_id`; chưa có index được duyệt cho query này. Không dùng làm production workload trước query/index review.
- Candidate signup DTO là cấu trúc đầu vào tối thiểu/provisional; chưa giải quyết activation, initial profile construction hoặc atomicity giữa User và Candidate documents.
- Validation middleware trả 400 `VALIDATION_ERROR` generic bằng shared helper; global error mapping vẫn pending và middleware hiện chưa gắn vào auth route.
- API v1 router hiện rỗng; mount chỉ tạo namespace hạ tầng, không chứng minh endpoint auth hoạt động.
- Frontend còn legacy bearer/localStorage/host ngoài dự án; cần xử lý trong Stage 07 sau khi cookie/session contract được duyệt.
- TV2/TV3 cần xác nhận shared prefix/envelope/ownership contract; đây không ảnh hưởng Foundation tests nhưng cần trước integration.

## 9. Điều kiện bắt đầu Stage 04B

- Nhóm acknowledge DR-001…006 và freeze API envelope/status/principal interface.
- Chốt DR-008…011/020: Argon2id implementation/parameters, access/refresh lifecycle, cookie flags, CSRF issuance/validation/logout/revocation.
- Chốt Candidate registration/activation and seeded RESET_REQUIRED claim policy (DR-003/012), cùng ADMIN bootstrap/recovery (DR-007) và Recruiter provisioning (DR-019) trước các flow tương ứng.
- Hòa giải conflict retry rule; xác định isolated database strategy trước live-write integration.
- Bổ sung test cho auth service khi policy được chốt; không mở auth route trước các điều kiện trên.

## 10. Acceptance và trạng thái

**PARTIAL.** Đạt API v1 namespace, repositories dùng đúng Foundation, DTO/validation primitives, secret-safe User mapper, tests 25/25 và module documentation. Chưa đạt hoàn tất Stage 04A theo tiêu chí rộng vì không có auth handler/logic hoạt động; đó là chủ ý do các quyết định security/session/onboarding đang pending. Chưa có DB writes và không có regression trong targeted suite.

## 11. Git status và preservation

- Branch vẫn `feature/identity-candidate-portal`.
- Repository sạch trước khi sửa; các thay đổi sau task chỉ thuộc file source/tests/docs liệt kê ở mục 5.
- Không stage, commit, push, merge, fetch, pull hoặc thay đổi lịch sử.
- `docs/ARCHITECTURE_DATABASE_AUDIT.md` không bị sửa; không có staged thay đổi được tạo trong công đoạn này.

## 12. Đề xuất bước tiếp theo

TV1/TV2/TV3 review và ghi acknowledgement cho DR-001…006, nhóm chốt các security/onboarding decisions nêu ở mục 7–9; sau đó mở Stage 04B riêng cho password/session/auth routes với test isolation đã xác nhận.

**Commit title đề xuất (chưa tạo commit):** `feat(tv1): add auth backend foundation scaffolding`

**Description:** `Add versioned API namespace, Foundation-backed User/Candidate repositories, strict auth request validation, safe User DTO mapping, and isolated tests. Leave authentication endpoints disabled pending team security decisions.`

---

<a id="rp-tv1-stage-04b-auth-mvp-integration"></a>

## RecruiHub NoSQL — TV1 Stage 04B: Auth MVP & Existing Frontend Integration

_Source: RP-TV1-stage-04b-auth-mvp-integration.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; báo cáo tổng hợp bởi Codex.
- **Trạng thái:** **PARTIAL**.
- **Authority:** người yêu cầu phê duyệt các lựa chọn provisional cho Stage 04B; chưa có bằng chứng TV2/TV3/group acknowledgement.

## 2. Mục tiêu

Triển khai Candidate registration/login, Argon2id, Bearer JWT, `/api/v1/auth/me`, authentication/RBAC cơ bản và tích hợp trên UI hiện có; không đổi database trong công việc/test và không tạo frontend thay thế.

## 3. Phạm vi và yêu cầu

- Giữ Login/Register, AuthContext, ProtectedRoute, Navbar, routes, UI/CSS và service layer hiện tại.
- Public registration chỉ tạo Candidate; role/status/IDs do server quản lý.
- Dùng deterministic User/Candidate IDs và DATA-02A Zod schemas.
- Không sửa hoặc kích hoạt User cũ `RESET_REQUIRED`.
- Token 15 phút lưu memory-only; logout xóa token phía client.
- Không ghi `recruitment_db` trong tests; không commit/push.

## 4. Công việc đã thực hiện

### Backend

- Thêm `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- Argon2id: memory 65,536 KiB, time cost 3, parallelism 1; hash không trả về response/log.
- JWT HS256: claims `sub`, `role`, `iss`, `aud`, `iat`, `exp`, `jti`; TTL 15 phút. Signing key từ `JWT_ACCESS_SECRET`, không hardcode; tối thiểu 32 bytes và placeholder bị từ chối.
- Middleware xác minh Bearer token, reload User, yêu cầu status ACTIVE; `requireRole()` dùng principal server-verified và canonical uppercase roles.
- Strict registration DTO thu thập `full_name`, `candidate_role`, `industry`, `seniority`, `years_experience`; request không thể chọn role/status/IDs.
- Tạo User ở `RESET_REQUIRED`, validate/tạo Candidate bằng deterministic ID, rồi activate User mới tạo bằng `_rev` mới nhận. User cũ `RESET_REQUIRED` không bị đổi.
- Duplicate User trả 409 `EMAIL_ALREADY_REGISTERED`. Candidate/activation failure trả `REGISTRATION_INCOMPLETE` (409 khi conflict, 503 khi storage error); không blind retry/xóa compensation.
- API error không tiết lộ email tồn tại, hash hoặc thông tin nội bộ.

### Frontend

- Tái sử dụng Login/Register/AuthContext/ProtectedRoute/Navbar/routes hiện có; giữ phong cách và component tree.
- Register là Candidate-only và thu thập các trường cần để tạo Candidate document hợp lệ.
- Login gọi backend, giữ token trong memory rồi xác minh qua `/auth/me`; role map sang canonical uppercase.
- Logout chỉ xóa token memory, không gọi host ngoài dự án. Reload yêu cầu đăng nhập lại.
- Hợp nhất Axios thành một instance `services/api.js`; `api/axiosClient.js` re-export cùng instance. Default base URL `http://127.0.0.1:5002/api`; auth paths dùng `/v1/auth/...`.
- Cập nhật `.env.example` (placeholder JWT, API base 5002); không sửa `.env` thật.

## 5. Kết quả thực tế và bằng chứng

- Branch vẫn `feature/identity-candidate-portal`.
- Frontend `http://127.0.0.1:5173/` trả HTTP 200.
- Backend 5002: `GET /api/health` trả 200; `GET /api/v1/auth/me` trả 404. Runtime process hiện tại chưa phục vụ route Stage 04B; không restart process.
- Root `.env` tồn tại nhưng không có key `JWT_ACCESS_SECRET` hoặc `AUTH_COUCHDB_DATABASE` (chỉ kiểm tra key presence, không đọc/hiển thị giá trị); `frontend/.env` không tồn tại.
- Argon2id native module load/hash smoke check thành công.
- Toàn bộ registration/login fake tests dùng in-memory repository/client. Không gửi CouchDB write; database `recruitment_db` không được truy vấn lại trong task này.
- Auth persistence hiện yêu cầu `AUTH_COUCHDB_DATABASE` tách biệt và từ chối `recruitment_db`; code không tự tạo database.
- Người yêu cầu đã phê duyệt task-level provisional policy; vẫn pending team acknowledgement.

## 6. Files đã tạo hoặc sửa

### Backend

- **Thêm:** `backend/src/middleware/authenticate.js`, `backend/src/routes/auth.routes.js`, `backend/src/services/jwt-access-token.js`, `backend/src/services/user.dto.js`, `backend/tests/auth-foundation/auth-mvp.test.js`, `backend/tests/auth-foundation/auth-routes.test.js`.
- **Sửa cho Stage 04B:** `backend/src/routes/api-v1.routes.js`, `backend/src/schemas/auth-request.schema.js`, `backend/src/services/auth.service.js`, `backend/tests/auth-foundation/api-v1.test.js`, `backend/tests/auth-foundation/auth-contract.test.js`.
- **Dependency:** `backend/package.json` và `backend/package-lock.json` thêm `argon2@^0.45.1`; npm install script được allowlist trong manifest.
- `backend/src/app.js`, User/Candidate repositories và validation middleware đã có từ Stage 04A; không sửa các phần đó ở lượt này.

### Frontend và tài liệu

- **Thêm:** `frontend/src/context/auth-context.js`, `frontend/src/context/useAuth.js`, `frontend/tests/auth/auth-helper.test.js`.
- **Sửa:** `frontend/src/api/axiosClient.js`, `frontend/src/components/Navbar.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/context/AuthContext.jsx`, `frontend/src/index.css`, `frontend/src/pages/Jobs/JobDetails.jsx`, `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/routes/AppRoutes.jsx`, `frontend/src/services/api.js`, `frontend/src/utils/authHelper.js`, `frontend/.env.example`.
- **Tài liệu:** `docs/shared/TECHNICAL_DECISION_REGISTER.md`, `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`, báo cáo này.
- **Không sửa:** `.env` thật, CouchDB, dataset/manifest, Docker, code TV2/TV3.

## 7. Thay đổi CSDL/API/source

- Auth routes được thêm trong source nhưng chưa được xác minh trên live backend; runtime endpoint hiện trả 404.
- Runtime registration sẽ dùng CouchDB repositories. User và Candidate là hai writes riêng, không phải transaction.
- Tests dùng fake repositories/client; không write hoặc query database hiện hữu. Không tạo DB/index/view, seed hoặc migration.
- Không đổi 9 document types hoặc DATA-02A document schema.

## 8. Test/build/verification

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` | **PASS 36/36** — registration, duplicate, invalid password/token, expiry, account status, partial writes/conflict, isolated DB guard, RBAC, Foundation regression. |
| `node --test tests/auth/*.test.js` (frontend) | **PASS 1/1** — memory token và local logout clearing. |
| `npm.cmd run build` (frontend) | **PASS** — Vite production build. |
| `npm.cmd run lint` (frontend) | **PASS, 0 errors; 19 warnings** — warnings ở App/dashboard/job/landing/profile source (unused imports/variables và một hook dependency); auth context/Login/Register/Navbar/ProtectedRoute không cảnh báo. |
| `git diff --check` | **PASS**; có thông báo Git chuẩn về LF sẽ chuyển CRLF khi chạm lại một số file frontend. |
| HTTP smoke | Frontend 5173: 200; backend health 5002: 200; auth `/api/v1/auth/me`: 404. Không restart. |

Không chạy `npm test` legacy data suite vì các suite đã ghi nhận side effects trên data/release scratch paths; thay vào đó chạy auth + Foundation tests cô lập. Không chạy live registration.

## 9. Vấn đề và rủi ro

- Backend đang chạy chưa phục vụ route mới (`/api/v1/auth/me` 404); cần vận hành khởi chạy đúng source sau khi cấu hình secret. Không restart process trong task này.
- `JWT_ACCESS_SECRET` và `AUTH_COUCHDB_DATABASE` chưa được cấu hình trong root `.env`. Code sẽ trả lỗi cấu hình cho auth requests đến khi có JWT key và tên DB test cô lập hợp lệ. Câu hỏi riêng về việc thêm key vào ignored `.env` đang chờ lựa chọn; giá trị không được log/báo cáo.
- Không kiểm tra persistence bằng CouchDB vì không có DB test/demo riêng được xác nhận và không được ghi `recruitment_db`.
- User + Candidate không atomic. Partial failure giữ User `RESET_REQUIRED`, trả lỗi `REGISTRATION_INCOMPLETE`; cần operator reconciliation thủ công, hiện chưa có công cụ self-service.
- Logout không revoke token; token bị sao chép còn dùng được tối đa tới expiry. Chưa có refresh, email verification, password reset, rate limiting, audit, Admin bootstrap hoặc Recruiter signup.
- DR-002 trước đây hướng cookie+CSRF; Stage 04B dùng Bearer memory. Team acknowledgement vẫn bắt buộc.
- npm install báo tổng dependency tree có 3 high-severity advisories; chưa điều tra/remediate trong scope.

## 10. Quyết định cần nhóm xác nhận

- Bearer memory-only thay cookie+CSRF; 15 phút, không refresh/revocation.
- Argon2id parameters và password policy.
- Candidate activation sau khi tạo hai documents và operator reconciliation khi partial failure.
- API envelope/status/principal và RBAC integration contract.
- DR-004 retry policy chung; Stage 04B không tự retry mutation.

## 11. Công việc còn lại

- Cấu hình JWT secret và isolated `AUTH_COUCHDB_DATABASE` local; không commit secret, không tạo database trong task này.
- Khởi chạy đúng backend source trên cổng dev đã cấu hình sau khi xử lý secret; không can thiệp cổng 5000.
- Muốn kiểm tra persistence thì trước tiên duyệt/chuẩn bị DB test cô lập và cấu hình `AUTH_COUCHDB_DATABASE`; không dùng `recruitment_db`.
- TV2/TV3/group acknowledge provisional policy và auth contract.
- Thiết kế operator reconciliation procedure cho staged User/Candidate records.

## 12. Điều kiện nghiệm thu và trạng thái

**PARTIAL.** Auth service/routes/middleware và frontend flow đã triển khai; targeted backend tests 36/36, frontend helper 1/1, build PASS và lint exit 0. Chưa có full runtime E2E vì backend 5002 chưa nhận route mới, JWT secret/isolated database config chưa thiết lập, không có DB test riêng và chưa có team acknowledgement. Không có test write lên database hiện hữu.

## 13. Bước tiếp theo

Hoàn thành cấu hình JWT secret an toàn và một DB test/demo cô lập đã được duyệt; khởi chạy đúng backend trên cổng dev đã chỉ định; sau đó chạy Register → Login → Me → local Logout chỉ trên DB cô lập. Ghi nhận team acknowledgement trước khi nâng các lựa chọn provisional thành contract chung.


## Local JWT configuration follow-up (2026-10-23)

- Verified root `.env` exists, is ignored by `.gitignore`, and is not Git-tracked. Backend `loadBackendEnvironment()` resolves the repository root from its module path and loads root `.env` after `backend/.env`, without overriding parent-process variables.
- Added a cryptographically random local `JWT_ACCESS_SECRET` (64 bytes) to root `.env`; the value is intentionally omitted from this report and all command output. Existing environment settings were preserved.
- `.env.example` contains only the variable name with a placeholder; no secret is tracked.
- Ephemeral Express smoke using the real app source after loading root env: backend start PASS; `GET /api/health` 200; `GET /api/v1/auth/me` 401 without token; valid-shaped `POST /api/v1/auth/login` safely returns 503 `AUTH_DATABASE_CONFIGURATION_ERROR` because no isolated auth database is configured. The guard exits before CouchDB requests. No database was created, queried, or written.
- The already-running process on port 5002 was not restarted or modified; earlier observation that it serves old source and returns 404 for the new auth route remains. A controlled restart is still required to serve the updated code.
- Verification: backend auth + Foundation tests PASS 36/36; frontend auth test PASS 1/1; frontend build PASS; lint exits 0 with 19 warnings and 0 errors.
- Acceptance remains **PARTIAL**: secret configuration is complete, but live persistence/E2E requires an explicitly approved isolated CouchDB database and a controlled backend restart.

---

<a id="rp-tv1-technical-decision-freeze"></a>

## RecruiHub NoSQL — TV1 Stage 02.5: Technical Decision Freeze

_Source: RP-TV1-technical-decision-freeze.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Mục tiêu và thông tin công đoạn

- **Công đoạn:** TV1 Stage 02.5 — Technical Decision Freeze
- **Ngày lập:** 2026-10-22
- **Branch:** feature/auth-profile-portal
- **Phụ trách:** TV1; báo cáo kỹ thuật do Codex tổng hợp, chưa gán cá nhân
- **Trạng thái:** **PARTIAL**
- **Mục tiêu:** phân loại quyết định đã được chốt, cách áp dụng tài liệu hiện có và các câu hỏi cần nhóm xác nhận trước phần tích hợp Stage 03. Đây là hồ sơ đề xuất; chỉ nội dung có nguồn phê duyệt được ghi là approved.

## 2. Tài liệu và hiện trạng đã kiểm tra

- Báo cáo Stage 02: docs/reports/TV1/RP-TV1-database-schema-api-contract.md.
- Quy tắc workspace: AGENTS.md.
- Schema contract: docs/data-schema-contract.md (DATA-02A approved MVP).
- Business rules: docs/recruitment-business-rules.md.
- Scoring contract: docs/resume-scoring-design.md.
- ARCHITECTURE.md, README.md, docs/recruithub-team-work-assignment.md, docs/COUCHDB_IMPORT_GUIDE.md.
- backend/src/constants/document.constants.js, toàn bộ 9 Zod document schemas và backend/src/app.js.
- Frontend services/api.js, api/axiosClient.js, AuthContext.jsx, authHelper.js, ProtectedRoute.jsx, AppRoutes.jsx.

Hiện trạng liên quan: DB có 25.750 docs, 9 types, 0 custom indexes; toàn bộ seeded Users không có password_hash, đều RESET_REQUIRED, không có ADMIN. Backend runtime có GET /api/health; không có auth/profile/job/admin routes hoặc CouchDB integration. Frontend có cấu hình /api/v1, lưu access token trong localStorage và logout trỏ sang host ngoài dự án; đây là dấu hiệu không đồng bộ, không phải API contract được phê duyệt.

## 3. Nguyên tắc phân loại

- **Đã phê duyệt:** có trong DATA-02A / business rules / contract hiện hành; không mở lại hoặc đưa lựa chọn thay thế.
- **Có thể áp dụng theo kiến trúc hiện tại:** cách triển khai phù hợp với phần đã duyệt, không tự thay đổi nghiệp vụ; ghi rõ khi vẫn cần review bảo mật.
- **Cần TV1/TV2/TV3 xác nhận:** ảnh hưởng hợp đồng liên nhóm, dữ liệu, session, role hay storage và chưa có phê duyệt làm căn cứ.
- **Blocker bắt buộc:** không thể hoàn tất phần Stage 03 phụ thuộc cho tới khi có quyết định/contract cần thiết.

## 4. Decision Matrix

| Chủ đề | Trạng thái | Hiện có căn cứ / đề xuất | Ảnh hưởng |
|---|---|---|---|
| Schema, document types, IDs | **Đã phê duyệt** | Dùng đúng 9 type user,candidate,recruiter,company,department,job,application,interview,resume_analysis; discriminator type; IDs và reference theo DATA-02A, không lấy doc_type hoặc ID mẫu cũ từ ARCHITECTURE. | Blocker nếu module dùng enum/ID cũ; sửa DTO/query của Stage 03 theo contract. |
| Email ownership và User ID | **Đã phê duyệt** | Email canonical chỉ ở User; normalized email bất biến trong MVP; User ID deterministic SHA-256 từ email chuẩn hóa. Candidate/Recruiter giữ user_id. | Login lookup trực tiếp User _id, không cần Mango email index. |
| Roles và account statuses | **Đã phê duyệt** | Roles CANDIDATE,RECRUITER,ADMIN; statuses ACTIVE,LOCKED,RESET_REQUIRED. Không tự thêm PENDING/INVITED khi chưa duyệt schema change. | Registration/activation cần chọn flow tương thích enum. |
| Seeded user activation | **Đã phê duyệt** | 10.150 seeded User không hash và đều RESET_REQUIRED; seeded user không credential không được ACTIVE theo Zod. | Không cho seeded account đăng nhập như account có mật khẩu. Cần reset/claim policy. |
| Partial Candidate profile | **Đã phê duyệt** | Profile partial; không bịa trường học, employer, project; availability/provenance biểu đạt dữ liệu thiếu. | Stage 03 chỉ cập nhật field allowlist, giữ trạng thái availability. |
| Application lifecycle | **Đã phê duyệt** | current_stage là state duy nhất; enums APPLIED,SCREENING,INTERVIEW,OFFER,HIRED,REJECTED,WITHDRAWN; one lifetime Candidate–Job pair; withdrawal chỉ APPLIED/SCREENING/INTERVIEW; interview tạo sau khi vào INTERVIEW và reconcile retry. | Không dùng status, INTERVIEWING, OFFERED, không cho re-apply. |
| CouchDB _rev conflicts | **Đã phê duyệt** | Dùng revision mới nhất; khi 409 đọc lại, nếu action tương đương đã hoàn tất thì trả idempotent result; nếu không thì kiểm tra lại quyền/state và chỉ retry tối đa một lần khi còn rõ ràng hợp lệ. Không blind overwrite/merge. | Cần conflict response 409 và concurrency test. |
| Hash password | **Cần TV1/team xác nhận; blocker auth** | Zod chỉ quy định password_hash là hash, schema hiện không khóa thuật toán. **Đề xuất:** Argon2id với thư viện được bảo trì và tham số được cấu hình/ghi nhận; không ghi plaintext; không dùng SHA-256 trực tiếp cho mật khẩu. | Chốt package/parameters trước khi tạo user/login/reset. |
| Candidate registration | **Cần TV1/team xác nhận; blocker register** | **Đề xuất:** public registration chỉ tạo role CANDIDATE; server tự gán role, validate trước khi ghi User + Candidate, không nhận role từ body. Hai document không có transaction CouchDB: ghi theo deterministic IDs, nếu lần ghi thứ hai lỗi thì trả lỗi có thể khôi phục và reconcile; không âm thầm xóa document đã tạo. | Cần policy duplicate email, partial failure và trạng thái kích hoạt. |
| Recruiter registration | **Cần TV1/TV2 xác nhận; blocker recruiter auth** | Assignment nói module có đăng ký RECRUITER nhưng contract không khóa public self-signup hay employer verification. **Đề xuất:** invitation/admin provision hoặc approval ngoài public signup; role không do client chọn; phải gắn Company/Department hợp lệ. Không thêm account status enum tùy tiện. | Chặn public recruiter registration cho đến khi flow và ownership được duyệt. |
| ADMIN bootstrap | **Cần TV1/team xác nhận; blocker admin** | Dataset không có ADMIN. **Đề xuất:** one-time out-of-band provisioning command/runbook với secret lấy từ môi trường, không có default credential/public signup; hash password; tạo/cấp đúng User ID; ghi dấu đã bootstrap; chống tự khóa admin cuối. Cần quyết định bootstrap authority, recovery và audit; không tạo thêm business document type nếu chưa duyệt. | Không thể nghiệm thu Admin UI/API thực tế trước khi bootstrap và recovery được chốt. |
| JWT placement / claims / expiration | **Cần nhóm xác nhận; blocker session** | Kiến trúc chỉ nói JWT/secret, chưa khóa cookie vs bearer, TTL hay claims. **Đề xuất:** access JWT trong HttpOnly; Secure cookie (Secure ở HTTPS), SameSite=Lax, claims tối thiểu sub,role,iss,aud,iat,exp,jti, không có PII. Thời hạn ngắn cần nhóm chọn con số theo threat model. | API CORS phải credentials và allowlist origin chính xác. Không xem đề xuất là quyết định đã duyệt. |
| CSRF | **Cần nhóm xác nhận; blocker cookie session** | Với cookie tự gửi, **đề xuất:** kiểm tra Origin/Referer trên mutation và anti-CSRF token phù hợp; SameSite không thay thế review CSRF. Xác định allowlist local/dev/prod và xử lý cross-site. | Chặn mutation bằng cookie cho tới khi có biện pháp/test được chốt. |
| Refresh / logout / revocation | **Cần nhóm xác nhận; blocker session lifecycle** | Refresh rotation/reuse detection cần persistent session/revocation state. Stateless JWT logout chỉ xóa cookie; token bị đánh cắp còn hiệu lực tới exp. **Đề xuất:** nhóm quyết định MVP stateless với TTL ngắn hay session store được duyệt; không tự tạo CouchDB session/audit type thứ 10. Logout phải xóa cookie; nếu chọn rotation thì revoke refresh chain. | Không tuyên bố logout thu hồi ngay access token nếu không có store. |
| Role và ownership checks | **Đã phê duyệt về nguyên tắc** | Candidate sở hữu profile/application của mình; Recruiter chỉ domain scope được gán; Admin theo quyền quản trị. Backend kiểm tra trên mọi request; frontend guard chỉ UX. | Dùng canonical uppercase roles; mapping frontend legacy lowercase không được tin cậy làm authorization. |
| API prefix | **Cần TV1/TV2 xác nhận; blocker integration** | Runtime hiện mount /api/health; frontend service fallback là /api/v1; architecture/assignment nhắc /api/v1; Stage 02 đề xuất /api. **Đề xuất cho Stage 03:** giữ /api để khớp route đang chạy và không tự đổi behavior health; freeze chung trước shared client/TV2 integration. Đây chưa phải phê duyệt cuối. | Client baseURL hiện không nhất quán; chốt duy nhất một prefix. |
| Response/error contract | **Cần TV1/TV2/TV3 xác nhận; blocker integration** | **Đề xuất:** success {success:true,data,message}; error {success:false,error:{code,message,details}}; HTTP 400/401/403/404/409/429/500; không trả stack/credential. Assignment/health hiện có các shape khác nhau. | Chốt envelope, validation details, pagination và error code trước khi consumer code. |
| Public Job API | **TV2 sở hữu backend; cần TV1/TV2 xác nhận** | **Đề xuất:** TV2 cung cấp Public Job Card/Detail, chỉ OPEN; filters chỉ theo schema có dữ liệu như industry/seniority/company/department/required skills; cursor và stable sort; không giả định salary/location/full-text vì không có field/index đã xác nhận. TV1 tiêu thụ DTO, không viết Job repository thay TV2. | Job browse UI integration chờ TV2 DTO/query/paging. |
| Audit logging | **TV3 sở hữu nghiệp vụ audit; cần cả nhóm xác nhận** | Master prompt nêu audit trail/system logs nhưng schema được duyệt giữ đúng 9 business types, không có audit type. **Đề xuất:** log vận hành ra stdout/central logging; audit nghiệp vụ cần storage, event schema, retention, PII/redaction và quyền đọc được nhóm duyệt riêng. Không tự ghi audit vào User/Job hoặc thêm type. | Blocker cho audit persistence/Admin audit viewer, không nhất thiết chặn auth/profile core. |
| Indexes/views | **Có thể áp dụng sau query freeze và phê duyệt thao tác** | DB có 0 custom indexes/design docs; Stage 02 đã liệt kê candidate indexes/views theo workload. Đây mới là proposal; không tạo trong Stage 02. | Trước production workload cần TV2/TV3 query agreement, index create/verify và rollback plan. |

## 5. Các đề xuất kỹ thuật và lý do

Đây là khuyến nghị để nhóm ra quyết định, không phải quyết định chính thức:

1. **ADMIN bootstrap:** provisioning một lần qua lệnh vận hành có xác thực ngoài public API; không có mật khẩu mặc định, role ADMIN không thể chọn trong form registration. Thực thi chống khóa admin cuối và ghi audit theo storage đã duyệt.
2. **Candidate / Recruiter registration:** Candidate public; Recruiter chỉ qua invite/admin-provision hoặc approval. Cả hai role được gán server-side. Trước khi ghi phải validate toàn payload, canonicalize email và tính deterministic ID; conflict cùng ID trả 409. Ghi User/profile là hai thao tác riêng, nên có retry/reconciliation an toàn, không xóa ngược im lặng.
3. **Password:** Argon2id (hoặc tiêu chuẩn được nhóm lựa chọn sau review môi trường); mỗi password hash có salt riêng do thư viện quản lý. Password/hash không trả về response và không ghi log. Seeded users bắt đầu RESET_REQUIRED; reset/claim token phải ngẫu nhiên, ngắn hạn, một lần và lưu theo design được duyệt.
4. **JWT cookie:** ưu tiên HttpOnly cookie để tránh JavaScript đọc access token; Secure trên HTTPS, SameSite=Lax, path/domain giới hạn. Chọn TTL cụ thể trong threat-model review; claims tối thiểu, secret/key rotation và issuer/audience validation. Local development cần cấu hình cookie/CORS riêng được review.
5. **CSRF:** yêu cầu Origin allowlist và anti-CSRF defense cho cookie-authenticated state-changing request; kiểm thử cross-origin. Không coi SameSite là kiểm soát duy nhất.
6. **Refresh/logout:** nếu cần refresh, dùng token rotation và server-side revocation/reuse detection trong session store được nhóm chấp thuận. Nếu chưa có store, MVP phải tuyên bố logout chỉ xóa cookie, access token còn sống đến expiry; không quảng cáo immediate revoke.
7. **Role/ownership:** canonical roles uppercase; authorization ở service/middleware phía server và kiểm tra ownership từ dữ liệu đã đọc, không từ user_id/company ID do client gửi. Profile PATCH dùng allowlist, không cho đổi email/role/status trực tiếp.
8. **API prefix/envelopes:** thống nhất prefix duy nhất và response/error contract trước khi client/TV2 integration. Cấu hình frontend hiện có phải được rà soát trong task triển khai; logout không được gọi host ngoài dự án.
9. **Public Job API:** TV2 sở hữu các route/repository Job; TV1 sở hữu public portal consumer. DTO chỉ expose field công khai đã duyệt, lọc status=OPEN ở server, stable pagination, không trả nội bộ recruiter/user fields.
10. **Audit:** TV3 định nghĩa event fields/semantics; nhóm chốt storage và retention. Tách operational logs khỏi immutable business audit. Không thêm CouchDB type/session doc mà không sửa contract có phê duyệt.
11. **_rev conflict:** áp dụng business rules như đã duyệt: dùng _rev tươi; khi 409 re-read, nếu action tương đương đã tạo state/event thì trả idempotent result; nếu không thì revalidate authorization/state transition và chỉ retry tối đa một lần nếu vẫn rõ ràng hợp lệ. Nếu hết retry trả conflict có thể xử lý; không blind merge; interview transitions cần reconciliation.

## 6. Blockers

### Blockers bắt buộc trước khi hoàn thiện phần liên quan

- **Auth/session:** hash algorithm/parameters, cookie/JWT mode + lifetime, CSRF, refresh/revocation/logout.
- **Account onboarding:** public Candidate flow, Recruiter invitation/approval, seeded RESET_REQUIRED activation, duplicate and partial two-document write behavior.
- **ADMIN:** bootstrap, recovery và last-admin protection.
- **Shared API:** prefix, response/error envelope, pagination/error details.
- **Public portal:** TV2 Job DTO, filters, sort, cursor và authorization boundary.
- **Audit persistence:** TV3 event schema, location, retention, PII access policy trước khi lưu/hiển thị audit.

### Không chặn phần core độc lập

- DTO/type mapping theo schema đã duyệt.
- Pure email normalization/User ID helper, User public response mapper (không hash), Candidate profile validator/allowlist.
- Repository/service interfaces với fake repository và contract tests, miễn là không giả định session policy hay thay schema.
- UI loading/empty/error states và form shell không gửi/ghi dữ liệu, dùng field contract đã duyệt.

## 7. Dependency Matrix TV1 / TV2 / TV3

| Tích hợp | Producer / owner | Consumer | Dependency và giao kèo cần cung cấp | Block? |
|---|---|---|---|---|
| User identity, role, account status | TV1 | TV2, TV3 | Canonical user DTO/ID/role/status, auth principal và ownership claims | Có trước integration endpoints; profile helper độc lập được |
| Candidate profile | TV1 | TV2, TV3 | candidate_id, user_id, profile/availability/provenance; không bịa field | Không chặn TV1 isolated work; chặn API consumer cần profile |
| Recruiter company/dept scope | TV1 identity reference + TV2 domain ownership | TV2, TV3 | Recruiter principal mapping sang company/department và server-side scope | Có trước recruiter writes/read scoping |
| Public Job card/detail/list | TV2 | TV1 public portal | DTO allowlist, OPEN-only rule, filters, sort/cursor, 404 behavior | Có; portal consumer integration chờ TV2 |
| Application lifecycle | TV2 | TV1/TV3 | Approved stages/transitions, pair ID, ownership, 409 and Interview creation ordering | Có trước application dashboard/integration |
| Interview lifecycle | TV3 | TV2, TV1 | Interview DTO, round uniqueness, schedule/completion/result and reconciliation | Có trước interview UI |
| Resume analysis/scoring | TV3 | TV1/TV2 | Approved scoring schema, freshness/ranking behavior, job scope | Có trước admin/ranking surfaces; scoring pure logic thuộc TV3 |
| Audit events/storage | TV3 proposes; team approves | TV1 admin, TV2/TV3 writes | Event contract, storage, retention, redaction, authorization | Có trước audit persistence/viewer |
| Shared API envelope/auth/errors | Joint freeze, owner chưa gán | Tất cả | Prefix, success/error, auth cookie/CSRF, cursor semantics | Có trước cross-module endpoint integration |
| CouchDB foundation/indexes | Shared platform owner cần chỉ định | Tất cả | Client/config, _rev, repository patterns, approved indexes, test fixtures | Chặn DB-backed vertical slices nếu chưa có owner/interface |

## 8. Stage 03 implementation plan

### 8.1 Trước khi coding tích hợp

1. Nhóm ký các quyết định blockers ở mục 6, gán owner cho shared platform.
2. Freeze API prefix + success/error envelope + auth principal + cookie/CSRF contract trong một tài liệu ngắn có version.
3. TV2 gửi Public Job DTO/filter/cursor draft; TV3 gửi audit event/storage draft.
4. TV1 ghi acceptance tests cho account status, role/ownership, duplicate registration, _rev conflict và secret redaction.

### 8.2 Việc TV1 có thể làm độc lập ngay sau review scope

1. Chuẩn hóa DTO/field allowlist và response mapper dựa trực tiếp trên Zod/schema contract; không trả password_hash, provenance nội bộ hoặc fields chưa được phép.
2. Implement pure canonical email / User deterministic ID helper và Candidate profile validation/adaptation theo schema đã duyệt; không ghi DB.
3. Tạo repository/service interfaces và fake fixtures để auth/profile tests không cần CouchDB live.
4. Chuẩn bị route/controller skeleton và frontend loading/empty/error UI states, nhưng giữ dependency boundary rõ; không giả định session/envelope chưa được duyệt.
5. Sau khi session decisions được ký: triển khai password/session/register/login/logout/me theo incremental vertical slice, mock repository trước, sau đó CouchDB repository với _rev semantics.
6. Sau khi TV2 contract được ký: tích hợp public Jobs consumer; không sở hữu hay sửa logic backend Job của TV2.
7. Sau khi audit decision được ký: nối event producer/consumer và Admin audit view theo TV3 contract.

### 8.3 Kế hoạch tích hợp/test

- Unit tests cho normalization, deterministic IDs, safe response mapping, role/ownership policy và Candidate field allowlist.
- API contract tests cho success/error envelope, 400/401/403/404/409, auth cookie flags, CSRF, logout/expiry/refresh theo quyết định đã chọn.
- CouchDB integration tests cho deterministic create conflict, _rev update conflict, registration partial write/reconciliation và seeded RESET_REQUIRED behavior; dữ liệu test cô lập.
- TV2 consumer contract tests cho public jobs, chỉ OPEN, filters, cursor tie-breaker, empty/error states.
- TV3 contract tests cho interview/analysis refs và audit event redaction/storage sau khi contract có phê duyệt.
- Frontend tests/build/lint và full-stack smoke flow sau khi endpoint base URL thống nhất.

## 9. Stage 03 acceptance checklist

- [ ] Branch là feature/auth-profile-portal; chỉ các file trong task; không thay đổi staged audit.
- [ ] API prefix và response/error contract được ghi nhận/phê duyệt; frontend base URL không còn trỏ host ngoài/endpoint giả.
- [ ] Registration không nhận role tùy ý; duplicate email trả đúng conflict; User/profile partial-write có reconciliation được kiểm thử.
- [ ] Seeded account không đăng nhập ACTIVE khi chưa reset; không có password mặc định; password hash algorithm và params được duyệt, hash không xuất hiện trong response/log.
- [ ] ADMIN được bootstrap an toàn ngoài public registration; recovery và bảo vệ admin cuối được kiểm thử.
- [ ] GET /api/users/me phản ánh auth server-side; 401 cho unauthenticated, 403 cho role/ownership bị từ chối.
- [ ] Cookie flags, expiry, CSRF, refresh/revocation/logout đúng policy đã ký; logout semantics được mô tả chính xác.
- [ ] Candidate chỉ đọc/sửa profile own; PATCH allowlist; email/role/status không bị đổi qua endpoint profile.
- [ ] Mọi cập nhật dùng _rev đúng, re-read/re-authorize khi 409, không blind merge; conflict/retry cases được test.
- [ ] Backend error không lộ stack, hash, token hoặc PII nhạy cảm; log theo policy.
- [ ] Public Job API do TV2 cung cấp, chỉ trả OPEN và paging/filter đúng contract; UI có đủ loading/empty/error/success.
- [ ] Audit storage/retention/access do nhóm duyệt trước khi ghi; không tự thêm document type.
- [ ] Không seed/migrate DB ngoài phê duyệt; custom index chỉ được tạo theo task riêng và rollback plan.
- [ ] Backend tests + frontend lint/build + relevant integration/contract tests PASS; kết quả được ghi bằng lệnh/bằng chứng cụ thể.
- [ ] Git diff review sạch, audit đang staged còn nguyên, không commit/push nếu chưa được yêu cầu.

## 10. File và thay đổi trong công đoạn

- **Tạo:** docs/reports/TV1/RP-TV1-technical-decision-freeze.md.
- **Đã đọc:** các tài liệu liệt kê ở mục 2, gồm Stage 02 report vừa tạo.
- **Không sửa:** source, JSONL, manifest, CouchDB, indexes/views, branch hoặc staged audit.
- **Tests/build:** không chạy; công đoạn này chỉ là phân tích và lập kế hoạch.

## 11. Những mục cần nhóm phê duyệt

1. Hash algorithm và password reset/claim flow.
2. Candidate signup/activation và Recruiter invite/approval flow.
3. ADMIN bootstrap/recovery/last-admin guard.
4. JWT cookie location, exact expiration, CSRF, refresh token/session store, logout/revocation.
5. API prefix (/api hay /api/v1), error envelope/statuses và pagination.
6. TV2 public Job DTO, fields, filters, sorting, cursor, search semantics.
7. TV3 audit event schema, storage, retention, access/redaction và có thay đổi giới hạn 9 types hay không.
8. Owner cho shared database/API foundation và index lifecycle.

## 12. Công việc còn lại

- Tổ chức review ngắn TV1/TV2/TV3 để quyết các mục 11 và ghi người phê duyệt/ngày/version.
- Giao owner shared platform; đóng API prefix/envelope.
- Sau freeze, tách Stage 03 thành auth/profile core, Public Jobs integration, audit/Admin integration; mỗi phần có tests và giao kèo rõ.
- Làm task riêng cập nhật docs cũ doc_type, stage labels và ID examples; không thay tài liệu lịch sử DATA-01.
- Lập query/index rollout plan riêng trước thao tác CouchDB.

## 13. Điều kiện nghiệm thu và trạng thái

**PARTIAL.** Đã rà soát quyết định có trong tài liệu và phân biệt với đề xuất; đã có dependency matrix, blockers, độc lập-work plan và checklist. Chưa thể ghi PASS hoặc xem technical freeze hoàn tất vì chưa có xác nhận nhóm cho các mục 11, chưa có owner shared foundation, và không có bằng chứng phê duyệt các policy auth/session mới.

**Điều kiện chuyển PASS:** nhóm TV1/TV2/TV3 ghi nhận quyết định, owner và version cho mọi blocker; cập nhật contract dùng chung; không có proposal nào bị hiểu nhầm thành policy chính thức. Sau đó Stage 03 mới triển khai phần phụ thuộc.

## 14. Bước tiếp theo — đề xuất

Gửi Decision Matrix cho nhóm review, ghi outcome từng câu hỏi và người phê duyệt; sau đó bắt đầu Stage 03 với DTO/validation/safe mapper và fake-repository tests theo phần approved, đồng thời giữ auth/session và cross-team integrations sau các blocker tương ứng. Chưa có đề xuất nào trong báo cáo này được coi là đã phê duyệt.

---

<a id="rp-tv1-technical-decision-register"></a>

## RecruiHub NoSQL — TV1 Stage 03D: Technical Decision Register & API Contract Documentation

_Source: RP-TV1-technical-decision-register.md. Original report text is retained; internal links point to the corresponding consolidated section._

## 1. Công đoạn và mục tiêu

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1; báo cáo tổng hợp bởi Codex, chưa gán cá nhân.
- **Mục tiêu:** ghi một decision register có thẩm quyền rõ ràng; đồng bộ hướng API/auth/conflict đã TV1 chốt nội bộ với hợp đồng Foundation và handoff TV2/TV3; phân biệt source hiện hữu với hợp đồng đích.
- **Phạm vi:** tài liệu và kiểm chứng Foundation tests. Không triển khai Authentication, domain API, CouchDB thay đổi, index/view, schema hoặc dữ liệu.
- **Trạng thái nghiệm thu:** **PARTIAL** — tài liệu và test Foundation đạt; các mục cần nhóm xác nhận vẫn mở.

## 2. Tài liệu/source đã kiểm tra

- `AGENTS.md`, `ARCHITECTURE.md`, `docs/data-schema-contract.md`, `docs/recruitment-business-rules.md`.
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`, `SHARED_FOUNDATION_CONTRACT.md`, `TV2_TV3_FOUNDATION_HANDOFF.md`.
- TV1 reports: Stage 02 database/API contract, Stage 02.5 technical decision freeze, Stage 03A CouchDB client/repository, Stage 03B runtime verification, Stage 03C shared contract handoff.
- Foundation source: DB config/environment loader, CouchDbClient/errors, BaseRepository, API helpers, database readiness route, Express app/server; all `backend/tests/foundation/*.test.js`.
- Git repository is nested at `BaoCao/recruithub-nosql`; workspace root itself is not the Git root. Git read commands needed a per-command `safe.directory` override because filesystem ownership differs; global Git config was not changed.

## 3. Trạng thái trước và sau

- Branch trước/sau: `feature/auth-profile-portal`.
- Trước: `docs/ARCHITECTURE_DATABASE_AUDIT.md` staged as add; `git diff --quiet -- docs/ARCHITECTURE_DATABASE_AUDIT.md` confirmed working copy equals index. Existing modified backend files and untracked Foundation/docs were present.
- Sau: same pre-existing entries preserved; only this task's permitted docs were created/updated. No file was staged.
- Audit staged entry remains `A`; staged blob recorded before work was `721e911bd7cce7c9833ee1c46d192fe2eb3cfac3`; its worktree still matches index after work.
- No commit, push, fetch, pull, branch change, Git staging, source edit, CouchDB request/write, or secret read/display was performed by this documentation task.

## 4. Công việc đã thực hiện

1. Tạo decision register DR-001…DR-020, phân biệt `IMPLEMENTED`, `APPROVED_BY_DATA_CONTRACT`, `APPROVED_BY_TV1 — PENDING_TEAM_ACK`, `PROPOSED`, `PENDING`.
2. Ghi DR-001…006 là hướng TV1 chấp thuận trong phạm vi mình, còn chờ TV2/TV3/group acknowledgement; không ghi thành team approval.
3. Giữ DR-007…020 ở `PENDING`, bao gồm admin bootstrap, JWT/refresh, password hashing, CSRF, cookie flags, seeded account reset, cursor, index lifecycle, test isolation, readiness exposure, audit storage, status mapping, Recruiter provisioning và logout/revocation.
4. Bổ sung dependency graph, owner/deliverable matrix, approval checklist, change control, blockers và group approval agenda.
5. Cập nhật shared contract bằng amendment có ngày, nói rõ DR-001 `/api/v1` chỉ hướng cho domain routes và supersedes Stage 03C `/api` proposal; operational health paths giữ nguyên. Nêu rõ implementation facts và target chưa triển khai.
6. Cập nhật handoff TV2/TV3 với sáu hướng TV1, checklist xác nhận và DTO/query/workload cần trả về.

## 5. Decision và contract summary

| Chủ đề | Trạng thái Stage 03D | Ghi chú |
|---|---|---|
| Ownership TV1/TV2/TV3, 9 document types, discriminator `type` | APPROVED_BY_TASK / DATA-02A | Không thay đổi. Foundation không sinh business `_id`/`type`, retry mutation, hoặc tạo DB/index/view. |
| API prefix | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Domain đích `/api/v1`; hiện chỉ `/api/health` và `/api/health/database`, không đổi routes. |
| JWT cookie + CSRF | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Chi tiết lifetime/refresh/flags/CSRF còn pending; chưa có auth source. |
| Registration | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Public Candidate; Recruiter provisioned; không public Recruiter/Admin signup. Onboarding details pending. |
| `_rev` conflict | APPROVED_BY_TV1 — PENDING_TEAM_ACK | DATA-02A conditional retry tối đa một lần; cần reconcile `AGENTS.md` nói tối đa ba retries. CouchDbClient hiện không retry. |
| Envelope | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Target success `{success:true,data,message?}`; error `{success:false,error:{code,message,details:null}}`; exact status mapping pending. Helpers provisional; `details` hiện khác target. |
| RBAC/principal | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Server-side, canonical roles; shape `req.auth` và ownership scope pending; source auth chưa có. |
| DR-007…020 | PENDING | Chi tiết và blockers theo register. |

## 6. Test và bằng chứng

- Lệnh từ `backend/`: `node --test tests/foundation/*.test.js`.
- **PASS 18/18**, 0 failures, skipped or cancelled. Cover config, CouchDB error mapping, fake Fetch request semantics, CRUD/revision guards, BaseRepository/Zod, helper envelope, readiness allowlist/health compatibility/network failure and environment precedence.
- Foundation suite uses fakes; no live CouchDB write was made. No legacy `npm test` suite was run; it has previously documented shared data/release scratch side effects.
- Source review confirms `/api/v1` business routes, authentication, CSRF, RBAC/principal, business DTOs and cursor abstraction are **not implemented**. Existing helper error defaults `details` to `[]`, so it does not exactly implement DR-005 target `details:null`.
- No database, Docker, schema, dataset, manifest, index/view or runtime verification was performed; this was documentation-only.

## 7. Files

### Tạo

- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- `docs/reports/TV1/RP-TV1-technical-decision-register.md`

### Cập nhật

- `docs/shared/SHARED_FOUNDATION_CONTRACT.md` — dated Stage 03D decision amendment.
- `docs/shared/TV2_TV3_FOUNDATION_HANDOFF.md` — decision acknowledgement and deliverable section.

No other files were intentionally edited for this stage. Existing unrelated changes/staged entries were preserved.

## 8. Chưa được giải quyết và rủi ro

- Chưa có TV2/TV3/group acknowledgement. DR-001…006 remain TV1-endorsed only.
- DR-007…020 all remain pending; auth/session/account implementation cannot be called frozen.
- `AGENTS.md` retry count (up to three) conflicts with DATA-02A (at most one conditional retry). TV1's selected direction is pending group/maintainer resolution; do not code retries yet.
- Current route and helper implementations do not conform fully to target `/api/v1` and DR-005; no route/helper changes were allowed in this task.
- Readiness route is unauthenticated and returns allowlisted database metadata; deployment exposure policy is pending.
- TV2 Job/Application and TV3 Interview/Scoring/Audit DTO/query/index workload handoffs are outstanding.

## 9. Acceptance criteria

- [x] Register created with DR-001…020 and explicit approval state distinctions.
- [x] DR-001…006 labeled TV1-approved, pending team acknowledgement; DR-007…020 left pending.
- [x] Shared contract updated without claiming target API/auth behavior is implemented.
- [x] TV2/TV3 handoff includes acknowledgements, deliverables and no-duplication boundaries.
- [x] Foundation tests pass 18/18.
- [x] Branch and staged audit preserved; no unrelated source/data changes intentionally made.
- [ ] Group acknowledgement and pending technical decisions — outstanding.
- [ ] Stage 04 implementation contract and source alignment — not part of this stage.

## 10. Trạng thái nghiệm thu

**PARTIAL.** Decision documentation, cross-document alignment and targeted Foundation verification are complete. The technical freeze is not team-complete because no TV2/TV3/group acknowledgements were supplied and DR-007…020 remain pending. Target API/auth contract is not implemented and must not be represented as runtime behavior.

## 11. Công việc tiếp theo

1. TV2/TV3 review DR-001…006 and record explicit acknowledgement or amendments in `TECHNICAL_DECISION_REGISTER.md`.
2. Resolve the AGENTS.md/DATA-02A retry conflict and assign authority for the governing rule.
3. Decide DR-007…020, prioritizing session, registration/admin, principal, API envelope/status and cursor before dependent implementation.
4. TV2 supplies Public Job and Application DTO/query/cursor contracts; TV3 supplies Interview/Scoring/Ranking/Audit proposals and query workloads.
5. Open a separate implementation task after approval; reconcile actual routes/helpers incrementally without changing the existing health contract implicitly.

---

<a id="rp-tv1-phase-c1c-recruiter-ownership-integration"></a>

## RecruiHub NoSQL — TV1 Phase C.1C: Recruiter Ownership Integration

### Mục tiêu và phạm vi

Đối chiếu luồng đăng ký Recruiter TV1 với Job/Application TV2 hiện có; kiểm thử Company/Department scope và quyền sở hữu Job ở Backend; ghi nhận trạng thái phê duyệt liên nhóm. Không thay đổi schema, index, dữ liệu CouchDB hoặc module TV3. Không stage, commit hay push.

### Kết quả kiểm tra source

- Job schema yêu cầu `recruiter_id`, `company_id`, `department_id`.
- `JobService.create()` lấy ba reference từ Recruiter đã xác thực. Request schema strict từ chối các reference do client tự gửi.
- Sửa Job, đổi trạng thái, xem applicants và xem/chuyển stage Application đều đi qua kiểm tra quyền sở hữu. Scope yêu cầu User `ACTIVE`, role `RECRUITER`, Recruiter document hợp lệ và Company/Department tồn tại; Department phải thuộc Company. Job phải khớp cả ba reference với Recruiter.
- Auth kiểm tra liên kết Recruiter–Company–Department khi login và `/auth/me`; liên kết thiếu hoặc sai không được cấp/duy trì quyền truy cập Recruiter.
- Các route Job hiện yêu cầu role `RECRUITER`; không thêm quyền override cho Admin. Candidate/Admin không được gọi Job management.
- Đăng ký Recruiter vẫn có feature flags Backend/Frontend mặc định `false`. Company trùng tên chuẩn hóa bị từ chối; không merge hoặc gắn vào Company hiện có. Partial write dừng tại lỗi, không tự retry/xóa và cần operator reconcile.

### Thay đổi trong Phase C.1C

- Fixture Recruitment có Recruiter thứ hai thuộc Company/Department khác để kiểm thử cross-company thực tế.
- Bổ sung API tests cho client giả mạo Company/Department, Candidate/Admin gọi Job create, Job/Application cross-ownership (edit, publish/close, applicants, detail, stage), Recruiter bị LOCKED và Recruiter thiếu Department. Các request bị từ chối không làm thay đổi revision Job/Application.
- Bổ sung Auth tests cho Company bị thiếu và Department tham chiếu sai Company; login và token đã phát hành đều bị từ chối.
- Cập nhật Auth contract, DR-003/DR-019 và proposal TV1 để mô tả quan hệ dữ liệu, quyền hiện hành, duplicate policy, operator recovery và trạng thái chờ xác nhận.

### Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| Backend Auth + Recruitment targeted | **PASS 86/86** |
| Frontend tests | **PASS 64/64** (60 Vitest + 4 Node) |
| Frontend production build | **PASS** |
| Frontend lint | **PASS**, 0 lỗi, 2 cảnh báo React import tại `App.jsx` và `Landing.jsx` |
| `git diff --check` | **PASS**, có advisory LF→CRLF |
| CouchDB | Không kết nối/ghi dữ liệu trong phase này; `recruitment_db` không bị tác động |
| Browser E2E | **Chưa chạy**; kết quả unit/API tests in-memory không thay thế browser hoặc CouchDB E2E |

### Files thuộc thay đổi Phase C.1C

- `backend/tests/recruitment/fixtures.js`
- `backend/tests/recruitment/job-application-api.test.js`
- `backend/tests/auth-foundation/recruiter-registration.test.js`
- `docs/shared/TV1_RECRUITER_REGISTRATION_PROPOSAL.md`
- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- Báo cáo này.

### Quyết định còn chờ và trạng thái

TV1 ghi nhận quy tắc trên là đề xuất tích hợp dựa theo source TV2 hiện tại, không đại diện cho TV2 approval. Báo cáo TV2 hiện có nội dung cấm public Recruiter signup; cần TV2 và nhóm Auth xác nhận hoặc sửa hợp đồng trước khi đổi DR-003/DR-019 sang trạng thái được duyệt. Cũng cần xác nhận quy ước ID/provenance, chính sách Company duplicate và chấp thuận runbook xử lý partial registration. Không bật hai feature flags trước khi các quyết định này được ghi nhận.

**Trạng thái Phase C.1C: PARTIAL — kiểm thử tích hợp theo source hiện tại đạt; public Recruiter registration chưa được phép kích hoạt vì phê duyệt Auth/TV2 còn pending.** Git branch giữ nguyên `feature/identity-candidate-portal`; không stage/commit/push. Working tree còn các thay đổi trước đó của TV1 và tài liệu khác, cần review riêng trước khi commit.

---
