import { z } from 'zod';

export const phoneMessage = 'Nhập số Việt Nam hợp lệ: di động 10 số (03/05/07/08/09), cố định 11 số (02), hoặc dạng +84 tương ứng.';
export function validPhone(value) {
  if (!value) return true; // Contact is optional; a supplied number must be complete.
  if (!/^[+\d\s().-]+$/.test(value)) return false;
  const compact = value.replace(/[\s().-]/g, '');
  return /^(?:0|\+84|84)(?:[35789]\d{8}|2\d{9})$/.test(compact);
}
export const phoneSchema = z.string().trim().max(40, phoneMessage).refine(validPhone, phoneMessage);
export const profileText = (label, max, min = 0, multiline = false) => z.string().trim()
  .min(min, `${label} cần ít nhất ${min} ký tự.`).max(max, `${label} tối đa ${max} ký tự.`)
  .refine(value => !(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value), `${label} chứa ký tự điều khiển không hợp lệ.`);
export const personNameSchema = max => profileText('Họ và tên', max, 2).refine(value => /\p{L}/u.test(value) && !/[<>]/.test(value), 'Họ và tên phải có chữ cái, không chứa thẻ HTML.');

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value || '');
  if (!match) return null;
  const [, y, m, d] = match, year = Number(y), month = Number(m), day = d ? Number(d) : 1;
  const date = new Date(`${y}-${m}-${d || '01'}T00:00:00Z`);
  if (year < 1900 || month < 1 || month > 12 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { month: year * 12 + month, day: d ? day : null };
}
// Only enforce date syntax/order when dates are edited; preserve historical ISO
// strings and legacy ranges unchanged in a collection PATCH.
export function editedDateIssues(patch, current) {
  const issues = [];
  for (const key of ['education', 'experience']) {
    (patch[key] || []).forEach((item, index) => {
      const old = current[key]?.[index];
      if (old && item.start_date === old.start_date && item.end_date === old.end_date) return;
      const start = item.start_date ? dateParts(item.start_date) : null, end = item.end_date ? dateParts(item.end_date) : null;
      for (const [field, parts] of [['start_date', start], ['end_date', end]]) {
        if (item[field] && !parts) issues.push({ field: `${key}.${index}.${field}`, message: 'Nhập ngày hợp lệ dạng YYYY-MM hoặc YYYY-MM-DD (từ năm 1900).' });
      }
      if (start && end && (end.month < start.month || (end.month === start.month && start.day !== null && end.day !== null && end.day < start.day))) issues.push({ field: `${key}.${index}.end_date`, message: 'Ngày kết thúc không được trước ngày bắt đầu.' });
    });
  }
  return issues;
}
