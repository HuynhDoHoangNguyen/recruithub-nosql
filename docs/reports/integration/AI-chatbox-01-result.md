# AI-CHAT-01 — Task Result

> Báo cáo bản mở rộng hiện tại: [AI-CHAT-02 tìm việc từ CouchDB](AI-chatbox-02-result.md). Phần dưới ghi nhận nghiệm thu lịch sử của AI-CHAT-01.

## Task Result

Status: **TECHNICAL PASS — đã tích hợp Gemini và FAQ fallback; chờ người dùng nghiệm thu.**

Ngày: 16/11/2026. Chuyển từ kế hoạch OpenAI sang Gemini Free Tier theo yêu cầu. Model mặc định `gemini-3.5-flash-lite`, đã gọi API thật thành công. Không xác nhận quota hoặc billing tier riêng của project chỉ từ một request thành công.

## Implemented

- Endpoint public `POST /api/v1/support/chat`: Zod validation, body 16 KiB, input 1.000 ký tự, history 6 message/tổng 4.000 ký tự, output 500 token, timeout 12 giây.
- Gọi Gemini generateContent REST bằng native fetch một lần, host cố định, key trong header; không thêm SDK hoặc retry tự động. Provider 401/403/429/network/5xx được chuẩn hóa thành 503; timeout 504, không làm logout website do lỗi key của AI.
- Limiter 5 request/phút/IP, 2 lượt đồng thời/process, bucket hết hạn và cap 1.000 IP. Không bật trust proxy hoặc dựa vào header IP tự khai.
- Client có ô nhập, Enter/Shift+Enter/IME, lịch sử ngắn, nhãn AI/FAQ, thông báo gửi nội dung tới Gemini, nút Xóa hội thoại; giữ CTA bảo vệ theo role.
- Câu gợi ý dùng FAQ local, không gọi provider. Khi lỗi, báo rõ và chọn FAQ liên quan hoặc hiện bốn gợi ý; giữ câu hỏi để sửa/thử lại.
- Hủy request khi đóng/reset/unmount/đổi identity/chọn FAQ; không áp dụng response muộn. AI được render plain text; URL AI sinh không trở thành link tự động.
- `.env.example` thêm biến mẫu; `.env` local đã có key người dùng cung cấp, flag bật và model mặc định. Không đưa key vào Git/log/bundle. Backend đã restart với AI bật sau kiểm thử fallback.
- Cập nhật [plan](../../plans/AI-chatbox-01-plan.md), gồm hướng dẫn tạo/thay key tại mục 8. Không mở rộng AI sang CouchDB/CV hoặc quyết định tuyển dụng.

## Files Changed

Backend mới:
- `backend/src/config/support-chat.config.js`
- `backend/src/schemas/support-chat.schema.js`
- `backend/src/services/support-chat.knowledge.js`
- `backend/src/services/support-chat.service.js`
- `backend/src/controllers/support-chat.controller.js`
- `backend/src/middleware/support-chat-limit.js`
- `backend/src/routes/support-chat.routes.js`
- `backend/tests/recruitment/support-chat.test.js`

Frontend mới/tách từ FAQ:
- `frontend/src/api/supportChatApi.js`
- `frontend/src/components/support/faqTopics.js`
- `frontend/tests/support-chat.test.jsx`

Cập nhật `backend/src/app.js`, `frontend/src/components/support/FaqChatbox.jsx`, `.env.example`, `.env` local (ignored), ledger và hai tài liệu plan/result. `frontend/src/App.jsx` và test FAQ đã có thay đổi chưa commit từ task FAQ trước, được giữ nguyên. Không thay package/lock, dữ liệu lịch sử hoặc DB. Chưa stage/commit/push.

## Tests Executed

| Kiểm chứng | Kết quả |
|---|---|
| Backend support-chat tập trung | 17/17 PASS |
| Frontend FAQ + AI tập trung | 23/23 PASS (11 FAQ + 12 AI) |
| Backend npm test | 754 PASS, 0 FAIL, 9 SKIP; tổng 763 |
| Frontend npm test | 278 Vitest + 7 Node PASS; 0 FAIL |
| Frontend lint | PASS, 0 warning sau bỏ import thừa |
| Frontend build | PASS; JS bundle 1.089,24 kB, cảnh báo chunk >500 kB |
| Native syntax + diff/secret audit | PASS: kiểm tra 19 file pending, không có secret đã cấu hình trong source/docs, JS syntax sạch; whitespace file mới + git diff --check sạch. Markdown hard line breaks cũ giữ nguyên |
| HTTP tới backend thật → Gemini | HTTP200, mode=ai, provider=gemini; hướng dẫn hồ sơ/kỹ năng/CV đúng phạm vi |
| Gemini hội thoại có history | HTTP200; câu tiếp nối được hướng dẫn vào /user/dashboard để theo dõi đơn |
| Browser → backend → Gemini thật | Gửi câu hỏi tự do, thấy trạng thái chờ và AI · Gemini, nội dung đúng luồng |
| Browser fallback thật | Tạm tắt AI bằng env của process, gửi câu hỏi theo dõi đơn → báo chưa khả dụng + FAQ theo dõi + CTA login |
| Browser responsive | Đã xem ảnh mobile375/desktop1440; DOM xác nhận form/nút gửi trong viewport, không tràn ngang |
| Prompt ngoài phạm vi (một live sample) | Không tự xác nhận được tuyển, từ chối cung cấp key; hướng về chức năng website |

Frontend test runner có thông báo jsdom `Not implemented: navigation to another Document` từ test sẵn có; tổng suite vẫn PASS. Chín backend skip giữ từ baseline, không coi là test đã chạy.

Log kiểm thử lưu ngoài source trong thư mục TEMP của Windows: `recruithub-gemini-backend-tests.log`, `recruithub-gemini-frontend-tests.log`. Không tạo lại bộ file evidence/script demo đã dọn. Lượt live chỉ gửi câu hỏi synthetic, không gửi CV/tài khoản; không lưu key hoặc transcript nhạy cảm trong báo cáo.

## Research Fidelity

- **Source-confirmed:** route/role hiện có, env priority process → backend/.env → root .env; Axios 10 giây được override riêng chat thành 15 giây; Gemini REST/header/systemInstruction/contents; Flash-Lite có Free Tier theo [bảng giá](https://ai.google.dev/gemini-api/docs/pricing).
- **Implementation inference:** chọn Flash-Lite cho độ trễ và hỏi đáp ngắn; giới hạn 5/phút/IP, concurrency2; knowledge support-v1, fallback keyword và giới hạn lịch sử.
- **Unspecified / unresolved:** quota RPM/TPM/RPD và billing tier riêng của tài khoản, model nào có quota cao nhất cho project, chất lượng trên mọi cách diễn đạt, mạng lớp học, production scale. Hạn mức tính theo project theo [Google](https://ai.google.dev/gemini-api/docs/rate-limits); không nhân quota bằng tạo thêm key.

## Acceptance Criteria

| AC | Kết quả | Phạm vi bằng chứng |
|---|---|---|
| AI-01 | PASS | Guest browser/live Gemini200; Candidate sử dụng cùng form, kiểm chứng role/CTA bằng tests |
| AI-02 | PASS | FAQ local, test provider call count bằng0 |
| AI-03 | PASS có giới hạn | Knowledge từ source, live hướng dẫn CV/hồ sơ và một case ngoài phạm vi; không chứng minh mọi câu trả lời đều đúng |
| AI-04 | PASS | Env ignored, payload allowlist, không truyền identity/DB; quét secret cuối |
| AI-05 | PASS | Input/body/limiter/concurrency/timeout tests; cap output trong payload |
| AI-06 | PASS | Provider errors bằng test injection; browser AI disabled → FAQ thật |
| AI-07 | PASS | Deferred tests cho đóng/reset/FAQ/unmount/identity; không apply late reply |
| AI-08 | PASS | Plain-text injection test, CTA cố định và FAQ login-return regression |
| AI-09 | PASS | Mobile375, desktop1440, keyboard/focus/Escape/IME tests; chưa test bàn phím ảo trên thiết bị thật |
| AI-10 | PASS | Regression, lint/build; route không dùng repository nghiệp vụ, không migration/DB writes |

## Risks / Deviations

- Dùng REST chính thức bằng fetch thay SDK trong bản plan OpenAI cũ; không cần dependency/lock mới và không có SDK retry ngầm. Request không tạo tài nguyên hội thoại; không áp dụng tham số store:false của OpenAI sang Gemini.
- AI có thể trả lời sai; một mẫu prompt injection không chứng minh chống injection tuyệt đối. Không có tool hoặc quyền mutation nghiệp vụ.
- Free Tier có điều kiện và quota thay đổi theo project. Dùng key của project trả phí có thể phát sinh phí; ứng dụng không tự kiểm tra hoặc chuyển billing tier. UI thông báo gửi nội dung tới Google; policy Free Tier có thể dùng nội dung để cải thiện sản phẩm.
- Key đã được người dùng gửi vào hội thoại; nên tạo key mới, cập nhật `.env` local rồi thu hồi key cũ. Không ghi giá trị key vào báo cáo.
- Limiter trong bộ nhớ chỉ phù hợp demo một process, không phải cơ chế phân tán hoặc trần chi phí tuyệt đối. Khi abort ở client, không bảo đảm provider chưa xử lý request.
- Browser thật kiểm tra luồng Guest; Candidate được kiểm chứng component/route tests, chưa thao tác đăng nhập Candidate thật trong task này. Cảnh báo bundle lớn vẫn còn.

## Recommended Next Task

Người dùng demo/nghiệm thu tại `http://127.0.0.1:5178`: Hỗ trợ → hỏi tự do về hồ sơ/ứng tuyển → đối chiếu nhãn AI; thử câu hỏi gợi ý → nhãn FAQ. Sau đó thay key đã chia sẻ và kiểm tra quota trong AI Studio. Chưa bắt đầu tra cứu CouchDB qua AI hoặc các UC khác.
