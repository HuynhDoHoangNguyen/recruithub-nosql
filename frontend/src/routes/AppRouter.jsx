import {
  BrowserRouter,
  Routes,
  Route,
  Link
} from 'react-router-dom';

import HomePage from '../pages/HomePage';

function NotFoundPage() {
  return (
    <main>
      <h1>404 - Không tìm thấy trang</h1>
      <Link to="/">Quay về trang chủ</Link>
    </main>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
