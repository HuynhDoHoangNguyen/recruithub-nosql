# RecruiHub NoSQL — TV1 Stage 02: Database Schema & API Contract

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
