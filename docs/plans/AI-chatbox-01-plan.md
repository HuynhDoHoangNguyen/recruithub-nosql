# AI-CHAT-01 — Tích hợp Gemini cho chatbox client

> Bản mở rộng hiện tại: [AI-CHAT-02 tìm việc từ CouchDB](AI-chatbox-02-job-search.md). Giới hạn “chưa tra cứu DB” trong tài liệu AI-CHAT-01 là phạm vi lịch sử của giai đoạn đầu.

Ngày lập: 16/11/2026. Trạng thái: IMPLEMENTED / TECHNICAL PASS — xem bằng chứng và giới hạn trong báo cáo kết quả. Chuyển từ bản OpenAI theo yêu cầu người dùng; giữ mã AI-CHAT-01.

Áp dụng bố cục của `Mẫu Plan triển khai.txt` do người dùng cung cấp; các ví dụ WDM/MySQL/Java trong mẫu chỉ là nội dung minh họa, không phải yêu cầu của project này. Báo cáo hiện tại theo mẫu thứ hai: [AI-chatbox-01-result.md](../reports/integration/AI-chatbox-01-result.md).

## 1. Mục tiêu

Cho phép khách và Candidate đặt câu hỏi tự do bằng tiếng Việt trong chatbox hiện có, nhận hướng dẫn đúng chức năng RecruiHub, đồng thời vẫn dùng được FAQ khi dịch vụ AI không khả dụng.

Luồng chính:

```text
Client: câu hỏi gợi ý → FAQ có sẵn (không gọi Gemini)
Client: câu nhập tự do → POST /api/v1/support/chat
  → kiểm tra input / giới hạn lượt và concurrency
  → service + kiến thức hướng dẫn đã kiểm tra
  → Gemini generateContent REST API → chuẩn hóa kết quả → UI nhãn AI
Lỗi / chưa cấu hình / quá hạn → UI thông báo + FAQ có sẵn
```

Phạm vi: ô nhập, gửi bằng nút/Enter, lịch sử ngắn trong bộ nhớ tab, trạng thái chờ/lỗi, câu hỏi gợi ý, fallback, cấu hình local và hướng dẫn demo.

Chưa bao gồm tìm việc trực tiếp từ CouchDB, đọc hồ sơ/CV, gửi đơn hộ, upload vào AI, lưu hội thoại vào DB, RAG/vector database, streaming hoặc chat Candidate–Recruiter. Không thay thuật toán chấm điểm hay các UC trong checklist trước.

Ước lượng dự kiến **1,5–3 giờ** sau khi có API key, quyền model và hạn mức hoạt động. Nếu chưa có prerequisite, phần code và test giả lập vẫn làm được; kiểm chứng Gemini thật phải ghi NOT VERIFIED.

## 2. Cách triển khai

### Backend và hợp đồng HTTP

- Tách config, schema, knowledge, service, controller và route theo cấu trúc Express/Zod hiện có; mount route trước handler 404 trong `app.js`.
- Dùng REST generateContent chính thức qua native fetch của Node (không cần thêm dependency SDK). Gọi một lần, không retry tự động, không tools/search/caching/upload. Host cố định; key trong header x-goog-api-key, không trong URL. Không tạo tài nguyên lưu hội thoại ở provider. Chính sách dữ liệu của Google vẫn áp dụng.
- Model mặc định `gemini-3.5-flash-lite`, dòng nhẹ dành cho throughput và đã có Free Tier trong bảng giá; xác nhận quyền gọi bằng key thực tế trước nghiệm thu, có thể thay bằng biến môi trường mà không sửa UI. Đây là lựa chọn kỹ thuật cho phạm vi hỏi đáp, không cam kết model tối ưu hoặc luôn có quyền truy cập.
- Không để key trong React, `VITE_*`, Git, browser response hoặc log. Không trả lỗi thô từ provider.
- Endpoint public để khách sử dụng như FAQ hiện tại. Không dùng token/identity từ frontend làm nguồn kiến thức. Không truy cập repository nghiệp vụ hoặc tự nhận đã xác minh trạng thái tài khoản.
- Rate limit trong bộ nhớ cho demo một process: tối đa 5 request/phút/IP, tối đa 2 request Gemini đồng thời toàn process; bảng IP có TTL/dọn dẹp và giới hạn số entry. Dùng IP do Express xác định, không tự tin cậy `X-Forwarded-For`; không bật `trust proxy` tùy tiện. Nếu deploy nhiều instance cần limiter chia sẻ riêng.
- Giới hạn body endpoint 16 KiB; câu hiện tại 1–1.000 ký tự sau trim; history tối đa 6 message, mỗi message tối đa 1.000 ký tự, tổng history tối đa 4.000 ký tự. Chỉ nhận role `user`/`assistant`, không nhận system/developer instruction từ client. Tất cả history là dữ liệu không tin cậy.
- Timeout provider mặc định 12 giây, output tối đa 500 token. Frontend override timeout riêng request chat thành 15 giây; không thay Axios timeout mặc định 10 giây của API khác.
- Có dependency injection cho client, clock và limiter để test lỗi mà không dùng key hoặc gọi dịch vụ trả phí.

Request dự kiến:

```json
{
  "message": "Em muốn cập nhật kỹ năng thì vào đâu?",
  "history": [
    { "role": "user", "content": "Tôi mới sử dụng website" },
    { "role": "assistant", "content": "Bạn muốn được hướng dẫn thao tác nào?" }
  ]
}
```

Chỉ lấy các lượt đã hoàn tất trước đó làm history; không đưa câu hiện tại vào hai lần. Không nhận URL endpoint, model, key hoặc prompt đặc quyền từ request.

Response thành công sử dụng envelope API hiện có:

```json
{
  "success": true,
  "data": { "mode": "ai", "reply": "Bạn mở Hồ sơ cá nhân, chọn Chỉnh sửa hồ sơ…" },
  "message": "Đã nhận hướng dẫn từ trợ lý AI."
}
```

| Tình huống | HTTP / mã ổn định dự kiến | UI |
|---|---|---|
| Input rỗng/quá dài/history sai/field lạ | 400 `CHAT_INVALID_INPUT`; body quá lớn 413 | Giữ nội dung để sửa; không gọi AI |
| Tắt AI hoặc thiếu key/model | 503 `CHAT_UNAVAILABLE` | Thông báo chưa khả dụng và hiện FAQ |
| Chạm giới hạn cục bộ | 429 `CHAT_RATE_LIMITED`, `Retry-After` | Báo chờ, FAQ vẫn dùng được |
| Provider 401/403/quota429/rate429/5xx/network | 503 `CHAT_UNAVAILABLE` | Không logout website; thông báo + FAQ |
| Timeout provider | 504 `CHAT_TIMEOUT` | Báo quá hạn, hiện FAQ; không tự gửi lại |
| Provider trả rỗng/refusal/kết quả chưa hoàn tất | 503 `CHAT_UNAVAILABLE` | Không hiển thị kết quả trống như thành công |

Không truyền nguyên provider 401 ra frontend vì interceptor hiện tại sẽ logout người dùng. Cần bảo toàn handler lỗi API hiện có; không đổi cơ chế lỗi của các route khác.

### Kiến thức và hành vi trả lời

- Viết knowledge ngắn bằng tiếng Việt dựa vào `AppRoutes.jsx`, Profile, JobDetails, ApplyModal và Candidate dashboard đã kiểm tra.
- Có hướng dẫn tìm kiếm/lọc, cập nhật hồ sơ, ba cách cung cấp CV, điều kiện tin còn mở/còn hạn, xem tiến trình, rút và nộp lại khi đủ điều kiện.
- Prompt yêu cầu trả lời ngắn, không bịa dữ liệu công ty/công việc/tài khoản, không tự nhận đã sửa hồ sơ hoặc nộp đơn; nếu thiếu kiến thức thì nói rõ và gợi ý FAQ.
- Không coi nội dung người dùng/history là lệnh thay prompt hệ thống. Test một số câu yêu cầu bỏ qua hướng dẫn; test này kiểm tra hành vi mẫu, không chứng minh chống prompt injection tuyệt đối.
- Câu hỏi ngoài phạm vi được hướng về nghiệp vụ website. Knowledge có phiên bản; không tải toàn bộ Word hoặc database vào prompt.

### Frontend và fallback

- Giữ phạm vi hiển thị guest/Candidate; ẩn trên auth/Admin/Recruiter như hiện tại.
- Giữ các nút FAQ và CTA đã có. Tách dữ liệu FAQ dùng cho trả lời tĩnh/fallback để tránh viết hai bộ nội dung khác nhau.
- Thêm input có label, bộ đếm 1.000 ký tự, nút Gửi, trạng thái Đang trả lời; Enter gửi, Shift+Enter xuống dòng, không gửi khi IME đang composition.
- Chặn double-submit bằng cả trạng thái và ref/guard; một lần gửi chỉ một HTTP request; không auto retry.
- Hiển thị transcript có giới hạn, phân biệt “Bạn”, “AI” và “FAQ”; không trộn thông báo fallback thành câu AI trả lời thành công.
- Khi lỗi, giữ câu hỏi và giải thích ngắn. Chọn được chủ đề thì hiện FAQ tương ứng; nếu không xác định được, hiện bốn câu hỏi gợi ý, không bịa câu trả lời.
- Gợi ý CTA lấy từ danh sách route cố định của app. Render AI như plain text, không `dangerouslySetInnerHTML`, không tự biến URL bất kỳ do AI sinh thành nút điều hướng.
- Bổ sung thông báo gần ô nhập: câu hỏi được gửi tới Gemini; không nhập mật khẩu/thông tin nhạy cảm; AI có thể trả lời chưa chính xác. Không tự đính kèm identity, JWT, email, CV hoặc dữ liệu ứng tuyển. Nội dung người dùng tự nhập vẫn được gửi tới provider và phải được thông báo rõ.
- Lưu transcript trong React state; không localStorage/sessionStorage/DB. Giới hạn hiển thị khoảng 12 message, truncate history theo contract khi gửi. Đổi identity/logout thì hủy request và xóa transcript.
- Abort khi đóng/unmount hoặc sang trang ẩn chatbox; response muộn không được mở lại panel, xóa FAQ đang xem hoặc ghi sang phiên khác. Abort phía client không bảo đảm provider chưa tính phí.
- Có nút Xóa hội thoại để bắt đầu lại; nút này hủy request trước khi reset. Giữ Escape, focus về nút mở và cuộn nội dung trong khung trên mobile.

## 3. Đối chiếu với hệ thống và Gemini

| Nguồn | Điều đã xác nhận | Áp dụng |
|---|---|---|
| `backend/src/config/load-environment.js` | Ưu tiên process env → `backend/.env` → `.env` gốc; không override giá trị có sẵn | Dùng `.env` gốc, kiểm tra override khi chẩn đoán; không in key |
| `frontend/src/services/api.js` | Timeout 10 giây; 401 kích hoạt logout | Override timeout cho chat; map provider 401 sang lỗi support 503 |
| `frontend/src/routes/AppRoutes.jsx` | `/jobs`, `/profile`, `/user/dashboard`, `/login` | CTA giữ route thật và login return path |
| FAQ hiện có | Bốn chủ đề đã chạy, chưa gọi AI | Giữ đường trả lời tĩnh, mở rộng input riêng |
| Gemini generateContent REST API | Backend fetch, key từ environment, tạo response | Tích hợp server-side; test thật sau khi có key |

Nguồn chính thức đã đối chiếu khi triển khai:

- [Gemini generateContent API](https://ai.google.dev/api/generate-content).
- [Gemini 3.5 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite).
- [Free Tier và chính sách dữ liệu](https://ai.google.dev/gemini-api/docs/pricing).
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits): RPM/TPM/RPD tính theo project, không theo số key. Xem hạn mức thực tế trong AI Studio; không cam kết model có quota cao nhất cho mọi project.
- [Tạo và giữ API key ở server](https://ai.google.dev/gemini-api/docs/api-key).

Test provider giả lập chỉ chứng minh contract/nhánh lỗi; không thay thế bằng chứng gọi Gemini thật. Không yêu cầu câu AI giống từng chữ vì đầu ra không xác định; đánh giá đúng phạm vi, thao tác và không bịa hành động.

## 4. Tám nhóm case dự kiến

| Case | Nội dung | Bằng chứng cần có |
|---|---|---|
| 01 — Cấu hình | enabled/disabled/thiếu key/placeholder; không làm server chết; env override | Unit/config; HTTP thiếu cấu hình |
| 02 — AI hợp lệ | Câu hỏi tự do tiếng Việt, lịch sử ngắn, đúng model/token/timeout | Test service+route; một lượt provider thật |
| 03 — Input | Rỗng, khoảng trắng, quá dài, role giả, field lạ, history/body quá mức | API 400/413; provider call count bằng 0 |
| 04 — Fallback | Thiếu key, provider auth/quota/network/5xx, timeout, empty/refusal/incomplete | Lỗi giả lập có kiểm soát + browser FAQ vẫn dùng được |
| 05 — Chi phí và gửi lặp | Double-click/Enter, rate/concurrency cap, Retry-After, không retry tự động | Request counters; limiter với clock test |
| 06 — Kết quả đến muộn | Đóng, xóa hội thoại, unmount, đổi trang/identity/logout rồi trả response | Frontend deferred response và assertion |
| 07 — Nội dung và dữ liệu | Ngoài phạm vi, yêu cầu lộ prompt/key, HTML/URL độc hại; không tự đính kèm PII/token | Payload assertions, text rendering, vài live prompt nếu có key |
| 08 — UI và hồi quy | Guest/Candidate, CTA login-return, desktop/mobile, keyboard/IME, FAQ offline | Browser thật; front/back tests, lint/build |

Các lỗi provider được inject trong test, không cố tình dùng key sai hoặc làm cạn quota thật. Không chạy test mặc định với key trả phí.

## 5. File dự kiến

### File mới

| File | Trách nhiệm |
|---|---|
| `backend/src/config/support-chat.config.js` | Đọc/validate cấu hình, disabled an toàn |
| `backend/src/schemas/support-chat.schema.js` | Request Zod và giới hạn |
| `backend/src/services/support-chat.knowledge.js` | Knowledge và instruction đã đối chiếu |
| `backend/src/services/support-chat.service.js` | Gọi generateContent, normalize output/error, timeout |
| `backend/src/controllers/support-chat.controller.js` | Chuyển HTTP input/output |
| `backend/src/routes/support-chat.routes.js` | Endpoint, body cap, limiter |
| `backend/src/middleware/support-chat-limit.js` | Rate/concurrency cap, cleanup |
| `backend/tests/recruitment/support-chat.test.js` | Config/service/API/error/limiter tests |
| `frontend/src/api/supportChatApi.js` | Request chat, timeout riêng, abort |
| `frontend/src/components/support/faqTopics.js` | Tách FAQ hiện có và mapping fallback |
| `frontend/tests/support-chat.test.jsx` | Input/transcript/fallback/race conditions |

### File cập nhật

| File | Thay đổi |
|---|---|
| `backend/src/app.js` | Mount route và DI cho test |
| `frontend/src/components/support/FaqChatbox.jsx` | Form chat và UI trạng thái/fallback |
| `frontend/tests/faq-chatbox.test.jsx` | Giữ regression FAQ và CTA |
| `.env.example` | Biến mẫu, không secret |
| `.env` gốc (Git ignored) | Thêm cấu hình, để người dùng tự dán API key local |
| `AGENTS.local.md` | Ghi trạng thái và kiểm chứng thực tế |
| Tài liệu plan/result này | Cập nhật trạng thái, hướng dẫn demo, kết quả |

Danh sách trên là phạm vi triển khai (không cần thay package/lock vì dùng native fetch). Giữ các thay đổi FAQ chưa commit hiện tại; không reset/stash/commit/push hoặc chuyển nhánh. Không tạo lại bộ script demo/evidence dư thừa vừa dọn. Nếu cần ảnh, lưu ngoài source và chỉ giữ bản kết quả ngắn.

## 6. Acceptance criteria

Trạng thái AC thực tế xem [báo cáo kết quả](../reports/integration/AI-chatbox-01-result.md); bảng dưới là tiêu chí nghiệm thu.

| AC | Điều kiện đạt | Bằng chứng |
|---|---|---|
| AI-01 | Guest/Candidate hỏi tự do được; UI ghi rõ AI; gọi Gemini thật thành công | HTTP/UI và kết quả đã bỏ secret |
| AI-02 | Câu hỏi gợi ý vẫn chạy FAQ mà không gọi provider | Call count và UI |
| AI-03 | Hướng dẫn đúng tìm việc/hồ sơ/CV/ứng tuyển/theo dõi; không tự nhận sửa dữ liệu | Knowledge review, test và live sample |
| AI-04 | Key chỉ ở backend env, không log/response/bundle/Git; request không tự kèm dữ liệu nghiệp vụ | Diff/build/payload audit |
| AI-05 | Validation/rate/concurrency/token/timeout đúng contract; không auto retry | Unit/API và counters |
| AI-06 | Thiếu key/provider lỗi/timeout/empty có thông báo và FAQ; không logout do provider401 | Negative tests và browser |
| AI-07 | Không gửi lặp hoặc áp dụng response muộn sau reset/ẩn/đổi phiên | Deferred tests |
| AI-08 | Plain text rendering, CTA allowlist, login-return đúng | Frontend/security cases |
| AI-09 | Desktop/mobile không tràn; có label/focus/Escape/IME | UI thật ở 1440 và 375 px + tests |
| AI-10 | Regression front/back, lint/build đạt; tài liệu khớp kết quả, không thay DB | Native exit + report; runtime không có repository mutation |

Thiếu key/quota/model access thì AI-01 chưa đạt. Không dùng test mock hoặc fallback để ghi đã tích hợp Gemini thật thành công. Các case không chạy ghi NOT VERIFIED và nêu prerequisite.

## 7. Trình tự thực hiện

1. Ghi trạng thái Git, giữ FAQ hiện tại; xác nhận không có source AI sẵn.
2. Chuẩn bị config, REST client, schema, knowledge và service với DI; chưa cần key thật để viết test.
3. Mount route, limiter và error mapping; chạy backend tests tập trung.
4. Tách FAQ, thêm API client/form/transcript/fallback và kiểm thử race conditions.
5. Thêm mẫu env; bổ sung biến vào `.env` local theo mục 8 mà không ghi đè cấu hình DB/Auth. Key trống thì giữ AI disabled.
6. Người dùng tạo và tự dán key; bật AI rồi restart backend. Không cần rebuild frontend khi đổi key.
7. Gọi smoke test thật bằng vài câu hướng dẫn không chứa PII; ghi mode/HTTP/pass-fail, không ghi key hoặc transcript nhạy cảm.
8. Kiểm tra browser AI/FAQ/login-return/mobile, negative cases bằng harness giả lập.
9. Chạy `npm test` backend/frontend, `npm run lint` và `npm run build` frontend. Backend không thay logic nghiệp vụ nhưng mount route cần regression.
10. Đối chiếu AC, cập nhật báo cáo theo mẫu, dọn đúng tài nguyên test; không tự commit/push.

Phân bổ: backend/config/API khoảng 35–60 phút; frontend/fallback khoảng 30–50 phút; tests/live verification/tài liệu khoảng 25–70 phút. Thời gian xử lý tài khoản/billing nằm ngoài ước lượng.

## 8. Hướng dẫn tạo API key và thêm `.env`

Cấu hình đã được thêm vào .env local; key người dùng cung cấp đã lưu local, không ghi vào tài liệu hoặc Git. Smoke test Gemini thật đã trả HTTP 200. Hướng dẫn tạo/thay key:

1. Mở [Google AI Studio API keys](https://aistudio.google.com/apikey), đăng nhập Google. Chọn/tạo project dành cho RecruiHub, kiểm tra project ở Free Tier. Không cần bật billing để chạy phạm vi Free Tier; nếu project đã gắn billing, request có thể tính phí theo tier đó.
2. Chọn Create API key, chọn project và tạo key. Các điều khoản hoặc xác minh tài khoản do bạn thực hiện trên giao diện Google.
3. Copy key và tự dán vào dòng GEMINI_API_KEY trong file .env gốc project. Không tạo biến VITE_GEMINI_API_KEY; không gửi key lên chat/Git. Key đã xuất hiện trong hội thoại nên nên tạo key mới, cập nhật local rồi thu hồi key cũ.
4. Các biến đã chuẩn bị:

```dotenv
GEMINI_API_KEY=PASTE_YOUR_API_KEY_LOCALLY
GEMINI_MODEL=gemini-3.5-flash-lite
SUPPORT_CHAT_AI_ENABLED=true
SUPPORT_CHAT_TIMEOUT_MS=12000
SUPPORT_CHAT_MAX_OUTPUT_TOKENS=500
SUPPORT_CHAT_RATE_LIMIT_PER_MINUTE=5
SUPPORT_CHAT_MAX_CONCURRENT=2
```

5. Loader ưu tiên process env → backend/.env → .env gốc. Khi chẩn đoán chỉ kiểm tra nguồn và có/không, không in key. File .env.example giữ key trống và AI tắt mặc định. Key thiếu/placeholder vẫn fallback an toàn ngay cả khi flag bật.
6. Restart backend bằng npm start trong backend; frontend dùng npm run dev. Mở Hỗ trợ và nhập một câu hỏi tự do. Nhãn AI · Gemini chỉ xuất hiện khi nhận câu trả lời thành công.
7. Xem [quota thực tế của project](https://aistudio.google.com/rate-limit). App giới hạn 5 request/phút/IP và 2 lượt đồng thời; đây không phải quota do Google cấp. Không tự đổi project/key để vượt quota. Khi Google429, dùng FAQ, không auto retry.
8. Theo [bảng giá Google](https://ai.google.dev/gemini-api/docs/pricing), Free Tier có thể dùng nội dung để cải thiện sản phẩm. UI thông báo việc gửi câu hỏi/lịch sử tới Google; không tự lấy CV/hồ sơ và khuyến cáo không nhập dữ liệu nhạy cảm. Ứng dụng không có cơ chế kiểm tra billing tier của key, nên không thể đảm bảo miễn phí nếu người dùng dùng project trả phí.

## 9. Kịch bản demo dự kiến sau khi hoàn tất

1. Bấm Hỗ trợ → câu gợi ý “Tìm việc như thế nào?” → chỉ ra câu trả lời FAQ và nút mở việc làm.
2. Nhập tự do “Em mới dùng website, muốn bổ sung kỹ năng rồi nộp CV thì làm sao?” → chờ câu trả lời nhãn AI.
3. Bấm CTA cố định để mở Hồ sơ/Việc làm; guest đi qua login trước khi vào trang bảo vệ.
4. Trình diễn fallback bằng tắt cấu hình AI local và restart backend, hoặc lỗi mạng có kiểm soát; không trình chiếu `.env`/API key. FAQ vẫn dùng được.
5. Thuyết trình: “AI xử lý câu hỏi tự nhiên từ kiến thức hướng dẫn đã cung cấp. CouchDB vẫn lưu dữ liệu tuyển dụng; phiên bản này chưa truy vấn việc làm hoặc hồ sơ qua AI. Khi API lỗi, FAQ giúp người dùng tiếp tục thao tác.”
