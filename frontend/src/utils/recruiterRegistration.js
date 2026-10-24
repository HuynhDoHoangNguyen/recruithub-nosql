const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRecruiterRegistration(form = {}) {
  const email = String(form.email ?? '').trim();
  const password = String(form.password ?? '');
  const confirmation = String(form.confirm_password ?? '');
  if (!EMAIL_PATTERN.test(email)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (password.length < 6 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Mật khẩu cần có ít nhất 6 ký tự, gồm một chữ in hoa và một chữ số.';
  }
  if (password !== confirmation) return 'Mật khẩu xác nhận không khớp.';
  if (!/^company:[a-z0-9_:-]+$/.test(String(form.company_id ?? ''))) return 'Hãy tìm và chọn công ty trong danh sách gợi ý.';
  if (!/^department:[a-z0-9_:-]+$/.test(String(form.department_id ?? ''))) return 'Hãy chọn phòng ban của công ty.';
  return '';
}

/** Send only the selected organization references; never accept editable org data. */
export function recruiterRegistrationInput(form = {}) {
  return {
    email: String(form.email ?? '').trim(),
    password: String(form.password ?? ''),
    company_id: String(form.company_id ?? ''),
    department_id: String(form.department_id ?? ''),
  };
}
