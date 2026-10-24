import { useRef, useState } from 'react';
import { Building2, Check, Eye, EyeOff, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { validateCandidateRegistration } from '../utils/candidateRegistration';
import RecruiterRegistrationFields from '../components/auth/RecruiterRegistrationFields';
import AuthLayout from '../components/auth/AuthLayout';
import SuggestionSelectField from '../components/auth/SuggestionSelectField';
import { recruiterRegistrationInput, validateRecruiterRegistration } from '../utils/recruiterRegistration';

const OTHER_PREFIX = '__other__:';
const roleSuggestions = ['Phát triển phần mềm', 'Frontend Developer', 'Backend Developer', 'Full-stack Developer', 'Data Analyst', 'Data Engineer', 'QA / Tester', 'UI/UX Designer', 'Product Manager', 'DevOps Engineer', 'Nhân sự / Tuyển dụng', 'Marketing', 'Kinh doanh'];
const industrySuggestions = ['Công nghệ', 'Công nghệ thông tin', 'Tài chính / Ngân hàng', 'Thương mại điện tử', 'Giáo dục', 'Y tế', 'Sản xuất', 'Logistics', 'Tư vấn', 'Truyền thông', 'Viễn thông'];

const submittedSuggestion = (value) => (value.startsWith(OTHER_PREFIX) ? value.slice(OTHER_PREFIX.length).trim() : value.trim());

const initialForm = {
  full_name: '', email: '', password: '', confirm_password: '',
  candidate_role: '', industry: '', seniority: 'JUNIOR', years_experience: '0',
};

const Register = () => {
  const navigate = useNavigate();
  const submitting = useRef(false);
  const [form, setForm] = useState(initialForm);
  const [selectedRole, setSelectedRole] = useState('CANDIDATE');
  const [recruiterForm, setRecruiterForm] = useState({ email: '', password: '', confirm_password: '', company_id: '', department_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const recruiterSignupEnabled = import.meta.env.VITE_RECRUITER_REGISTRATION_ENABLED === 'true';

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };
  const passwordStrength = [form.password.length >= 6, /[A-Z]/.test(form.password), /\d/.test(form.password), /[!@#$%^&*(),.?":{}|<>]/.test(form.password)].filter(Boolean).length;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    const isRecruiter = selectedRole === 'RECRUITER';
    if (isRecruiter && !recruiterSignupEnabled) {
      setError('Đăng ký Recruiter hiện chưa được bật.');
      return;
    }
    const candidateForm = {
      ...form,
      candidate_role: submittedSuggestion(form.candidate_role),
      industry: submittedSuggestion(form.industry),
    };
    const validationError = isRecruiter ? validateRecruiterRegistration(recruiterForm) : validateCandidateRegistration(candidateForm);
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
          candidate_role: candidateForm.candidate_role,
          industry: candidateForm.industry,
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
        ORGANIZATION_NOT_SUPPORTED: 'Công ty hoặc phòng ban không còn khả dụng. Hãy tìm và chọn lại.',
        COMPANY_NOT_FOUND: 'Công ty không còn khả dụng. Hãy tìm và chọn lại.',
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

  const chooseRole = (role) => {
    setSelectedRole(role);
    setError('');
  };

  return (
    <AuthLayout width="wide" title="Tạo tài khoản RecruiHub" description="Tham gia để tìm kiếm cơ hội hoặc kết nối nhân tài.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-800">Bạn muốn đăng ký với vai trò nào?</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={`relative flex min-h-[82px] cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors focus-within:ring-4 focus-within:ring-blue-100 ${selectedRole === 'CANDIDATE' ? 'border-blue-600 bg-blue-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <input className="peer sr-only" type="radio" name="registration-role" value="CANDIDATE" checked={selectedRole === 'CANDIDATE'} onChange={() => chooseRole('CANDIDATE')} aria-label="Ứng viên" />
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selectedRole === 'CANDIDATE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}><UserRound className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">Ứng viên</span>
                <span className="mt-1 block text-sm leading-5 text-slate-600">Tìm cơ hội nghề nghiệp phù hợp với bạn.</span>
              </span>
              {selectedRole === 'CANDIDATE' && <Check className="h-5 w-5 shrink-0 text-blue-700" aria-label="Đang chọn" />}
            </label>
            <label className={`relative flex min-h-[82px] items-start gap-3 rounded-xl border p-3.5 transition-colors ${recruiterSignupEnabled ? 'cursor-pointer focus-within:ring-4 focus-within:ring-blue-100' : 'cursor-not-allowed bg-slate-50 opacity-75'} ${selectedRole === 'RECRUITER' ? 'border-blue-600 bg-blue-50/70' : 'border-slate-200 bg-white'}`}>
              <input className="peer sr-only" type="radio" name="registration-role" value="RECRUITER" checked={selectedRole === 'RECRUITER'} onChange={() => chooseRole('RECRUITER')} disabled={!recruiterSignupEnabled} aria-label="Nhà tuyển dụng" aria-describedby={!recruiterSignupEnabled ? 'recruiter-registration-disabled' : undefined} />
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selectedRole === 'RECRUITER' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}><Building2 className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">Nhà tuyển dụng</span>
                <span className="mt-1 block text-sm leading-5 text-slate-600">Đăng tin và quản lý quy trình tuyển dụng.</span>
                {!recruiterSignupEnabled && <span id="recruiter-registration-disabled" className="mt-2 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">Đăng ký hiện chưa được bật</span>}
              </span>
              {selectedRole === 'RECRUITER' && <Check className="h-5 w-5 shrink-0 text-blue-700" aria-label="Đang chọn" />}
            </label>
          </div>
        </fieldset>

        {error && <div role="alert" className="message-error" aria-live="assertive">{error}</div>}

        {selectedRole === 'RECRUITER' ? (
          <RecruiterRegistrationFields value={recruiterForm} onChange={setRecruiterForm} disabled={loading} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pt-1">
              <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Thông tin tài khoản</h2>
              <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="full_name" className="form-label">Họ và tên</label>
                <input id="full_name" name="full_name" type="text" autoComplete="name" required maxLength={160} value={form.full_name} onChange={handleChange} className="input-field h-12" placeholder="Nguyễn Văn An" />
              </div>
              <div>
                <label htmlFor="email" className="form-label">Địa chỉ email</label>
                <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={handleChange} className="input-field h-12" placeholder="ban@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="form-label">Mật khẩu</label>
                <div className="relative">
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={128} value={form.password} onChange={handleChange} className="input-field h-12 pr-12" aria-describedby="password-hint" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
                </div>
                <p id="password-hint" className="mt-2 text-xs leading-5 text-slate-500">Ít nhất 6 ký tự, có chữ in hoa và chữ số.</p>
                {form.password && <div className="mt-2 flex gap-1" aria-label={`Độ mạnh mật khẩu: ${passwordStrength} trên 4`} role="img">{[1, 2, 3, 4].map((level) => <span key={level} className={`h-1 flex-1 rounded ${level <= passwordStrength ? (passwordStrength <= 2 ? 'bg-red-500' : passwordStrength === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />)}</div>}
              </div>
              <div>
                <label htmlFor="confirm_password" className="form-label">Xác nhận mật khẩu</label>
                <div className="relative">
                  <input id="confirm_password" name="confirm_password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} value={form.confirm_password} onChange={handleChange} className="input-field h-12 pr-12" />
                  <button type="button" onClick={() => setShowConfirmation((value) => !value)} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={showConfirmation ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}>{showConfirmation ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hồ sơ nghề nghiệp</h2>
              <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SuggestionSelectField id="candidate_role" name="candidate_role" label="Vị trí mong muốn" value={form.candidate_role} onChange={handleChange} options={roleSuggestions} placeholder="Chọn vị trí" otherPlaceholder="Nhập vị trí mong muốn" />
              <SuggestionSelectField id="industry" name="industry" label="Ngành nghề quan tâm" value={form.industry} onChange={handleChange} options={industrySuggestions} placeholder="Chọn ngành nghề" otherPlaceholder="Nhập ngành nghề quan tâm" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="seniority" className="form-label">Cấp độ kinh nghiệm</label>
                <select id="seniority" name="seniority" value={form.seniority} onChange={handleChange} className="input-field h-12">
                  <option value="JUNIOR">Junior</option><option value="MID">Trung cấp</option><option value="SENIOR">Senior</option>
                </select>
              </div>
              <div>
                <label htmlFor="years_experience" className="form-label">Số năm kinh nghiệm</label>
                <input id="years_experience" name="years_experience" type="number" min="0" max="80" step="1" required value={form.years_experience} onChange={handleChange} className="input-field h-12" />
              </div>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary h-12 w-full rounded-[10px] bg-blue-700 shadow-none transition-colors hover:bg-blue-800 hover:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
          {loading ? <span role="status" className="inline-flex items-center gap-2"><span className="loading-spinner" aria-hidden="true" />Đang tạo tài khoản…</span> : `Tạo tài khoản ${selectedRole === 'RECRUITER' ? 'Recruiter' : 'Candidate'}`}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">Đã có tài khoản? <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Đăng nhập</Link></p>
    </AuthLayout>
  );
};

export default Register;
