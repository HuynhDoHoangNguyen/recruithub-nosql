# Sửa lỗi và nghiệm thu demo local — 16/11/2026

## Kết quả

Đã sửa các lỗi được phát hiện ở lần kiểm tra trước, tạo tài khoản demo ACTIVE, chạy vòng đời tuyển dụng và backup/restore trên CouchDB local thật. Không xóa database nguồn, không kích hoạt user release, không sửa `data/processed`/manifests, không commit/push.

| Kiểm tra | Kết quả cuối |
|---|---|
| Backend `npm test`, đã bổ sung `auth-foundation` vào script | 737 PASS, 0 FAIL, 9 SKIP / 746 |
| Frontend Vitest | 255/255 PASS, 31/31 files |
| Frontend Node tests | 7/7 PASS |
| Integration Docker/CouchDB bổ sung | 7/7 PASS, 0 SKIP |
| Frontend lint | 0 errors, 0 warnings |
| Frontend build | PASS; còn cảnh báo JS chunk 1.076,34 kB |
| Vòng đời HTTP/Auth/CouchDB local | 22 checks PASS |
| Import/export bổ sung | 5 checks PASS |
| Catalog live | 204 rows, 204 unique job IDs, 0 duplicate |
| Backup/restore business | 25.790 docs, 12 design docs, 2 attachments; verified indexes/attachments, private target |

Bảy integration bổ sung gồm 5 ca operational backup/restore (real Auth/JWT, restart, concurrent jobs, token/ownership/tamper), 1 round-trip restore với CouchDB disposable, 1 import/export HTTP với database test riêng. Cờ: `BR005_DOCKER_INTEGRATION=1`, `BR003_DOCKER_INTEGRATION=1`, `JOB_IMPORT_EXPORT_TEST_DATABASE=recruithub_import_export_test`. Những ca khác còn skip trong bộ mặc định không được mô tả là đã chạy. Các container test được test dừng và giữ lại theo workflow có sẵn.

## Nguyên nhân và bản sửa

1. **Catalog trùng nguồn:** App dùng cùng database cho Auth/domain nhưng catalog ghép live + dataset hai lần. Wiring truyền `sharedDatabase`, service chỉ đọc một nguồn, giữ cờ actionable và con trỏ; thêm regression test. Đã duyệt toàn bộ API thực tế, không còn ID trùng.
2. **Backup Windows:** `os.tmpdir()` dùng đường dẫn 8.3 `HOANGN~1`, trong khi `realpath()` trả `HoangNguyen`; so sánh chuỗi cũ từ chối spool hợp lệ. Startup kiểm tra symlink/junction ở từng ancestor trước, rồi canonicalize root. Giữ ACL private, ownership, quota, timeout và các guard; tests fail-closed/symlink vẫn đạt. Full business backup/restore chứng minh runtime thực tế.
3. **Publisher idempotency:** Manifest hardcode đường dẫn release mặc định dù nhận `releasesDir` khác. Dùng đường dẫn release thực tế. Test publication chuyển sang temp sandbox và thử hai lần trên cùng nội dung; không ghi lại manifest/snapshot lịch sử.
4. **Corpus freshness:** Snapshot cũ chứa fingerprint trước thay đổi hợp đồng project evidence. Không làm cho hash cũ giả thành fresh. Test re-evaluate ở temp staging theo engine hiện tại, xác minh freshness/invalidation và publication. Runtime demo tạo analysis mới qua API; điểm COMPLETE/fresh.
5. **Test foundation/Auth cũ:** `queryView` hiện hỗ trợ limit hợp lệ; bổ sung kiểm tra limit invalid/unknown option. Test public-read dùng đúng tên primary để kiểm tra opt-in. Test Admin mutation cung cấp server actor/correlation và kiểm tra no-op bị từ chối đúng contract audit; không bỏ audit guard để làm test xanh.
6. **Frontend thiếu bộ lọc:** Khôi phục location trên home; location/work mode trong job list, dùng metadata/API thật.
7. **Frontend tests cũ:** Chuyển sang thao tác dropdown Admin hiện hành, đúng chế độ Edit/Save/Cancel của Recruiter, đúng label upload, preview-before-export và kiểm tra semantic thay vì màu nền cũ. Giữ assertions về ETag, conflict, pending, payload, không ghi khi hủy/validation fail.
8. **Lint:** Loại import/biến không dùng trong App, Vite config và một test. Không tắt ESLint hoặc tăng ngưỡng cảnh báo build để che vấn đề.

## Tài khoản và môi trường

Tài khoản đăng nhập website:

- `candidate.demo@example.invalid` (CANDIDATE).
- `recruiter.demo@example.invalid` (RECRUITER).
- `admin.demo@example.invalid` (ADMIN).
- Candidate phụ `candidate2.demo@example.invalid` phục vụ xếp hạng và ca lock/unlock.

Mật khẩu ở `.env` với các khóa `LOCAL_TEST_*_PASSWORD`; ba tài khoản chính có bảng mật khẩu tại `docs/demo-accounts.local.md` (Git ignored). Không có mật khẩu hardcode trong source/test/report. Candidate/Recruiter đăng ký qua API thật; Admin dùng script operator với explicit primary opt-in. Rerun setup giữ tài khoản hiện có khi credentials khớp, không reset hoặc đổi role user lịch sử.

Audit dùng database `recruithub_logs_demo`; writer, reader, pruner, source delivery là bốn tài khoản CouchDB khác nhau, không có role admin. Source `_security` giữ roles/admins cũ và thêm đúng delivery account vào members; write guard giới hạn account đó vào outbox, không cho sửa nội dung nghiệp vụ. Kho audit có security/append-only design được provision bằng cơ chế hiện có.

Đã bật `JOB_IMPORT_EXPORT_ALLOW_LIVE_DATABASE=true` cho môi trường demo local được người dùng yêu cầu. File mẫu giữ false. Frontend gọi `/api`; secret, signing key và service credentials chỉ ở `.env` backend được Git ignore.

## Vòng đời đã chạy thực tế

Kết quả API lịch sử (file chi tiết tạm đã được dọn theo yêu cầu; giữ bản tổng kết `verification-summary.json`):

1. Login Candidate, Recruiter, Admin; kiểm tra guest 401/Candidate truy cập route Recruiter/Admin 403.
2. Hai Candidate cập nhật hồ sơ có skills/experience/education/projects. Recruiter cập nhật liên hệ.
3. Tạo PDF giả lập, upload, gắn profile và nộp đơn; Recruiter tải đúng bytes PDF.
4. Tạo DRAFT → sửa → OPEN, tìm theo location/skill; nộp trùng bị chặn.
5. Candidate tự chuyển stage bị chặn; APPLIED → HIRED nhảy cóc bị chặn.
6. Scoring COMPLETE/fresh; Candidate chính 100%, Candidate phụ 75,83% (UI 76%); ranking lặp lại giữ nguyên thứ tự.
7. APPLIED → SCREENING → INTERVIEW; lên lịch vòng TECHNICAL, feedback PASSED, OFFER rồi HIRED kèm bằng chứng chấp nhận; Candidate đọc lại đúng stage.
8. Job thực hành riêng: withdraw/reapply giữ previous attempt, hai ứng viên còn APPLIED để demo tiếp.
9. Đóng/mở lại tin theo revision; Admin lock/unlock Candidate phụ, token bị từ chối khi locked.
10. Giao audit outbox và đọc audit/system-log API.
11. Backup business → tải file ký RHBR → upload → validate → restore database mới → verify documents/indexes/attachments → anonymous bị 401.

Tên target: `recruithub_restore_demo_1794798948001`. Kết quả `target_incomplete=false`, `requires_manual_configuration=true`: không tự cutover ứng dụng sang database này.

Import/export được chạy bổ sung sau round-trip: preview JSON hai dòng → confirm tạo DRAFT → preview lại bỏ qua trùng → export hai dòng đúng scope → soft-delete riêng dòng demo dùng thử, dòng kia giữ lại. File kết quả chi tiết tạm đã được dọn theo yêu cầu.

## Kiểm tra trình duyệt

Qua browser thật, đăng nhập đủ ba role. Quan sát Candidate dashboard/CV/attempt history, Recruiter danh sách ứng viên và ranking, Admin MapReduce overview/audit viewer, tạo backup audit bằng UI (23 docs, Hoàn tất và có nút tải). Các thao tác nghiệp vụ còn lại đã được kiểm chứng qua API thật, không tuyên bố mọi thao tác đều đã click UI.

Ảnh kiểm thử đã chuyển ra ngoài project khi dọn file ngày 16/11/2026: `../recruithub-local-archive/cleanup-2026-11-16/` (đường dẫn tính từ thư mục gốc project). Gồm `candidate-dashboard.png`, `recruiter-ranking.png`, `admin-overview.png`, `admin-audit.png`, `admin-backup-success.png`. Browser checklist tạm đã được dọn theo yêu cầu. Screenshot backup ghi lại khu vực cấu hình; trạng thái Hoàn tất được đối chiếu trong accessibility tree của lượt kiểm tra, không nằm trọn trong viewport ảnh.

## Lệnh chạy và dữ liệu bàn giao

Frontend: `npm run dev` tại `frontend`. Backend: `npm start` tại `backend`. Audit delivery: terminal riêng tại backend chạy `npm run audit:watch` hoặc `npm run audit:deliver` một lần. Không thay source hoặc restart frontend giữa demo nếu muốn giữ token memory-only; reload cần đăng nhập lại, TTL token 15 phút.

Các script setup/verify demo đã được dọn theo yêu cầu sau khi hoàn tất kiểm thử; tài khoản và dữ liệu trong database được giữ nguyên. Để mở website, chạy backend/frontend như bình thường và dùng `npm run audit:watch` nếu cần chuyển audit events. Khi backup business, tạm dừng delivery worker và các thao tác ghi để consistency check không báo SOURCE_CHANGED.

File RHBR chứa dữ liệu tài khoản/CV nên Git ignored; báo cáo JSON không lưu token/password. CV mẫu là nội dung giả lập. Log local: `repair-backend-final.log`, `repair-frontend-full.log`, `repair-live-integration.log`, `demo-flow-final.log`.

Kịch bản trình bày đã cập nhật tại `docs/demo-script-2026-11-16.md`, có job ID sẵn, tài khoản, công thức scoring đúng và gợi ý chọn backup audit nhỏ để tiết kiệm thời gian trên lớp.
