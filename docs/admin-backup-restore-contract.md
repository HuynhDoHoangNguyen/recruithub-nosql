# ADMIN-BR — Hợp đồng sao lưu và khôi phục v1

Ngày: 12/11/2026 (Asia/Bangkok). BR-001: hợp đồng để triển khai, chưa có API/UI hoạt động. Kế hoạch tổng được người dùng duyệt trong chat. Restore luôn sang database mới; không chuyển cấu hình ứng dụng.

## 1. Nguồn và phạm vi

Server xây allowlist từ cấu hình hợp lệ, không cho client gửi host, credentials hay tên nguồn tùy ý. Mỗi nguồn có source_id ổn định và nhãn; deduplicate bằng server URL chuẩn hóa + database. Không trả credentials trong API. Không tự liệt kê tất cả database trên server.

| Nguồn | Tình trạng BR-001 | Chính sách |
|---|---|---|
| business | recruitment_db: 25.750 docs thường + 11 design docs | Đọc qua cấu hình business hợp lệ |
| identity/domain | AUTH_COUCHDB_DATABASE=recruithub_auth_demo khác nguồn business | Disabled khi getAuthDatabaseConfig từ chối; không bypass guard để bật nguồn |
| assets | AssetRepository dùng getAuthDatabaseConfig | Đi cùng identity/domain; không có nguồn asset độc lập |
| audit | Chưa cấu hình AUDIT_COUCHDB_* | Disabled, nêu lý do; không fallback sang business |

Có dữ liệu demo ở database identity không có nghĩa các API identity đang hoạt động. Chỉ một backup business không chứa dữ liệu demo riêng hoặc audit. v1 là backup từng database, không có snapshot nguyên tử nhiều database. UI phải hiển thị rõ phạm vi và nguồn phụ thuộc; không gọi là backup toàn hệ thống.

Bao gồm documents hiện hành, design docs, attachments đầy đủ và định nghĩa JSON Mango indexes. Không backup _local docs, tombstones, revision history, conflicting leaf revisions, built index files, _users, _replicator, _security, secrets môi trường hay cấu hình máy chủ. Có conflict thì fail SOURCE_CONFLICTS, không âm thầm bỏ revision. Gói có password hashes, PII nếu nguồn chứa các trường này; đây không phải file công khai và không được đưa vào Git.

## 2. Định dạng RHBR v1 và độ tin cậy

Chọn gzip NDJSON bằng node:zlib/node:crypto/node:fs, không thêm dependency. Tên tải: recruithub-backup-<UTC timestamp>-<uuid>.rhbr.gz; application/gzip; Content-Disposition attachment. Không dùng tên file client làm đường dẫn.

Record theo thứ tự: một header, các document, một indexes, một footer; mỗi record JSON UTF-8 kết thúc LF, không BOM. Strict envelope; không chấp nhận record lạ hoặc dữ liệu thừa sau footer.

- Header: kind=header, format=recruithub-backup, version=1, backup_id UUID, created_at UTC, source_id, source_database (chỉ nhãn), source_update_seq, scope=single_database_current_state, signing_key_id.
- Document: kind=document, doc. doc có _id duy nhất; bỏ _rev và các metadata revision/conflict, giữ mọi trường nghiệp vụ. _attachments chỉ gồm content_type và data base64 chuẩn, đầy đủ; không chấp nhận stub/follows. Attachment bytes phải khớp độ dài/hash trong manifest footer.
- Indexes: kind=indexes, items là allowlist {ddoc,name,type,index,partitioned}; chỉ type=json; bỏ index special _all_docs. Design doc chứa Mango index được giữ nguyên, không tạo lặp: restore ddoc trước, đối chiếu _index, chỉ tạo index thiếu rồi so định nghĩa. Loại index khác không hỗ trợ phải fail UNSUPPORTED_INDEX.
- Footer: kind=footer, document_count, design_count, counts_by_type, attachment_count, attachment_bytes, attachment_checksums [{document_id,name,size,sha256}], payload_sha256, signature_hmac_sha256. SHA-256 tính trên byte chính xác của mọi dòng trước footer, kể cả LF. HMAC-SHA256 ký chuỗi `RHBR1\n` + payload_sha256 + `\n` + JSON canonical của các trường footer trừ signature; canonical sắp key đệ quy, mảng giữ thứ tự. Ký bao gồm mọi count/checksum, không chỉ digest payload.

Dedicated BACKUP_SIGNING_KEY (>=32 byte ngẫu nhiên) và BACKUP_SIGNING_KEY_ID được cấp ngoài source, không tái sử dụng JWT/CouchDB secret. Thiếu key: feature trả 503 BACKUP_CONFIGURATION_ERROR. Chỉ nhận gói có key ID đang cấu hình và chữ ký hợp lệ; unknown key bị từ chối. Cần giữ key riêng để restore sau mất máy; mất key thì gói v1 không phục hồi được qua UI. v1 không hỗ trợ import JSON tùy ý hoặc key rotation nhiều key. Gzip không mã hóa; UI cảnh báo giữ file ở nơi riêng tư.

Giới hạn v1 cố định, API sources công bố: file nén 128 MiB, giải nén 512 MiB, một dòng 32 MiB, 100.000 documents gồm design docs, tổng attachment bytes 200 MiB, một attachment 10 MiB, tối đa 32 upload/job chưa hết hạn, tổng spool 1 GiB. Chạm giới hạn thì fail rõ, không xuất file thiếu. Đọc/giải nén streaming có bộ đếm, không JSON.parse toàn gói. Validate preflight đủ các giới hạn trước bất kỳ tạo database nào.

## 3. API, quyền và lỗi

Tái sử dụng JWT/Admin guard; kiểm tra role server-side cho mọi endpoint, kể cả status/download. Không token trong URL. Headers Cache-Control: no-store. Job/validation gắn actor ID; chỉ Admin đã tạo được đọc/tải/thực hiện; ID người khác trả 404. Tái xác thực mỗi request, không cho phiên bị khóa tiếp tục tạo/download/restore. Mọi JSON payload/params được Zod validate trước controller. Upload binary dùng route riêng; sau khi parse streaming, envelope cũng validate trước thao tác ghi CouchDB. Không tăng global JSON body limit.

| Endpoint | Request | Success |
|---|---|---|
| GET /api/v1/admin/backups/sources | Không | 200 sources [{id,label,available,reason,scope}], limits |
| POST /api/v1/admin/backups | {source_id} | 202 {job_id,status} |
| GET /api/v1/admin/backups/:id | UUID | 200 job DTO |
| GET /api/v1/admin/backups/:id/download | UUID | 200 binary, chỉ SUCCEEDED chưa hết hạn |
| POST /api/v1/admin/backups/validate | application/octet-stream, gzip bytes | 202 {job_id,status}; poll backup status |
| POST /api/v1/admin/restores | {validation_id,target_database,confirm:true} | 202 {job_id,status} |
| GET /api/v1/admin/restores/:id | UUID | 200 job DTO |

JSON theo envelope successResponse/errorResponse hiện có. Validation job SUCCEEDED có validation_id, source label, counts, size, warnings, expires_at; không trả doc contents/hash password. Job DTO: id,type,status,phase,processed,total nullable,created_at,updated_at,expires_at,result,error {code,message}. Restore result có target, verified counts/digests, indexes_verified và requires_manual_configuration=true. Progress theo docs, upload chưa biết tổng không bịa phần trăm.

Lỗi: 400 INVALID_BACKUP/INVALID_TARGET; 401/403 auth; 404 JOB_NOT_FOUND; 409 JOB_BUSY/TARGET_EXISTS/VALIDATION_USED/SOURCE_CHANGED/SOURCE_CONFLICTS; 410 ARTIFACT_EXPIRED; 413 BACKUP_LIMIT_EXCEEDED; 415 UNSUPPORTED_BACKUP_FORMAT; 422 CHECKSUM_MISMATCH/SIGNATURE_INVALID; 503 BACKUP_CONFIGURATION_ERROR/DATABASE_UNAVAILABLE; lỗi task nền thể hiện ở status FAILED, không đổi HTTP của polling thành 500. Không đưa raw CouchDB response, URL có credentials hay stack vào client/log.

## 4. Tác vụ, nhất quán và lưu trữ

Single backend process v1, một tác vụ nặng toàn cục; request tiếp theo khi đang bận trả 409. Upload cũng giữ slot. Không queue vô hạn, không tự resume writes. Client disable gửi trùng và poll mỗi 2 giây (backoff tối đa 10 giây khi lỗi); giữ job ID trong sessionStorage để xem lại, không lưu token/file. Tắt tab không hủy job.

QUEUED -> RUNNING -> SUCCEEDED hoặc FAILED; artifact hết hạn -> EXPIRED. Phase: EXPORTING/VALIDATING/CREATING/RESTORING/VERIFYING. Validation và export dùng backup status route. Metadata sanitized lưu bền bằng atomic rename; file .partial chưa hoàn tất không được tải. Khi restart: QUEUED/RUNNING -> FAILED/JOB_INTERRUPTED, không tự xóa đích hoặc tiếp tục restore. Startup reconcile trước nhận job mới. Thời hạn job tối đa 10 phút; mỗi CouchDB request có timeout hữu hạn. Abort I/O khi timeout; job FAILED, không báo rollback.

Spool tại os.tmpdir()/recruithub-backups-v1, thư mục con random UUID, kiểm tra path không thoát root, chỉ tài khoản OS backend truy cập (Windows ACL tương đương). Nếu không thiết lập/kiểm tra được quyền hạn chế thì feature unavailable. TTL artifact 24 giờ từ lúc tạo, không gia hạn bằng download; cleanup startup và mỗi 15 phút, không xóa file job đang RUNNING; metadata sanitized giữ 7 ngày. Xóa chỉ đường dẫn do server tạo trong spool, không theo symlink. Mỗi lần start từ chối nhận job nếu quota/disk preflight không đạt. Metadata không lưu credentials, signing key, token, nội dung docs hay tên file người dùng.

Backup: lấy metadata update_seq đầu; đọc _all_docs theo key pages 500 (không skip tăng dần), lấy revision/attachments gắn đúng revision; thu indexes; kiểm tra update_seq cuối bằng so sánh opaque token, không parse số. Nếu khác, fail SOURCE_CHANGED, xóa partial, đề nghị chạy lại lúc ít cập nhật. Không tự retry vô hạn. Bao gồm design changes; không tuyên bố snapshot lịch sử/đa database. Lỗi attachment hoặc conflict làm fail toàn backup.

## 5. Restore và kiểm chứng

1. Validate toàn gói, signature, IDs, counts, hashes, attachment base64, thiết kế/index; không thực thi nội dung design trong bước validate. Không chấp nhận _local, _deleted, _rev hoặc metadata revisions. Chỉ _design namespace là ngoại lệ ID bắt đầu bằng underscore.
2. Xác nhận Admin, validation chưa dùng/hết hạn. Target khớp ^recruithub_restore_[a-z0-9_]{1,64}$. Server URL/credentials lấy từ cấu hình restore của server, không từ gói. Không cho chọn host. Denylist mọi database nguồn đã cấu hình và database hệ thống, kể cả khi nguồn unavailable.
3. Atomic reserve validation_id; không double-submit. HEAD preflight rồi PUT tạo mới; lỗi exists tại PUT vẫn từ chối (xử lý race). Chỉ ghi khi lần tạo này thành công. Không sử dụng database đã tồn tại dù rỗng.
4. Database mới phải có _security admin/member roles=['_admin']; kiểm chứng trước ghi. Môi trường không đảm bảo private từ thời điểm tạo thì từ chối restore. Không nhập _security từ file và không tự tạo quyền cho user ứng dụng.
5. Ghi docs thường trước, design docs sau (tránh validation function trong ddoc cản import), tối đa 200 docs/5 MiB mỗi batch, document lớn hơn batch thì gửi đơn lẻ trong giới hạn record. new_edits mặc định true. Kiểm tra từng kết quả _bulk_docs, không xem HTTP 201 là tất cả thành công. Không blindly retry 409; vì đích mới riêng, conflict là lỗi. Khi mất response, đọc lại ID và so nội dung trước tối đa 3 lần thử có backoff; khác nội dung thì fail, không overwrite.
6. So content canonical theo ID: bỏ metadata CouchDB, so trường nghiệp vụ; attachment so tên/content_type và hash raw bytes thay vì stub/revpos/digest CouchDB. Kiểm tra ID set/count, design docs và JSON index definitions. Dừng ghi từ tác vụ trước verification. Seq đích thay đổi ngoài tác vụ trong verification thì fail, không báo kết quả sạch.
7. Chỉ SUCCEEDED khi mọi kiểm tra đạt. Lỗi giữ đích ở quyền private và result target_incomplete=true, written/verified counts, mã lỗi; không xóa hoặc rollback. Gói validated một lần chỉ tạo một restore; muốn thử lại validate lại và dùng tên đích mới.

MVP là phục hồi dữ liệu để kiểm chứng/demo, chưa gồm cutover, replication, encryption, retention của backup đã tải, index warm-up hoặc vận hành HA. Restore audit không tự chạy worker/pruner. Không tự replay audit outbox hay bật các producer ở database phục hồi.

## 6. Nhật ký và tích hợp

Không mở rộng enum UC26 trong BR-002 một cách ngầm định. Job metadata là lịch sử kỹ thuật tối thiểu (actor ID, nguồn ID, target, timestamp, outcome, counts, error code), không phải cam kết audit delivery UC26. Log fallback đã sanitize; metadata không ghi được thì không nhận/tiếp tục job. Audit viewer integration đầy đủ cần task/hợp đồng riêng. File backup tải về chứa PII; UI cần cảnh báo rõ, không tự hiển thị nội dung.

BR-002 tạo routes/controller/service/schema riêng và mount router vào namespace /api/v1/admin, không sửa core Auth/AdminUser. BR-003 bổ sung validate/restore. BR-004 thêm tab sau ba tab hiện tại. Lỗi login cấu hình và audit provisioning là rollout blockers, không được bypass RBAC để demo.

## 7. Test vectors và điều kiện bàn giao

- RBAC 401/403, Admin owner thành công, Admin khác không đọc job; account khóa/expired token bị chặn.
- Round-trip fixture đủ 9 types, arbitrary fields, design view, JSON index, attachment binary có zero byte/Unicode name; zero-attachment và database rỗng.
- Tamper payload/footer/HMAC, key sai, JSONL thứ tự sai, duplicate ID, unsupported version/index, truncated gzip, decompression bomb, giant line, bad base64, stub, _local/_deleted/_rev: reject trước tạo DB.
- Nguồn đổi seq, conflict hoặc thiếu attachment: export fail và không download partial.
- Existing/protected/invalid target và race tạo DB: không có writes vào đích.
- Batch partial failure, ambiguous response, 409, timeout, process restart: trạng thái FAILED chính xác, không auto overwrite/delete/resume.
- TTL/quota/path traversal/symlink, permission failure, double submit, UI reload/poll/error/empty/loading/success.
- Test tích hợp chỉ database recruithub_restore_test_* với fixture tổng hợp; giữ nguồn production chỉ đọc. BR-005 ghi tài nguyên tạo, tài nguyên dọn theo quyền đã có và kết quả trước/sau.

BR-002 được bắt đầu với test doubles và fixture độc lập; live Admin/UI acceptance cần xử lý riêng cấu hình login. Không thể coi toàn ADMIN-BR hoàn thành ở BR-001.

## 8. Nguồn kỹ thuật

- Source: backend/src/config/{database,auth-database,audit-database}.config.js; repositories/asset.repository.js; services/upload.service.js; routes/auth.routes.js; frontend/src/pages/Dashboard/AdminDashboard.jsx.
- [CouchDB bulk API](https://docs.couchdb.org/en/stable/api/database/bulk-api.html): bulk non-atomic; cần kiểm tra từng row. Thiết kế restore phía trên áp dụng đặc tính này.
- [CouchDB security](https://docs.couchdb.org/en/stable/api/database/security.html): quyền database khác quyền server; đích private dùng reserved _admin, không sao chép ACL nguồn.
- [Document/attachments](https://docs.couchdb.org/en/stable/api/document/common.html) và [Mango](https://docs.couchdb.org/en/stable/api/database/find.html): kiểm tra nội dung attachment và định nghĩa index riêng.

Các giới hạn, format, HMAC và lifecycle là quyết định thiết kế của ADMIN-BR, không phải tính năng đã có của repo hoặc yêu cầu bắt buộc của CouchDB.
