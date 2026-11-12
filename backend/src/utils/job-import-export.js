import { ApiError } from '../middleware/job-application.middleware.js';

export const JOB_IMPORT_FIELDS = [
  'title', 'industry', 'seniority', 'location', 'work_mode', 'employment_type',
  'salary_type', 'salary_min', 'salary_max', 'salary_currency', 'description',
  'responsibilities', 'general', 'required_skills', 'optional_skills',
  'experience_status', 'required_months', 'education_status', 'minimum_degree',
  'project_status', 'required_technologies', 'deadline', 'status',
];

const ARRAY_FIELDS = new Set(['responsibilities', 'general', 'required_skills', 'optional_skills', 'required_technologies']);

function parseCsvRows(source) {
  const text = source.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else {
        cell += char;
        if (char === '\n') line += 1;
        else if (char === '\r' && text[i + 1] !== '\n') line += 1;
      }
      continue;
    }
    if (char === '"') {
      if (cell.length) throw new ApiError(400, 'INVALID_CSV', `Dấu nháy kép không hợp lệ tại dòng ${line}.`, [{ row: line, field: 'csv', code: 'INVALID_QUOTE' }]);
      quoted = true;
    } else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      row.push(cell); cell = '';
      if (row.some(value => value.trim() !== '')) rows.push({ line: rowLine, values: row });
      row = [];
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      line += 1; rowLine = line;
    } else cell += char;
  }
  if (quoted) throw new ApiError(400, 'INVALID_CSV', `Thiếu dấu nháy kép đóng tại dòng ${rowLine}.`, [{ row: rowLine, field: 'csv', code: 'UNCLOSED_QUOTE' }]);
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== '')) rows.push({ line: rowLine, values: row });
  }
  return rows;
}

function parseCsv(source) {
  const rows = parseCsvRows(source);
  if (!rows.length) throw new ApiError(400, 'EMPTY_FILE', 'File CSV chưa có tiêu đề hoặc dữ liệu.');
  const headers = rows[0].values.map(value => value.trim());
  const seen = new Set();
  for (const header of headers) {
    if (!header || seen.has(header)) throw new ApiError(400, 'INVALID_CSV_HEADER', 'Tiêu đề CSV bị trống hoặc lặp.', [{ row: 1, field: header || 'header', code: 'DUPLICATE_OR_EMPTY_HEADER' }]);
    seen.add(header);
  }
  const unsupported = headers.filter(header => !JOB_IMPORT_FIELDS.includes(header));
  if (unsupported.length) throw new ApiError(400, 'UNSUPPORTED_IMPORT_FIELDS', 'CSV có cột không được phép nhập.', unsupported.map(field => ({ row: 1, field, code: 'UNSUPPORTED_FIELD' })));
  const missing = ['title', 'industry', 'seniority', 'description', 'required_skills'].filter(field => !seen.has(field));
  if (missing.length) throw new ApiError(400, 'MISSING_IMPORT_COLUMNS', 'CSV thiếu cột bắt buộc.', missing.map(field => ({ row: 1, field, code: 'MISSING_COLUMN' })));

  return rows.slice(1).map(({ line, values }) => {
    if (values.length !== headers.length) return { row: line, value: null, errors: [{ field: 'csv', code: 'COLUMN_COUNT_MISMATCH', message: `Dòng có ${values.length} cột, tiêu đề có ${headers.length}.` }] };
    const raw = Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
    const value = {};
    const errors = [];
    for (const [field, content] of Object.entries(raw)) {
      if (content === '') continue;
      if (ARRAY_FIELDS.has(field)) {
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
          value[field] = parsed;
        } catch {
          errors.push({ field, code: 'INVALID_JSON_ARRAY', message: 'Ô CSV phải chứa mảng JSON, ví dụ ["React", "Node.js"].' });
        }
      } else if (field === 'salary_min' || field === 'salary_max' || field === 'required_months') {
        const number = Number(content);
        if (!Number.isFinite(number)) errors.push({ field, code: 'INVALID_NUMBER', message: 'Giá trị phải là số hợp lệ.' });
        else value[field] = number;
      } else value[field] = content;
    }
    return { row: line, value, errors };
  });
}

function parseJson(source) {
  let parsed;
  try { parsed = JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch { throw new ApiError(400, 'INVALID_JSON', 'File JSON không đúng cú pháp.'); }
  let records;
  if (Array.isArray(parsed)) records = parsed;
  else if (parsed && typeof parsed === 'object' && parsed.schema_version === 1 && Array.isArray(parsed.jobs)
    && Object.keys(parsed).every(key => ['schema_version', 'jobs', 'exported_at'].includes(key))) records = parsed.jobs;
  else throw new ApiError(400, 'INVALID_JSON_STRUCTURE', 'JSON phải là mảng Job hoặc object { schema_version: 1, jobs: [] }.');
  return records.map((value, index) => ({ row: index + 1, value, errors: [] }));
}

export function parseJobImportFile(format, source) {
  const records = format === 'csv' ? parseCsv(source) : parseJson(source);
  if (!records.length) throw new ApiError(400, 'EMPTY_FILE', 'File chưa có Job để nhập.');
  if (records.length > 50) throw new ApiError(413, 'IMPORT_LIMIT_EXCEEDED', 'Mỗi lần nhập tối đa 50 Job.', [{ field: 'jobs', code: 'TOO_MANY_ROWS', limit: 50 }]);
  return records;
}

function csvValue(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return JSON.stringify(value);
  return String(value);
}

export function csvEscape(value) {
  let text = csvValue(value);
  if (/^[\t\r\n ]*[=+@-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeJobsCsv(jobs) {
  const header = JOB_IMPORT_FIELDS.join(',');
  const rows = jobs.map(job => JOB_IMPORT_FIELDS.map(field => csvEscape(job[field])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}

export function csvTemplate() {
  return `\uFEFF${JOB_IMPORT_FIELDS.join(',')}\r\n`;
}

export function jsonTemplate() {
  return JSON.stringify({ schema_version: 1, jobs: [] }, null, 2);
}
