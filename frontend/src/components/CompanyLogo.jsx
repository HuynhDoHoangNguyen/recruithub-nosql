import { useState } from 'react';

export default function CompanyLogo({ name = 'Doanh nghiệp', src, className = 'h-14 w-14' }) {
  const [failed, setFailed] = useState(null);
  return <span className={`${className} shrink-0 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-700 shadow-sm inline-flex items-center justify-center overflow-hidden`} title={name}>
    {src && failed !== src ? <img src={src} alt={`Logo ${name}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full bg-white object-contain p-1.5" onError={() => setFailed(src)} /> : <span aria-hidden="true" className="text-white font-extrabold text-sm">{name.trim().split(/\s+/).slice(0, 3).map(word => word[0]).join('').toUpperCase() || 'DN'}</span>}
  </span>;
}
