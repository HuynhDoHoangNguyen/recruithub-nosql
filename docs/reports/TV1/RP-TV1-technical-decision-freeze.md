# RecruiHub NoSQL — TV1 Stage 02.5: Technical Decision Freeze

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
