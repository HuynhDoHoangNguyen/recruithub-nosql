# BR-005C — Data/security integration

## Phần A — Mini Plan

**Task:** BR-005C — Data/security integration. Theo kế hoạch BR-005 đã duyệt: dùng harness BR-005B với Auth/JWT/app/API/CouchDB/spool thật, nhưng toàn bộ fixture cô lập; kiểm tra roundtrip, ownership, token hết hạn, file bị sửa và target được bảo vệ. Không thay .env, database dự án, core Auth hoặc API production.

## Phần B — Task Result

**Status: TECHNICAL PASS — chờ nghiệm thu BR-005C.**

### Implemented

- Mở rộng integration test sử dụng login thật của BR-005B, không dùng token giả hoặc injected middleware.
- Luồng HTTP hoàn chỉnh: Admin tạo backup business → poll → tải gzip signed → upload binary → validation → restore vào target private mới → poll/readback.
- Source fixture chứa 16 documents gồm đồ thị domain; verification restore thực thi so nội dung/index theo service BR-003. Kết quả `verified_documents=16`; source update_seq không đổi; target doc_count=16; anonymous target401.
- Ownership: Admin thứ hai nhận404 khi GET backup/status/download, validation status hoặc restore status của owner. Validation dùng lại sau restore trả409.
- Bảo vệ target: gửi source database làm target trả400 trước restore; validation sau đó vẫn dùng được cho target mới.
- JWT hết hạn được tạo bằng issuer thật với timestamp quá TTL và bị chặn401 trước service. Gzip bị đổi byte được upload đúng binary route, validation background FAILED với mã allowlist và không có database `recruithub_restore_test_*` nào được tạo.
- Đã phát hiện test hash chạy ở thư mục `backend` khiến relative paths từ snapshot không tồn tại. Không có file bị đổi; chạy lại ở root xác nhận22/22 hashes không đổi. Không thay code production để xử lý lỗi lệnh kiểm tra.

### Files Changed

Sửa:

- backend/tests/helpers/admin-backup-operational-fixtures.js — request helper hỗ trợ binary body/header cho endpoint upload.
- backend/tests/recruitment/admin-backup-operational.integration.test.js — thêm hai ca C real HTTP/data/security.
- AGENTS.local.md — tiến độ B/C.

Mới: báo cáo này. Không đổi source production/.env/dependencies/data snapshot; không stage/commit/push.

### Tests Executed

| Kiểm chứng | Kết quả | Evidence |
|---|---|---|
| BR005_DOCKER_INTEGRATION=1 operational integration |3/3 PASS|%TEMP%/recruithub-br005c.log|
| focused BR-002/003 backup/restore |40/40 PASS|%TEMP%/recruithub-br005c-focused.log|
| git diff --check |PASS|Git output|
| protected snapshot hashes |22/22 unchanged|Root hash check|
| Full suites/browser |NOT RUN trong C; B/A baselines giữ làm mốc|BR-005A result|

Các test C chạy ba CouchDB container độc lập. Không dùng output số liệu full suite từ task khác như kết quả C.

### Research Fidelity

- Source-confirmed: API/controller/service thật xử lý signed export, binary validation/reservation/private restore/readback; HTTP responses và CouchDB sequence/security thực chứng minh các assertion nêu trên.
- Implementation inference: 16 docs của fixture đủ cho auth/domain graph, không thay thế scale 25.750 docs; scale là phần C mở rộng/hoặc task tiếp nếu thực tế cần đo hiệu năng.
- Unresolved: file với attachment/Unicode, database empty/zero attachment, race target và all invalid vectors đã có service tests BR-002/003 nhưng chưa lặp qua real Auth HTTP harness C; process restart/TTL/quota thuộc D; deployment config vẫn blocked.

### Acceptance Criteria

| Scope C | Kết quả |
|---|---|
|Real Auth/API roundtrip|PASS|
|Owner isolation|PASS|
|Exact restore service verification, source unchanged, private target|PASS trong fixture16 docs|
|Protected source target|PASS|
|Expired JWT|PASS|
|Tampered archive before target creation|PASS|
|All vectors / scale25.750 / attachment Unicode|PARTIAL — deferred per scope|

BR-005 AC02/03/04 được tăng bằng chứng nhưng chưa hoàn toàn đóng; AC05/06/07/10 chưa đạt từ C. Toàn ADMIN-BR chưa đóng.

### Risks / Deviations

- Ba container đã dừng và được giữ review: `recruithub-br005b-test-a31ac1c0`, `...-ce85af97`, `...-23af1cbd`; thư mục fixture tương ứng trong `%TEMP%/rhbr-br005b-*` được giữ. Không DELETE database/container hoặc ghi database dự án.
- Fixture C chưa có attachment vì đồ thị Auth/Domain hiện có không kèm asset; coverage attachment binary/Unicode vẫn được chứng minh ở integration BR-003 và sẽ được đưa vào scale/vector nếu C mở rộng. Không tuyên bố C một mình phủ toàn contract.
- Production deployment vẫn thiếu auth/domain alignment và signing key/key ID.

### Recommended Next Task

BR-005D — Recovery/lifecycle: restart process cùng spool, concurrency/busy, reserved validation, deadline/partial outcome và controlled TTL/quota/ACL/path cases.
