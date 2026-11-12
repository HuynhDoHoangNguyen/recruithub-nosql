import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthLayout from '../components/auth/AuthLayout';

const ResetPassword = () => {
  const [form, setForm] = useState({ email: '', temporary_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibleFields, setVisibleFields] = useState({ temporary_password: false, new_password: false, confirm_password: false });

  const toggleVisibility = (field) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (form.new_password !== form.confirm_password) {
      setError('Mật khẩu mới nhập lại chưa khớp.');
      return;
    }
    if (form.new_password.length < 6 || !/[A-Z]/.test(form.new_password) || !/\d/.test(form.new_password)) {
      setError('Mật khẩu mới cần ít nhất 6 ký tự, gồm một chữ hoa và một chữ số.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/v1/auth/reset-password', {
        email: form.email.trim(),
        temporary_password: form.temporary_password,
        new_password: form.new_password,
      });
      setComplete(true);
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      setError(code === 'PASSWORD_RESET_INVALID'
        ? 'Mã đặt lại không đúng hoặc đã hết hạn. Hãy yêu cầu Admin cấp mã mới.'
        : requestError.response?.data?.error?.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Đặt mật khẩu mới" description="Nhập mã dùng một lần do Admin cấp, sau đó tự chọn mật khẩu đăng nhập.">
      {complete ? (
        <div role="status" className="space-y-4">
          <p className="message-success">Đặt lại mật khẩu thành công. Tài khoản đã được kích hoạt.</p>
          <Link to="/login" className="btn-primary flex h-12 w-full items-center justify-center">Đăng nhập</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div role="alert" className="message-error">{error}</div>}
          <div><label htmlFor="reset-email" className="form-label">Email tài khoản</label><input id="reset-email" type="email" autoComplete="username" required maxLength={254} className="input-field h-12" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div>
            <label htmlFor="temporary-password" className="form-label">Mã dùng một lần</label>
            <div className="relative">
              <input id="temporary-password" type={visibleFields.temporary_password ? 'text' : 'password'} autoComplete="one-time-code" required minLength={32} maxLength={128} className="input-field h-12 pr-12" value={form.temporary_password} onChange={(event) => setForm({ ...form, temporary_password: event.target.value })} />
              <button type="button" onClick={() => toggleVisibility('temporary_password')} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={visibleFields.temporary_password ? 'Ẩn mã dùng một lần' : 'Hiện mã dùng một lần'}>{visibleFields.temporary_password ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
            </div>
          </div>
          <div>
            <label htmlFor="new-password" className="form-label">Mật khẩu mới</label>
            <div className="relative">
              <input id="new-password" type={visibleFields.new_password ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={128} className="input-field h-12 pr-12" value={form.new_password} onChange={(event) => setForm({ ...form, new_password: event.target.value })} />
              <button type="button" onClick={() => toggleVisibility('new_password')} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={visibleFields.new_password ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}>{visibleFields.new_password ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className="form-label">Nhập lại mật khẩu mới</label>
            <div className="relative">
              <input id="confirm-password" type={visibleFields.confirm_password ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={128} className="input-field h-12 pr-12" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} />
              <button type="button" onClick={() => toggleVisibility('confirm_password')} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={visibleFields.confirm_password ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'}>{visibleFields.confirm_password ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary h-12 w-full">{loading ? 'Đang đặt lại…' : 'Đặt mật khẩu và kích hoạt'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-600"><Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">Quay lại đăng nhập</Link></p>
    </AuthLayout>
  );
};

export default ResetPassword;
