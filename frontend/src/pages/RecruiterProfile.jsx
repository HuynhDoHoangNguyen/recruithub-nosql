import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, UserRound, Phone, MapPin, Save, X, BriefcaseBusiness, Sparkles, Globe } from 'lucide-react';
import FileUpload from '../components/uploads/FileUpload';
import { recruiterProfileApi } from '../api/jobApplicationApi';
import CompanyLogo from '../components/CompanyLogo';
import { Resource, ErrorMessage, Field } from '../features/applications/components/ApplicationUI';
import { useApiResource } from '../features/applications/useApiResource';
import { companyProfileErrors, phoneHint, recruiterProfileErrors } from '../features/profile/profileValidation';

const blankPerson = { full_name: '', phone: '', location: '', bio: '' };
const companyFields = ['name', 'industry', 'address', 'website', 'description'];
export default function RecruiterProfile() {
  const resource = useApiResource(recruiterProfileApi.get);
  const [tab, setTab] = useState('general');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="max-w-6xl mx-auto space-y-6">
    <nav aria-label="Đường dẫn" className="flex flex-wrap gap-2 text-xs text-slate-400"><Link to="/">Trang chủ</Link><span>/</span><span className="text-slate-700">Hồ Sơ Doanh Nghiệp</span></nav>
    <ErrorMessage error={error} />{message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
    <Resource resource={resource}>{resource.data && <ProfileEditor key={`${resource.data.recruiter._rev}/${resource.data.company._rev}`} data={resource.data} tab={tab} setTab={setTab} setError={setError} setMessage={setMessage} reload={resource.reload} />}</Resource>
  </div></main>;
}

function ProfileEditor({ data, tab, setTab, setError, setMessage, reload }) {
  const initialPerson = { ...blankPerson, ...data.recruiter.profile };
  const initialCompany = Object.fromEntries(companyFields.map(key => [key, data.company[key] || '']));
  const [person, setPerson] = useState(initialPerson);
  const [company, setCompany] = useState(initialCompany);
  const [logo, setLogo] = useState(data.company.logo_asset || null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [touched, setTouched] = useState({});
  const saveLock = useRef(false);
  const errors = tab === 'general' ? recruiterProfileErrors(person) : companyProfileErrors(company);
  const fieldError = key => showValidation || touched[key] ? errors[key] : undefined;
  const completed = [person.full_name, person.phone, person.location, person.bio, company.name, company.industry].filter(value => value.trim()).length;
  const percent = Math.round(completed / 6 * 100);
  const props = (key, business = false) => {
    const path = `${business ? 'company' : 'profile'}.${key}`, id = `${business ? 'company' : 'recruiter'}-${key}`;
    return { id, value: (business ? company : person)[key], disabled: busy,
      'aria-invalid': Boolean(fieldError(path)), 'aria-describedby': fieldError(path) ? `${id}-error` : key === 'phone' ? `${id}-hint` : undefined,
      onBlur: () => setTouched(current => ({ ...current, [path]: true })),
      onChange: event => { (business ? setCompany : setPerson)(previous => ({ ...previous, [key]: event.target.value })); setMessage(''); },
      className: `input-field mt-2 ${fieldError(path) ? '!border-rose-400 focus:!ring-rose-100' : ''}` };
  };
  async function save(event) {
    event.preventDefault(); if (uploading || saveLock.current) return; setError(null); setMessage('');
    if (Object.keys(errors).length) { setShowValidation(true); setError(new Error('Vui lòng kiểm tra các trường được đánh dấu trước khi lưu.')); return; }
    saveLock.current = true; setBusy(true);
    try {
      if (tab === 'general') await recruiterProfileApi.update({ expected_rev: data.recruiter._rev, profile: person });
      else await recruiterProfileApi.updateCompany({ expected_rev: data.company._rev, company: { ...Object.fromEntries(Object.entries(company).map(([key, value]) => [key, value.trim() || (['name', 'industry'].includes(key) ? '' : null)])), ...(logoChanged ? { logo_asset_id: logo?.asset_id || null } : {}) } });
      setMessage(tab === 'general' ? 'Đã lưu thông tin liên hệ.' : 'Đã lưu thông tin công ty.'); await reload();
    } catch (failure) { setError(failure); if (failure.status === 409) await reload(); }
    finally { setBusy(false); saveLock.current = false; }
  }
  function cancel() { setShowValidation(false); setTouched({}); setPerson(initialPerson); setCompany(initialCompany); setLogo(data.company.logo_asset || null); setLogoChanged(false); setError(null); setMessage('Đã hủy các thay đổi chưa lưu.'); }
  return <form id="recruiter-profile-form" noValidate onSubmit={save} className="space-y-6">
    <header className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" /><div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5"><CompanyLogo name={person.full_name || 'Nhà tuyển dụng'} className="h-24 w-24" /><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{person.full_name || 'Hồ sơ nhà tuyển dụng'}</h1><span className="inline-flex gap-1.5 items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700"><BriefcaseBusiness className="h-3 w-3" aria-hidden="true" />Nhà Tuyển Dụng</span></div>
        <p className="mt-2 text-sm text-slate-500 break-all">{data.email}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex gap-1 items-center"><MapPin className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />{person.location || 'Chưa cập nhật địa điểm'}</span><span className="inline-flex gap-1 items-center"><Phone className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />{person.phone || 'Chưa cập nhật số điện thoại'}</span><span className="inline-flex gap-1 items-center"><Building2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />{data.company.name}</span></div></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || uploading} onClick={cancel} className="btn-secondary inline-flex items-center gap-2 text-xs"><X className="h-4 w-4" aria-hidden="true" />Hủy</button><button type="submit" disabled={busy || uploading} className="btn-primary inline-flex items-center gap-2 text-xs"><Save className="h-4 w-4" aria-hidden="true" />{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </div><div className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 flex flex-wrap justify-between gap-2 text-xs"><p className="flex gap-2 items-center text-slate-600"><Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />Độ hoàn thiện hồ sơ: <strong className="text-blue-600">{percent}%</strong></p><span className="text-slate-400">Đã bổ sung {completed}/6 mục</span></div><div role="progressbar" aria-label="Độ hoàn thiện hồ sơ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 rounded-full bg-slate-100 overflow-hidden"><div style={{ width: `${percent}%` }} className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" /></div></div>
    </div></header>
    <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start"><aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="uppercase text-xs font-bold text-slate-400 px-3 py-3">Mục hồ sơ</p><div role="tablist" aria-label="Mục hồ sơ doanh nghiệp" className="space-y-2">{[['general', 'Thông tin chung', UserRound], ['company', 'Thông tin công ty', Building2]].map(([value, label, Icon]) => <button key={value} id={`tab-${value}`} role="tab" type="button" aria-selected={tab === value} aria-controls={`panel-${value}`} disabled={busy || uploading} onClick={() => { setShowValidation(false); setTab(value); setError(null); }} className={`w-full rounded-xl px-4 py-3 text-left text-xs font-bold inline-flex items-center gap-3 ${tab === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" aria-hidden="true" />{label}</button>)}</div></aside>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm min-w-0"><div className="border-b border-slate-100 pb-5 mb-6"><h2 className="font-extrabold text-slate-900 flex items-center gap-2">{tab === 'general' ? <UserRound className="h-5 w-5 text-purple-700" aria-hidden="true" /> : <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />}{tab === 'general' ? 'Thông Tin Cơ Bản' : 'Thông Tin Công Ty'}</h2><p className="text-xs text-slate-400 mt-2">{tab === 'general' ? 'Thông tin liên hệ trực tiếp cho nhà tuyển dụng' : 'Thông tin này hiển thị trên các tin tuyển dụng của công ty.'}</p></div>
        {tab === 'general' ? <div className="grid sm:grid-cols-2 gap-5"><Field label="Họ và tên" name="recruiter-full_name" error={fieldError('profile.full_name')}><input {...props('full_name')} maxLength={160} /></Field><Field label="Email liên hệ" name="recruiter-email"><input id="recruiter-email" value={data.email} readOnly className="input-field mt-2 bg-slate-50 text-slate-500" /></Field><Field label="Số điện thoại" name="recruiter-phone" error={fieldError('profile.phone')}><input {...props('phone')} type="tel" autoComplete="tel" placeholder="VD: 0912345678 hoặc +84 912 345 678" maxLength={40} /><p id="recruiter-phone-hint" className="mt-2 text-xs leading-5 text-slate-400">{phoneHint}</p></Field><Field label="Tỉnh / Thành phố" name="recruiter-location" error={fieldError('profile.location')}><input {...props('location')} maxLength={200} /></Field><div className="sm:col-span-2"><Field label="Giới thiệu tóm tắt (Bio / Summary)" name="recruiter-bio" error={fieldError('profile.bio')}><textarea {...props('bio')} rows={5} maxLength={3000} /></Field></div></div>
          : <div className="space-y-5"><div className="flex gap-4 items-center rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><CompanyLogo name={company.name} src={logoChanged ? (logo ? `/api/v1/media/company-logos/${encodeURIComponent(logo.asset_id)}` : undefined) : data.company.logo_url} className="h-20 w-20" /><div><p className="font-bold text-slate-800">{company.name}</p><p className="text-xs text-slate-500 mt-1">Phòng ban: {data.department.name}</p></div></div><div className="grid sm:grid-cols-2 gap-5"><Field label="Tên công ty *" name="company-name" error={fieldError('company.name')}><input {...props('name', true)} required maxLength={200} /></Field><Field label="Ngành nghề *" name="company-industry" error={fieldError('company.industry')}><input {...props('industry', true)} required maxLength={120} /></Field><Field label="Website" name="company-website" error={fieldError('company.website')}><div className="relative"><Globe className="absolute left-3 top-5 h-4 w-4 text-slate-400" aria-hidden="true" /><input {...props('website', true)} type="url" placeholder="https://congty.vn" className="input-field mt-2 pl-9" /></div></Field><div className="sm:col-span-2 space-y-3"><FileUpload kind="company-logo" label="Tải logo công ty từ máy tính" value={logo} disabled={busy} onBusyChange={setUploading} onUploaded={file => { setLogo(file); setLogoChanged(true); }} onRemove={() => { setLogo(null); setLogoChanged(true); }} />{!logo && data.company.logo_url && !logoChanged && <button type="button" disabled={busy || uploading} onClick={() => setLogoChanged(true)} className="text-xs text-rose-600 font-semibold">Xóa logo hiện tại</button>}<p className="text-xs text-slate-400">Logo sẽ xuất hiện trên các tin tuyển dụng sau khi lưu thay đổi.</p></div></div><Field label="Địa chỉ công ty" name="company-address" error={fieldError('company.address')}><input {...props('address', true)} maxLength={500} /></Field><Field label="Giới thiệu công ty" name="company-description" error={fieldError('company.description')}><textarea {...props('description', true)} rows={5} maxLength={5000} /></Field></div>}
      </section></div>
  </form>;
}
