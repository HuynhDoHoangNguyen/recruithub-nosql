const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCompanyName(value = '') {
  return String(value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

/** Comparison key only; not a Company ID or a duplicate-proof database key. */
export function companyNameComparisonKey(value = '') {
  return normalizeCompanyName(value).toLocaleLowerCase('vi');
}

export function normalizeDepartmentName(value = '') {
  return String(value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

/** Produce the current Department schema's lowercase slug form. */
export function departmentKeyFromName(value = '') {
  return normalizeDepartmentName(value)
    .toLocaleLowerCase('vi')
    .replace(/đ/gu, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function validateRecruiterRegistration(form = {}) {
  const email = String(form.email ?? '').trim();
  const password = String(form.password ?? '');
  const confirmation = String(form.confirm_password ?? '');
  const companyName = normalizeCompanyName(form.company_name);
  const industry = normalizeCompanyName(form.industry);
  const departmentName = normalizeDepartmentName(form.department_name);
  const website = String(form.website ?? '').trim();
  if (!EMAIL_PATTERN.test(email)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (password.length < 6 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Mật khẩu cần có ít nhất 6 ký tự, gồm một chữ in hoa và một chữ số.';
  }
  if (password !== confirmation) return 'Mật khẩu xác nhận không khớp.';
  if (!companyName) return 'Vui lòng nhập tên công ty.';
  if (!industry) return 'Vui lòng nhập lĩnh vực hoạt động.';
  if (!departmentName || !departmentKeyFromName(departmentName)) return 'Vui lòng nhập tên phòng ban hợp lệ.';
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
    } catch {
      return 'Website phải là địa chỉ HTTP hoặc HTTPS hợp lệ.';
    }
  }

  return '';
}

/** UI preview mapping only. It deliberately contains no role or document IDs. */
export function recruiterRegistrationInput(form = {}) {
  return {
    email: String(form.email ?? '').trim(),
    password: String(form.password ?? ''),
    company: {
      name: normalizeCompanyName(form.company_name),
      industry: normalizeCompanyName(form.industry),
      ...(String(form.website ?? '').trim() ? { website: String(form.website).trim() } : {}),
      ...(normalizeCompanyName(form.address) ? { address: normalizeCompanyName(form.address) } : {}),
    },
    department: {
      name: normalizeDepartmentName(form.department_name),
    },
  };
}
