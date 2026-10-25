# Sửa lỗi frontend sau merge dev — 25/10/2026

Mốc kiểm tra: merge `938d656` trên nhánh `feature/recruiter-management-application-lifecycle`.

## Nguyên nhân

Merge đã giữ lẫn hai phần triển khai trong JobList/JobDetails: import icon trùng; tên state/biến chưa thống nhất; input filter không còn state tương ứng; normalize DTO có khóa `requirements` trùng. Đây là lỗi tích hợp code dù Git đã hoàn tất merge và không còn conflict marker.

## Phần giữ lại và sửa

- Giữ bố cục, nền xanh nhạt, khung danh sách/chi tiết, component `JobCard`, loading/error, form và điều hướng mobile mới từ dev. Giữ adapter `listPublicJobs`/`getPublicJob` của thành viên khác.
- `JobDetails.jsx`: gộp icon import, thống nhất `isCandidate` và `message/setMessage`; khôi phục xem CV, thư giới thiệu, lịch sử các lần nộp và nộp lại WITHDRAWN với revision hiện tại. Tách trạng thái tin tham khảo/đã đóng/hết hạn để chặn Apply đúng điều kiện.
- `JobList.jsx`: bổ sung icon/state thiếu; nối tìm kiếm, kỹ năng, ngành nghề vào URL/API; giữ debounce và cursor/reset khi đổi filter. Nối lại metadata địa điểm/hình thức/cấp bậc theo cùng phong cách dev. Hiển thị logo, lương và loại hợp đồng nếu API có dữ liệu.
- `publicJobsModel.js`: giữ một trường `requirements`, với fallback `{}`.
- `publicJobsApi.js`: giữ chuẩn hóa của dev; cho đọc Job CLOSED theo API để xem lịch sử, trong khi trang chi tiết vẫn chặn nộp mới/nộp lại tin đã đóng. Chế độ fixtures vẫn được kiểm soát bởi cấu hình development hiện có.
- `authNavigation.js`: thêm lại `/recruiter/profile` vào whitelist đích quay về sau đăng nhập, cùng giới hạn role và chống open redirect hiện có.
- Cập nhật test giao diện theo label/select của dev; thêm hồi quy phối hợp filter, giữ layout dev, truy cập CV, nộp lại đúng revision và chặn nộp lại khi CLOSED.

## Kiểm chứng

- `npm run lint`: 0 errors, 1 warning cũ tại `App.jsx` (React import không dùng).
- `npm run build`: pass; còn cảnh báo bundle chính >500 KB.
- `npm test` frontend: **120 Vitest + 7 Node tests pass**.
- Chrome thật + Identity/API/CouchDB thật: filter phối hợp; đăng nhập về đúng Job; Apply bằng PDF → rút → nộp lại DOCX; request có `expected_rev` mới nhất; giữ PDF của lần trước; xem Word/PDF trong trang; Recruiter đăng nhập về hồ sơ doanh nghiệp.
- Mobile danh sách/chi tiết 390px không tràn ngang, `runtime_errors: []`.
- Database chính không thay đổi document count/update sequence: **25.761 documents** trước/sau. Tin kiểm chứng chỉ tạo trong database ghi cô lập và được xóa mềm sau test; không sửa hồ sơ người dùng.

[JSON kết quả](../../dev-merge-repair-verification/results.json) · [Danh sách theo giao diện dev](../../dev-merge-repair-verification/dev-job-list-filters.png) · [Chi tiết/lịch sử](../../dev-merge-repair-verification/dev-detail-current-attempt.png) · [Word preview](../../dev-merge-repair-verification/dev-detail-word-preview.png) · [PDF lần trước](../../dev-merge-repair-verification/dev-detail-archived-pdf.png).

Script kiểm chứng: `node scripts/ui/verify-dev-merge-repair.cjs`. Script cần Playwright/Chrome và tài khoản local trong `.env`, có tạo dữ liệu thử trong database cô lập; không in credentials.

Backend/schema và dữ liệu snapshot không có thay đổi trong lượt sửa này. Các phụ thuộc Interview/scoring và lỗi kiểm thử chung đã nêu ở [report TV2](TV2-review-and-commit-summary-2026-10-25.md) vẫn là các hạng mục tích hợp riêng.

Chưa commit/push. Để kiểm tra, mở lại `http://localhost:5173/jobs`; nếu Vite vẫn giữ overlay cũ, tải lại trang hoặc khởi động lại `npm run dev` trong `frontend`.
