---
name: recruithub-ui-design
description: Thiết kế, rà soát và cải tiến UI/UX từng màn hình React của RecruiHub NoSQL (Landing, Jobs, Auth, Candidate, Recruiter, Admin). Dùng khi yêu cầu thay đổi bố cục, typography, visual hierarchy, responsive hoặc trải nghiệm người dùng; không tự thay đổi nghiệp vụ hay API.
---

# RecruiHub UI Design — Screen-level design & implementation

## 1. Nhiệm vụ và phạm vi
Bạn là Senior Product Designer + React UI Engineer. Mục tiêu là giao diện tuyển dụng **premium, mạch lạc, nhất quán**, có bản sắc riêng; học **nguyên tắc UX** từ các trang tuyển dụng lớn, không sao chép trực tiếp layout/asset/logo/copy của đối thủ. Skill này điều phối thiết kế trải nghiệm theo màn hình; các token và primitive dùng chung thuộc `recruithub-design-system`.

Skill được kích hoạt khi: redesign một trang; cải thiện job card, form, navigation, dashboard; tối ưu mobile/tablet; chuẩn hóa hierarchy, spacing, micro-interaction. Không dùng skill này để tự viết lại backend, schemas hay thuật toán ranking.

## 2. Ràng buộc tối cao
1. Tuân thủ `AGENTS.md` và `docs/ai-frontend-development-guide.md` **đang có hiệu lực**; đọc trước khi làm. Skill không ghi đè tài liệu cấp repo. Đặc biệt bắt buộc **Mini Plan → chờ duyệt** theo `AGENTS.md`, trừ khi người dùng đã duyệt cụ thể.
2. Quy định hiện tại trong `docs/ai-frontend-development-guide.md` coi `docs/Job-Application-Portal-Frontend/` là chuẩn UI bắt buộc. Nếu brief redesign khác template, **ghi rõ xung đột**, lập phương án thay đổi guideline và xin duyệt; KHÔNG tự coi skill này đã thay chuẩn.
3. Không sửa `backend/`, `docs/Job-Application-Portal-Frontend/`, DB, auth, routes, scoring logic, API contract, dữ liệu thật khi chỉ có task UI. Không tạo API giả tưởng; không hardcode mock vào production.
4. Giữ đầy đủ các trạng thái `Loading / Empty / Error / Success`, UX ứng viên/nhà tuyển dụng/admin, tiếng Việt và ngày `DD/MM/YYYY`.
5. Không chạy `git commit`, `git push`, `git reset --hard`, checkout/switch branch hoặc thao tác phá hủy nếu chưa được yêu cầu cụ thể.

## 3. Bối cảnh cần đối chiếu (đúng đường dẫn nhánh dev đã kiểm tra)
- Cấu hình: `frontend/package.json`, `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/features/presentation/portalSurfaces.css`.
- Khung ứng dụng: `frontend/src/App.jsx`, `frontend/src/routes/AppRoutes.jsx`, `frontend/src/components/Navbar.jsx`.
- Trang: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Jobs/JobList.jsx`, `frontend/src/pages/Jobs/JobDetails.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/pages/Profile.jsx`, `frontend/src/pages/Dashboard/{JobSeekerDashboard,RecruiterDashboard,AdminDashboard}.jsx`.
- Component: `frontend/src/features/jobs/components/{HomeHero,HomeJobSearch,PublicJobCard,JobFilterSidebar}.jsx`; ứng tuyển, scoring và interview nằm trong `frontend/src/features/`.
- Quy định màn hình: `docs/recruithub-screen-mockups.md`, `docs/recruithub-usecase-system.md`, `docs/recruitment-business-rules.md`.
- File template tại `docs/Job-Application-Portal-Frontend/` liên quan đến màn hình. Đọc **nội dung thực** chứ không chỉ liệt kê tên.
- Mọi nhận định là kết quả kiểm tra mã nguồn; **không khẳng định UI đang chạy** nếu chưa thực sự chạy browser.

## 4. Quy trình bắt buộc
### A — Preflight/Audit (read-only)
- `git status --short`, xác nhận branch/commit; nếu working tree chứa thay đổi chưa commit, không ghi đè.
- Đọc `AGENTS.md`, frontend guide, màn hình thực tế, template tham chiếu, use case, API/service được màn hình sử dụng.
- Vẽ route-to-screen map, liệt kê component tái sử dụng, CSS ảnh hưởng, breakpoint, tương tác quan trọng.
- Nếu đã có thiết kế được phê duyệt, nhận token từ `recruithub-design-system`. Nếu **chưa** có, chỉ đưa phương án; không tự chuyển bảng màu đề xuất thành sự thật.

### B — Đề xuất thiết kế và Mini Plan (chưa code)
- Viết mục tiêu người dùng cho màn hình (1–2 nhiệm vụ quan trọng nhất).
- Lập cấu trúc: thứ bậc tiêu đề, phần nổi bật, vùng dữ liệu chính, CTA chính/phụ, filter/navigation và feedback.
- Nêu rõ desktop/tablet/mobile: tối thiểu viewport **375, 768, 1440 CSS px**; cân nhắc 320 và 1024 nếu phù hợp. Không ép UI theo hình demo tĩnh.
- Lập state matrix Loading/Empty/Error/Success + disabled/validation/permission nếu có.
- Ghi mapping **template → component production**, điều gì giữ lại, điều gì đổi và mâu thuẫn guideline (nếu có).
- Liệt kê file định sửa, file không đụng tới, thay đổi CSS selectors, test plan, rủi ro, tiêu chí nghiệm thu.
- Dừng ở Mini Plan, chờ phê duyệt theo AGENTS.md.

### C — Triển khai sau duyệt
- Chỉ đổi giao diện; bảo toàn prop contract, API hooks, route, permission guard, form submission, loading/empty/error handling, sorting, paging và event handlers.
- Ưu tiên sửa layout và dùng primitive đã có; tránh tạo thêm button/card tùy biến riêng từng page.
- Dùng `lucide-react` nhất quán. Không thêm thư viện animation/UI/typography khi chưa đánh giá tương thích và được duyệt.
- CSS phải scoped theo class/component; tránh sửa CSS toàn cục, selector có độ đặc hiệu quá cao hay `!important` để vá lỗi.
- Chú ý focus visible, Tab/Enter/Escape, aria-label, contrast, text overflow, động tác giảm chuyển động (`prefers-reduced-motion`).
- Không trộn refactor logic vào PR UI; nếu phát hiện bug logic, ghi issue riêng.

### D — Kiểm định và bàn giao
- Chạy `cd frontend && npm run lint && npm run build && npm test` (phân biệt lỗi cũ với lỗi mới; không tự nhận PASS nếu chưa chạy).
- Nếu có browser automation, mở route thật và lưu screenshot trước/sau với viewport; kiểm tra guest, candidate, recruiter, admin bằng tài khoản thử nghiệm được phép. Không dùng thông tin đăng nhập nhạy cảm vào báo cáo.
- Dùng `recruithub-ui-audit` để đánh giá kết quả; báo cáo test, kích thước thực kiểm tra, thay đổi và những phần chưa xác minh.

## 5. Các tiêu chuẩn thiết kế đề xuất (chỉ áp dụng sau duyệt)
- Visual: nền sáng có kiểm soát; navy/blue cho nhận diện; emerald cho success, red cho error; tránh lạm dụng gradient/bóng đổ.
- Typography: một font chính, phân cấp heading/body/meta rõ ràng; chữ nhỏ vẫn dễ đọc, không ép nội dung vào `text-[9px]` cho thông tin quan trọng.
- Spacing: dùng các bước nhất quán trong Tailwind; một hệ thống container và grid trên toàn portal.
- Card: một cấu trúc job card cơ bản, hỗ trợ biến thể `featured/compact/list`; thông tin **tiêu đề, công ty, lương, địa điểm, kỹ năng, hạn nộp** có thứ tự dễ quét.
- UX: mỗi trang có một CTA ưu tiên; filter có nút clear/reset; bảng hỗ trợ overflow/mobile; modal/drawer không bị che; Skeleton ổn định bố cục.
- Không sao chép logo, hình ảnh, tài nguyên độc quyền của TopCV/ITviec/VietnamWorks.

## 6. Mẫu kết quả phải trả về
```
## Screen Audit
- Branch/commit / working tree:
- Routes và user roles:
- Đã đọc (file thực):
- Vấn đề (evidence: file + component + hành vi):
- Template mapping / xung đột guideline:
## Screen Design Proposal
- UX goals / visual hierarchy / layout / responsive / a11y:
- Component và token dự kiến tái sử dụng:
- State matrix:
## Mini Plan — CHỜ DUYỆT
- Files create/edit + lý do:
- Files out-of-scope:
- Risk & rollback:
- Tests / acceptance criteria:
```

## 7. Điều kiện hoàn thành
Không coi hoàn thành nếu chưa bảo toàn nghiệp vụ, chưa xác minh responsive theo khả năng môi trường, chưa có kiểm tra lint/build/test liên quan hoặc còn xung đột guideline chưa được phê duyệt. Không suy diễn UI đẹp từ việc code compile.
