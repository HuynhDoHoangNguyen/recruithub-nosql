const RecruiterRegistrationFields = ({ value, onChange, disabled = false }) => {
  const update = (event) => onChange?.({ ...value, [event.target.name]: event.target.value });

  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <legend className="px-2 text-lg font-semibold text-slate-900">Thông tin nhà tuyển dụng và công ty</legend>
      <div>
        <label htmlFor="recruiter-email" className="form-label">Email</label>
        <input id="recruiter-email" name="email" type="email" autoComplete="email" maxLength={254} value={value.email ?? ''} onChange={update} className="input-field" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recruiter-password" className="form-label">Mật khẩu</label>
          <input id="recruiter-password" name="password" type="password" autoComplete="new-password" maxLength={128} value={value.password ?? ''} onChange={update} className="input-field" />
        </div>
        <div>
          <label htmlFor="recruiter-confirm-password" className="form-label">Xác nhận mật khẩu</label>
          <input id="recruiter-confirm-password" name="confirm_password" type="password" autoComplete="new-password" maxLength={128} value={value.confirm_password ?? ''} onChange={update} className="input-field" />
        </div>
      </div>
      <div>
        <label htmlFor="recruiter-company-name" className="form-label">Tên công ty mới</label>
        <input id="recruiter-company-name" name="company_name" type="text" maxLength={200} value={value.company_name ?? ''} onChange={update} className="input-field" />
      </div>
      <div>
        <label htmlFor="recruiter-industry" className="form-label">Lĩnh vực hoạt động</label>
        <input id="recruiter-industry" name="industry" type="text" maxLength={120} value={value.industry ?? ''} onChange={update} className="input-field" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recruiter-website" className="form-label">Website (không bắt buộc)</label>
          <input id="recruiter-website" name="website" type="url" maxLength={2048} value={value.website ?? ''} onChange={update} className="input-field" />
        </div>
        <div>
          <label htmlFor="recruiter-address" className="form-label">Địa chỉ (không bắt buộc)</label>
          <input id="recruiter-address" name="address" type="text" maxLength={500} value={value.address ?? ''} onChange={update} className="input-field" />
        </div>
      </div>
      <div>
        <label htmlFor="recruiter-department" className="form-label">Phòng ban</label>
        <input id="recruiter-department" name="department_name" type="text" maxLength={120} value={value.department_name ?? ''} onChange={update} className="input-field" />
      </div>
    </fieldset>
  );
};

export default RecruiterRegistrationFields;
