# Báo cáo audit UC01 — Đăng ký Recruiter và tích hợp Company/Department

**Ngày:** 2026-10-26 (Asia/Saigon)  
**Phạm vi:** audit read-only Register → Auth → Company/Department → Recruiter → Job; đọc CouchDB bằng GET và chạy test cô lập dùng mock/in-memory.  
**Trạng thái:** Hoàn tất audit; không sửa source, `.env`, test data hoặc CouchDB.

## A. Root Cause

### Vì sao Recruiter bị khóa

- Frontend [Register.jsx](../../../frontend/src/pages/Register.jsx#L32) chỉ bật lựa chọn Recruiter khi `import.meta.env.VITE_RECRUITER_REGISTRATION_ENABLED === 'true'`. Khi cờ tắt, input role bị `disabled` và hiện “Đăng ký hiện chưa được bật” ([Register.jsx](../../../frontend/src/pages/Register.jsx#L115)). Đây là cờ build/runtime của Frontend, không đọc trạng thái từ API.
- Backend có cờ riêng `PUBLIC_RECRUITER_REGISTRATION_ENABLED`. Khi không bằng chuỗi `true`, `POST /api/v1/auth/register/recruiter` trả 404 `RECRUITER_REGISTRATION_DISABLED` ([auth.routes.js](../../../backend/src/routes/auth.routes.js#L45), [auth.routes.js](../../../backend/src/routes/auth.routes.js#L64)). API tìm Company và Department cũng dùng cùng cờ và trả 404 ([organization-lookup.routes.js](../../../backend/src/routes/organization-lookup.routes.js#L20)).
- Ví dụ cấu hình để cả hai cờ là `false`: [.env.example](../../../.env.example#L16), [frontend/.env.example](../../../frontend/.env.example#L9). Trong root `.env` hiện tại không khai báo cờ Backend; mặc định source là tắt. `frontend/.env.local` không khai báo cờ Frontend; mặc định UI cũng là tắt. Runtime GET `/api/v1/companies?search=cyber` trên Backend 5011 trả 404, xác nhận directory route đang bị gate. Không gửi POST đăng ký.
- Hai cờ không đồng bộ tự động. Bật riêng Frontend sẽ làm UI cho chọn Recruiter nhưng API vẫn từ chối; bật riêng Backend có thể mở endpoint lookup nhưng UI vẫn khóa. Cần cấu hình cả hai sau khi có quyết định nghiệp vụ và bảo vệ tổ chức.

### Backend đã hỗ trợ tới đâu

- Route đăng ký, request Zod, AuthService và repositories đều đã có. Payload hiện tại là `{ email, password, company_id, department_id }`; schema strict không nhận role, Company/Department do client tự khai hoặc các trường dư ([auth-request.schema.js](../../../backend/src/schemas/auth-request.schema.js#L38)).
- Service chỉ nhận Company/Department **đã tồn tại**, kiểm tra cả hai schema và kiểm tra `department.company_id === company_id`; không tạo Company hoặc Department ([auth.service.js](../../../backend/src/services/auth.service.js#L160)).
- Sau khi tạo User và Recruiter, service đổi User từ `RESET_REQUIRED` sang `ACTIVE` rồi xác minh lại quan hệ. Login tạo danh tính role `RECRUITER`; nếu profile hoặc liên kết không đầy đủ, đăng nhập/token bị từ chối.
- Không có transaction CouchDB đa document. Nếu tạo Recruiter hoặc kích hoạt User lỗi sau khi User được ghi, service trả `REGISTRATION_INCOMPLETE` kèm reference/document IDs; không tự xóa hoặc retry. Tài liệu yêu cầu operator reconciliation.

### Nguyên nhân thiết kế và lệch contract

- Feature gate là **chủ ý**, không phải bằng chứng thiếu Company hay thiếu API. [TV1_AUTH_MODULE_CONTRACT.md](../../shared/TV1_AUTH_MODULE_CONTRACT.md#L11) và [DR-019](../../shared/TECHNICAL_DECISION_REGISTER.md#L75) nói quyết định public Recruiter signup còn **PENDING**; flags phải giữ tắt đến khi Auth/product approval, xác nhận TV2 về ownership/scope và recovery runbook được chấp nhận.
- Tuy nhiên implementation hiện tại **không khớp proposal được ghi nhận**: proposal mô tả người đăng ký khai Company/Department mới, không được gắn vào Company có sẵn; source hiện tại cho chọn Company/Department có sẵn. Việc gắn vào tổ chức có sẵn chưa có quy trình membership approval/invite.
- Vì vậy, chỉ đổi hai cờ không đủ và không an toàn. Một người chưa được xác minh có thể chọn Company/Department hợp lệ, được tạo Recruiter profile và User `ACTIVE`. JobService sau đó tin vào quan hệ Recruiter→Company→Department; Recruiter có thể tạo/quản lý Job thuộc scope của chính mình. Ownership guard vẫn chặn quản lý Job do Recruiter khác sở hữu, nhưng không chứng minh người đăng ký được Company cho phép tham gia.

## B. Existing Company/Organization

### Module hiện có

- Trong schema, repository và API, tên chuẩn là **Company** và **Department**; không có document type `organization` riêng. Recruiter giữ `company_id` và `department_id`.
- Company schema hiện có: `_id`, `type`, `name`, `industry`, tùy chọn `logo_url`, `logo_asset`, `description`, `website`, `address`, `created_at`, `updated_at`, `provenance`. Strict schema **không có trạng thái ACTIVE/INACTIVE**.
- Department schema có `_id`, `type`, `company_id`, `name`, `key`, timestamps, provenance; cũng **không có trạng thái**.
- Recruiter schema có `user_id`, `company_id`, `department_id`, tùy chọn hồ sơ liên hệ, timestamps và provenance. Không có trường membership status, invite, Company owner/admin hoặc approval.
- Module sẵn có gồm [organization.repository.js](../../../backend/src/repositories/organization.repository.js), [organization-lookup.service.js](../../../backend/src/services/organization-lookup.service.js), [organization-lookup.routes.js](../../../backend/src/routes/organization-lookup.routes.js), cùng selector ở [RecruiterRegistrationFields.jsx](../../../frontend/src/components/auth/RecruiterRegistrationFields.jsx).

### Dữ liệu CouchDB — GET only

Target được kiểm tra: CouchDB host `127.0.0.1`, database `recruitment_db`. Auth, Company/Department, Recruiter và Job hiện cùng database; cấu hình runtime `AUTH_COUCHDB_DATABASE` và `COUCHDB_DATABASE` đều là `recruitment_db`. `getAuthDatabaseConfig` từ chối hai tên DB khác nhau. Không có sao chép tổ chức giữa DB.

| Document/kiểm tra | Tổng | Hợp lệ/liên kết |
|---|---:|---:|
| Company | 50 | 50 qua Company Zod; 0 nhóm tên trùng sau chuẩn hóa; tất cả 50 có ít nhất một Department |
| Department | 150 | 150 qua schema; cả 150 trỏ tới Company hợp lệ |
| Recruiter profile | 150 | 150 qua schema và cross-document scope; hiện có 1 User role Recruiter ở trạng thái `ACTIVE` |
| User | 10.152 | 10.152 qua User Zod |
| Tổng CouchDB | 25.765 | GET database health |

Không có cột trạng thái Company/Department trong schema để xác định đơn vị đang nhận thành viên; theo lookup hiện tại, mọi Company hợp lệ đều sẽ có thể được trả về nếu bật gate. Không đưa tên, email hoặc ID cá nhân vào báo cáo.

### API và index

- API đã tồn tại: `GET /api/v1/companies?search=<2–100 ký tự>` trả tối đa 10 Company; `GET /api/v1/companies/:companyId/departments` trả tối đa 1.000 Department thuộc Company. Hai route không yêu cầu JWT; việc bật/tắt public lookup dùng Backend feature flag.
- DTO đã được giới hạn an toàn: Company `{id, name, industry}`, Department `{id, name}`. Không trả document thô, website, địa chỉ, ghi chú, logo, hồ sơ Recruiter hay User.
- GET API xác nhận route hiện trả 404 do flag off. Chưa thể xác minh response sau khi bật trên runtime mà không đổi cờ.
- `searchByName` và `listByCompanyId` quét ID prefix qua `_all_docs`; dữ liệu hiện nhỏ (50/150). Chúng không cần Mango index Company/Department. Snapshot có 11 design document và 9 Mango index (endpoint `_index` liệt kê thêm `_all_docs` hệ thống); có các design/index cho Job, Application, profile và admin. Không tạo/sửa index.

## C. Registration Gap Analysis

| Thành phần | Hiện trạng | Thiếu gì | Người phụ trách |
|---|---|---|---|
| Register UI | Candidate hoạt động; Recruiter role bị disabled bằng `VITE_RECRUITER_REGISTRATION_ENABLED`. Có form Company/Department. | Quyết định membership hợp lệ; đồng bộ cờ và trạng thái UI. | TV1 |
| Auth API | `POST /auth/register/recruiter` có route và strict schema; flag off trả 404. | Chốt public vs invite/approval; cập nhật contract/test đang cũ. | TV1/Auth + product |
| Company Selector | Component tìm Company debounce 300 ms, tối thiểu 2 ký tự; load Department sau chọn; loading/error/empty state có sẵn. | Cần bật lookup có kiểm soát và chỉ trả tổ chức cho phép tham gia. | TV1 |
| Company Repository | Đã có schema, prefix search và normalized duplicate helper. 50/50 Company hợp lệ. | Không thiếu repository; chưa có active/eligible/membership policy. | Owner hiện tại của Company; TV1/Auth phối hợp |
| Department Repository | Đã lọc theo `company_id`; 150/150 Department liên kết hợp lệ. | Cần định nghĩa có Company nào cho phép đăng ký và chính sách không có Department. Hiện schema bắt buộc Department. | Owner hiện tại của Company; TV1/Auth phối hợp |
| Recruiter Profile | Bắt buộc refs User/Company/Department; 150/150 scope hiện có hợp lệ. Service hiện tạo Recruiter và active User ngay. | Membership approval/invite; tránh cấp quyền chỉ dựa vào lựa chọn ID. | TV1/Auth; TV2 xác nhận scope |
| JWT/RBAC | Login dùng User active; `/auth/me` xác thực token; ProtectedRoute kiểm tra role. | Không thiếu role guard; cần xác minh sau khi registration được phê duyệt. | TV1 |
| Job Integration | TV2 `JobService.context` kiểm tra User ACTIVE/RECRUITER, một Recruiter profile và liên kết Company–Department; Job route yêu cầu RECRUITER, quyền theo owner/scope. | Không cần sửa JobService trong audit; kiểm thử sau khi có luồng membership hợp lệ. | TV2 |

## D. Security & Business Rules

- **Chọn Company tùy ý:** đây là lỗ hổng nghiệp vụ tiềm tàng nếu mở public signup như source hiện tại. Lookup chỉ giúp chọn ID hợp lệ, không xác thực quan hệ người đăng ký với Company. Việc kiểm tra schema/`department.company_id` ngăn tham chiếu giả hoặc lệch Company, nhưng không chứng minh quyền tham gia.
- **Dữ liệu lookup public:** DTO chỉ gồm ID/tên/ngành và ID/tên Department; rủi ro PII thấp. Tuy nhiên, khi bật flag, endpoint chưa có JWT và có thể dò tên tổ chức theo chuỗi tìm kiếm; cân nhắc rate limit và chỉ trả Company được phép nhận signup.
- **Membership:** chưa có invite, email domain verification, Company Admin approval hay membership document. `ACTIVE` được cấp ngay sau tạo User/Recruiter. Cần quyết định chính thức trước khi bật. Phương án an toàn là one-time invite/approval gắn Company+Department, hoặc một luồng admin duyệt trước khi kích hoạt; không tự coi việc chọn tên công ty là quyền đại diện.
- **Department:** server tự load và xác nhận Department thuộc Company; nếu không có Department thì hiện không thể đăng ký vì `department_id` bắt buộc. Không tự tạo phòng ban.
- **Job permissions:** JobService nhận scope từ Recruiter đã xác thực, không tin owner/company/department từ payload. Kiểm thử `organization-scope.test.js` bảo vệ missing/mismatched company/department, locked recruiter và ownership. Recruiter mới chỉ được vào dashboard nếu Auth/Recruiter graph đầy đủ; quyền Job thực tế vẫn cần test sau onboarding.
- **Partial failure:** CouchDB không có multi-document transaction ở luồng này. Nếu bước tạo Recruiter hoặc kích hoạt User lỗi, User `RESET_REQUIRED` và/hoặc Recruiter có thể đã tồn tại; API trả `REGISTRATION_INCOMPLETE` với reference, không tự rollback/xóa. Cần runbook operator, chống retry tự động và test từng điểm lỗi.

## E. Implementation Plan — đề xuất, chưa triển khai

| Phase | Thay đổi tối thiểu / API | DB và tests | Owner / rủi ro |
|---|---|---|---|
| 1. Chốt chính sách signup | Cập nhật `TV1_AUTH_MODULE_CONTRACT.md`, `TECHNICAL_DECISION_REGISTER.md`, business rules: new Company hay existing Company; public, invite hay approval; ai được phép đại diện; status/account recovery. | Không DB write. Test cases và acceptance contract được duyệt trước. | Product/Auth + TV2; blocker hiện tại. Rủi ro: quyết định cũ cấm existing Company attachment. |
| 2. Load Company có sẵn | Tái sử dụng `organizationApi.js`, selector và `GET /companies`, `GET /companies/:id/departments`; bổ sung điều kiện eligible/rate limit chỉ nếu policy yêu cầu. Đồng bộ hai flag qua môi trường dev sau approval. | Company/Department hiện cùng `recruitment_db`; test lookup DTO, pagination/limit, no sensitive fields, unknown/ineligible Company, Department mismatch. Chưa cần index cho prefix scans ở quy mô hiện tại. | TV1 + owner Company. Rủi ro enumeration và chưa có trạng thái eligibility. |
| 3. Hoàn thiện Registration Backend | Giữ `POST /auth/register/recruiter` nhưng nhận invite/approval proof nếu chọn existing Company. Cập nhật schema/service/recovery flow; không tạo Company/Department ngoài chính sách. | Test duplicate email, invalid/forged IDs, wrong Company Department, no department, already registered, unauthorized membership, failure sau từng document write và operator reconciliation. Integration POST chỉ sau phê duyệt trên DB cô lập. | TV1/Auth; TV2 review ownership. Rủi ro partial write và cấp quyền sai. |
| 4. Login/JWT/Dashboard | Tái sử dụng `/auth/login`, `/auth/me`, AuthContext, `ProtectedRoute` và recruiter route. Chỉ phát token/active account khi graph và membership đã được xác minh. | Mock tests register→login→me→role route; không cần schema DB mới nếu policy dùng invite hiện có. Nếu thêm membership doc/status thì cần schema và kế hoạch migration được duyệt. | TV1. Rủi ro activation trước approval. |
| 5. Job Integration | Không sửa JobService theo audit này. Sau onboarding đã được chấp thuận, kiểm tra tạo Job DRAFT, Import/Export thuộc Recruiter và không truy cập Job của người khác. | Dùng `recruithub_import_export_test`/DB được duyệt cho các POST; test ownership và không xuất hiện public khi DRAFT. Không ghi vào `recruitment_db` trong audit. | TV2 + TV1; rủi ro scope từ identity mới. |
| 6. Regression & UC01 handoff | Sửa test fixtures đang dùng contract cũ; thêm E2E có approval/invite và cập nhật UC01 handoff/runbook. | Unit/mock trước; integration chỉ trên DB cô lập được duyệt; browser acceptance sau khi có môi trường. | TV1 + TV2. Rủi ro test hiện tại không đại diện API source. |

## F. Final Conclusion

1. Recruiter registration hiện bị khóa **có chủ ý bằng hai feature flag**, theo tài liệu vì quyết định Auth/product, TV2 ownership và recovery policy còn pending. Đồng thời implementation và tài liệu còn lệch contract.
2. Có thể tái sử dụng Company/Department hiện có về mặt schema, repository và lookup: 50 Company, 150 Department, quan hệ hợp lệ. Điều đó không đồng nghĩa người đăng ký được Company cho phép tham gia.
3. Không cần xây Company API mới. API tìm kiếm và Department đã có; hiện bị Backend flag khóa, trả DTO an toàn, giới hạn 10 Company/1.000 Department.
4. Không cần sửa JobService TV2 theo source hiện tại; guard scope đã tồn tại và 8/8 bài organization-scope PASS.
5. Chỉ bật flag **không đủ**. Việc đó mở Company lookup và registration nhưng không bổ sung xác minh membership; source sẽ kích hoạt User ngay sau khi tạo quan hệ.
6. Cần tối thiểu: phê duyệt policy existing-company membership/invite/approval; đồng bộ docs và DTO/tests; bảo vệ eligibility ở Backend, không chỉ UI; bật đồng thời flags ở môi trường được phép; chạy registration→login/JWT→Dashboard→Job create/import/export trên DB cô lập trước. Chỉ sau nghiệm thu và runbook mới xem xét môi trường thật.

### Kiểm thử và giới hạn bằng chứng

- Frontend `tests/auth/auth-ui.test.jsx`: **16/16 PASS** (mock/component).
- Backend `tests/recruitment/organization-scope.test.js`: **8/8 PASS** (in-memory).
- Backend `tests/auth-foundation/auth-routes.test.js`: **3/4 PASS**; một test enabled path vẫn gửi DTO Company/Department lồng nhau thay vì schema source hiện tại (`company_id`, `department_id`) nên nhận 400 thay vì kỳ vọng 201.
- Backend `tests/auth-foundation/recruiter-registration.test.js`: **1/7 PASS**; 6 bài còn lại tạo payload cũ chứa `company`/`department` mới, trong khi source yêu cầu IDs của tài liệu sẵn có; vì vậy nhận `ORGANIZATION_NOT_SUPPORTED`. Đây là test/contract drift, không phải bằng chứng DB thiếu Company.
- GET health, lookup gates, CouchDB counts, schemas, design docs và `_index` được kiểm tra. Không gửi POST tới API thật; không tạo User/Recruiter/Company; không thay đổi index/view, `.env`, staged/unstaged source hoặc database.
- Không có browser automation surface trong phiên. UI runtime được đối chiếu source/env và GET, nhưng browser signup flow chưa được xác minh.

## G. Cập nhật sau audit — bật tự gia nhập local

**Quyết định người dùng:** tự gia nhập ngay vào Company/Department đã chọn. Đây là quyết định triển khai cho môi trường local; không tự đổi trạng thái phê duyệt nhóm trong DR-019.

- Đặt `PUBLIC_RECRUITER_REGISTRATION_ENABLED=true` trong root `.env` và `VITE_RECRUITER_REGISTRATION_ENABLED=true` trong `frontend/.env.local`. Cả hai là cấu hình local không tracked; `.env.example` vẫn giữ mặc định an toàn.
- Vite được cập nhật để dùng thư mục `frontend` làm `envDir`, tránh phụ thuộc thư mục chạy lệnh khi nạp flag. Backend mới nạp lại trên `127.0.0.1:5011`; URL UI/API giữ `http://127.0.0.1:5178`.
- Qua proxy 5178, GET Company lookup trả 200, 5 kết quả cho truy vấn kiểm tra và chỉ có field `id,name,industry`; GET Department cho một Company trả 200, 3 kết quả và chỉ có `id,name`.
- Module Register được xác minh dùng Vite flag `true` bằng một probe module tạm; file probe đã được xóa. GET health xác nhận vẫn là `recruitment_db`, 25.765 documents.
- Không gửi POST đăng ký, không tạo User/Recruiter/Company/Department/Job và không thay đổi CouchDB. Do đó luồng signup đăng nhập thật vẫn chưa được E2E xác minh. Backend route và UI đang mở; người dùng có thể đăng ký thật qua giao diện local.
- Khi dùng luồng này, đăng ký thành công sẽ tạo User role `RECRUITER` và Recruiter profile liên kết Company/Department đã chọn, sau đó kích hoạt User ngay. Đây là quyền tự gia nhập mà người dùng vừa chọn; không phải quy trình được duyệt chung/production. Cấu hình Auth hiện cho phép ghi `recruitment_db`, nên đăng ký thật tiếp theo sẽ ghi vào database này.

