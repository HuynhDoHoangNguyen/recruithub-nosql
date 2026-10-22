# DATA-01 — Dataset to CouchDB Mapping

## 1. Mục tiêu và nguyên tắc

Tài liệu này thiết kế mapping từ ba file Parquet đã audit sang document model Phase 3 của `recruitment_db`. Đây là kế hoạch; DATA-01 không tạo JSON seed, script ETL, index hoặc document CouchDB.

Các nguyên tắc bắt buộc:

- Chỉ có 9 business document types: `user`, `candidate`, `recruiter`, `company`, `department`, `job`, `application`, `interview`, `resume_analysis`.
- `matches.parquet` là ground truth retrieval, không phải Application.
- `total_score` phải do thuật toán RecruiHub tính, không lấy từ ground truth.
- Không tự thêm skill, lịch sử việc làm, project hoặc PII thật vào Resume nguồn.
- Document có `_id`, `type`, business fields và provenance phù hợp.
- Stable IDs và deterministic generation phải cho kết quả giống nhau khi chạy lại cùng version/seed/input.
- `_rev` do CouchDB quản lý, không xuất phát từ dataset và không được hardcode trong ETL artifact.

## 2. Phân loại field

| Nhãn | Ý nghĩa |
|---|---|
| `source` | Sao chép từ source, chỉ đổi container/field name mà không đổi nghĩa |
| `normalized` | Chuẩn hóa có thể đảo/giải thích được: trim, lowercase, enum/canonical alias |
| `derived` | Tính xác định từ source bằng rule đã công bố, ví dụ năm × 12 |
| `synthetic` | Sinh thêm bằng generator, seed và rule có version |
| `unavailable` | Không có nguồn hoặc chưa có rule được phê duyệt; không được bịa |

Mỗi field synthetic/derived phải có rule trong transform manifest. Không dùng nhãn `derived` để che một giả định nghiệp vụ chưa được duyệt.

## 3. Stable ID và idempotency

### 3.1. ID cho source-backed documents

Giữ source ID trong namespace riêng:

| Document | `_id` đề xuất | Natural key |
|---|---|---|
| Candidate | `candidate:cms:R_000000` | `dataset + resume_id` |
| Job | `job:cms:J_000000` | `dataset + job_id` |

`cms` là namespace của `candidate-matching-synthetic`, tránh va chạm nếu sau này thêm nguồn khác. Không dùng row number vì thứ tự Parquet có thể thay đổi.

### 3.2. ID cho synthetic documents

Dùng canonical natural key và SHA-256:

```text
digest = first_24_hex(
  SHA256("recruithub:data:v1|" + entity_type + "|" + canonical_natural_key)
)
```

| Document | `_id` đề xuất | Canonical natural key |
|---|---|---|
| User của Candidate | `user:syn:<digest>` | candidate `_id` |
| Company | `company:syn:<digest>` | seed + industry + company ordinal |
| Department | `department:syn:<digest>` | company `_id` + department key |
| Recruiter | `recruiter:syn:<digest>` | user `_id` + company/department |
| Application | `application:syn:<digest>` | candidate `_id` + job `_id` + scenario ordinal |
| Interview | `interview:syn:<digest>` | application `_id` + round number |
| Resume analysis | `analysis:<application_id>` | application `_id`, theo Phase 3 |

Hash input phải được UTF-8 encode, dùng delimiter cố định và canonical casing. Nếu một Candidate không được phép có hai active applications cho cùng Job, `scenario ordinal` phải cố định là `1`; application lịch sử bổ sung chỉ được tạo khi rule duplicate/terminal state cho phép.

### 3.3. Rerun và `_rev`

- Default cho seed mới: create-only với stable `_id`.
- Nếu `_id` đã tồn tại, đọc document và so `provenance.transform_version` cùng `content_hash`.
- Identical content: skip và ghi nhận `unchanged`.
- Khác content: chỉ update trong mode được phê duyệt, lấy `_rev` hiện hành trước khi ghi.
- Khi gặp `409 Conflict`, không blind retry: đọc revision mới, kiểm tra business state, rồi skip/retry có giới hạn hoặc báo conflict.

## 4. Provenance chuẩn

Source-backed document:

```json
{
  "provenance": {
    "source_dataset": "michaelozon/candidate-matching-synthetic",
    "source_version": "v1.0.0",
    "source_file": "resumes.parquet",
    "source_sha256": "<verified-sha256>",
    "source_id": "R_000000",
    "classification": "source",
    "transform_version": "<DATA-02-version>",
    "generated": false
  }
}
```

Synthetic document:

```json
{
  "provenance": {
    "source_dataset": "recruithub-synthetic",
    "classification": "synthetic",
    "generator_version": "<DATA-03-version>",
    "seed": "recruithub:data:v1:20261021",
    "source_document_ids": ["candidate:cms:R_000000", "job:cms:J_000000"],
    "generated": true
  }
}
```

Không lưu đường dẫn máy cá nhân, credentials hoặc `_rev` trong provenance.

## 5. Mapping cho 9 document types

### 5.1. `candidate`

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| `resume_id` | `_id` | normalized | Prefix `candidate:cms:` | Stable source-backed ID |
| — | `type` | derived | Constant `candidate` | Required discriminator |
| `resume_id` | `source_resume_id` | source | Copy | Hỗ trợ trace/debug |
| — | `user_id` | synthetic | Reference deterministic Candidate User | Phải tồn tại trước Candidate |
| `role` | `profile.role` | source | Trim only | Không đổi nghĩa |
| `seniority` | `profile.seniority` | normalized | Enum `JUNIOR/MID/SENIOR` | Giữ raw value trong provenance nếu cần |
| `years_experience` | `profile.years_experience` | source | Copy integer | 0–12 trong snapshot |
| `years_experience` | `profile.experience_months` | derived | `years_experience * 12` | Chỉ là tổng thời lượng, không phải job history |
| `industry` | `profile.industry` | normalized | Trim; canonical enum/slug | Không suy ra company |
| `education` | `education[0].degree` | normalized | Map degree enum có bảng rõ ràng | `school`, `major`, dates unavailable |
| `skills[]` | `skills[].name` | source | Copy từng phần tử | Không thêm skill |
| `skills[]` | `skills[].normalized` | normalized | Lowercase, trim, collapse whitespace, alias table có version | Không invent level/years |
| `summary` | `summary` | source | Copy | Text synthetic/template-based |
| `experience_bullets[]` | `experience_summary.bullets[]` | source | Copy | Không biến thành nhiều employment records |
| — | `experience[]` chi tiết | unavailable | Không tạo company/title/date giả từ bullets | Phase 3 cần schema cho partial experience |
| — | `projects[]` | unavailable | Empty/omitted theo schema policy | Không dùng bullets làm project |
| — | `certificates[]`, `languages[]` | unavailable | Empty/omitted | Không có source |
| — | `full_name`, `email`, `phone` | synthetic/unavailable | Chỉ sinh nếu demo bắt buộc; dùng dữ liệu rõ ràng là giả | Email dùng `example.invalid`; không sinh phone nếu không cần |
| — | `cv_url`/attachment | unavailable | Không tạo fake file reference | Source không có CV file |
| Source metadata | `provenance` | derived | Theo mục 4 | Bắt buộc |

Quyết định cần khóa trong DATA-02: Candidate schema phải cho phép `experience_summary` và education partial; không ép ETL bịa `company`, `school` hoặc `major` chỉ để thỏa một sample document.

### 5.2. `job`

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| `job_id` | `_id` | normalized | Prefix `job:cms:` | Stable |
| — | `type` | derived | Constant `job` | Required |
| `job_id` | `source_job_id` | source | Copy | Traceability |
| `job_title` | `title` | source | Trim only | 24 titles |
| `seniority` | `seniority` | normalized | Enum | Không tự suy ra experience threshold |
| `industry` | `industry` | normalized | Canonical enum/slug | Nguồn trực tiếp |
| `must_have_skills[]` | `required_skills[]` | normalized | Normalize/deduplicate preserving order | Không thêm skill |
| `nice_to_have_skills[]` | `optional_skills[]` | normalized | Normalize/deduplicate preserving order | Không trộn với required |
| `description` | `description` | source | Copy | Có template repetition |
| `responsibilities[]` | `responsibilities[]` | source | Copy | Cùng một array cho toàn bộ Jobs |
| `requirements[]` | `requirements[]` | source | Copy | Cùng một array cho toàn bộ Jobs |
| — | `company`, `department`, `recruiter_id` | synthetic | Deterministic references | Referenced docs phải tạo trước |
| — | `experience_required_months` | unavailable | Chờ business rule | Không suy ra tự động từ seniority trong DATA-01 |
| — | `education_requirement`, `project_requirement` | unavailable | Chờ source/rule | Block component scores tương ứng |
| — | `salary`, `location`, `employment_type` | synthetic | Generator có enum/range và provenance | Không gắn nhãn source |
| — | `status`, `deadline`, timestamps | synthetic | Sinh nhất quán với scenario clock | Job dùng cho Application phải OPEN và chưa quá deadline tại `applied_at` |
| Source metadata | `provenance` | derived | Theo mục 4 | Bắt buộc |

### 5.3. `user`

Dataset không chứa account. Tất cả field nghiệp vụ của `user` là synthetic, trừ reference tới Candidate/Recruiter đã sinh.

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| Candidate/Recruiter natural key | `_id` | synthetic | Hash strategy mục 3 | Stable |
| — | `type` | derived | Constant `user` | Required |
| Entity scenario | `role` | synthetic | `CANDIDATE`, `RECRUITER`, `ADMIN` | Chỉ ba actor |
| Deterministic digest | `email` | synthetic | `<role>+<digest>@example.invalid` | Không phải email thật |
| — | `display_name` | synthetic | Neutral fictional label | Không dùng tên người thật |
| — | `status` | synthetic | Ví dụ `ACTIVE` theo scenario | Rule có version |
| — | `password_hash` | unavailable | Không seed password cố định dùng chung | Auth provisioning thuộc task riêng; có thể `RESET_REQUIRED` |
| Generator metadata | `provenance` | synthetic | Seed/version/source IDs | Required |

### 5.4. `company`

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| Job `industry` | Company grouping input | derived | Dùng để chọn synthetic organization bucket | Không có company nguồn |
| — | `_id`, `type` | synthetic/derived | Stable hash; `type=company` | Required |
| — | `name` | synthetic | Fictional organization name | Không dùng doanh nghiệp thật |
| Job `industry` | `industry` | normalized | Canonical industry | Chỉ sau khi deterministic job→company assignment |
| — | `description`, `location` | synthetic/unavailable | Chỉ sinh nếu use case cần | Gắn provenance synthetic |
| Generator metadata | `provenance` | synthetic | Seed/version | Required |

Một Job được gán đúng một Company synthetic; một Company chỉ nhận Job cùng industry trừ khi generator có rule multi-industry được phê duyệt.

### 5.5. `department`

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| Company + job family | `_id` | synthetic | Stable hash | Không có source department |
| — | `type` | derived | Constant `department` | Required |
| Company `_id` | `company_id` | synthetic reference | Copy existing ID | Không orphan |
| Job role family | `name`/`key` | derived + synthetic label | Deterministic role-family mapping | Mapping table phải versioned |
| Generator metadata | `provenance` | synthetic | Seed/version/source IDs | Required |

### 5.6. `recruiter`

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| Company/department assignment | `_id` | synthetic | Stable hash | Không có recruiter nguồn |
| — | `type` | derived | Constant `recruiter` | Required |
| Synthetic Recruiter User | `user_id` | synthetic reference | Existing `user` | One-to-one |
| Synthetic Company | `company_id` | synthetic reference | Existing `company` | Required |
| Synthetic Department | `department_id` | synthetic reference | Existing `department` | Required |
| Assigned Jobs | `scope` hoặc query relation | synthetic/derived | Prefer Job `recruiter_id`; không embed danh sách lớn nếu không cần | Tránh hai nguồn chuẩn |
| Generator metadata | `provenance` | synthetic | Seed/version | Required |

### 5.7. `application`

Không có direct mapping từ `matches.parquet` sang `application`.

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| Candidate + Job được chọn bởi scenario generator | `_id` | synthetic | Stable hash | Không dùng match row làm application ID |
| — | `type` | derived | Constant `application` | Required |
| Existing Candidate | `candidate_id` | synthetic relation | Reference | Validate existence |
| Existing Job | `job_id` | synthetic relation | Reference | Validate existence/status/deadline |
| Scenario state | `current_stage` | synthetic | Theo transition graph | Không nhận stage tùy ý |
| Scenario events | `stage_history[]` | synthetic | Monotonic UTC timestamps; actor/time/note | First event luôn `APPLIED` |
| Fixed scenario clock | `applied_at`, `updated_at` | synthetic | Deterministic from seed/key | `updated_at >= applied_at` |
| — | `status` | unavailable/derived | Chỉ thêm sau khi khóa nghĩa so với `current_stage` | Phase 3 nêu rủi ro trùng nghĩa |
| — | `match_score` | unavailable/derived cache | Chỉ cache từ `resume_analysis` sau khi scoring hợp lệ | Ground truth không được ghi vào đây |
| Generator metadata | `provenance` | synthetic | Ghi selection basis | Required |

`matches` có thể được giữ ngoài business documents làm evaluation label hoặc dùng để tạo các strata kiểm thử đã gắn nhãn rõ. Nếu generator chọn một ground-truth pair để tạo Application synthetic, provenance phải ghi `selection_basis=ground_truth_stratum`; điều đó vẫn không biến ground truth thành hành vi ứng tuyển.

### 5.8. `interview`

| Source field | Target field | Class | Transformation | Notes |
|---|---|---|---|---|
| Application + round | `_id` | synthetic | Stable hash | Một Application có nhiều rounds |
| — | `type` | derived | Constant `interview` | Required |
| Existing Application | `application_id` | synthetic reference | Copy | Required |
| Application refs | `candidate_id`, `job_id` | derived snapshot/reference | Copy from Application | Validate consistency |
| Assigned Recruiter | `interviewer_id` | synthetic reference | Existing Recruiter | Không tạo actor thứ tư |
| Scenario | `round`, `interview_type`, `scheduled_at` | synthetic | Deterministic | Chỉ khi pipeline đã đạt Interview |
| Scenario | `score`, `feedback`, `result` | synthetic | Enum/range có version; nullable trước completion | Không dùng ground-truth score |
| Generator metadata | `provenance` | synthetic | Seed/version | Required |

### 5.9. `resume_analysis`

| Input | Target field | Class | Transformation | Status |
|---|---|---|---|---|
| Application ID | `_id` | derived | `analysis:<application_id>` | READY |
| — | `type` | derived | Constant `resume_analysis` | READY |
| Application refs | `application_id`, `candidate_id`, `job_id` | derived | Copy after referential checks | READY |
| Candidate normalized skills + Job required skills | `matched_skills[]` | derived | Set intersection | READY |
| Candidate normalized skills + Job required skills | `missing_skills[]` | derived | Required minus Candidate | READY |
| Matched/required counts | `scores.skill` | derived | `matched / required * 100` | READY; handle zero-required as validation error |
| Experience data + Job threshold | `scores.experience` | unavailable | Phase 3 chưa có quantitative rule và source Job thiếu threshold | **BLOCKED** |
| Education data + Job requirement | `scores.education` | unavailable | Job requirement không có | **BLOCKED** |
| Project data + Job requirement | `scores.project` | unavailable | Candidate/Job project data không có | **BLOCKED** |
| Four approved component scores | `total_score` | derived | `0.50*skill + 0.25*experience + 0.10*education + 0.15*project` | **BLOCKED until all components valid** |
| `total_score` | `recommendation` | derived | HIGH ≥80; MEDIUM ≥60; LOW <60 | Blocked with total |
| Algorithm config | `algorithm_version`, `analyzed_at` | derived/synthetic clock | Versioned config + deterministic timestamp for seed | Required when analysis exists |

Không tạo document `resume_analysis` “hoàn chỉnh” bằng cách gán 0, trung bình hoặc random cho ba component thiếu rule. Có thể chuẩn bị validated analysis input hoặc trạng thái `PENDING_RULES` nếu schema chính thức cho phép; quyết định đó thuộc DATA-02.

## 6. Synthetic generation plan

### 6.1. Determinism

- Seed cố định: `recruithub:data:v1:20261021`.
- Không phụ thuộc system clock hoặc thứ tự row.
- Pseudo-random value cho từng field lấy từ SHA-256 của `seed|entity_type|natural_key|field_name|counter`, rồi map vào range/enum. Cách này ổn định giữa batch order và không đòi hỏi shared mutable RNG.
- Scenario clock gốc đề xuất: `2026-10-21T00:00:00Z`; mọi timestamp là offset deterministic và được lưu UTC ISO-8601.
- Thay đổi rule phải tăng `generator_version`; không âm thầm tái dùng cùng version cho output khác.

### 6.2. Thứ tự sinh để tránh orphan

```text
Company
  └─ Department
      └─ Recruiter User ─ Recruiter
Candidate User ─ Candidate
Company/Department/Recruiter + source Job ─ Job
Candidate + Job ─ Application ─ stage_history
Application + Recruiter ─ Interview
Application + Candidate + Job ─ Resume Analysis Input
```

Mỗi phase ghi manifest IDs đã tạo; phase sau chỉ chọn từ manifest hợp lệ. Trước khi xuất batch, chạy anti-join/in-memory set validation cho mọi reference.

### 6.3. Application và pipeline

Draft transition graph bám flow Phase 3:

```text
APPLIED -> SCREENING -> INTERVIEW -> OFFER -> HIRED
   |           |            |          |
   +---------> REJECTED <----+----------+
   +---------> WITHDRAWN <---+----------+
```

- `HIRED`, `REJECTED`, `WITHDRAWN` là terminal.
- Exact transition matrix và thời điểm được withdraw phải được khóa trong DATA-02 trước khi generator chạy.
- `stage_history[0]` là `APPLIED`, `at == applied_at`, actor là Candidate.
- Các event sau có thời gian tăng nghiêm ngặt; recruiter event tham chiếu Recruiter có scope trên Job.
- `current_stage` bằng stage cuối cùng.
- Job phải `OPEN`, `applied_at <= deadline`, và không có duplicate active Application.
- Không tạo Interview nếu history chưa đạt `INTERVIEW`.

### 6.4. Dữ liệu nhạy cảm

- Dùng domain reserved `example.invalid` cho email.
- Không sinh số điện thoại, địa chỉ nhà hoặc identifier giống giấy tờ thật nếu use case không cần.
- Không seed shared/default password. Account synthetic có thể mang trạng thái `RESET_REQUIRED`; cơ chế auth thuộc task khác.
- Tên Company/User phải được ghi rõ là fictional/synthetic.

## 7. ETL plan cho DATA-02/03/04

DATA-01 chỉ định nghĩa kế hoạch:

1. **Extract:** xác minh path/hash/schema; fail nếu source drift.
2. **Stage in memory:** đọc Parquet, không sửa source.
3. **Validate source:** áp dụng toàn bộ kiểm tra trong `dataset-audit.md`.
4. **Normalize:** ID namespace, enum, skill normalization; lưu raw/source values cần thiết.
5. **Transform base docs:** Candidate và Job; Zod validation trước output.
6. **Generate organization/identity:** Company, Department, User, Recruiter bằng seed/version.
7. **Generate workflow:** Application, stage history và Interview sau referential validation.
8. **Prepare analysis inputs:** matched/missing và skill score; dừng nếu component rules chưa được duyệt.
9. **Cross-document validation:** no orphan, unique `_id`, stage/timestamp consistency, no duplicate active application.
10. **Package batches:** tạo manifest count/hash và content hash; chưa import ở DATA-02/03 nếu scope chưa cho phép.
11. **Import DATA-04:** batch `_bulk_docs`, kiểm tra từng response item, xử lý rerun/conflict có kiểm soát.
12. **Post-import verification:** counts, sample document, query/index/view, reference audit và manifest reconciliation.

## 8. Validation gates

### 8.1. Document-level

- `_id` đúng prefix và unique.
- `type` thuộc 9 loại cho phép.
- Required fields, type, enum và range đúng Zod schema.
- Array không có element null/rỗng/duplicate sau normalize.
- Timestamp ISO-8601 UTC và theo đúng thứ tự.
- Provenance có source hash hoặc generator seed/version.

### 8.2. Cross-document

- Candidate/Recruiter `user_id` tồn tại và đúng role.
- Department thuộc Company; Recruiter thuộc cùng Company/Department của Job.
- Application references tồn tại; Candidate–Job active uniqueness đúng rule.
- Mọi stage actor tồn tại; `current_stage` khớp history cuối.
- Interview references Application và Recruiter hợp lệ; round unique trong Application.
- Analysis references cùng Candidate/Job với Application.
- `analysis:<application_id>` duy nhất.
- Ground truth không xuất hiện trong `total_score` hoặc `match_score`.

### 8.3. Reconciliation

- Candidate source-backed count bằng số resume được chọn theo mode.
- Job source-backed count bằng số job được chọn theo mode.
- Mỗi source ID map đúng một `_id`.
- Output count theo type khớp manifest.
- Rerun cùng input/seed/version tạo cùng ordered content hash sau khi bỏ các field CouchDB-managed.

## 9. Query, index và aggregation plan

Các Mango Index chỉ tạo ở task triển khai database, sau khi query contract được khóa:

| Index đề xuất Phase 3 | Fields | Use case |
|---|---|---|
| `idx_job_status_location` | `type`, `status`, `location` | Job list |
| `idx_application_job_stage` | `type`, `job_id`, `current_stage` | Pipeline theo Job |
| `idx_application_candidate` | `type`, `candidate_id`, `applied_at` | My Applications |
| `idx_analysis_job_score` | `type`, `job_id`, `total_score` | Candidate ranking input |
| `idx_candidate_email` | `type`, `email` | Chỉ giữ nếu email thực sự nằm trên Candidate |

Nếu email canonical nằm ở `user`, thay index cuối bằng index `type,email` trên User; không nhân đôi email chỉ để giữ tên index thiết kế.

MapReduce View phù hợp cho count Application theo `[job_id,current_stage]` và top normalized skills. Backend aggregation vẫn cần cho final ranking vì phải đọc Application validity, loại `WITHDRAWN`, áp dụng tie-break `total_score`, `skill_score`, rồi `applied_at`.

Mọi query có sort phải được kiểm tra bằng `_explain`; ghi `total_docs_examined`, `total_keys_examined`, `results_returned` và `execution_time_ms` thay vì tuyên bố index hiệu quả mà không đo.

## 10. Scale plan

### 10.1. Demo mode

Mục tiêu, không phải count đã import:

- Khoảng 500 Candidate, lấy deterministic stratified sample theo role/seniority/industry.
- Khoảng 100 Job, stratified tương tự và bảo đảm skill coverage.
- Synthetic Company/Department/Recruiter đủ để mọi Job có owner hợp lệ.
- Application count cấu hình theo scenario, dự kiến 800–1,500 để có nhiều stage nhưng vẫn dễ kiểm tra thủ công.
- Interview chỉ cho subset đã đạt `INTERVIEW`, dự kiến 250–500 rounds.
- Có đủ terminal/non-terminal states và HIGH/MEDIUM/LOW chỉ sau khi scoring rules hoàn chỉnh.

Acceptance cho Demo: count manifest khớp, zero orphan, zero duplicate active Application, stage/timestamp hợp lệ và các query demo dùng index dự kiến.

### 10.2. Full mode

- Tối đa 10,000 Candidate và 2,500 Job từ source.
- Không mặc định tạo toàn bộ 25 triệu Candidate–Job combinations.
- Application generator dùng giới hạn cấu hình, ví dụ 2–5 applications/Candidate và cap tổng được review trước khi chạy.
- Interview/analysis chỉ sinh theo Application hợp lệ.
- Chia batch theo type và kích thước serialized; không chỉ theo số document.

### 10.3. Đo hiệu năng và tài nguyên

- Thời gian transform/validation theo type và rows/second.
- Peak process memory và kích thước output JSON.
- Batch size, request latency, success/error/conflict count của `_bulk_docs`.
- CouchDB `doc_count`, `data_size`, `external_size`; dung lượng index/design document.
- Docker CPU/memory/disk trong lúc import và query.
- `_find` execution stats và `_explain` trước/sau index trên cùng dataset/query.
- View build time, reduce result và đối chiếu count thủ công trên sample biết trước.

Ngưỡng tài nguyên cụ thể phải được đo trên máy nhóm; DATA-01 không giả lập con số benchmark.

## 11. Blockers và quyết định cần chốt

1. **BLOCKED:** quantitative rules cho `experience_score`, `education_score`, `project_score`.
2. **BLOCKED:** source thiếu project data và Job education/project requirements.
3. **TO DECIDE:** Candidate schema cho partial education/experience mà không bịa school/company.
4. **TO DECIDE:** nghĩa của `Application.status` so với `current_stage`; khuyến nghị một nguồn chuẩn.
5. **TO DECIDE:** transition matrix cuối cùng và withdraw rules.
6. **TO DECIDE:** email canonical nằm ở User hay Candidate.
7. **TO DECIDE:** có dùng ground-truth labels làm strata kiểm thử hay giữ hoàn toàn ngoài business seed.
8. **REPOSITORY HYGIENE:** `data/` và DOCX đang untracked; cần task riêng quyết định track/LFS/ignore. `.gitignore` chưa được sửa theo scope DATA-01.

Không blocker nào ở trên cho phép thay bằng random score hoặc silently invent source data.

## 12. Đề xuất task tiếp theo

- **DATA-02:** khóa schema Zod, enum, partial-profile policy, stage transition, quantitative scoring rules, stable ID/provenance utilities và source transformation; chưa import.
- **DATA-03:** triển khai deterministic synthetic generator, manifests và validation suites.
- **DATA-04:** tạo database artifacts/index/view, batch import idempotent, conflict handling và kiểm chứng CouchDB.

DATA-01 không triển khai các task này.
