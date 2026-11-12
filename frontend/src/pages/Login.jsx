import { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/useAuth';
import { postLoginPath } from '../utils/authNavigation';
import AuthLayout from '../components/auth/AuthLayout';

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
    <AuthLayout title="Chào mừng bạn trở lại" description="Đăng nhập để tiếp tục với RecruiHub.">
      {location.state?.registered && <div role="status" className="message-success mb-6">Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.</div>}
      {error && <div role="alert" className="message-error mb-6">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="form-label">Địa chỉ email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="email" name="email" id="email" autoComplete="username" required maxLength={254} value={form.email}
              onChange={(event) => { setForm({ ...form, email: event.target.value }); setError(''); }} placeholder="ban@example.com" className="input-field h-12 pl-10" />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="form-label">Mật khẩu</label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type={showPassword ? 'text' : 'password'} name="password" id="password" autoComplete="current-password" required maxLength={128} value={form.password}
              onChange={(event) => { setForm({ ...form, password: event.target.value }); setError(''); }} placeholder="Nhập mật khẩu" className="input-field h-12 pl-10 pr-12" />
            <button type="button" className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary h-12 w-full rounded-[10px] bg-blue-700 shadow-none transition-colors hover:bg-blue-800 hover:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
          {loading ? <span role="status" className="inline-flex items-center gap-2"><span className="loading-spinner" aria-hidden="true" />Đang đăng nhập…</span> : 'Đăng nhập'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">Được Admin cấp mã reset? <Link to="/reset-password" className="font-semibold text-blue-700 hover:text-blue-800">Đặt mật khẩu mới</Link></p>
      <p className="mt-6 text-center text-sm text-slate-600">Chưa có tài khoản? <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Đăng ký</Link></p>
    </AuthLayout>
  );
};

export default Login;
