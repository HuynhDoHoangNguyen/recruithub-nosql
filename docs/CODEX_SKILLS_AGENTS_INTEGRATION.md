# RecruiHub Codex Skills — Quy tắc phối hợp với AGENTS.md

> **Trạng thái: ĐỀ XUẤT, chưa được duyệt và chưa cập nhật GitHub.** Tài liệu này không thay thế `AGENTS.md` hoặc `docs/ai-frontend-development-guide.md` hiện có. Căn cứ: nhánh `dev` repository `HuynhDoHoangNguyen/recruithub-nosql`, đọc ngày 12/11/2026.

## 1. Mục tiêu
Thiết lập ba skill độc lập để Codex không lẫn nhiệm vụ thiết kế trang (UI design), xây dựng chuẩn dùng chung (design system) và kiểm định độc lập (UI audit). Giữ context ngắn bằng metadata/trigger của mỗi skill; chỉ mở các file liên quan tới task, không đổ toàn bộ tài liệu vào mỗi prompt.

## 2. Cấu trúc thư mục đề nghị
```
.agents/skills/
  recruithub-ui-design/SKILL.md
  recruithub-design-system/SKILL.md
  recruithub-ui-audit/SKILL.md
```
Đây là cấu trúc kỹ năng ở cấp repo để Codex có thể đọc từ workspace; kiểm tra tính năng skill đang hỗ trợ trong bản Codex cài đặt. Không tự sửa `.codex/config.toml` hoặc đăng ký MCP khi chưa rõ môi trường người dùng.

## 3. Phân quyền và thứ tự quy tắc
- **AGENTS.md là hợp đồng vận hành chính**: kỹ thuật, nghiệp vụ, phân quyền nhóm, source of truth, cổng Mini Plan/chờ duyệt, hạn chế Git, điều kiện nghiệm thu.
- **docs/ai-frontend-development-guide.md**: chuẩn thực thi frontend hiện hành (bắt buộc đọc template; mapping trước task UI; lint/build).
- **Các SKILL.md**: quy trình chuyên môn chi tiết cho một nhiệm vụ; bổ sung chứ không có quyền thay thế AGENTS.
- **Tài liệu design system đề xuất** (`docs/recruithub-design-system.md`): chỉ có hiệu lực sau khi user duyệt và sửa guideline để dẫn chiếu.
- **Code thật** (`AppRoutes`, component, CSS, API, backend schemas) là bằng chứng trạng thái hiện tại, không thay thế phê duyệt chính sách.
- Khi hai quy tắc mâu thuẫn: ghi `CONFLICT`, viện dẫn vị trí, đề xuất cách sửa, **dừng ở Mini Plan**, chờ phê duyệt. Không chọn quy tắc dễ hơn để triển khai.

## 4. Xung đột cụ thể cần giải quyết trước redesign toàn cục
Hiện `docs/ai-frontend-development-guide.md` nói template `docs/Job-Application-Portal-Frontend/` là **chuẩn trực quan bắt buộc**, không chỉ tài liệu tham khảo. `AGENTS.md` cũng yêu cầu đọc template và guide; frontend production còn CSS `index.css`, `portalSurfaces.css` với nhiều quy tắc sẵn có. Vì vậy palette mới / layout khác template chưa thể tự áp dụng như chuẩn chính thức.

**Đề xuất quy trình thay đổi chuẩn** (không tự thực hiện):
1. Skill audit xác định component/style hiện hành và các xung đột.
2. Skill design system viết RFC bảng tokens + UI primitives + migration plan; đề xuất nội dung cập nhật frontend guide.
3. Người dùng duyệt RFC và phạm vi ảnh hưởng.
4. Chỉnh `docs/ai-frontend-development-guide.md` để quy định cụ thể: template cũ là baseline về cấu trúc/nghiệp vụ; design system mới là chuẩn presentation cho **những trang được phép redesign**. Nếu cần, thêm 1 mục dẫn chiếu vào AGENTS; không đảo thứ tự nguồn sự thật backend.
5. Sau đó mới cho UI design triển khai từng trang; audit kiểm tra regression.

**Không được** dùng skill để lách quy tắc phê duyệt, chỉnh AGENTS tự động hoặc coi việc cài skill là user đồng ý đổi UI guideline.

## 5. Routing: khi nào gọi skill nào?
| Tình huống | Skill chủ | Skill phối hợp | Đầu ra |
|---|---|---|---|
| 'Làm Landing sang trọng' | `recruithub-ui-design` | `recruithub-design-system` để đọc tokens, `recruithub-ui-audit` để test | Mini Plan → implementation sau duyệt → QA |
| 'Đồng bộ nút/card/spacing toàn trang' | `recruithub-design-system` | `recruithub-ui-audit` impact | RFC → token/primitive migration sau duyệt |
| 'Vì sao trang mobile lỗi?' | `recruithub-ui-audit` | `recruithub-ui-design` cho fix đã duyệt | Issue list → Mini Plan |
| 'Kiểm tra PR không đổi logic' | `recruithub-ui-audit` | Không bắt buộc | Evidence report |
| 'Thêm API scoring mới' | Không skill UI làm chủ | Có thể UI design khi có task màn hình | Theo AGENTS vertical slice |

## 6. 7 bước phối hợp chuẩn, không bội thực context
1. **Read & Audit:** mở AGENTS, frontend guide, đúng route và import tree; kiểm tra Git; audit có trọng điểm.
2. **Summarize Understanding:** nêu phạm vi đã đọc và điều chưa xác minh (không tóm tắt cả repo nếu task chỉ là 1 card).
3. **Create Mini Plan:** design/design-system/audit ghi file edit, risk, tests và mâu thuẫn template nếu có.
4. **Await Confirmation:** dừng nếu user chưa duyệt code change; prompt 'chưa sửa GitHub' = read-only.
5. **Implement Within Scope:** sau duyệt, cập nhật UI theo các tokens/component đã thông qua; chỉ sửa frontend trừ khi có quyền cụ thể.
6. **Self-review & Automated Test:** lint, build, test frontend; browser visual nếu có; không giả report PASS.
7. **Evaluate & Report:** diff file + tác động + test thực chạy + lỗi còn lại + bước rollback.

## 7. Đề xuất ĐOẠN BỔ SUNG cho AGENTS.md (CHƯA ÁP DỤNG)
Đặt dưới phần 'Quy tắc Frontend' hoặc mục riêng 'Design System & UI Workflow' sau khi đã duyệt thay đổi guideline:

```markdown
### Design System & UI Skill Routing (approved after explicit review)
- Với tác vụ UI, dùng `.agents/skills/recruithub-ui-design/SKILL.md` để audit/design từng màn hình; dùng `.agents/skills/recruithub-design-system/SKILL.md` để quản lý token/primitive; dùng `.agents/skills/recruithub-ui-audit/SKILL.md` để audit và regression.
- Skills chỉ bổ sung hướng dẫn, không thay thế source of truth, quyền module, yêu cầu Mini Plan/chờ duyệt hay hạn chế Git hiện hành.
- Mọi task UI phải đọc `docs/ai-frontend-development-guide.md` và mẫu UI có liên quan. Nếu redesign khác template/guide hiện hành, chỉ được lập RFC và xin duyệt thay đổi guideline trước khi triển khai.
- Design tokens và shared components đã duyệt là chuẩn cho phạm vi màn hình được cấp phép chuyển đổi; không tự áp dụng sang các trang khác hoặc xóa CSS legacy hàng loạt.
- Không sửa backend, API, role guard, database, scoring, business rules trong task thuần presentation.
- Sau các thay đổi UI: `cd frontend && npm run lint && npm run build && npm test`; browser review trên 375/768/1440 CSS px khi có môi trường. Ghi rõ những phép thử chưa chạy.
```

**Quan trọng:** Khi duyệt design system mới, còn cần sửa **frontend guide** để giải quyết việc template là chuẩn bắt buộc. Chỉ bổ sung AGENTS là chưa đủ.

## 8. Đề xuất patch nội dung frontend guide (KHÔNG ÁP DỤNG)
**Hiện hành:** template là chuẩn trực quan bắt buộc cho mọi task UI.

**Thay thế có kiểm soát sau khi được duyệt:**
> Với màn hình **chưa được phê duyệt redesign**, tiếp tục tuân thủ template UI hiện hành. Với màn hình đã thuộc phạm vi migration được duyệt, áp dụng `docs/recruithub-design-system.md` là nguồn sự thật về visual tokens, primitives, component states; vẫn phải đọc template để bảo toàn layout/chức năng có ý nghĩa nghiệp vụ, nêu mapping và sai khác. Backend schemas/API, business rules, mockups và role permissions không bị thay đổi bởi design system. Nếu phát sinh xung đột, dừng ở Mini Plan và xin quyết định.

Điều này tránh vừa khẳng định template **bắt buộc** vừa yêu cầu agent **khác template**, một tình huống gây kết quả thiếu nhất quán.

## 9. Checkpoint và lệnh kiểm tra
Trước triển khai: `git status --short`, `git branch --show-current`; kiểm tra `frontend/package.json`; không tự chuyển branch.

Sau triển khai (chỉ khi có code change được duyệt):
```bash
cd frontend
npm run lint
npm run build
npm test
```

Visual QA: browser automation/Playwright là **công cụ tùy chọn** cần cài đặt riêng, không đồng nghĩa với ba skill. Khi chưa có browser, chỉ báo là audit tĩnh + test automation nếu đã chạy.

## 10. Prompt gọi skill ví dụ
```
Áp dụng skill recruithub-ui-audit để kiểm kê Landing và JobList trên branch dev.
Chỉ audit, không sửa file. Đọc AGENTS.md, frontend guide, template liên quan,
AppRoutes, CSS và component production. Báo bằng chứng và xung đột.
```
```
Áp dụng skill recruithub-design-system, lập RFC chuẩn hóa Button/Card/Input
cho RecruiHub React JSX + Tailwind 3. Không cài dependency, không đổi code.
Mini Plan chờ duyệt. Nêu migration riêng cho portalSurfaces.css.
```
```
Sau khi RFC/guide đã được phê duyệt: áp dụng skill recruithub-ui-design
để redesign trang /jobs theo token mới. Trước khi code gửi Mini Plan,
role/state matrix, test plan; bảo toàn filter/pagination/API.
```

## 11. Đối chiếu nguồn đã xem trên dev
- `AGENTS.md`: 7-step Agent Detail Loop, không sửa Git/DB trái phép, backend/role/business invariants.
- `docs/ai-frontend-development-guide.md`: template bắt buộc và lint/build; 4 trạng thái UI.
- `docs/recruithub-screen-mockups.md`: route/use-case/wireframe (không mặc định mọi route trong mockup đã implement).
- `frontend/src/routes/AppRoutes.jsx`: nguồn route **thực tế** tại lúc đọc.
- `frontend/src/index.css`, `frontend/src/features/presentation/portalSurfaces.css`, `frontend/tailwind.config.js`: styling hiện tại.
- `frontend/package.json`: React 19, Vite 8, Tailwind 3, Vitest.

## 12. Lưu ý kỹ thuật
- Có file `frontend/src/pages/HomePage.jsx` nhưng route `/` trong `AppRoutes.jsx` trỏ `Landing.jsx`; không nhầm trang phụ với trang đang chạy.
- Một số mockup mô tả `/admin/users`, `/recruiter/interviews` như màn hình hoặc khái niệm, nhưng cần đối chiếu AppRoutes thực tế trước khi đưa vào coverage.
- Việc tách CSS, sửa tên class, cài shadcn/ui hay chuyển Tailwind major version cần RFC riêng; không phải điều kiện tiên quyết để ba skill hoạt động.
