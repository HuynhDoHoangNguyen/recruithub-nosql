# RECRUIHUB NOSQL — TV3 LOCAL AGENT WORKSPACE

## ADMIN-BR — Sao lưu & khôi phục Admin (12/11/2026)

- BR-005E: **ACCEPTED / DONE** theo xác nhận của người dùng; người dùng quyết định không thực hiện BR-005F, ADMIN-BR được đóng tại đây. Report `docs/reports/admin-backup-restore/BR-005E-result.md`; Edge production build qua real UI Auth/JWT/API/CouchDB cô lập đạt 15/15: guest guard, login Admin, backup/download/upload/validate/restore, reload-login/job tracking, session no token/archive, 375/768/1440 no overflow và dialog keyboard/Escape. Evidence gồm RESULT + 7 screenshots. Không sửa production/.env/DB. Live deployment gate chưa VERIFIED và là hoạt động vận hành riêng.

- BR-005D: **ACCEPTED** theo xác nhận trước BR-005E. Report `docs/reports/admin-backup-restore/BR-005D-result.md`.

- BR-005D evidence: real process restart same spool turns running backup/restore into JOB_INTERRUPTED, consumes reservation/removes partial/no target; concurrent HTTP restore one202/one409/one target. Operational5/5, focused40/40, hashes unchanged. TTL/quota/timeout/ACL/path proven with controlled test fixtures, not 24h/disk burn-in. Production unchanged.

- BR-005C: **TECHNICAL PASS — chờ nghiệm thu**. Report `docs/reports/admin-backup-restore/BR-005C-result.md`. Real HTTP Auth/API roundtrip16 docs: cross-Admin owner404, protected target400, restore verified16/source seq unchanged/private target401/validation reuse409; expiredJWT401 and tampered binary validation fails before target. Operational3/3 + focused40/40, 22 hashes unchanged. No production source/.env/DB changes; attachment/Unicode/scale and lifecycle remain D/next scope. Tiếp theo BR-005D.

- BR-005A **ACCEPTED** theo xác nhận trước BR-005B. BR-005B **TECHNICAL PASS — chờ nghiệm thu**: real Auth harness Docker/process/spool riêng; bốn login/me ba role/hai Admin, guest401/non-Admin403/locked-token401 và Windows spool ACL đạt. Integration1/1, focused40/40; V05/V06 phân loại dependency HTTP403, không sửa môi trường. Report `docs/reports/admin-backup-restore/BR-005B-result.md`. Production source/.env/DB không thay; deployment gate chưa VERIFIED. Tiếp theo C data/security.

- BR-005A: **REVIEW READY**, đã thực hiện theo duyệt. Report `docs/reports/admin-backup-restore/BR-005A-result.md`. Backend bản sao final630 PASS/28 FAIL/4 SKIP (thêm V05/V06 so BR-003, cần phân loại); auth46/10; frontend240/11; Node7; lint/build đạt.22 protected hashes giữ nguyên. Config vẫn auth mismatch/thiếu signing key; spool mặc định chưa tồn tại nên ACL runtime NOT VERIFIED. Không đổi source/.env/DB. Tiếp theo BR-005B sau nghiệm thu/duyệt.

- BR-005: **PLAN READY — chờ duyệt triển khai**. Kế hoạch: `docs/reports/admin-backup-restore/BR-005-plan.md`. Probe chỉ đọc theo loader hiện hành vẫn trả DATABASE_CONFIGURATION_MISMATCH và BACKUP_CONFIGURATION_ERROR; key/ID chưa có, audit chưa cấu hình. Lập kế hoạch Auth/JWT thật trên CouchDB/process/spool cô lập; nghiệm thu cấu hình dự án là gate riêng chưa VERIFIED. Lượt planning chỉ sửa ledger/tài liệu, chưa thay source hoặc thực hiện BR-005.

- Người dùng phê duyệt kế hoạch tổng ADMIN-BR và yêu cầu thực hiện BR-001; nhánh được chỉ định tạo: `codex/admin-backup-restore` từ `dev`. Không commit/push.
- BR-001: **ACCEPTED**, người dùng nghiệm thu trong chat trước khi yêu cầu plan BR-002. Contract: `docs/admin-backup-restore-contract.md`; bằng chứng và baseline: `docs/reports/admin-backup-restore/BR-001-baseline.md`.
- Chỉ docs/ledger; production code, .env, database và snapshot gốc không thay đổi. Backup/restore chưa triển khai; không đổi trạng thái UC26 đã đóng.
- Live inventory: recruitment_db có 25.750 docs nghiệp vụ + 11 design docs; recruithub_auth_demo có 12 docs thường + 11 design docs; attachments=0. Audit connection chưa cấu hình. Identity/domain config mismatch gây login 500; probe config khớp trong bộ nhớ đăng nhập Admin được, không persist.
- Baseline backend trên bản sao hiệu chỉnh: 592 PASS / 26 FAIL / 3 SKIP, tên lỗi khớp baseline trước; auth bổ sung 46 PASS / 10 FAIL; frontend Vitest 221 PASS / 11 FAIL, Node 7/7 PASS; lint 0 error/2 warning; build PASS. Không ghi đè baseline UC26 trước đó.
- Tiếp theo BR-002 Backup API; BR-003 Validate/Restore; BR-004 Admin UI/tab; BR-005 integration. Restore chỉ DB mới private, không ghi đè nguồn/cutover. Contract v1 yêu cầu dedicated signing key, private spool, giới hạn streaming và ownership jobs. Cấu hình login là phụ thuộc live acceptance, không bypass RBAC hoặc tự sửa auth.
- BR-002: **ACCEPTED**, người dùng nghiệm thu trong chat trước khi duyệt BR-003. 4 API Admin sources/create/status/download đã triển khai; RHBR v1 streaming + HMAC/readback, GET-only source reader, job/spool private Windows ACL, owner/RBAC, limits/TTL/restart/cancel-safe download. Không restore/UI, không đổi .env hoặc core auth trong BR-002.
- BR-002 evidence: `docs/reports/admin-backup-restore/BR-002-result.md`; focused 22/22 PASS; full backend 614 PASS / 26 FAIL / 3 SKIP; auth 46 PASS / 10 FAIL. Hai nhóm tên lỗi khớp BR-001; lint/build đạt (2 warnings lint có sẵn). 21 protected file hashes không đổi; CouchDB counts/seq giữ giá trị BR-001.
- Live backup acceptance chưa chạy vì identity/domain mismatch và BACKUP_SIGNING_KEY/ID chưa provision. Không bypass guard hoặc tự export production để thay cho authenticated acceptance. BR-003 dùng fixture/test DB cô lập; key escrow, Windows private spool và single-process limitation phải giữ rõ trong rollout.
- BR-003: **ACCEPTED**, người dùng nghiệm thu khi chốt kế hoạch BR-004. Upload/strict RHBR validation, durable one-time reservation, fresh private target restore, bulk ambiguity handling và exact content/attachment/index verification đã có. Không UI/cutover/auto-delete/resume. Partitioned indexes chưa hỗ trợ (format v1 thiếu partition configuration).
- BR-003 evidence: `docs/reports/admin-backup-restore/BR-003-result.md`; focused 40/40 PASS; real isolated CouchDB 3.5.2.1 integration 1/1 PASS (12 docs, binary attachment, view/index, source seq unchanged, anonymous denied). Full backend 632 PASS / 26 FAIL / 4 SKIP; auth 46 PASS / 10 FAIL, failure names khớp BR-002; lint/build đạt. 22 protected hashes và DB dự án counts/sequences không đổi.
- BR-003 sửa adapter reader BR-002 để yêu cầu Accept JSON khi đọc attachments; không thay core auth/business. 13 container thử nghiệm đã dừng và giữ để review; không database DELETE. Chi tiết tài nguyên trong báo cáo. Tiếp theo BR-004 UI với template/skill workflow, BR-005 live acceptance sau khi provisioning login/key được xử lý.
- BR-004: **ACCEPTED**, người dùng nghiệm thu trong chat trước khi yêu cầu kế hoạch BR-005. Tab thứ tư `Sao lưu & khôi phục` tại `/admin/dashboard`, Axios sources/create/poll/download/upload/restore, xác nhận bằng dialog, TTL/partial-result, theo dõi ID/type theo từng tài khoản trong sessionStorage; không thay backend/auth/global styles.
- BR-004 evidence: `docs/reports/admin-backup-restore/BR-004-result.md` và `BR-004-evidence/`. 19 test mới PASS, focused cùng Admin logs/account 26/26, Node frontend 7/7, backend BR-002/003 40/40. Full Vitest trước 221 PASS / 11 FAIL, sau 240 PASS / 11 FAIL; danh sách lỗi trùng hoàn toàn. Lint/build đạt, hai warnings lint và chunk warning có sẵn.
- BR-004 Edge headless + production build + fixture login + API/service thật + CouchDB 3.5.2.1 cô lập đạt 24 kiểm chứng; roundtrip 12 tài liệu gồm attachment/design/index, private target, nguồn không đổi. Đã kiểm tra ảnh ở 375×812, 768×1024, 1440×900, focus trap/Escape/focus return, reload yêu cầu đăng nhập lại và khôi phục theo dõi. 3 container test đã dừng, giữ fixture để review. 22 protected hashes giữ nguyên. BR-005 tiếp theo: nghiệm thu vận hành sau khi cấu hình identity/domain và signing key được xử lý; chưa tuyên bố live production acceptance.

---

> **Phạm vi:** Quy trình làm việc, checklist và nhật ký thực thi **riêng của Thành viên 3 (TV3)**.  
> **Hiệu lực:** Tài liệu hỗ trợ `AGENTS.md` chung, **không ghi đè** các quy tắc của nhóm.  
> **Chủ sở hữu:** TV3 — Interviews, Resume Scoring Integration, Candidate Ranking, Audit/Logs.  
> **Cập nhật:** Cập nhật sau mỗi task; tiến độ hiện tại: **UC19 DONE, UC20 DONE, UC21 DONE, UC22 DONE, UC14 DONE**.

---

## 0. Cách AI Agent sử dụng file này

1. Khi bắt đầu công việc TV3, đọc `AGENTS.md` trước, tiếp theo `AGENTS.local.md`, rồi các tài liệu/schema/routes liên quan.
2. Tôn trọng thứ tự nguồn sự thật quy định tại `AGENTS.md`: Dữ liệu và Zod schema thực tế → API đang chạy → nghiệp vụ đã duyệt → kiến trúc → mockup.
3. Tài liệu này là **bản theo dõi kế hoạch và bằng chứng thực tế**, phản ánh đúng tiến độ hiện tại.
4. Mỗi task phải được chia tương đương **30–90 phút**, trình bày Mini Plan và **chờ TV3 xác nhận** trước khi sửa code.
5. Sau khi thực thi, cập nhật trạng thái nhiệm vụ, bằng chứng test và các blockers nếu có.
6. **Không tự ý tạo/chuyển nhánh, commit, push, merge hay reset Git** nếu chưa có lệnh cụ thể từ TV3.

---

## 1. Ranh giới sở hữu và phối hợp

### TV3 sở hữu
- **UC17:** Lên lịch phỏng vấn (Interview Scheduling).
- **UC18:** Ghi nhận kết quả, nhận xét, bằng chứng phỏng vấn (Interview Feedback & Results).
- **UC14:** Match Score Badge và Score Breakdown Drawer.
- **UC15:** Xếp hạng ứng viên theo Job (Candidate Ranking & Tie-breaking).
- **UC19–UC22:** Kiểm tra, tích hợp, hoàn thiện bộ chấm điểm `recruithub-scoring-mvp-v1` (tái sử dụng engine sẵn có, không viết lại).
- **UC26:** Tra cứu `system_log` và `audit_trail` cho Admin.

### TV3 không tự ý sở hữu / sửa
- **TV1:** Authentication, JWT, Candidate Profile, Public Job Search, Admin Dashboard và User Management.
- **TV2:** Job Management, Application submission, 7-stage pipeline, Recruiter Applicants Board.
- **File dùng chung:** (`AppRoutes`, `JobApplicantsPage`, `AdminDashboard`, middleware, constants) phải thống nhất hợp đồng tích hợp, báo owner, giới hạn thay đổi và ghi nhận rõ ràng.

### Tài liệu cần đối chiếu
- `AGENTS.md`, `ARCHITECTURE.md`, `README.md`.
- `docs/recruithub-team-work-assignment.md`, `docs/recruithub-usecase-system.md`.
- `docs/recruitment-business-rules.md`, `docs/resume-scoring-design.md`.
- `docs/data-schema-contract.md` và Zod schemas/Express routes thực tế.

---

## 2. Quy tắc bất biến TV3

- **Dữ liệu NoSQL:** Không sửa/xóa `data/processed/`, template `docs/Job-Application-Portal-Frontend/`; không drop `recruitment_db`, không làm thay đổi hàng loạt 25.750 business documents đã xác minh.
- **Bảo mật:** Không hardcode secret; không lộ CouchDB credentials, token, thông tin nhạy cảm trong log/code.
- **Kiến trúc:** React **không** gọi CouchDB trực tiếp; UI gọi Express API qua service/Axios. Thin controller, rich service.
- **Xử lý xung đột:** Xử lý CouchDB `_rev` conflict (HTTP 409) theo đúng nghiệp vụ: đọc lại, đánh giá lại, retry tối đa 1 lần nếu hợp lệ, không blindly overwrite.
- **Frontend chuẩn:** Đảm bảo 4 trạng thái (Loading, Empty, Error, Success); không hardcode dữ liệu giả vào production; tiếng Việt, responsive.
- **Interview Lifecycle:** Tạo vòng 1 **sau** khi chuyển `SCREENING → INTERVIEW`; `application` phải ở stage `INTERVIEW`; số vòng dương, duy nhất, tuần tự; dùng ID ổn định/idempotent. `InterviewResult` không cộng vào Resume Match Score.
- **Scoring Engine MVP v1:** **Không dùng AI/LLM** để tự sinh điểm. `recruithub-scoring-mvp-v1` hoàn toàn deterministic; trọng số chuẩn: **Skill 50%, Experience 25%, Education 10%, Project 15%**; optional skills không cộng điểm.
- **Tính toàn vẹn điểm số:** Khi thiếu input, lưu `INCOMPLETE`, **không bịa** total score / recommendation / rank; đầu vào synthetic demo phải được gắn nhãn rõ ràng.
- **Ranking Invariants:** Chỉ xếp hạng hồ sơ `COMPLETE`, fresh, hợp lệ; active stages: `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`; loại bỏ terminal stages (`HIRED`, `REJECTED`, `WITHDRAWN`). Sắp xếp: `total_score DESC` → `scores.skill DESC` → `applied_at ASC` → `application._id ASC` (dùng điểm chưa làm tròn).

---

## 3. Bảng Use Case, nhánh và tình trạng hiện tại

| UC | Đầu ra nghiệm thu chính | Nhánh thực hiện | Trạng thái | Bằng chứng nghiệm thu |
|---|---|---|:---:|---|
| **UC19** | Normalize/provenance, canonical validation, deterministic fingerprint | `feature/tv3-uc19-resume-normalization` | **DONE** | TV3 chấp thuận 2026-10-25; targeted regression PASS 125/125; focused PASS 33/33. |
| **UC20** | Skill Score, matched/missing skills, test vectors GAP-01..06 | `feature/tv3-uc20-skill-matching` | **DONE** | TV3 chấp thuận 2026-10-25; focused PASS 63/63; targeted regression PASS 133/133; UN-02 Accepted Known Limitation. |
| **UC21** | Experience / Education / Project scoring theo approved rules | `feature/tv3-uc21-profile-component-scoring` | **DONE** | Nghiệm thu 2026-10-25; 19/19 gaps closed; single-file regression 90/90 PASS; DEC-UC21-EXP-DID-01 Accepted Known Limitation; UC22 handoff recorded. |
| **UC22** | Compute/upsert analysis, COMPLETE/INCOMPLETE, fingerprint/freshness | `feature/tv3-uc22-overall-scoring` | **DONE** | Nghiệm thu 2026-10-25; TV3-UC22-001..004 hoàn tất; Planner chấp thuận; targeted recruitment PASS 107/107; scoring/schema PASS 134/134; full backend baseline 391/415 PASS (24 historical ETL failures); CouchDB writes = 0. |
| **UC14** | Match Score Badge + Breakdown Drawer (UI/API) | `feature/tv3-uc14-match-score-display` | **DONE** | Nghiệm thu 2026-10-26; read API + safe summary DTO, Badge, Drawer và recompute hoàn tất; Backend targeted 98/98 PASS; Frontend 177/177 PASS; 17/17 invariants PASS. |
| **UC15** | Candidate Ranking API + bảng xếp hạng Recruiter | `feature/tv3-uc15-candidate-ranking` | **DONE** | Nghiệm thu 2026-10-26; deterministic raw-score ranking, RBAC/ownership, safe DTO, global pagination và Recruiter UI hoàn tất; Backend UC15 68/68, Frontend UC15 33/33 PASS. |
| **UC17** | Lên lịch phỏng vấn, kiểm tra xung đột / vòng phỏng vấn | `feature/tv3-uc17-interview-scheduling` | **DONE** | Người dùng nghiệm thu ngày 2026-11-12. Xem §14. |
| **UC18** | Ghi nhận kết quả, bằng chứng phỏng vấn, cập nhật stage | `feature/tv3-uc18-interview-feedback` | **DONE** | Người dùng nghiệm thu ngày 2026-11-12. Xem §15.3. |
| **UC26** | Tra cứu system log & audit trail cho Admin | `feature/tv3-uc26-system-audit-logs` | **DONE** | Người dùng nghiệm thu đóng ngày 2026-11-12. Producer → incident → recovery → Admin API → Edge Viewer đạt trên CouchDB cô lập; production provisioning là bước rollout vận hành riêng. |

---

## 4. Checklist làm việc bắt buộc cho MỖI task

### 4.1. Trước khi gửi AI code
- [ ] Xác nhận Use Case, owner, tên branch hiện tại, base commit và `git status`.
- [ ] Đọc `AGENTS.md`, `AGENTS.local.md`, tài liệu nghiệp vụ, schema, API và code liên quan.
- [ ] Kiểm kê **ĐÃ CÓ / CHƯA CÓ / CHƯA XÁC MINH** để tránh viết lại engine có sẵn.
- [ ] Chia task 30–90 phút; nêu rõ file được sửa, file cấm sửa.
- [ ] Soạn prompt / Mini Plan với đầy đủ 6 mục và **chờ TV3 duyệt trước khi sửa code**.

### 4.2. Trong khi code
- [ ] Chỉ sửa file trong scope đã duyệt; nếu cần mở rộng, dừng và xin xác nhận.
- [ ] Bảo vệ RBAC/ownership; validate Zod; không tự ý đổi trọng số hoặc công thức scoring.
- [ ] Không tạo side-effects đến cơ sở dữ liệu CouchDB nếu chưa có lệnh cấp phép.

### 4.3. Khi nghiệm thu
- [ ] Chạy tests liên quan và ghi nhận lệnh + kết quả thực tế (chỉ đánh dấu PASS khi có bằng chứng chạy thật).
- [ ] Kiểm tra tính toàn vẹn cú pháp (`node --check`) và `git diff --check`.
- [ ] Cập nhật bảng task, session log ngắn gọn, ghi rõ blockers/limitations nếu có.
- [ ] **Không tự commit/push/merge/reset** khi chưa có chỉ đạo từ TV3.

---

## 5. Ưu tiên thực hiện (Execution Roadmap)

```
[UC19: Resume Normalization]  ──► DONE (2026-10-25)
           │
[UC20: Skill Matching]        ──► DONE (2026-10-25)
           │
[UC21: Component Scoring]     ──► DONE (2026-10-25)
           │
[UC22: Overall & Runtime]     ──► DONE (2026-10-25)
           │
[UC14: Score Display]          ──► DONE (2026-10-26)
           │
[UC15: Candidate Ranking]     ──► DONE (2026-10-26)
           │
[UC17 & UC18: Interviews]     ──► NEXT — Scheduling & Feedback lifecycle
           │
[UC26: Audit & Monitoring]    ──► DONE (2026-11-12)
```

---

## 6. Task Register — Tổng hợp tiến độ TV3

| Task ID | UC | Tên nhiệm vụ | Trạng thái | Bằng chứng & Kết quả nghiệm thu |
|---|---|---|:---:|---|
| **TV3-UC19-001..007** | UC19 | Resume Normalization & Canonical Validation | **DONE** | Nghiệm thu 2026-10-25. Focused PASS 33/33; Targeted regression PASS 125/125. Hoàn thiện fingerprint, strict availability và Job project technology canonicalization. |
| **TV3-UC20-001** | UC20 | Skill Matching Technical Audit | **DONE** | Nghiệm thu 2026-10-25. Rà soát thuật toán hiện hữu, xác lập GAP-01..06 và phát hiện UN-02; tests NOT_RUN. |
| **TV3-UC20-002** | UC20 | Targeted Skill Matching Verification | **DONE** | Nghiệm thu 2026-10-25. Bổ sung suite `DATA-03.4A` (+222 dòng) tại `backend/tests/data/resume-scoring.test.js`. Focused PASS 63/63; Targeted regression PASS 133/133; syntax & diff check PASS. Không sửa production code. |
| **TV3-UC20-003** | UC20 | Final Review & Diagnostic Decision | **DONE** | Nghiệm thu 2026-10-25. Rà soát 6 code paths; xác nhận consumer `NOT_CONSUMED` / `NOT_IMPLEMENTED`; đính chính commit metadata HEAD `a87bbb1`; TV3 quyết định UN-02 là Known Limitation. |
| **TV3-UC20-CLOSE** | UC20 | Final Closure Record & Ledger Preparation | **DONE** | Nghiệm thu 2026-10-25. Chuẩn bị hồ sơ đóng và đồng bộ hóa `AGENTS.local.md` theo phê duyệt của TV3. |
| **TV3-UC21-001** | UC21 | Experience, Education & Project Scoring Audit | **DONE** | Nghiệm thu 2026-10-25. Kiểm kê implementation 3 pure scorers, xác lập 19 test gaps; tests NOT_RUN. |
| **TV3-UC21-002** | UC21 | Numeric Integrity & Strict Availability Verification | **DONE** | Nghiệm thu 2026-10-25. Thêm 13 subtests (+314 dòng) tại `backend/tests/data/resume-scoring.test.js`. Focused PASS 14/14; Single-file PASS 77/77; syntax & diff check PASS. |
| **TV3-UC21-003** | UC21 | Degree Ranking & Project Evidence Verification | **DONE** | Nghiệm thu 2026-10-25. Thêm 12 subtests (+179 dòng) tại `backend/tests/data/resume-scoring.test.js`. Focused PASS 13/13; Single-file PASS 90/90; syntax & diff check PASS. |
| **TV3-UC21-CLOSE** | UC21 | Final Closure Ledger & Handoff Preparation | **DONE** | Nghiệm thu 2026-10-25. Ghi nhận DEC-UC21-EXP-DID-01 là Accepted Known Limitation, 19/19 gaps closed, quy định điều kiện chuyển giao sang UC22 tại Mục 10. |
| **TV3-UC22-001** | UC22 | Runtime Resume Scoring Service | **DONE** | Nghiệm thu 2026-10-25. Xây dựng `ResumeScoringService` tại `backend/src/services/scoring/resume-scoring.service.js`. Parse Application, Candidate, Job; evaluate Resume Analysis; validate schema; xử lý CouchDB 409 conflict với fresh re-read & 1 retry; 28/28 tests PASS. |
| **TV3-UC22-001-REVIEW-FIX** | UC22 | Validate Existing Resume Analysis Before Upsert | **DONE** | Nghiệm thu 2026-10-25. Thêm `#loadAndValidateExistingAnalysis` xác thực type, schema và cross-reference trước khi lấy `_rev` của existing analysis; bổ sung 9 review test vectors (REVIEW-01..09); 28/28 tests PASS. |
| **TV3-UC22-002** | UC22 | Application Runtime Scoring Integration | **DONE** | Nghiệm thu 2026-10-25. Tích hợp `ResumeScoringService` vào `ApplicationService.create()` và `.dto()`. Phản ánh `analysis_status` và `analysis_fresh`; không rollback Application khi scoring lỗi. Bổ sung Vectors 01-14; 38/38 tests PASS. |
| **TV3-UC22-002-REVIEW-FIX** | UC22 | Enforce Persisted Analysis Trust Boundary | **DONE** | Nghiệm thu 2026-10-25. Không tin trực tiếp object trả từ hook scoring; đọc `analysis_status` và `analysis_fresh` trực tiếp từ persisted analysis thông qua `getAnalysisSummary()`. Bổ sung test kiểm chứng mock hook không persist trả `REQUESTED` + `fresh: false`; 38/38 tests PASS. |
| **TV3-UC22-003** | UC22 | Manual Resume Analysis Compute API | **DONE** | Nghiệm thu 2026-10-25. Hiện thực endpoint `POST /api/v1/resume-analysis/compute`. Zod validation `computeScoringRequestSchema`, RBAC chỉ cho `RECRUITER`, kiểm tra job ownership `ownedJob` trước khi scoring, route mounting tại `app.js`. Tạo `resume-scoring-api.test.js` phủ 21 vectors; 17/17 tests PASS; recruitment suite 107/107 PASS. |
| **TV3-UC22-004** | UC22 | Final Verification & Closure Ledger cho UC22 | **DONE** | Nghiệm thu 2026-10-25. Hoàn tất audit 16/16 invariants; targeted tests PASS (107/107 recruitment, 134/134 scoring/schema); syntax check 6/6 PASS; `git diff --check` sạch; npm test baseline 391 PASS / 24 FAIL (24 lỗi lịch sử ETL/parquet, 0 hồi quy UC22); CouchDB writes = 0; Planner chấp thuận ACCEPTED. |
| **TV3-UC22-CLOSE** | UC22 | Final Closure Record & Ledger Synchronization | **DONE** | Nghiệm thu 2026-10-25. Planner chính thức phê duyệt đóng UC22; đồng bộ sổ cái AGENTS.local.md, xác nhận unrounded score rule, bảo toàn DEC-UN02, DEC-UC21-EXP-DID-01 và rào cản ETL lịch sử. |
| **TV3-UC14-001** | UC14 | Analysis Read API & Applicant Badge Summary | **DONE** | GET analysis có Zod/RBAC/ownership, safe detail DTO và Recruiter-only score summary; scoring runtime 28/28, scoring API 27/27, Application API 43/43 PASS. |
| **TV3-UC14-002** | UC14 | Scoring API Client & MatchScoreBadge | **DONE** | Axios client, 4 trạng thái Badge, strict finite-number display, keyboard semantics và nhãn tiếng Việt; review-fix chặn numeric-string coercion. |
| **TV3-UC14-003** | UC14 | ScoreBreakdownDrawer & Recompute Integration | **DONE** | Drawer responsive, loading/error/empty/COMPLETE/INCOMPLETE/stale, recompute refresh detail/list, focus/Escape và double-submit guard; review-fix đồng bộ `missing_inputs` object contract và provenance label an toàn. |
| **TV3-UC14-004** | UC14 | Final Regression, Security Audit & Closure | **DONE** | Nghiệm thu 2026-10-26. 17/17 invariants PASS; Backend targeted 98/98; recruitment 166/168 (2 baseline dev); Frontend 177/177; full Backend 450/476 với 26 failure ngoài UC14. |
| **TV3-UC14-CLOSE** | UC14 | Final Closure Record & UC15 Handoff | **DONE** | Planner chính thức đóng UC14; không ranking/sorting, không mirrored score trong Application, không CouchDB mutation; UC15 là bước tiếp theo. |
| **TV3-UC15-001** | UC15 | Deterministic Ranking Core & Batch Repository Access | **DONE** | Nghiệm thu sau FIX-01/FIX-02; ranking toàn cục dùng raw `total_score` → raw `scores.skill` → `applied_at` → Application ID, controlled exclusions, full pagination và batch `getMany`; không N+1, không persist rank. |
| **TV3-UC15-002** | UC15 | Recruiter Ranking API & Safe DTO | **DONE** | Endpoint owner-scoped có strict Zod query, RBAC/Job ownership, aggregate exclusions và safe allowlist DTO; global rank được giữ nguyên sau pagination. |
| **TV3-UC15-003** | UC15 | Recruiter Ranking View & UC14 Drawer Integration | **DONE** | Bảng ranking responsive trên Applicants page, loading/empty/error/success, server order/global rank, Drawer recompute refetch; FIX-01 bổ sung stale-response generation guard và giữ Drawer ổn định khi refetch. |
| **TV3-UC15-004** | UC15 | Final Integration, Regression & Closure Verification | **DONE** | Planner nghiệm thu 2026-10-26 sau FIX-01 whitespace cleanup; Backend UC15 68/68, UC14/Application 98/98, Frontend UC15 33/33, full Frontend 210/210 PASS; full Backend 518/544 với 26 baseline failures ngoài UC15. |
| **TV3-UC15-CLOSE** | UC15 | Final Closure Record & UC17 Handoff | **DONE** | UC15 chính thức ACCEPTED; 0 UC15 regression, 0 CouchDB production mutation, safe DTO/RBAC/ownership/deterministic invariants PASS; handoff sang `feature/tv3-uc17-interview-scheduling`. |
| **TV3-UC17-002** | UC17 | Tích hợp API, UI Recruiter và kiểm thử xuyên suốt | **DONE** | Người dùng nghiệm thu ngày 2026-11-12. 158/158 ca backend mục tiêu, frontend test/lint/build đạt, Edge/CouchDB PASS. Backend toàn repo còn 28 lỗi trùng baseline. Xem §14. |
| **TV3-UC18-001** | UC18 | API ghi nhận điểm, bằng chứng và kết quả theo vòng | **DONE** | Người dùng nghiệm thu ngày 2026-11-12. 6/6 ca mới, 172/172 ca mục tiêu; toàn repo còn cùng 26 ca lỗi như baseline. Xem §15.1. |
| **TV3-UC18-002** | UC18 | UI Recruiter và nghiệm thu Edge/CouchDB | **DONE** | Người dùng nghiệm thu ngày 2026-11-12. 212/212 Vitest, 7/7 Node frontend, 172/172 backend mục tiêu. Edge/CouchDB UC17 và UC18 đạt. Xem §15.3. |
| **TV3-UC26-005** | UC26 | Viewer Audit Trail và System Logs cho Admin | **DONE** | Được bao gồm trong nghiệm thu đóng UC26 ngày 2026-11-12. Ba tab Admin, lọc UTC theo ngày Việt Nam, cursor paging, bốn trạng thái UI và DTO allowlist. Frontend 219/219 Vitest + 7/7 Node, Edge/CouchDB 3/3 đạt. Xem §21. |
| **TV3-UC26-006A** | UC26 | Dependency System Producer | **DONE** | Người dùng chấp nhận và chuyển sang 006B ngày 2026-11-12. Application, Job và Admin User phát sinh `DEPENDENCY_WRITE_FAILED` best-effort khi write hạ tầng lỗi; fallback đã sanitize. Targeted 13/13, CouchDB cô lập 9/9, full backend 574 PASS / 26 FAIL / 2 SKIP. Xem §22. |
| **TV3-UC26-006B** | UC26 | Durable Delivery Incident và Recovery Producer | **DONE** | Người dùng chấp nhận ngày 2026-11-12. Incident metadata bền vững, stable event IDs, outage recovery sinh FAILED/RECOVERED và conflict sinh FAILED rồi quarantine. Targeted 18 PASS / 1 SKIP, CouchDB cô lập 3/3, full backend 580 PASS / 26 FAIL / 2 SKIP. Xem §23. |
| **TV3-UC26-006C** | UC26 | Final Integration, Edge Verification và Closure | **DONE** | Người dùng nghiệm thu ngày 2026-11-12. Bỏ recovery fixture thủ công; mutation Admin → outbox → incident → FAILED/RECOVERED → API → Edge Viewer đạt 3/3 trên CouchDB cô lập. Full backend 580/26/2; frontend 219 Vitest + 7 Node; lint/build đạt. Xem §24. |
| **TV3-UC26-CLOSE** | UC26 | Final Closure Record & Ledger Synchronization | **DONE** | Người dùng chấp nhận đóng UC26 ngày 2026-11-12; DR-017 đồng bộ trạng thái closed, role-change giữ ngoài MVP và production provisioning chuyển sang checklist rollout. |

---

## 7. Tóm tắt Hồ sơ Đóng (Closure Summaries)

### 7.1. UC19 — Resume Normalization (`DONE` — 2026-10-25)
- **Đầu ra chính:** Chuẩn hóa canonical skills và degrees qua `normalizeSkill()` và `normalizeDegree()`; Candidate Profile PATCH chuẩn hóa server-side; chặn duplicate/alias collision tại Candidate và Job schemas.
- **Tính toàn vẹn:** Xử lý strict availability; sinh versioned input fingerprint SHA-256 có project provenance; bảo toàn tính tương thích với legacy Resume Analysis.
- **Minh chứng:** Targeted regression PASS 125/125 trên 7 test files in-memory; direct schema / Job API regression PASS 33/33.

### 7.2. UC20 — Skill Matching MVP (`DONE` — 2026-10-25)
- **Thuật toán chuẩn:** `recruithub-scoring-mvp-v1`:
  $$\text{Skill Score} = 100 \times \frac{\text{matched\_unique\_required\_skills}}{\text{unique\_required\_skills}}$$
- **Đặc tính kỹ thuật đã xác minh:**
  - Case-insensitivity, whitespace trimming và canonical deduplication hoạt động chính xác.
  - Optional skills không bao giờ cộng điểm và không xuất hiện trong `matched_skills`.
  - Candidate thiếu availability hoặc `UNAVAILABLE`: Trả `score: null`, tạo analysis `INCOMPLETE`, omit `total_score` và recommendation.
  - Job thiếu required skills hợp lệ: Báo lỗi `EMPTY_JOB_REQUIRED_SKILLS`, `score: null`, analysis `INCOMPLETE`.
  - Tính điểm độc lập thứ tự mảng (order independence) và tương thích định dạng `{ name, normalized }`.
- **Known Limitation `UN-02`:**
  - *Mô tả:* Tại 2 guard clauses kiểm tra availability ở đầu hàm `calculateSkillScore()`, biến `diagnostics.required_count` nhận `rawJobRequiredSkills.length` thay vì canonical count sau deduplication.
  - *Quyết định TV3:* **`ACCEPTED_KNOWN_LIMITATION`** (không sửa mã nguồn production, không coi là bug fixed).
  - *Cảnh báo bắt buộc:* Module UI UC14 (Breakdown Drawer) không được hiển thị hoặc phụ thuộc vào `diagnostics.required_count` khi `analysis_status === 'INCOMPLETE'`.
- **Minh chứng:** Focused suite PASS 63/63; Targeted regression PASS 133/133 (+222 dòng test tại [backend/tests/data/resume-scoring.test.js](file:///e:/University/NoSQL/recruithub-nosql/backend/tests/data/resume-scoring.test.js#L85-L306)); zero production code change; CouchDB writes = 0.

---

## 8. Nhật ký Quyết định & Rào cản mở (Decisions & Open Blockers)

### Quyết định kỹ thuật đang áp dụng
| ID | Nội dung quyết định | Phạm vi & Hướng xử lý | Trạng thái |
|---|---|---|:---:|
| **DEC-UN02** | UN-02 chấp nhận là Known Limitation cho MVP v1 | Không sửa production scoring engine; bảo lưu cảnh báo cho UC14 Drawer. | **ACCEPTED** |
| **DEC-LEGACY** | Legacy Resume Analyses thiếu `input_context` trong CouchDB | Xem là `schema-compatible` nhưng `metadata-incomplete`; giữ nguyên tính tương thích, chưa migration. | **OPEN** |
| **INT-UC22** | ApplicationService runtime scoring integration contract | Đã hiện thực hóa đầy đủ: nạp & validate Candidate/Job/Application, scoring evaluator, CouchDB upsert, 409 conflict retry, và manual compute API. | **COMPLETED** |

### Rào cản ngoại vi được bảo toàn (Retained External Blockers)
1. **ETL Test Blockers:** 4 subtests trong `backend/tests/etl/` thất bại do môi trường Windows thiếu alias lệnh `python` (chỉ có `python3`) và thiếu artifacts `DATA-02B.2_*`.
2. **Broader Test Suite History:** Kết quả kiểm thử toàn hệ thống giữ nguyên mức **PASS 113/118, FAIL 5** (gồm 4 lỗi ETL và 1 lỗi parent-suite ngoại vi). Không tuyên bố full backend suite đã PASS.
3. **Cơ sở dữ liệu CouchDB:** 25.750 documents NoSQL trong `recruitment_db` không bị can thiệp; chưa thực hiện recompute hay database migration.
4. **Git Provenance:** Commit HEAD `a87bbb11fcb1aa9f9dacd4206a18d1ae606312b9` (`feat(scoring): complete UC19 resume normalization`) đã xác minh metadata; quyết định phê duyệt nguồn gốc chính thức giữ độc lập.
5. **Raw TAP Reconciliation:** Bước nhảy test từ 125 lên 133 khối kiểm thử (+8 test blocks) đã được giải trình qua phân tích tĩnh; việc đối soát raw TAP output tiếp tục giữ ở mức `NEEDS_VERIFICATION`.

---

## 9. Mẫu phiên làm việc & Giao việc (Templates cho UC tiếp theo)

### Mẫu giao việc (`prompt.xml`)
```xml
<prompt>
  <goal>TV3-[TASK-ID] / UC21: Audit & Verify Experience/Education/Project Scoring</goal>
  <context>
    Đọc AGENTS.md, AGENTS.local.md, resume-scoring-design.md, resume-scoring.utils.js.
    Bám sát approved scoring contract: Experience 25%, Education 10%, Project 15%.
  </context>
  <scope>
    Chỉ đọc/sửa: backend/tests/data/resume-scoring.test.js (hoặc file được chỉ định).
    Ngoài scope: Không sửa production utils/schemas nếu chưa có phê duyệt; không chạm CouchDB.
  </scope>
  <hardRules>
    Zero CouchDB mutation; thin controller; deterministic scoring; tuân thủ Approval Gate.
  </hardRules>
  <tasks>
    1. Preflight & Mini Plan.
    2. Audit / Targeted verification.
    3. Self-review & Report.
  </tasks>
  <acceptanceCriteria>
    Automated tests PASS; không hồi quy UC19/UC20; báo cáo minh bạch.
  </acceptanceCriteria>
</prompt>
```

### Mẫu nhật ký phiên ngắn gọn (Session Log Entry Template)
```markdown
### TV3-YYYYMMDD-NN
- **Task / UC:** `TV3-... / UC...`
- **Mục tiêu:** ...
- **Trạng thái Git đầu phiên:** Branch `...`, HEAD `...`, working tree sạch/diff.
- **Files thay đổi:** ...
- **Kiểm thử thực tế:** `PASS .../...` (ghi rõ lệnh và phạm vi).
- **Quyết định / Hạn chế phát sinh:** ...
- **Trạng thái:** `COMPLETED` / `IN_REVIEW` (chờ TV3 nghiệm thu).
```

---

## 10. Hồ sơ Đóng Kỹ thuật TV3 — UC21 Component Scoring (DONE — 2026-10-25)

### 10.1. Quyết định Nghiệm thu Đóng UC21 (Closure Decision)
- **Task ID:** `TV3-UC21-CLOSE-APPEND`
- **Use Case:** UC21 — Profile Component Scoring (`recruithub-scoring-mvp-v1`)
- **Phạm vi kỹ thuật:** `ACCEPTED` (Nghiệm thu thuần túy cho phạm vi pure component scoring của ba thành phần Experience EXP-A, Education EDU-B, Project PROJ-A; không bao gồm UC22 runtime integration hay UC15 ranking).
- **Trạng thái đóng:** `DONE` (Theo quyết định phê duyệt chính thức của TV3 ngày 2026-10-25).
- **Owner:** `TV3` (Nhóm 8).

### 10.2. Kết quả Kỹ thuật Thực tế (Technical Deliverables)
- **Tái sử dụng mã nguồn Production:** Tái sử dụng 100% engine hiện hữu trong `backend/src/utils/resume-scoring.utils.js`, không sửa đổi bất kỳ dòng code production hay schema nào.
- **Bổ sung kiểm thử tự động:** Bổ sung tổng cộng 25 focused subtests (+493 dòng test) tại `backend/tests/data/resume-scoring.test.js` qua 2 giai đoạn:
  - `TV3-UC21-002` (+314 dòng): 13 subtests về numeric integrity, availability tại `NO_MINIMUM`/`NO_REQUIREMENT`, unknown education evidence. (Focused: 14/14 PASS; Single-file: 77/77 PASS — *historical*).
  - `TV3-UC21-003` (+179 dòng): 12 subtests về degree aliases (`bsc`, `mba`), degree rank selection, project technology deduplication, missing project evidence, synthetic provenance. (Focused: 13/13 PASS; Single-file: 90/90 PASS — *historical*).
- **Độ phủ Test Gaps:** Đã hoàn tất đối chiếu và phủ kiểm thử thành công cho **19/19 original test gaps** từ audit `TV3-UC21-001` (0 gap còn tồn đọng).
- **Quy tắc tính điểm Education:** Ứng viên `NONE_DECLARED` + Job `REQUIRED` trả component score 0 hợp lệ; kết quả này không tự chứng minh toàn bộ Resume Analysis là `COMPLETE` (trạng thái COMPLETE của hồ sơ phụ thuộc vào tính đầy đủ của tất cả các component scores khác).
- **Bảo toàn hồi quy đơn file (Historical Evidence):** Đạt `90 / 90 PASS` trên `backend/tests/data/resume-scoring.test.js`, bảo toàn 100% các tests đã nghiệm thu của UC19, UC20 và DATA-03.4A. Đây là bằng chứng kiểm thử trên file đơn lẻ, không phải full-backend PASS.

### 10.3. Quyết định Kỹ thuật về Giới hạn Phòng vệ EXP-A (Accepted Limitation)
- **Decision ID:** `DEC-UC21-EXP-DID-01`
- **Trạng thái:** `ACCEPTED_KNOWN_LIMITATION` (Không ghi nhận là `FIXED` hay `RESOLVED`).
- **Nội dung quyết định:** TV3 chính thức phê duyệt chấp nhận giới hạn kỹ thuật của pure scorer `calculateExperienceScore()` cho phiên bản MVP v1:
  - Khi được gọi trực tiếp bằng mock data mà không qua schema validation, pure scorer chưa có `Number.isFinite()` và `Number.isInteger()`, dẫn đến việc `NaN` trả về `score: NaN`, `Infinity` trả về 0 hoặc 100, và số thập phân được tính theo tỷ lệ liên tục.
  - Phân loại đường đi: `DIRECT_UNVALIDATED_TEST_INVOCATION`.
  - Các upstream Zod schemas ([jobExperienceRequirementSchema](file:///E:/University/NoSQL/recruithub-nosql/backend/src/schemas/job.schema.js) và [candidateProfileSchema](file:///E:/University/NoSQL/recruithub-nosql/backend/src/schemas/candidate.schema.js)) được xác minh là từ chối `NaN`, `Infinity`, số âm và số thập phân trong phạm vi đã kiểm thử. Kết quả này không tuyên bố toàn bộ runtime scoring callers trong tương lai đều đã được bảo vệ.
  - Không thực hiện production fix trong phạm vi UC21 để bảo đảm an toàn hồi quy.

### 10.4. Điều kiện Bắt buộc Chuyển giao sang UC22 (Mandatory UC22 Handoff)
- **Ràng buộc Kiến trúc Tích hợp:** Khi hiện thực hóa `ApplicationService.analyzeApplication()` trong UC22, đường đi runtime scoring bắt buộc phải thực hiện parse dữ liệu Candidate và Job tải từ CouchDB thông qua:
  - `parseStored(candidateDocumentSchema, candidateDocument)`
  - `parseStored(jobDocumentSchema, jobDocument)`
- **Quy tắc An toàn:**
  - Không được giả định tài liệu lấy từ CouchDB đã mặc nhiên hợp lệ.
  - Tuyệt đối không được bypass schema validation bằng cách truyền raw unvalidated documents vào evaluator/scoring engine.
  - UC22 phải bổ sung kiểm thử cho các trường hợp dữ liệu invalid, missing, stale và legacy inputs.
- **Phân định Trách nhiệm Mô-đun (Lịch sử UC21):**
  - *Ghi chú lịch sử tại thời điểm đóng UC21:* UC22 từng ở trạng thái `PLANNED` (sau đó đã được triển khai hoàn tất và nghiệm thu đóng chính thức ngày 2026-10-25).
  - UC15 phụ trách logic Ranking ứng viên (Deterministic Ranking Table).
  - UC14 phụ trách hiển thị Match Score Badge và Breakdown Drawer trên giao diện Recruiter.

### 10.5. Các Rào cản Ngoại vi Được Bảo toàn (Preserved Blockers)
1. **UC20 UN-02:** `diagnostics.required_count` dùng độ dài thô trong guard clauses tiếp tục là `ACCEPTED_KNOWN_LIMITATION`.
2. **Multi-File Targeted Regression:** Tiếp tục ghi nhận trạng thái `NOT_RUN — EXACT_SCOPE_NOT_VERIFIED` (chưa chạy lại danh mục 7 files in-memory lịch sử).
3. **Broader Backend Suite History:** Giữ nguyên mức lịch sử **PASS 113/118, FAIL 5** (gồm 4 lỗi ETL và 1 lỗi parent-suite ngoại vi); không bỏ qua bất kỳ lỗi nào.
4. **Cơ sở dữ liệu CouchDB:** Số liệu khoảng 25.750 documents trong `recruitment_db` là dữ liệu lịch sử, chưa có fresh verification về số lượng hoặc tính toàn vẹn.
5. **Legacy Analyses:** Các bản ghi `resume_analysis` cũ thiếu `input_context` vẫn giữ tương thích schema.
6. **ApplicationService Stub (Lịch sử UC21):** `analysis_status = 'NOT_ANALYZED'` từng được chuyển giao nguyên trạng sang UC22 (đã được giải quyết triệt để tại runtime trong UC22).

### 10.6. Trạng thái Quản lý Git
- `AGENTS.local.md` tiếp tục được duy trì là file untracked theo chủ đích quản lý của TV3.
- Thay đổi +493 dòng test tại `backend/tests/data/resume-scoring.test.js` thuộc quyền quản lý Git trực tiếp của TV3.
- Không thực hiện bất kỳ lệnh Git commit, push hay mutation nào trong task này.

---

## 11. Hồ sơ Đóng Kỹ thuật TV3 — UC22 Overall & Runtime Scoring (DONE — 2026-10-25)

### 11.1. Quyết định Nghiệm thu Đóng UC22 (Closure Decision)
- **Task ID:** `TV3-UC22-CLOSE`
- **Use Case:** UC22 — Overall Resume Scoring & Runtime Integration (`recruithub-scoring-mvp-v1`)
- **Trạng thái Use Case:** **`DONE`** (Planner đã review độc lập và chính thức phê duyệt nghiệm thu đóng UC22 ngày 2026-10-25).
- **Các Task con đã hoàn tất:**
  - `TV3-UC22-001 — DONE`: Xây dựng `ResumeScoringService` độc lập.
  - `TV3-UC22-001-REVIEW-FIX — DONE`: Thêm bước kiểm tra toàn diện existing analysis trước khi trích xuất `_rev`.
  - `TV3-UC22-002 — DONE`: Tích hợp runtime scoring vào luồng `ApplicationService.create()` và `.dto()`.
  - `TV3-UC22-002-REVIEW-FIX — DONE`: Thiết lập ranh giới tin cậy, đọc trạng thái phân tích từ persisted document qua `getAnalysisSummary()`.
  - `TV3-UC22-003 — DONE`: Triển khai Manual Compute API `POST /api/v1/resume-analysis/compute`.
  - `TV3-UC22-004 — DONE`: Final verification 16 invariants, targeted test suite, baseline audit và ledger update (Planner ACCEPTED).
  - `TV3-UC22-CLOSE — DONE`: Đồng bộ sổ cái, xác nhận quy tắc unrounded score và hoàn tất hồ sơ đóng chính thức.

### 11.2. Kết quả Xác minh 16 Bất biến Nghiệp vụ (16 Invariant Audit Matrix)
1. **Công thức trọng số 50/25/10/15:** Đảm bảo 100% tuân thủ `SCORING_WEIGHTS` (Skill 50%, Experience 25%, Education 10%, Project 15%) theo thuật toán chuẩn `recruithub-scoring-mvp-v1`.
2. **Không có `match_score` trong Application:** Application schema và document lưu trữ hoàn toàn không chứa `match_score`, `analysis_status` hay `analysis_fresh`.
3. **COMPLETE/INCOMPLETE đúng invariant & Quy tắc Điểm số Chưa Làm tròn (Unrounded Score Rule):** Hồ sơ `COMPLETE` luôn có `total_score` (số) và `recommendation` (`HIGH` / `MEDIUM` / `LOW`), `missing_inputs` bị loại bỏ; hồ sơ `INCOMPLETE` tuyệt đối không có `total_score` hay `recommendation`, và bắt buộc có danh sách `missing_inputs` không rỗng.  
   **Xác nhận quy tắc điểm số chưa làm tròn (Unrounded Score Rule):** `total_score` và toàn bộ component scores được lưu trữ (persist), so sánh ngưỡng xếp loại `recommendation` và sử dụng cho thuật toán xếp hạng ứng viên (UC15) hoàn toàn bằng giá trị số thực chưa làm tròn (unrounded raw values). Việc làm tròn điểm số chỉ được thực hiện tại tầng giao diện hiển thị (UI/display - UC14); tuyệt đối không lưu trữ `total_score` đã làm tròn 2 chữ số vào database.
4. **Input documents được parse trước scoring:** Toàn bộ Candidate, Job và Application đều được nạp và parse nghiêm ngặt qua Zod `parseStored()` trước khi đưa vào hàm tính điểm `evaluateResumeAnalysis()`.
5. **Existing analysis được validate trước khi lấy `_rev`:** Kiểm tra chặt chẽ `type === 'resume_analysis'`, parse qua `resumeAnalysisDocumentSchema`, và đối chiếu `application_id`, `candidate_id`, `job_id`. Nếu sai lệch hoặc hỏng, từ chối với 409 CONFLICT, không ghi đè `_rev`.
6. **Conflict retry tối đa một lần và dùng fresh revision:** Khi gặp CouchDB HTTP 409, service thực hiện đọc lại fresh, re-evaluate lại điểm số, nạp `_rev` mới nhất và retry đúng một lần. Nếu tiếp tục conflict thì trả controlled 409.
7. **Apply failure không rollback Application:** Khi nộp hồ sơ ứng tuyển thành công, nếu hook chấm điểm hoặc lưu analysis thất bại, Application document vẫn được bảo toàn nguyên vẹn trong cơ sở dữ liệu, trả về HTTP 201 với `analysis_status: 'PENDING_RETRY'`.
8. **Apply response không tin trực tiếp object trả từ hook:** Response của `ApplicationService.create()` chỉ tin cậy kết quả đọc từ persisted document thông qua `getAnalysisSummary()`. Nếu hook trả dữ liệu giả lập nhưng không persist, hệ thống trả về `REQUESTED` và `analysis_fresh: false`.
9. **DTO xác định freshness từ persisted analysis:** `ApplicationService.dto()` xác định `analysis_status` và tính toán `analysis_fresh` thông qua đối chiếu fingerprint của Candidate và Job hiện tại với `input_fingerprint` đã lưu.
10. **Manual API có Zod validation:** Payload `POST /api/v1/resume-analysis/compute` được kiểm thực nghiêm ngặt bằng `computeScoringRequestSchema`, bắt buộc format `application:pair:<64 hex>` và từ chối mọi trường không xác định (`.strict()`).
11. **Manual API chỉ dành cho Recruiter:** Middleware `requireRoles('RECRUITER')` bảo vệ endpoint, từ chối mọi truy cập trái phép.
12. **Recruiter ownership được kiểm tra trước scoring:** Controller kiểm tra quyền sở hữu tin tuyển dụng (`ownedJob()`) trước khi tiến hành chấm điểm hoặc đọc dữ liệu nhạy cảm.
13. **Candidate, Admin và Recruiter khác không thể compute:** Mọi role khác hoặc recruiter không quản lý job đều nhận HTTP 403 FORBIDDEN.
14. **Không có frontend hoặc ranking triển khai ngoài scope:** Không chỉnh sửa bất kỳ file nào trong `frontend/` (UC14); không triển khai ranking board hay API xếp hạng (UC15).
15. **Không có secret, token, email hoặc CV bị log:** Toàn bộ code UC22 không có `console.log`; không để lộ thông tin nhạy cảm ra log hoặc response.
16. **Không có mutation đối với dữ liệu CouchDB thật:** Toàn bộ kiểm thử runtime và API sử dụng `MemoryRepository`. 25.750 documents trong `recruitment_db` không bị sửa đổi (0 writes).

### 11.3. Danh mục Tệp UC22 Hoàn chỉnh (File Deliverables)
- **Tệp đã chỉnh sửa (Tracked):**
  - [backend/src/app.js](file:///e:/University/NoSQL/recruithub-nosql/backend/src/app.js): Khởi tạo và wire `ResumeScoringService`, mount route `/api/v1/resume-analysis`.
  - [backend/src/services/application.service.js](file:///e:/University/NoSQL/recruithub-nosql/backend/src/services/application.service.js): Tích hợp runtime hook sau Apply, đọc summary từ persisted document, bổ sung freshness cho DTO.
  - [backend/tests/recruitment/job-application-api.test.js](file:///e:/University/NoSQL/recruithub-nosql/backend/tests/recruitment/job-application-api.test.js): Bổ sung Vectors 01-14 và Review tests kiểm chứng luồng Apply tích hợp scoring.
- **Tệp mới tạo (Untracked):**
  - [backend/src/services/scoring/resume-scoring.service.js](file:///e:/University/NoSQL/recruithub-nosql/backend/src/services/scoring/resume-scoring.service.js): Service chấm điểm runtime, validate input/existing doc, conflict retry, freshness derivation.
  - [backend/src/schemas/scoring-request.schema.js](file:///e:/University/NoSQL/recruithub-nosql/backend/src/schemas/scoring-request.schema.js): Zod schema cho manual compute request payload.
  - [backend/src/controllers/scoring.controller.js](file:///e:/University/NoSQL/recruithub-nosql/backend/src/controllers/scoring.controller.js): Controller xử lý HTTP request tính điểm.
  - [backend/src/routes/scoring.routes.js](file:///e:/University/NoSQL/recruithub-nosql/backend/src/routes/scoring.routes.js): Express router cho scoring API.
  - [backend/tests/recruitment/resume-scoring-runtime.test.js](file:///e:/University/NoSQL/recruithub-nosql/backend/tests/recruitment/resume-scoring-runtime.test.js): 28 unit/integration tests cho service runtime và conflict handling.
  - [backend/tests/recruitment/resume-scoring-api.test.js](file:///e:/University/NoSQL/recruithub-nosql/backend/tests/recruitment/resume-scoring-api.test.js): 17 integration tests phủ 21 test vectors cho manual compute API.
  - [AGENTS.local.md](file:///e:/University/NoSQL/recruithub-nosql/AGENTS.local.md): Sổ cái theo dõi tiến độ, bằng chứng và rào cản kỹ thuật của TV3.

### 11.4. Bằng chứng Kiểm thử Thực tế (Test Evidence Matrix)
- **Kiểm tra cú pháp (Syntax Check):** PASS 6/6 tệp (`resume-scoring.service.js`, `application.service.js`, `scoring.controller.js`, `scoring.routes.js`, `scoring-request.schema.js`, `app.js`).
- **Targeted Test Suites:**
  - `node --test tests/recruitment/resume-scoring-runtime.test.js`: **PASS 28/28**
  - `node --test tests/recruitment/resume-scoring-api.test.js`: **PASS 17/17** (phủ trọn vẹn 21 test vectors)
  - `node --test tests/recruitment/job-application-api.test.js`: **PASS 38/38**
  - `node --test tests/data/resume-scoring.test.js`: **PASS 90/90**
  - `node --test tests/data/resume-analysis.schema.test.js`: **PASS 16/16**
- **Recruitment Regression Suite:**
  - Lệnh: `npm run test:recruitment`
  - Kết quả: **PASS 107/107**, duration ~1.4s, 0 failures.
- **Tính toàn vẹn Git Diff:**
  - `git diff --check`: PASS (0 warnings, không có lỗi whitespace hay conflict markers).

### 11.5. Phân tích Baseline Toàn bộ Backend (`npm test`)
- Lệnh: `npm test`
- Kết quả tổng quát: **Tổng 415 tests; PASS 391; FAIL 24; Suites 2**.
- **Phân loại nguyên nhân lỗi:**
  1. *Hồi quy do UC22:* **0 lỗi** (Tất cả 107 tests recruitment và 106 tests scoring/schema đều PASS 100%).
  2. *Lỗi do môi trường & dataset lịch sử (ETL & Offline Generators):* **24 lỗi** tập trung hoàn toàn trong 6 tệp kiểm thử tại `tests/data/`:
     - `couchdb-import.test.js` (2 lỗi): Yêu cầu active CouchDB connection hoặc release files hoàn chỉnh.
     - `etl-negative.test.js` (4 lỗi): Yêu cầu raw source files và dataset staging artifacts.
     - `etl.test.js` (2 lỗi): Yêu cầu dataset staging parquet/jsonl.
     - `foundation-generator.test.js` (5 lỗi): Offline batch generator kiểm tra 23.000 documents sinh ra.
     - `recruitment-generator.test.js` (1 lỗi): Generator kiểm tra 25.750 documents lịch sử.
     - `resume-analysis-generator.test.js` (4 lỗi): Offline batch generator kiểm tra toàn bộ corpus phân tích.
  - **Khẳng định nguyên tắc:** Không tuyên bố full backend PASS; các lỗi trên thuộc về hạ tầng offline dataset/ETL từ Phase 1 và hoàn toàn nằm ngoài phạm vi UC22.

### 11.6. Xác nhận Bảo toàn và Quyết định Đóng Chính thức (Preserved State & Official Closure)
- Tiếp tục bảo toàn các quyết định kỹ thuật: **DEC-UN02**, **DEC-UC21-EXP-DID-01**, **DEC-LEGACY**.
- Xác nhận số lần ghi vào CouchDB thật: **0 mutations** (Database `recruitment_db` 25.750 documents giữ nguyên vẹn 100%).
- Không tuyên bố full backend suite PASS; 24 test failures lịch sử Phase 1 ETL/parquet được giữ nguyên ranh giới ngoài UC22.
- **Quyết định đóng chính thức:** **TV3-UC22-CLOSE — UC22 chính thức ĐÓNG (DONE) theo quyết định nghiệm thu của Planner ngày 2026-10-25**.

---

## 12. Hồ sơ Đóng Kỹ thuật TV3 — UC14 Match Score Display (DONE — 2026-10-26)

### 12.1. Phạm vi đã nghiệm thu
- Backend cung cấp `GET /api/v1/resume-analysis/:applicationId` chỉ cho Recruiter sở hữu Job, validate route params bằng Zod và trả safe DTO không chứa `_rev`, fingerprint, raw provenance, email hoặc CV.
- Applicant DTO chỉ trả `analysis_total_score` và `analysis_recommendation` cho Recruiter khi analysis `COMPLETE` và fresh; không persist/mirror score vào Application.
- Frontend có `scoringApi`, `MatchScoreBadge` và `ScoreBreakdownDrawer`; hỗ trợ `NOT_ANALYZED`, `INCOMPLETE`, stale, `COMPLETE`, loading và error.
- Manual recompute chống double-submit, đọc lại safe detail DTO và refresh danh sách applicants.
- Drawer dùng đúng trọng số Skill 50%, Experience 25%, Education 10%, Project 15%; chỉ làm tròn tại UI; không triển khai ranking/sorting UC15.

### 12.2. Rào cản bảo mật và dữ liệu
- RBAC và Job ownership được kiểm tra trước khi trả Candidate/Analysis detail; Candidate, Admin và Recruiter khác chủ sở hữu bị từ chối.
- `missing_inputs` dùng đúng contract object `{ component, code, message }`; không hiển thị/phụ thuộc `diagnostics.required_count`.
- Legacy analysis thiếu toàn bộ `input_context` không crash; metadata thiếu và synthetic evidence được mô tả trung tính, không khẳng định là dữ liệu quan sát thật.
- Không sửa scoring formula, Application lifecycle, `data/processed/` hoặc template docs; không ghi/migration/bulk recompute CouchDB thật.

### 12.3. Bằng chứng kiểm thử cuối
- Backend targeted: `resume-scoring-runtime` **28/28 PASS**; `resume-scoring-api` **27/27 PASS**; `job-application-api` **43/43 PASS**.
- Recruitment suite: **166/168 PASS**, 2 failure từ baseline `dev` ngoài UC14 (public CLOSED Job contract và public `company_logo_url`).
- Frontend: **177/177 PASS**; ESLint **0 errors, 1 baseline warning**; production build **PASS** với chunk-size warning.
- Full Backend: **450/476 PASS, 26 FAIL**. Không tuyên bố full suite PASS; 26 failure gồm 2 baseline recruitment từ `dev` và 24 failure import/ETL/foundation/offline dataset/resume corpus ngoài UC14.
- UC14 regression: **0**. Audit nghiệp vụ/bảo mật: **17/17 invariants PASS**. CouchDB production mutation: **0**.

### 12.4. Quyết định đóng và handoff
- **TV3-UC14-CLOSE — ACCEPTED / DONE** theo review độc lập của Planner ngày 2026-10-26.
- Bảo toàn `DEC-UN02`, `DEC-UC21-EXP-DID-01`, `DEC-LEGACY` và quy tắc dùng điểm chưa làm tròn cho nghiệp vụ.
- Bước tiếp theo đề xuất: **UC15 — Candidate Ranking & Deterministic Tie-breaking**, nhánh dự kiến `feature/tv3-uc15-candidate-ranking`.

---

## 13. Hồ sơ Đóng Kỹ thuật TV3 — UC15 Deterministic Candidate Ranking (DONE — 2026-10-26)

### 13.1. Phạm vi đã nghiệm thu
- Ranking chỉ nhận Application thuộc đúng Job do Recruiter đăng nhập sở hữu, ở active stage `APPLIED`, `SCREENING`, `INTERVIEW` hoặc `OFFER`, có Resume Analysis `COMPLETE`, fresh và đúng toàn bộ cross-document references.
- Thứ tự xác định dùng giá trị chưa làm tròn: `total_score DESC` → `scores.skill DESC` → `applied_at ASC` → `application._id ASC`; rank được gán toàn cục trước numeric pagination và không được persist vào Application/Resume Analysis.
- Repository đọc toàn bộ Application pages có kiểm tra pagination progress, sau đó batch-load Candidate và Resume Analysis bằng `_all_docs`/`getMany`; repository contract sai trả controlled `503`, không tạo empty ranking giả.
- API `GET /api/v1/jobs/:id/applicant-ranking` có strict query `{ page, limit }`, Recruiter RBAC, Job ownership và safe allowlist DTO; excluded applicants chỉ xuất hiện dưới dạng aggregate counts, không lộ ID.
- Applicants page có chế độ ranking responsive, đầy đủ loading/empty/error/success, giữ nguyên server order/global rank, mở lại UC14 Score Breakdown Drawer và refetch đúng current page sau recompute.
- Frontend generation guard loại stale response/error/loading ownership khi đổi Job hoặc request; Drawer không unmount/remount trong delayed ranking refetch.

### 13.2. Rào cản bảo mật và nghiệp vụ
- Candidate, Admin, anonymous và Recruiter không sở hữu Job không thể đọc ranking; ownership được kiểm tra trước collection reads.
- DTO không chứa email, phone, CV, submission, stage history, `_rev`, fingerprint, provenance hoặc raw analysis document.
- `INCOMPLETE`, `NOT_ANALYZED`, stale, invalid/mismatched documents và terminal stages `HIRED`, `REJECTED`, `WITHDRAWN` đều bị controlled exclusion, không được đưa xuống cuối bảng như ứng viên hợp lệ.
- Không thay đổi scoring formula 50/25/10/15, không dùng Domain 20%, không gộp Interview Result vào Resume Match Score và không thay đổi Application lifecycle.
- Không ghi/migration/bulk recompute CouchDB thật; số mutation production trong UC15 là 0.

### 13.3. Bằng chứng kiểm thử cuối
- Backend UC15 targeted: **68/68 PASS**.
- Backend UC14/Application regression: **98/98 PASS**.
- Recruitment suite: **234/236 PASS**; 2 failure baseline ngoài UC15 gồm Public CLOSED Job contract và public detail thiếu `company_logo_url`.
- Frontend UC15 targeted: **33/33 PASS**; UC14/Application UI regression: **38/38 PASS**; full Frontend: **210/210 PASS**.
- Full Backend: **518/544 PASS, 26 FAIL**; 26 failure đều thuộc baseline recruitment/import/ETL/foundation/dataset/resume corpus, **0 UC15 regression**.
- Syntax và scoped whitespace checks PASS sau `TV3-UC15-004-FIX-01`; không tuyên bố full Backend PASS.

### 13.4. Quyết định đóng và handoff
- **TV3-UC15-CLOSE — ACCEPTED / DONE** theo review độc lập của Planner ngày 2026-10-26.
- Bảo toàn `DEC-UN02`, `DEC-UC21-EXP-DID-01`, `DEC-LEGACY`, raw unrounded ranking rule và bốn tầng deterministic tie-break.
- Commit đề xuất: `feat(ranking): add deterministic candidate ranking`; chỉ stage 15 file UC15 đã được liệt kê trong closure handoff, không stage các user-owned files.
- Bước tiếp theo: **UC17 — Interview Scheduling**, nhánh dự kiến `feature/tv3-uc17-interview-scheduling`; Git gate phải xác minh commit UC15 có trong lịch sử trước khi audit.

## 14. Hồ sơ kỹ thuật UC17 — Interview Scheduling (2026-11-12)

**TV3-UC17-002: ACCEPTED / DONE.** Người dùng xác nhận nghiệm thu ngày 2026-11-12.

### Phạm vi đã triển khai

- `GET /api/v1/interviews?application_id=…` và `POST /api/v1/interviews` dùng Auth, Recruiter role gate và quyền trên Job. `POST` trả 201 khi tạo mới, 200 khi retry cùng nội dung và 409 khi trùng vòng với nội dung khác.
- Schema xác thực ngày lịch và offset trước khi chuẩn hóa UTC. Client gửi bốn trường theo hợp đồng. Người phỏng vấn do service suy ra từ Recruiter được xác thực.
- Chi tiết ứng viên ở stage `INTERVIEW` hiển thị lịch của lượt hiện tại và form cho vòng kế tiếp. Form ghi rõ UTC+7, giữ dữ liệu để retry, khóa gửi trùng và bỏ qua phản hồi của form đã unmount.

### Kết quả theo AC

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| UC17-AC01 | PASS | Edge build thật tạo lịch qua API, đọc lại sau reload và đối chiếu CouchDB. |
| UC17-AC02 | PASS | HTTP kiểm tra 401/403 cho khách, Candidate, Admin và Recruiter ngoài phạm vi. |
| UC17-AC03 | PASS | HTTP từ chối ngày không tồn tại, thiếu offset và trường server quản lý. Thời gian hợp lệ được lưu UTC. |
| UC17-AC04 | PASS | Runtime test cô lập lượt ứng tuyển. HTTP kiểm tra thứ tự, vòng kế tiếp, vòng nhảy cóc và thời gian trước khi vào stage. |
| UC17-AC05 | PASS | HTTP đồng thời trả 201/200, payload khác trả 409. Edge bỏ phản hồi 201 rồi retry 200 với một document. |
| UC17-AC06 | PASS | Runner đưa lỗi 503 vào lần ghi Interview. CouchDB giữ hồ sơ ở INTERVIEW, chưa có lịch và form cho phép thử lại. |
| UC17-AC07 | PASS | Vitest kiểm tra lỗi, retry, xung đột và response đến muộn khi đổi hồ sơ. Edge xác minh khóa submit khi giữ phản hồi thật. |
| UC17-AC08 | PASS phần UC17; toàn bộ backend FAIL baseline | 158/158 backend mục tiêu. Frontend 207/207 Vitest và Node tests đạt. Lint exit 0 với một cảnh báo có sẵn ở App.jsx. Build và Edge/CouchDB exit 0. Backend toàn repo 551 pass, 28 fail; baseline trước task 549 pass, cùng 28 fail. |

Runner: `scripts/ui/verify-interview-scheduling.mjs`. Bản build kiểm thử dùng `VITE_API_BASE_URL=/api`. Browser chạy Edge desktop 1440 px và mobile 390 px; dialog mobile không tràn ngang. Evidence cuối gồm `RESULT.json`, `desktop-schedule.png` và `mobile-schedule.png` trong thư mục bàn giao `outputs/TV3-UC17-002` của chat. CouchDB cô lập dùng dữ liệu giả lập.

**Giới hạn:** Chưa nghiệm thu trên `dev`, trình duyệt khác hoặc môi trường triển khai. Các thay đổi UC17 đang ở working tree, với trạng thái staged/unstaged sẵn có. Bàn giao sang UC18 theo kế hoạch ở §15.

## 15. Kế hoạch UC18 — Interview Feedback & Results (2026-11-12)

Chia thành `TV3-UC18-001` cho API và `TV3-UC18-002` cho giao diện và kiểm thử xuyên suốt. Nhánh `feature/tv3-uc18-interview-feedback` được tạo từ nhánh UC17 với toàn bộ thay đổi UC17 vẫn có trong working tree.

- **Hợp đồng đề xuất:** Nhận rating 1–5, bằng chứng văn bản và kết quả do Recruiter chọn. Lưu trong các trường `score` (rating × 20), `feedback`, `result` và `completed_at` hiện có. Backend tự đặt thời điểm và chỉ cho hoàn tất từ giờ đã lên lịch.
- **Quyền và tính nhất quán:** Recruiter phải có quyền trên Job, hồ sơ ở `INTERVIEW`, vòng thuộc lượt ứng tuyển hiện tại. Ghi một document Interview bằng revision hiện hành. Retry cùng dữ liệu trả kết quả đã lưu; nội dung khác sau khi hoàn tất trả xung đột. Dữ liệu cũ tiếp tục đọc được.
- **Giao diện và OFFER:** Ghi đánh giá ngay tại vòng đã lên lịch, hiển thị điểm, kết quả và bằng chứng sau khi lưu. Tải lại điều kiện gửi đề nghị từ API. Recruiter chuyển stage qua luồng hiện có.
- **Nghiệm thu:** API, UI và Edge/CouchDB cô lập kiểm tra hai kết quả, dữ liệu sai, sai quyền/lượt, vòng chưa tới giờ, retry, concurrent write, tải lại, và OFFER khi còn vòng chưa hoàn tất. Đối chiếu baseline backend và ghi bằng chứng trước khi cập nhật trạng thái.

### 15.1. Kết quả kỹ thuật TV3-UC18-001

**ACCEPTED / DONE.** Người dùng nghiệm thu ngày 2026-11-12. `PUT /api/v1/interviews/:id/feedback` hoàn tất đánh giá một vòng. `GET /api/v1/interviews/feedback?application_id=…` trả danh sách `PENDING`/`COMPLETED` theo vòng của lượt hiện tại. Rating 1–5 quy đổi sang điểm 20–100, bằng chứng được trim và giới hạn 2.000 ký tự. Kết quả `FAILED` tuân theo điều kiện OFFER hiện hành.

| AC | Kết quả | Bằng chứng |
|---|---|---|
| 001-AC01 | PASS | HTTP ghi và đọc PASSED/FAILED, kiểm tra nội dung và thời điểm đã lưu. |
| 001-AC02 | PASS | HTTP kiểm tra 1→20, 5→100, payload sai và đồng hồ ngay trước/đúng giờ lịch. |
| 001-AC03 | PASS | HTTP 401/403/404 và runtime kiểm tra stage, tham chiếu và lượt cũ. Ca bị từ chối giữ nguyên document. |
| 001-AC04 | PASS | Hai writer cùng revision cho một lần ghi. Retry cùng dữ liệu giữ timestamp; kết quả khác trả 409. Có ca lỗi ghi 503. |
| 001-AC05 | PASS | Test HTTP xác minh UC17 và Candidate DTO, runtime đọc nguyên điểm lịch sử 73/100. |
| 001-AC06 | PASS | OFFER bị chặn khi còn vòng chờ. Sau khi hoàn tất đủ vòng, Recruiter chuyển OFFER qua API hiện có. |
| 001-AC07 | PASS phần hồi quy UC18 | 6/6 ca UC18 mới; 172/172 ca mục tiêu. Full backend baseline 553 PASS / 26 FAIL, sau task 559 PASS / 26 FAIL. Đối chiếu tên TAP cho kết quả cùng tập lỗi. |

**Giới hạn:** API được kiểm thử qua Express thật với repository fixture. Chạy UI và Edge/CouchDB thuộc UC18-002. Revision chỉ bảo vệ một document, nên không có giao dịch nguyên tử giữa thay đổi stage của Application và ghi Interview. Chưa stage, commit hoặc push thay đổi UC18.

### 15.2. Kế hoạch triển khai TV3-UC18-002

**PLANNED.** Dùng API UC18 đã nghiệm thu. Nối form trong chi tiết ứng viên của Recruiter, ghép lịch và đánh giá theo ID vòng và lượt hiện tại. Khi hồ sơ còn ở `INTERVIEW`, vòng `PENDING` cho mở form 1–5 sao, bằng chứng tối đa 2.000 ký tự và Đạt/Không đạt. Vòng `COMPLETED` hiển thị dữ liệu đã lưu. Sau khi chuyển stage, tiếp tục cho đọc đánh giá của lượt hiện tại đã qua `INTERVIEW`.

- Khóa gửi trùng, giữ bản nháp sau lỗi mạng và chỉ retry khi Recruiter thao tác. Khi 409, tải trạng thái hiện tại. Hủy request hoặc bỏ qua phản hồi khi đổi hồ sơ, lượt hoặc đóng form. Sau khi lưu, tải lại danh sách vòng, chi tiết hồ sơ và danh sách ứng viên; dùng `offer_eligible` từ backend.
- Frontend tests kiểm tra validation, payload, nhiều vòng, điểm lịch sử, lỗi API, retry, conflict và response đến muộn. Chạy lại test UC17, lint, build và bộ backend mục tiêu.
- Edge/CouchDB cô lập kiểm tra luồng hai vòng, một PASSED và một FAILED. Kiểm tra trước giờ, mất phản hồi sau khi ghi thật, reload, OFFER bị chặn khi còn vòng chờ và chuyển OFFER thủ công khi đủ điều kiện. Giữ RESULT.json và ảnh desktop/mobile, dọn tài nguyên của lần chạy.

### 15.3. Kết quả kỹ thuật TV3-UC18-002

**ACCEPTED / DONE.** Người dùng nghiệm thu ngày 2026-11-12. Recruiter có thể ghi đánh giá theo từng vòng trong chi tiết ứng viên. UI ghép lịch và đánh giá theo ID vòng và lượt. Sau khi chuyển OFFER, đánh giá của lượt hiện tại hiển thị ở chế độ chỉ xem.

| AC | Kết quả | Bằng chứng |
|---|---|---|
| 002-AC01 | PASS | Edge và CouchDB xác nhận vòng 1 PASSED 80/100, vòng 2 FAILED 40/100. Điểm, bằng chứng và giờ hoàn tất đọc lại sau reload. |
| 002-AC02 | PASS | Vitest kiểm tra trường bắt buộc, payload và giới hạn bằng chứng. Edge nhận 422 trước giờ; dữ liệu form giữ nguyên và chưa hoàn tất document. |
| 002-AC03 | PASS | Edge giữ rồi bỏ phản hồi PUT thật sau khi ghi, chặn submit trùng và retry giữ nguyên revision/timestamp. Vitest kiểm tra 409 và hủy request khi đóng form. |
| 002-AC04 | PASS | Vitest kiểm tra vòng, lượt và điểm lịch sử 73/100. Edge mở lại hồ sơ sau OFFER và đọc được cả hai đánh giá. |
| 002-AC05 | PASS | OFFER khóa khi vòng 2 còn chờ và Recruiter chuyển OFFER thủ công sau khi đủ hai vòng. |
| 002-AC06 | PASS | 212/212 Vitest, 7/7 Node frontend, 172/172 backend mục tiêu. Lint exit 0 với cảnh báo có sẵn ở App.jsx. Build, Edge UC17 và Edge UC18 exit 0. |

Chạy runner `scripts/ui/verify-interview-scheduling.mjs` với `INTERVIEW_VERIFY_MODE=feedback` cho UC18. Bản build dùng `VITE_API_BASE_URL=/api`. Runner dùng đồng hồ có thể điều khiển để kiểm tra trước/đúng giờ và giữ phản hồi HTTP thật để thử retry. Đã kiểm tra ảnh desktop/mobile và dialog mobile không tràn ngang. Evidence và log trong `outputs/TV3-UC18-002` của chat. Database và container cô lập đã dọn.

**Giới hạn:** Chưa xác minh trình duyệt khác, nhánh dev hoặc môi trường triển khai. Chưa stage, commit hoặc push thay đổi UC18-002.

**Bàn giao:** Task tiếp theo theo roadmap TV3 là UC26 — Tra cứu System Logs và Audit Trail cho Admin.

## 16. TV3-UC26-002A — Hợp đồng và kho log cô lập

- Người dùng chấp thuận triển khai 002A ngày 2026-11-12. Phạm vi gồm schema sự kiện v1, DTO allowlist, kho CouchDB riêng, tra cứu nội bộ và retention. Phần producer, outbox, API và viewer chờ quyết định tương ứng của DR-017.
- Kho yêu cầu cấu hình `AUDIT_COUCHDB_URL`, `AUDIT_COUCHDB_DATABASE`, `AUDIT_COUCHDB_USER` và `AUDIT_COUCHDB_PASSWORD`. Tên kho phải bắt đầu bằng `recruithub_logs_` và khác database chính/auth đã cấu hình.
- Provision bằng `node scripts/database/provision-audit-store.mjs` với tài khoản quản trị CouchDB. Tạo trước ba tài khoản dịch vụ khác nhau và cấp tên qua `AUDIT_COUCHDB_WRITER`, `AUDIT_COUCHDB_READER` và `AUDIT_COUCHDB_PRUNER`. Các tài khoản dịch vụ đều là thành viên có quyền đọc nội bộ của kho. Design validation giới hạn thao tác tạo cho writer, thao tác xóa cho pruner và cấm sửa event đã ghi. Cấp quyền Admin ứng dụng thuộc API tra cứu sau này.
- Dùng credentials của pruner chạy `node scripts/database/prune-audit-events.mjs --dry-run` để xem số lượng và `--apply` để xóa. Retention giữ record tại mốc cắt, dọn record cũ hơn 30 ngày cho system log và 180 ngày cho audit trail. Xóa tạo tombstone CouchDB. Vòng đời backup, compaction và purge cần quyết định vận hành riêng.
- Test tích hợp bật bằng `RECRUITHUB_AUDIT_TEST_URL`, `RECRUITHUB_AUDIT_TEST_ADMIN` và `RECRUITHUB_AUDIT_TEST_PASSWORD`. Chỉ chạy trên CouchDB dùng một lần đã khởi tạo `_users`, vì test tạo database và user giả lập. Dọn toàn bộ instance sau khi test.
- Kết quả kỹ thuật ngày 2026-11-12: 3/3 ca mục tiêu đạt trên CouchDB 3.5.2.1 cô lập. Full backend sau thay đổi có 561 PASS, 26 FAIL và 1 SKIP (ca CouchDB chạy riêng), so với baseline 559 PASS và 26 FAIL. Danh sách tên ca lỗi TAP trùng baseline. Container nghiệm thu đã dọn. Trạng thái 002A: DONE qua nghiệm thu đóng UC26.

## 17. TV3-UC26-002B — Giao audit và correlation

- Người dùng duyệt triển khai middleware `X-Request-Id` và worker giao audit qua adapter. Express cấp UUID trước CORS, parse body và auth, lưu vào `req.correlationId` và expose header cho origin được phép.
- Chạy một batch bằng `node scripts/database/deliver-audit-events.mjs <source-adapter-module> [batch-size]`. Module do operator cung cấp và export `createAuditSource(environment)`. Kho đích dùng cấu hình 002A và credentials writer. Lệnh trả số đếm theo outcome, mã thoát khác 0 khi cần xử lý hoặc thử lại.
- Adapter chỉ liệt kê event đã commit và loại các mục đã cách ly. Ack hoặc cách ly phải dùng revision mới nhất và bảo toàn mục pending khác. Retry ack tối đa ba lần sau lần đầu. Điều phối lịch chạy và backoff thuộc môi trường vận hành.
- Schema outbox, adapter trên dữ liệu thật, quyền nguồn, ngưỡng backlog, xử lý mục quá tuổi retention và ảnh hưởng ETag thuộc quyết định TV1/TV2 trước khi bật 003A/003B. 002B dùng nguồn fixture để nghiệm thu worker.
- Kết quả kỹ thuật ngày 2026-11-12: 5/5 ca mới, 41/41 ca UC17/UC18 và 3/3 ca kho log trên CouchDB 3.5.2.1 cô lập, gồm chạy lại worker sau khi ghi kho thành công nhưng ack lỗi. Full backend có 566 PASS, 26 FAIL và 1 SKIP. Tên ca lỗi trùng baseline 002A. Container nghiệm thu đã dọn. Trạng thái 002B: DONE qua nghiệm thu đóng UC26.

## 18. TV3-UC26-003A — Gắn audit vào Application và Job

- Người dùng duyệt triển khai A1–A4 ngày 2026-11-12. Application ghi audit cho đổi stage, withdraw và reapply. Job ghi audit khi status đổi, gồm soft-delete thực sự chuyển sang CLOSED. Metadata lưu là `audit_outbox` tùy chọn, vì CouchDB dành tiền tố gạch dưới cho trường hệ thống. Metadata không đi ra DTO.
- Mutation và event cùng commit trong document. Giới hạn 32 mục và 32 KiB mỗi document. Khi vượt giới hạn, mutation cần audit trả `503 AUDIT_BACKLOG_FULL`. Mục pending quá 180 ngày được cách ly với mã `EVENT_RETENTION_EXPIRED` để đối soát. Mục cách ly vẫn tính vào giới hạn.
- Trước rollout, tạo tài khoản CouchDB nguồn riêng, cấp membership cho database ghi Job/Application đang cấu hình qua `AUTH_COUCHDB_DATABASE` và xác nhận worker không có quyền quản trị database. Worker có quyền đọc ở cấp database. Provision view và write guard bằng `node scripts/database/provision-job-application-audit-source.mjs` với credentials provisioner qua cấu hình CouchDB hiện có và tên worker qua `AUDIT_SOURCE_COUCHDB_USER`.
- Chạy worker bằng `node scripts/database/deliver-audit-events.mjs backend/src/repositories/job-application-audit-source.repository.js`, dùng `AUDIT_SOURCE_COUCHDB_USER` và `AUDIT_SOURCE_COUCHDB_PASSWORD` cho nguồn cùng cấu hình 002A cho sink. Guard chỉ cho worker xử lý từng mục pending và giữ các trường nghiệp vụ. Ack đổi `_rev`, nên request dùng revision cũ nhận `409` và cần tải lại.
- Kết quả kỹ thuật: 3/3 ca 003A trên CouchDB 3.5.2.1 cô lập, 112/112 ca backend mục tiêu. Full backend 568 PASS, 26 FAIL và 2 SKIP, cùng tên lỗi baseline 002B. Container test đã dọn. 003A DONE qua nghiệm thu đóng UC26.

## 19. TV3-UC26-003B — Audit khóa và mở khóa tài khoản

- Người dùng duyệt B1–B4. Admin API ghi `USER_ACCOUNT_STATUS_CHANGED` cùng lần cập nhật User cho ACTIVE ↔ LOCKED. Actor và correlation lấy từ server. Thao tác không đổi trạng thái và các nhánh bị guard từ chối giữ nguyên outbox. Ngưỡng 32 mục/32 KiB áp dụng cả thao tác khóa. Nếu đầy, xử lý backlog hoặc theo quy trình operator trước khi thử lại.
- Dùng lại lệnh provision nguồn 003A để nâng cấp design document đã biết bằng revision hiện hành. Worker vẫn dùng tài khoản riêng và chỉ được xử lý một mục pending mỗi lần. Nâng cấp design và worker phối hợp trước rollout. Dashboard tải lại User/ETag khi gặp `REVISION_CONFLICT` và chờ Admin xác nhận thao tác tiếp theo.
- Ca tích hợp mở rộng trong `backend/tests/recruitment/job-application-audit.test.js`. Bật kiểm thử Edge bằng `RECRUITHUB_AUDIT_BROWSER_BUILD` (frontend build với API base `/api`) và `RECRUITHUB_AUDIT_PLAYWRIGHT` (đường dẫn module Playwright), cùng cấu hình CouchDB test cô lập ở 002A. Đăng nhập dùng fixture, Admin API ghi User và worker chạy qua CouchDB thật.
- Kết quả kỹ thuật: 22/22 ca backend mục tiêu và 3/3 ca tích hợp có Edge/CouchDB đạt. Full backend 568 PASS, 26 FAIL, 2 SKIP, trùng tên ca lỗi baseline 003A. Auth foundation 38 PASS, 7 FAIL, trùng tên ca lỗi khi chạy từ HEAD trước 003B. Frontend 214/214 Vitest và 7/7 Node, lint/build đạt với cảnh báo có sẵn. Container nghiệm thu đã dọn. 003B DONE qua nghiệm thu đóng UC26.

## 20. TV3-UC26-004 — API tra cứu audit và system log dành cho Admin

- Người dùng duyệt triển khai hai GET `/api/v1/admin/audit-trails` và `/api/v1/admin/system-logs`. Cả hai dùng Admin guard, `Cache-Control: no-store` và trả `data.items`, `next_cursor`, `has_more`.
- `from` và `to` dùng UTC theo cặp, khoảng `[from,to)` tối đa 30 ngày, mặc định 7 ngày. `limit` mặc định 25, tối đa 100. Dùng tối đa một bộ lọc phụ. Cả hai nhận `action`. Audit nhận thêm `actor_id` hoặc cặp `subject_type`/`subject_id`. Trang kế tiếp có thể gửi `cursor` và `limit`; nếu gửi lại bộ lọc thì phải khớp cursor.
- API dùng `AUDIT_COUCHDB_URL`, `AUDIT_COUCHDB_DATABASE`, `AUDIT_COUCHDB_READER`, `AUDIT_COUCHDB_READER_PASSWORD` và `AUDIT_CURSOR_SECRET` riêng (tối thiểu 32 byte). Khởi tạo khi Admin tra cứu. Thiếu cấu hình hoặc kho lỗi trả `503 AUDIT_READ_UNAVAILABLE` ở endpoint log. Đổi secret làm cursor cũ hết hiệu lực.
- 004 kiểm chứng đọc `system_log` bằng fixture. Việc tự động phát sinh system log trong môi trường vận hành và viewer thuộc các bước nghiệm thu UC26 tiếp theo.
- Kết quả kỹ thuật: 25/25 ca backend mục tiêu và 6/6 ca trên CouchDB 3.5.2.1 cô lập đạt. Full backend 568 PASS, 26 FAIL, 2 SKIP với cùng tên ca lỗi baseline 003B. Suite route Admin nằm ngoài glob `npm test` và đã chạy đích danh. Container test đã dọn. 004 DONE qua nghiệm thu đóng UC26.

## 21. TV3-UC26-005 — Viewer Audit Trail và System Logs cho Admin

- Dashboard Admin có ba tab `Tổng quan`, `Vết kiểm toán` và `Nhật ký hệ thống`. Hai viewer chỉ tải khi được mở, dùng Axios service riêng và không kết nối CouchDB trực tiếp.
- Bộ lọc hỗ trợ khoảng ngày Việt Nam chuyển thành UTC `[from,to)` tối đa 30 ngày. Audit nhận một trong action, actor hoặc subject. System log nhận action. Trang sau chỉ gửi signed cursor và limit. Trang trước khôi phục đúng snapshot truy vấn đầu. Cursor hết hiệu lực yêu cầu Admin chủ động quay về trang đầu.
- UI có Loading, Empty, Error và Success, retry lỗi 503, thời gian `DD/MM/YYYY HH:mm:ss` theo `Asia/Ho_Chi_Minh`, chi tiết kỹ thuật thu gọn và chỉ hiển thị DTO allowlist từ API 004.
- Kết quả kỹ thuật ngày 2026-11-12: 7/7 test viewer và tài khoản Admin mục tiêu đạt. Full frontend đạt 219/219 Vitest và 7/7 Node. Lint không có lỗi, còn một warning có sẵn tại `App.jsx`. Production build đạt, còn warning chunk lớn có sẵn. API audit mục tiêu đạt 5 PASS, 1 SKIP khi không cấp CouchDB. Full backend giữ baseline 568 PASS, 26 FAIL, 2 SKIP.
- Ca Edge thật với Microsoft Edge headless và CouchDB 3.5.2.1 dùng một lần đạt 3/3, gồm mutation → outbox → delivery → Admin API → hai viewer. Fixture system log lịch sử đã được loại khỏi final flow tại 006C. Container nghiệm thu đã dọn. Trạng thái 005: DONE qua nghiệm thu đóng UC26.
- Khoảng trống system-log producer và durable recovery đã được giải quyết tại 006A–006C. Đổi vai trò không thuộc MVP UC26 vì repo không có mutation endpoint đổi vai trò.

## 22. TV3-UC26-006A — Dependency System Producer

- Người dùng duyệt triển khai A1–A7 ngày 2026-11-12. Application create/reapply/transition/withdraw, Job create/edit/status/soft-delete và Admin lock/unlock gọi system reporter best-effort khi write dependency trả lỗi hạ tầng. Validation, RBAC, conflict và `AUDIT_BACKLOG_FULL` không tạo dependency event.
- Event `DEPENDENCY_WRITE_FAILED` dùng outcome `UNKNOWN`, actor server-verified, component allowlist và `req.correlationId`. Reporter khởi tạo audit writer theo kiểu lazy, parse strict schema và không thay đổi lỗi mutation ban đầu.
- Khi audit store hoặc cấu hình audit không khả dụng, reporter ghi đúng một JSON fallback đã sanitize. Fallback không chứa actor ID, email, token, CouchDB URL/credentials, payload nghiệp vụ, raw error hoặc stack. Reporter và fallback đều không throw ngược vào business service.
- Kết quả kỹ thuật: 13/13 ca 006A và Admin User mục tiêu đạt; 58 PASS / 1 SKIP regression API/domain; 9/9 ca với CouchDB 3.5.2.1 cô lập đạt, gồm writer append và reader đọc system event thực. Full backend đạt 574 PASS, 26 FAIL, 2 SKIP, tăng 6 PASS và giữ nguyên 26 lỗi baseline trước 006A. Container test đã dọn.
- Trạng thái 006A: DONE, người dùng đã chấp nhận và yêu cầu triển khai 006B ngày 2026-11-12.

## 23. TV3-UC26-006B — Durable Delivery Incident và Recovery Producer

- `audit_outbox` pending hỗ trợ `delivery_incident` strict với mã `EVENT_STORE_UNAVAILABLE` hoặc `EVENT_ID_CONFLICT`, stable `failure_event_id`/`recovery_event_id`, mốc lỗi đầu/cuối, số lần thử hữu hạn và `recovered_at` chỉ dành cho outage đã phục hồi.
- Policy nguồn được nâng lên `audit_source_version: 2`. Worker chỉ được cập nhật incident của đúng một pending entry, settle hoặc quarantine; không được sửa business document, audit event, ID hay các incident ID đã chốt. Provisioner nâng cấp các policy v1/v2-no-users đã biết và từ chối policy lạ.
- Worker lưu incident trước khi báo sự cố. Outage giữ pending; khi sink phục hồi, worker giao event gốc, đánh dấu recovery, phát đúng cặp system log `AUDIT_DELIVERY_FAILED`/`AUDIT_DELIVERY_RECOVERED` bằng stable IDs rồi settle. Integrity conflict phát FAILED và quarantine, không phát RECOVERED. Lost response tại source/sink được reconcile idempotent; fallback chỉ chứa trường allowlist đã sanitize.
- Kết quả kỹ thuật ngày 2026-11-12: targeted đạt 18 PASS / 1 SKIP; CouchDB 3.5.2.1 cô lập đạt 3/3 gồm migration policy, guard và log thực; full backend đạt 580 PASS / 26 FAIL / 2 SKIP, tăng 6 PASS và giữ nguyên 26 lỗi baseline trước 006B. Container test đã dọn, không ghi vào `recruitment_db` thật.
- Trạng thái 006B: DONE, người dùng chấp nhận và yêu cầu triển khai 006C ngày 2026-11-12.

## 24. TV3-UC26-006C — Final Integration, Edge Verification và Closure UC26

- Edge integration không còn tự chèn `AUDIT_DELIVERY_RECOVERED`. Mutation khóa tài khoản thật tạo audit outbox; worker outage lưu `delivery_incident`; worker phục hồi giao audit gốc và tự phát FAILED/RECOVERED. Viewer đối chiếu đúng audit event ID, recovery event ID và correlation ID từ incident vừa phát sinh.
- Ca xuyên suốt dùng production frontend build với API base `/api`, Microsoft Edge headless và CouchDB 3.5.2.1 disposable đạt 3/3. Container, source database, log database và service users thử nghiệm được loại bỏ cùng container; không ghi vào `recruitment_db`.
- Targeted backend đạt 21 PASS / 1 SKIP. Full backend giữ 580 PASS / 26 FAIL / 2 SKIP, không có lỗi mới so với baseline 006B. Frontend đạt 219/219 Vitest và 7/7 Node; lint 0 error với một warning `App.jsx` có sẵn; production build đạt với warning chunk-size có sẵn.
- Closure matrix xác nhận storage cô lập, append-only guard, correlation, atomic outbox, Application/Job/Admin status producers, Admin-only API, signed cursor, responsive viewer, dependency producer, durable incident/recovery, retention và redaction đều có implementation/test evidence. Đổi vai trò không thuộc MVP UC26 vì repo không có mutation endpoint đổi vai trò; production credential provisioning là bước rollout vận hành riêng.
- Trạng thái 006C: DONE. Người dùng nghiệm thu và đóng UC26 ngày 2026-11-12.
