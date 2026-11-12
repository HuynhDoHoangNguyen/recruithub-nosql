# BR-005A — Preflight và baseline

## Phần A — Mini Plan

Task BR-005A, PLAN READY đã được người dùng duyệt: kiểm tra Git/config/disk/spool, bảo toàn dữ liệu, chạy baseline trên bản sao cô lập, báo gate trước BR-005B. Không sửa source/.env/database.

## Phần B — Task Result

**Status: REVIEW READY — hoàn tất thu thập preflight/baseline; có gate cần theo dõi.**

### Implemented

- Nhánh codex/admin-backup-restore giữ nguyên; không stage/commit/push.
- Config probe theo loadBackendEnvironment: DATABASE_CONFIGURATION_MISMATCH và BACKUP_CONFIGURATION_ERROR. Chưa sẵn sàng authenticated deployment acceptance; không sửa .env hoặc guard.
- Container dự án recruithub-couchdb đang chạy; không restart hoặc ghi dữ liệu vào nó. Disk C còn khoảng194GB, E khoảng154GB tại lúc kiểm tra.
- Spool mặc định recruithub-backups-v1 chưa hiện diện: ACL runtime chưa VERIFIED. Không tạo spool production để kiểm tra. Cần xác minh bằng process test riêng ở B.
- 22 protected hashes khớp snapshot BR-003, gồm data/processed và tài liệu/skills được bảo vệ.
- Full backend chạy trên bản sao mới trong TEMP, loại .env/node_modules khi copy, junction dependencies; dữ liệu pipeline chỉ ghi trong bản sao. Bổ sung frontend source cho tests phụ thuộc và chạy lại với loader config trong child process; không dùng lần chạy thiếu cấu trúc làm baseline cuối.

### Files Changed

Mới: báo cáo này. Sửa AGENTS.local.md. Không thay source frontend/backend, .env hoặc snapshot gốc. Bản sao/logs giữ tại đường dẫn trong `%TEMP%/recruithub-br005a-root.txt`.

### Tests Executed

| Kiểm chứng | Kết quả |
|---|---|
| Full backend final |630 PASS /28 FAIL /4 SKIP,662 tests|
| Auth foundation |46 PASS /10 FAIL|
| Full frontend |240 PASS /11 FAIL|
| Node frontend riêng |7/7 PASS|
| Lint |0 lỗi,2 warnings có sẵn|
| Build |PASS, warning chunk lớn|
| Protected hashes |22/22 không đổi|

Backend so với BR-003 (632/26/4) có thêm hai ca FAIL: `V05: Empty database initial state returns exists=true and doc_count=0`; `V06: Non-empty database safety check requires explicit confirmation`. Các tên FAIL khác khớp khi bỏ số thứ tự TAP. Chưa kết luận hai ca này là regression production; không có source backend thay đổi trong task, cần phân loại dependency/runtime của hai ca trước kết luận cuối BR-005. Không tuyên bố full suite đạt.

Logs backend/auth trong thư mục bản sao; frontend logs `%TEMP%/recruithub-br005a-{frontend,node,lint,build}.log`. Không browser hoặc Docker integration mới trong A.

### Research Fidelity

Source-confirmed: loader config fail, disk và container inventory, kết quả test/hash như trên. Inference: disk đủ cho fixture bounded nhưng chưa chứng minh throughput/quota/ACL. Unresolved: hai ca V05/V06, quyền private spool khi khởi tạo, login/key cho deployment.

### Acceptance Criteria

| Hạng mục A | Kết quả |
|---|---|
| Git/config inventory |PASS|
| Baseline đo mới và ghi rõ sai khác |PASS|
| Protected data |PASS|
| ACL spool runtime |NOT VERIFIED — chưa có thư mục|
| Deployment config ready |FAIL — mismatch/thiếu khóa ký|

AC02–10 BR-005 không được coi PASS từ preflight. Toàn ADMIN-BR chưa đóng.

### Risks / Deviations

Hai ca backend thêm FAIL cần phân loại, full tests có lỗi baseline. Không khởi động DB/process test, không cấp key hoặc thay auth source trong A. Bản sao test được giữ review; không dọn container cũ.

### Recommended Next Task

BR-005B — Real Auth harness, trên CouchDB/process/spool riêng theo kế hoạch. Đầu bước B phân loại V05/V06 và xác minh ACL test; production deployment vẫn chưa sẵn sàng.
