# TV1 UC06 — Job Search, Filter & Pagination

**Ngày:** 2026-10-24  
**Phạm vi:** Public Job Listing (`GET /api/v1/jobs`) và frontend `/jobs`. Chỉ truy vấn dữ liệu Job; không sửa Job creation, update, lifecycle, schema, data, index hay TV2 workflows.

## Kết quả dữ liệu đã xác minh

- `jobDocumentSchema` cho phép `required_skills` và `optional_skills` dưới dạng mảng chuỗi.
- Job có `title`, `industry`, `description`, `responsibilities`, `seniority`, `status`, `deadline` và các timestamp.
- Không có `location` hoặc salary field trong schema strict; CouchDB sample được đọc cũng không có hai trường này. UI vì vậy không tạo filter giả cho địa điểm/lương.
- Request chỉ đọc CouchDB cho thấy `recruitment_db` có 25.750 documents; các mẫu OPEN có skills dạng array. Chỉ mục CouchDB hiện có là `_all_docs`; không có `public_jobs` Mango index. Không tạo index/view và không ghi database.

## Query strategy và giới hạn

Backend dùng built-in `_all_docs` ID range từ `job:` tới `job:\ufff0`, `include_docs=true`, tối đa 100 rows mỗi request. ID range giới hạn việc đọc vào không gian ID Job; service tiếp tục kiểm tra `type === "job"`, chỉ giữ tin `OPEN`, lọc và trả tối đa page size. Cursor opaque Base64URL chứa ID cuối trang và hash filter, nên trang tiếp theo giữ bộ lọc và không trùng/skip do timestamp giống nhau.

Thứ tự là `_id` tăng dần, ổn định khi nhiều tin có cùng timestamp. Không sắp xếp “mới nhất” vì chưa có index phù hợp và không tạo index khi chưa được duyệt. Bộ lọc hiếm kết quả có thể phải duyệt hết dải Job hiện tại (2.500 Job trong dataset), nhưng không tải 25.750 documents hoặc toàn bộ kết quả sang frontend. Đây là fallback tương thích; cần đánh giá lại khi Job collection tăng đáng kể.

Không trả tổng số kết quả vì không tính count chính xác trong truy vấn phân trang. Giao diện chỉ báo số mục trên trang hiện tại.

## API hiện hành

`GET /api/v1/jobs?q=&skills=&industry=&seniority=&limit=&bookmark=`

- `q`: tối đa 120 ký tự; tìm literal, không chạy regex, trên title, industry, description, responsibilities và required/optional skills.
- `skills`: danh sách tối đa 8 kỹ năng, cách nhau bởi dấu phẩy; so khớp chuẩn hóa chính xác, tất cả kỹ năng phải khớp.
- `industry`: so khớp chính xác, không phân biệt hoa/thường.
- `seniority`: `JUNIOR`, `MID`, `SENIOR`.
- `limit`: mặc định 12, giới hạn 1–50.
- `bookmark`: cursor được ràng buộc với bộ lọc; cursor sai hoặc dùng lại với filter khác trả 400.
- Kết quả: `{items, has_more, bookmark?}`; chỉ DTO Job công khai, không bao gồm document nội bộ.
- Query params không thuộc allowlist, gồm `location`/`salary`, bị Zod strict validation từ chối.

Search và các filter được kết hợp theo AND; trong nhóm skills, mỗi skill phải có trong `required_skills` hoặc `optional_skills`.

## Giao diện

- Dùng bố cục tham khảo Recruitment SaaS: thanh tìm kiếm lớn phía trên, sidebar filter bên trái trên desktop, danh sách card bên phải.
- Mobile giữ thanh tìm kiếm ở đầu trang; filter mở/đóng bằng nút, không chiếm toàn màn hình.
- Skills nhập một hoặc nhiều giá trị bằng dấu phẩy; ngành nghề là giá trị text vì không có API facet/danh mục được duyệt; cấp độ dùng enum schema.
- Không hiển thị bộ lọc hoặc ghi chú địa điểm/lương vì schema và dữ liệu hiện không hỗ trợ hai trường này.
- Search debounce 350 ms, điều kiện lọc đồng bộ URL; refresh khôi phục điều kiện. Đổi filter về trang đầu, reset xóa mọi điều kiện. AbortController và request sequence bỏ response cũ.
- Có loading skeleton, empty state, error/retry và phân trang cursor. Không hiển thị count tổng giả.

## Kiểm thử và xác nhận

- Backend `node --test tests/recruitment/*.test.js`: **PASS 45/45**. Bao gồm search literal/rỗng, special characters, filters đơn/kết hợp, OPEN-only, cursor, sort ổn định, invalid query và UC05 listing/detail regression.
- Frontend `npm.cmd test`: **PASS 61 Vitest + 7 Node tests** (chạy lại sau khi hoàn tất chỉnh sửa).
- Frontend `npm.cmd run lint`: **PASS**, 0 errors; 2 cảnh báo `React` import cũ tại `App.jsx` và `Landing.jsx`.
- Frontend `npm.cmd run build`: **PASS**.
- Live read-only smoke gọi cùng `JobService.publicList()` trên `recruitment_db`: trả đúng 3 tin OPEN đầu tiên, cursor có trang kế tiếp; `doc_count` vẫn 25.750.
- Không chạy full backend `npm test`: suite bao gồm legacy data/release tests dùng shared scratch artifacts; task chỉ cần suite Recruitment cô lập. Không có test nào ghi CouchDB.

## Hướng dẫn tự kiểm thử UI

1. Mở `/jobs`; nhập từ khóa như `analyst` hoặc `python` và quan sát kết quả sau khoảng 350 ms.
2. Nhập `SQL, Python` vào Kỹ năng để yêu cầu tin có đủ cả hai; kết hợp ngành nghề và cấp độ.
3. Dùng “Trang sau”, đổi cấp độ hoặc reset; trang phải trở lại 1 và không giữ cursor cũ.
4. Refresh với query string đang có để xác nhận các điều kiện được khôi phục.
5. Thử từ khóa không khớp để xem empty state; tắt API để xem error/retry.

**Trạng thái:** UC06 search/filter/pagination được triển khai. Location/salary filter và newest-first sort chưa hỗ trợ do thiếu trường/index đã duyệt; không thay đổi schema hoặc database để bổ sung chúng.

## Cập nhật UI theo template — 2026-10-25

Sau phần triển khai UC06, tinh chỉnh lại `/jobs` theo ảnh template do người dùng cung cấp:

- Desktop dùng khung nội dung tối đa 1200px, sidebar 260px bên trái và vùng kết quả bên phải; header trang giữ eyebrow, tiêu đề và mô tả.
- Sidebar tìm kiếm là card riêng gồm từ khóa, kỹ năng, ngành nghề và cấp độ; ô tìm kiếm vẫn hiện phía trên trên tablet/mobile, bộ lọc mở/đóng bằng nút.
- Vùng kết quả được gom vào một panel trắng có viền mảnh và shadow nhẹ. Bên trong có tiêu đề/count theo trang, danh sách Job cards nằm ngang, metadata có icon, skill chips và phân trang ở cuối panel.
- Đồng bộ tông màu, radius, spacing và focus ring theo design tokens trong prompt. Loại bỏ hẳn ghi chú địa điểm/lương khỏi sidebar; chỉ giữ các control được schema/API hỗ trợ.
- Location, salary và sort relevance vẫn không được dựng thành control hoạt động: Job schema/API hiện không hỗ trợ. Count chỉ mô tả số kết quả của trang hiện tại; pagination tiếp tục dùng cursor Previous/Next, không giả lập tổng trang.

### Xác minh follow-up

- Frontend `npm.cmd run build`: **PASS**.
- `git diff --check` cho `JobList.jsx`: **PASS**; Git chỉ phát advisory LF-to-CRLF.
- Không chạy lại test suite hoặc browser E2E cho thay đổi trình bày này. Các test UC06 ban đầu được ghi ở phần kiểm thử phía trên.
- File giao diện: `frontend/src/pages/Jobs/JobList.jsx`.
