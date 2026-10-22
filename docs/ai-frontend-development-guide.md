# Hướng dẫn AI phát triển Frontend RecruiHub NoSQL

Tài liệu này là chỉ dẫn làm việc bắt buộc dành cho AI Coding Agent khi xây dựng và mở rộng mã nguồn giao diện trong thư mục `frontend/` của dự án **RecruiHub NoSQL**. Đọc toàn bộ tài liệu này trước khi tạo hoặc chỉnh sửa bất kỳ component nào.

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
  - Đây là mẫu giao diện gốc được giữ nguyên làm tài liệu tham khảo về bố cục, styling Tailwind, icons và cấu trúc component.
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

> Tuyệt đối không tự suy diễn các trường dữ liệu hoặc endpoint mới chỉ từ tên biến của template tham khảo. Template gốc sử dụng backend khác với CouchDB NoSQL của RecruiHub.

---

## 4. Quy tắc làm việc bắt buộc cho AI Agent

Trước mỗi phần việc trên Frontend, AI bắt buộc phải:
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
