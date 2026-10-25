# Bàn giao TV2 — Recruiter Management & Application Lifecycle

> Bản này là lịch sử. Xem [bàn giao RecruiHub mới nhất](recruihub-catalog-lifecycle-handoff-2026-10-25.md) để biết kết quả Identity/CouchDB đang chạy, bộ lọc và thiết kế nhiều lần nộp.

Ngày kiểm tra: **25/10/2026 (Asia/Saigon)**. Branch: `feature/recruiter-management-application-lifecycle`; HEAD tham chiếu `1127fb5`. Bảo toàn thay đổi có sẵn; không checkout/merge/reset/commit/push.

## 1. Kết quả và giới hạn

Đã sửa giao diện theo đúng phiên bản **JobPortal IT**, bổ sung đường bấm theo vai trò trên desktop/mobile, form đăng tin theo nhóm, context tổ chức từ backend và thống kê Candidate trên toàn bộ scope. Giữ API/validation/state machine cho đủ UC08, UC09, UC10, UC11, UC12, UC13, UC16.

**Chưa đủ điều kiện nghiệm thu trọn phân hệ với tài khoản thật.** Các luồng private đã chạy qua trình duyệt với Express/repository kiểm thử cô lập; chưa chạy được với Identity thật và CouchDB thật. Backend hiện chưa có login/register/profile API, toàn bộ 10.150 User live là `RESET_REQUIRED`, không có User `ACTIVE`. Không cấp token demo vào production hoặc kích hoạt dữ liệu lịch sử để che điểm chặn này.

Ứng dụng thật hiện ở **http://localhost:5173**, backend **http://localhost:5000**. Public Jobs/Detail đã chạy và tải lại với CouchDB thật. Cổng **5174 là template tham khảo có mock adapter**, không phải ứng dụng nghiệp vụ đang tích hợp.

## 2. Đã khóa đúng phiên bản template

| Nguồn | Kết quả kiểm tra |
|---|---|
| `docs/Job-Application-Portal-Frontend/` | Phiên bản cũ: “Find Your Dream Job”, “Welcome back”; khác năm ảnh đính kèm |
| Source đang phục vụ 5174 | `D:\University\HK1_2627\NoSQL\Job-Application-Portal-Frontend\Job-Application-Portal-Frontend` |
| Dấu hiệu khớp ảnh | JobPortal IT, “Ít nhưng mà chất”, menu tiếng Việt, hero tối, Plus Jakarta Sans, form chia nhóm, Candidate dashboard có stats/filter/cards |
| Phần lấy sang ứng dụng | Navbar trình bày; font/theme/CSS; bố cục form, Dashboard, Jobs và hero Landing; code chạy nằm trong `frontend/` |
| Phần không mang sang | Mock Axios adapter, TestToolbar, tự đổi role, tự tạo tài khoản, quyền truy cập dữ liệu người khác, mô hình application pending/accepted/rejected |

Hai nguồn template đều được giữ nguyên; không import runtime từ `docs/` hoặc đường dẫn bên ngoài. SHA-256 source tham khảo đã đọc:

- `src/components/Navbar.jsx`: `12B296BC4B4A5EDF9932E38ECD9598C61AF2C16AEBC281D9479150CA6D945E8B`
- `src/pages/Jobs/CreateJob.jsx`: `90CB532165AA99E1E3E183B4EB84B9361304BC36AFECDC544581F3A2794EDBD0`
- `src/pages/Dashboard/JobSeekerDashboard.jsx`: `EB91CD2A7F04FE3BA5C172A00BD0F38672958315C99EC611C466D052582E4438`

### Đối chiếu trực quan

Ảnh mới chụp ở **1286 × 1000**, cùng vai trò và dữ liệu Job thử tương đương. Reference dùng chính template 5174 trong browser context riêng; application dùng toàn bộ App thật trên Vite kiểm thử 5181, nối Express kiểm thử với repository memory. Đây là bằng chứng **A**, không phải demo Identity/CouchDB thật.

| Màn hình / trạng thái | Template đúng | Ứng dụng đã ghép |
|---|---|---|
| Landing / guest | [Reference](it-template-verification/reference-landing-desktop.png) | [Ứng dụng](it-template-verification/app-landing-desktop.png) |
| Jobs / guest, cùng các Job thử | [Reference](it-template-verification/reference-jobs-desktop.png) | [Ứng dụng](it-template-verification/app-jobs-desktop.png) |
| Tạo tin / Recruiter, form mới | [Reference](it-template-verification/reference-create-desktop.png) | [Ứng dụng](it-template-verification/app-create-desktop.png) |
| Dashboard / Candidate, một đơn mới nộp | [Reference](it-template-verification/reference-candidate-desktop.png) | [Ứng dụng](it-template-verification/app-candidate-desktop.png) |

Hai bản dùng font family `Plus Jakarta Sans, Inter, system-ui, sans-serif`; Navbar đo được **65px** ở cùng viewport. Giữ nền slate-50, card trắng border slate-200 bo 16–24px, nút gradient blue/indigo, form max-width 4xl và bố cục sidebar/cards.

Không tuyên bố khớp từng pixel: ứng dụng có thêm trường nghiệp vụ canonical, đủ 7 stage, phân trang, dữ liệu thật không có salary/location/verified. Template chỉ có 3 trạng thái ứng tuyển; “pending” trong ảnh so sánh là trạng thái tham khảo tương đương đơn mới nộp, không được persist sang ứng dụng. Không dùng dữ liệu giả để tái tạo nguyên các con số quảng cáo trong ảnh.

Profile hiện giữ route `/profile` và core của TV1. Chỉ chỉnh phần trình bày loading/error theo template, phân biệt Candidate/Recruiter; không bịa phần trăm hoàn thiện. **Chưa có dữ liệu profile thành công để so sánh cùng trạng thái với ảnh Profile.** Xem [trạng thái chưa tích hợp](it-template-verification/app-profile-unavailable.png).

## 3. Nguyên nhân header thiếu chức năng và sửa đường đi

Luồng đang chạy là `main.jsx → App.jsx → BrowserRouter/AuthProvider → Navbar + AppRoutes → page → jobApplicationApi/axiosClient → /api/v1`.

Navbar cũ dùng menu/nhãn tiếng Anh của template khác phiên bản và kiểm tra các role legacy (`job-seeker`, `recruiter`); principal/backend dùng `CANDIDATE`, `RECRUITER`. Không có cùng tập entry point rõ ràng cho cả desktop/mobile. Việc chỉ chỉnh component trang hoặc một router không được mount không giải quyết được header thật.

Navbar mới chuẩn hóa role tại UI, nhận `JOB-SEEKER`, `job-seeker`, `CANDIDATE`, `RECRUITER` và admin; `ProtectedRoute` dùng cùng phép chuẩn hóa. Backend vẫn xác thực chữ ký/expiry và resolve User canonical `ACTIVE` cùng quyền thật. Menu mobile đóng khi điều hướng, có `aria-expanded`, active state; dropdown tài khoản gọi logout của Identity hiện có.

Tất cả API dưới đây có prefix `/api/v1`; ID trên URL được encode.

| Vai trò / nút | Route UI | API liên quan | Kết quả thao tác đã kiểm tra |
|---|---|---|---|
| Guest/Candidate/Recruiter: Việc Làm IT | `/jobs` | `GET /jobs` | Public thật PASS, list/chi tiết/reload, mobile |
| Candidate: Bảng Điều Khiển | `/user/dashboard` | `GET /applications/context`, `/applications/stats`, `/applications/my-applications` | Fixture toàn App PASS; private live chờ Identity |
| Candidate: Hồ Sơ & CV | `/profile` | `GET /users/me`; update core hiện có dùng `PUT /users/me` | Route hiện hữu; GET live 404, báo dịch vụ chưa tích hợp |
| Recruiter: Bảng Điều Khiển | `/recruiter/dashboard` | `GET /recruiter/context`, `/recruiter/jobs`, `/recruiter/stats` | Fixture toàn App PASS; không mở dữ liệu ngoài scope |
| Recruiter: Đăng Tin Tuyển Dụng | `/recruiter/jobs/create` | `GET /recruiter/context`, `POST /jobs`, sau đó `GET /recruiter/jobs` | Header desktop/mobile → form → tạo → Dashboard đọc lại PASS trong fixture |
| Recruiter: Hồ Sơ Doanh Nghiệp | `/profile` | `/users/me` theo route/API profile đang có của TV1 | Chưa có route doanh nghiệp riêng được tích hợp; route hiện tại hiển thị lỗi rõ ràng, chưa nghiệm thu chỉnh sửa tổ chức |
| Job card: Chỉnh sửa | `/recruiter/jobs/:id/edit` | `GET /recruiter/jobs/:id`, `PATCH /jobs/:id` | Nạp → sửa → lưu → Dashboard đọc lại PASS trong fixture |
| Job card: Đăng tuyển/Đóng tin | Dashboard hiện tại | `PATCH /jobs/:id/status` | DRAFT→OPEN/CLOSED; OPEN→CLOSED; CLOSED không sửa/mở lại; confirm đóng |
| Job card: Xem ứng viên | `/recruiter/jobs/:id/applicants` | `GET /jobs/:id/applicants` | Scope/filter/pagination, mở CV và timeline PASS trong fixture |
| Job detail: Nộp hồ sơ | `/jobs/:id`, modal | `GET /applications/context`, `POST /applications` | CV bắt buộc, cover tùy chọn, xác nhận, lưu và reload PASS trong fixture |
| Candidate card: Rút đơn ứng tuyển | Dashboard hiện tại | `PATCH /applications/:id/withdraw` | Confirm, expected_rev/stage, WITHDRAWN, không nộp lại PASS trong fixture |
| Applicant: Xem CV và xử lý | Applicants, modal | `GET /applications/:id`, `PATCH /applications/:id/stage` | allowed_transitions, reason/evidence, hai tab 409 và reload PASS trong fixture |
| Tài khoản: Đăng xuất | Dropdown / mobile menu | Xóa phiên local theo helper Identity hiện có | UI gọi logout; không có server session/revocation API để nghiệm thu |
| Guest: Đăng nhập/Đăng ký | `/login`, `/register` | `POST /auth/login`, `/auth/register` | Form/route hiện hữu; backend Identity chưa có, không báo thành công giả |

Không cho Candidate thấy quyền Recruiter. Desktop và mobile đều có đường vào tương ứng; không phải nhập URL để tìm chức năng sau khi có phiên hợp lệ. Profile/Identity là dependency được ghi rõ, không tạo route ghi dữ liệu mới ngoài quyền sở hữu TV2.

## 4. Ma trận nghiệm thu bảy use case

A = unit/fixture, gồm thao tác Chrome trên App + Express kiểm thử cô lập. B = API thật với CouchDB thật. C = browser có Identity thật + CouchDB thật.

| UC | Đã triển khai API + UI | A | B | C |
|---|---|---|---|---|
| UC08 Nộp CV | Modal, CV bắt buộc, cover, eligibility/deadline, pair-ID chống trùng suốt vòng đời, đọc lại submission | PASS; Chrome apply/reload/tracker | Chưa chạy ghi private: thiếu phiên thật | Chưa nghiệm thu |
| UC09 Theo dõi | Scope Candidate, 7 stage/history, CV, filter/bookmark, tổng và counts toàn scope qua MapReduce | PASS; test 25 đơn vượt page + Candidate khác, kiểm tra lỗi stats không biến thành 0 | View thật đã đối chiếu độc lập; API private chưa có Identity | Chưa nghiệm thu |
| UC10 Rút đơn | APPLIED/SCREENING/INTERVIEW; confirm, expected_rev/stage; giữ history; không apply lại | PASS; Chrome rút từ INTERVIEW, reload, đọc CV/history, duplicate 409 | Chưa chạy ghi private | Chưa nghiệm thu |
| UC11 Tạo tin | Form chia nhóm, breadcrumb/cancel, DRAFT/OPEN, requirements/skills/deadline; tổ chức do server resolve | PASS; header desktop/mobile → tạo DRAFT → Dashboard GET đọc lại | Chưa có Recruiter ACTIVE qua Identity | Chưa nghiệm thu |
| UC12 Sửa/đăng/đóng | expected_rev; deadline giữ giây/ms nếu không đổi; trạng thái hợp lệ; CLOSED bất biến, giữ hồ sơ | PASS; Chrome sửa/đăng; React/API tests đóng và conflict | Chưa chạy ghi private | Chưa nghiệm thu |
| UC13 Danh sách ứng viên | Chỉ Job thuộc Recruiter; stage/filter/bookmark; email được phép, CV/cover/timeline | PASS; Chrome đọc CV đã nộp | Chưa có phiên Recruiter thật | Chưa nghiệm thu |
| UC16 Chuyển stage | allowed_transitions; cấm nhảy/lùi/terminal; reason; OFFER cần Interview; HIRED cần acceptance | PASS; Chrome SCREENING→INTERVIEW và hai tab 409; OFFER/HIRED kiểm thử API/fixture và validation UI | Chưa có Identity; chưa có service/route lên lịch Interview cho luồng mới | Chưa nghiệm thu |

P1/P2/P3 vẫn được giữ: chuẩn bị response/kiểm tra reference trước write Application; sửa trường khác không làm mất độ chính xác deadline; `npm test` tiếp tục chạy cả Foundation. Không retry mù thao tác chuyển stage với revision cũ vì có thể làm sai quyết định nghiệp vụ; client nhận 409 và đọc trạng thái mới trước khi gửi lại.

Persist canonical giữ nguyên: `type`, `account_status`, `current_stage`; `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`. Không đổi sang `INTERVIEWING/OFFERED` trong tài liệu mô tả tổng quát hoặc `pending/accepted/rejected` của mock.

## 5. Mapping template → dữ liệu hiện hành

| Trường/khối template | Nguồn thật hoặc cách xử lý |
|---|---|
| Công ty | Context Recruiter resolve Company; form read-only; server không nhận ownership do client chọn |
| Phòng ban | Context resolve Department thuộc Company, read-only |
| Title/description | `title`, `description` |
| Nội dung trách nhiệm/yêu cầu | `responsibilities`, `requirements.general`; tách field theo schema |
| Skills/tags | `required_skills`, `optional_skills`; không thêm trường tags giả |
| Kinh nghiệm/học vấn/dự án | `requirements.experience/education/project` và các trạng thái REQUIRED/NO_MINIMUM/NO_REQUIREMENT/UNAVAILABLE đúng schema |
| Cấp bậc | `seniority`: JUNIOR/MID/SENIOR, nhãn tiếng Việt |
| Trạng thái tin | DRAFT/OPEN lúc tạo; các thao tác trạng thái trên Dashboard theo rule |
| Deadline | ISO timestamp; nhập giờ Việt Nam UTC+7; không mất giây/ms khi không đổi deadline |
| Lương USD/năm, khoảng lương/tháng | Schema Job chưa hỗ trợ: bỏ field/badge, không tính hoặc bịa số |
| Location/city/work mode/job type | Schema Job chưa hỗ trợ: không thêm field và bộ lọc giả |
| Company logo/Verified/HOT từng Job | Không có dữ liệu xác minh/logo: dùng ô chữ đầu tên công ty, không gắn Verified/HOT giả cho Job |
| Stats 500+/200+/98%, dải thương hiệu | Không có API tổng hợp tương ứng: dùng nội dung tính năng/Job API thật, không sao chép số quảng cáo |
| Stats Candidate | MapReduce theo `candidate_id` và `current_stage`, không lấy page.items.length làm tổng |
| Tìm kiếm/lọc Public Jobs | Lọc trên trang hiện tại, ghi rõ scope; không tuyên bố đã có full-text search hoặc salary/location filters toàn hệ thống |
| Profile completion/name/location | Thiếu Profile API: trạng thái chưa xác định, không tạo tiến độ hoặc thông tin cá nhân giả |
| Role Testing Hub | Chỉ có trong reference, không có trong runtime production |

Bản release thật có ngành Retail/Travel/Healthcare và các ngành khác; giao diện giữ dữ liệu gốc, không thay bằng danh sách tin IT mock để giống ảnh.

## 6. Dữ liệu live đã đọc lại

[Bằng chứng JSON mới](it-template-verification/live-data.json), đọc đúng `recruitment_db` sau setup view, không thực hiện business write trong lượt kiểm tra này:

| Đại lượng | Kết quả |
|---|---:|
| Business documents | 25.750 |
| doc_count gồm 11 design docs | 25.761 |
| User / Candidate | 10.150 / 10.000 |
| Company / Department / Recruiter | 50 / 150 / 150 |
| Job / Application / Interview / Resume Analysis | 2.500 / 1.200 / 350 / 1.200 |
| OPEN / DRAFT / CLOSED | 200 / 2.300 / 0 |
| OPEN thiếu / có published_at | 200 / 0 |
| OPEN hết hạn tại thời điểm đo | 0 |
| Recruiter scope lỗi / Job ownership lỗi | 0 / 0 |
| User ACTIVE / RESET_REQUIRED | 0 / 10.150 |
| Selector cũ yêu cầu published_at | 0 kết quả |
| API public mới qua bookmarks | 50 + 50 + 50 + 50 + 0 = 200 ID khác nhau |

Giữ sửa `publicList`: sort/index dựa `created_at` bắt buộc và `_id` để phân định cùng timestamp; không đòi field optional `published_at`. Không sửa snapshot để đáp ứng truy vấn sai. API list bổ sung `company_name` bằng đọc Company theo ID trên một page giới hạn, không trả thông tin bí mật.

Đã chạy `npm run db:job-application`: chỉ bổ sung/cập nhật index/design view, không sửa business documents. View mới `applications_by_candidate_stage` được đối chiếu với các Application đọc độc lập của một Candidate live: tổng 1, APPLIED 1, khớp. Đây là kiểm tra Repository/CouchDB, **không phải API private có xác thực thật**.

Trên 5173 thật: list 20 tin → reload → mở chi tiết → reload, đều hiển thị cùng Job. [Kết quả browser thật](live-job-verification/browser-results.json), [Jobs desktop thật](live-job-verification/jobs-desktop.png), [mobile](live-job-verification/jobs-mobile.png), [detail](live-job-verification/job-detail-desktop.png). Không intercept API hoặc đặt token vào origin production.

Trong Chrome kiểm thử riêng, đã tạo Job DRAFT → sửa → OPEN; Candidate nộp CV/cover; Recruiter đọc lại CV → SCREENING → INTERVIEW; tab cũ nhận 409; Candidate rút → reload và CV/history vẫn tồn tại với chuỗi APPLIED→SCREENING→INTERVIEW→WITHDRAWN; apply lại 409. [Kết quả A](it-template-verification/results.json), [readback sau rút](it-template-verification/app-candidate-withdrawn-readback.png). Dữ liệu này chỉ nằm trong memory repository kiểm thử, không đưa vào CouchDB production.

## 7. Hướng dẫn bấm và chạy

Database hiện đã có release, không cần import lại. Từ root mở ba terminal khi các dịch vụ chưa chạy:

```powershell
# Terminal 1: Docker Desktop phải chạy
docker compose up -d

# Terminal 2
cd backend
npm run db:job-application
npm run dev

# Terminal 3, từ root khác
cd frontend
npm run dev
```

Mở **http://localhost:5173**. Nếu đã có process ở cổng 5000/5173 thì dùng process đó, không chạy trùng. Nếu sửa Tailwind config mà server cũ báo CSS 500/unknown utility, dừng Vite bằng Ctrl+C và chạy lại `npm run dev`; nếu optimizer báo 504, dùng `npm run dev -- --force` rồi reload. Đã xử lý trường hợp CSS 500 do tiến trình cũ chưa nạp theme mới và kiểm tra lại server thật thành công.

Sau khi TV1 tích hợp Identity và cung cấp tài khoản/scope hợp lệ:

1. **UC11:** đăng nhập Recruiter → header **Đăng Tin Tuyển Dụng** → điền title/industry/description/skills/requirements/deadline, kiểm tra công ty/phòng ban → chọn Lưu nháp hoặc Đăng tuyển ngay → gửi. Dashboard tự GET đọc lại; Hủy bỏ quay lại không tạo Job.
2. **UC12:** header **Bảng Điều Khiển** → Job → Chỉnh sửa → lưu; hoặc Đăng tuyển/Đóng tin. Đóng cần xác nhận, không mở lại CLOSED. Khi 409, xem dữ liệu mới trước thao tác lại.
3. **UC08:** đăng nhập Candidate → **Việc Làm IT** → Job → Nộp hồ sơ ứng tuyển → CV văn bản, cover tùy chọn → Xác nhận nộp hồ sơ. Job quá hạn/không OPEN hoặc đã nộp sẽ bị chặn.
4. **UC09:** header **Bảng Điều Khiển** → chọn stage ở sidebar → Xem chi tiết, CV và lịch sử. Tổng ở trên là toàn scope; số trong thanh danh sách là số trên trang; dùng Trang trước/sau.
5. **UC10:** trong Dashboard chọn đơn APPLIED/SCREENING/INTERVIEW → Rút đơn ứng tuyển → xác nhận → reload. Đơn giữ WITHDRAWN và CV/history; không nộp lại cho cùng Job.
6. **UC13:** Recruiter → Bảng Điều Khiển → Job → Xem ứng viên → Xem CV và xử lý. Bộ lọc và phân trang chỉ trong Job được sở hữu.
7. **UC16:** trong modal chọn một allowed transition, nhập reason/evidence nếu được yêu cầu → xác nhận. SCREENING→INTERVIEW nhắc cần lên lịch; OFFER chưa thể đi trọn quy trình người dùng nếu module Interview chưa được tích hợp. HIRED cần acceptance evidence theo form.

Mobile bấm menu ở góc phải để vào cùng các chức năng. Menu Candidate không có hành động đăng tin. Không nhập token tự ký, không bật demo toolbar trên ứng dụng thật để thực hiện các bước này.

## 8. Tests chạy trên phiên bản cuối

| Kiểm tra | Kết quả mới |
|---|---|
| `cd backend; npm test` | **288 tests: 266 PASS, 22 FAIL**; Foundation + Recruitment có **59 tests PASS**, không có lỗi trong hai nhóm này |
| `cd frontend; npm test -- --pool=threads --maxWorkers=1` | **28/28 PASS**, 2 files |
| `cd frontend; npm run lint` | 0 errors, 6 warnings đang có: unused React imports/Fast Refresh |
| `cd frontend; npm run build` | PASS |
| `node scripts/ui/verify-it-template.cjs` | PASS các đường bấm private và đối chiếu reference; môi trường fixture riêng |
| `node scripts/ui/verify-live-jobs.cjs` | PASS API/browser public thật, reload, mobile/tablet; không có browser errors |
| `node scripts/ui/verify-live.cjs` | PASS 9 kiểm tra render/reload/menu trên 5173 thật; không có runtime/module errors |
| `node scripts/ui/audit-live-recruitment.mjs` | PASS đếm/scopes/aggregate readback/live public; businessWrites = 0 |
| `git diff --check` | PASS sau dọn whitespace |

22 lỗi full suite thuộc dữ liệu/ETL hiện có: checksum working copy khác manifest, thiếu staged/immutable releases cũ (`DATA-02B.2`, `DATA-03.2`, `DATA-03.3B`), Python thiếu `pyarrow` và các assertion publication/failure-injection phụ thuộc các đầu vào đó. Các nhóm lỗi được quan sát trong lần chạy mới: DATA-04B, DATA-02B.3, DATA-02B.2, DATA-03.2, DATA-03.3B, DATA-03.4B. Không chỉnh checksum/manifests/snapshot hoặc cài/thay môi trường ETL để làm xanh ngoài scope. File scratch do test tạo đã được dọn; không xóa dữ liệu lịch sử.

Browser scripts dùng Playwright đã cài ở OS temp `recruithub-browser-checks/node_modules/playwright`, Chrome hệ thống; script đối chiếu cần reference 5174 đang chạy. Không thêm Playwright/runtime mock vào production dependencies.

## 9. File chính và điểm tích hợp còn thiếu

| Nhóm | File chính |
|---|---|
| Scoped organization/statistics API | `backend/src/routes/{job,application}.routes.js`, controllers tương ứng; `services/{job,application}.service.js`; `repositories/job-application.repository.js` |
| Regression backend | `backend/tests/recruitment/portal-context-stats.test.js`, `repository.test.js`, fixtures; các test public jobs/organization scope đã có trong working tree |
| Navigation và theme | `frontend/src/components/Navbar.jsx`, `AccountHeader.jsx`, `features/applications/applicationPresentation.js`, `src/index.css`, `tailwind.config.js`, `index.html` |
| Recruiter/Candidate UI | `pages/Dashboard/{RecruiterDashboard,JobSeekerDashboard}.jsx`, `pages/Jobs/CreateJob.jsx`, `features/jobs/components/JobForm.jsx`, `features/applications/components/ApplicationUI.jsx` |
| Public presentation | `pages/Jobs/JobList.jsx`, `features/jobs/components/PublicJobCard.jsx`, `pages/Landing.jsx` |
| Minimal Profile wiring | `pages/Profile.jsx`: chỉ phần loading/error và nhãn theo vai trò; không triển khai lại core TV1 |
| Axios và UI regression | `src/api/jobApplicationApi.js`; `tests/job-application-ui.test.jsx`, `tests/portal-navigation.test.jsx` |
| Evidence | `scripts/ui/{verify-it-template.cjs,audit-live-recruitment.mjs}`, `docs/it-template-verification/`, báo cáo này |

Working tree còn các sửa đổi từ lượt trước về proxy, error mapping, Apply/Applicant/Timeline, ProtectedRoute, Login/Register/Admin fallback và tài liệu. Đã giữ nguyên phần liên quan; không coi tất cả các file đó đều mới tạo trong lượt này.

Các dependency cần chủ phân hệ hoàn thiện:

- **TV1 Identity:** mount login/register (và flow reset/provisioning/session theo contract đã duyệt), cấp principal/JWT được backend chấp nhận, User ACTIVE hợp lệ. Live `POST /api/v1/auth/login` = 404; User ACTIVE = 0. Tất cả UC private bị chặn nghiệm thu B/C tại đây. Không tự phê duyệt draft contract đăng ký Recruiter/Department.
- **TV1 Profile/Organization UI:** `GET /api/v1/users/me` đang 404; chưa có route/API doanh nghiệp chuyên biệt thống nhất trong runtime. Form đăng tin đã có context tổ chức read-only từ TV2; không thay thế chức năng cập nhật hồ sơ doanh nghiệp của TV1.
- **TV3 Interview:** live `POST /api/v1/interviews` = 404; chưa có service/route/UI lên lịch, lưu kết quả và evidence để hoàn thành luồng mới INTERVIEW→OFFER. Không dựng Interview giả trong production. Rules/evidence validation hiện có được giữ.
- **TV3 Scoring:** hook Analyze Application hiện chưa được nối service thật; không hiển thị điểm/ranking bịa và không thay engine. Không nằm trong điều kiện được phép sửa core của lượt này.

Sau tích hợp Identity/Interview cần chạy lại các luồng B/C với tài khoản thật và dữ liệu test được duyệt. Chỉ khi đó mới có thể đánh dấu nghiệm thu toàn bộ bảy UC; chưa đạt mốc đó trong bản bàn giao này.

## 10. Commit đề xuất — chưa thực hiện

**Summary**

```text
feat(recruitment): align IT portal and add scoped dashboard context
```

**Description**

```text
Restore the JobPortal IT navigation/theme and connect recruiter create/edit,
applicant review and candidate tracking to the existing recruitment API.
Resolve read-only organization context server-side and aggregate candidate
statistics across all scoped applications with a CouchDB reduce view.

Keep canonical stages, revision conflicts, pre-write validation and precise
job deadlines. Include historical OPEN jobs without published_at through
the created_at/id index, and display public company names from CouchDB.

Validation: frontend 28 tests pass, lint has 0 errors, production build passes;
Foundation/recruitment 59 tests pass. Full backend suite: 266/288 pass with
22 existing dataset/ETL environment failures. Public live browser checks and
isolated private workflow browser checks pass. Real Identity/Interview
integration remains required for private end-to-end acceptance.
```
