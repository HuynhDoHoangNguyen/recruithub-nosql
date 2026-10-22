# DATA-01 — Dataset Audit

## 1. Trạng thái và phạm vi

- Task: `DATA-01`.
- Trạng thái audit: **COMPLETE WITH BLOCKERS**.
- Phạm vi: ba file Parquet trong `data/raw/candidate-matching-synthetic/` và khả năng dùng chúng cho mô hình CouchDB của RecruiHub.
- Không thực hiện ETL, sinh dữ liệu, import CouchDB hoặc thay đổi dữ liệu nguồn.
- `BLOCKED` chỉ áp dụng cho việc tính đầy đủ `resume_analysis`: Phase 3 chưa định nghĩa rule định lượng cho `experience_score`, `education_score` và `project_score`.

## 2. Nguồn và provenance

Nguồn công khai: [michaelozon/candidate-matching-synthetic](https://huggingface.co/datasets/michaelozon/candidate-matching-synthetic).

Dataset card mô tả đây là dữ liệu synthetic tiếng Anh, được tạo bằng Qwen 2.5, phát hành phiên bản `v1.0.0` tháng 01/2026 và gắn giấy phép MIT. Trước khi phân phối lại artifact, nhóm vẫn cần giữ attribution, kiểm tra điều kiện giấy phép tại thời điểm sử dụng và cân nhắc lưu một bản license/citation trong artifact phát hành. Repository hiện chưa có bản license riêng cho dataset.

Ba file local có kích thước và SHA-256 khớp chính xác với LFS object của nguồn công khai:

| File local | Kích thước | SHA-256 |
|---|---:|---|
| `resumes.parquet` | 277,342 byte | `4A25ADD9C3A620C4C396E867063E390FC8084F9B53ED8135DEF049303A29D7A4` |
| `jobs.parquet` | 56,026 byte | `C13D7C7E0AB510E81117974027DE1364F973A27B3CACC8FABFBD8851C352C871` |
| `matches.parquet` | 274,261 byte | `DAB24E40948B2DA348C6DF7072B5B5FE3BB6EF8CAB335F88EEF5D5667EE79A92` |

Tên file local đã được rút gọn so với artifact nguồn, nhưng nội dung binary không thay đổi. Provenance trong document sau này phải ghi cả tên file local, hash và source dataset; không chỉ ghi một nhãn chung như `imported`.

## 3. Phương pháp audit

Audit được chạy read-only bằng DuckDB `1.4.1`, cài trong thư mục tạm của hệ điều hành, không thêm dependency vào repository. Mỗi file được đọc trực tiếp bằng `read_parquet`; không tạo bản Parquet trung gian.

Các nhóm kiểm tra:

1. Đối chiếu Parquet footer, magic bytes, kích thước và SHA-256.
2. Đọc toàn bộ hàng để xác định schema và row count.
3. Kiểm tra null, chuỗi rỗng, list rỗng và phần tử list null/rỗng.
4. Kiểm tra format, uniqueness của ID và duplicate toàn hàng.
5. `UNNEST` các list để kiểm tra duplicate skill, duplicate Resume–Job pair và referential integrity.
6. Tổng hợp phân bố role, seniority, industry, education, skill và độ dài list.
7. Đối chiếu quan hệ giữa ground truth và Resume/Job, nhưng không coi ground truth là Application hoặc `total_score`.

Các số liệu bên dưới là kết quả value-level từ file local, không phải sao chép số liệu công bố.

## 4. Inventory và schema thực tế

### 4.1. Tổng quan

| Dataset | Rows | Top-level columns | Row groups | Compression |
|---|---:|---:|---:|---|
| Resumes | 10,000 | 9 | 10 | Snappy |
| Jobs | 2,500 | 9 | 3 | Snappy |
| Matches | 2,500 | 2 | 3 | Snappy |

Footer ghi `parquet-cpp-arrow version 18.1.0` là công cụ tạo cả ba file.

### 4.2. `resumes.parquet`

| Column | DuckDB type | Ý nghĩa nguồn |
|---|---|---|
| `resume_id` | `VARCHAR` | ID synthetic của resume |
| `role` | `VARCHAR` | Vai trò nghề nghiệp |
| `seniority` | `VARCHAR` | Junior/Mid/Senior |
| `years_experience` | `BIGINT` | Tổng số năm kinh nghiệm |
| `industry` | `VARCHAR` | Ngành |
| `education` | `VARCHAR` | Bậc học dạng scalar |
| `skills` | `VARCHAR[]` | Danh sách kỹ năng |
| `summary` | `VARCHAR` | Tóm tắt synthetic |
| `experience_bullets` | `VARCHAR[]` | Ba bullet kinh nghiệm tổng quát |

### 4.3. `jobs.parquet`

| Column | DuckDB type | Ý nghĩa nguồn |
|---|---|---|
| `job_id` | `VARCHAR` | ID synthetic của job |
| `job_title` | `VARCHAR` | Chức danh |
| `seniority` | `VARCHAR` | Seniority yêu cầu |
| `industry` | `VARCHAR` | Ngành |
| `must_have_skills` | `VARCHAR[]` | Kỹ năng bắt buộc |
| `nice_to_have_skills` | `VARCHAR[]` | Kỹ năng ưu tiên |
| `description` | `VARCHAR` | Mô tả synthetic |
| `responsibilities` | `VARCHAR[]` | Trách nhiệm |
| `requirements` | `VARCHAR[]` | Yêu cầu chung |

### 4.4. `matches.parquet`

| Column | DuckDB type | Ý nghĩa nguồn |
|---|---|---|
| `job_id` | `VARCHAR` | Tham chiếu Job nguồn |
| `relevant_resume_ids` | `VARCHAR[]` | Ground-truth resume IDs cho retrieval |

`matches` không có application timestamp, trạng thái pipeline, recruiter action hoặc bằng chứng ứng viên đã ứng tuyển. Vì vậy một hàng `matches` **không phải** một Application.

## 5. Kết quả data quality

### 5.1. ID và duplicate

| Kiểm tra | Resumes | Jobs | Matches |
|---|---:|---:|---:|
| Row count | 10,000 | 2,500 | 2,500 |
| Distinct primary/source ID | 10,000 | 2,500 | 2,500 |
| Duplicate ID rows | 0 | 0 | 0 |
| Invalid ID format | 0 | 0 | 0 |
| Duplicate toàn hàng | 0 | 0 | 0 |

Format đã kiểm tra:

- Resume: `R_[0-9]{6}`, range `R_000000`–`R_009999`.
- Job và Match: `J_[0-9]{6}`, range `J_000000`–`J_002499`.

### 5.2. Missing và empty values

- Null top-level: 0 ở tất cả columns.
- Chuỗi null/rỗng sau `trim`: 0.
- List null/rỗng: 0.
- Phần tử null/rỗng trong mọi list: 0.
- Kỹ năng trùng trong cùng một Resume sau `lower(trim(...))`: 0.
- Kỹ năng must-have trùng trong cùng Job: 0.
- Kỹ năng nice-to-have trùng trong cùng Job: 0.
- Giao nhau giữa must-have và nice-to-have trong cùng Job: 0.
- Resume ID trùng trong một matching array: 0.

Kết luận: **PASS** cho completeness và duplicate cấu trúc của snapshot hiện tại.

### 5.3. Độ dài list

| Field | Min | Max | Mean | Median | Tổng phần tử |
|---|---:|---:|---:|---:|---:|
| `resumes.skills` | 5 | 8 | 6.4888 | 6 | 64,888 |
| `resumes.experience_bullets` | 3 | 3 | 3.0000 | 3 | 30,000 |
| `jobs.must_have_skills` | 3 | 5 | 3.9972 | 4 | 9,993 |
| `jobs.nice_to_have_skills` | 1 | 1 | 1.0000 | 1 | 2,500 |
| `jobs.responsibilities` | 3 | 3 | 3.0000 | 3 | 7,500 |
| `jobs.requirements` | 3 | 3 | 3.0000 | 3 | 7,500 |
| `matches.relevant_resume_ids` | 30 | 30 | 30.0000 | 30 | 75,000 |

### 5.4. Referential integrity và matching pairs

| Kiểm tra | Kết quả |
|---|---:|
| Match rows trỏ tới Job không tồn tại | 0 |
| Pair trỏ tới Resume không tồn tại | 0 |
| Job không có match record | 0 |
| Tổng Resume–Job pairs | 75,000 |
| Distinct Resume–Job pairs | 75,000 |
| Duplicate pair groups/extras | 0 / 0 |
| Resume chưa từng xuất hiện trong ground truth | 29 |

Không có orphan reference hoặc duplicate pair. Tuy nhiên, 29/10,000 resume không xuất hiện trong bất kỳ ground-truth matching list nào. Đây là **WARN về coverage**, không phải orphan: các resume vẫn hợp lệ và phải được giữ khi tạo Candidate.

Số lần một resume được tham chiếu dao động 0–27, trung bình 7.5 và median 7. Có 9,971 resume được tham chiếu ít nhất một lần.

### 5.5. Quan hệ của ground truth

Sau khi chuẩn hóa skill bằng `lower(trim(skill))`:

| Metric trên 75,000 pairs | Kết quả |
|---|---:|
| Required-skill overlap tối thiểu | 60% |
| Required-skill overlap tối đa | 100% |
| Required-skill overlap trung bình | 77.4806% |
| Pair dưới 60% | 0 |
| Pair khớp 100% required skills | 18,024 |
| Cùng role/job title | 24,906 |
| Cùng seniority | 25,190 |
| Cùng industry | 7,497 |

Phân bố overlap:

| Overlap | Pairs |
|---:|---:|
| 60.00% | 11,966 |
| 66.67% | 16,361 |
| 75.00% | 18,394 |
| 80.00% | 10,255 |
| 100.00% | 18,024 |

Kết quả xác nhận ground truth phản ánh một rule retrieval dựa trên skill threshold. Nó không chứng minh hành vi ứng tuyển và không được dùng làm `total_score` của RecruiHub.

### 5.6. Template repetition

| Field | Rows | Distinct values/arrays | Số lần lặp lớn nhất | Đánh giá |
|---|---:|---:|---:|---|
| Resume `summary` | 10,000 | 2,861 | 17 | Synthetic/template-based |
| Resume `experience_bullets` | 10,000 | 1 | 10,000 | Cảnh báo mạnh |
| Job `description` | 2,500 | 240 | 23 | Synthetic/template-based |
| Job `responsibilities` | 2,500 | 1 | 2,500 | Cảnh báo mạnh |
| Job `requirements` | 2,500 | 1 | 2,500 | Cảnh báo mạnh |

Các text fields hoàn chỉnh về mặt kỹ thuật nhưng không đa dạng về nội dung. Không nên dùng chúng để tuyên bố hệ thống đã được kiểm thử tốt cho NLP, semantic ranking hoặc CV parsing thực tế.

## 6. Phân bố dữ liệu

### 6.1. Resume seniority và education

| Seniority | Count | Tỷ lệ |
|---|---:|---:|
| Junior | 3,372 | 33.72% |
| Mid | 3,365 | 33.65% |
| Senior | 3,263 | 32.63% |

Job seniority cũng gần cân bằng:

| Seniority | Count | Tỷ lệ |
|---|---:|---:|
| Junior | 855 | 34.20% |
| Mid | 825 | 33.00% |
| Senior | 820 | 32.80% |

| Education | Count | Tỷ lệ |
|---|---:|---:|
| BSc | 2,071 | 20.71% |
| MBA | 2,031 | 20.31% |
| MSc | 1,980 | 19.80% |
| BA | 1,965 | 19.65% |
| High School | 1,953 | 19.53% |

### 6.2. Experience theo seniority

| Seniority | Count | Min | Max | Mean | Median | Ngoài range công bố |
|---|---:|---:|---:|---:|---:|---:|
| Junior | 3,372 | 0 | 2 | 0.9991 | 1 | 0 |
| Mid | 3,365 | 2 | 6 | 4.0220 | 4 | 0 |
| Senior | 3,263 | 6 | 12 | 9.0021 | 9 | 0 |

Không có kinh nghiệm âm hoặc seniority ngoài enum.

### 6.3. Industry

| Industry | Resumes | Jobs |
|---|---:|---:|
| Retail | 1,084 | 237 |
| E-commerce | 1,018 | 219 |
| Gaming | 1,018 | 241 |
| SaaS | 1,014 | 271 |
| Logistics | 1,012 | 248 |
| Travel | 992 | 243 |
| Cybersecurity | 968 | 247 |
| EdTech | 967 | 225 |
| Healthcare | 964 | 290 |
| FinTech | 963 | 279 |

### 6.4. Role

Có đúng 24 resume roles và cùng 24 job titles. Phân bố đầy đủ:

| Role / Job title | Resumes | Jobs |
|---|---:|---:|
| Account Executive | 381 | 108 |
| Associate Product Manager | 438 | 96 |
| Backend Engineer | 456 | 117 |
| BI Analyst | 426 | 103 |
| Business Analyst | 422 | 120 |
| Business Development Manager | 407 | 92 |
| Content Marketer | 409 | 106 |
| Customer Success Associate | 384 | 103 |
| Customer Support Specialist | 388 | 105 |
| Data Analyst | 404 | 89 |
| Financial Analyst | 433 | 101 |
| FP&A Analyst | 417 | 111 |
| Full Stack Engineer | 423 | 108 |
| Junior Accountant | 393 | 118 |
| Marketing Manager | 455 | 93 |
| Operations Manager | 427 | 83 |
| Performance Marketer | 392 | 97 |
| Product Manager | 453 | 88 |
| Program Coordinator | 394 | 107 |
| Project Manager | 398 | 130 |
| Sales Representative | 460 | 114 |
| Software Engineer | 432 | 95 |
| Technical Product Manager | 394 | 104 |
| Technical Support Specialist | 414 | 112 |

### 6.5. Skills

- Resume vocabulary: 73 normalized skills.
- Job vocabulary: 73 normalized skills.
- Resume-only skills: 0; Job-only skills: 0.
- Không có khoảng trắng bao quanh; lowercase normalization không làm giảm vocabulary cardinality.

Top resume skills:

| Skill | Resume occurrences |
|---|---:|
| a/b testing | 2,447 |
| python | 1,697 |
| forecasting | 1,648 |
| reporting | 1,619 |
| kpis | 1,598 |
| excel | 1,551 |
| javascript | 866 |
| oop | 858 |
| prioritization | 858 |
| rest apis | 855 |

Top must-have job skills:

| Skill | Job occurrences |
|---|---:|
| a/b testing | 361 |
| forecasting | 277 |
| excel | 265 |
| reporting | 264 |
| kpis | 242 |
| python | 238 |
| project planning | 146 |
| valuation | 146 |
| intercom | 143 |
| databases | 140 |

## 7. Mẫu đã masking

Không có tên, email, số điện thoại hoặc CV thật trong source schema. Ví dụ sau chỉ thể hiện shape; chữ số ID được thay bằng `X`:

| Dataset | Masked ID | Role/title | Seniority | Industry | Education | List size |
|---|---|---|---|---|---|---:|
| Resume | `R_XXXXXX` | Software Engineer | Senior | EdTech | BSc | 7 skills |
| Resume | `R_XXXXXX` | Marketing Manager | Junior | E-commerce | BSc | 5 skills |
| Job | `J_XXXXXX` | Project Manager | Senior | Retail | — | 3 required skills |
| Match | `J_XXXXXX` | — | — | — | — | 30 resume IDs |

## 8. Kết luận kiểm tra

| Hạng mục | Status | Ghi chú |
|---|---|---|
| File tồn tại/đọc được/hash | PASS | Khớp artifact công khai |
| Row count/schema | PASS | Đọc toàn bộ bằng DuckDB |
| Null/empty | PASS | Không phát hiện |
| Unique IDs/full-row duplicates | PASS | Không phát hiện duplicate |
| Duplicate skills/list elements | PASS | Không phát hiện sau normalize cơ bản |
| Referential integrity | PASS | Không có orphan |
| Duplicate match pairs | PASS | 75,000/75,000 distinct |
| Ground-truth coverage | WARN | 29 resumes không được tham chiếu |
| Text diversity | WARN | Bullet/responsibility/requirement arrays lặp hoàn toàn |
| Application semantics | NOT APPLICABLE | Source không chứa Application |
| Full resume scoring | BLOCKED | Thiếu rule định lượng và một số source fields |

## 9. Rủi ro và giới hạn

1. Dataset synthetic và cân bằng có chủ đích; không đại diện cho bias, thiếu dữ liệu và noise của tuyển dụng thực tế.
2. Ground truth được xây theo skill overlap, nên dùng nó để đánh giá chính thuật toán skill-based có thể gây leakage/circular evaluation.
3. `experience_bullets`, `responsibilities` và `requirements` gần như không có sức phân biệt.
4. Resume không có name, email, user, company history, school, major, projects, certificates, languages hoặc CV file.
5. Job không có company, department, recruiter, location, salary, deadline, status hoặc employment type.
6. Source không đủ để tính ba score component ngoài skill theo thiết kế Phase 3.
7. 29 resume không có ground-truth relation; không được loại khỏi Candidate import chỉ vì thiếu match.
8. `data/` và báo cáo Phase 3 hiện là untracked files. Cần quyết định chính sách artifact và cập nhật `.gitignore` trong một task được phép; DATA-01 không sửa `.gitignore`.

## 10. Điều kiện dùng cho giai đoạn sau

- Luôn kiểm lại hash trước ETL.
- Reject snapshot nếu schema, ID format hoặc hash thay đổi mà chưa review.
- Không thêm skill vào Candidate nguồn.
- Không chuyển matching row/pair thành Application.
- Không dùng ground truth làm RecruiHub `total_score`.
- Lưu source ID và provenance trong document đích.
- Chỉ tạo `resume_analysis` hoàn chỉnh sau khi business owner phê duyệt rule cho cả bốn component score.

## 11. Truy vấn kiểm chứng đại diện

```sql
-- Duplicate source IDs
SELECT resume_id, count(*)
FROM read_parquet('data/raw/candidate-matching-synthetic/resumes.parquet')
GROUP BY resume_id
HAVING count(*) > 1;

-- Duplicate and orphan pairs
WITH pairs AS (
  SELECT m.job_id, resume_id
  FROM read_parquet('data/raw/candidate-matching-synthetic/matches.parquet') m,
       unnest(m.relevant_resume_ids) t(resume_id)
)
SELECT job_id, resume_id, count(*)
FROM pairs
GROUP BY job_id, resume_id
HAVING count(*) > 1;

-- Duplicate normalized skill inside a resume
SELECT resume_id, lower(trim(skill)) AS normalized_skill, count(*)
FROM read_parquet('data/raw/candidate-matching-synthetic/resumes.parquet'),
     unnest(skills) t(skill)
GROUP BY resume_id, normalized_skill
HAVING count(*) > 1;
```

## 12. Liên kết scale plan và blockers

`dataset-mapping.md` định nghĩa riêng hai chế độ **Demo** và **Full**, gồm mục tiêu document count, cách chọn mẫu deterministic, giới hạn Application/Interview và chỉ số tài nguyên cần đo. Baseline tối đa đã kiểm chứng cho hai chế độ là 10,000 Candidate nguồn và 2,500 Job nguồn.

Các blocker chuyển sang DATA-02 gồm quantitative rules cho ba score component còn thiếu, schema cho profile partial, transition matrix và nghĩa của `Application.status`. Các blocker này không làm mất hiệu lực của audit nguồn nhưng ngăn việc báo PASS cho `resume_analysis` hoàn chỉnh.
