# Hướng dẫn thiết lập CouchDB và nạp dữ liệu RecruiHub NoSQL
## Dành cho thành viên nhóm mới clone dự án về máy cá nhân

Tài liệu này hướng dẫn chi tiết từng bước cho thành viên nhóm vừa clone repository `recruithub-nosql` về máy tính cá nhân để khởi động dịch vụ CouchDB trong Docker, nạp toàn bộ **25.750 documents thuộc 9 loại nghiệp vụ** vào database `recruitment_db`, và kiểm tra đối soát tính toàn vẹn của dữ liệu.

---

## 1. Phân loại nguồn gốc tệp tin (File Origins)

Trước khi thực hiện, các thành viên cần hiểu rõ 3 nhóm tệp tin trong dự án để tránh thiếu sót hoặc commit nhầm:

| Nhóm tệp tin | Nguồn gốc | Danh sách tệp tiêu biểu | Lưu ý quan trọng |
| :--- | :--- | :--- | :--- |
| **Mã nguồn & Scripts** | **Lấy từ Git repository** | `backend/`, `scripts/`, `docs/`, `docker-compose.yml`, `.env.example`, `package.json` | Được đồng bộ tự động khi `git clone` hoặc `git pull`. |
| **Manifest Pointers** | **Lấy từ Git repository** | `data/processed/manifests/final-manifest.json` | Chứa checksum SHA-256 và release digest chuẩn để importer tự động đối soát. |
| **Cấu hình cá nhân** | **Mỗi thành viên tự cấu hình** | `.env` tại thư mục gốc repository | **Tuyệt đối không commit lên Git**. Sao chép từ `.env.example` và đặt mật khẩu riêng. |
| **Dữ liệu Release** | **Tải riêng từ file ZIP dataset** | Thư mục `data/processed/releases/DATA-03.4B_7fdd3b34c4636367/` (chứa 9 files `.jsonl` ~30 MB) | Không lưu trên Git vì kích thước lớn. Tải file ZIP từ kênh lưu trữ nội bộ nhóm và giải nén đúng đường dẫn. |

---

## 2. Yêu cầu môi trường (Prerequisites)

- **Hệ điều hành**: Windows 10/11 (khuyên dùng PowerShell) hoặc macOS/Linux.
- **Node.js**: Phiên bản 18.x trở lên (đã kiểm thử tương thích tốt nhất trên Node.js v20.x và v24.x).
- **Docker Desktop**: Đang chạy và đã bật tích hợp WSL 2 / Compose.
- **Git**: Đã cài đặt Git client.

---

## 3. Các bước triển khai (Step-by-Step Instructions)

Tất cả các lệnh dưới đây được viết cho **Windows PowerShell**. Hãy mở PowerShell tại thư mục làm việc của bạn.

### Bước 1: Clone repository và chuyển vào thư mục dự án

```powershell
git clone https://github.com/HuynhDoHoangNguyen/recruithub-nosql.git
Set-Location -Path recruithub-nosql
```

### Bước 2: Thiết lập file môi trường `.env`

Tạo file `.env` từ file mẫu `.env.example`:

```powershell
Copy-Item -Path .env.example -Destination .env
```

Mở file `.env` bằng trình soạn thảo (VS Code, Notepad, v.v.) và thiết lập thông tin đăng nhập CouchDB:
```ini
COUCHDB_USER=admin
COUCHDB_PASSWORD=MatKhauBaoMatCuaBan123!
```

> [!WARNING]
> Không chia sẻ file `.env` hoặc đưa thông tin tài khoản/mật khẩu lên Git. File `.env` đã được liệt kê trong `.gitignore`.

### Bước 3: Khởi động CouchDB bằng Docker Compose

Chạy lệnh sau tại thư mục gốc của repository để tải image và khởi động container CouchDB:

```powershell
docker compose up -d
```

Kiểm tra trạng thái container đang hoạt động:

```powershell
docker compose ps
```

*Kỳ vọng*: Container `recruithub-couchdb` hiển thị trạng thái `Up` và mở port `127.0.0.1:5984`.

Kiểm tra kết nối trực tiếp đến CouchDB server:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5984/
```

*Kỳ vọng phản hồi*: JSON chào mừng của CouchDB (`"couchdb": "Welcome", "version": "3.5.2"`).

### Bước 4: Cài đặt dependencies cho Backend

Di chuyển vào thư mục `backend/` và cài đặt các thư viện Node.js cần thiết:

```powershell
Set-Location -Path backend
npm install
```

### Bước 5: Chuẩn bị dữ liệu Release DATA-03.4B

Bạn có thể lựa chọn 1 trong 2 cách sau:

#### Cách A: Giải nén file ZIP Release có sẵn (Khuyên dùng - Nhanh nhất)
1. Tải file `DATA-03.4B_release.zip` từ kênh lưu trữ chung của nhóm.
2. Tạo thư mục đích và giải nén toàn bộ nội dung file ZIP vào đúng đường dẫn sau (tính từ thư mục gốc của repo):
   `data/processed/releases/DATA-03.4B_7fdd3b34c4636367/`
3. Kiểm tra xem thư mục có đủ 9 file `.jsonl` và file `final-manifest.json` hay chưa:
   ```powershell
   Get-ChildItem -Path ../data/processed/releases/DATA-03.4B_7fdd3b34c4636367/
   ```

#### Cách B: Tự chạy pipeline tái sinh dữ liệu (Nếu máy có file Parquet gốc)
Nếu máy bạn có sẵn dữ liệu Parquet gốc trong `data/raw/candidate-matching-synthetic/`, bạn có thể chạy chuỗi lệnh sau trong thư mục `backend/`:
```powershell
npm run etl            # DATA-02B: Trích xuất và chuẩn hóa staged data
npm run foundation     # DATA-03.2: Sinh User, Company, Department, Recruiter
npm run recruitment    # DATA-03.3B: Sinh Job, Application, Interview
npm run corpus         # DATA-03.4B: Sinh Resume Analysis & đóng gói Final Release
```

### Bước 6: Chạy thử nghiệm Preflight Dry-Run (Không ghi database)

Trước khi ghi dữ liệu thật, chạy lệnh Dry-run để kiểm tra tính toàn vẹn của checksum 9 file JSONL, kết nối CouchDB và cấu hình:

```powershell
npm run db:import -- --dry-run
```

*Kỳ vọng*: Tất cả 9 files đều hiển thị `SHA-256 OK` và kết thúc với thông báo:
```text
[DRY RUN] Preflight checks passed. Skipping database writes (--dry-run).
```

### Bước 7: Thực hiện nạp dữ liệu thật vào CouchDB

Chạy lệnh import chính thức kèm cờ `--create-db` (để tự động tạo database `recruitment_db` nếu chưa có):

```powershell
npm run db:import -- --create-db
```

*Tiến trình thực thi*:
- Importer sẽ stream từng tệp JSONL theo đúng thứ tự phụ thuộc logic.
- Gửi từng lô 500 documents qua endpoint `_bulk_docs`.
- Quá trình nạp 25.750 documents mất khoảng **7–12 giây**.
- Kết quả mong đợi:
```text
Total Processed: 25,750 documents
Total Inserted:  25,750
Total Skipped:   0
Total Errors:    0
```

### Bước 8: Kiểm tra đối soát sau khi Import (Post-Import Verification)

Chạy script kiểm tra đối soát độc lập:

```powershell
npm run db:verify
```

Script này sẽ:
1. Đếm tổng số tài liệu trong CouchDB qua `_all_docs`.
2. Phân loại và đếm số lượng từng loại trong 9 document types.
3. So sánh exact ID và đối soát nội dung (content parity) với tập dữ liệu gốc.
4. Kiểm tra tính toàn vẹn tham chiếu chéo (Candidate -> User, Application -> Job/Candidate, Analysis -> Application).
5. Xuất báo cáo kiểm định ra file `data/processed/reports/couchdb-import-verification.json`.

*Kỳ vọng kết thúc*:
```text
Verification report generated: .../couchdb-import-verification.json
=== VERIFICATION RESULT: PASS ===
```

### Bước 9: Kiểm tra tính Idempotent khi chạy lại (Idempotent Rerun)

Để chứng minh hệ thống nạp dữ liệu an toàn, không tạo rác hay tạo revision mới khi chạy lại, hãy chạy lại lệnh import lần thứ hai:

```powershell
npm run db:import
```

*Kỳ vọng*:
- Importer nhận diện toàn bộ 25.750 documents đã tồn tại với nội dung giống hệt 100%.
- Bỏ qua toàn bộ (`Skipped: 25,750`, `Inserted: 0`, `Errors: 0`).
- Không sinh ra bất kỳ revision mới nào trong CouchDB.

### Bước 10: Chạy toàn bộ Test Suite để đảm bảo hệ thống ổn định

```powershell
npm test
```

*Kỳ vọng*: Toàn bộ 15 test suites vượt qua:
```text
ℹ tests 246
ℹ suites 2
ℹ pass 246
ℹ fail 0
```

---

## 4. Tiêu chí nghiệm thu dữ liệu (Acceptance Verification)

Sau khi hoàn tất Bước 8, database `recruitment_db` phải thỏa mãn chính xác các tiêu chí sau:

### A. Bảng số lượng tài liệu theo 9 Document Types

| STT | Business Type | ID Prefix | Tệp nguồn | Số lượng bắt buộc | Trạng thái |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 1 | `user` | `user:` | `users.jsonl` | **10.150** | **Khớp 100%** |
| 2 | `company` | `company:` | `companies.jsonl` | **50** | **Khớp 100%** |
| 3 | `department` | `department:` | `departments.jsonl` | **150** | **Khớp 100%** |
| 4 | `recruiter` | `recruiter:` | `recruiters.jsonl` | **150** | **Khớp 100%** |
| 5 | `candidate` | `candidate:cms:` | `candidates.jsonl` | **10.000** | **Khớp 100%** |
| 6 | `job` | `job:cms:` | `jobs.jsonl` | **2.500** | **Khớp 100%** |
| 7 | `application` | `application:pair:` | `applications.jsonl` | **1.200** | **Khớp 100%** |
| 8 | `interview` | `interview:` | `interviews.jsonl` | **350** | **Khớp 100%** |
| 9 | `resume_analysis` | `analysis:` | `resume_analyses.jsonl` | **1.200** | **Khớp 100%** |
| **Σ** | **Tổng cộng** | | **9 files** | **25.750** | **Khớp 100%** |

### B. Kiểm tra trực quan qua Web UI (Fauxton Dashboard)

1. Mở trình duyệt web và truy cập địa chỉ:
   `http://localhost:5984/_utils/`
2. Nhập thông tin đăng nhập đã cấu hình trong file `.env` (`COUCHDB_USER` và `COUCHDB_PASSWORD`).
3. Nhấp vào database `recruitment_db`.
4. Quan sát góc trên bên phải màn hình: tổng số document hiển thị chính xác là **25,750**.

---

## 5. Xử lý sự cố thường gặp (Troubleshooting)

### Sự cố 1: Lỗi `ECONNREFUSED 127.0.0.1:5984`
- **Nguyên nhân**: Container CouchDB chưa được khởi động hoặc Docker Desktop chưa chạy.
- **Khắc phục**:
  1. Mở Docker Desktop.
  2. Tại thư mục gốc dự án, chạy lệnh: `docker compose up -d`.
  3. Kiểm tra bằng: `docker compose ps`.

### Sự cố 2: Lỗi `Database "recruitment_db" does not exist in CouchDB`
- **Nguyên nhân**: Database chưa được tạo và lệnh import chưa có cờ cho phép tạo tự động.
- **Khắc phục**: Thêm cờ `-- --create-db` vào sau lệnh:
  ```powershell
  npm run db:import -- --create-db
  ```

### Sự cố 3: Lỗi `SHA-256 checksum mismatch for ...`
- **Nguyên nhân**: File release `.jsonl` bị hỏng, tải thiếu byte, hoặc đã bị chỉnh sửa nội dung.
- **Khắc phục**:
  1. Xóa thư mục release bị lỗi.
  2. Tải lại file ZIP `DATA-03.4B_release.zip` gốc và giải nén lại vào `data/processed/releases/DATA-03.4B_7fdd3b34c4636367/`.

### Sự cố 4: Lỗi đăng nhập `401 Unauthorized`
- **Nguyên nhân**: Thông tin trong file `.env` không trùng khớp với tài khoản khởi tạo container CouchDB trong `docker-compose.yml`.
- **Khắc phục**:
  1. Kiểm tra lại `COUCHDB_USER` và `COUCHDB_PASSWORD` trong file `.env`.
  2. Nếu trước đó đã khởi tạo container với mật khẩu khác: dừng container và volume cũ:
     ```powershell
     docker compose down -v
     docker compose up -d
     ```
     *(Lưu ý: Chỉ thực hiện `docker compose down -v` khi chưa có dữ liệu quan trọng cần giữ)*.
