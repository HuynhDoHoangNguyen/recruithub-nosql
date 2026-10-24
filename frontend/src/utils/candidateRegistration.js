export function validateCandidateRegistration(form) {
  if (!form.full_name.trim() || !form.candidate_role.trim() || !form.industry.trim()) return 'Vui lòng điền họ tên, vị trí mong muốn và ngành nghề.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  const years = Number(form.years_experience);
  if (!Number.isInteger(years) || years < 0 || years > 80) return 'Số năm kinh nghiệm phải là số nguyên từ 0 đến 80.';
  if (form.password.length < 6 || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
    return 'Mật khẩu cần có ít nhất 6 ký tự, gồm một chữ in hoa và một chữ số.';
  }
  if (form.password !== form.confirm_password) return 'Mật khẩu xác nhận không khớp.';
  return '';
}
