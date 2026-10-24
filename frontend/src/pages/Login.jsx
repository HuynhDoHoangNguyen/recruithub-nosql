import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/useAuth';
import { postLoginPath } from '../utils/authNavigation';

const Login = () => {
  const { user, login, refreshMe } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) navigate(postLoginPath(user.role, location.state?.from), { replace: true });
  }, [user, navigate, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/v1/auth/login', form);
      const { accessToken, user: authenticatedUser } = response.data?.data ?? {};
      if (!accessToken || !authenticatedUser) throw new Error('Phản hồi đăng nhập không hợp lệ.');
      login(accessToken, authenticatedUser);
      const verifiedUser = await refreshMe();
      navigate(postLoginPath(verifiedUser?.role || authenticatedUser.role, location.state?.from), { replace: true });
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      const messages = {
        AUTHENTICATION_FAILED: 'Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được kích hoạt.',
        AUTH_CONFIGURATION_ERROR: 'Dịch vụ đăng nhập chưa được cấu hình. Vui lòng báo quản trị viên.',
      };
      setError(messages[code] || (requestError.response ? 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.' : 'Không thể kết nối máy chủ. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <header className="text-center">
          <Link to="/" className="inline-flex items-center mb-8" aria-label="RecruiHub - Trang chủ">
            <span className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-xl" aria-hidden="true">R</span>
            <span className="ml-3 text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">RecruiHub</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Chào mừng bạn trở lại</h1>
          <p className="text-gray-600">Đăng nhập bằng tài khoản Candidate, Recruiter hoặc Admin đã được cấp.</p>
        </header>

        <section className="card p-8">
          {location.state?.registered && <div role="status" className="message-success mb-6">Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.</div>}
          {error && <div role="alert" className="message-error mb-6">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="form-label">Địa chỉ email</label>
              <input type="email" name="email" id="email" autoComplete="username" required maxLength={254} value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Nhập email của bạn" className="input-field" />
            </div>
            <div>
              <label htmlFor="password" className="form-label">Mật khẩu</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} name="password" id="password" autoComplete="current-password" required maxLength={128} value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Nhập mật khẩu" className="input-field pr-12" />
                <button type="button" className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-blue-700" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500">Phiên đăng nhập chỉ được lưu trong bộ nhớ trình duyệt. Chức năng quên mật khẩu chưa được hỗ trợ.</p>
            <button type="submit" disabled={loading} className={`w-full btn-primary ${loading ? 'opacity-60 cursor-wait' : ''}`}>
              {loading ? <span role="status" className="inline-flex items-center gap-2"><span className="loading-spinner" aria-hidden="true" />Đang đăng nhập…</span> : 'Đăng nhập'}
            </button>
          </form>
          <p className="text-center mt-6 text-gray-600">Chưa có tài khoản Candidate? <Link to="/register" className="font-medium text-blue-700 hover:text-blue-800">Đăng ký</Link></p>
        </section>
      </div>
    </main>
  );
};

export default Login;
