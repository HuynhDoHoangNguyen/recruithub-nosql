export const employmentLabels = { FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACT: 'Hợp đồng', INTERNSHIP: 'Intern (Thực tập)' };
export function salaryLabel(salary) {
  if (!salary) return 'Chưa cập nhật';
  if (salary.type === 'NEGOTIABLE') return 'Thỏa thuận';
  const format = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  return `${format(salary.min)} – ${format(salary.max)} ${salary.currency} / tháng`;
}
