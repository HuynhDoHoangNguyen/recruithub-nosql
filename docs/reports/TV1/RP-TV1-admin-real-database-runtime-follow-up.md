# RecruiHub TV1 — Admin runtime trên database chính

Ngày cập nhật: 2026-10-25
Branch: `feature/admin-management`

## Mục tiêu

Ghi lại cấu hình để chạy Frontend và Backend cùng dùng một database CouchDB, xác minh UC23–UC25 trên `recruitment_db`, và giải thích điều kiện hiển thị thao tác Lock/Unlock trong Admin User List.

## Cấu hình chạy local

Các giá trị không bí mật trong `.env` local (file bị Git ignore):

```dotenv
COUCHDB_DATABASE=recruitment_db
AUTH_COUCHDB_DATABASE=recruitment_db
AUTH_ALLOW_PRIMARY_DATABASE=true
PORT=5010
FRONTEND_URL=http://127.0.0.1:5177
```

`frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:5010/api
```

`AUTH_ALLOW_PRIMARY_DATABASE=true` là xác nhận tường minh cho phép Auth dùng cùng database chính. Backend từ chối nếu `COUCHDB_DATABASE` và `AUTH_COUCHDB_DATABASE` lệch nhau. Không ghi CouchDB password hoặc JWT secret vào report; giữ chúng trong `.env` local.

Sau khi đổi `.env`, cần khởi động lại Backend để Node nạp giá trị mới. Sau khi đổi `frontend/.env.local`, khởi động lại Vite. Dùng duy nhất UI `http://127.0.0.1:5177/` và API `http://127.0.0.1:5010`; các tiến trình cũ ở cổng khác có thể vẫn phục vụ source/config cũ.

## Trạng thái UC25 trên database chính

Các design documents cần cho thống kê đã được cài vào database mục tiêu; Admin Statistics không dùng số ước tính hoặc fallback scan. API lấy User/Candidate aggregates từ `tv1_admin_statistics` và Job status từ view TV2 `job_application/jobs_by_recruiter`.

Kết quả đọc sau tích hợp: `GET /api/v1/admin/stats` trả 200. Các số liệu đã đối chiếu tại thời điểm kiểm tra: 10,152 Users; 10,001 Candidates; 150 Recruiters; 1 Admin; 2 ACTIVE, 0 LOCKED, 10,150 RESET_REQUIRED; 2,500 Jobs (2,300 DRAFT, 200 OPEN, 0 CLOSED). Đây là snapshot có thể thay đổi theo dữ liệu.

Database có 25,755 documents sau kiểm tra. So với count trước đó 25,750, lượt kiểm tra thêm một synthetic Admin User, một synthetic Candidate User và một Candidate profile; hai design documents cũng là document mới. Candidate test được chuyển ACTIVE → LOCKED → ACTIVE để xác minh UC24. Seeded RESET_REQUIRED accounts không bị kích hoạt hoặc chỉnh sửa. Các thao tác trên `recruitment_db` là thay đổi dữ liệu thật của database chính, dù document test dùng email `example.invalid`.

## Vì sao không thấy Lock/Unlock

Nút đã có trong `frontend/src/pages/Dashboard/AdminDashboard.jsx`. Bảng và cửa sổ chi tiết chỉ hiện nút khi:

- role là `CANDIDATE` hoặc `RECRUITER`; và
- trạng thái là `ACTIVE` hoặc `LOCKED`.

`ACTIVE` hiện nút **Lock**; `LOCKED` hiện **Unlock**. `ADMIN` không được đổi trạng thái qua API/UI và hiển thị ghi chú operator-managed. `RESET_REQUIRED` cũng không có nút để tránh kích hoạt tài khoản chưa qua quy trình reset/claim. Vì vậy phần lớn Users seeded trong DB chính (đều `RESET_REQUIRED`) không có thao tác Lock/Unlock theo chính sách hiện tại.

Để kiểm tra nút trong UI, mở `http://127.0.0.1:5177/`, đăng nhập Admin, tìm synthetic Candidate `tv1-admin-flow-499ba1170231@example.invalid` hoặc lọc status `ACTIVE`. Trong bảng, cột **Thao tác** nằm ngoài mép phải và có thể cần cuộn ngang; nút Lock cũng có trong chi tiết User. Sau khi khóa thành công, lọc `LOCKED` để thấy Unlock. Không dùng frontend cũ ở cổng 5173 vì nó có thể gọi API cũ trên cổng 5000.

## Bằng chứng và giới hạn

- Backend 5010 `/api/health`: 200; Admin list/detail/stats: 200.
- UC24 trên Candidate tổng hợp: Lock thành công; token bị từ chối khi tài khoản LOCKED; Unlock thành công.
- Frontend 5177 trả SPA route; cấu hình API đã trỏ Backend 5010; CORS preflight từ đúng origin thành công.
- Các test Backend Admin/Statistics/Domain và Frontend đã PASS trong lượt kiểm tra trước; không chạy lại test trong lần ghi report này.
- Browser automation chưa xác nhận thao tác click/render/responsive thực tế; hướng dẫn trên dựa trên source và API verification.
- Các kết quả và thay đổi dữ liệu trong report là trạng thái tại 2026-10-25; không đại diện cho snapshot tương lai.

## UI follow-up từ ảnh người dùng — 2026-10-25

- Biểu đồ phân bổ vai trò chuyển legend xuống dưới donut và cho phép nhãn xuống dòng để vừa card hẹp.
- Admin User API trả `totalCount` chính xác theo search/role/status từ CouchDB view `user_count_by_filter`; giao diện hiển thị `trang hiện tại / tổng số trang`. Query view trả document theo cursor và giới hạn trang, tránh việc các trang lọc thưa bị tính sai do scan budget.
- View `user_count_by_filter` được thêm vào `_design/tv1_admin_statistics` trong `recruitment_db` bằng script idempotent `npm run db:admin-statistics`; script chỉ thêm view còn thiếu và từ chối ghi đè view cùng tên nếu định nghĩa khác source.
- Hướng dẫn ngay trên bộ lọc giải thích trạng thái nào được Lock/Unlock. Cột thao tác gom vào danh sách **Chọn thao tác**; trong danh sách chỉ có Chi tiết và hành động hợp lệ theo role/status. Reset mật khẩu có bước xác nhận; Lock/Unlock cũng giữ bước xác nhận. Admin status vẫn operator-managed.
- Backend được khởi động lại trên cổng 5010 sau thay đổi. Lượt build Frontend ở reset follow-up bên dưới bao gồm các UI này.

## UC24 password-reset follow-up — 2026-10-25

Theo yêu cầu kiểm thử tài khoản seeded, Admin có thể bấm **Reset mật khẩu** trên Candidate/Recruiter `RESET_REQUIRED`. API bắt buộc `If-Match`, tạo credential ngẫu nhiên, chỉ lưu Argon2id hash bọc thời hạn 24 giờ trong `password_hash`, giữ nguyên `RESET_REQUIRED`, và trả credential rõ đúng một lần trong response Admin. UI yêu cầu xác nhận rồi hiển thị credential một lần; không ghi credential vào report/log.

Trang `/reset-password` có nút mắt riêng cho mã dùng một lần, mật khẩu mới và trường nhập lại; trạng thái ban đầu vẫn ẩn. Trang Đăng nhập và Đăng ký đã có nút mắt cho mật khẩu và xác nhận mật khẩu. Frontend production build sau thay đổi **PASS** (Vite 8.3.3); bundle cảnh báo kích thước 524.42 kB vượt ngưỡng 500 kB.

Chủ tài khoản mở `/reset-password`, nhập email, credential tạm và mật khẩu mới. Backend xác thực credential chưa hết hạn/chưa dùng, kiểm tra Candidate hoặc Recruiter cùng Company/Department scope, sau đó thay hash và chuyển duy nhất User đó sang `ACTIVE` bằng update có `_rev`. Credential cũ không dùng lại được sau update. Đây là thao tác ghi trên `recruitment_db` và sửa User seed được chọn; không thay đổi các tài khoản khác. Email delivery chưa được triển khai, nên chuyển credential cho người dùng phải dùng kênh riêng.

Mã nguồn hỗ trợ thao tác qua `POST /api/v1/admin/users/:id/password-reset` và `POST /api/v1/auth/reset-password`; trang public `/reset-password` được liên kết từ Login. Frontend production build sau các cập nhật mới nhất **PASS** (Vite 8.3.3); Node syntax checks cho Auth/Admin source **PASS**. Không chạy automated test suite và chưa xác minh menu/reset flow bằng browser hoặc end-to-end. Build có cảnh báo chunk JS 524.42 kB lớn hơn ngưỡng 500 kB.

## Nguồn liên quan

- [TV1 Auth contract](../../shared/TV1_AUTH_MODULE_CONTRACT.md)
- [UC24/UC25 và audit nhánh trong báo cáo tổng hợp](RP-TV1-consolidated.md#three-branch-audit)
