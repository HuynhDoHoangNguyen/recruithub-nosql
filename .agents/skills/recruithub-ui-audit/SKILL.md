---
name: recruithub-ui-audit
description: Đánh giá chất lượng và regression UI/UX RecruiHub bằng kiểm tra source, quy trình nghiệp vụ, browser screenshots khi có công cụ, responsive, accessibility và tests. Dùng trước/sau redesign hoặc trước nghiệm thu PR UI; không tự sửa source nếu chưa được giao rõ ràng.
---

# RecruiHub UI Audit — Evidence-based review & regression guard

## 1. Mục tiêu
Thực hiện audit UI có **bằng chứng và khả năng lặp lại**. Phân biệt rõ `static code review`, `automated tests`, `browser manual/automated`, và `visual snapshots`. Không biến nhận xét thẩm mỹ thành kết luận lỗi chức năng nếu chưa xác minh.

## 2. Guardrails
- Tuân thủ `AGENTS.md`, `docs/ai-frontend-development-guide.md`, quyền module của từng thành viên và quy trình Mini Plan/chờ duyệt cho mọi code change.
- Skill mặc định là **read-only**. Chỉ khi user cho phép sửa lỗi cụ thể mới chuyển sang implementation, dùng skills phù hợp và xin duyệt Mini Plan theo chính sách repo.
- Không đăng nhập tài khoản thật, không chụp data nhạy cảm/tokens, không upload ảnh chứa PII vào dịch vụ ngoài nếu chưa được phép.
- Không thay đổi DB CouchDB, job application states, candidate ranking, auth guards hoặc backend để "làm test dễ hơn".
- Không tự tạo baseline rồi tuyên bố không regression: baseline phải lưu nguồn/timestamp/commit và được reviewer chấp thuận.

## 3. Nguồn và mặt phẳng kiểm thử
- Repo documents: AGENTS, frontend guide, screen mockups, use cases, business rules.
- Runtime: `frontend/src/App.jsx`, `frontend/src/routes/AppRoutes.jsx`, `Navbar.jsx`, global CSS, presentation CSS, feature components.
- Routes cần map từ **AppRoutes thực tế** (không suy diễn từ mockups): `/`, `/jobs`, `/jobs/:id`, `/login`, `/register`, `/reset-password`, `/profile`, `/user/dashboard`, `/recruiter/dashboard`, `/recruiter/profile`, `/recruiter/jobs/create`, `/recruiter/jobs/:id/edit`, `/recruiter/jobs/:id/applicants`, `/admin/dashboard` (xác nhận lại theo branch tại thời điểm audit).
- Roles: guest, CANDIDATE, RECRUITER, ADMIN; chỉ test những tài khoản môi trường demo được cấp phép.
- Existing tests trong `frontend/tests/`, run scripts của `frontend/package.json`.

## 4. Audit workflow
### Phase A — Snapshot state
1. Ghi branch, commit, working-tree status, setup URL/build, môi trường và giờ kiểm tra.
2. Liệt kê route thực tế + role + màn hình/feature + các hành động chính. So sánh với `docs/recruithub-screen-mockups.md`; ghi điểm lệch như `documented-only`, `implemented`, `inaccessible`, `not verified`.
3. Audit tĩnh: CSS duplication/specificity, color/font drift, hardcoded colors, component reuse, broken accessibility semantics, text-overflow, state feedback.
4. Nếu không có trình duyệt/tài khoản/demo API, không tự nhận đã có visual verification.

### Phase B — Browser/visual QA (nếu môi trường cho phép)
- Run app theo README hoặc dev scripts; kiểm tra backend health theo hướng dẫn repo. Không tự seed/reset database.
- Viewports: mobile 375×812, tablet 768×1024, desktop 1440×900 (CSS px); thêm 320 / 1024 nếu có rủi ro.
- Trên mỗi route được phép truy cập: screenshot đầy đủ, keyboard Tab / Shift+Tab / Enter / Esc, focus visible, form validation, 1 CTA chính, scrolling horizontal overflow, sticky/fixed overlay, long labels, empty data.
- Kiểm tra UI states: Loading, Empty, Error, Success; disabled/permission và responsive menu.
- Nếu dùng Playwright: test deterministic với fixture được phép; tránh snapshot phụ thuộc thời gian, dữ liệu live và animation. Giảm motion hoặc chờ app ổn định; ghi version/browser/OS.
- So sánh cùng viewport với ảnh baseline đã duyệt. Pixel diff không đủ để đánh giá UX; review thủ công mọi khác biệt có ý nghĩa.

### Phase C — Functional regression
- Candidate: tìm việc → lọc → xem chi tiết → nộp CV (nếu có data thử) → theo dõi / rút đơn; không thay đổi 7-stage nghiệp vụ.
- Recruiter: tạo/sửa job → xem ứng viên → match score / ranking / breakdown → interview interactions theo API hiện có.
- Admin: thống kê, user management, audit/log tương ứng quyền hiện có.
- Guest/Auth: login/register/reset, redirect và protected routes; không vô hiệu hóa guard.
- Không tạo fake success state. Nếu API không sẵn sàng, đánh dấu `BLOCKED/NOT TESTED` thay vì `PASS`.

### Phase D — Automated quality gates
```
cd frontend
npm run lint
npm run build
npm test
```
Chỉ chạy backend tests khi task có ảnh hưởng backend hoặc quy định nghiệm thu yêu cầu và môi trường cho phép. Ghi exit code, lệnh, kết quả; không coi các lệnh trên là bằng chứng đủ cho visual QA.

## 5. Mẫu phân loại vấn đề
- `P0`: mất dữ liệu, lộ dữ liệu, phá quyền, thao tác không thể phục hồi.
- `P1`: core flow không thể dùng, lỗi layout nghiêm trọng che hành động chính, accessibility blocker.
- `P2`: không đồng bộ UI, responsive lỗi tại breakpoint phổ biến, UX khó hiểu, state feedback thiếu.
- `P3`: vi chỉnh typography/spacing/animation, polish không ảnh hưởng task.
Gắn mỗi issue với: `ID`, route/role, mức độ, môi trường/viewport, steps, expected vs actual, bằng chứng (code path hoặc screenshot), phạm vi ảnh hưởng, đề xuất fix, trạng thái xác minh.

## 6. Checklist audit
- Global: header/nav, brand, responsive grid, typography, palette, focus, spacing, contrast, icon system.
- Jobs: filter, clear/reset, no-results, card hierarchy, salary/location/skills, pagination, job details CTA.
- Auth: label/error/hint, password fields, keyboard, loading, redirect.
- Candidate: profile/CV, application status timeline, withdraw confirmations.
- Recruiter: job form, applicants/ranking, score breakdown, modal/dialog, interview.
- Admin: table density, pagination, filtering, audit logs, mobile overflow.
- Cross-cutting: Loading/Empty/Error/Success, 375/768/1440, long Vietnamese text, API failure, permission denial.

## 7. Report format
```
# RecruiHub UI Audit — [branch]@[commit]
Scope & environment:
Evidence collected: [code/tests/screenshots/browser]
Unverified: [routes/states/roles/reasons]
Coverage matrix: [route × role × viewport × state]
Issues: [ID | priority | route | repro | evidence | recommendation]
Consistency scorecard: [tokens / components / responsive / a11y / flows — qualitative]
Regression result: [PASS/FAIL/BLOCKED/NOT RUN for each command]
Recommendations: [ordered by impact and risk]
Approval-needed changes:
```
Không tự tạo con số điểm chất lượng mà không có rubrics/dữ liệu hỗ trợ. Trước khi sửa mã, chuyển issues thành Mini Plan và xin duyệt.
