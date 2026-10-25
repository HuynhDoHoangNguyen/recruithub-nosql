# React + Vite

> [Đã sửa Public Jobs sau merge](../docs/public-jobs-after-merge-fix.md): GET public đã đọc lại dataset thật mà không cần Auth database. Nếu tab giữ lỗi cũ, bấm Thử lại hoặc reload; không import lại dữ liệu.

> Sau merge dev: [xem mốc tích hợp hiện tại](../docs/merge-dev-review-2026-10-25.md). Auth dùng User đã được server xác minh và token memory-only; reload cần đăng nhập lại. API client dùng root `/api`, service nối `/v1`; `VITE_PUBLIC_JOBS_MODE=fixtures` chỉ dành cho opt-in development, mặc định gọi API thật. Jobs có thể trả 503 cho đến khi cấu hình database riêng theo contract dev.

## Chạy RecruiHub Frontend

Frontend thật nằm trong thư mục này. `docs/Job-Application-Portal-Frontend/` là template chỉ đọc.

```powershell
# Từ frontend/, sau khi Backend đã chạy:
npm ci
npm run dev
```

Open `http://127.0.0.1:5177`. Axios uses the single same-origin `/api` base. Vite proxies `/api` to backend `PORT` from root/backend `.env` (default `5000`); use `VITE_API_PROXY_TARGET` only for a non-default backend host and restart Vite after configuration changes.

```powershell
npm test -- --maxWorkers=1
npm run lint
npm run build
```

Login/Register cần API Identity thật; giao diện không tạo tài khoản demo hoặc bỏ qua phân quyền. Xem [bàn giao JobPortal IT mới nhất, ảnh đối chiếu và hướng dẫn click](../docs/recruitment-it-template-handoff.md).

Theme mới dùng Plus Jakarta Sans và bố cục của đúng source đang phục vụ template 5174. Nếu đổi Tailwind config trong khi Vite đang chạy lâu và CSS báo unknown utility/500, dừng Vite rồi chạy lại `npm run dev`. Sau cập nhật backend, chạy `cd backend; npm run db:job-application` để cài view thống kê Candidate; lệnh chỉ cập nhật design/index.

Nếu màn hình trắng và Console/Network có `504 Outdated Optimize Dep`, dừng Vite bằng Ctrl+C rồi chạy `npm run dev -- --force` và tải lại trình duyệt. Cache dev hiện tách riêng tại `node_modules/.vite/portal-dev`; không dùng chung cache với server kiểm thử/template. Có thể kiểm tra server thật bằng `node scripts/ui/verify-live.cjs` từ root, sau khi cài Playwright vào OS temp theo tài liệu bàn giao.

## Thông tin template Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Unified local API endpoint

Open `http://127.0.0.1:5177`. Frontend modules use the same-origin `/api` base; Vite proxies `/api` to the backend port from root/backend `.env` (`PORT`, default `5000`). Set `VITE_API_PROXY_TARGET` only for a non-default backend host, then restart Vite. Production hosting must route `/api` to the backend as well.
