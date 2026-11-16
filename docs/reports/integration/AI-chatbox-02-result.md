# AI-CHAT-02 — Task Result

## Task Result

Status: **TECHNICAL PASS — chatbox tìm việc từ CouchDB và mở link tin thật đã triển khai, chờ người dùng nghiệm thu.**

Ngày 16/11/2026. [Plan và contract](../../plans/AI-chatbox-02-job-search.md). Bản này mở rộng AI-CHAT-01, giữ Gemini model/key và FAQ fallback hiện có.

## Implemented

- Gemini phân biệt hướng dẫn thao tác với tìm việc; xuất intent/filter JSON. Zod kiểm tra lại toàn bộ trước khi truy vấn, không nhận Mango selector, ID kết quả hoặc URL do model tạo.
- Tìm theo từ khóa chức danh/ngành, kỹ năng AND có alias, địa điểm, work mode và seniority. Model có thể dùng các tin nhắn người dùng trước để hiểu câu tiếp nối; UI luôn hiển thị bộ lọc đã hiểu để đối chiếu.
- Backend đọc CouchDB thông qua reader chỉ có scan/get, cùng DB nghiệp vụ hiện hành. Parse schema và loại tin không OPEN, xoá mềm, hết hạn, thiếu hạn hoặc malformed. Không có quyền ghi được truyền cho service chat.
- Kết quả tối đa5 thẻ: tiêu đề, công ty, địa điểm, hình thức, cấp bậc, kỹ năng yêu cầu, hạn nộp; link chi tiết tạo từ ID thật. Có CTA mở danh sách giữ bộ lọc và nhãn nguồn/thời điểm tra cứu.
- Không đưa job documents vào Gemini; không đọc CV/profile hoặc gửi thông tin ứng viên. Reply kết quả do backend tạo. Đây là lọc theo tiêu chí, chưa xếp hạng phù hợp theo CV.
- Scan batch100, cap30pages/3.000documents, budget4 giây; báo partial nếu chưa phủ toàn bộ. DB lỗi/cursor đứng/timeout không bị coi là không có kết quả.
- Chưa hỗ trợ lọc salary/số năm kinh nghiệm/công ty cụ thể; báo rõ chưa áp dụng và không thực hiện truy vấn khi model xác định tiêu chí unsupported.
- Giữ FAQ, guards, rate/concurrency caps và abort/stale handling. Client chat timeout20 giây để chứa provider12 giây + DB4 giây.

## Files Changed

Mới:

- `backend/src/schemas/support-chat-intent.schema.js`
- `backend/src/services/support-job-search.service.js`
- `backend/tests/recruitment/support-job-search.test.js`
- `frontend/src/components/support/ChatJobResults.jsx`
- `frontend/tests/support-chat-api.test.jsx`
- Plan và báo cáo AI-CHAT-02.

Cập nhật backend `app.js`, support route/service/knowledge, `job.service.js` (chỉ export matcher, không đổi logic public search), tests support-chat; frontend support API/FaqChatbox/tests; ledger và ghi chú liên kết từ tài liệu AI-CHAT-01.

Giữ mọi thay đổi chưa commit từ FAQ/AI-CHAT-01. Không đổi `.env`, dependencies/lock, index, schema document nghiệp vụ hoặc dataset trong AI-CHAT-02. Chưa stage/commit/push.

## Tests Executed

| Kiểm chứng | Kết quả |
|---|---|
| Backend support-chat regression | 17 PASS |
| Backend job search mới | 9 PASS, gồm HTTP chat→repository HTTP reads→public detail; không CouchDB writes |
| Frontend FAQ/chat tập trung trước khi thêm API validator | 27 PASS; validator nằm trong full suite dưới |
| Backend npm test | 763 PASS, 0 FAIL, 9 SKIP; tổng772 |
| Frontend npm test | 289 Vitest + 7 Node PASS, 0 FAIL |
| Frontend lint | PASS, không warning |
| Frontend build | PASS; JS1.092,70 kB, cảnh báo chunk >500 kB vẫn còn |
| Gemini + CouchDB thật | Tìm Node.js + Hà Nội + hybrid →4 tin thật, mode=jobs |
| Browser thật | Hiện4cards, đúng nhãn/bộ lọc; bấm thẻ đầu mở trang chi tiết thật, title/company/skills/deadline khớp |
| Live empty/unsupported/follow-up/guide | 4/4 HTTP200 đúng mode: kỹ năng không có→0 tin; salary→searched=false; remote tiếp nối giữ Node.js/Hà Nội; cập nhật kỹ năng→guide |
| Bất biến DB trong live negative/regression lượt cuối | update_seq và doc_count trước/sau không đổi, 25.794 documents |
| Syntax/secret/whitespace audit cuối | PASS:27 file pending không chứa secret đã cấu hình; JS syntax, whitespace file mới và git diff --check sạch; `.env` vẫn ignored |

Log full tests nằm ngoài source ở TEMP Windows: `recruithub-chat-search-backend.log`, `recruithub-chat-search-frontend.log`. Không thêm bộ script hoặc raw evidence vào source. Browser thao tác ở Guest; Candidate guards/link behavior được kiểm chứng qua frontend regression, chưa login Candidate thật trong task này.

## Research Fidelity

- **Source-confirmed:** constants/filter/skill normalization/schema/public detail hiện có; native range scan `_all_docs` trong repository; Gemini [structured output](https://ai.google.dev/gemini-api/docs/structured-output).
- **Implementation inference:** phân loại ý định bằng Gemini, cap5cards/3.000documents/4 giây, thẻ kết quả và cách trình bày tiêu chí. Tái dùng literal matcher thay tự viết Mango query từ model.
- **Unspecified / unresolved:** độ chính xác mọi câu tiếng Việt, quota/latency provider, hiệu năng ở dataset lớn hơn cap. Kết quả hiện theo thứ tự ID, không relevance ranking/vector search. Một lần đọc nhiều documents không là transaction snapshot.

## Acceptance Criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| AC01 — Tin/link thật | PASS | Live Gemini→CouchDB và browser mở detail đúng tin |
| AC02 — Trạng thái/hạn/giới hạn | PASS | Schema/filter/expiry/deleted tests; backend tự tạo kết quả |
| AC03 — Trạng thái kết quả trung thực | PASS | Partial/empty/unsupported/DB error tests, 2 live negative cases |
| AC04 — Read-only/không bịa/không dữ liệu riêng | PASS | Reader capability, DTO allowlist, invalid intent tests, CouchDB HTTP chỉ GET và live seq không đổi |
| AC05 — Hồi quy chat/FAQ | PASS | Full suites, abort/reset/identity/CTA tests, live guide |
| AC06 — Kiểm chứng/báo cáo | PASS có giới hạn | Tests/lint/build và browser desktop; responsive của thẻ mới chưa được kiểm tra lại ở mobile thật |

## Risks / Deviations

- Lượt đầu bị Gemini400 do responseSchema enum chứa chuỗi rỗng. Đã bỏ enum khỏi ba trường có thể rỗng ở schema provider; Zod vẫn cưỡng chế enum thật trước mọi DB read. Test và live search sau sửa đạt.
- Một lượt live khác trả503 tạm thời; lần kiểm tra riêng sau đó và browser đã thành công. Không thêm retry tự động; khi provider lỗi UI vẫn fallback như thiết kế. Không cam kết luôn có câu trả lời AI khi quota/mạng/provider không ổn định.
- Công việc có thể đóng/hết hạn sau lúc tra cứu. UI hiển thị checked_at và trang chi tiết/nộp hồ sơ vẫn là nơi xác nhận trạng thái cuối.
- Cap scan có thể bỏ sót dữ liệu ở dataset lớn; UI báo partial, không khẳng định đã tìm toàn bộ. Đây là bước demo có giới hạn, chưa có inverted index hoặc semantic ranking.
- Trang danh sách chuẩn có thể hiện tin OPEN đã hết hạn theo hành vi cũ; chatbox lọc hạn chặt hơn. CTA vẫn đưa đúng bộ lọc, chưa đổi nghiệp vụ catalog cũ.
- Chưa có browser check lại thẻ mới ở375px hoặc xác nhận billing/quota tài khoản. Bundle warning hiện có giữ nguyên. Không thay key hoặc nhắc lại giá trị key trong source/docs.

## Recommended Next Task

Demo: Hỗ trợ → nhập “Tìm việc Node.js ở Hà Nội làm hybrid” → đối chiếu nhãn Tìm việc · CouchDB/bộ lọc → bấm tên tin → xem chi tiết và đăng nhập nếu muốn ứng tuyển. Có thể hỏi tiếp “Còn làm remote thì sao?” để đổi work mode và giữ tiêu chí trước.

Chỉ mở rộng salary/ranking/index search khi có yêu cầu riêng. Chưa bắt đầu các UC khác hoặc commit/push.
