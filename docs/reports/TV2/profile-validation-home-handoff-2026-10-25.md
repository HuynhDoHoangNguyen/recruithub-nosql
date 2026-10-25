# Bàn giao ràng buộc hồ sơ và giao diện trang chủ

Ngày 25/10/2026. Thực hiện trên working tree hiện tại; không commit, đổi nhánh hay chỉnh dữ liệu lịch sử.

## Kết quả

- Sửa lỗi số điện thoại thiếu chữ số vẫn lưu được cho cả Candidate và Recruiter. Có kiểm tra frontend **và API** trước khi ghi.
- Lỗi xuất hiện ngay tại trường nhập sau blur hoặc khi bấm lưu, có viền đỏ và liên kết trợ năng. Dữ liệu đang sửa được giữ khi bị chặn.
- Dữ liệu cũ vẫn đọc được để người dùng sửa. Không siết schema đọc theo cách khiến hồ sơ cũ không mở được.
- Trang chủ có banner hai cột, nền lưới/gradient, thẻ cơ hội lấy từ API thật, thanh tìm kiếm và gợi ý kỹ năng có thể bấm. Card việc làm tiêu biểu có viền gradient, logo, mức lương riêng, kỹ năng, địa điểm, cấp độ, hạn nộp và nút xem chi tiết nổi bật.
- Cập nhật phần giới thiệu tính năng và lời mời đăng tuyển; giữ tìm kiếm, route guard và nhãn tin tham khảo. Không thêm số liệu/verified badge/điểm AI giả.

## Quy tắc trường nhập

| Nhóm | Ràng buộc |
|---|---|
| Số điện thoại hai vai trò | Không bắt buộc nếu chưa cung cấp. Khi nhập phải đủ: di động `0[35789]` + 8 số; cố định `02` + 9 số; hoặc dùng `+84`/`84` thay `0`. Chấp nhận dấu cách, chấm, gạch nối, ngoặc khi định dạng. Không chấp nhận chữ, thiếu/thừa số, dạng `+840…` hay đầu số cũ `01…`. |
| Họ tên | Có chữ cái, không thẻ HTML, ít nhất 2 ký tự; Candidate tối đa 120, Recruiter 160. |
| Candidate nghề nghiệp | Vị trí 2–120 ký tự; ngành 2–80; số năm kinh nghiệm nguyên 0–80; địa điểm tối đa 160; giới thiệu tối đa 4000, không được thay phần đã khai báo bằng chuỗi rỗng theo contract hiện tại. |
| Kỹ năng/ngoại ngữ | Tối đa 100 kỹ năng, tên 1–120; 20 ngoại ngữ, tên 1–80/trình độ tối đa 120. Không trùng theo khóa chuẩn hóa, không phân biệt hoa thường. |
| Học vấn/kinh nghiệm/dự án | Tối đa 30/50/50 mục. Tên trường/chuyên ngành/chức danh/đơn vị/vai trò tối đa 200; mô tả tối đa 4000. Tên dự án bắt buộc, tối đa 200; tối đa 100 công nghệ, mỗi mục 1–120. |
| Ngày tháng | Khi tạo/sửa ngày: `YYYY-MM` hoặc `YYYY-MM-DD`, ngày tồn tại từ năm 1900; kết thúc không trước bắt đầu. Giữ nguyên ngày/range lịch sử nếu không sửa ngày đó. |
| Recruiter liên hệ | Địa điểm tối đa 200, giới thiệu 3000. |
| Doanh nghiệp | Tên 2–200, ngành 2–120; địa chỉ tối đa 500; mô tả 5000; website tùy chọn, tối đa 2048, HTTP/HTTPS hợp lệ và không chứa username/password. |
| Danh tính/tệp | Email không sửa; API vẫn chặn field ngoài allowlist và thay đổi scope. Giữ kiểm tra owner, ETag/revision; giới hạn CV/ảnh dưới 5 MiB như trước. |

Đây là quy ước kiểm tra định dạng số liên hệ của portal, không xác minh chủ sở hữu, số đã được cấp hay thuê bao đang hoạt động. Tham khảo thay đổi đầu số Việt Nam: [thông báo National Numbering Plan tới ITU](https://www.ituob.org/issues/1150/). Chưa có xác minh OTP và chưa hỗ trợ số quốc tế ngoài Việt Nam.

## Tầng triển khai

- Backend: `schemas/profile-validation.schema.js`, `candidate-profile.schema.js`, `recruiter-profile.schema.js`; `services/candidate-profile.service.js`, `recruiter-profile.service.js`.
- Frontend: `features/profile/profileValidation.js`, `ProfileSections.jsx`, `pages/Profile.jsx`, `pages/RecruiterProfile.jsx`.
- Trang chủ: `pages/Landing.jsx`, `features/jobs/components/HomeHero.jsx`, `HomeJobSearch.jsx`, `PublicJobCard.jsx`.
- Giữ schema lưu trữ Recruiter Contact tương thích để mở và sửa được số điện thoại cũ không hợp lệ; PATCH dùng schema chặt hơn. Service Recruiter cũng validate payload khi được gọi trực tiếp.

## Kiểm chứng

- Backend liên quan: **116/116 pass**, gồm tuyển dụng, foundation và Candidate Profile. Test số hợp lệ/thiếu/thừa/chữ/đầu số, đối chiếu quy tắc frontend với API; API HTTP trả lỗi tại `profile.phone` và không ghi; date lịch sử được giữ nguyên.
- Frontend: **108 Vitest + 7 Node tests pass**. Có kiểm tra báo lỗi, chặn gọi API khi sai, chấp nhận `+84`, website, giới hạn collection và các trạng thái trang chủ.
- Lint: 0 errors; 1 warning cũ ở `App.jsx` do import React không dùng. Build pass; còn cảnh báo bundle chính >500 KB.
- Toàn bộ `backend/npm test`: **319/341 pass, 22 fail** ở nhóm dữ liệu/ETL cũ (release/pyarrow/checksum/snapshot). Không sửa snapshot để làm xanh tests.
- Chrome thật: Candidate và Recruiter bị chặn lưu số thiếu; website công ty sai bị chặn; không gửi PATCH từ form khi sai. API trực tiếp cũng trả 400; revision của hồ sơ/company không thay đổi.
- Banner/thẻ việc làm dùng API thật; tìm kiếm đi đúng `/jobs?q=React`; màn hình 390px không tràn ngang; `runtime_errors: []`.
- Database chính giữ nguyên **25.761 documents** và `update_seq` trước/sau kiểm chứng.

[Kết quả JSON](../../profile-rules-home-verification/results.json) · [Trang chủ desktop](../../profile-rules-home-verification/home-desktop.png) · [Việc làm tiêu biểu](../../profile-rules-home-verification/featured-jobs.png) · [Trang chủ mobile](../../profile-rules-home-verification/home-mobile.png) · [Candidate báo lỗi điện thoại](../../profile-rules-home-verification/candidate-phone-validation.png) · [Recruiter báo lỗi điện thoại](../../profile-rules-home-verification/recruiter-phone-validation.png).

Script kiểm chứng: `node scripts/ui/verify-profile-rules-home.cjs`. Dùng tài khoản test local trong `.env`, không in credentials. Chỉ gửi PATCH không hợp lệ và xác nhận bị từ chối; không thay đổi hồ sơ người dùng.

Kiểm tra tại `http://localhost:5173`: Hồ sơ → chỉnh sửa → nhập `0912` → rời ô hoặc bấm lưu; phải thấy lỗi và không lưu. Thử `0912345678` hoặc `+84 912 345 678` để kiểm tra dạng hợp lệ. Trang chủ hiển thị thiết kế mới ngay sau khi frontend cập nhật.
