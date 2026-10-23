# RecruiHub NoSQL — TV1 Frontend/Backend Template Review

## 1. Phạm vi và kết quả nhanh

- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Mục tiêu:** chạy thử và đánh giá template FE/BE hiện có; không triển khai chức năng mới.
- **Kết quả:** Frontend đã chạy ở `http://127.0.0.1:5173/`; không khởi chạy tiến trình trùng. Backend health trả lời tại port 5002. UI chỉ được rà soát bằng source và HTTP vì không có browser surface khả dụng qua CUA.
- **Thay đổi:** chỉ tạo báo cáo này; không sửa FE/BE, DB, audit, `.env`, dependencies hay cấu hình.

## 2. Repository và package setup

Repo là `BaoCao/recruithub-nosql`, branch `feature/identity-candidate-portal`. Working tree đã có các thay đổi chưa commit từ Stage 04A; không có thay đổi Frontend. Xem `git status` sau công việc để phân biệt với báo cáo mới.

| Phần | Dependencies | Scripts chính | Lock/install state |
|---|---|---|---|
| Frontend | React 19, React Router 7, Vite 8, Axios, Tailwind 3, React Toastify, lucide/react-icons | `dev`, `build`, `lint`, `preview` | `node_modules` và `package-lock.json` tồn tại |
| Backend | Express 5, Zod, CORS, dotenv; nodemon dev dependency | `dev`, `start`, legacy data `test`, ETL/foundation/recruitment/corpus/db scripts | `node_modules` và `package-lock.json` tồn tại |

Runtime: Node `v24.18.0`, npm `11.16.0`. `frontend/vite.config.js` không cấu hình port; Vite default là 5173. `frontend/.env.example` trỏ `VITE_API_BASE_URL` tới `http://localhost:5000/api`, nhưng `frontend/.env` không tồn tại. `frontend/src/services/api.js` fallback dùng `http://localhost:5000/api/v1`. Không thay đổi các giá trị này.

Lệnh cài đặt khi cần:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Trong lần kiểm tra này dependencies đã có và Vite đang phục vụ port 5173, nên không chạy cài đặt hoặc khởi chạy thêm process. Nếu máy sạch, Backend scripts là `npm.cmd ci`, `npm.cmd run dev` hoặc `npm.cmd start`; source hiện mặc định port 5000, không nên dùng port đó khi dịch vụ khác đang chiếm. Runtime hiện tại được truy cập qua 5002.

## 3. Routes, pages và components

`frontend/src/main.jsx` render `App.jsx`. Active tree là `App.jsx` → `AuthProvider` + `Navbar` + `AppRoutes` + toast container. `AppRoutes.jsx` đang được dùng; `routes/AppRouter.jsx` là một router bootstrap riêng chỉ có HomePage/404 và không được import từ `App.jsx`.

| Route | Page/component | Trạng thái hiện tại theo source |
|---|---|---|
| `/` | `Landing.jsx` | Landing template có hero, search UI, feature cards, hardcoded statistics và footer. Recent jobs chỉ được fetch nếu user đã có; request cần API chưa có. |
| `/login` | `Login.jsx` | Form và trạng thái loading/error; gọi `/auth/login` nhưng Backend không có route. UI dùng tiếng Anh. |
| `/register` | `Register.jsx` | Form registration; gọi `/auth/register` nhưng Backend không có route. |
| `/jobs` | `Jobs/JobList.jsx` | Search/filter/list template, gọi Job API không có trong Backend. |
| `/jobs/:id` | `Jobs/JobDetails.jsx` | Detail/apply/status UI; các API Job/Application chưa có trong Backend. |
| `/profile` | `Profile.jsx` | Profile editor gọi GET/PUT `/users/me`; endpoint không có. Data model dùng các field legacy camelCase/education/internships/resumeUrl, không khớp DATA-02A Candidate schema. |
| `/admin/dashboard` | `Dashboard/AdminDashboard.jsx` | Dashboard/table/actions; cần `/admin/stats`, `/admin/users`, `/admin/jobs` chưa có. |
| `/recruiter/dashboard` | `Dashboard/RecruiterDashboard.jsx` | Dashboard/job management; API chưa có. |
| `/recruiter/jobs/create` | `Jobs/CreateJob.jsx` | Job create form; API chưa có. |
| `/user/dashboard` | `Dashboard/JobSeekerDashboard.jsx` | Application dashboard; APIs chưa có. |

Shared components: `Navbar.jsx`, `ProtectedRoute.jsx`; context: `AuthContext.jsx`; API clients: `services/api.js`, `api/axiosClient.js`. Có assets tĩnh (`hero.png`, `jobSearch.png`, SVG logos). Không thấy thư mục mock data thực trong `features/`; các thư mục feature chủ yếu là `.gitkeep`.

HTTP GET tới `/`, `/login`, `/register`, `/jobs`, `/jobs/J_TEST`, `/profile`, `/admin/dashboard`, `/recruiter/dashboard` và `/user/dashboard` đều nhận Vite `index.html` với 200. Đây chỉ xác nhận dev server trả SPA fallback; do không có browser surface, không khẳng định từng React route render thành công.

## 4. Template, dữ liệu giả và khả năng dùng

- **Visual template tương đối hoàn chỉnh:** landing/marketing layout; login/register form layout; jobs list/detail shell; candidate/recruiter/admin dashboard layouts; profile editor layout. Điều này đánh giá source structure, không phải screenshot QA.
- **Mock/static values:** Landing hiển thị số `10K+ Active Jobs`, `5K+ Companies`, `50K+ Job Seekers`, `95% Success Rate` hardcoded. Landing feature copy và social links cũng là placeholder/template content. Không có bằng chứng các con số này là production metrics.
- **API-dependent, chưa có backend tương ứng:** login/register, jobs, profile, recruiter/job workflows, candidate applications, admin data/statistics. Không thấy mock adapter tách biệt để các trang này hoạt động độc lập.
- **Auth mock/legacy:** `AuthContext` đọc/giải mã token phía client và `authHelper` lưu token trong `localStorage`; `ProtectedRoute` dùng legacy role strings (`job-seeker`, `admin`, `recruiter`). Đây chỉ là client-side gating, không phải server authorization.
- **Navigation inconsistency:** active `AppRoutes` có `Landing`; `AppRouter` có `HomePage` nhưng không active. Trang HomePage riêng gọi `/health` bằng Axios client không có API base URL nếu `.env` vắng, do đó không phải landing đang chạy theo active route tree.

## 5. Backend và HTTP checks

Backend source route inventory: `GET /`, `GET /api/health`, `GET /api/health/database`; `/api/v1` router trống; không có auth, candidate profile, job, application hoặc admin API.

| Request | Kết quả | Nhận xét |
|---|---|---|
| `GET http://127.0.0.1:5173/` | 200, Vite HTML | Frontend server đang chạy, default port 5173. |
| `GET http://127.0.0.1:5173/api/health` | 200, `text/html` Vite SPA fallback | Đây không phải Backend response JSON. |
| `GET http://127.0.0.1:5002/` | 200 JSON welcome | Backend-like service đang nghe tại 5002. |
| `GET http://127.0.0.1:5002/api/health` | 200 JSON `{success:true,message:"RecruiHub Backend is running"}` | Read-only process check đạt. |
| `GET http://127.0.0.1:5002/api/health/database` | 404 `Cannot GET` | Không khớp source checkout có mount database readiness. Không restart service; process metadata không đọc được để xác định build đang chạy. CouchDB readiness chưa xác minh qua route này. |
| `GET http://127.0.0.1:5002/api/v1` | 404 | Router v1 không có root endpoint; phù hợp trạng thái hạ tầng rỗng. |
| `GET/POST http://127.0.0.1:5002/api/v1/auth/login` | 404 | Không có auth endpoint. POST này là body `{}` trong probe; không có credential hay dữ liệu người dùng. |
| Port 5000 | Có listener; GET thử trả 404 cho các đường dẫn probe | Giữ nguyên, không dừng hoặc cấu hình lại. `.env` frontend nếu sử dụng hiện trỏ tới port này, vì vậy không submit form trong trạng thái hiện tại. |

**Probe cần ghi nhận:** trong lượt kiểm tra, có một POST rỗng `{}` tới `http://127.0.0.1:5000/api/v1/auth/login`; nó trả 404. Không gửi credential, không thử lại và không can thiệp process/port 5000. Vì dịch vụ thuộc ứng dụng khác và process logs không được kiểm tra, không thể khẳng định nội bộ của dịch vụ ngoài không ghi request log; không thấy dấu hiệu endpoint xử lý request.

Backend process trên 5002 có health response phù hợp, nhưng database readiness 404 cho thấy runtime không khớp checkout; nguyên nhân chưa xác định. Không gửi POST có dữ liệu, không ghi CouchDB, và không kiểm tra trực tiếp database trong lượt này.

## 6. Đánh giá UI theo phạm vi TV1

| Phạm vi | Hiện trạng | Hành động đề xuất |
|---|---|---|
| Auth | Login/Register form và AuthContext có sẵn nhưng kết nối API giả định, localStorage token và logout host ngoài repo. | Giữ bố cục làm tham khảo; sửa auth state, API adapter, cookie/CSRF và route guards sau khi policy backend được duyệt. Không tái dùng cách lưu bearer token làm thiết kế đích. |
| Candidate Profile | Có editor nhiều mục nhưng schema/field model cũ, submit toàn object tới API không có. | Giữ layout/interaction tham khảo; xây lại data binding theo Candidate schema, allowlist PATCH, availability/provenance semantics và ownership contract. |
| Public Job Portal | Landing, list, detail, search/filter UI có khung; data/API chưa có, một số recent jobs chỉ hiện với authenticated user. | Giữ hero/card/list/detail presentation có chọn lọc; nối TV2 public DTO/filter/pagination và chỉ hiển thị OPEN jobs sau khi contract được cung cấp. |
| Admin Users | Admin dashboard có user/job tables và delete actions nhưng dữ liệu đều phụ thuộc API chưa tồn tại; bootstrap/Admin policy pending. | Giữ table shell; xây mới DTO, permissions và controls theo policy; không giữ destructive action trước khi backend authorization/API được duyệt. |
| Admin Dashboard / Statistics | KPI cards và dashboard layout có sẵn; Landing KPI là hardcoded, Admin cards fetch stats API không tồn tại. | Giữ layout/chart/card concept; thay mọi số mẫu bằng API thật; chỉ bật metrics liên module khi TV2/TV3 thống nhất định nghĩa. |

## 7. Lỗi, hạn chế và rủi ro

1. **API base URL sai/không hiệu lực:** `frontend/.env` vắng; fallback của `services/api.js` dùng port 5000 thay vì runtime 5002. `frontend/.env.example` khác suffix (`/api` so với `/api/v1`).
2. **Không có backend domain APIs:** form submit/profile/job/admin requests không thể hoàn tất.
3. **Live backend/source mismatch:** `/api/health/database` 404 dù route có trong source; cần xác định đúng process/deployment trước khi dựa vào readiness. Không tự restart.
4. **Frontend auth insecure/legacy:** token trong localStorage, JWT decode client-side, role strings lowercase và logout gọi domain ngoài dự án. Không nhập credential hoặc submit form khi thử template.
5. **Public UI data mismatch:** landing KPI giả; Job screens chưa thể xác minh OPEN-only server filtering.
6. **Candidate Profile không khớp schema:** nhiều field legacy/camelCase và data shapes khác Candidate document.
7. **UI copy/accessibility:** nhiều labels tiếng Anh; template chưa được đánh giá bằng browser screenshot do không có browser surface CUA trong session.
8. **Port 5000:** process khác đang listen; không dừng hay cấu hình lại. Frontend API fallback hiện có nguy cơ gửi request tới dịch vụ này.

## 8. Đề xuất tận dụng template

- **Giữ:** visual layout của Landing, login/register form shell, responsive cards/tables, profile section navigation, dashboard card/table patterns và shared Navbar sau khi đối chiếu role model.
- **Chỉnh:** API client thành một cấu hình `/api/v1` thống nhất trỏ backend 5002 trong dev; auth context chuyển sang server session; protected route chỉ là UX guard; copy/brand thống nhất RecruiHub; xóa KPI hardcode; bỏ logout host ngoài; mapping field theo canonical DTO.
- **Xây mới hoặc thay phần data/logic:** auth transport/session + CSRF, Candidate profile form theo schema được duyệt, public Job adapter với TV2, admin users/statistics API adapters; có loading/empty/error/success states lấy từ response thật.
- Tách template UI khỏi data-access service để các adapter có thể được kiểm thử bằng fixtures/mock thuộc khu vực development riêng. Không dùng số giả trong production.

## 9. Git và thay đổi

- Branch: `feature/identity-candidate-portal`.
- Trước khi tạo report, source/test/docs Stage 04A từ công đoạn trước đang uncommitted; Frontend files không có thay đổi.
- Tạo report này trong `docs/reports/TV1/`; không sửa source/UI/API/DB/audit/manifest, không stage/commit/push.
- Frontend port 5173 và service 5002 đã chạy sẵn; không khởi động tiến trình khác và không dừng bất kỳ listener nào.

## 10. Kết luận

**Frontend template chạy được ở `http://127.0.0.1:5173/`, Backend process tại 5002 trả health 200.** Giao diện có nhiều page shell dùng được làm nền, nhưng phần lớn nghiệp vụ chỉ là template kết nối tới API chưa tồn tại. Public Job/Stats còn placeholder; Profile chưa theo schema; Auth hiện dùng localStorage/token và host ngoài. Backend source có health/readiness + empty `/api/v1`, nhưng runtime readiness 404 cần được xác minh riêng.

Visual screenshot review chưa hoàn tất do session không có browser khả dụng qua CUA. Không thay đổi UI hoặc nghiệp vụ trong công đoạn này.
