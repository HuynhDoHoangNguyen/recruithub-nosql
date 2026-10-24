import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getCompanyDepartments, searchCompanies } from '../../services/organizationApi';

const RecruiterRegistrationFields = ({ value, onChange, disabled = false }) => {
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [companySearchState, setCompanySearchState] = useState('idle');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentState, setDepartmentState] = useState('idle');
  const [activeResult, setActiveResult] = useState(-1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const query = companyQuery.trim();
    if (query.length < 2 || (selectedCompany && query === selectedCompany.name)) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCompanySearchState('loading');
      try {
        const items = await searchCompanies(query, controller.signal);
        setCompanyResults(items);
        setActiveResult(items.length ? 0 : -1);
        setCompanySearchState(items.length ? 'results' : 'empty');
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') setCompanySearchState('error');
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [companyQuery, selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) return undefined;
    const controller = new AbortController();
    getCompanyDepartments(selectedCompany.id, controller.signal)
      .then((items) => {
        setDepartments(items);
        setDepartmentState(items.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') setDepartmentState('error');
      });
    return () => controller.abort();
  }, [selectedCompany]);

  const update = (event) => onChange?.({ ...value, [event.target.name]: event.target.value });
  const selectCompany = (company) => {
    setSelectedCompany(company);
    setDepartmentState('loading');
    setCompanyQuery(company.name);
    setCompanyResults([]);
    setActiveResult(-1);
    setCompanySearchState('idle');
    onChange?.({ ...value, company_id: company.id, department_id: '' });
  };
  const changeCompanyQuery = (event) => {
    setCompanyQuery(event.target.value);
    setSelectedCompany(null);
    setCompanyResults([]);
    setActiveResult(-1);
    setCompanySearchState('idle');
    setDepartments([]);
    setDepartmentState('idle');
    onChange?.({ ...value, company_id: '', department_id: '' });
  };
  const handleCompanyKeyDown = (event) => {
    if (!companyResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResult((current) => (current + 1) % companyResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResult((current) => (current <= 0 ? companyResults.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeResult >= 0) {
      event.preventDefault();
      selectCompany(companyResults[activeResult]);
    } else if (event.key === 'Escape') {
      setCompanyResults([]);
      setActiveResult(-1);
    }
  };

  return (
    <fieldset disabled={disabled} className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <legend className="px-2 text-sm font-semibold text-slate-800">Thông tin nhà tuyển dụng</legend>
      <div>
        <label htmlFor="recruiter-email" className="form-label">Email</label>
        <input id="recruiter-email" name="email" type="email" autoComplete="email" required maxLength={254} value={value.email ?? ''} onChange={update} className="input-field h-12" placeholder="ban@congty.com" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recruiter-password" className="form-label">Mật khẩu</label>
          <div className="relative">
            <input id="recruiter-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6} maxLength={128} value={value.password ?? ''} onChange={update} className="input-field h-12 pr-12" aria-describedby="recruiter-password-hint" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
          </div>
          <p id="recruiter-password-hint" className="mt-2 text-xs leading-5 text-slate-500">Ít nhất 6 ký tự, có chữ in hoa và chữ số.</p>
        </div>
        <div>
          <label htmlFor="recruiter-confirm-password" className="form-label">Xác nhận mật khẩu</label>
          <div className="relative">
            <input id="recruiter-confirm-password" name="confirm_password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} value={value.confirm_password ?? ''} onChange={update} className="input-field h-12 pr-12" />
            <button type="button" onClick={() => setShowConfirmation((visible) => !visible)} className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={showConfirmation ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}>{showConfirmation ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
          </div>
        </div>
      </div>
      <div className="relative">
        <label htmlFor="recruiter-company-name" className="form-label">Tìm công ty</label>
        <input
          id="recruiter-company-name" name="company_name" type="search" autoComplete="off" required minLength={2} maxLength={100}
          value={companyQuery} onChange={changeCompanyQuery} onKeyDown={handleCompanyKeyDown} className="input-field h-12"
          placeholder="Nhập ít nhất 2 ký tự tên công ty"
          aria-autocomplete="list" aria-expanded={companyResults.length > 0} aria-controls="recruiter-company-results"
          aria-activedescendant={activeResult >= 0 ? `recruiter-company-option-${activeResult}` : undefined}
        />
        {companySearchState === 'loading' && <p className="mt-2 text-sm text-slate-600" role="status">Đang tìm công ty…</p>}
        {companySearchState === 'error' && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được gợi ý công ty. Vui lòng thử lại.</p>}
        {companySearchState === 'empty' && <p className="mt-2 text-sm text-amber-800" role="status">Hiện chưa hỗ trợ công ty này. Vui lòng liên hệ quản trị viên để được bổ sung.</p>}
        {companyResults.length > 0 && (
          <ul id="recruiter-company-results" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg" role="listbox" aria-label="Gợi ý công ty">
            {companyResults.map((company, index) => (
              <li key={company.id} role="presentation">
                <button id={`recruiter-company-option-${index}`} type="button" role="option" aria-selected={index === activeResult} onMouseEnter={() => setActiveResult(index)} onClick={() => selectCompany(company)} className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${index === activeResult ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="block font-medium text-slate-900">{company.name}</span>
                  <span className="block text-sm text-slate-600">{company.industry}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selectedCompany && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm" aria-live="polite">
          <p className="font-semibold text-emerald-900">Đã chọn: {selectedCompany.name}</p>
          <p className="text-emerald-800">{selectedCompany.industry}</p>
        </div>
      )}
      <div>
        <label htmlFor="recruiter-department" className="form-label">Phòng ban</label>
        <select id="recruiter-department" name="department_id" required value={value.department_id ?? ''} onChange={update} disabled={!selectedCompany || departmentState !== 'ready'} className="input-field h-12">
          <option value="">{!selectedCompany ? 'Chọn công ty trước' : departmentState === 'loading' ? 'Đang tải phòng ban…' : 'Chọn phòng ban'}</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        {departmentState === 'empty' && <p className="mt-2 text-sm text-amber-800" role="status">Công ty này chưa có phòng ban được hỗ trợ. Vui lòng liên hệ quản trị viên.</p>}
        {departmentState === 'error' && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được danh sách phòng ban. Vui lòng thử lại.</p>}
      </div>
    </fieldset>
  );
};

export default RecruiterRegistrationFields;
