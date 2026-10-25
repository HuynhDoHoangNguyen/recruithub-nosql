# Cập nhật form đăng tin và hồ sơ doanh nghiệp

Ngày kiểm tra: **25/10/2026**. HEAD nền `9e48dc7`. Không commit/push/chuyển nhánh; giữ các thay đổi có sẵn.

## Đã thực hiện

- Form tạo tin có đúng 4 cấp bậc **Intern, Fresher, Junior, Senior**. Tin cũ MID vẫn đọc/sửa được, hiển thị thêm lựa chọn Mid-level cho chính tin cũ đó để không tự đổi dữ liệu.
- Thêm **Loại hình làm việc**: Full time, Part time, Hợp đồng, Intern (Thực tập). Trường `employment_type` độc lập với `work_mode` Hybrid/Remote/Onsite hiện có.
- Thêm mức lương: Chưa cập nhật, Thỏa thuận hoặc Khoảng lương theo tháng; hỗ trợ VND/USD, min/max dương, max ≥ min. Lưu trên CouchDB, khôi phục khi sửa, hiển thị ở danh sách và chi tiết tin.
- Trang đăng/sửa tin có dải màu, viền theo nhóm thông tin, khoảng cách và icon Lucide thống nhất.
- Danh sách tin Recruiter có logo công ty, thông tin lương, nhóm nút Xem ứng viên / Chỉnh sửa / Đăng tuyển / Đóng tin / Mở lại / Xóa đặt gần nhau, có icon và màu phân biệt.
- Trang danh sách ứng viên có thẻ công ty/tin, nút Xóa tin, nút CV/Duyệt/Từ chối có icon và đặt trong cùng cụm. Modal xử lý cũng có icon, giữ kiểm tra stage/evidence/revision cũ.
- **Hồ Sơ Doanh Nghiệp** đi tới `/recruiter/profile`, gồm header dải màu, avatar, nhãn vai trò, liên hệ, tiến độ hoàn thiện thực tế và hai tab theo ảnh: Thông tin chung / Thông tin công ty.
- Lưu/Hủy hoạt động thật. Email chỉ đọc; người dùng không sửa company_id/department_id/user_id/role qua trang này. Sau đăng nhập quay lại được trang hồ sơ vừa mở.

## Cách sử dụng

1. Mở http://localhost:5173 và đăng nhập Recruiter.
2. Vào **Hồ Sơ Doanh Nghiệp → Thông tin chung** để nhập họ tên, điện thoại, địa điểm và giới thiệu; bấm Lưu thay đổi.
3. Chọn **Thông tin công ty** để sửa tên/ngành/website/địa chỉ/giới thiệu và **URL logo công ty**. Logo dùng URL http/https đã lưu; chưa có hoặc ảnh lỗi sẽ hiển thị chữ viết tắt của công ty.
4. Vào Đăng Tin Tuyển Dụng để chọn cấp bậc, loại hình mới và mức lương. Hybrid/Remote/Onsite vẫn ở trường Hình thức làm việc riêng.
5. Xóa tin có ở card Recruiter và trang Xem ứng viên; thao tác cần xác nhận.

Thông tin công ty dùng chung trên các tin của công ty. Logo trong ảnh kiểm chứng là tài nguyên local dùng để thử luồng tải ảnh; sau kiểm tra đã khôi phục hồ sơ/logo trước đó, không gán logo giả cho dữ liệu lịch sử.

## Dữ liệu và API

| Chức năng | Hợp đồng |
|---|---|
| Cấp bậc Job | INTERN / FRESHER / JUNIOR / SENIOR; MID chỉ giữ tương thích |
| Loại hình mới | `employment_type`: FULL_TIME / PART_TIME / CONTRACT / INTERNSHIP, optional |
| Lương | Optional `salary`: `{type:'NEGOTIABLE'}` hoặc `{type:'RANGE',min,max,currency:'VND'|'USD',period:'MONTH'}` |
| Xóa | `DELETE /api/v1/jobs/:id`, body `{expected_rev}` |
| Hồ sơ | `GET /api/v1/recruiter/profile` |
| Sửa liên hệ | `PATCH /api/v1/recruiter/profile`, body `{expected_rev,profile:{full_name,phone,location,bio}}` |
| Sửa công ty | `PATCH /api/v1/recruiter/company`, body `{expected_rev,company:{name,industry,...}}` |

Thông tin cá nhân nằm trong optional `Recruiter.profile`. Company mở rộng optional `description`/`logo_url`. Trường mới đều tương thích document cũ; không migration/rewrite snapshot. Các schema/request/DTO/form đều được nối xuyên suốt. Địa chỉ URL sai, chứa tài khoản hoặc protocol không hợp lệ bị chặn trước khi ghi. Không thay đổi Identity/JWT, membership hoặc thuật toán scoring.

**Xóa tin là xóa khỏi danh sách, giữ dữ liệu để bảo toàn hồ sơ**: server gắn `deleted_at` và CLOSED trong cùng một write CAS, ẩn khỏi public/private list và thống kê tin của Recruiter. Không xóa document Application/CV/history hoặc tạo CouchDB tombstone làm đứt tham chiếu. Tin đã xóa không sửa/mở lại/nộp mới được. Candidate vẫn đọc CV và lịch sử đã nộp; Recruiter vẫn đọc được hồ sơ qua đường dẫn tin cũ. Retry xóa cùng tin không ghi thêm.

Thay đổi hồ sơ, công ty và xóa tin đều kiểm tra vai trò, ownership và revision; 409 tải lại để tránh ghi đè dữ liệu mới. Chỉ database local private được ghi. `recruitment_db` giữ nguyên doc_count/update_seq trong lượt kiểm chứng.

## File chính

| Phần | File |
|---|---|
| Backend | `schemas/{job,job-application-request,recruiter,company,recruiter-profile,job-compensation}.schema.js`, `constants/job-catalog.constants.js` |
| Service/route | `services/{job,recruiter-profile,job-application-scope,application}.service.js`, `routes/{job,recruiter-profile}.routes.js`, `controllers/job.controller.js`, `app.js` |
| View | `repositories/job-application.repository.js`: loại tin đã xóa khỏi view danh sách/thống kê Recruiter |
| Form/UI | `frontend/src/features/jobs/{jobFormModel,jobPresentation}.js`, `components/{JobForm,DeleteJobButton,PublicJobCard,ReopenJobModal}.jsx` |
| Hồ sơ/logo | `frontend/src/pages/RecruiterProfile.jsx`, `components/{CompanyLogo,Navbar}.jsx`, `routes/AppRoutes.jsx`, `utils/authNavigation.js` |
| Danh sách/chi tiết | `pages/Dashboard/RecruiterDashboard.jsx`, `pages/Jobs/{JobApplicantsPage,JobDetails}.jsx`, `features/applications/components/ApplicantDetailModal.jsx` |
| Test | `backend/tests/recruitment/recruiter-enhancements.test.js`, `frontend/tests/recruiter-enhancements.test.jsx`, regression navigation |

Vitest giới hạn 2 worker trong `frontend/vitest.config.js` để tránh các test tương tác UI bị timeout do tranh chấp CPU/bộ nhớ với Vite/CouchDB trên Windows. Giữ timeout và assertions hiện tại.

Khi chạy trên database private khác: `cd backend; npm run db:job-application` để cập nhật view. Không trỏ lệnh vào database snapshot lịch sử.

## Kiểm chứng

- Backend phân hệ + Foundation: **97/97 PASS**.
- Full `backend/npm test`: **327 tests, 305 PASS, 22 FAIL**. Còn các lỗi dataset/ETL có sẵn: thiếu release/pyarrow, checksum users.jsonl lệch manifest. Không sửa snapshot để làm xanh.
- Frontend: **91/91 Vitest + 7/7 Node PASS**.
- Lint: **0 lỗi**, 1 cảnh báo React import chưa dùng có sẵn ở App.jsx.
- Build: **PASS**, cảnh báo bundle >500 kB.
- `git diff --check`: **PASS**.
- Chrome thật, Identity/CouchDB thật, localhost:5173: hồ sơ lưu/đọc lại trên desktop và mobile; tạo tin Fresher/Full time/Hybrid/lương khoảng, sửa Intern/Part time/lương thỏa thuận, đăng tuyển, hiển thị logo và xóa từ trang ứng viên; CV/history/revision Application giữ nguyên. Không pageerror.

Kết quả máy đọc được: [results.json](recruiter-enhancements-verification/results.json). Script: [verify-recruiter-enhancements.cjs](../scripts/ui/verify-recruiter-enhancements.cjs).

Ảnh:

- [Hồ sơ doanh nghiệp desktop](recruiter-enhancements-verification/recruiter-profile-desktop.png), [mobile](recruiter-enhancements-verification/recruiter-profile-mobile.png).
- [Thông tin công ty và logo](recruiter-enhancements-verification/company-profile-logo.png).
- [Form cấp bậc, loại hình, lương và viền](recruiter-enhancements-verification/create-job-salary-and-types.png).
- [Card tin và cụm nút](recruiter-enhancements-verification/recruiter-job-card.png).
- [Danh sách ứng viên và icon](recruiter-enhancements-verification/applicants-icons-and-actions.png).
- [Chi tiết tin có lương/loại hình](recruiter-enhancements-verification/public-job-salary.png).

## Commit đề xuất

```text
feat(recruiter): add job compensation and editable business profiles

- Add Intern/Fresher levels, employment types and validated monthly salary.
- Add an editable Recruiter/company profile with logo and revision checks.
- Add scoped soft deletion while retaining application CVs and history.
- Polish job/applicant cards with company logos and compact icon actions.
- Add API/UI regressions and real Identity/CouchDB browser verification.
```

Chưa commit/push. Các kết quả trong bàn giao trước là lịch sử trước đợt bổ sung này.
