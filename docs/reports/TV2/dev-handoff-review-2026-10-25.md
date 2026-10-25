# Rà soát nhánh trước khi gộp dev — 25/10/2026

## Kết luận

**Có thể mở PR để review; chưa nên merge như một bản đã nghiệm thu đầy đủ.** Frontend test/lint/build đạt, nhưng còn hai lỗi tích hợp Backend TV2 với API mới của dev. Bộ test dữ liệu/ETL và Identity cũng chưa xanh. Lượt này chỉ rà soát, chạy kiểm tra và viết bàn giao; không sửa logic hay commit/push.

## Mốc Git đã kiểm tra

- Nhánh: `feature/recruiter-management-application-lifecycle`.
- HEAD: `04e07a8aabef31a05be7f2ec4b9d5fa3f01ac756` — `fix UI`.
- Local tracking `origin/feature/recruiter-management-application-lifecycle` cùng commit HEAD.
- `git ls-remote --heads origin dev` xác nhận dev trên GitHub tại `f190d505f839e669f3d168273c271e076aded86a`.
- Dev hiện tại đã nằm trong lịch sử nhánh feature; so sánh Git là 0 commit phía dev / 6 commit phía feature. Diff tổng thể: 243 file, 7.943 dòng thêm, 844 dòng xóa, gồm cả tài liệu và ảnh từ các commit trước.
- Các file source tracked không còn thay đổi chưa commit. Hai thư mục chưa tracked là `docs/dev-merge-repair-verification/` và `docs/surface-polish-verification/`. File report này được tạo thêm sau lượt rà soát.

Vì vậy summary đưa lên dev cần mô tả cả phần nghiệp vụ TV2 và phần UI/sửa sau merge, không chỉ ghi “fix UI”.

## Các phát hiện cần xử lý

### 1. Chi tiết tin CLOSED không khớp luồng lịch sử ứng tuyển

- [JobService.publicDetail](../../../backend/src/services/job.service.js:189) chỉ cho đọc OPEN; dòng 192 trả 404 cho CLOSED, theo triển khai Public Portal hiện tại của dev.
- [publicJobsApi](../../../frontend/src/services/publicJobsApi.js:24) và frontend test vẫn coi CLOSED là dữ liệu có thể đọc để xem lịch sử, đồng thời chặn Apply.
- Candidate Dashboard dẫn nút “Xem việc làm” tới trang chi tiết public. Khi tin đóng, người dùng gặp trang không khả dụng. CV và lịch sử nằm trong Dashboard vẫn có luồng đọc riêng, không bị xóa.
- Tái hiện: `backend/tests/recruitment/public-jobs.test.js:22`, kỳ vọng 200 nhưng nhận 404.
- Hướng xử lý: thống nhất contract giữa TV1/TV2; giữ quy tắc public của dev và bổ sung đường đọc lịch sử theo quyền, hoặc chốt rõ contract CLOSED rồi đồng bộ Backend/Frontend/test. Không chỉ đổi assertion để bỏ qua hành vi người dùng.

### 2. DTO chi tiết public thiếu logo công ty

- [JobService.publicDetail](../../../backend/src/services/job.service.js:218) trả `company` và `company_name`, nhưng thiếu `company_logo_url`.
- Recruiter list/public list/applicants có nối logo; [JobDetails](../../../frontend/src/pages/Jobs/JobDetails.jsx:95) cần `company_logo_url` để hiển thị logo, nên chi tiết hiện rơi về icon mặc định.
- Tái hiện: `backend/tests/recruitment/recruiter-enhancements.test.js:56`, kỳ vọng logo đã lưu nhưng nhận `undefined`.
- Hướng xử lý: bổ sung logo vào DTO theo helper/contract tài sản hiện có, giữ bố cục JobDetails và các trường company mới của dev; kiểm tra cả logo tải file và URL lịch sử.

### 3. Bằng chứng và các link bàn giao chưa nằm trong commit

README/report và script UI đang tham chiếu hai thư mục untracked nêu trên. Nếu chỉ gộp commit hiện tại, ảnh/JSON/gallery/baseline chưa xuất hiện trên dev; script kiểm chứng presentation cần baseline trong thư mục này. Chọn thêm tài liệu/bằng chứng cần chia sẻ hoặc sửa lại tham chiếu trước khi bàn giao. Không dùng `git add .` một cách không kiểm tra.

### 4. Các phụ thuộc nghiệm thu toàn hệ thống

- Full backend có lỗi release thiếu, checksum không khớp và thiếu `pyarrow`; không chỉnh snapshot/manifest hoặc skip test để làm xanh.
- Identity có 7 test lỗi ở đăng ký Recruiter: contract tổ chức hiện tại không khớp kỳ vọng cũ. Trong lượt chạy này có 1 lỗi ở `auth-routes.test.js` và 6 lỗi ở `recruiter-registration.test.js`.
- Interview/scoring TV3 chưa được nối đầy đủ tại composition root. `analyzeApplication` vẫn là điểm inject; chưa có bằng chứng luồng Interview thực → OFFER → HIRED hoàn tất trên browser thật.
- Không đánh dấu toàn bộ UC TV2/toàn hệ thống hoàn thành chỉ dựa trên UI hoặc test fixture state machine.

## Kết quả chạy trên code HEAD

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Frontend `npm test` | **127/127 PASS**: 120 Vitest + 7 Node tests |
| Frontend `npm run lint` | PASS: 0 lỗi, 1 warning cũ import React không dùng trong `App.jsx` |
| Frontend `npm run build` | PASS; cảnh báo bundle JS khoảng 598 kB |
| Backend Foundation + Recruitment + Candidate Profile | **115/117 PASS, 2 FAIL** — hai lỗi tích hợp ở trên |
| Backend `npm test` | **318/342 PASS, 24 FAIL** — có hai lỗi trên, cộng các lỗi nhóm dữ liệu/ETL |
| Backend Auth Foundation chạy riêng | **36/43 PASS, 7 FAIL** |
| Source contract presentation | PASS: hooks/handlers/fields/API attributes của 14 file giữ nguyên |
| Git diff whitespace / conflict markers | Không có lỗi whitespace hoặc conflict markers trong source được kiểm tra |
| Snapshot/template/credentials | Diff nhánh không thay `data/processed/` hoặc template; `.env`, `backend/.env`, `frontend/.env` không tracked |

Không cộng các tổng backend với nhau vì có các nhóm test trùng. Đây là kết quả mới, thay cho số 116/116 và 319/341 trong report lịch sử.

Lệnh tái hiện:

```powershell
# frontend
npm test
npm run lint
npm run build

# backend
node --test tests/foundation/*.test.js tests/recruitment/*.test.js tests/auth-foundation/candidate-profile.test.js
npm test
node --test tests/auth-foundation/*.test.js

# root
node scripts/ui/verify-presentation-contract.cjs after
```

Log đầy đủ của lần chạy backend nằm ở `%TEMP%/recruithub-dev-review-backend.log`, `%TEMP%/recruithub-dev-review-scoped.log` và `%TEMP%/recruithub-dev-review-auth.log` trên máy kiểm tra.

Browser đã có bằng chứng trên cùng code trước commit: 33 cặp desktop/tablet/mobile, đủ năm tab hồ sơ, menu/filter/pagination/modal/focus/reduced motion; không lỗi JavaScript, không ghi nghiệp vụ, primary database giữ nguyên count/update_seq trong lượt đó. Các screenshot/JSON hiện còn local, chưa thuộc commit. Lượt review này không chạy lại script Apply/rút/nộp lại có ghi dữ liệu.

## Summary đề xuất cho PR feature → dev

**Title**

```text
feat(tv2): extend recruitment workflows and polish portal UI
```

**Description**

```text
Hoàn thiện luồng quản lý tuyển dụng và ứng tuyển, tích hợp với Public Portal mới từ dev.

- Bổ sung cấp bậc, loại hợp đồng, mức lương; chỉnh sửa, đóng/mở lại và xóa mềm tin.
- Hoàn thiện nộp/rút/nộp lại hồ sơ, giữ CV và lịch sử riêng theo từng lần ứng tuyển.
- Hỗ trợ tải CV PDF/DOC/DOCX dưới 5 MB, ảnh đại diện và logo công ty từ máy tính;
  xem PDF/Word trên trình duyệt và tải xuống theo quyền.
- Đồng bộ hồ sơ Candidate/Recruiter, validation và Dashboard phân trang 5 mục.
- Sửa lỗi tích hợp sau merge, nối lại tìm kiếm/bộ lọc/CV trong giao diện dev.
- Đồng bộ UI bảy trang và năm tab hồ sơ với nền navy/indigo, card sáng,
  focus/disabled/reduced motion và responsive desktop/tablet/mobile.
- Bổ sung kiểm thử hồi quy và tài liệu kiểm chứng.

Validation:
- Frontend 127/127 PASS; lint 0 errors/1 warning; build PASS.
- Backend liên quan 115/117 PASS; full backend 318/342 PASS; Auth riêng 36/43 PASS.

Pending before merge:
- Chốt contract đọc tin CLOSED cho lịch sử ứng tuyển và bổ sung logo trong public detail DTO.
- Hoàn tất bàn giao các artifact hiện chưa tracked.

Integration pending:
- Interview/scoring TV3; các lỗi dataset/ETL và test đăng ký Recruiter.
```

Đây là mô tả PR review, không phải xác nhận toàn bộ kiểm thử đã xanh. Không cần tạo thêm commit source chỉ để đổi tên commit `04e07a8`; có thể dùng title/description trên cho PR. Chưa tự stage, commit, push hoặc merge trong lượt này.
