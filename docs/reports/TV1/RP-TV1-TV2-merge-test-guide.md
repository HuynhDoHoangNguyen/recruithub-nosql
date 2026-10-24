# RecruiHub NoSQL — Hướng dẫn tài khoản, kiểm thử chức năng và báo cáo tích hợp TV1 + TV2

## 1. Mục đích và trạng thái

Tài liệu này hướng dẫn thành viên cài cấu hình local, tạo tài khoản Candidate, đăng nhập và kiểm thử các luồng TV1 + TV2. Phần cuối ghi nhận công việc tích hợp Backend, Frontend và kiểm thử.

- **Ngày ghi nhận:** 2026-10-24 (Asia/Saigon)
- **Branch:** `feature/identity-candidate-portal`
- **Phạm vi:** TV1 Identity/Profile/Admin và TV2 Job/Application.
- **Trạng thái Git tại lúc lập hướng dẫn:** merge PR #2 vẫn đang chờ kết thúc; 65 file đã stage, chưa có merge commit. Không có thao tác commit/push/merge trong lượt lập tài liệu.
- **Cơ sở dữ liệu:** API Auth, Job, Application chỉ dùng `AUTH_COUCHDB_DATABASE` được cấu hình tường minh. Không dùng `recruitment_db` cho luồng ghi.
- **UI E2E:** các bước dưới đây là checklist để thành viên tự kiểm thử bằng browser; không ghi nhận là browser E2E đã chạy thành công.

## 2. Chuẩn bị môi trường local

### 2.1. Điều kiện

- Node.js phiên bản 20 trở lên và npm.
- CouchDB đang chạy, có thể truy cập bằng `COUCHDB_URL`.
- Một database riêng đã được tạo trước trong CouchDB cho tích hợp local. Database phải khác `recruitment_db`; ứng dụng không tự tạo database.
- Tài khoản CouchDB có quyền cần thiết trên database tích hợp.

Mỗi thành viên dùng CouchDB/database của môi trường mình. Database `recruithub_auth_demo` trong máy phát triển trước đây là database local, không tự có khi clone project. Có thể đặt tên khác, miễn database đã tồn tại và cấu hình Auth/Job/Application cùng trỏ vào nó.

### 2.2. Cấu hình backend

Tạo file `.env` ở thư mục gốc từ `.env.example`, sau đó điền giá trị riêng của môi trường. Không commit `.env`, không gửi mật khẩu/JWT secret qua chat hoặc đưa chúng vào report.

Các khóa liên quan:

| Khóa | Giá trị cần đặt |
|---|---|
| `COUCHDB_URL` | URL CouchDB, ví dụ local `http://127.0.0.1:5984` |
| `COUCHDB_USER`, `COUCHDB_PASSWORD` | Cặp tài khoản CouchDB của môi trường; để trống chỉ khi CouchDB không yêu cầu xác thực |
| `COUCHDB_DATABASE` | Dùng cho tiện ích/diagnostic chung; không quyết định DB ghi của Auth/Job/Application |
| `AUTH_COUCHDB_DATABASE` | Tên database tích hợp đã tồn tại; không được đặt là `recruitment_db` |
| `JWT_ACCESS_SECRET` | Chuỗi ngẫu nhiên riêng, tối thiểu 32 bytes; không dùng giá trị mẫu |
| `FRONTEND_URL` | Origin chính xác của Vite, mặc định `http://localhost:5173` |
| `PORT` | Tùy chọn; dùng cổng chưa bị chương trình khác chiếm, không dừng tiến trình lạ để lấy cổng |

Backend đọc `backend/.env` trước rồi mới đến `.env` ở root; biến đã có trong process được giữ nguyên. Tránh đặt cùng một khóa ở nhiều nơi nếu chưa xác định rõ giá trị nào sẽ có hiệu lực.

### 2.3. Cài dependencies và khởi chạy

Từ thư mục gốc PowerShell:

```powershell
npm.cmd --prefix backend install
npm.cmd --prefix frontend install

$env:PORT = '5002'
npm.cmd --prefix backend run dev
```

Mở terminal PowerShell thứ hai:

```powershell
npm.cmd --prefix frontend run dev -- --host 127.0.0.1
```

Mở URL Vite mà terminal hiển thị, thường là `http://localhost:5173`. Nếu dùng origin/cổng khác, thêm đúng origin đó vào `FRONTEND_URL` rồi khởi động lại Backend. Frontend lấy API base URL mặc định từ `frontend/.env.example` (`http://127.0.0.1:5002/api`).

Kiểm tra Backend:

```powershell
Invoke-RestMethod http://127.0.0.1:5002/api/health
```

`/api/health` chỉ xác nhận Express đang chạy, không chứng minh CouchDB/database đã sẵn sàng. Không gửi toàn bộ nội dung `.env` vào terminal/log để kiểm tra.

### 2.4. Index cho Job/Application

Nếu database tích hợp chưa có index/design document cần thiết, script dưới đây có thể tạo/cập nhật chúng **trên database do `AUTH_COUCHDB_DATABASE` cấu hình**:

```powershell
npm.cmd --prefix backend run db:job-application
```

Chỉ chạy sau khi xác minh biến hiệu lực trỏ đúng database tích hợp riêng và đã được phép ghi index ở môi trường đó. Script không phải lệnh tạo database. Không chạy script này khi cấu hình đang trỏ `recruitment_db`.

## 3. Tạo tài khoản và đăng nhập

### 3.1. Candidate — tự đăng ký trên giao diện

1. Mở `/register` trên frontend.
2. Điền **Full Name**, **Email**, **Password**, **Desired role**, **Industry**, **Seniority** và **Years experience**.
3. Dùng email mới trong database tích hợp. Mật khẩu phải có ít nhất 6 ký tự, một chữ hoa và một chữ số.
4. Nhấn đăng ký. Đăng ký thành công tạo tài khoản `CANDIDATE`; đăng ký trùng email trả lỗi xung đột.
5. Vào `/login`, dùng đúng email/mật khẩu vừa đăng ký.
6. Xác nhận chuyển tới khu vực đã đăng nhập; có thể kiểm tra phiên qua `GET /api/v1/auth/me`.

Trường **Desired role** là nghề/chức danh mong muốn của Candidate, không phải quyền tài khoản. Public registration chỉ tạo Candidate; không thể chọn `ADMIN` hay `RECRUITER` bằng form/API.

### 3.2. Recruiter và Admin

Recruiter và Admin không có public registration. Dùng tài khoản synthetic đã được người quản lý môi trường cấp và provision sẵn trong database tích hợp. Không tự nâng role cho Candidate bằng UI, request hoặc sửa document trực tiếp. Nếu môi trường mới chưa có hai loại tài khoản này, cần người quản lý cấp/provision theo schema và quy trình dự án trước khi kiểm thử các màn hình tương ứng.

Thông tin đăng nhập chỉ chia sẻ trực tiếp với người được phép, không ghi vào tài liệu này. Status `RESET_REQUIRED` không đăng nhập được cho tới khi được xử lý theo quy trình operator.

### 3.3. Đăng xuất

Nút đăng xuất xóa token khỏi bộ nhớ frontend. JWT không bị thu hồi phía server; session kết thúc trên UI nhưng token đã sao chép vẫn có thể còn hiệu lực tới khi hết hạn. Token không được lưu trong `localStorage` hoặc `sessionStorage`.

## 4. Checklist kiểm thử nghiệp vụ

Thực hiện trên database tích hợp riêng và dùng dữ liệu synthetic. Ghi lại thời điểm, vai trò đang đăng nhập, kết quả mong đợi/thực tế; không ghi password hoặc JWT vào bằng chứng.

### 4.1. Candidate và Public Jobs

1. Mở Landing, đi tới Register/Login và Public Jobs.
2. Thử đăng ký thiếu trường, mật khẩu thiếu chữ hoa/chữ số, rồi đăng ký Candidate hợp lệ.
3. Đăng ký lại cùng email; xác nhận API báo duplicate và không tạo tài khoản thứ hai.
4. Đăng nhập sai mật khẩu rồi đúng mật khẩu; xác nhận `/api/v1/auth/me` trả principal Candidate.
5. Mở `/profile`; tải profile, chỉnh sửa trường được phép và lưu. Kiểm tra response có `ETag`. Dùng tab cũ/stale revision nếu có thể để xác nhận conflict được báo.
6. Mở `/jobs`; lọc/tìm kiếm và đổi trang. Job public chỉ hiển thị tin `OPEN`; mở chi tiết một Job.
7. Đăng xuất, thử vào lại route được bảo vệ; xác nhận bị yêu cầu đăng nhập. Kiểm tra token không nằm trong Web Storage.

### 4.2. Candidate Apply

1. Đăng nhập Candidate và mở chi tiết một Job `OPEN` chưa hết hạn.
2. Nộp CV text thực tế của tài khoản synthetic; không nhập dữ liệu cá nhân thật khi không cần thiết.
3. Kiểm tra Application xuất hiện trong “Đơn ứng tuyển của tôi”, stage ban đầu là `APPLIED`.
4. Thử Apply lại cùng Candidate–Job; xác nhận bị từ chối như duplicate.
5. Rút đơn khi stage cho phép; xác nhận lịch sử stage được giữ và không thể nộp lại cùng cặp Candidate–Job.
6. Job `DRAFT`, `CLOSED` hoặc hết hạn không nhận Apply.

### 4.3. Recruiter — Job và Application lifecycle

1. Đăng nhập bằng Recruiter synthetic được cấp; mở dashboard.
2. Tạo Job `DRAFT`, kiểm tra danh sách Job của Recruiter.
3. Publish Job hợp lệ sang `OPEN` với deadline tương lai; xác nhận xuất hiện trong Public Jobs.
4. Sửa Job bằng revision mới; thử revision cũ để xác nhận conflict. Chỉ chủ sở hữu được sửa, publish hoặc close Job.
5. Mở applicants của Job do Recruiter sở hữu; xem danh sách/chi tiết Applicant trong scope.
6. Chuyển stage theo `allowed_transitions` do API trả về; thử stale revision và transition bị cấm.
7. Đóng Job; xác nhận Apply mới bị chặn nhưng Application đã có vẫn còn xem/quản lý theo policy.
8. Nếu có Recruiter thứ hai được cấp, thử mở/sửa Job/Application thuộc Recruiter đầu; yêu cầu bị từ chối và dữ liệu không đổi.

### 4.4. Admin và phân quyền

1. Đăng nhập bằng Admin synthetic đã được cấp; kiểm tra dashboard, thống kê, User list và User detail.
2. Xác nhận thao tác khóa/mở khóa không khả dụng với target có role ADMIN; Admin recovery thuộc quy trình operator ngoài MVP.
3. Đăng nhập Candidate rồi mở route Admin/Recruiter; xác nhận bị chặn.
4. Đăng nhập Recruiter rồi mở route Admin; xác nhận bị chặn.
5. Không thử cập nhật trạng thái hoặc sửa User bằng công cụ trực tiếp trên production/shared DB.

### 4.5. ETag, lỗi và CORS

- Kiểm tra request trình duyệt gọi đúng `VITE_API_BASE_URL`.
- Với profile/job/application mutation, xác nhận `If-Match`/`expected_rev` theo endpoint và response ETag đúng contract.
- Kiểm tra preflight từ đúng origin cho `Authorization`, `Content-Type`, `If-Match`; không dùng wildcard origin.
- Với các request không có quyền, kiểm tra status/error envelope; xác nhận revision/content của tài liệu không đổi.
- Thử viewport mobile khoảng 360 px, tablet và desktop; ghi lỗi UI cụ thể nếu có.

## 5. API tham khảo

Tất cả endpoint dưới đây có prefix `/api/v1`:

| Nghiệp vụ | Method/path | Quyền |
|---|---|---|
| Đăng ký Candidate | `POST /auth/register` | Công khai, chỉ tạo Candidate |
| Đăng nhập / tài khoản hiện tại | `POST /auth/login`, `GET /auth/me` | Login công khai; `/me` cần Bearer token |
| Candidate Profile | `GET /candidate/profile/me`, `PATCH /candidate/profile/me` | Candidate; PATCH cần revision hiện hành |
| Public Job | `GET /jobs`, `GET /jobs/:id` | Công khai; listing chỉ `OPEN` |
| Recruiter Jobs | `GET /recruiter/jobs`, `POST /jobs`, `PATCH /jobs/:id`, `PATCH /jobs/:id/status` | Recruiter; mutation theo owner và revision |
| Applicants theo Job | `GET /jobs/:id/applicants` | Recruiter sở hữu Job |
| Candidate Applications | `POST /applications`, `GET /applications/context`, `GET /applications/my-applications` | Candidate |
| Application detail/withdraw | `GET /applications/:id`, `PATCH /applications/:id/withdraw` | Candidate sở hữu hoặc Recruiter trong scope; withdraw là Candidate owner |
| Chuyển application stage | `PATCH /applications/:id/stage` | Recruiter sở hữu Job |
| Admin Users/statistics | `GET /admin/users`, `GET /admin/users/:id`, `GET /admin/stats` | Admin |

## 6. Báo cáo công việc tích hợp TV1 + TV2

### TV1 — Identity, Profile và Admin

- Candidate registration/login, Argon2id password hash, JWT ngắn hạn và `/auth/me`.
- Candidate Profile đọc/cập nhật theo ownership, allowlist và ETag/revision.
- Admin User list/detail/statistics và server-side authorization.
- Không cho phép public Admin/Recruiter registration; không cho đổi status nhắm tới ADMIN qua API.

### TV2 — Recruiter Job và Candidate Application

- Recruiter tạo/sửa Job, quản lý trạng thái `DRAFT`/`OPEN`/`CLOSED` và xem applicants.
- Public Job listing/detail chỉ hiển thị tin phù hợp trạng thái public.
- Candidate Apply/duplicate protection/withdraw và Recruiter stage transition với lịch sử, revision và quyền ownership.
- Frontend được ghép qua API service/Axios hiện có; không dùng fixture để Apply.

### Điểm tích hợp chung

- Auth, Candidate, Job và Application dùng cùng `AUTH_COUCHDB_DATABASE` tường minh.
- Job/Application xác minh JWT theo contract TV1, sau đó nạp User canonical và kiểm tra role/status hiện hành.
- API dùng prefix `/api/v1`, response envelope chung và error handler; CORS allowlist origin chính xác và expose `ETag`.
- Application ID xác định từ cặp Candidate–Job để ngăn tạo nhiều Application cho cùng cặp.
- Pagination dùng CouchDB bookmark; `has_more` được xác định bằng lookahead khi trang chính đầy.
- TV3 Interview/Scoring/Audit không nằm trong phạm vi merge TV1 + TV2 này.

### Verification ghi nhận

| Kiểm tra | Kết quả |
|---|---:|
| Backend Auth/Foundation | 54/54 PASS |
| Backend Recruitment | 41/41 PASS |
| Frontend Node tests | 4/4 PASS |
| Frontend production build | PASS |
| Frontend lint | 0 lỗi, 2 cảnh báo |
| Full backend `npm test` | Chưa PASS; không được tuyên bố full-suite đạt |
| Browser UI E2E | Chưa được xác nhận trong báo cáo này; chạy manual checklist ở trên |

Full backend suite còn vướng thiếu release fixtures `DATA-02B.2`, `DATA-03.2`, `DATA-03.3B`; file JSONL `DATA-03.4B` trong checkout có CRLF trong khi manifest/blob chuẩn là LF. Không tự sinh dữ liệu và không sửa checksum để làm xanh test.

## 7. An toàn dữ liệu và Git

- Không cấu hình Auth/Job/Application về `recruitment_db`; backend từ chối database này cho các write-capable API.
- Chỉ kiểm thử nghiệp vụ trên database tích hợp riêng đã được chuẩn bị và cho phép.
- Không đưa `.env`, mật khẩu demo, JWT hoặc CouchDB credentials vào commit/report.
- Tài liệu này không chứa thông tin đăng nhập; hãy nhận tài khoản Recruiter/Admin từ người quản lý môi trường.
- Trạng thái merge được nêu ở mục 1 là snapshot tại ngày lập tài liệu; cần chạy `git status` lại trước khi commit hoặc hoàn tất merge.
