# RecruiHub NoSQL — TV1 Stage 03D: Technical Decision Register & API Contract Documentation

## 1. Công đoạn và mục tiêu

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1; báo cáo tổng hợp bởi Codex, chưa gán cá nhân.
- **Mục tiêu:** ghi một decision register có thẩm quyền rõ ràng; đồng bộ hướng API/auth/conflict đã TV1 chốt nội bộ với hợp đồng Foundation và handoff TV2/TV3; phân biệt source hiện hữu với hợp đồng đích.
- **Phạm vi:** tài liệu và kiểm chứng Foundation tests. Không triển khai Authentication, domain API, CouchDB thay đổi, index/view, schema hoặc dữ liệu.
- **Trạng thái nghiệm thu:** **PARTIAL** — tài liệu và test Foundation đạt; các mục cần nhóm xác nhận vẫn mở.

## 2. Tài liệu/source đã kiểm tra

- `AGENTS.md`, `ARCHITECTURE.md`, `docs/data-schema-contract.md`, `docs/recruitment-business-rules.md`.
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`, `SHARED_FOUNDATION_CONTRACT.md`, `TV2_TV3_FOUNDATION_HANDOFF.md`.
- TV1 reports: Stage 02 database/API contract, Stage 02.5 technical decision freeze, Stage 03A CouchDB client/repository, Stage 03B runtime verification, Stage 03C shared contract handoff.
- Foundation source: DB config/environment loader, CouchDbClient/errors, BaseRepository, API helpers, database readiness route, Express app/server; all `backend/tests/foundation/*.test.js`.
- Git repository is nested at `BaoCao/recruithub-nosql`; workspace root itself is not the Git root. Git read commands needed a per-command `safe.directory` override because filesystem ownership differs; global Git config was not changed.

## 3. Trạng thái trước và sau

- Branch trước/sau: `feature/auth-profile-portal`.
- Trước: `docs/ARCHITECTURE_DATABASE_AUDIT.md` staged as add; `git diff --quiet -- docs/ARCHITECTURE_DATABASE_AUDIT.md` confirmed working copy equals index. Existing modified backend files and untracked Foundation/docs were present.
- Sau: same pre-existing entries preserved; only this task's permitted docs were created/updated. No file was staged.
- Audit staged entry remains `A`; staged blob recorded before work was `721e911bd7cce7c9833ee1c46d192fe2eb3cfac3`; its worktree still matches index after work.
- No commit, push, fetch, pull, branch change, Git staging, source edit, CouchDB request/write, or secret read/display was performed by this documentation task.

## 4. Công việc đã thực hiện

1. Tạo decision register DR-001…DR-020, phân biệt `IMPLEMENTED`, `APPROVED_BY_DATA_CONTRACT`, `APPROVED_BY_TV1 — PENDING_TEAM_ACK`, `PROPOSED`, `PENDING`.
2. Ghi DR-001…006 là hướng TV1 chấp thuận trong phạm vi mình, còn chờ TV2/TV3/group acknowledgement; không ghi thành team approval.
3. Giữ DR-007…020 ở `PENDING`, bao gồm admin bootstrap, JWT/refresh, password hashing, CSRF, cookie flags, seeded account reset, cursor, index lifecycle, test isolation, readiness exposure, audit storage, status mapping, Recruiter provisioning và logout/revocation.
4. Bổ sung dependency graph, owner/deliverable matrix, approval checklist, change control, blockers và group approval agenda.
5. Cập nhật shared contract bằng amendment có ngày, nói rõ DR-001 `/api/v1` chỉ hướng cho domain routes và supersedes Stage 03C `/api` proposal; operational health paths giữ nguyên. Nêu rõ implementation facts và target chưa triển khai.
6. Cập nhật handoff TV2/TV3 với sáu hướng TV1, checklist xác nhận và DTO/query/workload cần trả về.

## 5. Decision và contract summary

| Chủ đề | Trạng thái Stage 03D | Ghi chú |
|---|---|---|
| Ownership TV1/TV2/TV3, 9 document types, discriminator `type` | APPROVED_BY_TASK / DATA-02A | Không thay đổi. Foundation không sinh business `_id`/`type`, retry mutation, hoặc tạo DB/index/view. |
| API prefix | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Domain đích `/api/v1`; hiện chỉ `/api/health` và `/api/health/database`, không đổi routes. |
| JWT cookie + CSRF | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Chi tiết lifetime/refresh/flags/CSRF còn pending; chưa có auth source. |
| Registration | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Public Candidate; Recruiter provisioned; không public Recruiter/Admin signup. Onboarding details pending. |
| `_rev` conflict | APPROVED_BY_TV1 — PENDING_TEAM_ACK | DATA-02A conditional retry tối đa một lần; cần reconcile `AGENTS.md` nói tối đa ba retries. CouchDbClient hiện không retry. |
| Envelope | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Target success `{success:true,data,message?}`; error `{success:false,error:{code,message,details:null}}`; exact status mapping pending. Helpers provisional; `details` hiện khác target. |
| RBAC/principal | APPROVED_BY_TV1 — PENDING_TEAM_ACK | Server-side, canonical roles; shape `req.auth` và ownership scope pending; source auth chưa có. |
| DR-007…020 | PENDING | Chi tiết và blockers theo register. |

## 6. Test và bằng chứng

- Lệnh từ `backend/`: `node --test tests/foundation/*.test.js`.
- **PASS 18/18**, 0 failures, skipped or cancelled. Cover config, CouchDB error mapping, fake Fetch request semantics, CRUD/revision guards, BaseRepository/Zod, helper envelope, readiness allowlist/health compatibility/network failure and environment precedence.
- Foundation suite uses fakes; no live CouchDB write was made. No legacy `npm test` suite was run; it has previously documented shared data/release scratch side effects.
- Source review confirms `/api/v1` business routes, authentication, CSRF, RBAC/principal, business DTOs and cursor abstraction are **not implemented**. Existing helper error defaults `details` to `[]`, so it does not exactly implement DR-005 target `details:null`.
- No database, Docker, schema, dataset, manifest, index/view or runtime verification was performed; this was documentation-only.

## 7. Files

### Tạo

- `docs/shared/TECHNICAL_DECISION_REGISTER.md`
- `docs/reports/TV1/RP-TV1-technical-decision-register.md`

### Cập nhật

- `docs/shared/SHARED_FOUNDATION_CONTRACT.md` — dated Stage 03D decision amendment.
- `docs/shared/TV2_TV3_FOUNDATION_HANDOFF.md` — decision acknowledgement and deliverable section.

No other files were intentionally edited for this stage. Existing unrelated changes/staged entries were preserved.

## 8. Chưa được giải quyết và rủi ro

- Chưa có TV2/TV3/group acknowledgement. DR-001…006 remain TV1-endorsed only.
- DR-007…020 all remain pending; auth/session/account implementation cannot be called frozen.
- `AGENTS.md` retry count (up to three) conflicts with DATA-02A (at most one conditional retry). TV1's selected direction is pending group/maintainer resolution; do not code retries yet.
- Current route and helper implementations do not conform fully to target `/api/v1` and DR-005; no route/helper changes were allowed in this task.
- Readiness route is unauthenticated and returns allowlisted database metadata; deployment exposure policy is pending.
- TV2 Job/Application and TV3 Interview/Scoring/Audit DTO/query/index workload handoffs are outstanding.

## 9. Acceptance criteria

- [x] Register created with DR-001…020 and explicit approval state distinctions.
- [x] DR-001…006 labeled TV1-approved, pending team acknowledgement; DR-007…020 left pending.
- [x] Shared contract updated without claiming target API/auth behavior is implemented.
- [x] TV2/TV3 handoff includes acknowledgements, deliverables and no-duplication boundaries.
- [x] Foundation tests pass 18/18.
- [x] Branch and staged audit preserved; no unrelated source/data changes intentionally made.
- [ ] Group acknowledgement and pending technical decisions — outstanding.
- [ ] Stage 04 implementation contract and source alignment — not part of this stage.

## 10. Trạng thái nghiệm thu

**PARTIAL.** Decision documentation, cross-document alignment and targeted Foundation verification are complete. The technical freeze is not team-complete because no TV2/TV3/group acknowledgements were supplied and DR-007…020 remain pending. Target API/auth contract is not implemented and must not be represented as runtime behavior.

## 11. Công việc tiếp theo

1. TV2/TV3 review DR-001…006 and record explicit acknowledgement or amendments in `TECHNICAL_DECISION_REGISTER.md`.
2. Resolve the AGENTS.md/DATA-02A retry conflict and assign authority for the governing rule.
3. Decide DR-007…020, prioritizing session, registration/admin, principal, API envelope/status and cursor before dependent implementation.
4. TV2 supplies Public Job and Application DTO/query/cursor contracts; TV3 supplies Interview/Scoring/Ranking/Audit proposals and query workloads.
5. Open a separate implementation task after approval; reconcile actual routes/helpers incrementally without changing the existing health contract implicitly.