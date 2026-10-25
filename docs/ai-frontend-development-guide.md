# Hướng dẫn AI phát triển Frontend RecruiHub NoSQL

Tài liệu này là chỉ dẫn làm việc bắt buộc dành cho AI Coding Agent khi xây dựng và mở rộng mã nguồn giao diện trong thư mục `frontend/` của dự án **RecruiHub NoSQL**. Đọc toàn bộ tài liệu này trước khi tạo hoặc chỉnh sửa bất kỳ component nào.

> **BẮT BUỘC — TEMPLATE UI HIỆN HÀNH:** Mọi task tạo hoặc sửa UI phải đọc tài liệu này **và mã nguồn template hiện có** tại [`Job-Application-Portal-Frontend/`](./Job-Application-Portal-Frontend/) trước khi viết code. Không được chỉ đọc tên file, dựa vào trí nhớ của phiên trước hoặc tự thiết kế một phong cách khác. Template là chuẩn trực quan bắt buộc về bố cục, màu sắc, typography, khoảng cách và tương tác; schema/API/quy tắc nghiệp vụ vẫn tuân theo `AGENTS.md`. Chưa có bằng chứng đọc và đối chiếu template thì chưa được bắt đầu triển khai UI.

## 0. Cổng kiểm tra bắt buộc trước khi làm UI

### 0.1. Các file phải đọc

Đường dẫn trong bảng tính từ `docs/Job-Application-Portal-Frontend/`:

| Phạm vi | File bắt buộc đọc | Nội dung cần đối chiếu |
| --- | --- | --- |
| Mọi task UI | `package.json`, `tailwind.config.js`, `src/index.css`, `src/App.css`, `index.html` | Phiên bản thư viện, font được nạp, màu, shadow và class dùng chung |
| Khung ứng dụng và điều hướng | `src/App.jsx`, `src/components/Navbar.jsx`, `src/routes/AppRoutes.jsx` | Navbar, container, bố cục chung, menu mobile, vị trí toast |
| Đăng nhập, đăng ký, phân quyền | `src/pages/Login.jsx`, `src/pages/Register.jsx`, `src/context/AuthContext.jsx`, `src/components/ProtectedRoute.jsx` | Bố cục form và trạng thái giao diện; đối chiếu riêng hợp đồng auth thật |
| Trang chủ | `src/pages/Landing.jsx` | Hero, tìm kiếm, các section và CTA |
| Danh sách, chi tiết, tạo tin | `src/pages/Jobs/JobList.jsx`, `src/pages/Jobs/JobDetails.jsx`, `src/pages/Jobs/CreateJob.jsx` | Bộ lọc, job card, thông tin chi tiết và form |
| Dashboard ứng viên, hồ sơ | `src/pages/Dashboard/JobSeekerDashboard.jsx`, `src/pages/Profile.jsx` | Thẻ tổng quan, danh sách ứng tuyển và form hồ sơ |
| Dashboard nhà tuyển dụng | `src/pages/Dashboard/RecruiterDashboard.jsx` | Thống kê và quản lý tin tuyển dụng |
| Dashboard quản trị | `src/pages/Dashboard/AdminDashboard.jsx` | Stat card, bảng và vùng chi tiết quản trị |

Mỗi task phải đọc nhóm file dùng chung và nhóm màn hình liên quan; theo tiếp các import/component/style được màn hình đó sử dụng. Với màn hình chưa có mẫu trực tiếp (phỏng vấn, ranking, audit/logs), đọc dashboard gần nhất với vai trò tương ứng và tái sử dụng ngôn ngữ thiết kế của nó.

### 0.2. Bằng chứng đọc phải có trong Mini Plan

Trước khi sửa UI, AI phải trình bày:

1. **Đã đọc:** Liệt kê đường dẫn file template thực sự đã mở và nhận xét cụ thể về bố cục/class của từng nhóm liên quan.
2. **Đối chiếu:** Nêu màn hình/component production sẽ dựa trên file mẫu nào, phần giữ lại và phần điều chỉnh theo nghiệp vụ RecruiHub.
3. **Phạm vi:** Liệt kê file production dự kiến tạo/sửa, API thật sử dụng, bốn trạng thái UI và kế hoạch kiểm tra responsive.
4. **Sai khác:** Ghi rõ khác biệt giữa template và schema/API/nghiệp vụ; không sao chép endpoint, role, dữ liệu mock hoặc hành vi trái hợp đồng thật.

Tuân thủ bước duyệt Mini Plan trong `AGENTS.md` khi chưa được duyệt trước. Nếu thiếu hoặc không đọc được file mẫu, báo chính xác file bị thiếu và phần bị chặn; không tự nhận đã đối chiếu. Khi template được cập nhật, đọc lại các file liên quan ở task tiếp theo.

### 0.3. Checklist nghiệm thu UI theo mẫu

- [ ] Có danh sách file template đã đọc và mapping sang file production.
- [ ] Bố cục, font, màu, card, nút, input, badge và khoảng cách bám mẫu hiện hành.
- [ ] Đã đối chiếu giao diện ở mobile, tablet và desktop; ghi kích thước thực tế đã kiểm tra.
- [ ] Có Loading / Empty / Error / Success và kiểm tra tương tác liên quan.
- [ ] Các sai khác có lý do nghiệp vụ/kỹ thuật rõ ràng; thay đổi phong cách ngoài yêu cầu cần được người dùng duyệt.
- [ ] Ghi kết quả thật của lint/build và bằng chứng xem giao diện nếu có; không nhận đã kiểm tra trực quan khi chỉ đọc code.

**Giới hạn thực thi:** Tài liệu Markdown không tự cưỡng chế công cụ đọc file. `AGENTS.md` đã yêu cầu đọc hướng dẫn này trước task; cổng kiểm tra và bằng chứng ở trên là điều kiện để review/nghiệm thu công việc UI.

---

## 1. Mục tiêu và Ba phân vùng giao diện

Xây dựng ứng dụng Single Page Application (SPA) trên nền **React 19 + Vite** phục vụ 3 nhóm người dùng chính và khách công cộng:

1. **Khách công cộng & Ứng viên (Public & Candidate Portal)**:
   - Trang chủ giới thiệu hệ thống, tìm kiếm việc làm nhanh.
   - Danh sách tin tuyển dụng (`/jobs`), lọc theo từ khóa, kỹ năng, địa điểm, mức lương.
   - Chi tiết tin tuyển dụng (`/jobs/:id`) kèm mô tả công việc, yêu cầu kỹ năng và nút nộp hồ sơ.
   - Đăng ký (`/register`), Đăng nhập (`/login`).
   - Bảng điều khiển ứng viên (`/user/dashboard`): Theo dõi các vị trí đã ứng tuyển, tiến độ qua **7 stages** (`APPLIED` → `SCREENING` → `INTERVIEWING` → `OFFERED` → `HIRED`), rút đơn ứng tuyển.
   - Hồ sơ ứng viên (`/profile`): Quản lý kỹ năng chuyên môn, số năm kinh nghiệm, học vấn và CV văn bản.

2. **Nhà tuyển dụng (Recruiter Portal)**:
   - Bảng điều khiển nhà tuyển dụng (`/recruiter/dashboard`): Thống kê tin tuyển dụng đang mở, số lượng hồ sơ nhận được.
   - Đăng tin tuyển dụng mới (`/recruiter/jobs/create`): Nhập tiêu đề, mô tả, yêu cầu kỹ năng, mức lương, số năm kinh nghiệm, chọn trạng thái (`OPEN` hoặc `DRAFT`).
   - Danh sách ứng viên theo tin tuyển dụng (`/recruiter/jobs/:id/applicants`):
     - Hiển thị danh sách ứng viên đã nộp đơn.
     - **Huy hiệu điểm phù hợp (AI Match Score Badge)**: Điểm tổng hợp từ 0–100%.
     - **Bảng xếp hạng ứng viên (Deterministic Ranking)**: Sắp xếp ứng viên theo mức độ phù hợp cao nhất.
     - **Ngăn chi tiết điểm số (Score Breakdown Drawer)**: Xem chi tiết kỹ năng trùng khớp, kỹ năng còn thiếu, số năm kinh nghiệm và độ tương đồng chuyên ngành.
     - Chuyển trạng thái ứng viên qua các vòng tuyển dụng.
     - Lên lịch phỏng vấn và ghi nhận đánh giá (`/recruiter/interviews`).

3. **Quản trị viên (Admin Portal)**:
   - Bảng điều khiển quản trị (`/admin/dashboard`): Thống kê số lượng documents trên CouchDB thuộc 9 loại tài liệu.
   - Quản lý người dùng: Bảng danh sách tài khoản, tìm kiếm, khóa hoặc kích hoạt tài khoản.

---

## 2. Phạm vi thư mục và Quy tắc sử dụng Template

- **Chỉ viết mã nguồn chạy thật trong thư mục `frontend/`**.
- **Thư mục tham khảo `docs/Job-Application-Portal-Frontend/`**:
  - Đây là mẫu giao diện hiện hành, bắt buộc đọc và bám theo về bố cục, styling Tailwind, icons và cấu trúc component theo mục 0.
  - Tuyệt đối **không chỉnh sửa trực tiếp** và **không import runtime** từ bên trong `docs/Job-Application-Portal-Frontend/`.
  - Khi cần một component từ template, hãy sao chép phần logic cần thiết sang `frontend/src/components/` hoặc `frontend/src/features/`, đổi tên và điều chỉnh dữ liệu cho khớp với API của RecruiHub.
- **Không chỉnh sửa `backend/`** trừ khi yêu cầu làm việc đang giao thuộc một task Vertical Slice hoàn chỉnh được chỉ định rõ.
- **Không commit** `node_modules`, file build (`dist/`), hoặc file môi trường `.env`.

---

## 3. Thứ tự ưu tiên Nguồn sự thật (Source of Truth)

Khi có điểm chưa rõ hoặc bất đồng giữa các tài liệu, tuân thủ thứ tự ưu tiên sau:

1. **Mã nguồn Backend và Zod Schemas thật**: `backend/src/schemas/` và các routes trong `backend/src/routes/`.
2. **Quy tắc nghiệp vụ**: `docs/recruitment-business-rules.md` và `docs/recruithub-usecase-system.md`.
3. **Bản vẽ màn hình**: `docs/recruithub-screen-mockups.md`.
4. **Kiến trúc hệ thống**: `ARCHITECTURE.md`.
5. **Template giao diện tham khảo**: `docs/Job-Application-Portal-Frontend/` (tham khảo phong cách trực quan, màu sắc và layout).

Thứ tự trên không cho phép bỏ qua template khi làm UI. Với dữ liệu/nghiệp vụ, áp dụng đầy đủ thứ tự nguồn sự thật trong `AGENTS.md` (gồm CouchDB thực tế và Zod schemas); với cách thể hiện trực quan, phải bám template hiện hành. Nếu mockup và template khác bố cục, ghi rõ khác biệt trong Mini Plan, giữ đầy đủ chức năng nghiệp vụ và xin quyết định khi không thể dung hòa.

> Tuyệt đối không tự suy diễn các trường dữ liệu hoặc endpoint mới chỉ từ tên biến của template tham khảo. Template gốc sử dụng backend khác với CouchDB NoSQL của RecruiHub.

---

## 4. Quy tắc làm việc bắt buộc cho AI Agent

Trước mỗi phần việc trên Frontend, AI bắt buộc phải:
0. Hoàn tất cổng kiểm tra ở mục 0: đọc file style/khung ứng dụng và màn hình template liên quan, báo bằng chứng cùng mapping trong Mini Plan.
1. Đọc component hoặc trang hiện có trong `frontend/src/`.
2. Đối chiếu màn hình tương ứng trong [docs/recruithub-screen-mockups.md](file:///docs/recruithub-screen-mockups.md).
3. Đọc Use Case và Business Rules liên quan.
4. Kiểm tra endpoint REST API thật ở `backend/` trước khi gọi Axios.
5. Nếu Backend endpoint chưa hoàn thành:
   - Xây dựng giao diện với dữ liệu mock đặt riêng tại `frontend/src/mocks/`.
   - Ghi chú `// TODO: Replace with real API endpoint: POST /api/v1/...`.
   - Thiết kế Service tách biệt để khi Backend hoàn thành chỉ cần trỏ endpoint mà không phải sửa lại Component UI.
6. Sau khi viết hoặc sửa code, bắt buộc chạy kiểm tra:
   ```bash
   cd frontend
   npm run lint
   npm run build
   ```
   *Không được báo cáo hoàn tất nếu lệnh build hoặc lint phát sinh lỗi.*

---

## 5. Công nghệ & Quy ước kiến trúc Frontend

### 5.1. Công nghệ sử dụng
- **React 19 & Vite 8**: Sử dụng Functional Components và React Hooks chuẩn (`useState`, `useEffect`, `useCallback`, `useMemo`).
- **React Router DOM v7**: Điều hướng trang Single Page Application.
- **Tailwind CSS**: Thiết kế giao diện hiện đại, responsive, kết hợp màu sắc hài hòa.
- **Lucide Icons (`lucide-react`)**: Bộ biểu tượng giao diện chuẩn xác, đồng bộ.
- **React Toastify**: Hiển thị thông báo popup trực quan (thành công, cảnh báo, lỗi).
- **Day.js**: Định dạng thời gian chuẩn Việt Nam (`DD/MM/YYYY HH:mm`).

### 5.2. Tổ chức thư mục theo Feature-Based Architecture
Mỗi miền nghiệp vụ lớn được đóng gói gọn trong `frontend/src/features/`:

```text
frontend/src/features/
├── auth/                    # Đăng nhập, đăng ký, phiên người dùng
│   ├── components/LoginForm.jsx
│   ├── components/RegisterForm.jsx
│   └── services/authService.js
├── jobs/                    # Quản lý & duyệt tin tuyển dụng
│   ├── components/JobCard.jsx
│   ├── components/JobFilter.jsx
│   ├── components/JobDetailHeader.jsx
│   └── services/jobService.js
├── applications/            # Nộp hồ sơ & theo dõi tiến trình
│   ├── components/ApplyModal.jsx
│   ├── components/ApplicationTimeline.jsx
│   └── services/applicationService.js
├── interviews/              # Phỏng vấn & đánh giá
│   ├── components/InterviewScheduleModal.jsx
│   └── services/interviewService.js
├── scoring/                 # Điểm phù hợp & xếp hạng AI
│   ├── components/MatchScoreBadge.jsx
│   ├── components/ScoreBreakdownDrawer.jsx
│   └── components/RankingTable.jsx
└── admin/                   # Bảng điều khiển quản trị
    └── components/CouchDbStats.jsx
```

---

## 6. Kết nối API & Quản lý Trạng thái

### 6.1. Cấu hình Axios Client tập trung
Mọi kết nối Backend đi qua file `frontend/src/api/client.js`:

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Gắn Bearer Token tự động vào header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý lỗi tập trung
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
```

### 6.2. Xử lý 4 trạng thái giao diện bắt buộc
Mỗi màn hình hiển thị dữ liệu phải xử lý trọn vẹn 4 trạng thái:
1. **Loading State**: Hiển thị Skeleton Loader hoặc vòng quay Spinner trong khi chờ API phản hồi. Không để màn hình trắng.
2. **Empty State**: Khi danh sách rỗng (chưa có Job, chưa nộp đơn nào), hiển thị hình minh họa nhẹ nhàng kèm thông điệp rõ ràng và nút kêu gọi hành động (CTA).
3. **Error State**: Khi API trả về mã lỗi (`401`, `403`, `404`, `500`), hiển thị hộp thông báo lỗi thân thiện kèm nút "Thử lại" (Retry).
4. **Success State**: Hiển thị đầy đủ danh sách và dữ liệu người dùng.

---

## 7. Quy chuẩn thiết kế UI & Màu sắc nghiệp vụ

Hệ thống sử dụng bảng màu Tailwind chuẩn mang lại cảm giác hiện đại, chuyên nghiệp cho một nền tảng ATS:

### 7.1. Quy chuẩn lấy từ template hiện hành

Đọc lại `tailwind.config.js` và `src/index.css` của template để xác minh các giá trị trước khi triển khai; các quy chuẩn đang có gồm:

- **Font:** `Plus Jakarta Sans`, fallback `Inter`, `system-ui`, `sans-serif`; kiểm tra cách nạp font trong `index.html`.
- **Nền và chữ:** `bg-slate-50`, `text-slate-800`, `antialiased`; card nền trắng, viền slate nhẹ.
- **Navbar:** sticky, nền `bg-white/95`, blur nhẹ; container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`; menu co gọn trên mobile.
- **Nút chính `.btn-primary`:** gradient blue → indigo, `rounded-xl`, chữ semibold, shadow và trạng thái hover/active. Nút phụ `.btn-secondary`: nền trắng, viền slate.
- **Card `.card-portal`:** `rounded-2xl`, `border-slate-200/80`, `shadow-soft`, hover `shadow-hover`; stat card dashboard có thể dùng `rounded-3xl` theo trang mẫu tương ứng.
- **Input `.input-field`:** `rounded-xl`, padding `px-4 py-3`, focus viền blue và ring nhẹ.
- **Badge:** `.badge-salary` xanh emerald, `.badge-hot` đỏ, `.badge-tag` slate. Chỉ hiển thị nhãn nghiệp vụ khi có dữ liệu thật hỗ trợ.
- **Token mở rộng:** `brand.green`, `brand.red`, `brand.dark`, `brand.blue` và shadow `soft`, `hover`, `card`. Khi mang class sang production phải chuyển cả token/style phụ thuộc trong phạm vi được duyệt, tương thích phiên bản Tailwind của production.

Không tự đổi font, palette, độ bo góc hoặc layout tổng thể ngoài yêu cầu. Có thể chuẩn hóa icon theo Lucide của dự án và đổi thương hiệu `JobPortal` thành `RecruiHub` trong production, đồng thời giữ kích thước và cách bố trí của mẫu.

Không sao chép `TestToolbar`, `mockAdapter`, `mockData`, auth demo hoặc API của template vào luồng production. Template có thể dùng role `admin`/`recruiter`/`job-seeker` và dependency version khác stack dự án; phải ánh xạ theo schema/API và package thực tế, không đổi hợp đồng chỉ để khớp template.

### 7.2. Màu sắc nghiệp vụ

- **Màu chủ đạo (Primary)**: `indigo-600` / `blue-600` (Nút bấm chính, liên kết, header nổi bật).
- **Màu nền (Background)**: `bg-slate-50` cho trang tổng thể, `bg-white` cho thẻ card nội dung.
- **Trạng thái Application (7 Stages)**:
  - `APPLIED`: Huy hiệu màu Xanh da trời (`bg-sky-100 text-sky-800`).
  - `SCREENING`: Huy hiệu màu Tím nhạt (`bg-purple-100 text-purple-800`).
  - `INTERVIEWING`: Huy hiệu màu Vàng cam (`bg-amber-100 text-amber-800`).
  - `OFFERED`: Huy hiệu màu Xanh ngọc (`bg-teal-100 text-teal-800`).
  - `HIRED`: Huy hiệu màu Xanh lá (`bg-emerald-100 text-emerald-800`).
  - `REJECTED`: Huy hiệu màu Đỏ nhạt (`bg-rose-100 text-rose-800`).
  - `WITHDRAWN`: Huy hiệu màu Xám tro (`bg-slate-100 text-slate-800`).
- **Huy hiệu điểm phù hợp AI (Match Score Badge)**:
  - $\ge 80\%$: Điểm rất cao — Xanh lá (`bg-emerald-500 text-white`, Khuyến nghị mạnh).
  - $60\% - 79\%$: Điểm trung bình khá — Xanh lam (`bg-blue-500 text-white`, Phù hợp).
  - $< 60\%$: Điểm thấp — Cam/Đỏ (`bg-amber-500 text-white`, Cân nhắc thêm).

---

## 8. Tuyến đường & Phân quyền bảo vệ (Routing & Guard)

Hệ thống cấu hình danh mục tuyến đường trong `frontend/src/routes/AppRoutes.jsx`:

| Tuyến đường (Route) | Quyền truy cập | Trang hiển thị |
| :--- | :--- | :--- |
| `/` | Công cộng (All) | `Landing.jsx` |
| `/login`, `/register` | Khách vãng lai | `Login.jsx`, `Register.jsx` |
| `/jobs` | Công cộng (All) | `JobsPage.jsx` |
| `/jobs/:id` | Công cộng (All) | `JobDetailPage.jsx` |
| `/user/dashboard` | `CANDIDATE` | `CandidateDashboard.jsx` |
| `/profile` | `CANDIDATE`, `RECRUITER` | `CandidateProfile.jsx` |
| `/recruiter/dashboard` | `RECRUITER` | `RecruiterDashboard.jsx` |
| `/recruiter/jobs/create` | `RECRUITER` | `PostJobPage.jsx` |
| `/recruiter/jobs/:id/applicants` | `RECRUITER` | `JobApplicantsPage.jsx` |
| `/admin/dashboard` | `ADMIN` | `AdminDashboard.jsx` |

> Nếu người dùng chưa đăng nhập cố gắng truy cập trang yêu cầu quyền, `ProtectedRoute` sẽ lưu lại trang hiện tại và điều hướng về `/login`. Sau khi đăng nhập thành công, tự động chuyển hướng người dùng về đúng trang mong muốn ban đầu.
