import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { useJobMetadata } from '../useJobMetadata';

export default function HomeJobSearch() {
  const metadata = useJobMetadata();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const list = useRef(null);
  useEffect(() => { list.current?.children[index]?.scrollIntoView?.({ block: 'nearest' }); }, [index]);
  const suggestions = (metadata.data?.skills || []).filter(value => value.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 7);
  const choose = value => { setQuery(value); setSkill(value); setOpen(false); setIndex(-1); };
  function search(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (skill && query === skill) params.set('skills', skill);
    else if (query.trim()) params.set('q', query.trim());
    navigate(`/jobs${params.size ? `?${params}` : ''}`);
  }
  return <div className="text-left"><form onSubmit={search} className="bg-white rounded-2xl border border-blue-100 p-3 flex flex-col md:flex-row items-stretch gap-3 shadow-xl shadow-slate-950/10 focus-within:ring-4 focus-within:ring-blue-300/15">
    <div className="relative flex-1 min-w-0 flex items-center gap-3 px-2"><Search className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" /><input role="combobox" aria-label="Tìm công việc" aria-expanded={open && suggestions.length > 0} aria-controls="home-skills" aria-autocomplete="list" aria-activedescendant={open && index >= 0 ? `home-skill-${index}` : undefined} autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setSkill(''); setOpen(true); setIndex(-1); }} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setIndex(-1); }} onKeyDown={event => {
      if (event.key === 'Escape') { setOpen(false); setIndex(-1); }
      if (['ArrowDown', 'ArrowUp'].includes(event.key) && suggestions.length) { event.preventDefault(); setOpen(true); setIndex(current => current < 0 ? (event.key === 'ArrowDown' ? 0 : suggestions.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length); }
      if (event.key === 'Enter' && open && index >= 0 && suggestions[index]) { event.preventDefault(); choose(suggestions[index]); }
    }} className="w-full py-2 text-sm text-slate-800 outline-none" placeholder="Tên công việc, kỹ năng (React, Node, DevOps…)" />
      {open && suggestions.length > 0 && <ul ref={list} id="home-skills" role="listbox" aria-label="Gợi ý kỹ năng" className="absolute z-20 top-full mt-3 left-0 right-0 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">{suggestions.map((value, itemIndex) => <li key={value} id={`home-skill-${itemIndex}`} role="option" aria-selected={index === itemIndex} onMouseDown={event => event.preventDefault()} onClick={() => choose(value)} className={`text-sm px-4 py-3 cursor-pointer text-slate-700 hover:bg-blue-50 ${index === itemIndex ? 'bg-blue-50' : ''}`}>{value}</li>)}</ul>}
    </div>
    <button className="btn-primary whitespace-nowrap flex gap-2 items-center justify-center" type="submit">Tìm Kiếm <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
  </form>{!!metadata.data?.skills?.length && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-[11px] text-blue-200/80">Gợi ý kỹ năng</span>{metadata.data.skills.slice(0, 6).map(value => <button type="button" key={value} onClick={() => navigate(`/jobs?${new URLSearchParams({ skills: value })}`)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-blue-300/40 hover:bg-blue-400/15 hover:text-white">{value}</button>)}</div>}{metadata.error && <p role="alert" className="mt-3 text-xs text-amber-200">Chưa tải được gợi ý kỹ năng và địa điểm. Bạn vẫn có thể tìm bằng từ khóa.</p>}</div>;
}
