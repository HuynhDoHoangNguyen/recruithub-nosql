# RecruiHub NoSQL

> Tinh chỉnh UI: [nền navy có chiều sâu, đồng bộ bảy trang và hồ sơ ứng viên, ảnh trước/sau và kiểm thử](docs/surface-polish-verification/README.md).

> Sửa sau merge dev: [giữ giao diện mới, sửa import/state/filter và nối lại CV/nộp lại hồ sơ](docs/reports/TV2/dev-merge-repair-2026-10-25.md).

> Tổng hợp TV2: [report hiện trạng, đối chiếu 7 use case, việc còn phụ thuộc và nội dung commit](docs/reports/TV2/TV2-review-and-commit-summary-2026-10-25.md).

> Hồ sơ và trang chủ: [ràng buộc Candidate/Recruiter, kiểm tra số điện thoại và thiết kế banner/việc làm tiêu biểu](docs/reports/TV2/profile-validation-home-handoff-2026-10-25.md).

> Cập nhật CV, hồ sơ và phân trang: [sửa upload PDF, xem CV trên trình duyệt, hồ sơ 5 mục và Dashboard 5 tin/trang](docs/reports/TV2/cv-profile-pagination-handoff-2026-10-25.md).

> Tải file từ máy: [CV dưới 5 MB, logo công ty, ảnh Candidate và kiểm chứng tải xuống theo quyền](docs/reports/TV2/file-upload-handoff-2026-10-25.md).

> Cập nhật form đăng tin và hồ sơ doanh nghiệp: [cấp bậc, loại hợp đồng, lương, logo, xóa tin và trang hồ sơ riêng](docs/reports/TV2/recruiter-ui-enhancements-2026-10-25.md).

> Bàn giao mới nhất: [RecruiHub — bộ lọc, Job Details, nộp lại, mở lại tin và kiểm chứng thật](docs/reports/TV2/recruihub-catalog-lifecycle-handoff-2026-10-25.md). Xem tài liệu để lấy tài khoản, ảnh và kết quả kiểm thử hiện tại.

> Đã có [tài khoản Candidate local và luồng Apply thật](docs/reports/TV2/local-candidate-testing.md). Tin Recruiter local đã được nối vào danh sách/chi tiết công khai để nộp CV; tin lịch sử có nhãn tham khảo. Candidate → nộp CV → Dashboard → Recruiter đọc CV đã được kiểm chứng với Identity/CouchDB thật.

> Đã chuẩn bị [tài khoản Recruiter local để test đăng tuyển](docs/reports/TV2/local-recruiter-testing.md). Đăng nhập thật và luồng tạo nháp → sửa → đăng OPEN → đăng nhập lại đọc tin đã PASS trên database test riêng. Mật khẩu nằm trong `.env` được Git ignore; các ghi nhận chưa cấu hình Auth ở báo cáo cũ là lịch sử.

> Đã sửa Public Jobs sau merge: [nguyên nhân, bản sửa và dữ liệu live](docs/reports/TV2/public-jobs-after-merge-fix.md). GET public đọc lại recruitment_db, trả đủ 200 OPEN; không cần import. Auth và thao tác private vẫn dùng cấu hình riêng. Các ghi nhận Jobs 503 bên dưới là lịch sử trước bản sửa này.

> Sau merge dev 25/10/2026: [báo cáo giữ UI hiện tại, tích hợp Auth/Public Search và trạng thái kiểm thử](docs/reports/TV2/merge-dev-review-2026-10-25.md). HEAD `875986a`; runtime hiện cần cấu hình `AUTH_COUCHDB_DATABASE` riêng theo guard mới của dev. Các kết quả Jobs live trong báo cáo trước thuộc bản trước merge.

> Bàn giao TV2 mới nhất 25/10/2026: [đúng phiên bản JobPortal IT, menu/UC, dữ liệu live và kết quả test](docs/reports/TV2/recruitment-it-template-handoff.md). Frontend 28/28 PASS; full backend 266/288 PASS, 22 lỗi dataset/ETL. Private chưa nghiệm thu với Identity thật. Các số liệu test khác bên dưới là thông tin lịch sử.

## 1. Giới thiệu tổng quan

- **Tên đề tài:** Xây dựng hệ thống quản lý tuyển dụng và phân tích hồ sơ ứng viên sử dụng cơ sở dữ liệu NoSQL (Recruitment Management & Candidate Resume Analysis System).
- **Nhóm thực hiện:** Nhóm 8 — 3 sinh viên.
- **Học phần:** Cơ sở dữ liệu NoSQL (Học kỳ 1, 2026–2027).
- **Mô hình kiến trúc:** Client–Server tách biệt (React SPA + Express REST API + Apache CouchDB NoSQL).

**RecruiHub NoSQL** là hệ thống quản lý quy trình tuyển dụng (Applicant Tracking System - ATS) tích hợp bộ tính toán điểm số phù hợp hồ sơ ứng viên (Resume–Job Match Scoring Engine). Hệ thống giải quyết bài toán lưu trữ tài liệu phi cấu trúc, lịch sử ứng tuyển đa dạng và phỏng vấn nhiều vòng dựa trên nền tảng **Apache CouchDB**.

---

## 2. Công nghệ sử dụng

| Tầng / Thành phần | Công nghệ | Chi tiết |
| :--- | :--- | :--- |
| **Database** | Apache CouchDB 3.5.2 | Database `recruitment_db`, JSON Documents, Mango Query, MapReduce Views |
| **Backend** | Node.js (v20+), Express.js 5 | Layered Architecture (Route → Middleware → Controller → Service → Repository → CouchDB Client) |
| **Database Driver** | Native HTTP Client / Nano | Hỗ trợ retry cấp số nhân, tự động phân batch 500 documents, xử lý HTTP 409 conflict |
| **Validation & Schema** | Zod 3.24 | Schema contract kiểm soát chặt chẽ 9 business document types |
| **Scoring Engine** | Pure JavaScript | Thuật toán `recruithub-scoring-mvp-v1`: Skill Matching, Experience Scoring, Domain Weights |
| **Frontend** | React 19, Vite 8 | Feature-Based Architecture, React Router DOM v7, Axios Client |
| **Styling & UI** | Tailwind CSS, Lucide Icons | Kế thừa giao diện từ template `Job-Application-Portal-Frontend` |
| **Notifications** | React Toastify | Thông báo tương tác thời gian thực |
| **Testing** | Node.js Test Runner / Jest / Supertest | 246 unit và integration tests PASS |

---

## 3. Kiến trúc dữ liệu NoSQL (9 Business Document Types)

Database `recruitment_db` lưu trữ trọn vẹn **25.750 documents** thuộc 9 loại tài liệu nghiệp vụ, không sử dụng foreign key vật lý mà liên kết qua trường định danh `doc_type` và reference IDs:

1. `user`: 10.050 tài khoản người dùng (`ADMIN`, `RECRUITER`, `CANDIDATE`).
2. `candidate`: 10.000 hồ sơ ứng viên chi tiết (kỹ năng, kinh nghiệm, học vấn, resume text).
3. `recruiter`: 50 thông tin nhà tuyển dụng và công ty.
4. `job`: 2.500 tin tuyển dụng (200 `OPEN`, 2.300 `DRAFT`).
5. `application`: 1.200 hồ sơ ứng tuyển trải dài trên 7 stages nghiệp vụ.
6. `interview`: 350 biên bản phỏng vấn với bằng chứng đánh giá (Evidence).
7. `resume_analysis`: 1.200 kết quả phân tích mức độ phù hợp kèm AI Match Score và xếp hạng.
8. `system_log`: 200 nhật ký hệ thống ghi nhận hoạt động.
9. `audit_trail`: 200 bản ghi vết kiểm toán nghiệp vụ an toàn.

---

## 4. Ba nhóm người dùng & Luồng nghiệp vụ cốt lõi

### 4.1. Candidate (Ứng viên)
- Đăng ký, đăng nhập và quản lý hồ sơ cá nhân (kỹ năng, kinh nghiệm, học vấn).
- Tìm kiếm việc làm, lọc tin tuyển dụng theo kỹ năng, địa điểm, mức lương.
- Xem chi tiết tin tuyển dụng và nộp đơn ứng tuyển (`APPLIED`).
- Theo dõi tiến độ hồ sơ xuyên suốt 7 trạng thái: `APPLIED` → `SCREENING` → `INTERVIEWING` → `OFFERED` → `HIRED` (hoặc `REJECTED`, `WITHDRAWN`).
- Rút hồ sơ ứng tuyển khi cần thiết theo đúng Business Rules.

### 4.2. Recruiter (Nhà tuyển dụng)
- Đăng tin tuyển dụng mới, quản lý trạng thái tin tuyển dụng (`DRAFT`, `OPEN`, `CLOSED`).
- Xem danh sách ứng viên nộp hồ sơ theo từng vị trí tuyển dụng.
- **AI Resume Match Score**: Xem điểm số phù hợp tổng hợp (Overall Score từ 0 đến 100) kèm phân tích chi tiết:
  - *Hard Skills Match*: Kỹ năng bắt buộc và kỹ năng bổ sung.
  - *Experience Alignment*: Số năm kinh nghiệm so với yêu cầu vị trí.
  - *Domain Relevance*: Độ tương đồng chuyên ngành.
- Xếp hạng tự động ứng viên (Deterministic Ranking) theo thứ tự ưu tiên điểm số.
- Chuyển trạng thái ứng viên qua các vòng và lên lịch phỏng vấn (`SCHEDULED` → `COMPLETED` → `CANCELLED`).
- Ghi nhận đánh giá, điểm số và kết quả phỏng vấn (`PASSED` / `FAILED`).

### 4.3. Admin (Quản trị viên)
- Quản trị toàn bộ người dùng và phân quyền tài khoản (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- Giám sát tình trạng hệ thống, vết kiểm toán (`audit_trail`) và nhật ký vận hành (`system_log`).
- Xem thống kê trực quan số lượng documents theo từng loại trên CouchDB.

---

## 5. Cấu trúc thư mục Monorepo

```text
recruithub-nosql/
├── .env.example                       # Mẫu cấu hình biến môi trường
├── docker-compose.yml                 # Khởi chạy Apache CouchDB 3.5.2
├── AGENTS.md                          # Master Prompt & Operating Contract cho AI Coding Agent
├── ARCHITECTURE.md                    # Tài liệu kiến trúc kỹ thuật hệ thống toàn diện
├── README.md                          # Tài liệu tổng quan dự án (file này)
├── backend/                           # Ứng dụng Express REST API
│   ├── src/
│   │   ├── config/                    # Cấu hình CouchDB, port, JWT secrets
│   │   ├── controllers/               # Điều phối HTTP request / response
│   │   ├── middleware/                # Auth, Role Guard, Zod Request Validation
│   │   ├── models/                    # Data Access / CouchDB Nano Client
│   │   ├── routes/                    # Khai báo Express REST API routes
│   │   ├── schemas/                   # Zod schemas cho 9 document types
│   │   ├── services/                  # Business Logic & Pure Scoring Engine
│   │   └── utils/                     # Formatters, loggers, normalizers
│   ├── tests/                         # 246 unit & integration tests
│   └── package.json                   # Backend dependencies & npm scripts
├── frontend/                          # Ứng dụng Single Page Application React 19 + Vite
│   ├── src/
│   │   ├── api/                       # Axios client tập trung kết nối backend
│   │   ├── components/                # UI components dùng chung (Navbar, Modal, Badge...)
│   │   ├── context/                   # AuthContext, ToastContext
│   │   ├── features/                  # Modules phân theo nghiệp vụ (Jobs, Applications, ...)
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── mocks/                     # Dữ liệu mock phục vụ kiểm thử UI độc lập
│   │   ├── pages/                     # Các trang theo role (Landing, JobSeeker, Recruiter, Admin)
│   │   └── routes/                    # React Router guards & routing
│   └── package.json                   # Frontend dependencies
├── scripts/
│   └── database/
│       ├── couchdb-client.js          # Native HTTP CouchDB bulk client
│       ├── import-couchdb.js          # Script import 25.750 documents
│       └── verify-couchdb.js          # Script xác minh tính toàn vẹn database
├── docs/                              # Tài liệu kỹ thuật dự án
│   ├── COUCHDB_IMPORT_GUIDE.md        # Hướng dẫn chi tiết import CouchDB cho thành viên mới
│   ├── ai-frontend-development-guide.md # Hướng dẫn AI phát triển Frontend
│   ├── recruithub-usecase-system.md   # Đặc tả hệ thống Use Cases (UC01-UC30)
│   ├── recruithub-screen-mockups.md   # Wireframe & Mockup giao diện các màn hình
│   ├── recruithub-team-work-assignment.md # Phân công công việc nhóm 3 thành viên
│   ├── data-schema-contract.md        # Hợp đồng cấu trúc 9 loại tài liệu NoSQL
│   ├── recruitment-business-rules.md  # Quy tắc nghiệp vụ tuyển dụng
│   ├── resume-scoring-design.md       # Thiết kế thuật toán chấm điểm ứng viên
│   ├── Job-Application-Portal-Frontend/ # Template giao diện tham khảo
│   └── markdown/                      # Thư mục chứa các tài liệu mẫu tham khảo gốc
└── data/                              # Dữ liệu nguồn và snapshot data
    └── processed/                     # Bộ dữ liệu 9 JSONL files đã chuẩn hóa
```

---

## 6. Hướng dẫn cài đặt & Khởi chạy nhanh

### 6.1. Yêu cầu môi trường
- Hệ điều hành: Windows, macOS hoặc Linux.
- Docker Desktop (đang chạy).
- Node.js: phiên bản v20 trở lên.
- Git.

### 6.2. Bước 1: Khởi động CouchDB bằng Docker
```bash
docker compose up -d
```
Kiểm tra CouchDB sẵn sàng tại: [http://127.0.0.1:5984](http://127.0.0.1:5984) (hoặc giao diện Fauxton: [http://127.0.0.1:5984/_utils/](http://127.0.0.1:5984/_utils/)).

### 6.3. Bước 2: Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc dự án (tham khảo `.env.example`):
```ini
COUCHDB_URL=http://127.0.0.1:5984
COUCHDB_DATABASE=recruitment_db
COUCHDB_USER=admin
COUCHDB_PASSWORD=REPLACE_WITH_LONG_RANDOM_PASSWORD
PORT=5000
NODE_ENV=development
```

### 6.4. Bước 3: Import dữ liệu NoSQL vào CouchDB
Dự án đã chuẩn bị sẵn bộ script import tự động xử lý 25.750 documents:
```bash
# Cài đặt dependencies backend (nếu chưa có)
cd backend
npm install

# Thực hiện import 25.750 documents
npm run db:import

# Kiểm tra tính toàn vẹn sau import
npm run db:verify
```
> Chi tiết hướng dẫn dành cho thành viên nhóm mới clone repo xem tại: [docs/COUCHDB_IMPORT_GUIDE.md](file:///docs/COUCHDB_IMPORT_GUIDE.md).

### 6.5. Bước 4: Chạy kiểm thử Backend
```bash
npm test
```
Kết quả phụ thuộc dữ liệu release và môi trường. Xem [bàn giao hiện tại](docs/reports/TV2/frontend-template-restoration.md) để biết các checks đã chạy và lỗi còn tồn tại; không dùng số test lịch sử làm kết quả hiện tại.

### 6.6. Bước 5: Khởi chạy Backend và Frontend
```bash
# Terminal 1: Chạy Backend REST API
cd backend
npm run dev

# Terminal 2: Chạy Frontend React SPA
cd ../frontend
npm install
npm run dev
```
Giao diện ứng dụng sẽ hoạt động tại: [http://127.0.0.1:5177](http://127.0.0.1:5177).

Frontend dùng proxy `/api` tới Backend trong development. Hướng dẫn cấu hình và menu nằm ở [frontend/README.md](frontend/README.md). Việc import dữ liệu là bước chuẩn bị riêng, không chạy lại mỗi lần khởi động. Luồng đăng nhập cần API Identity, hiện chưa được tích hợp trên nhánh này.

---

## 7. Phân chia công việc nhóm 3 thành viên

Dự án áp dụng mô hình **Full-stack Vertical Slice**, mỗi thành viên phụ trách trọn vẹn từ CouchDB Document, API Controller/Service đến React UI Component:

- **Thành viên 1 (TV1)**: Phụ trách Module Authentication, User Management, Candidate Profile, Public Job Browsing & Search, Admin Portal.
- **Thành viên 2 (TV2)**: Phụ trách Module Recruiter Job Management (Post, Edit, Close), Candidate Application Submission, 7-Stage Application Lifecycle Tracking.
- **Thành viên 3 (TV3)**: Phụ trách Module Interview Management & Evidence, AI Resume Matching Engine Integration & Candidate Ranking View, System Audit & Logs.

Chi tiết phân công nhiệm vụ và kế hoạch sprint: xem tại [docs/recruithub-team-work-assignment.md](file:///docs/recruithub-team-work-assignment.md).

---

## 8. Hướng dẫn làm việc với AI Coding Agent

Khi cộng tác với AI Agent (Antigravity, Cursor, Claude...), bắt buộc tuân thủ:
1. Đọc kỹ [AGENTS.md](file:///AGENTS.md) trước mọi phiên làm việc.
2. Tuân thủ thứ tự ưu tiên Nguồn sự thật (Source of Truth).
3. Triển khai theo vòng lặp chuẩn: **Kiểm tra mã nguồn → Đề xuất Mini Plan → Chờ duyệt → Viết code → Chạy kiểm thử tự động → Báo cáo nghiệm thu**.
4. Không tự ý chỉnh sửa module ngoài phạm vi được giao.
