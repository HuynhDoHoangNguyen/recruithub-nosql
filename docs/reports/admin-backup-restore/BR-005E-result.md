# BR-005E — Browser acceptance bằng Auth/JWT thật

## Phần A — Mini Plan

**Task:** BR-005E trong kế hoạch BR-005 đã được chấp thuận. Dựng frontend production build, một proxy test cục bộ và backend Express/CouchDB/spool cô lập của BR-005B. Trình duyệt phải đi qua màn hình đăng nhập thực, nhận JWT từ `POST /api/v1/auth/login` và gọi đúng API backup/restore; không dùng route login fixture của BR-004. Nghiệm thu guest guard, backup/download/upload/validate/restore, reload, session isolation, dialog/keyboard và responsive 375/768/1440. Không chạm `.env`, database hay process dự án.

## Phần B — Task Result

**Status: ACCEPTED / DONE — người dùng nghiệm thu và quyết định không thực hiện BR-005F.**

### Implemented

- Thêm runner browser chỉ phục vụ nghiệm thu: `frontend/tests/browser/admin-backup-restore-authenticated.mjs`.
- Runner build đã có trong `frontend/dist`, chạy frontend qua static server cục bộ và proxy `/api` stream thẳng đến backend child process của harness BR-005B. Nó không thêm endpoint, fixture-login hay mã production nào.
- Đăng nhập qua UI với tài khoản Admin cô lập, JWT thật từ AuthService. Guest vào `/admin/dashboard` bị Route Guard đưa về login.
- Luồng browser thật: tạo backup có ký, tải archive, upload/kiểm tra, nhập database target mới, kiểm tra dialog, restore và đọc kết quả đã đối chiếu; reload yêu cầu đăng nhập lại rồi khôi phục job trong session đang theo dõi.
- Áp dụng `recruithub-ui-audit`: kiểm tra responsive tại 375/768/1440, scroll ngang, dialog mobile, focus keyboard/Escape và các trạng thái Empty/Success. Ảnh bằng chứng cục bộ nằm ở `BR-005E-evidence/`.

### Files Changed

Mới:

- `frontend/tests/browser/admin-backup-restore-authenticated.mjs`
- `docs/reports/admin-backup-restore/BR-005E-result.md`
- `docs/reports/admin-backup-restore/BR-005E-evidence/RESULT.json` và 7 screenshots nghiệm thu.

Sửa:

- `AGENTS.local.md` — nhật ký tiến độ BR-005.

Không sửa frontend/backend production, `.env`, dependency, database/snapshot dự án; không stage, commit hay push.

### Tests Executed

| Kiểm chứng | Kết quả | Evidence |
|---|---|---|
| Edge headless + production build + Auth/JWT/API/CouchDB thật (cô lập) | 15/15 PASS | `BR-005E-evidence/RESULT.json` |
| Responsive empty/success 375×812, 768×1024, 1440×900 | PASS, không horizontal overflow | 6 screenshots |
| Dialog mobile, Shift+Tab focus trap, Escape | PASS | `confirm-375.png`, RESULT |
| `npm run build` | PASS | Vite build; warning chunk-size có sẵn |
| `npm run lint` | PASS: 0 error, 2 warnings có sẵn | `App.jsx`, `vite.config.js` |

### Browser Acceptance Matrix

| Hành vi | Kết quả |
|---|---|
| Guest guard → login thật | PASS |
| Admin login → JWT → tab backup | PASS |
| Backup/download archive ký | PASS |
| Upload/validation/restore database mới | PASS |
| Không lộ token/archive trong `sessionStorage` | PASS |
| Reload buộc đăng nhập lại, theo dõi job được khôi phục sau login | PASS |
| Không uncaught page error | PASS |

### Scope / Limitations

- Browser gọi CouchDB/API/spool disposable do runner tạo. Database đích `recruithub_restore_browser_*` nằm trong instance thử nghiệm; source project không bị ghi.
- Đây không phải live deployment acceptance: production vẫn cần provision identity/domain config, signing key/key ID và private spool/audit config trước BR-005F.
- Runner giữ container/spool cô lập theo policy review trước đó; backend child/static server/browser đã đóng sau run.

### Closure

Người dùng chấp nhận BR-005E và quyết định kết thúc ADMIN-BR tại đây. BR-005F (tổng hợp/deployment handoff) được loại khỏi phạm vi; không có công việc tiếp theo tự động.

Live deployment vẫn là một hoạt động vận hành độc lập, cần provision identity/domain config, signing key/key ID, private spool và audit trước khi đưa backup/restore vào môi trường thật.
