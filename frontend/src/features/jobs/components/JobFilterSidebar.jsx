export default function JobFilterSidebar({ metadata, filters, onChange, onReset, active, expanded, onExpand }) {
  const selected = filters.skills.split(',').filter(Boolean);
  const options = metadata.data;
  const isSelected = skill => selected.some(value => value.toLowerCase() === skill.toLowerCase());
  const skills = [...(options?.skills || [])].sort((left, right) => Number(isSelected(right)) - Number(isSelected(left)) || left.localeCompare(right));
  const radioGroup = (name, title, entries, all) => <fieldset className="space-y-2"><legend className="text-xs font-bold uppercase text-slate-500 mb-3">{title}</legend>
    {[{ value: '', label: all }, ...(entries || [])].map(option => <label key={option.value} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs cursor-pointer ${filters[name] === option.value ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600'}`}>
      <input className="accent-blue-600" type="radio" name={name} value={option.value} checked={filters[name] === option.value} onChange={() => onChange(name, option.value)} />{option.label}</label>)}</fieldset>;
  return <>
    <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-4"><h2 className="text-sm font-extrabold text-slate-800">🔍 Bộ lọc nâng cao</h2><button type="button" onClick={onReset} disabled={!active} className="text-xs text-blue-600 font-semibold disabled:text-slate-400">Xóa lọc</button></div>
    {metadata.loading && <p role="status" className="text-xs text-slate-500">Đang tải danh mục bộ lọc…</p>}
    {metadata.error && <p role="alert" className="text-xs text-red-600">Không tải được danh mục bộ lọc. Vui lòng tải lại trang.</p>}
    {radioGroup('work_mode', 'Hình thức làm việc', options?.work_modes, 'Tất cả hình thức')}
    {radioGroup('seniority', 'Cấp bậc & kinh nghiệm', options?.seniorities, 'Tất cả cấp bậc')}
    <label className="block text-xs font-bold uppercase text-slate-500">Địa điểm<select aria-label="Địa điểm" value={filters.location} onChange={event => onChange('location', event.target.value)} className="input-field mt-3 normal-case"><option value="">Tất cả địa điểm</option>{options?.locations.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <fieldset><legend className="text-xs font-bold uppercase text-slate-500 mb-3">Kỹ năng ({selected.length})</legend><p className="text-[11px] text-slate-400 mb-3">Khớp tất cả kỹ năng đã chọn · tối đa 8</p>
      <div className={`${expanded ? 'max-h-64' : 'max-h-44'} overflow-y-auto space-y-3 pr-1`}>{skills.slice(0, expanded ? undefined : Math.max(6, selected.length)).map(skill => <label key={skill} className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" className="accent-blue-600" checked={isSelected(skill)} disabled={selected.length >= 8 && !isSelected(skill)} onChange={() => onChange('skills', (isSelected(skill) ? selected.filter(item => item.toLowerCase() !== skill.toLowerCase()) : [...selected, skill]).join(','))} />{skill}</label>)}</div>
      {(options?.skills.length || 0) > 6 && <button type="button" aria-expanded={expanded} className="text-xs text-blue-600 font-semibold mt-4" onClick={onExpand}>{expanded ? 'Thu gọn ▲' : `Xem thêm (+${options.skills.length - 6}) ▼`}</button>}
    </fieldset>
    <label className="block text-xs font-bold uppercase text-slate-500">Ngành nghề<select aria-label="Ngành nghề" value={filters.industry} onChange={event => onChange('industry', event.target.value)} className="input-field mt-3 normal-case"><option value="">Tất cả ngành nghề</option>{options?.industries.map(industry => <option key={industry} value={industry}>{industry}</option>)}</select></label>
  </>;
}
