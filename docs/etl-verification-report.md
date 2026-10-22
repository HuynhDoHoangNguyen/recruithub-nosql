# DATA-02B.3 — ETL Verification & Hardening Report

## 1. Executive Summary & Authority Precedence

Tài liệu này là báo cáo kiểm chứng độc lập và nghiệm thu kỹ thuật cho pipeline ETL (Parquet $\rightarrow$ Staged JSONL) của hệ thống **RecruiHub NoSQL**, theo hợp đồng **DATA-02B.3**.

### Thứ tự Thẩm quyền (Authority & Precedence):
1. **DATA-01 Audit (`docs/dataset-audit.md`):** Thẩm quyền cao nhất về sự thật dữ liệu nguồn (source facts), số lượng hàng, và mã băm SHA-256.
2. **Phase 3 Baseline (`docs/Nhom8_BaoCao_NoSQL_Phase3.docx`):** Khung nghiệp vụ tuyển dụng cơ sở.
3. **Approved DATA-02A (`docs/data-schema-contract.md`):** Thẩm quyền chuẩn mực về target document schemas, business rules và scoring contracts.
4. **DATA-02B.1:** Nền tảng executable Zod schemas và pure utilities.
5. **DATA-02B.2 & DATA-02B.3:** Pipeline trích xuất, chuẩn hóa, kiểm thử lỗi thực tế và cơ chế phát hành bất biến (Content-Addressed Immutable Releases).

---

## 2. Kiểm chứng Toàn vẹn Dữ liệu Nguồn (Source Integrity)

Kiểm tra SHA-256 trực tiếp từ file binary local trước khi trích xuất:

| File Nguồn | Kích thước | SHA-256 Thực tế | SHA-256 Ký kết (`dataset-audit.md`) | Kết quả |
|---|---:|---|---|:---:|
| `resumes.parquet` | 277,342 byte | `4A25ADD9C3A620C4C396E867063E390FC8084F9B53ED8135DEF049303A29D7A4` | `4A25ADD9C3A620C4C396E867063E390FC8084F9B53ED8135DEF049303A29D7A4` | **PASS** |
| `jobs.parquet` | 56,026 byte | `C13D7C7E0AB510E81117974027DE1364F973A27B3CACC8FABFBD8851C352C871` | `C13D7C7E0AB510E81117974027DE1364F973A27B3CACC8FABFBD8851C352C871` | **PASS** |
| `matches.parquet` | 274,261 byte | `DAB24E40948B2DA348C6DF7072B5B5FE3BB6EF8CAB335F88EEF5D5667EE79A92` | `DAB24E40948B2DA348C6DF7072B5B5FE3BB6EF8CAB335F88EEF5D5667EE79A92` | **PASS** |

---

## 3. Thống kê Bản ghi & Checksum Phát hành

Dữ liệu đầu ra được trích xuất và chuẩn hóa đầy đủ, không thất thoát bản ghi:

| Dataset | Số lượng Bản ghi | File Phát hành | SHA-256 Checksum | Trạng thái |
|---|---:|---|---|:---:|
| **Candidate (Staged)** | 10,000 | `candidates.jsonl` | `95EFE53AAF92CC91CDA926610E316E868DFE969C61DE5EE32B6E43CA3F9A0039` | **PASS (100% Valid)** |
| **Job (Staged)** | 2,500 | `jobs.jsonl` | `B3ECC3AF3AD563AC06476D3F4B31E4200D3FAF44122789FC044F8927705D9890` | **PASS (100% Valid)** |
| **Evaluation Matches** | 75,000 | `matches.jsonl` | `D794C8524BC747C3C8B3E0953A58BC05A142205E866A097531DCC09AE7FDB5CB` | **PASS (0 Orphan)** |

---

## 4. Kiến trúc Release Bất biến & Atomic Pointer (Rule A & B)

1. **Content Addressing Formula:**
   Mã băm release digest được tính toán tất định dựa trên:
   - `transform_version`: `DATA-02B.2`
   - `schema_contract`: `DATA-02A`
   - `alias_map_version`: `v1`
   - `scenario_clock`: `2026-10-21T00:00:00Z`
   - `source_hashes`: Hashes của 3 file Parquet
   - `output_hashes`: Hashes của `candidates.jsonl`, `jobs.jsonl`, `matches.jsonl`
   
   $$\text{Release Digest} = \text{SHA-256}(\text{CanonicalJSON}(\text{ReleaseFingerprintPayload}))$$
   $$\text{Giá trị thực tế} = \mathbf{157f09f09a9acd4d32fe699334eb98a3b2fe5acfa7afb09001659d8bca199a88}$$
   $$\text{Short Digest (16 hex)} = \mathbf{157f09f09a9acd4d}$$

2. **Cấu trúc Thư mục Phát hành Bất biến:**
   - **Immutable Directory:** `data/processed/releases/DATA-02B.2_157f09f09a9acd4d/`
   - **Active Release Pointer:** `data/processed/manifests/etl-manifest.json` (ghi nhận `active_release_dir` và `manifest_sha256`).
   - **Convenience Aliases:** `data/processed/staged/` và `data/processed/evaluation/`.
   - **Idempotency:** Khi chạy lại với cùng dữ liệu, hệ thống nhận diện `release_digest` đã tồn tại và đánh dấu `UNCHANGED`, bảo đảm không ghi đè hay làm hỏng bản phát hành đã khóa.

---

## 5. Ma trận Kiểm thử Chi tiết (Test Verification Matrix)

Tất cả 50 unit/integration tests trên Node.js Native Test Runner đều **PASS 100%**.

### 5.1. Negative Tests & Failure Injection (DATA-02B.3)

| Mã Test | Nội dung Kiểm thử | Dự kiến (Expected) | Thực tế (Actual) | Kết quả | Bằng chứng |
|---|---|---|---|:---:|---|
| **N-01** | Wrong source hash | Dừng trích xuất, exit code 1 | Process exit 1, báo Checksum mismatch | **PASS** | `extract-parquet.py` bắt lỗi hash sai |
| **N-02** | Missing source file | Dừng trích xuất, exit code 1 | Process exit 1, báo Source file missing | **PASS** | `extract-parquet.py` bắt thiếu file |
| **N-03** | Unexpected Parquet schema | Ném lỗi cấu trúc cột | Ném lỗi thiếu `skills` hoặc `job_title` | **PASS** | `verify_table_schema` / transform validation |
| **N-04** | Duplicate Candidate source ID | Validator từ chối | Ném lỗi duplicate source resume ID | **PASS** | `validateCandidates` bắt trùng ID |
| **N-05** | Duplicate Job source ID | Validator từ chối | Ném lỗi duplicate source job ID | **PASS** | `validateJobs` bắt trùng ID |
| **N-06** | Duplicate evaluation pair | Validator từ chối | Ném lỗi duplicate match pair | **PASS** | `validateMatches` bắt trùng cặp |
| **N-07** | Orphan evaluation reference | Validator từ chối | Ném lỗi orphan resume_id | **PASS** | `validateMatches` kiểm tra tham chiếu ngoại |
| **N-08** | Normalized skill collision | Zod schema từ chối | `stagedCandidateSchema.safeParse` fail | **PASS** | Zod refinement bắt trùng skill sau normalize |
| **N-09** | Invalid staged Candidate | Zod schema từ chối | Báo lỗi `years_experience cannot be negative` | **PASS** | Zod refinement bắt lỗi giá trị âm |
| **N-10** | Invalid staged Job | Zod schema từ chối | Báo lỗi trùng giữa required và optional | **PASS** | Zod refinement bắt lỗi giao thoa skills |
| **N-11** | Failure before publish | Active release không đổi | Active manifest giữ nguyên bản cũ | **PASS** | Abort trước bước ghi active pointer |
| **N-12** | Failure before pointer switch | Active pointer không đổi | Pointer giữ nguyên nội dung cũ | **PASS** | Atomic replace bảo vệ active pointer |
| **N-13** | Deterministic rerun | Nhận diện UNCHANGED | Không sinh release trùng lặp | **PASS** | Console log `UNCHANGED` khi hash khớp |
| **N-14** | Version/config separation | Sinh thư mục release riêng | Thư mục release có hậu tố short digest | **PASS** | `DATA-02B.2_157f09f09a9acd4d` độc lập |
| **N-15** | Active release readability | Files đọc được 100% | Đủ 10k/2.5k/75k records hợp lệ | **PASS** | Đọc và verify hash các active aliases |

### 5.2. ETL Integration Tests (DATA-02B.2)

| Mã Test | Nội dung Kiểm thử | Dự kiến | Thực tế | Kết quả |
|---|---|---|---|:---:|
| **IT-01** | Resume source ID mapping | `candidate:cms:R_XXXXXX` | Đúng namespace | **PASS** |
| **IT-02** | Job source ID mapping | `job:cms:J_XXXXXX` | Đúng namespace | **PASS** |
| **IT-03** | Experience months derivation | `years * 12` | Số nguyên chính xác | **PASS** |
| **IT-04** | Degree normalization | Ánh xạ 4 tiers chuẩn | BA/BSc $\rightarrow$ BACHELOR, MBA/MSc $\rightarrow$ MASTER | **PASS** |
| **IT-05** | Skill normalization count | Không tăng số kỹ năng | Duyệt đúng từ điển alias | **PASS** |
| **IT-06** | Required/Optional disjoint | Hai tập rời nhau | Không có phần tử giao thoa | **PASS** |
| **IT-07** | Partial education profile | Không sinh school/major | Chỉ lưu `degree` | **PASS** |
| **IT-08** | Detailed experience empty | Mảng rỗng `[]` | Không chế tạo việc làm cũ | **PASS** |
| **IT-09** | Detailed projects empty | Mảng rỗng `[]` | Không chế tạo project giả | **PASS** |
| **IT-10** | Staged vs Final boundary | Staged PASS, Final FAIL | Đúng ranh giới nghiệp vụ | **PASS** |
| **IT-11** | Candidate record count | Đúng 10,000 | 10,000 dòng JSONL | **PASS** |
| **IT-12** | Job record count | Đúng 2,500 | 2,500 dòng JSONL | **PASS** |
| **IT-13** | Match pairs record count | Đúng 75,000 | 75,000 dòng JSONL | **PASS** |
| **IT-14** | Zero orphan & 29 unmatched | Khớp DATA-01 audit | Đúng 29 hồ sơ không có match | **PASS** |
| **IT-15** | Deterministic rerun checksums | Checksums giống nhau | Khớp từng byte | **PASS** |
| **IT-16** | Corrupted staging record | Validator chặn | Dừng và xóa staging | **PASS** |

---

## 6. Chiến lược Tương thích (Legacy Compatibility)

Để bảo đảm các công cụ hiện có hoặc consumer ở các giai đoạn sau không bị gián đoạn:
1. **Canonical Source of Truth:**
   Reader ưu tiên đọc active release pointer từ `data/processed/manifests/etl-manifest.json` $\rightarrow$ giải quyết đường dẫn bất biến `active_release_dir`.
2. **Compatibility Aliases:**
   Hệ thống duy trì đồng bộ atomic các đường dẫn:
   - `data/processed/staged/candidates.jsonl`
   - `data/processed/staged/jobs.jsonl`
   - `data/processed/evaluation/matches.jsonl`
   - `data/processed/releases/DATA-02B.2/`
   giúp các script của các task kế tiếp có thể truy cập thuận tiện mà không bị lỗi file path.

---

## 7. Rủi ro Còn lại & Khuyến nghị cho DATA-03

1. **Ranh giới Staged:** Dữ liệu hiện tại là Staged Documents (chưa có User, Company, Recruiter). Tuyệt đối **không import trực tiếp** vào CouchDB khi chưa qua bước resolution ở DATA-03.
2. **Evaluation Ground Truth:** Tập 75.000 pairs trong `matches.jsonl` là nhãn đánh giá retrieval, **không được** chuyển đổi thành Application entities hoặc tính trước điểm số khi chưa có quy trình nộp hồ sơ hợp lệ.
3. **Môi trường CouchDB:** Hệ thống CouchDB local đang chạy trong container Docker hoàn toàn sạch sẽ, chưa bị tác động bởi bất kỳ lệnh ghi nào trong suốt quá trình DATA-02B.

---

**Kết luận:** Pipeline ETL và dữ liệu trung gian Staged JSONL của RecruiHub NoSQL đã đạt đầy đủ các tiêu chuẩn nghiệm thu khắt khe nhất của **DATA-02B.3**, sẵn sàng bàn giao cho **DATA-03**.
