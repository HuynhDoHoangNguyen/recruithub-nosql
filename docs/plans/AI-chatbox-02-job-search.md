# AI-CHAT-02 — Chatbox tìm việc từ CouchDB

Ngày: 16/11/2026. Người dùng yêu cầu triển khai trực tiếp. Kế hoạch và contract dưới đây phản ánh phạm vi bản triển khai; kết quả ở [báo cáo AI-CHAT-02](../reports/integration/AI-chatbox-02-result.md).

## 1. Mục tiêu

Người dùng nhập tiêu chí tìm việc tự nhiên → Gemini tách intent/filter → Zod kiểm tra → backend đọc CouchDB thật → chatbox hiện tối đa năm thẻ việc làm và link chi tiết. Giữ FAQ/hướng dẫn của AI-CHAT-01.

Không dùng AI để tự sinh kết quả, tạo Mango selector hoặc ghi DB. Không phân tích CV, truy cập hồ sơ, nộp đơn hay đưa quyết định tuyển dụng.

## 2. Cách triển khai

- Một lần gọi Gemini generateContent có JSON responseSchema: `intent`, `reply`, `filters`, `unsupported`. Intent `guide` giữ hướng dẫn; `search_jobs` giao cho service tìm việc. JSON/field/enum không hợp lệ bị từ chối trước khi đọc DB.
- Filters được chấp nhận: `q` tối đa120 ký tự; `skills` tối đa8 tên, mỗi tên60 ký tự; `location`, `work_mode`, `seniority` chỉ các enum catalog hoặc rỗng. Kỹ năng normalize theo alias policy hiện có, ghép AND. Tái sử dụng `matchesPublicFilters` từ JobService, không thay logic các API việc làm cũ.
- Salary, số năm kinh nghiệm, công ty cụ thể hoặc tiêu chí không biểu diễn được phải báo chưa hỗ trợ, `searched=false`; không truy vấn rồi im lặng bỏ tiêu chí.
- Reader chỉ có `scanPublicJobs` và `get` từ database nghiệp vụ/Auth đã được cấu hình, cùng nguồn với tin có thể ứng tuyển. Nếu chưa có cấu hình live domain, trả lỗi search503; không giới thiệu dataset tham khảo như tin có thể nộp.
- Quét prefix job bằng `_all_docs` đã có, batch100, tối đa30 batch/3.000 documents và 4 giây; dừng khi đủ6 tin để hiển thị5 và biết có thêm. Đọc tối đa5 công ty, gộp ID trùng. Đây là tìm kiếm có giới hạn cho dataset hiện tại, chưa phải index tìm kiếm chuyên dụng.
- Mỗi job được parse schema, loại DRAFT/CLOSED/soft-deleted/hết hạn/thiếu hạn/malformed. Chỉ allowlist trường hiển thị; không trả recruiter ID, provenance, revision, audit outbox hoặc thông tin riêng.
- `reply` của search do backend tạo, không dùng câu AI để khẳng định có kết quả. `jobs[]` gồm ID/title/company/location/work mode/seniority/required skills/deadline thật, `checked_at`, `has_more`, `partial`, `searched`, `filter_labels`, `search_url`.
- Nếu chạm giới hạn scan, ghi `partial=true`; không khẳng định không có kết quả trong toàn bộ DB. DB lỗi, cursor đứng, timeout hoặc abort → `CHAT_SEARCH_UNAVAILABLE`503, không giả thành zero result.
- Kết quả theo thứ tự ID của reader, chưa xếp hạng CV. Một lần tìm không là snapshot transaction: trạng thái có thể đổi khi mở tin; UI ghi thời điểm tra cứu và trang chi tiết kiểm tra lại.
- Gemini chỉ nhận câu hỏi/history và kiến thức bộ lọc; không gửi job documents tới Google. History không đính kèm các thẻ DB, chỉ nội dung hội thoại ngắn như trước.
- Frontend render plain text và thẻ job; link chi tiết tự dựng `/jobs/{encodeURIComponent(id)}`. Validate API response, ID job và URL danh sách nội bộ; không biến link do AI sinh thành CTA. Nút mở danh sách giữ bộ lọc, trang việc làm chuẩn vẫn áp dụng quy tắc hiển thị riêng (có thể hiện cả tin OPEN đã hết hạn).
- Provider timeout12 giây + DB budget4 giây; chỉ request chat đổi client timeout thành20 giây. Rate limit5/phút/IP, concurrency2 và fallback/abort của AI-CHAT-01 giữ nguyên.

## 3. Đối chiếu nguồn

- `job-catalog.constants.js`, `publicJobQuerySchema`, `matchesPublicFilters`, `normalizeSkill`, `JobApplicationRepository.scanPublicJobs` và route `/jobs/:id` là nguồn contract.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output): ép định dạng JSON, vẫn kiểm tra lại bằng Zod. Gemini không chấp nhận enum có phần tử chuỗi rỗng trong responseSchema; ba trường có thể rỗng dùng type string ở schema provider, enum đầy đủ áp dụng ở backend.
- Chưa đưa dữ liệu DB vào prompt/RAG, chưa cài vector database hoặc thêm index/design document.

## 4. Nhóm case kiểm thử

1. Filter skill alias/AND, từ khóa literal, location/work mode/seniority kết hợp.
2. CLOSED/DRAFT/deleted/expired/deadline missing/schema malformed bị loại.
3. Đọc qua trang đầu100, giới hạn5cards, `has_more`, company dedupe, scan cap/partial.
4. Unsupported khác zero result; DB failure/timeout/abort/cursor đứng khác no match.
5. JSON model sai/field lạ/fake IDs/Mango selector bị chặn trước repository.
6. HTTP chat → intent giả lập → repository HTTP đọc CouchDB giả lập → detail thật; chỉ GET, không writes.
7. Frontend thẻ/link mã hóa/CTA bộ lọc, plain text, partial/empty/error và URL ngoài bị từ chối.
8. Gemini+CouchDB hiện hành qua HTTP và browser, link chi tiết, responsive và regression FAQ.

## 5. File triển khai

Mới: `support-chat-intent.schema.js`, `support-job-search.service.js`, backend `support-job-search.test.js`, frontend `ChatJobResults.jsx`, `support-chat-api.test.jsx`, cùng plan/report này.

Cập nhật: backend `app.js`, support route/service/knowledge, một export trong `job.service.js`; frontend support API/FaqChatbox và tests support-chat; ledger. Không thay `.env`, model, schema dữ liệu nghiệp vụ, dependencies, index hoặc dataset trong AI-CHAT-02.

## 6. Acceptance criteria

- AC01: Tìm tự nhiên trả tin thật và link mở chi tiết200, title/company/filter/deadline khớp dữ liệu.
- AC02: Chỉ đưa tin OPEN, không xoá và còn hạn tại lúc tra cứu; giới hạn5cards, không bịa kết quả.
- AC03: UI hiện tiêu chí đã hiểu, empty/partial/unsupported/DB error phân biệt rõ.
- AC04: Input model được validate, không query/write tùy ý, không gửi DB/PII cho Gemini; URL nội bộ.
- AC05: Conversation/fallback/abort/role guards và quy trình cũ không hồi quy.
- AC06: Full tests/lint/build và browser phù hợp; ghi giới hạn xác minh rõ ràng.

## 7. Trình tự

Đọc contract → structured intent + service đọc → tích hợp route/UI → tập trung backend/frontend tests → sửa tương thích responseSchema bằng lỗi thật → kiểm chứng Gemini/CouchDB + link/browser → full regression → báo cáo/ledger. Không commit/push khi chưa được yêu cầu.
