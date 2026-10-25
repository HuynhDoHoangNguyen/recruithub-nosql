import { candidateProfilePatch } from '../../utils/candidateProfileForm.js';

export const phoneHint = 'Di động Việt Nam: 10 số; cố định: 11 số. Có thể dùng +84 thay cho số 0 đầu. Để trống nếu chưa cung cấp.';
export function phoneError(value = '') {
  if (!value.trim()) return '';
  const compact = value.trim().replace(/[\s().-]/g, '');
  return value.length <= 40 && /^[+\d\s().-]+$/.test(value) && /^(?:0|\+84|84)(?:[35789]\d{8}|2\d{9})$/.test(compact)
    ? '' : 'Số điện thoại chưa đúng. Nhập đủ 10 số di động (03/05/07/08/09), 11 số cố định (02), hoặc dạng +84 tương ứng.';
}
export function textError(value, label, max, min = 0, multiline = false) {
  const text = (value || '').trim();
  if (text.length < min) return `${label} cần ít nhất ${min} ký tự.`;
  if (text.length > max) return `${label} tối đa ${max} ký tự.`;
  if ([...text].some(char => { const code = char.charCodeAt(0); return code === 127 || (code < 32 && (!multiline || ![9, 10, 13].includes(code))); })) return `${label} chứa ký tự điều khiển không hợp lệ.`;
  return '';
}
export function nameError(value, max) {
  return textError(value, 'Họ và tên', max, 2) || (!/\p{L}/u.test(value || '') || /[<>]/.test(value || '') ? 'Họ và tên phải có chữ cái, không chứa thẻ HTML.' : '');
}
export function websiteError(value = '') {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (value.trim().length <= 2048 && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return '';
  } catch { /* Return a field message below. */ }
  return 'Nhập website http:// hoặc https:// hợp lệ, không chứa tài khoản/mật khẩu (tối đa 2048 ký tự).';
}
function cleanErrors(errors) { return Object.fromEntries(Object.entries(errors).filter(([, value]) => value)); }
export function recruiterProfileErrors(person) {
  return cleanErrors({ 'profile.full_name': nameError(person.full_name, 160), 'profile.phone': phoneError(person.phone),
    'profile.location': textError(person.location, 'Địa điểm', 200), 'profile.bio': textError(person.bio, 'Giới thiệu', 3000, 0, true) });
}
export function companyProfileErrors(company) {
  return cleanErrors({ 'company.name': textError(company.name, 'Tên công ty', 200, 2), 'company.industry': textError(company.industry, 'Ngành nghề', 120, 2),
    'company.website': websiteError(company.website), 'company.address': textError(company.address, 'Địa chỉ công ty', 500), 'company.description': textError(company.description, 'Giới thiệu công ty', 5000, 0, true) });
}
function dateParts(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value || ''); if (!match) return null;
  const [, y, m, d] = match, year = Number(y), month = Number(m), day = d ? Number(d) : 1;
  const date = new Date(`${y}-${m}-${d || '01'}T00:00:00Z`);
  return year >= 1900 && month >= 1 && month <= 12 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { month: year * 12 + month, day: d ? day : null } : null;
}
export function candidateProfileErrors(profile, baseline) {
  const patch = candidateProfilePatch(profile, baseline), errors = {};
  if (patch.profile) {
    const p = profile.profile;
    Object.assign(errors, { 'profile.full_name': nameError(p.full_name, 120), 'profile.role': textError(p.role, 'Vị trí mong muốn', 120, 2),
      'profile.industry': textError(p.industry, 'Ngành nghề', 80, 2), 'profile.phone': phoneError(p.phone), 'profile.location': textError(p.location, 'Địa điểm', 160),
      'profile.summary': textError(p.summary, 'Giới thiệu', 4000, baseline.profile.summary ? 1 : 0, true),
      'profile.years_experience': Number.isInteger(p.years_experience) && p.years_experience >= 0 && p.years_experience <= 80 ? '' : 'Số năm kinh nghiệm phải là số nguyên từ 0 đến 80.' });
  }
  for (const [collection, max] of [['skills', 100], ['languages', 20], ['education', 30], ['experience', 50], ['projects', 50]]) {
    if (!patch[collection]) continue;
    const seen = new Set();
    patch[collection].forEach((item, i) => {
      const prefix = `${collection}.${i}`;
      if (['skills', 'languages'].includes(collection)) {
        errors[`${prefix}.name`] = textError(item.name, collection === 'skills' ? 'Kỹ năng' : 'Ngoại ngữ', collection === 'skills' ? 120 : 80, 1);
        const key = (item.normalized || item.name || '').normalize('NFKC').trim().toLowerCase();
        if (seen.has(key)) errors[`${prefix}.name`] = collection === 'skills' ? 'Kỹ năng không được trùng nhau.' : 'Ngoại ngữ không được trùng nhau.';
        seen.add(key);
        if (collection === 'languages') errors[`${prefix}.proficiency`] = textError(item.proficiency, 'Trình độ ngoại ngữ', 120);
      }
      if (collection === 'projects') {
        errors[`${prefix}.name`] = textError(item.name, 'Tên dự án', 200, 1);
        if ((item.technologies || []).length > 100 || (item.technologies || []).some(text => textError(text, 'Công nghệ', 120, 1))) errors[`${prefix}.technologies`] = 'Tối đa 100 công nghệ, mỗi mục từ 1 đến 120 ký tự.';
      }
      for (const [field, label, limit] of [['institution', 'Tên trường', 200], ['field_of_study', 'Chuyên ngành', 200], ['employer', 'Đơn vị làm việc', 200], ['role', 'Vai trò', 200], ['description', 'Mô tả', 4000]]) {
        if (item[field] !== undefined) errors[`${prefix}.${field}`] = textError(item[field], label, limit, 1, field === 'description');
      }
      const old = baseline[collection]?.[i];
      if (['education', 'experience'].includes(collection) && (!old || item.start_date !== old.start_date || item.end_date !== old.end_date)) {
        const start = dateParts(item.start_date), end = dateParts(item.end_date);
        for (const [field, value] of [['start_date', start], ['end_date', end]]) if (item[field] && !value) errors[`${prefix}.${field}`] = 'Nhập ngày hợp lệ dạng YYYY-MM hoặc YYYY-MM-DD (từ năm 1900).';
        if (start && end && (end.month < start.month || (end.month === start.month && start.day !== null && end.day !== null && end.day < start.day))) errors[`${prefix}.end_date`] = 'Ngày kết thúc không được trước ngày bắt đầu.';
      }
    });
    if (patch[collection].length > max) errors[`${collection}.0.${({ education: 'institution', experience: 'role' })[collection] || 'name'}`] = `Tối đa ${max} mục trong danh sách này.`;
  }
  return cleanErrors(errors);
}
