# RecruiHub NoSQL — TV1 Stage 03B: Runtime Integration & Foundation Verification

## 1. Mục tiêu

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/auth-profile-portal`
- **Phụ trách:** TV1 — Shared Backend Foundation; báo cáo do Codex tổng hợp, chưa gán cá nhân.
- **Mục tiêu:** nạp môi trường nhất quán cho Backend từ repo root hoặc `backend/`, tích hợp CouchDB readiness vào Express bằng route kỹ thuật chỉ đọc, review public Foundation interfaces, và xác minh runtime an toàn để handoff TV2/TV3.
- **Trạng thái:** **PARTIAL**.

## 2. Trạng thái trước triển khai

- Branch là `feature/auth-profile-portal`.
- `docs/ARCHITECTURE_DATABASE_AUDIT.md` đang staged dạng add (`A`). Working copy khớp index trước và sau công việc; staged entry không bị sửa.
- Các file Stage 03A, Stage 02 và guide/report đang untracked trước công việc; được giữ nguyên ngoài các file được Stage 03B yêu cầu cập nhật.
- Repo root có `.env`; `backend/.env` không có. Không đọc hoặc ghi giá trị credentials trong báo cáo.
- Backend `server.js` dùng `dotenv/config`, phụ thuộc current working directory. Khi chạy từ `backend/`, root `.env` không được nạp tự động.
- Backend runtime hiện có ở port 5002; `GET /api/health` trả 200 với body hiện hành. CouchDB HTTP tại `127.0.0.1:5984` phản hồi.
- `backend/package.json` định nghĩa `npm test` là `node --test tests/data/*.test.js`; không khai báo build/lint script.

## 3. Phạm vi và file đã thay đổi

### Đã tạo hoặc sửa

- `backend/src/config/load-environment.js` — loader đọc `backend/.env`, rồi root `.env`, không ghi đè biến do process cung cấp.
- `backend/src/server.js` — gọi loader trước khi dynamic-import Express app để CORS/config đọc được env đã nạp.
- `backend/src/routes/database-health.routes.js` — route factory cho readiness GET, lỗi sanitized và metadata allowlist.
- `backend/src/app.js` — mount route kỹ thuật `/api/health/database`, không đổi route health hiện có.
- `backend/tests/foundation/runtime-integration.test.js` — route/env loader tests dùng server ephemeral và file env tạm trong OS temp.
- `docs/shared/COUCHDB_FOUNDATION_GUIDE.md` — runtime env, cách chạy, route readiness, troubleshooting, stability và handoff.
- `docs/reports/TV1/RP-TV1-runtime-integration-verification.md` — báo cáo này.

Không sửa package manifest/lockfile, business schema, dataset/manifest, importer, Docker Compose, `.env`, CouchDB documents, index/view, hay logic TV2/TV3. Không thêm dependency.

## 4. Runtime configuration

`loadBackendEnvironment()` xác định đường dẫn theo vị trí source, không theo `process.cwd()`:

1. Biến đã có trong parent process được giữ nguyên.
2. Nếu thiếu, giá trị `backend/.env` được nạp.
3. Nếu vẫn thiếu, giá trị root `.env` được nạp.

Loader chỉ đọc file hiện có, không tạo file và không in giá trị. Root `.env` được dùng mà không copy credentials sang backend. CORS và `PORT` được đọc sau khi loader chạy. Import module client/route không tạo kết nối CouchDB; client chỉ được tạo khi readiness endpoint nhận request.

Default port vẫn là 5000 nếu không có `PORT`; môi trường hiện tại tiếp tục dùng 5002. Guide ghi lệnh từ repo root và từ `backend/`.

## 5. Express integration

- Giữ nguyên `GET /api/health`: 200, `{ "success": true, "message": "RecruiHub Backend is running" }`.
- Thêm **provisional internal diagnostics endpoint** `GET /api/health/database` dưới prefix `/api` hiện có; API prefix/envelope dùng chung vẫn chưa freeze.
- Route gọi `checkReadiness()`, chỉ phát sinh CouchDB GETs (`/` và `/{database}`). Không có create/update/delete/import/index/view operation.
- Thành công chỉ trả `{status, database:{name, doc_count}}`; không trả URL, userinfo, credentials, CouchDB UUID hoặc raw response.
- Lỗi CouchDB/network/timeout được ánh xạ sang response an toàn; handler bắt lỗi nên CouchDB unavailable không dừng Express.
- Route không có auth middleware. Do đó guide giới hạn endpoint này ở local/internal dev; cần review access control trước khi public/deploy.

## 6. Foundation contract review

| Interface | Nhận xét | Handoff guidance |
|---|---|---|
| `CouchDbClient` | Config được inject; Fetch có timeout; error mapping không đưa raw URL/body/cause ra response. `checkReadiness`, database metadata, document GET, Mango find, deterministic create, expected-revision update và exists. Không kết nối lúc import. | Có thể dùng cho repository nghiệp vụ; không giả định transaction, bulk API, delete, index management hoặc mutation retry. |
| `BaseRepository` | `getById`, `find`, `create`, `update`, `exists`, `getDatabaseInfo`; client và optional Zod schema được inject. Create/update validate trước khi delegate. | TV2/TV3 gắn schema thuộc sở hữu module mình; repository không tự tạo `_id`/`type`, không enforce ownership. |
| `find(selector, options)` | Selector phải là object; options được ghép vào Mango body và chuyển nguyên trạng. Không có validate/allowlist cho field lọc hoặc sort. | Service phải allowlist input, giới hạn `limit`, xác định selector/sort hợp lệ. Bookmark phải được truyền và xử lý ở caller. |
| Pagination/stable order | Client không tự thêm sort, tie-breaker, bookmark hoặc pagination invariant. | Contract từng query cần stable sort có trường tie-breaker duy nhất, bookmark semantics và test cho trang kế tiếp. |
| Zod | Schema tùy chọn ở BaseRepository; lỗi validation giữ issues trong lỗi nội bộ. | Không gửi issues chứa field nhạy cảm thẳng ra API/log nếu chưa sanitize. |
| `_rev` conflict | 409 được map thành typed `CONFLICT`; client không retry mutation hoặc blind merge. Update yêu cầu caller cung cấp `expectedRev`. | Service đọc lại revision, kiểm tra lại quyền/state và chỉ retry theo chính sách được phê duyệt. |
| Dependency injection | Fetch implementation/config/client đều inject được; BaseRepository nhận client-compatible object. | Phù hợp fake-client unit tests; live write test chỉ với DB test riêng đã phê duyệt. |
| Secret safety | Authorization chỉ tạo per-request; endpoint trả allowlist metadata. | Không log config/header/raw response; mọi module phải map document sang DTO an toàn. |

Không thực hiện breaking interface changes. Có khác biệt cần nhóm làm rõ: `AGENTS.md` yêu cầu tối đa 3 retries khi revision conflict, trong khi DATA-02A contract quy định chỉ một retry có điều kiện. Foundation hiện không retry. TV1/TV2/TV3 cần thống nhất chính sách service trước khi triển khai mutation có cạnh tranh.

## 7. Test và verification

- `node --test tests/foundation/*.test.js` — **PASS 18/18**.
- Test mới bao gồm success route với metadata allowlist, giữ nguyên response `/api/health`, sanitized network failure/server tiếp tục phục vụ request, precedence env và giữ nguyên process env.
- Runtime smoke dùng Express app trên port OS cấp tạm, không dừng/restart backend đang chạy ở 5002:
  - `GET /api/health` — 200, body không đổi.
  - `GET /api/health/database` — 200, database `recruitment_db`, `doc_count: 25750`.
  - Read-only client gọi database metadata và GET một document đầu tiên từ release `users.jsonl`; document tồn tại, `type=user`.
  - Chỉ đọc; không có write request.
- Kiểm tra trực tiếp database metadata trước/sau cùng verification: 25.750 documents.
- `core.autocrlf=true`: đã đọc 9 JSONL. SHA-256 từng Git blob khớp manifest; SHA-256 working copy không khớp manifest cho cả 9 file.
- Không chạy Docker CLI vì HTTP readiness đủ xác minh CouchDB và prompt không yêu cầu Docker status. Không tạo custom index/view.
- Không chạy lại `npm.cmd test`; phân tích an toàn và kết quả lần chạy Stage 03A ở mục 8.
- Không có build/lint script trong backend package.

## 8. Phân loại lỗi full suite

`npm.cmd test` đã **FAIL** trong lần chạy Stage 03A. Lần chạy Stage 03B này không chạy lại full suite; vì vậy không khẳng định trạng thái mới hoặc baseline trước Stage 03A. Test output trước đó báo DATA-04B V04/V15, DATA-02B.3 failure-injection/release checks, DATA-02B.2 checksum/path checks, DATA-03.2 manifest checksum, DATA-03.3B thiếu release input, và DATA-03.4B checksum/idempotency.

| Nhóm yêu cầu | Kết luận có bằng chứng |
|---|---|
| Lỗi đã có trước Stage 03A | **Chưa chứng minh được**: không có lần chạy baseline trước Stage 03A được lưu để so sánh. Không gọi các lỗi này là pre-existing. |
| Path/working directory | Một số lỗi thiếu path/input được báo; chưa đủ bằng chứng nói cwd là nguyên nhân duy nhất. Các test import hiện tính repo root tương đối từ file test. |
| CRLF / SHA-256 | **Đã xác minh:** `core.autocrlf=true`; cả 9 Git blob khớp manifest, còn cả 9 working-copy bytes mismatch. Hash kiểm tra bytes nên CRLF checkout làm sai checksum so với LF blob. |
| Thiếu release input | DATA-03.3B được báo thiếu release input trong lần chạy cũ. Cần xác minh release artifact đúng trước khi chạy lại, không tạo giả input. |
| Failure-injection | DATA-02B.3 có assertion failure-injection/release thất bại; chưa cô lập được nguyên nhân ở lần này. Không chỉnh tests ngoài scope. |
| Regression từ Foundation | **Không có bằng chứng regression:** 18 Foundation tests pass; lỗi đã báo nằm ở data/release suites. Tuy vậy không kết luận baseline vì full suite không được chạy ở Stage 03B. |

**Lý do không chạy full suite lần này:** test suite thao tác trực tiếp các scratch path dưới `data/`; một test xóa `data/test_scratch` trước khi tạo, test khác ghi/xóa `data/scratch_bad_manifest.json`, và release tests tạo/xóa `data/staging_test_rerun`. Có bài publication/failure-injection dùng manifest/pointer thật. Rủi ro với file đang có và các lần test đồng thời không cần thiết cho kiểm tra Foundation; vì thế chỉ chạy nhóm Foundation cô lập. Các đường dẫn scratch đã kiểm tra hiện không tồn tại, nhưng điều đó không loại bỏ rủi ro do suite có side effects lên repo.

**Remediation đề xuất cho task riêng:** (1) chạy mỗi data suite trong temp repo/fixture cách ly; (2) khôi phục bytes gốc từ Git blob vào temp release bên ngoài repo, không tắt checksum; (3) cung cấp release input đúng qua fixture/manifest test-only; (4) xác minh test không sửa active pointer/release; (5) tách và điều tra failure-injection Windows/atomic-rename độc lập. Không remediation nào được thực hiện ở Stage 03B.

## 9. Database safety verification

- CouchDB endpoint `127.0.0.1:5984` phản hồi HTTP; readiness API hoạt động.
- Database tồn tại: `recruitment_db`; `doc_count=25,750` trước/sau.
- Đọc một document `user` đã tồn tại từ release sample ID.
- Không tạo DB, không ghi documents, không seed/import/migrate, không tạo index/view, không xóa volume/container.
- Port 5000 và container/service khác không bị tác động.
- Docker daemon/container state không được kiểm tra bằng CLI; HTTP readiness là bằng chứng runtime của CouchDB API, không phải trạng thái Docker container.

## 10. Hướng dẫn handoff cho TV2/TV3

1. Inject `CouchDbClient` vào `BaseRepository`; gắn Zod schema của document module mình sở hữu.
2. Tự tạo deterministic ID/type theo DATA-02A; Foundation không bổ sung trường nghiệp vụ.
3. Với Mango, allowlist filter, đặt limit, quy định sort ổn định + tie-breaker, bookmark và index proposal dựa trên query thật.
4. Xử lý `DATABASE_NOT_FOUND`, `NOT_FOUND`, `CONFLICT`, `TIMEOUT`, `NETWORK_ERROR` ở service; không retry mutation vô điều kiện.
5. Chỉ dùng fake client trong unit tests; write integration cần database cô lập và phê duyệt riêng.
6. Không coi route `/api/health/database` hay response helper provisional là API contract đã được duyệt.
7. Không đưa audit/session/business docs bổ sung vào DB khi schema 9 document types chưa được thay đổi chính thức.

## 11. Blockers và rủi ro

- API prefix/envelope, auth/session và public exposure của readiness route vẫn chưa freeze.
- Chính sách conflict retry giữa `AGENTS.md` (tối đa 3) và DATA-02A (tối đa 1 có điều kiện) chưa thống nhất.
- Pagination/bookmark/stable sort phải được module consumer xác định; Foundation không áp đặt.
- Full legacy suite còn FAIL theo lần chạy Stage 03A; baseline trước Stage 03A chưa có bằng chứng.
- 9 JSONL working copies mismatch manifest do line ending; importer/verifier cần bytes gốc hoặc release fixture sạch.
- Docker CLI status chưa xác minh; HTTP CouchDB và DB metadata đã xác minh.
- Readiness endpoint không có auth; chỉ dùng local/internal cho tới khi threat/access review.

## 12. Acceptance checklist

- [x] Nạp env từ root hoặc `backend/` theo đường dẫn ổn định; parent process không bị override.
- [x] Không copy hoặc in credentials, không tạo/chỉnh `.env`.
- [x] Giữ nguyên response `GET /api/health`.
- [x] Thêm endpoint readiness GET chỉ đọc, timeout/error map và allowlist response.
- [x] Không tạo DB/index/view hoặc kết nối lúc module import.
- [x] Foundation + route tests PASS 18/18.
- [x] Runtime readiness và document GET PASS; document count vẫn 25.750.
- [x] Guide và handoff được cập nhật.
- [x] Branch giữ nguyên; audit staged giữ nguyên; không add/commit/push.
- [ ] Full backend suite PASS — **chưa đạt; không rerun vì legacy suite side effects và lỗi đã biết**.
- [ ] Nhóm thống nhất retry policy, API contract và production access control — **chưa đạt**.

## 13. Trạng thái nghiệm thu

**PARTIAL.** Environment loading, endpoint integration, foundation contract review, 18/18 targeted tests và read-only runtime checks đạt. Chưa đạt PASS do legacy full suite vẫn có lần chạy FAIL chưa có baseline so sánh, line-ending/release fixture issues còn mở, Docker container state chưa xác minh qua CLI, và một số shared API/security/revision decisions cần nhóm chốt.

## 14. Bước tiếp theo

- Nhóm xác nhận API prefix/envelope và readiness route có được giữ trong dev hay phải gate/remove trước deploy.
- TV1/TV2/TV3 hòa giải conflict retry 1-vs-3 theo DATA-02A và `AGENTS.md`.
- Chuẩn bị full-suite test isolation và line-ending-safe fixture trong task data-pipeline riêng; không thay manifest/checksum.
- TV2/TV3 gửi query/sort/bookmark workload trước khi đề xuất index/view.
- Sau đó TV2/TV3 có thể dùng BaseRepository trên fake client để phát triển module độc lập; CouchDB write integration chờ test DB và task được phê duyệt.
