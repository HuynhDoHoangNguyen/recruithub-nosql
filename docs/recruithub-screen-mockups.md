# RecruiHub NoSQL — Danh sách Màn hình và Wireframe Mockups

Tài liệu này đặc tả chi tiết kiến trúc giao diện, tuyến đường (Route), cấu trúc component, bản vẽ wireframe ASCII và hợp đồng API tương ứng cho toàn bộ màn hình của hệ thống **RecruiHub NoSQL**.

Thiết kế giao diện kế thừa phong cách hiện đại từ template tham khảo `docs/Job-Application-Portal-Frontend/` (Tailwind CSS, Lucide Icons, React Toastify, bảng điều khiển phân vai trò).

---

## 1. Danh mục các nhóm màn hình

1. **Nhóm Public & Auth (Công cộng & Xác thực)**
   - 1.1. Landing Page (`/`)
   - 1.2. Job Search & Listing (`/jobs`)
   - 1.3. Job Details (`/jobs/:id`)
   - 1.4. Đăng nhập (`/login`)
   - 1.5. Đăng ký (`/register`)
2. **Nhóm Candidate Portal (Ứng viên)**
   - 2.1. Candidate Dashboard & Applications Tracker (`/user/dashboard`)
   - 2.2. Candidate Profile & Resume Skills (`/profile`)
   - 2.3. Modal nộp hồ sơ ứng tuyển (Apply Job Modal)
3. **Nhóm Recruiter Portal (Nhà tuyển dụng)**
   - 3.1. Recruiter Dashboard (`/recruiter/dashboard`)
   - 3.2. Đăng / Sửa tin tuyển dụng (`/recruiter/jobs/create`, `/recruiter/jobs/:id/edit`)
   - 3.3. Quản lý ứng viên & Bảng xếp hạng AI (`/recruiter/jobs/:id/applicants`)
   - 3.4. Ngăn chi tiết phân tích hồ sơ (AI Match Score Drawer)
   - 3.5. Modal lên lịch & Đánh giá phỏng vấn (Interview Modal)
4. **Nhóm Admin Portal (Quản trị viên)**
   - 4.1. Admin Dashboard & Thống kê CouchDB (`/admin/dashboard`)
   - 4.2. Quản lý tài khoản người dùng (`/admin/users`)

---

## 2. Nhóm Public & Auth Screens

### 2.1. Landing Page
- **Route:** `/`
- **Mục đích:** Giới thiệu nền tảng tuyển dụng thông minh tích hợp AI Scoring Engine, thanh tìm kiếm nhanh việc làm nổi bật.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub]          Tìm việc làm        Về chúng tôi            [ Đăng nhập ] [ Đăng ký ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                     TÌM KIẾM CƠ HỘI NGHỀ NGHIỆP LÝ TƯỞNG CỦA BẠN                       │
│           Hệ thống kết nối ứng viên & nhà tuyển dụng với AI Resume Matching thông minh   │
│                                                                                         │
│   ┌────────────────────────┬──────────────────────┬──────────────────┬──────────────┐   │
│   │ 🔍 Tiêu đề, kỹ năng...  │ 📍 Địa điểm (Hà Nội) │ 💼 Toàn thời gian│ [ Tìm kiếm ] │   │
│   └────────────────────────┴──────────────────────┴──────────────────┴──────────────┘   │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ CÁC VỊ TRÍ NỔI BẬT ĐANG TUYỂN DỤNG                                        [Xem tất cả >] │
│                                                                                         │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ ┌─────────────────────┐ │
│ │ Senior Frontend Engineer    │ │ Backend NoSQL Specialist    │ │ AI Data Engineer    │ │
│ │ TechCorp Vietnam • Hà Nội   │ │ DataHub Solutions • TP.HCM  │ │ SmartRecruit • Từ xa│ │
│ │ 💰 30M - 45M VND            │ │ 💰 35M - 50M VND            │ │ 💰 40M - 60M VND    │ │
│ │ [React] [TypeScript] [Tail] │ │ [Node.js] [CouchDB] [Docker]│ │ [Python] [NLP] [Zod]│ │
│ │ Đăng 2 ngày trước   [Xem]   │ │ Đăng 1 ngày trước   [Xem]   │ │ Đăng 3 giờ trước[Xem│ │
│ └─────────────────────────────┘ └─────────────────────────────┘ └─────────────────────┘ │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ĐIỂM NỔI BẬT CỦA RECRUIHUB NOSQL                                                        │
│  ⚡ Tốc độ CouchDB NoSQL       🎯 AI Resume Scoring Engine     📊 7 Stages ATS Rõ Ràng    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2. Job Search & Listing Page
- **Route:** `/jobs`
- **API cần gọi:** `GET /api/v1/jobs?keyword=&location=&skills=&minSalary=&page=&limit=10`
- **Chức năng:** Bộ lọc đa tiêu chí bên trái, danh sách thẻ việc làm phân trang bên phải.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub]          Việc làm      Bảng điều khiển                     [ 👤 Nguyễn Văn A ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ BỘ LỌC TÌM KIẾM             │ DANH SÁCH VIỆC LÀM (Hiển thị 200 vị trí OPEN)   [Sắp xếp v]│
│                             ├───────────────────────────────────────────────────────────┤
│ 🔍 Từ khóa                  │ ┌───────────────────────────────────────────────────────┐ │
│ [ React, Node.js...       ] │ │ Senior Fullstack Developer (Node.js / React)   [HOT]  │ │
│                             │ │ FPT Software • Hà Nội / Hybrid • 💰 30M - 45M VND      │ │
│ 📍 Địa điểm                 │ │ Yêu cầu: 3+ năm kinh nghiệm, React, Express, CouchDB  │ │
│ [ Tất cả địa điểm         v]│ │ Kỹ năng: [React] [Node.js] [CouchDB] [TailwindCSS]     │ │
│                             │ │ Hạn nộp: 30/11/2026                 [ Ứng tuyển ngay ]│ │
│ 💼 Loại hình                │ └───────────────────────────────────────────────────────┘ │
│ [x] Toàn thời gian          │ ┌───────────────────────────────────────────────────────┐ │
│ [ ] Bán thời gian           │ │ Backend Engineer (NoSQL Database Architecture)        │ │
│ [ ] Remote / Làm từ xa      │ │ VNG Corporation • TP. Hồ Chí Minh • 💰 35M - 55M VND  │ │
│                             │ │ Yêu cầu: Thiết kế document schema, tối ưu Mango query  │ │
│ 💰 Mức lương tối thiểu      │ │ Kỹ năng: [NoSQL] [CouchDB] [Express] [Docker]         │ │
│ [ 20.000.000 VND          ] │ │ Hạn nộp: 15/12/2026                 [ Ứng tuyển ngay ]│ │
│                             │ └───────────────────────────────────────────────────────┘ │
│ [ Áp dụng lọc ] [ Đặt lại ] │           < Trang trước   [1]  2   3   4 ...  Trang sau > │
└─────────────────────────────┴───────────────────────────────────────────────────────────┘
```

---

### 2.3. Job Details Page
- **Route:** `/jobs/:id`
- **API cần gọi:** `GET /api/v1/jobs/:id`
- **Chức năng:** Xem đầy đủ yêu cầu, trách nhiệm, mức lương, và kích hoạt modal nộp hồ sơ.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub]          < Quay lại danh sách việc làm                      [ 👤 Nguyễn Văn A ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Senior Fullstack Developer (Node.js / CouchDB / React)           [ NỘP ĐƠN ỨNG TUYỂN ] │
│  Công ty Cổ phần Công nghệ RecruiTech                                                   │
│  📍 Hà Nội (Cầu Giấy)   💼 Toàn thời gian   💰 35M - 50M VND   📅 Hạn nộp: 30/11/2026   │
│                                                                                         │
├───────────────────────────────────────────────────────┬─────────────────────────────────┤
│ MÔ TẢ CÔNG VIỆC                                       │ THÔNG TIN TỔNG QUAN             │
│ - Tham gia phát triển hệ thống quản lý tuyển dụng ATS │ Cấp bậc: Senior                 │
│ - Tối ưu hóa các truy vấn Mango trên Apache CouchDB   │ Kinh nghiệm: 3 - 5 năm          │
│ - Xây dựng các RESTful APIs bảo mật với Express.js 5  │ Số lượng tuyển: 2 người         │
│                                                       │ Ngày đăng: 20/10/2026           │
│ YÊU CẦU ỨNG VIÊN                                      ├─────────────────────────────────┤
│ - Thành thạo JavaScript/TypeScript, React 19, Tailwind│ KỸ NĂNG BẮT BUỘC (HARD SKILLS)  │
│ - Kinh nghiệm làm việc với cơ sở dữ liệu NoSQL        │ [React] [Node.js] [CouchDB]     │
│ - Tư duy phân tích thuật toán và xử lý bất đồng bộ    │ [Express.js] [Docker] [REST API]│
│                                                       │                                 │
│ QUYỀN LỢI ĐƯỢC HƯỞNG                                  │ CHIA SẺ CÔNG VIỆC               │
│ - Lương tháng 13, thưởng hiệu suất định kỳ            │ [🔗 Sao chép link]              │
│ - Bảo hiểm sức khỏe cao cấp, máy tính cấu hình cao    │                                 │
└───────────────────────────────────────────────────────┴─────────────────────────────────┘
```

---

## 3. Nhóm Candidate Portal (Ứng viên)

### 3.1. Candidate Dashboard & Applications Tracker
- **Route:** `/user/dashboard`
- **API cần gọi:** `GET /api/v1/applications/my-applications`
- **Chức năng:** Quản lý toàn bộ đơn ứng tuyển đã nộp, theo dõi tiến trình 7 stages.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub]   Tìm việc làm   [ Đơn ứng tuyển của tôi ]   Hồ sơ          [ 👤 Nguyễn Văn A ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ BẢNG ĐIỀU KHIỂN ỨNG VIÊN                                                                │
│ Tổng đơn đã nộp: 3   │   Đang phỏng vấn: 1   │   Được đề nghị: 1   │   Đã tuyển: 0      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ TIẾN ĐỘ CÁC VỊ TRÍ ĐÃ ỨNG TUYỂN                                                         │
│                                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Senior Fullstack Developer • RecruiTech                       Ngày nộp: 22/10/2026  │ │
│ │ Trạng thái hiện tại: [ INTERVIEWING ]                         Mã đơn: app_001_cand  │ │
│ │                                                                                     │ │
│ │  (•) APPLIED ─── (•) SCREENING ─── (•) INTERVIEWING ─── ( ) OFFERED ─── ( ) HIRED   │ │
│ │   22/10/2026       24/10/2026          Hôm nay                                      │ │
│ │                                                                                     │ │
│ │ 📅 Lịch phỏng vấn sắp tới: Vòng 1 - Technical Interview (25/10/2026 lúc 09:30 AM)   │ │
│ │                                                       [ Xem chi tiết ] [ Rút đơn ]  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Backend Engineer • VNG Corporation                            Ngày nộp: 15/10/2026  │ │
│ │ Trạng thái hiện tại: [ OFFERED ]                              Mã đơn: app_002_cand  │ │
│ │  (•) APPLIED ─── (•) SCREENING ─── (•) INTERVIEWING ─── (•) OFFERED ─── ( ) HIRED   │ │
│ │                                                       [ Xem thư mời ] [ Từ chối ]   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2. Modal nộp hồ sơ ứng tuyển (Apply Job Modal)
- **Kích hoạt từ:** Nút "Nộp đơn ứng tuyển" tại trang Job Details.
- **API gọi:** `POST /api/v1/applications`

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ NỘP ĐƠN ỨNG TUYỂN — Senior Fullstack Developer (RecruiTech)         [X] │
├─────────────────────────────────────────────────────────────────────────┤
│ 👤 Họ và tên:      Nguyễn Văn A                                         │
│ 📧 Email liên hệ:  nguyenvana@gmail.com                                 │
│ 📞 Số điện thoại:  0912 345 678                                         │
│                                                                         │
│ 📄 HỒ SƠ ỨNG VIÊN & KỸ NĂNG:                                            │
│ [x] Sử dụng thông tin từ Hồ sơ cá nhân:                                 │
│     Kỹ năng: React, Node.js, CouchDB, JavaScript, Docker, Tailwind      │
│     Kinh nghiệm: 4 năm • Học vấn: Đại học Bách Khoa                     │
│                                                                         │
│ 📝 THƯ GIỚI THIỆU (COVER LETTER) / GHI CHÚ CHO NHÀ TUYỂN DỤNG:           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Kính gửi nhà tuyển dụng, tôi có 4 năm kinh nghiệm phát triển full-   │ │
│ │ stack với Node.js và NoSQL database, rất mong muốn được đóng góp... │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│                                    [ Hủy bỏ ]   [ Xác nhận nộp hồ sơ ]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Nhóm Recruiter Portal (Nhà tuyển dụng)

### 4.1. Recruiter Dashboard
- **Route:** `/recruiter/dashboard`
- **API cần gọi:** `GET /api/v1/recruiter/jobs`, `GET /api/v1/recruiter/stats`

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub]   [ Tin tuyển dụng ]   Phỏng vấn   Hồ sơ công ty       [ 🏢 TechCorp HR v ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ TỔNG QUAN TUYỂN DỤNG                                        [ + Đăng tin tuyển dụng mới ]│
│                                                                                         │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│ │ Tin đang mở (OPEN│  │ Tổng hồ sơ nộp   │  │ Đang phỏng vấn   │  │ Tuyển thành công  │ │
│ │       12         │  │       145        │  │        18        │  │        6          │ │
│ └──────────────────┘  └──────────────────┘  └──────────────────┘  └───────────────────┘ │
│                                                                                         │
│ DANH SÁCH TIN TUYỂN DỤNG CỦA BẠN                                                        │
│ ┌───────────────────────────────────┬──────────────┬─────────────┬──────────┬─────────┐ │
│ │ Tiêu đề công việc                 │ Trạng thái   │ Hồ sơ nộp   │ Ngày tạo │ Thao tác│ │
│ ├───────────────────────────────────┼──────────────┼─────────────┼──────────┼─────────┤ │
│ │ Senior Fullstack Developer (NoSQL)│ [ OPEN ]     │ 24 ứng viên │ 20/10/26 │[Duyệt CV│ │
│ │ AI Data Engineer (NLP Specialist) │ [ OPEN ]     │ 18 ứng viên │ 18/10/26 │[Duyệt CV│ │
│ │ Frontend React 19 Developer       │ [ DRAFT ]    │ 0 ứng viên  │ Hôm nay  │[Sửa][Mở]│ │
│ └───────────────────────────────────┴──────────────┴─────────────┴──────────┴─────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2. Quản lý Ứng viên & Bảng xếp hạng AI (Job Applicants Page)
- **Route:** `/recruiter/jobs/:id/applicants`
- **API cần gọi:** `GET /api/v1/jobs/:id/applicants`, `GET /api/v1/resume-analysis/ranking/:jobId`
- **Chức năng:** Hiển thị danh sách hồ sơ, xếp hạng AI Match Score, bộ lọc theo Stage.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub]   < Quay lại Dashboard                                  [ 🏢 TechCorp HR v ] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ DANH SÁCH ỨNG VIÊN — Senior Fullstack Developer (24 ứng viên)                           │
│ Lọc theo Stage: [ Tất cả (24) ] [ APPLIED (8) ] [ SCREENING (6) ] [ INTERVIEWING (4) ] │
│                                                                                         │
│ [x] Sắp xếp theo: [ 🎯 AI Match Score (Cao xuống thấp) v ]                              │
│                                                                                         │
│ ┌──────┬─────────────────────┬──────────────┬───────────────┬────────────┬────────────┐ │
│ │ Hạng │ Ứng viên            │ Kinh nghiệm  │ Match Score   │ Stage      │ Hành động  │ │
│ ├──────┼─────────────────────┼──────────────┼───────────────┼────────────┼────────────┤ │
│ │  #1  │ Trần Văn Bảo        │ 4 năm exp    │ [ 92% Rất cao]│ SCREENING  │ [Chi tiết] │ │
│ │      │ React, Node, CouchDB│ ĐH Bách Khoa │ ⭐ Top Match  │            │ [Chuyển >] │ │
│ ├──────┼─────────────────────┼──────────────┼───────────────┼────────────┼────────────┤ │
│ │  #2  │ Lê Thị Hương        │ 3 năm exp    │ [ 85% Cao ]   │ INTERVIEW  │ [Chi tiết] │ │
│ │      │ React, Express, SQL │ ĐH Công Nghệ │ 4/5 Kỹ năng   │            │ [Lên lịch] │ │
│ ├──────┼─────────────────────┼──────────────┼───────────────┼────────────┼────────────┤ │
│ │  #3  │ Phạm Quang Minh     │ 1 năm exp    │ [ 58% Thấp ]  │ APPLIED    │ [Chi tiết] │ │
│ │      │ Vue.js, PHP, MySQL  │ Cao đẳng     │ Thiếu CouchDB │            │ [Từ chối]  │ │
│ └──────┴─────────────────────┴──────────────┴───────────────┴────────────┴────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3. Ngăn chi tiết phân tích hồ sơ (AI Match Score Breakdown Drawer)
- **Kích hoạt từ:** Bấm vào nút "Chi tiết" hoặc Huy hiệu điểm số tại Bảng ứng viên.
- **API gọi:** `GET /api/v1/resume-analysis/:applicationId`

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ PHÂN TÍCH ĐỘ PHÙ HỢP HỒ SƠ (AI RESUME MATCHING)                     [X] │
├─────────────────────────────────────────────────────────────────────────┤
│ Ứng viên: Trần Văn Bảo                 Vị trí: Senior Fullstack Developer│
│ Điểm tổng hợp (Overall Score):                                          │
│                                                                         │
│       ┌─────────────────────────────────────────────────────────┐       │
│       │ ████████████████████████████████████████░░░░░░░░  92%   │       │
│       └─────────────────────────────────────────────────────────┘       │
│       Đánh giá: RẤT PHÙ HỢP (Khuyến nghị chuyển vòng Phỏng vấn)         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. KỸ NĂNG BẮT BUỘC (HARD SKILLS): 90% (Trọng số 50%)                   │
│    ✓ Trùng khớp: React, Node.js, Express, CouchDB, Docker (5/5)         │
│    ✗ Kỹ năng còn thiếu: TypeScript (Job khuyến khích có)                │
│                                                                         │
│ 2. KINH NGHIỆM LÀM VIỆC: 95% (Trọng số 30%)                             │
│    - Yêu cầu: 3 năm   • Thực tế: 4 năm (Đạt tiêu chuẩn Senior)          │
│                                                                         │
│ 3. ĐỘ PHÙ HỢP CHUYÊN NGÀNH: 90% (Trọng số 20%)                          │
│    - Lĩnh vực: Web Fullstack Development & NoSQL Engineering            │
│                                                                         │
│ 4. THÔNG TIN THUẬT TOÁN (PROVENANCE):                                   │
│    Engine: recruithub-scoring-mvp-v1  • Trạng thái: COMPLETE            │
│                                                                         │
│ [ Chuyển sang INTERVIEWING ]   [ Lên lịch phỏng vấn ]   [ Đóng ngăn ]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Nhóm Admin Portal (Quản trị viên)

### 5.1. Admin Dashboard & Thống kê CouchDB
- **Route:** `/admin/dashboard`
- **API cần gọi:** `GET /api/v1/admin/couchdb-stats`
- **Chức năng:** Hiển thị số liệu trực quan 25.750 documents theo đúng 9 document types trên CouchDB.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [RecruiHub ADMIN]   [ Dashboard ]   Quản lý User   Audit Trail   Logs    [ 🛡️ Admin v ]  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ THỐNG KÊ CƠ SỞ DỮ LIỆU NOSQL (CouchDB: recruitment_db)                                  │
│ Trạng thái cụm: [ KẾT NỐI TỐT ]   •   Tổng số documents: 25.750                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ PHÂN BỔ 9 BUSINESS DOCUMENT TYPES                                                       │
│                                                                                         │
│ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐            │
│ │ Users                │  │ Candidates           │  │ Recruiters           │            │
│ │ 10.050 documents     │  │ 10.000 documents     │  │ 50 documents         │            │
│ └──────────────────────┘  └──────────────────────┘  └──────────────────────┘            │
│ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐            │
│ │ Jobs (Tin tuyển dụng)│  │ Applications         │  │ Interviews           │            │
│ │ 2.500 (200 Open/2.3kD│  │ 1.200 documents      │  │ 350 documents        │            │
│ └──────────────────────┘  └──────────────────────┘  └──────────────────────┘            │
│ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐            │
│ │ Resume Analyses      │  │ System Logs          │  │ Audit Trails         │            │
│ │ 1.200 documents      │  │ 200 documents        │  │ 200 documents        │            │
│ └──────────────────────┘  └──────────────────────┘  └──────────────────────┘            │
│                                                                                         │
│ HOẠT ĐỘNG GẦN ĐÂY TRÊN HỆ THỐNG                                                         │
│ [10:45] Recruiter 'techcorp_hr' vừa chuyển stage đơn 'app_001' sang INTERVIEWING        │
│ [10:30] Scoring Engine hoàn tất phân tích cho ứng viên 'cand_042' (Score: 92%)          │
│ [09:15] CouchDB Bulk Ingestion đã xác minh tính toàn vẹn 25.750 records [PASS]          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
