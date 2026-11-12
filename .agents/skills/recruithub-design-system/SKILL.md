---
name: recruithub-design-system
description: Thiết kế và duy trì hệ thống design tokens, UI primitives, variant và quy ước styling nhất quán cho React 19/Vite 8/Tailwind CSS 3 của RecruiHub. Dùng khi chuẩn hóa màu, font, spacing, buttons, inputs, cards, badges, dialog, table hoặc giảm trùng lặp CSS; cần duyệt trước mọi thay đổi chuẩn chung.
---

# RecruiHub Design System — Tokens, primitives, governance

## 1. Vai trò
Bạn là Design System Architect. Xây dựng nền tảng UI để toàn bộ `Landing / Jobs / Auth / Candidate / Recruiter / Admin` dùng chung **semantic tokens**, UI primitives và guidelines. Không phải tool thay toàn bộ CSS bằng một lệnh. Phải tương thích với React JSX, Tailwind CSS 3, Vite 8 hiện có trừ khi có phê duyệt migration riêng.

## 2. Thứ tự tuân thủ
1. User request và các quy định đang có trong `AGENTS.md`, `docs/ai-frontend-development-guide.md` quyết định phạm vi công việc và cổng phê duyệt.
2. Source of truth nghiệp vụ luôn là CouchDB/schema/routes/business rules theo AGENTS. Design System **chỉ** quản lý presentation và accessibility, không đổi API/data/permission.
3. Template `docs/Job-Application-Portal-Frontend/` đang là chuẩn UI bắt buộc theo frontend guide. Nếu người dùng muốn thay chuẩn, chuẩn bị change proposal rồi dừng chờ duyệt; skill không thể tự bãi bỏ quy tắc cũ.
4. Tôn trọng ownership theo module của nhóm trong AGENTS.md. Đụng shared primitive có phạm vi liên module thì báo tác động và xin duyệt rõ ràng.

## 3. Audit bắt buộc trước khi đề xuất tokens
Đọc `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/features/presentation/portalSurfaces.css`, `frontend/src/main.jsx`, `frontend/src/components/Navbar.jsx`, `frontend/src/features/jobs/components/PublicJobCard.jsx`, `HomeHero.jsx`, các form và dashboard mẫu. Kiểm tra class đã tồn tại `.card`, `.card-portal`, `.btn-primary`, `.btn-secondary`, `.input-field`, `.badge-tag`, `.message-error`, `.message-success` và `--rh-*`; đo ảnh hưởng bởi cascade, `#root:has(...)`, selector phụ thuộc DOM và specificity. Không cho rằng chúng đã đồng nhất chỉ vì tên giống nhau.

## 4. Quy trình
### Stage 0 — Inventory (read-only)
- Tổng hợp token đang dùng với vị trí khai báo và nơi áp dụng: màu brand/neutral/semantic; font; font-size/line-height; spacing; radius; shadow; breakpoint; motion; z-index.
- Thống kê các họ component dùng nhiều: Button, LinkButton, TextField, Select, Textarea, Card, Badge, Alert, Skeleton, Dialog/Drawer, Tabs, Table, PageHeader, EmptyState.
- Gắn nhãn `keep`, `consolidate`, `deprecate`, `needs decision`. Không tự xóa class legacy.
- Kiểm tra sự trùng lặp giữa `index.css`, `portalSurfaces.css`, Tailwind utility strings và CSS inline.

### Stage 1 — RFC/Design decision (chưa code)
Trình bày bảng current → proposed, lý do, impact, backward compatibility và kế hoạch migration. Tối thiểu quyết định:
- Một palette `brand/neutral/success/warning/danger/info`, độ tương phản text/background.
- Typography scale, font fallbacks, line-height.
- Spacing, container width, radius, elevation, border.
- Component variants và sizes; state hover/active/focus/disabled/loading/error.
- Quy tắc semantic token cho dark-on-light/light-on-dark; dark mode **không tự thêm** nếu chưa được giao.
- Phạm vi sở hữu component chung và chính sách không thêm dependency tùy tiện.
- A11y: keyboard focus, label, role, Escape/overlay, WCAG 2.2 AA là **mục tiêu thiết kế**, không tuyên bố đã đạt khi chưa audit.
- Tài liệu nào phải thay đổi để giải quyết mâu thuẫn với template bắt buộc.
Dừng và chờ duyệt Mini Plan theo AGENTS.

### Stage 2 — Implementation (sau duyệt)
- Mục tiêu kiến trúc đề xuất, chỉ tạo khi đã duyệt:
  - `frontend/src/styles/tokens.css` hoặc lớp CSS token hiện hữu (tránh tạo 2 nguồn sự thật).
  - `frontend/src/components/ui/` primitives.
  - `docs/recruithub-design-system.md` làm style guide và change log.
- Semantic tokens: dùng biến CSS `--rh-color-primary`, `--rh-color-surface`, `--rh-color-text`, `--rh-color-border`, `--rh-radius-card`, v.v. Ánh xạ Tailwind theme khi hữu ích, nhưng không bắt buộc đổi đồng thời toàn bộ utility classes.
- API primitive phải đơn giản (`variant`, `size`, `disabled`, `loading`, `className`, `children`, ref nếu cần). Không viết abstraction quá mức, không thêm `cn`, `clsx`, CVA khi chưa đánh giá nhu cầu.
- Ưu tiên migration từng component/page để hạn chế regression; deprecate class cũ trong giai đoạn chuyển tiếp thay vì xóa đột ngột.
- Khi đổi global CSS, test toàn tuyến `Landing/Jobs/Auth/Candidate/Recruiter/Admin` vì selector cũ có thể ảnh hưởng ngầm.
- shadcn/ui/Radix là **lựa chọn tùy chọn** cho tương tác phức tạp, KHÔNG mặc định cài. Xem xét React 19 + Vite 8 + Tailwind 3 + JavaScript JSX và transitive dependencies, licensing, size, compatibility; tạo RFC riêng trước khi cài/upgrade.

## 5. Token baseline để thảo luận — KHÔNG PHẢI QUY ĐỊNH ĐÃ DUYỆT
```
Brand/navy:       #172B52
Brand/primary:    #365FC3
State/success:    #0F9B78
Surface/canvas:   #F5F7FB
Surface/card:     #FFFFFF
```
Các giá trị trên chỉ là **proposal** từ cuộc trao đổi UI; cần kiểm tra contrast và sự tương thích với `portalSurfaces.css` trước khi thông qua. Màu đỏ/purple/amber không được xóa vô điều kiện: có thể là status hoặc semantic encoding của role.

## 6. Component contract checklist
Với mỗi primitive, ghi:
- Purpose và nơi sử dụng; props, variants/sizes và default.
- DOM semantic đúng (`button`, `a`, `label`, `input`) và tương tác bàn phím.
- State (loading/empty/error/success nếu phù hợp), focus, disabled, validation.
- Responsive, long text, tiếng Việt có dấu, contrast.
- Example usage trong ít nhất hai màn hình thật.
- Unit/component test phù hợp; optional screenshot baseline.
- Backward compatibility với class/props hiện hữu.

## 7. Kiểm định bắt buộc
- `cd frontend && npm run lint && npm run build && npm test`.
- Kiểm tra UI thật ở 375 / 768 / 1440 px nếu có browser; nếu thiếu browser, nêu rõ là chưa xác minh visual.
- Kiểm tra primitive trên ít nhất hai vùng giao diện khác nhau; nếu sửa global tokens thì kiểm tra mọi role.
- Báo cáo rõ số file chuyển đổi, class legacy còn tồn tại, các vấn đề cần follow-up.

## 8. Mẫu đầu ra RFC
```
# Design System RFC — [scope]
Current audit: [files and evidence]
Decision log: [proposed token/component decisions; pending approval]
Conflicts: [template/guideline/current CSS]
Proposed structure: [files create/edit]
Compatibility & dependency impact:
Migration: [small vertical slices, legacy fallback]
Risk / rollback / out-of-scope:
Tests / visual QA / acceptance criteria:
Status: WAITING FOR APPROVAL
```
