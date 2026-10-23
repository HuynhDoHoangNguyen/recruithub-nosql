# RecruiHub NoSQL — TV1 Stage 04A: Authentication Backend Infrastructure

## 1. Thông tin công đoạn

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phụ trách:** TV1; báo cáo tổng hợp bởi Codex, chưa gán cá nhân.
- **Trạng thái nghiệm thu:** **PARTIAL**.
- **Mục tiêu:** xây phần hạ tầng backend Stage 04A có thể làm mà không tự quyết các chính sách bảo mật còn pending; giữ nguyên operational health và không ghi CouchDB.

## 2. Phạm vi và yêu cầu

Được làm: router namespace `/api/v1`, User/Candidate repositories tái sử dụng Shared Foundation, strict request DTO/schema, body validation, safe User response mapping, fake-client tests và module contract documentation.

Bị chặn: xác thực hoạt động (login/register/logout), password hash, JWT/refresh/session, cookie/CSRF, principal/RBAC và seeded account activation vì các quyết định liên quan chưa được nhóm duyệt đầy đủ. Task không bao gồm Stage 04B–11.

## 3. Audit trước triển khai

- `git status --short --untracked-files=all`: working tree sạch.
- `git branch --show-current`: `feature/identity-candidate-portal`, đúng nhánh yêu cầu; không đổi nhánh.
- `git log -5 --oneline`: HEAD `f06f970 Merge pull request #1 from HuynhDoHoangNguyen/feature/auth-profile-portal`; các commit trước gồm shared Foundation/contracts, frontend scaffold và database pipeline.
- Shared Foundation source có DB config/env loader, CouchDbClient, CouchDbError, BaseRepository, provisional response helpers và database health route.
- Backend trước công việc chỉ có health/root routes; không có auth middleware/controller/service/repository nghiệp vụ hoặc `/api/v1` router.
- Có `userDocumentSchema`, `candidateDocumentSchema`, deterministic `userIdFromEmail`, roles/status constants theo DATA-02A.
- Backend `package.json`: không có lint/build script; `npm test` gọi `tests/data/*.test.js` (legacy data suite). Dependencies hiện có Express 5, Zod; không có Argon2/JWT/session dependency.
- Frontend có legacy login/register/AuthContext lưu access token ở localStorage và logout helper gọi host ngoài dự án; frontend không được sửa trong Stage 04A.
- Đã rà `AGENTS.md`, team assignment, Foundation guide/contract/handoff, Technical Decision Register, schema/business contract và báo cáo TV1 liên quan.

## 4. Kế hoạch và phần đã thực hiện

### Thực hiện được

1. Thêm empty API v1 router mount; không có auth handler.
2. Thêm `UserRepository` kế thừa `BaseRepository`, dùng Zod User schema; email lookup chuyển qua deterministic User ID, không query email bằng Mango.
3. Thêm `CandidateRepository` kế thừa `BaseRepository`, dùng Candidate schema; `findByUserId` giới hạn `type` và canonical user ID, `limit: 2`.
4. Thêm strict login/Candidate registration request schemas; role/account status không được nhận từ client.
5. Thêm provisional body validation middleware tích hợp shared response helper; response validation generic để không lộ input hoặc Zod details.
6. Thêm allowlist mapper `toSafeUserDto` để không trả password hash, `_rev` hay provenance.
7. Thêm tests fake-client/ephemeral HTTP; không có write lên CouchDB.
8. Tạo module contract và báo cáo Stage 04A.

### Không thực hiện

Không triển khai login/register/logout route, password hashing, JWT, refresh/session, cookies, CSRF, authorization principal/RBAC, User/Candidate writes, Candidate profile API, index/view, database changes hoặc frontend changes.

## 5. Files tạo/sửa

### Backend source — tạo

- `backend/src/repositories/user.repository.js`
- `backend/src/repositories/candidate.repository.js`
- `backend/src/schemas/auth-request.schema.js`
- `backend/src/middleware/validate-body.js`
- `backend/src/services/auth.service.js` (safe DTO helper only)
- `backend/src/routes/api-v1.routes.js` (empty router)

### Backend source — sửa

- `backend/src/app.js` — mount `/api/v1`; giữ nguyên `/api/health` và `/api/health/database`.

### Tests — tạo

- `backend/tests/auth-foundation/api-v1.test.js`
- `backend/tests/auth-foundation/auth-contract.test.js`
- `backend/tests/auth-foundation/repositories.test.js`

### Documentation — tạo

- `docs/shared/TV1_AUTH_MODULE_CONTRACT.md`
- `docs/reports/TV1/RP-TV1-stage-04a-auth-backend-infrastructure.md`

Không sửa package/lockfiles, User/Candidate document schema, business rules, shared Foundation, database, dataset, `.env`, Docker, frontend, audit report hoặc TV2/TV3 code.

## 6. Test / verification results

- Lệnh từ `backend/`: `node --test tests/auth-foundation/*.test.js tests/foundation/*.test.js` — **PASS 25/25**, fail 0, skipped 0.
- Bao gồm deterministic User lookup, Candidate selector, strict DTO, role/status spoof rejection, secret-safe DTO, generic validation error, API mount/health compatibility và toàn bộ Foundation regression tests.
- Runtime smoke dùng Express port OS cấp tạm; health vẫn 200 với body hiện hành; `POST /api/v1/auth/login` vẫn 404 (cố ý chưa triển khai).
- Không chạy `npm test` vì đó là legacy data suite có side effects trên scratch/release paths; không có backend lint/build/typecheck script.
- Không thực hiện CouchDB request nào; không tạo database/index/view hoặc ghi document.

## 7. Decisions đang pending

- DR-001…006 mang trạng thái `APPROVED_BY_TV1 — PENDING_TEAM_ACK`, không phải team approval. Các mục gồm `/api/v1`, JWT cookie+CSRF hướng tổng quát, Candidate-only public signup, retry DATA-02A tối đa một lần, target envelope, RBAC/principal boundary.
- DR-007…020 vẫn `PENDING`: Admin bootstrap, access/refresh TTL và storage, Argon2id params, CSRF details, cookie flags, seeded user claim/reset, cursor/index lifecycle, test isolation, readiness exposure, audit, status mapping, Recruiter invitation/activation, logout/revocation.
- `AGENTS.md` yêu cầu tối đa ba retries trong khi DATA-02A chỉ cho một conditional retry. Chưa code retry nào; cần nhóm/maintainer giải quyết.

## 8. Rủi ro và xác nhận cần TV2/TV3

- `CandidateRepository.findByUserId` là Mango query trên `type` + `user_id`; chưa có index được duyệt cho query này. Không dùng làm production workload trước query/index review.
- Candidate signup DTO là cấu trúc đầu vào tối thiểu/provisional; chưa giải quyết activation, initial profile construction hoặc atomicity giữa User và Candidate documents.
- Validation middleware trả 400 `VALIDATION_ERROR` generic bằng shared helper; global error mapping vẫn pending và middleware hiện chưa gắn vào auth route.
- API v1 router hiện rỗng; mount chỉ tạo namespace hạ tầng, không chứng minh endpoint auth hoạt động.
- Frontend còn legacy bearer/localStorage/host ngoài dự án; cần xử lý trong Stage 07 sau khi cookie/session contract được duyệt.
- TV2/TV3 cần xác nhận shared prefix/envelope/ownership contract; đây không ảnh hưởng Foundation tests nhưng cần trước integration.

## 9. Điều kiện bắt đầu Stage 04B

- Nhóm acknowledge DR-001…006 và freeze API envelope/status/principal interface.
- Chốt DR-008…011/020: Argon2id implementation/parameters, access/refresh lifecycle, cookie flags, CSRF issuance/validation/logout/revocation.
- Chốt Candidate registration/activation and seeded RESET_REQUIRED claim policy (DR-003/012), cùng ADMIN bootstrap/recovery (DR-007) và Recruiter provisioning (DR-019) trước các flow tương ứng.
- Hòa giải conflict retry rule; xác định isolated database strategy trước live-write integration.
- Bổ sung test cho auth service khi policy được chốt; không mở auth route trước các điều kiện trên.

## 10. Acceptance và trạng thái

**PARTIAL.** Đạt API v1 namespace, repositories dùng đúng Foundation, DTO/validation primitives, secret-safe User mapper, tests 25/25 và module documentation. Chưa đạt hoàn tất Stage 04A theo tiêu chí rộng vì không có auth handler/logic hoạt động; đó là chủ ý do các quyết định security/session/onboarding đang pending. Chưa có DB writes và không có regression trong targeted suite.

## 11. Git status và preservation

- Branch vẫn `feature/identity-candidate-portal`.
- Repository sạch trước khi sửa; các thay đổi sau task chỉ thuộc file source/tests/docs liệt kê ở mục 5.
- Không stage, commit, push, merge, fetch, pull hoặc thay đổi lịch sử.
- `docs/ARCHITECTURE_DATABASE_AUDIT.md` không bị sửa; không có staged thay đổi được tạo trong công đoạn này.

## 12. Đề xuất bước tiếp theo

TV1/TV2/TV3 review và ghi acknowledgement cho DR-001…006, nhóm chốt các security/onboarding decisions nêu ở mục 7–9; sau đó mở Stage 04B riêng cho password/session/auth routes với test isolation đã xác nhận.

**Commit title đề xuất (chưa tạo commit):** `feat(tv1): add auth backend foundation scaffolding`

**Description:** `Add versioned API namespace, Foundation-backed User/Candidate repositories, strict auth request validation, safe User DTO mapping, and isolated tests. Leave authentication endpoints disabled pending team security decisions.`
