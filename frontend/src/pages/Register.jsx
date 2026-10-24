import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { validateCandidateRegistration } from '../utils/candidateRegistration';
import RecruiterRegistrationFields from '../components/auth/RecruiterRegistrationFields';
import { recruiterRegistrationInput, validateRecruiterRegistration } from '../utils/recruiterRegistration';

const initialForm = {
  full_name: '', email: '', password: '', confirm_password: '',
  candidate_role: '', industry: '', seniority: 'JUNIOR', years_experience: '0',
};

const Register = () => {
  const navigate = useNavigate();
  const submitting = useRef(false);
  const [form, setForm] = useState(initialForm);
  const [selectedRole, setSelectedRole] = useState('CANDIDATE');
  const [recruiterForm, setRecruiterForm] = useState({ email: '', password: '', confirm_password: '', company_name: '', industry: '', website: '', address: '', department_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const recruiterSignupEnabled = import.meta.env.VITE_RECRUITER_REGISTRATION_ENABLED === 'true';

  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const passwordStrength = [form.password.length >= 6, /[A-Z]/.test(form.password), /\d/.test(form.password), /[!@#$%^&*(),.?":{}|<>]/.test(form.password)].filter(Boolean).length;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    const isRecruiter = recruiterSignupEnabled && selectedRole === 'RECRUITER';
    const validationError = isRecruiter ? validateRecruiterRegistration(recruiterForm) : validateCandidateRegistration(form);
    if (validationError) { setError(validationError); return; }
    submitting.current = true;
    setLoading(true);
    try {
      if (isRecruiter) {
        await api.post('/v1/auth/register/recruiter', recruiterRegistrationInput(recruiterForm));
      } else {
        await api.post('/v1/auth/register', {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          candidate_role: form.candidate_role.trim(),
          industry: form.industry.trim(),
          seniority: form.seniority,
          years_experience: Number(form.years_experience),
        });
      }
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      const registrationReference = requestError.response?.data?.error?.details?.registration_ref;
      const messages = {
        EMAIL_ALREADY_REGISTERED: 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.',
        COMPANY_ALREADY_EXISTS: 'Tên công ty đã tồn tại hoặc trùng sau chuẩn hóa. Không thể tự nhận quyền với công ty đó.',
        DEPARTMENT_ALREADY_EXISTS: 'Phòng ban đã tồn tại trong công ty này.',
        REGISTRATION_INCOMPLETE: `Đăng ký chưa hoàn tất. Không gửi lại; liên hệ quản trị viên và cung cấp mã tham chiếu${registrationReference ? ` ${registrationReference}` : ''}.`,
        RECRUITER_REGISTRATION_DISABLED: 'Đăng ký Recruiter hiện chưa được bật.',
        VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Hãy kiểm tra lại các trường.',
        AUTH_CONFIGURATION_ERROR: 'Dịch vụ đăng ký chưa được cấu hình. Vui lòng báo quản trị viên.',
      };
      setError(messages[code] || (requestError.response ? 'Đăng ký thất bại. Vui lòng kiểm tra thông tin và thử lại.' : 'Không thể kết nối máy chủ. Vui lòng thử lại.'));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-7">
        <header className="text-center">
          <Link to="/" className="inline-flex items-center mb-5" aria-label="RecruiHub - Trang chủ">
            <span className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-xl" aria-hidden="true">R</span>
            <span className="ml-3 text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">RecruiHub</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Tạo tài khoản {selectedRole === 'RECRUITER' ? 'Recruiter' : 'Candidate'}</h1>
          <p className="text-gray-600">Bắt đầu với thông tin cơ bản; bạn có thể bổ sung hồ sơ sau.</p>
        </header>

        <section className="card p-6 sm:p-8">
          {error && <div role="alert" className="message-error mb-5">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {recruiterSignupEnabled && <div>
              <label htmlFor="registration-role" className="form-label">Loại tài khoản</label>
              <select id="registration-role" value={selectedRole} onChange={(event) => { setSelectedRole(event.target.value); setError(''); }} className="input-field">
                <option value="CANDIDATE">Candidate</option>
                <option value="RECRUITER">Recruiter</option>
              </select>
            </div>}
            {selectedRole === 'RECRUITER' && recruiterSignupEnabled ? <RecruiterRegistrationFields value={recruiterForm} onChange={setRecruiterForm} disabled={loading} /> : <>
            <div>
              <label htmlFor="full_name" className="form-label">Họ và tên</label>
              <input id="full_name" name="full_name" type="text" autoComplete="name" required maxLength={160} value={form.full_name} onChange={handleChange} className="input-field" placeholder="Nguyễn Văn An" />
            </div>
            <div>
              <label htmlFor="email" className="form-label">Địa chỉ email</label>
              <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={handleChange} className="input-field" placeholder="ban@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="form-label">Mật khẩu</label>
              <div className="relative">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={128} value={form.password} onChange={handleChange} className="input-field pr-14" aria-describedby="password-hint" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-blue-700" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? 'Ẩn' : 'Hiện'}</button>
              </div>
              <div className="mt-2" id="password-hint">
                <div className="flex gap-1" aria-hidden="true">{[1, 2, 3, 4].map((level) => <span key={level} className={`h-1 flex-1 rounded ${level <= passwordStrength ? (passwordStrength <= 2 ? 'bg-red-500' : passwordStrength === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />)}</div>
                <p className="mt-1 text-xs text-slate-500">Ít nhất 6 ký tự, có chữ in hoa và chữ số.</p>
              </div>
            </div>
            <div>
              <label htmlFor="confirm_password" className="form-label">Xác nhận mật khẩu</label>
              <div className="relative">
                <input id="confirm_password" name="confirm_password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} value={form.confirm_password} onChange={handleChange} className="input-field pr-14" />
                <button type="button" onClick={() => setShowConfirmation((value) => !value)} className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-blue-700" aria-label={showConfirmation ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}>{showConfirmation ? 'Ẩn' : 'Hiện'}</button>
              </div>
            </div>
            <div>
              <label htmlFor="candidate_role" className="form-label">Vị trí mong muốn</label>
              <input id="candidate_role" name="candidate_role" type="text" required maxLength={120} value={form.candidate_role} onChange={handleChange} className="input-field" placeholder="Ví dụ: Thiết kế sản phẩm" />
            </div>
            <div>
              <label htmlFor="industry" className="form-label">Ngành nghề quan tâm</label>
              <input id="industry" name="industry" type="text" required maxLength={120} value={form.industry} onChange={handleChange} className="input-field" placeholder="Ví dụ: Công nghệ" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="seniority" className="form-label">Cấp độ kinh nghiệm</label>
                <select id="seniority" name="seniority" value={form.seniority} onChange={handleChange} className="input-field">
                  <option value="JUNIOR">Junior</option><option value="MID">Trung cấp</option><option value="SENIOR">Senior</option>
                </select>
              </div>
              <div>
                <label htmlFor="years_experience" className="form-label">Số năm kinh nghiệm</label>
                <input id="years_experience" name="years_experience" type="number" min="0" max="80" step="1" required value={form.years_experience} onChange={handleChange} className="input-field" />
              </div>
            </div>
            </>}
            <button type="submit" disabled={loading} className={`w-full btn-primary ${loading ? 'opacity-60 cursor-wait' : ''}`}>
              {loading ? <span role="status" className="inline-flex items-center gap-2"><span className="loading-spinner" aria-hidden="true" />Đang tạo tài khoản…</span> : `Tạo tài khoản ${selectedRole === 'RECRUITER' ? 'Recruiter' : 'Candidate'}`}
            </button>
          </form>
          <p className="text-center mt-6 text-gray-600">Đã có tài khoản? <Link to="/login" className="font-medium text-blue-700 hover:text-blue-800">Đăng nhập</Link></p>
        </section>
      </div>
    </main>
  );
};

export default Register;
