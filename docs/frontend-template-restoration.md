# Khôi phục giao diện và kết nối nghiệp vụ theo template

> Báo cáo phiên bản mới: [JobPortal IT, bảy UC và ảnh đúng template 5174](recruitment-it-template-handoff.md). Lượt bên dưới đã dựa vào source cũ trong `docs/` (Find Your Dream Job), khác năm ảnh đích; không dùng nhận định khớp template cũ làm nghiệm thu bản IT. Giữ báo cáo này làm lịch sử.

> Cập nhật 25/10/2026: dữ liệu Jobs rỗng đã được điều tra và sửa trên CouchDB thật; xem [báo cáo live mới](public-jobs-live-verification.md). Hiện có 200 Job OPEN được public API trả đủ. Nhận định items rỗng và các kết quả fixture dưới đây là bằng chứng của lượt trước, không phải trạng thái dữ liệu mới nhất.

Ngày kiểm chứng: **24/10/2026 (Asia/Saigon)**. Branch: `feature/recruiter-management-application-lifecycle`. HEAD lúc bắt đầu: `1127fb5`. Working tree ban đầu sạch. Không checkout/merge/reset/commit/push.

## 1. Kết quả và phạm vi bàn giao

Đã đưa layout Job và Dashboard về cấu trúc của `docs/Job-Application-Portal-Frontend/`, giữ contract API/NoSQL và các bản sửa P1/P2/P3. Đã sửa navigation, thông báo lỗi/Retry, proxy phát triển, focus modal sau reload và một số chỗ template gọi API không tồn tại.

Đã kiểm tra trực tiếp bằng Chrome: desktop 1440×1000, tablet 768×1024, mobile 390×844. [Kết quả máy đọc được](ui-verification/results.json) và 29 ảnh trong [ui-verification](ui-verification/) là bằng chứng. Script lặp lại: `scripts/ui/verify-template.cjs`.

**Hai mức bằng chứng khác nhau:**

- Môi trường đang chạy thật: Frontend → proxy → Express → CouchDB; health và danh sách Jobs trả 200. API Jobs trả 0 tin trong lần kiểm tra. Không import thêm dữ liệu để làm đầy trang.
- Browser integration cho thao tác có tài khoản: dùng Express thật, middleware JWT thật với khóa ngẫu nhiên của test và MemoryRepository fixture riêng. Không cấp token demo production, không sửa users/database dùng chung. Những thao tác này chưa phải demo Identity/CouchDB thật.

API đăng nhập/đăng ký/Profile/Admin và Interview/Scoring integration chưa có trong backend hiện tại. Đã hoàn thành phần UI/adapter trong phạm vi; chưa xác nhận toàn hệ thống vận hành đầy đủ với tài khoản thật.

## 2. Nguyên nhân trước sửa

1. Entry point thật là `main.jsx → App.jsx → AppRoutes.jsx`. Navbar vốn đã được mount đúng một lần; không có bằng chứng mất sidebar toàn ứng dụng. Không thêm sidebar toàn cục.
2. Các trang Job, Recruiter Dashboard và Candidate Dashboard đã được thay bằng `Page` tối giản nền slate/indigo, làm mất hoặc đổi các khối tài khoản, layout bộ lọc và card từ template. Landing/Login/Register còn nhiều phần nguyên mẫu, nên trước đây nhìn thấy giao diện pha trộn.
3. Người chưa có phiên chỉ vào được public pages. Backend vừa merge chỉ bổ sung Foundation; chưa có API Identity để tạo phiên thật. Không phải tất cả màn hình nghiệp vụ đều bị thiếu file, nhưng chúng chưa thể truy cập với tài khoản thật qua Login.
4. Các phần template như `/jobs/recent`, response camelCase, Application.status, CV URL mẫu không tương thích API đang chạy. Đã đổi wiring thuộc Job/Application sang contract thật, không chép nghiệp vụ mẫu trở lại.

## 3. Bảng đối chiếu toàn bộ frontend

Đường dẫn template trong bảng đều tương đối với `docs/Job-Application-Portal-Frontend/src/`. Ảnh `reference-*` chạy từ **bản sao trong OS temp**, không chạy/import runtime từ thư mục docs. Reference dùng dữ liệu kiểm thử tương đương ở các trường có thể đối chiếu; các trường không có trong schema đích không được tự bổ sung.

| Route/thành phần hiện tại | Template tương ứng | Khác biệt và thay đổi thực hiện | Mức đối chiếu |
|---|---|---|---|
| `/` — Landing | `pages/Landing.jsx` | Giữ hero hai cột, ảnh jobSearch, gradient, features, dải xanh và footer; recent jobs gọi API chuẩn; thay số liệu marketing giả bằng tên chức năng; footer bỏ link chết | Đã chụp ứng dụng/reference desktop |
| Navbar | `components/Navbar.jsx` | Giữ header trắng sticky, shadow, logo gradient, tài khoản; thêm active state, menu canonical/legacy role, nút tạo tin, tracker; menu mobile đóng khi điều hướng | Đã kiểm tra desktop/mobile, đúng một Navbar |
| `/login` | `pages/Login.jsx` | Giữ cấu trúc form, logo, gradient, icons; giữ destination từ route guard, điều hướng dashboard; lỗi Identity rõ ràng; social login vô hiệu hóa và ghi chưa hỗ trợ | Đã chụp reference/app desktop, app mobile; API login thật còn thiếu |
| `/register` | `pages/Register.jsx` | Giữ form/role cards/password UI; thiếu API báo lỗi, không giả đăng ký thành công; social login và nội dung chính sách có trạng thái rõ | Đã chụp reference/app desktop; đăng ký thật chưa kiểm chứng |
| `/jobs` | `pages/Jobs/JobList.jsx` | Khôi phục nền blue-50, layout bộ lọc 1/4 + danh sách 3/4, ô tìm kiếm và card; dùng industry/seniority/required_skills; không tạo salary/location/workMode giả | Đã chụp reference/app desktop, app tablet/mobile và trạng thái lỗi |
| `/jobs/:id` | `pages/Jobs/JobDetails.jsx` | Khôi phục card trắng max-w-4xl, h1 xanh, hàng metadata/icons, nội dung và vùng Apply; timeline/CV theo schema thật | Đã chụp reference/app desktop; Apply/reload bằng browser fixture |
| `/user/dashboard` | `pages/Dashboard/JobSeekerDashboard.jsx` | Khôi phục header avatar gradient, bốn stats cards, layout filter + applications; bảy stages, CV và lịch sử thật từ API; số đếm ghi rõ trên trang hiện tại | Đã chụp reference/app desktop, app mobile; tracker/filter qua API hiện có |
| `/recruiter/dashboard` | `pages/Dashboard/RecruiterDashboard.jsx` | Khôi phục header tài khoản/avatar, Post Job, card và hàng action; thay Delete/Reopen mẫu bằng thao tác hợp lệ; giữ stats dùng view scope | Đã chụp reference/app desktop; thao tác đến INTERVIEW qua browser fixture |
| `/recruiter/jobs/create`, `/:id/edit` | `pages/Jobs/CreateJob.jsx` | Khôi phục form trắng max-w-3xl trên blue-50, tiêu đề xanh, field dọc và nhóm dropdown; field schema thật và error từng field; giữ độ chính xác deadline | Đã chụp reference/app form; tạo/sửa/đăng bằng browser fixture |
| `/recruiter/jobs/:id/applicants` | Khối applicants mở rộng trong Recruiter Dashboard; mockup applicants | Trang riêng theo route đã có; card/table/màu/nút theo template, modal CV/lịch sử/stage; không có trang độc lập tương đương để tuyên bố khớp pixel | Đã chụp desktop/mobile và modal; kiểm tra 409 và bàn phím |
| `/profile` | `pages/Profile.jsx` | Giữ layout thành công của template; trạng thái thiếu API giữ header/khối nội dung và Retry thay vì trả trang lỗi trống | Reference success và app unavailable được chụp; chưa đối chiếu success với API thật |
| `/admin/dashboard` | `pages/Dashboard/AdminDashboard.jsx` | Giữ cấu trúc cards/tables; API lỗi vẫn giữ layout và báo lỗi, số đếm hiện — thay vì 0 giả | Reference success và app unavailable được chụp; chưa kiểm chứng nghiệp vụ Admin |
| CSS/font/assets | `index.css`, `App.css`, `assets/jobSearch.png` | Giữ Tailwind/sans-serif và asset; `.card`, `.btn-*`, form-label, modal dùng chung xanh/gray; không import App.css mẫu Vite có thể bóp chiều rộng root | Đối chiếu source và ảnh; không thay asset gốc |

Không tuyên bố giống từng pixel. Template source sử dụng `.card`, `.btn-primary`, `.input-field` nhưng stylesheet tham chiếu không định nghĩa đầy đủ các class này; ứng dụng giữ định nghĩa component CSS đã có để form/card/nút hiển thị đầy đủ. Có các điều chỉnh bắt buộc về field, bảy stage, pagination và tiếng Việt. Profile/Admin success còn phụ thuộc API; không dùng ảnh unavailable làm bằng chứng khớp giao diện success.

Các bộ lọc public hiện chỉ áp dụng trên trang dữ liệu đã tải và UI ghi rõ giới hạn. Không giả hỗ trợ tìm kiếm toàn bộ corpus/lương/địa điểm khi Public Portal chưa có contract tương ứng. Candidate stats cũng không suy tổng toàn bộ đơn từ một page.

## 4. Xử lý Network Error

### Bằng chứng và nguyên nhân

Trước sửa: cổng 5173 trả HTML, `localhost:5000` và `localhost:5002` ECONNREFUSED; CouchDB 5984 trả JSON 200. Vì vậy lỗi quan sát được ở chặng trình duyệt → Backend, không đủ cơ sở quy cho CouchDB. Route Job đã được mount dưới `/api/v1`.

Đã khởi động backend bằng `npm run dev`. Backend nghe 5000. Sau đó:

| Request | Kết quả thực tế |
|---|---|
| `http://localhost:5000/api/health` | 200; CORS allow-origin http://localhost:5173 |
| `http://localhost:5000/api/health/database` | 200, ready |
| `http://localhost:5000/api/v1/jobs` | 200, items rỗng |
| `http://localhost:5173/api/health` | 200 qua proxy |
| `http://localhost:5173/api/health/database` | 200 qua proxy |
| `http://localhost:5173/api/v1/jobs` | 200 qua proxy |

### Thay đổi

- Axios chung mặc định `/api/v1`; không gọi CouchDB từ frontend.
- Vite proxy `/api` tới Backend. Port lấy theo process → backend env → root env → 5000; có override `VITE_API_PROXY_TARGET`. Frontend cố định 5173 bằng strictPort để không âm thầm đổi origin.
- Nếu đặt `VITE_API_BASE_URL` tuyệt đối, Axios vẫn tôn trọng cấu hình đó và bạn phải bảo đảm origin/port khớp. Deployment production cần reverse proxy `/api` hoặc cấu hình API URL thật; Vite dev proxy không chạy trong build production.
- Phân biệt lỗi không nhận response từ API, response proxy không hợp lệ, lỗi HTTP từ Backend/CouchDB và Identity endpoint chưa có. Không thay lỗi bằng mock/success.
- Chrome đã thử abort request Jobs, giữ Navbar/filter/layout, chụp lỗi; Retry gọi API lại thành công.

## 5. Nghiệp vụ và mức đã kiểm chứng

| UC | Đã kiểm chứng | Phần còn bị chặn |
|---|---|---|
| UC11 — tạo DRAFT/OPEN | API tests và Chrome tạo DRAFT từ menu Dashboard; đọc lại sau lưu | Chưa tạo Job bằng tài khoản Identity thật/CouchDB thật |
| UC12 — sửa/đăng/đóng | DOM tests đi từ menu qua edit/publish/close; Chrome tạo/sửa/đăng OPEN; regression giữ giây/millisecond deadline pass | Demo nghiệp vụ bằng Identity thật |
| UC08 — nộp CV | Chrome dùng signed test JWT, Express thật, lưu CV/cover letter và reload đọc lại trên fixture | Chưa nộp bằng Identity/CouchDB thật |
| UC09 — tracker | Chrome vào tracker đọc CV/stage; UI lọc/phân trang, tests reload/remount | Corpus thật và Identity thật |
| UC10 — rút đơn | Chrome xác nhận native dialog, rút từ INTERVIEW, reload vẫn WITHDRAWN/history | Identity thật |
| UC13 — xem ứng viên | Chrome từ card Job → danh sách → modal đọc CV | Identity thật |
| UC16 — chuyển stage | Chrome SCREENING → INTERVIEW; tab stale nhận 409 và reload; API tests chặn sai quyền/stage/evidence | OFFER/HIRED browser chưa chạy vì không tạo Interview/evidence giả; cần module Interview và evidence thật |

Chống trùng suốt vòng đời được kiểm tra bằng API fixture trong Chrome sau WITHDRAWN (409 DUPLICATE_APPLICATION) và regression tests cho terminal khác. Không thêm Application.status, INTERVIEWING/OFFERED, CV URL hoặc điểm giả. Không sửa repository sang BaseRepository, scoring/interview core, snapshot/manifests/checksum hoặc seeded users.

## 6. Kiểm thử, ảnh và phát hiện đã sửa

| Kiểm tra ngày 24/10/2026 | Kết quả |
|---|---|
| Frontend `npm test -- --maxWorkers=1` | 26/26 PASS, 2 files; gồm regression deadline và navigation/CRUD/error states |
| Frontend `npm run lint` | 0 errors, 7 warnings có sẵn về import React/Fast Refresh |
| Frontend `npm run build` | PASS, Vite 8.3.3 |
| Backend Foundation + Recruitment | 46/46 PASS, giữ P1/P2/P3 và evidence/concurrency tests |
| Backend `npm test` | 275 tests: 253 PASS, 22 FAIL |
| Chrome integration | PASS; 29 ảnh; desktop/tablet/mobile; không tràn ngang ở các trang chụp, đúng một Navbar chính |
| `git diff --check` | PASS; Git có cảnh báo chuyển LF→CRLF ở một số file Windows, không có whitespace error |

Chrome phát hiện một lỗi focus thực tế: bảng applicants reload thay thế nút đã mở modal, nên reference DOM cũ không còn gắn trên trang. Đã đặt ID ổn định cho nút và Modal tìm nút hiện tại khi đóng. Sau sửa, Escape đóng dialog và focus trở lại nút mở; Tab giữ focus trong native dialog. Native confirm rút đơn cũng được kiểm tra.

Lỗi full Backend được kiểm tra theo output: nhóm DATA-04B V04/V15 còn lệch checksum users.jsonl; DATA-02B.3 N-01/N-02 thiếu pyarrow, N-14/N-15 thiếu release/staged; DATA-02B.2 thiếu staged candidates; DATA-03.2/DATA-03.3B thiếu release lịch sử; DATA-03.4B checksum candidates không khớp. Đối chiếu tên lỗi với log trước sửa không có tên lỗi mới. V05/V06 kết nối đã pass khi CouchDB chạy. Không gọi full suite là PASS. Log: `$env:TEMP/recruithub-template-backend-tests.log`; phân loại chi tiết nền tại mục 9 của [bàn giao Job/Application](job-application-implementation.md).

Một số ảnh để xem nhanh:

- [Jobs desktop](ui-verification/app-jobs-desktop.png) / [template Jobs](ui-verification/reference-jobs-desktop.png).
- [Recruiter](ui-verification/app-recruiter-desktop.png) / [template Recruiter](ui-verification/reference-recruiter-desktop.png).
- [Candidate desktop](ui-verification/app-candidate-desktop.png) / [Candidate mobile](ui-verification/app-candidate-mobile.png) / [template Candidate](ui-verification/reference-candidate-desktop.png).
- [Form tạo tin](ui-verification/app-create-desktop.png) / [template form](ui-verification/reference-create-desktop.png).
- [Apply modal](ui-verification/app-apply-modal-desktop.png), [xử lý ứng viên](ui-verification/app-applicant-modal-desktop.png), [Jobs khi lỗi](ui-verification/app-jobs-network-error.png).

## 7. Cách chạy và click sử dụng

Mở Docker Desktop và chạy từ root:

```powershell
docker compose up -d
```

Terminal Backend:

```powershell
Set-Location backend
npm run dev
```

Terminal Frontend, từ root:

```powershell
Set-Location frontend
npm run dev
```

Mở http://localhost:5173. Nếu có `frontend/.env.local`, kiểm tra `VITE_API_BASE_URL=/api/v1`, rồi restart Vite khi đổi env. Không ghi đè file env hiện có chỉ để dùng cấu hình mẫu.

Khi Identity cấp phiên tương thích:

1. **Recruiter:** menu Dashboard → Tạo tin tuyển dụng → lưu DRAFT → card tin → Chỉnh sửa → Đăng tuyển → Xem ứng viên → Xem CV và xử lý → chọn stage hợp lệ. Đóng tin ở card; CLOSED không còn sửa/mở lại.
2. **Candidate:** menu Việc làm → chi tiết → Nộp hồ sơ ứng tuyển → CV/cover letter → xác nhận → menu Hồ sơ ứng tuyển. Lọc stage, xem timeline/CV hoặc rút đơn khi được phép.
3. **Mobile:** nút Mở menu đưa tới cùng chức năng. Bộ lọc Jobs có nút Hiện/Ẩn riêng; đây là filter panel từ template, không phải sidebar toàn cục.
4. Login hiện báo dịch vụ chưa tích hợp nếu nhận 404; không có mật khẩu demo chung hoặc cơ chế bỏ qua quyền.

Lặp lại kiểm tra browser khi Backend/Frontend đang chạy (Chrome đã cài; cổng 5181/5182 phải trống):

```powershell
$browserChecks = Join-Path $env:TEMP 'recruithub-browser-checks'
npm install --prefix $browserChecks --no-package-lock --no-audit --no-fund playwright
node scripts/ui/verify-template.cjs
```

Playwright chỉ cài ở OS temp; không thêm dependency production. Harness tự tạo API fixture và bản sao template trong temp; các tài khoản/token fixture chỉ dùng trong môi trường kiểm thử, không đi qua database production. Ảnh có email example.invalid là dữ liệu kiểm thử. Harness không chạy OFFER/HIRED với Interview giả.

## 8. File chính và commit đề xuất

- `frontend/src/pages/`: Landing/Login/Register/Profile, ba Dashboard, Job List/Details/Create/Applicants.
- `components/Navbar.jsx`, `AccountHeader.jsx`, `ProtectedRoute.jsx`; shared ApplicationUI/JobForm/modal/timeline và presentation.
- `frontend/src/api/axiosClient.js`, `apiError.js`, `jobApplicationApi.js`, `frontend/vite.config.js`, `.env.example`, `index.css`, `index.html`.
- `frontend/tests/portal-navigation.test.jsx` và regression UI cũ; `scripts/ui/verify-template.cjs`; tài liệu/ảnh trong docs.

Đủ bàn giao phần layout/navigation/API wiring và kiểm thử độc lập. Phần dùng tài khoản Identity thật, Profile/Admin API, corpus tuyển dụng thật và OFFER/HIRED với Interview thật chưa nghiệm thu. Các hợp đồng shared chưa chốt vẫn giữ trạng thái chưa chốt; không ghi nhóm đã phê duyệt.

```text
fix(frontend): restore portal template layouts and recruitment navigation

Restore template-based job, dashboard, form and modal presentation.
Wire canonical role navigation, protected return paths and API error states.
Use a same-origin Vite API proxy and preserve existing NoSQL contracts.
Fix modal focus after table reload; add DOM and Chrome integration checks.
Document visual comparisons, verification results and remaining dependencies.
```

Chưa commit/push. Template gốc giữ nguyên, chỉ sao chép tham chiếu để kiểm tra. Không thay dữ liệu lịch sử hoặc import lại database.

## 9. Sửa màn hình trắng trên Vite đang chạy — 24/10/2026

Đã tái hiện trực tiếp tại `http://localhost:5173`: trang HTML/entry point và health đều 200, nhưng request `/node_modules/.vite/deps/lucide-react.js?v=...` trả **504 Outdated Optimize Dep**. Module không tải được khiến React chưa mount và body trống. Browser integration ở mục 6 dùng Vite fixture riêng nên đã chưa phát hiện cache lệch của server đang phục vụ người dùng.

Đã tách cache của portal tại `node_modules/.vite/portal-dev` và prebundle `lucide-react` trong `frontend/vite.config.js`. Vite nạp lại cấu hình và tạo cache mới; không xóa node_modules hoặc dữ liệu dự án. Server tham chiếu/fixture tiếp tục dùng cache riêng trong temp.

Đã bổ sung `scripts/ui/verify-live.cjs`, kiểm tra **server thật cổng 5173**, không thay API bằng fixture. Chrome xác minh trang chủ, Jobs, Login, Register ở lượt tải đầu và reload, cùng menu mobile: **9/9 checks PASS**, không có runtime/module errors. Kết quả tại [live-results.json](ui-verification/live-results.json). Lint/build sau sửa PASS, còn 7 warnings đã ghi nhận. Checks này xác minh màn hình tải được, không xác nhận API đăng nhập đã được bổ sung.

Nếu một tab cũ còn giữ bundle trước sửa, dùng Ctrl+F5. Khi cần làm mới dependency cache thủ công, dừng Vite rồi chạy `npm run dev -- --force` từ frontend. Không chạy thêm Vite trên cùng cổng khi tiến trình hiện tại vẫn đang hoạt động.
