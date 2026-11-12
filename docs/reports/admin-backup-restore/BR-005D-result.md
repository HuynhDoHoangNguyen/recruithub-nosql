# BR-005D — Recovery/lifecycle

## Phần A — Mini Plan

**Task:** BR-005D — Recovery/lifecycle. Theo BR-005 đã duyệt: kiểm thử restart process thật với spool riêng, concurrent submissions và kiểm chứng các guard TTL/quota/timeout/ACL/path bằng limits/clock fixture. Không tác động production process, `.env`, database hoặc container dự án.

## Phần B — Task Result

**Status: TECHNICAL PASS — chờ nghiệm thu BR-005D.**

### Implemented

- Refactor harness test-only: child backend process có start/stop/restart có kiểm soát qua IPC. Request luôn theo origin child hiện hành sau restart; teardown chỉ dừng PID do runner tạo.
- Restart integration thật: dừng server test, tạo durable metadata trong private spool cho BACKUP `RUNNING` + `backup.partial`, VALIDATE `AVAILABLE`, RESTORE `QUEUED` + reservation; khởi động server test cùng spool.
- Sau restart qua real API: backup và restore `FAILED/JOB_INTERRUPTED`; partial bị xóa; validation `RESERVED→CONSUMED`; restore `target_incomplete=true`; target không tồn tại trong CouchDB. Không resume, overwrite hoặc delete database nào.
- Concurrent HTTP: một archive/validation hợp lệ, hai POST `/restores` đồng thời. Kết quả chính xác một202/một409, chỉ một target được tạo và restore winner SUCCEEDED.
- Regression 40 ca còn xác minh controlled limits/clock: quota/jobs, TTL/retention cleanup, timeout abort, insecure spool/symlink/path escape, failed export cleanup, write metadata failure, ambiguous bulk và partial outcome. Các limits rút ngắn chỉ có trong test, defaults production không thay.

### Files Changed

Sửa:

- backend/tests/helpers/admin-backup-operational-fixtures.js — start/stop/restart child server test-only.
- backend/tests/recruitment/admin-backup-operational.integration.test.js — hai ca BR-005D restart/concurrency real HTTP.
- AGENTS.local.md — tiến độ BR-005D.

Mới: báo cáo này. Không sửa source production, `.env`, dependency, snapshot hoặc database dự án; không stage/commit/push.

### Tests Executed

| Kiểm chứng | Kết quả | Evidence |
|---|---|---|
| BR005_DOCKER_INTEGRATION=1 operational integration B–D |5/5 PASS|%TEMP%/recruithub-br005d.log|
| focused backup/restore suite |40/40 PASS|%TEMP%/recruithub-br005d-focused.log|
| git diff --check |PASS|Git output|
| protected snapshot hashes |22/22 unchanged|Root hash check|
| Full suites/browser |NOT RUN trong D; BR-005A baseline giữ làm mốc|BR-005A result|

### Research Fidelity

- Source-confirmed: startup logic executed in a separate backend process on the same spool and observable via guarded HTTP API; CouchDB target inventory confirms no target from interrupted restore.
- Source-confirmed: concurrency results came from two simultaneous HTTP requests, not direct service calls.
- Existing-test-confirmed: TTL/quota/timeout/ACL/path cases use controlled clock/limits and remain 40/40 pass. We did not wait 24 hours or fill a real disk, so that is not claimed.
- Unresolved: multi-process distributed locking/HA is out of v1 scope; deployment config remains unready; browser real Auth is E.

### Acceptance Criteria

| Scope D | Kết quả |
|---|---|
|Real process restart/job interruption|PASS|
|Reservation consumed/no resume/no partial artifact|PASS|
|Concurrent HTTP one-time validation|PASS|
|Controlled TTL/quota/timeout/ACL/path guards|PASS via focused suite|
|Production default elapsed TTL/quota exhaustion|NOT RUN by design; defaults asserted in contract/code|

BR-005 AC05 tăng bằng chứng mạnh; AC06 PASS trong phạm vi controlled test fixtures, không phải burn-in 24h/disk saturation. AC07/08/09/10 còn E/F/deployment gate. Toàn ADMIN-BR chưa đóng.

### Risks / Deviations

- Lần dựng metadata restart đầu bị single-slot guard chặn ngay khi tạo record thứ hai. Đây là hành vi đúng; test đã sửa bằng giải phóng admission lock giữa các metadata mô phỏng, trước khi restart. Final run đạt.
- Bốn fixture containers của final/earlier restart reruns đã dừng và giữ review (`recruithub-br005b-test-*`); các spool `%TEMP%/rhbr-br005b-*` giữ lại. Không DELETE DB/container và backend child đều đã kết thúc.

### Recommended Next Task

BR-005E — Browser acceptance bằng production build, real login/JWT/API/CouchDB fixture, 4 states, reload/account isolation, expiry/error/dialog và viewport 375/768/1440.
