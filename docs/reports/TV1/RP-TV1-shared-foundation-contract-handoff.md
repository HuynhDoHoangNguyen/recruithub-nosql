# RecruiHub NoSQL — TV1 Stage 03C: Shared Foundation Contract Freeze & Handoff

## 1. Công đoạn và mục tiêu

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1 — Shared Backend Foundation Owner; tổng hợp bởi Codex, chưa gán cá nhân.
- **Mục tiêu:** đối chiếu tài liệu với Foundation source, chuẩn hóa public contract ở mức source-verified, tách quyết định approved khỏi proposal/pending, và bàn giao ranh giới tích hợp cho TV2/TV3.
- **Phạm vi:** documentation, contract review và handoff. Không triển khai auth, Job/Application, Interview/Scoring, không thay đổi CouchDB.
- **Trạng thái nghiệm thu:** **PARTIAL**.

## 2. Tài liệu và source đã review

- `AGENTS.md`, `ARCHITECTURE.md`, `docs/data-schema-contract.md`, `docs/recruitment-business-rules.md`.
- Báo cáo TV1 Stage 02 database/API contract, Stage 02.5 decision freeze, Stage 03A CouchDB client/repository, Stage 03B runtime verification.
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md`.
- Toàn bộ Foundation source: database config, env loader, CouchDB client/errors, BaseRepository, response helpers, DB readiness route, app/server and current health route/controller.
- Toàn bộ `backend/tests/foundation/*.test.js`.

Source là căn cứ cho interface đang chạy. Architecture diagrams và báo cáo cũ không được dùng để khẳng định implementation nếu source không có.

## 3. Decisions đã chốt và trạng thái

| Quyết định | Phân loại | Căn cứ |
|---|---|---|
| TV1 sở hữu Shared Foundation | **APPROVED** | Ownership Stage 03A |
| TV2 phụ trách Job/Application | **APPROVED** | Phân công nhóm |
| TV3 phụ trách Interview/Scoring/Audit | **APPROVED** | Phân công nhóm |
| Chỉ 9 business document types; discriminator `type` | **APPROVED** | DATA-02A |
| Foundation không tự tạo business `_id`/`type` | **APPROVED + IMPLEMENTED** | DATA-02A và client/repository source |
| Foundation không tự retry mutation | **APPROVED + IMPLEMENTED** | DATA-02A boundary và client behavior |
| Không write-test lên `recruitment_db` | **APPROVED** | Stage 03A/03C task safety |
| Không tự tạo index/view/document type | **APPROVED + IMPLEMENTED** | DATA-02A boundary; không có API đó trong Foundation |

## 4. Contract/interface matrix

Bảng đầy đủ theo method, input/output, errors, preconditions, side effects và module owner nằm trong `docs/shared/SHARED_FOUNDATION_CONTRACT.md` mục 5–7. Các điểm cốt yếu được xác nhận:

- `getById`, `exists`, `getDatabaseInfo` là GET-backed reads; `find` dùng HTTP POST `_find` nhưng là query-only.
- `find(selector, options)` chỉ kiểm tra selector là object, chuyển Mango options nguyên trạng và không bảo đảm bookmark pagination/stable sort.
- `create`/`update` là writes; cần `_id` caller-supplied, update yêu cầu `expectedRev`, optional Zod validation chỉ chạy ở create/update. Repository không áp dụng parsed transform output.
- `CouchDbError` codes/status mapping, config parsing và readiness endpoint outputs/errors được ghi dựa trên source. Readiness route hiện không có auth, chỉ được coi là internal/provisional.
- BaseRepository không thay thế service authorization, ownership check, business validation, idempotency, DTO mapping hay audit policy.

## 5. Revision conflict decision

Có mâu thuẫn trong nguồn chỉ dẫn: `AGENTS.md` yêu cầu tối đa 3 retries; DATA-02A yêu cầu một retry có điều kiện sau fresh read và revalidation. Đề xuất đưa ra theo yêu cầu là dùng luật chặt hơn của DATA-02A ở business mutation:

1. Đọc revision mới nhất.
2. Recheck authorization và ownership.
3. Recheck transition/business state.
4. Xác nhận action idempotent hoặc kết quả tương đương đã hoàn tất.
5. Retry tối đa một lần nếu vẫn hợp lệ; nếu conflict tiếp tục thì trả 409.

**Trạng thái: PROPOSED, chưa được nhóm phê duyệt.** Foundation client hiện không retry và chỉ trả typed `CONFLICT`; không sửa `AGENTS.md`/business rules.

## 6. API integration decision matrix

| Hạng mục | Trạng thái hiện tại | Proposal / pending |
|---|---|---|
| API prefix | `/api/health` và `/api/health/database` IMPLEMENTED; tài liệu/frontend còn `/api/v1` | Giữ `/api` cho MVP hiện tại là **PROPOSED**; team chốt trước domain API integration |
| Success/error envelope | Helper success/error tồn tại; health cũ khác envelope; readiness dùng success helper | `{success:true,data,message?}` / `{success:false,error:{code,message,details}}` là **PROPOSED** |
| HTTP status | Một số CouchDbError đã map | Chuẩn 400/401/403/404/409/429/500/502/503/504 là **PROPOSED**, cần approve per-code |
| Cursor pagination | Không có abstraction | Opaque cursor bind với Mango bookmark + selector/sort, capped limit, stable sort + unique tie-breaker: **PENDING** |
| Error sanitization | CouchDbError/toApiError có sanitization | Bảo toàn không stack/secret/raw body; policy validation detail cần freeze |
| Auth principal | Không có middleware/principal | `req.auth={userId,role}` từ identity server-verified; ownership resolve từ authoritative docs: **PENDING** |
| Readiness route | `GET /api/health/database` IMPLEMENTED, trả allowlisted name/count | Policy exposure PENDING; route hiện không auth, giới hạn local/internal |

Không thay đổi route/frontend/API trong công đoạn này.

## 7. Handoff checklist và dependencies

### TV2

- Dùng chung BaseRepository/CouchDbClient; không tạo DB client/base repo khác.
- Gửi TV1 Public Job Card/Detail DTO, filter/query/sort/cursor/error contract và public-field allowlist.
- Gửi ownership/scope rules và application summary/detail DTO khi portal cần consume.
- Nộp query workload trước đề xuất index/view.

### TV3

- Dùng chung BaseRepository/CouchDbClient; không xây lại DB foundation.
- Gửi Interview endpoint/DTO/lifecycle và Scoring input/output/freshness/ranking contract.
- Đề xuất audit event/storage/retention/redaction/access; không thêm document type khi chưa được approve.
- Nộp query workload và yêu cầu index/view.

### Handoff checklist

- [x] Method signatures và lỗi common được đối chiếu source.
- [x] Owner/module boundaries và illustrative examples được ghi.
- [x] Những gì không thuộc Foundation được nêu rõ.
- [ ] TV2/TV3 xác nhận DTO/query/cursor contract.
- [ ] Nhóm phê duyệt retry count, API prefix/envelope/statuses, auth principal và readiness exposure.
- [ ] Chỉ định index owner và test DB/test isolation policy.

## 8. Tests và bằng chứng

- Lệnh: `node --test tests/foundation/*.test.js` từ `backend/`.
- Kết quả: **PASS 18/18**, 0 fail, 0 skipped.
- Test set cover config validation, CouchDbError mapping, Fake Fetch request semantics, CRUD/revision guards, BaseRepository delegation/Zod, provisional envelope, readiness route allowlist/health compatibility/network failure, và env precedence.
- Không chạy legacy `npm.cmd test`: suite có side effects lên shared `data/` scratch/release paths; Stage 03B report ghi rõ lý do và historical failures. Không có CouchDB writes trong Stage 03C.
- Không chạy Docker, không query/mutate CouchDB, không tạo index/view.

## 9. Files

### Chỉ tạo trong Stage 03C

- `docs/shared/SHARED_FOUNDATION_CONTRACT.md`
- `docs/shared/TV2_TV3_FOUNDATION_HANDOFF.md`
- `docs/reports/TV1/RP-TV1-shared-foundation-contract-handoff.md`

Không sửa source, API routes, guide hiện có, schemas, business rules, JSONL/manifest, database, Docker hoặc các báo cáo stage trước.

## 10. Git status và preservation

- Branch giữ nguyên `feature/auth-profile-portal`.
- `docs/ARCHITECTURE_DATABASE_AUDIT.md` vẫn staged dạng add; working copy khớp index trước/sau.
- Thay đổi `backend/src/app.js`, `backend/src/server.js`, Foundation files/tests, `docs/shared/COUCHDB_FOUNDATION_GUIDE.md` và Stage 03B report đã tồn tại từ bước trước; Stage 03C không chỉnh các file đó.
- Ba file Stage 03C là untracked mới; không git add/commit/push.
- Snapshot `git status --short` sau khi tạo báo cáo:

  ```text
   M backend/src/app.js
   M backend/src/server.js
  A  docs/ARCHITECTURE_DATABASE_AUDIT.md
  ?? backend/src/config/database.config.js
  ?? backend/src/config/load-environment.js
  ?? backend/src/repositories/base.repository.js
  ?? backend/src/routes/database-health.routes.js
  ?? backend/src/services/couchdb.client.js
  ?? backend/src/services/couchdb.errors.js
  ?? backend/src/utils/api-response.js
  ?? backend/tests/foundation/
  ?? docs/reports/
  ?? docs/shared/
  ```

  Các status ngoài ba tài liệu Stage 03C là trạng thái có sẵn hoặc được tạo ở Stage 03A/03B. Không stage thêm file.

## 11. Risks và blockers

- API prefix `/api` vs `/api/v1` và success/error envelope chưa được duyệt.
- Retry count DATA-02A (1 conditional) vs AGENTS.md (up to 3) cần group decision.
- Cursor, stable sort, page cap, query-specific index/view chưa được chuẩn hóa.
- Không có auth principal; readiness endpoint không auth, không public/deploy rộng.
- TV2/TV3 chưa cung cấp DTO/query contracts để portal và cross-module integration freeze.
- Testing legacy suite còn limitations được ghi ở Stage 03B; không ảnh hưởng kết quả Foundation-only tests nhưng chưa được giải quyết.

## 12. Acceptance criteria

- [x] Đọc input docs, Foundation source và tests; phân biệt implementation với design docs.
- [x] Ghi đủ public interface methods với inputs, outputs, errors, preconditions, effects, examples and owners trong contract.
- [x] Mô tả 9 approved types và `type` discriminator.
- [x] Ghi rõ authorization/business validation thuộc service, không thuộc BaseRepository.
- [x] Phân tích 1-vs-3 retry conflict; đề xuất DATA-02A rule nhưng giữ trạng thái pending.
- [x] Viết API integration proposals và label IMPLEMENTED/APPROVED/PROPOSED/PENDING.
- [x] Tạo TV2/TV3 handoff checklist và feedback requests.
- [x] Foundation tests PASS 18/18; không ghi DB.
- [x] Giữ staged audit, branch và các file có trước.

## 13. Trạng thái nghiệm thu

**PARTIAL.** Contract/source review, documentation, handoff boundaries và Foundation test verification đạt. Chưa thể ghi PASS cho “freeze” vì retry policy, API prefix/envelope/statuses, cursor, auth principal, readiness exposure và index ownership còn chờ nhóm phê duyệt/TV2-TV3 input. Các đề xuất trong tài liệu không được coi là quyết định chính thức.

## 14. Bước tiếp theo

1. TV1/TV2/TV3 phản hồi Decision Register trong `SHARED_FOUNDATION_CONTRACT.md`.
2. Approve một conflict retry rule và service boundary; không đặt retry vào shared client.
3. Freeze API prefix, envelope/status mapping, principal interface và cursor semantics.
4. TV2 gửi Job DTO/query/filter/cursor; TV3 gửi Interview/Scoring/Audit DTO/query requirements.
5. Sau contract review, mỗi owner triển khai module riêng; index/view và live-write test ở task riêng có evidence, owner và rollback/isolation plan.