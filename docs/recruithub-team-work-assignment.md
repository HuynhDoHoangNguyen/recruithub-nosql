# RecruiHub NoSQL — Phân công công việc nhóm 3 thành viên

Tài liệu này phân chia chi tiết trách nhiệm và phạm vi công việc cho 3 thành viên thuộc **Nhóm 8** (Học phần Cơ sở dữ liệu NoSQL). Công việc được tổ chức theo mô hình **Full-stack Vertical Slice**, đảm bảo mỗi thành viên sở hữu trọn vẹn miền nghiệp vụ của mình từ cơ sở dữ liệu CouchDB, backend Express, frontend React đến kiểm thử tự động.

---

## 1. Nguyên tắc phân chia công việc (Vertical Slice)

Mỗi thành viên chịu trách nhiệm trọn vẹn các Use Case thuộc module của mình:

```text
CouchDB Document / Mango Query / View
    -> Zod Schema Contract
    -> Repository / Data Access
    -> Domain Service (Business Logic)
    -> Controller & Express Route
    -> Frontend Service (Axios Client)
    -> React Page / Component
    -> Automated Testing (Backend & Frontend)
```

### Mục tiêu phân chia:
- **Phạm vi sở hữu rõ ràng**: Mỗi người làm chủ một cụm chức năng độc lập, hạn chế tối đa việc nhiều người cùng sửa đổi chung một file.
- **Phát triển song song không nghẽn**: Khi một module phụ thuộc chưa hoàn thành (ví dụ: TV3 cần dữ liệu Application của TV2 để tính điểm), sử dụng dữ liệu 25.750 documents đã import sẵn trong CouchDB hoặc dữ liệu mock chuẩn hóa.
- **Tích hợp nhất quán qua API Contract**: Giao tiếp giữa các module thông qua hợp đồng dữ liệu REST API đã thống nhất.

### Bảng phân chia tổng thể 3 thành viên:

| Thành viên | Tên phân hệ sở hữu | Khối chức năng chính |
| :--- | :--- | :--- |
| **Thành viên 1 (TV1)** | **Identity, Candidate Profile & Public Portal** | - Authentication (JWT, Cookie, Route Guard)<br/>- Candidate Profile & Skills Inventory<br/>- Public Job Browsing, Filter & Detail<br/>- Admin Dashboard & CouchDB Statistics |
| **Thành viên 2 (TV2)** | **Recruiter Management & Application Lifecycle** | - Recruiter Job Creation & Management (`OPEN`/`DRAFT`)<br/>- Application Submission Workflow (Nộp CV)<br/>- Application Pipeline 7-Stage Tracking (`APPLIED` → `HIRED`)<br/>- Recruiter Applicants Review Board |
| **Thành viên 3 (TV3)** | **Interviews, AI Scoring & Audit Logging** | - Interview Management (Lên lịch, Đánh giá, Evidence)<br/>- Tích hợp AI Resume Scoring Engine (`recruithub-scoring-mvp-v1`)<br/>- Xếp hạng ứng viên theo Job (Deterministic Ranking)<br/>- Tra cứu System Logs & Audit Trail |

---

## 2. Các thành phần và Quy chuẩn dùng chung

Trước khi triển khai độc lập, cả 3 thành viên phải tuân thủ nghiêm ngặt các hằng số, enum và quy chuẩn response sau:

### 2.1. Danh mục Enum và Trạng thái nghiệp vụ

```text
UserRole
- CANDIDATE
- RECRUITER
- ADMIN

UserStatus
- ACTIVE
- INACTIVE
- SUSPENDED

JobStatus
- DRAFT
- OPEN
- CLOSED

ApplicationStage (7 Stages)
- APPLIED
- SCREENING
- INTERVIEWING
- OFFERED
- HIRED
- REJECTED
- WITHDRAWN

InterviewStage
- SCHEDULED
- COMPLETED
- CANCELLED

InterviewResult
- PASSED
- FAILED
- PENDING

ScoringStatus
- COMPLETE
- INCOMPLETE
```

### 2.2. Chuẩn phản hồi HTTP API (REST Response Format)
Mọi endpoint đều trả về JSON với cấu trúc chuẩn:

```json
// Thành công
{
  "success": true,
  "data": { ... },
  "message": "Thông báo thân thiện"
}

// Thất bại
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "details": [ ... ]
  },
  "message": "Mô tả chi tiết nguyên nhân lỗi"
}
```

---

## 3. Chi tiết phân công từng thành viên

### 3.1. Thành viên 1 (TV1) — Identity, Candidate Profile & Public Portal

- **Use Cases phụ trách:**
  - `UC01`: Đăng ký tài khoản (`CANDIDATE`, `RECRUITER`).
  - `UC02`: Đăng nhập / Đăng xuất, cấp phát JWT Quản lý hồ sơ cá nhân ứng viên (kỹ năng, kinh nghiệm, học vấn).
  - `UC05` & `UC06`: Xem và lọc danh sách tin tuyển dụng công khai (Lọc theo kỹ năng, địa điểm, mức lương, phân trang).
  - `UC07`: Xem chi tiết tin tuyển dụng (`/jobs/:id`).
  - `UC23` & `UC24`: Quản lý người dùng, khóa/mở khóa tài khoản (Admin).
  - `UC25`: Thống kê số lượng documents trên CouchDB qua MapReduce View (Admin).
- **Phạm vi file Backend:**
  - `backend/src/routes/auth.routes.js`, `candidate.routes.js`, `admin.routes.js`
  - `backend/src/controllers/auth.controller.js`, `candidate.controller.js`, `admin.controller.js`
  - `backend/src/services/auth.service.js`, `candidate.service.js`, `admin.service.js`
  - `backend/src/middleware/auth.middleware.js`, `role.middleware.js`
  - `backend/src/models/user.repository.js`, `candidate.repository.js`
- **Phạm vi file Frontend:**
  - `frontend/src/pages/Landing.jsx`, `Login.jsx`, `Register.jsx`, `JobsPage.jsx`, `JobDetailPage.jsx`
  - `frontend/src/pages/candidate/CandidateProfile.jsx`
  - `frontend/src/pages/admin/AdminDashboard.jsx`
  - `frontend/src/features/auth/`, `frontend/src/features/jobs/components/JobCard.jsx`, `JobFilter.jsx`
  - `frontend/src/context/AuthContext.jsx`, `frontend/src/routes/ProtectedRoute.jsx`
- **Kiểm thử tự động:**
  - Unit tests cho Auth Service (hash password, sign/verify JWT).
  - Integration tests cho route `POST /api/v1/auth/login`, `POST /api/v1/auth/register`.
  - Frontend lint & build pass.

---

### 3.2. Thành viên 2 (TV2) — Recruiter Management & Application Lifecycle

- **Use Cases phụ trách:**
  - `UC11`: Đăng tin tuyển dụng mới (`OPEN` hoặc `DRAFT`).
  - `UC12`: Cập nhật thông tin và đóng tin tuyển dụng (`CLOSED`).
  - `UC08`: Nộp hồ sơ ứng tuyển (Candidate Apply with Resume text).
  - `UC09`: Theo dõi tiến độ hồ sơ ứng tuyển qua 7 stages (`APPLIED` → `HIRED`).
  - `UC10`: Rút đơn ứng tuyển (`WITHDRAWN`).
  - `UC13`: Xem danh sách ứng viên nộp hồ sơ vào tin tuyển dụng của Recruiter.
  - `UC16`: Chuyển stage hồ sơ ứng viên (Kiểm tra điều kiện chuyển stage hợp lệ).
- **Phạm vi file Backend:**
  - `backend/src/routes/job.routes.js`, `application.routes.js`
  - `backend/src/controllers/job.controller.js`, `application.controller.js`
  - `backend/src/services/job.service.js`, `application.service.js`
  - `backend/src/models/job.repository.js`, `application.repository.js`
- **Phạm vi file Frontend:**
  - `frontend/src/pages/candidate/CandidateDashboard.jsx` (My Applications Tracker)
  - `frontend/src/pages/recruiter/RecruiterDashboard.jsx`
  - `frontend/src/pages/recruiter/PostJobPage.jsx`
  - `frontend/src/pages/recruiter/JobApplicantsPage.jsx`
  - `frontend/src/features/applications/components/ApplyModal.jsx`, `ApplicationTimeline.jsx`
- **Kiểm thử tự động:**
  - Unit tests cho quy tắc nộp đơn: không cho nộp trùng nếu đơn cũ chưa closed.
  - Unit tests cho quy tắc 7 stages: không cho chuyển từ `APPLIED` thẳng sang `HIRED`.
  - Integration tests cho route `POST /api/v1/applications`, `PATCH /api/v1/applications/:id/stage`.

---

### 3.3. Thành viên 3 (TV3) — Interviews, AI Scoring & Audit Logging

- **Use Cases phụ trách:**
  - `UC17` & `UC18`: Lên lịch phỏng vấn, ghi nhận kết quả và bằng chứng phỏng vấn (Evidence).
  - `UC14`: Hiển thị điểm số phù hợp (AI Match Score Badge) và ngăn phân tích chi tiết (Breakdown Drawer).
  - `UC15`: Bảng xếp hạng ứng viên xác định theo Job (Deterministic AI Ranking).
  - `UC19` - `UC22`: Tích hợp Scoring Engine (`recruithub-scoring-mvp-v1`) để tính điểm động khi ứng viên nộp hoặc khi Recruiter yêu cầu.
  - `UC26`: Tra cứu System Logs và Audit Trail dành cho Admin.
- **Phạm vi file Backend:**
  - `backend/src/routes/interview.routes.js`, `scoring.routes.js`, `log.routes.js`
  - `backend/src/controllers/interview.controller.js`, `scoring.controller.js`, `log.controller.js`
  - `backend/src/services/interview.service.js`, `scoring/resume-scoring.service.js`, `log.service.js`
  - `backend/src/models/interview.repository.js`, `resume_analysis.repository.js`, `log.repository.js`
- **Phạm vi file Frontend:**
  - `frontend/src/features/scoring/components/MatchScoreBadge.jsx`, `ScoreBreakdownDrawer.jsx`, `RankingTable.jsx`
  - `frontend/src/features/interviews/components/InterviewScheduleModal.jsx`, `InterviewFeedbackModal.jsx`
  - `frontend/src/features/admin/components/SystemLogViewer.jsx`, `AuditTrailViewer.jsx`
- **Kiểm thử tự động:**
  - Đảm bảo duy trì 246 tests hiện có (Scoring, Fingerprint, Freshness, Ranking).
  - Integration tests cho route `GET /api/v1/resume-analysis/ranking/:jobId`, `POST /api/v1/interviews`.
  - Frontend lint & build pass.

---

## 4. Kế hoạch nhánh Git và Quy tắc phát triển an toàn

### 4.1. Cấu trúc nhánh Git
- `main`: Nhánh ổn định cao nhất, chỉ chứa code đã qua kiểm thử và được cả nhóm nghiệm thu.
- `develop`: Nhánh tích hợp chính.
- Các nhánh tính năng theo thành viên:
  - `feature/tv1-auth-profile`
  - `feature/tv2-job-application`
  - `feature/tv3-interview-scoring`

### 4.2. Quy tắc phòng chống xung đột mã nguồn
1. **Không sửa chéo module**: TV1 không can thiệp vào `job.service.js` của TV2; TV2 không can thiệp vào thuật toán chấm điểm của TV3.
2. **Khai thác dữ liệu CouchDB có sẵn**: Dự án đã có sẵn 25.750 documents thật trong `recruitment_db`. Các thành viên có thể truy vấn trực tiếp dữ liệu này để test tính năng mà không cần đợi người khác tạo API.
3. **Mocking chuẩn hóa**: Khi cần gọi API của bạn chưa hoàn thiện, tạo dữ liệu mock trong thư mục `frontend/src/mocks/` có interface tương đồng với schema thật.
4. **Không tự ý commit/push**: Luôn chạy kiểm thử trước khi yêu cầu tạo Pull Request.

---

## 5. Tiêu chuẩn nghiệm thu từng Lát cắt (Sprint Acceptance Criteria)

Mỗi lát cắt chức năng hoàn thành khi thỏa mãn:

1. **Backend Functional**: Endpoint hoạt động chính xác với mã trạng thái HTTP chuẩn (`200`, `201`, `400`, `401`, `403`, `404`, `409`).
2. **Database Consistent**: Dữ liệu lưu vào CouchDB đúng schema, không tạo rác dữ liệu, bảo toàn `doc_type`.
3. **Frontend Accessible**: Màn hình hiển thị đẹp mắt theo chuẩn Tailwind của template tham khảo, không lỗi console, xử lý đủ 4 trạng thái (Loading, Empty, Error, Success).
4. **Automated Verification**:
   ```bash
   # Kiểm tra toàn bộ tests backend
   cd backend
   npm test

   # Kiểm tra cú pháp và build frontend
   cd frontend
   npm run lint
   npm run build
   ```
