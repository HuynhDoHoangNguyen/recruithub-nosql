# BR-005B — Real Auth harness

## Phần A — Mini Plan trước thực hiện

**Task:** BR-005B, kế hoạch đã được người dùng chấp nhận sau nghiệm thu BR-005A. Tạo CouchDB/process/spool riêng, seed accounts hợp schema với Argon2, login/me/JWT thật cho ba role/hai Admin, xác minh private spool và phân loại V05/V06. Không thay production source/Auth/.env/database.

## Phần B — Task Result

**Status: TECHNICAL PASS — chờ nghiệm thu BR-005B.**

### Implemented

- Fixture Docker CouchDB3.5.2.1 loopback/cổng ngẫu nhiên, database br005_source_UUID, credentials random.
- Seed đồ thị fixture hiện có, hash mật khẩu Argon2 và validate User schema. Hai Admin khác ID/email; Candidate và Recruiter có dữ liệu liên kết phục vụ Auth thật.
- Fork backend process riêng, env Auth/domain cùng DB test, JWT/signing key random; không load .env dự án, không injected authenticate hay fake login.
- Entry test dùng createApp/routes/AuthService/repositories/JWT thật, private BackupJobStore riêng; readiness qua IPC chỉ chứa port.
- Kiểm chứng bốn login thành công, me đúng ID/role; guest401, Candidate/Recruiter403, hai Admin sources200; sai mật khẩu401; token Admin đã cấp nhận401 sau khóa canonical User trong DB test.
- Spool ACL Windows: inheritance bị tắt, một ACE FullControl cho SID của process backend. Lần đầu check script thiếu import module Security ở PowerShell child; sửa test để import tường minh, chạy lại đạt. Không phải sửa ACL production.
- V05/V06 baseline A đều lỗi `Failed to get database info ... HTTP403 Forbidden`. Hai ca gọi getDatabaseInfo từ import client thật, phụ thuộc quyền/config CouchDB; phân loại infrastructure/access prerequisite, chưa có bằng chứng regression backup. Không nới quyền DB dự án hoặc sửa test cũ để che lỗi; chưa chạy lại hai ca bằng production credentials.

### Files Changed

Mới:

- backend/tests/helpers/admin-backup-operational-fixtures.js — reusable isolated Couch/seed/env/process fixture.
- backend/tests/helpers/admin-backup-operational-server.mjs — test process với app/Auth thật/private spool.
- backend/tests/recruitment/admin-backup-operational.integration.test.js — opt-in real Auth acceptance.
- Báo cáo này.

Sửa AGENTS.local.md: A ACCEPTED, B technical result. Không thay frontend/backend production source, .env, dependencies hoặc data/processed. Nhánh codex/admin-backup-restore giữ nguyên, chưa stage/commit/push.

### Tests Executed

| Kiểm chứng | Kết quả | Evidence |
|---|---|---|
| BR005_DOCKER_INTEGRATION=1 node --test tests/recruitment/admin-backup-operational.integration.test.js |1/1 PASS, nhiều assertions real HTTP/Auth/ACL|%TEMP%/recruithub-br005b.log|
|8 suites backup/restore focused|40/40 PASS|%TEMP%/recruithub-br005b-focused.log|
|Protected hashes|22/22 không đổi|So snapshot BR-003|
|git diff --check|PASS|Git output|
|Full backend/frontend, browser|NOT RUN trong B|Baseline A còn hiệu lực làm mốc; full regression thuộc F|

Không gán số liệu baseline A thành kết quả chạy mới trong B. Frontend không thay đổi. B chưa nghiệm thu all7 endpoints/owner jobs/restore/expired token/browser — thuộc C/D/E.

### Research Fidelity

- Source-confirmed: real login/me qua default auth routes; JWT guard tải lại canonical User; ACL từ filesystem thực; V05/V06 logs HTTP403.
- Implementation inference: test process riêng tránh auth singleton dùng env của ca khác; IPC readiness thay vì parse log có thể chứa dữ liệu nhạy cảm.
- Unresolved: production Auth/domain mismatch/key absent, full deployment acceptance; nguyên nhân cụ thể credentials/ACL của import client cần preflight quyền riêng, không kết luận chỉ từ403.

### Acceptance Criteria

| B scope | Kết quả |
|---|---|
|CouchDB/process/spool riêng, secrets ngoài source|PASS|
|Login ba role/hai Admin, me/JWT thật|PASS|
|Guest/non-Admin/locked canonical User bị chặn|PASS|
|Private spool runtime ACL|PASS|
|Phân loại V05/V06|PASS — dependency HTTP403, chưa sửa môi trường|

BR-005 tổng: AC02 mới được kiểm chứng một phần; các quyền owner/status/download/restore và expired-token còn C. AC10 deployment vẫn NOT VERIFIED. Không đóng toàn ADMIN-BR.

### Risks / Deviations

Hai container synthetic dừng và giữ review: recruithub-br005b-test-9d101848 (lần check ACL script lỗi) và recruithub-br005b-test-1e56a5c7 (final). Các thư mục TEMP/rhbr-br005b-Z8phKA và TEMP/rhbr-br005b-gTiRzV giữ fixture; backend child đã kết thúc. Không DELETE database hoặc ghi DB dự án. Secrets random chỉ ở process/container env, không report/log; fixture spool không chứa dữ liệu thật.

### Recommended Next Task

BR-005C — Data/security integration: sử dụng harness để chạy roundtrip, ownership bảy endpoint, expired tokens/tamper/target guards và synthetic scale theo plan đã chốt.
