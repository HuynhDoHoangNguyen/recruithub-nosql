import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Check, Globe, MapPin, Pencil, Phone, Save, Sparkles, UserRound, X } from 'lucide-react';
import FileUpload from '../components/uploads/FileUpload';
import { recruiterProfileApi } from '../api/jobApplicationApi';
import CompanyLogo from '../components/CompanyLogo';
import { Resource, ErrorMessage, Field } from '../features/applications/components/ApplicationUI';
import { useApiResource } from '../features/applications/useApiResource';
import { companyProfileErrors, phoneHint, recruiterProfileErrors } from '../features/profile/profileValidation';

const blankPerson = { full_name: '', phone: '', location: '', bio: '' };
const companyFields = ['name', 'industry', 'address', 'website', 'description'];
const valuesChanged = (left, right, fields) => fields.some(key => (left[key] || '') !== (right[key] || ''));

export default function RecruiterProfile() {
  const resource = useApiResource(recruiterProfileApi.get);
  const [tab, setTab] = useState('general');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  return <main className="rh-surface-page rh-company-profile min-h-screen bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <nav aria-label="Đường dẫn hồ sơ" className="flex items-center gap-2 text-xs text-slate-300"><Link to="/" className="hover:text-white">Trang chủ</Link><span aria-hidden="true">/</span><span className="font-semibold text-white">Hồ sơ doanh nghiệp</span></nav>
      {error && <ErrorMessage error={error} />}
      {message && <p role="status" className="rh-profile-notice rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      <Resource resource={resource}>{resource.data && <ProfileEditor key={`${resource.data.recruiter._rev}/${resource.data.company._rev}`} data={resource.data} tab={tab} setTab={setTab} setError={setError} setMessage={setMessage} reload={resource.reload} />}</Resource>
    </div>
  </main>;
}

function ProfileEditor({ data, tab, setTab, setError, setMessage, reload }) {
  const initialPerson = { ...blankPerson, ...data.recruiter.profile };
  const initialCompany = Object.fromEntries(companyFields.map(key => [key, data.company[key] || '']));
  const [person, setPerson] = useState(initialPerson);
  const [company, setCompany] = useState(initialCompany);
  const [logo, setLogo] = useState(data.company.logo_asset || null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [touched, setTouched] = useState({});
  const saveLock = useRef(false);
  const errors = tab === 'general' ? recruiterProfileErrors(person) : companyProfileErrors(company);
  const personChanged = valuesChanged(person, initialPerson, Object.keys(blankPerson));
  const companyChanged = valuesChanged(company, initialCompany, companyFields) || logoChanged;
  const hasChanges = tab === 'general' ? personChanged : companyChanged;
  const completed = [person.full_name, person.phone, person.location, person.bio].filter(value => value.trim()).length;
  const percent = Math.round(completed / 4 * 100);
  const fieldError = key => showValidation || touched[key] ? errors[key] : undefined;

  const props = (key, business = false) => {
    const path = `${business ? 'company' : 'profile'}.${key}`, id = `${business ? 'company' : 'recruiter'}-${key}`;
    return {
      id, value: (business ? company : person)[key] || '', readOnly: !editing, disabled: busy,
      'aria-invalid': Boolean(fieldError(path)),
      'aria-describedby': [fieldError(path) && `${id}-error`, key === 'phone' && !business && `${id}-hint`].filter(Boolean).join(' ') || undefined,
      onBlur: () => setTouched(current => ({ ...current, [path]: true })),
      onChange: event => { (business ? setCompany : setPerson)(previous => ({ ...previous, [key]: event.target.value })); setMessage(''); },
      className: `input-field rh-profile-input mt-2 ${fieldError(path) ? '!border-rose-400 focus:!ring-rose-100' : ''}`,
    };
  };

  function changeTab(next) {
    if (hasChanges) {
      setMessage('Hãy lưu hoặc hủy thay đổi trong mục hiện tại trước khi chuyển mục.');
      return;
    }
    setTab(next); setError(null); setMessage(''); setShowValidation(false); setTouched({});
  }

  async function save(event) {
    event.preventDefault();
    if (!editing || !hasChanges || uploading || busy || saveLock.current) return;
    setError(null); setMessage('');
    if (Object.keys(errors).length) { setShowValidation(true); setError(new Error('Vui lòng kiểm tra các trường được đánh dấu trước khi lưu.')); return; }
    saveLock.current = true; setBusy(true);
    try {
      if (tab === 'general') await recruiterProfileApi.update({ expected_rev: data.recruiter._rev, profile: person });
      else await recruiterProfileApi.updateCompany({
        expected_rev: data.company._rev,
        company: {
          ...Object.fromEntries(Object.entries(company).map(([key, value]) => [key, value.trim() || (['name', 'industry'].includes(key) ? '' : null)])),
          ...(logoChanged ? { logo_asset_id: logo?.asset_id || null } : {}),
        },
      });
      setEditing(false); setShowValidation(false); setTouched({});
      setMessage(tab === 'general' ? 'Đã lưu thông tin liên hệ.' : 'Đã lưu thông tin công ty.');
      await reload();
    } catch (failure) {
      setError(failure);
      if (failure.status === 409) await reload();
    } finally { setBusy(false); saveLock.current = false; }
  }

  function startEditing() { setEditing(true); setError(null); setMessage(''); }
  function cancel() {
    if (tab === 'general') setPerson(initialPerson);
    else { setCompany(initialCompany); setLogo(data.company.logo_asset || null); setLogoChanged(false); }
    setEditing(false); setShowValidation(false); setTouched({}); setError(null); setMessage('Đã hủy các thay đổi chưa lưu.');
  }

  const companyLogoSrc = logoChanged ? (logo ? `/api/v1/media/company-logos/${encodeURIComponent(logo.asset_id)}` : undefined) : data.company.logo_url;
  const saveLabel = tab === 'general' ? 'Lưu thông tin cá nhân' : 'Lưu hồ sơ công ty';

  return <form id="recruiter-profile-form" noValidate onSubmit={save} className="space-y-5">
    <header className="rh-panel rh-account-header rh-profile-hero overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div aria-hidden="true" className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <CompanyLogo name={person.full_name || 'Nhà tuyển dụng'} src={companyLogoSrc} className="h-16 w-16 shrink-0 rounded-2xl sm:h-20 sm:w-20" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Không gian nhà tuyển dụng</p>
            <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{person.full_name || 'Hồ sơ nhà tuyển dụng'}</h1><span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">Recruiter</span></div>
            <p className="mt-1 break-all text-sm text-slate-500">{data.email}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />{person.location || 'Chưa cập nhật địa điểm'}</span>
              <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />{person.phone || 'Chưa cập nhật số điện thoại'}</span>
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />{data.company.name}</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"><Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />Mức hoàn thiện cá nhân</span><b className="text-sm text-blue-700">{percent}%</b></div>
          <div role="progressbar" aria-label="Mức hoàn thiện hồ sơ cá nhân" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-slate-200"><div style={{ width: `${percent}%` }} className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all" /></div>
          <p className="mt-2 text-xs text-slate-500">Đã bổ sung {completed}/4 mục liên hệ.</p>
        </div>
      </div>
    </header>

    <div className="rh-profile-layout grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="rh-panel rh-profile-nav rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
        <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-slate-400">Danh mục hồ sơ</p>
        <div role="tablist" aria-label="Mục hồ sơ doanh nghiệp" className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <button id="tab-general" role="tab" type="button" aria-selected={tab === 'general'} aria-controls="panel-general" disabled={busy || uploading} onClick={() => changeTab('general')} className={`rh-profile-tab inline-flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm font-semibold transition ${tab === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50'}`}><UserRound className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">Thông tin cá nhân</span></button>
          <button id="tab-company" role="tab" type="button" aria-selected={tab === 'company'} aria-controls="panel-company" disabled={busy || uploading} onClick={() => changeTab('company')} className={`rh-profile-tab inline-flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm font-semibold transition ${tab === 'company' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50'}`}><Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">Thông tin công ty</span></button>
        </div>
        <div className="mx-3 mt-4 hidden border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500 lg:block">Thông tin công ty hiển thị trên các tin tuyển dụng của doanh nghiệp.</div>
      </aside>

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rh-panel rh-profile-content min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-blue-600">{tab === 'general' ? 'Tài khoản' : 'Thương hiệu tuyển dụng'}</p><h2 className="mt-1 flex items-center gap-2 text-xl font-extrabold text-slate-900">{tab === 'general' ? <UserRound className="h-5 w-5 text-blue-600" aria-hidden="true" /> : <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />}{tab === 'general' ? 'Thông tin cá nhân' : 'Thông tin công ty'}</h2><p className="mt-1 text-sm text-slate-500">{tab === 'general' ? 'Cập nhật thông tin liên hệ của bạn.' : 'Các nội dung này có thể xuất hiện trên trang tuyển dụng.'}</p></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${editing ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{editing ? 'Đang chỉnh sửa' : 'Chế độ xem'}</span>
        </div>

        {tab === 'general' ? <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
          <Field label="Họ và tên" name="recruiter-full_name" error={fieldError('profile.full_name')}><input {...props('full_name')} maxLength={160} autoComplete="name" placeholder="Nguyễn Văn An" /></Field>
          <Field label="Email tài khoản" name="recruiter-email"><input id="recruiter-email" value={data.email} readOnly className="input-field rh-profile-input mt-2 bg-slate-50 text-slate-500" /><span className="mt-1.5 block text-xs text-slate-400">Email được quản lý riêng trong tài khoản.</span></Field>
          <Field label="Số điện thoại" name="recruiter-phone" error={fieldError('profile.phone')}><input {...props('phone')} type="tel" autoComplete="tel" placeholder="0912 345 678" maxLength={40} /><span id="recruiter-phone-hint" className="mt-1.5 block text-xs text-slate-400">{phoneHint}</span></Field>
          <Field label="Tỉnh / thành phố" name="recruiter-location" error={fieldError('profile.location')}><input {...props('location')} autoComplete="address-level1" maxLength={200} placeholder="Ví dụ: TP. Hồ Chí Minh" /></Field>
          <div className="sm:col-span-2"><Field label="Giới thiệu ngắn" name="recruiter-bio" error={fieldError('profile.bio')}><textarea {...props('bio')} rows={5} maxLength={3000} placeholder="Chia sẻ vai trò của bạn và lĩnh vực đang tuyển dụng…" className={`input-field rh-profile-input mt-2 w-full resize-y ${fieldError('profile.bio') ? '!border-rose-400' : ''}`} /></Field><p className="mt-1.5 text-right text-xs text-slate-400">{person.bio.length}/3000</p></div>
        </div> : <div className="space-y-6">
          <div className="rh-company-summary flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4 sm:flex-row sm:items-center">
            <CompanyLogo name={company.name} src={companyLogoSrc} className="h-16 w-16 rounded-2xl" />
            <div className="min-w-0 flex-1"><p className="break-words text-base font-bold text-slate-900">{company.name || 'Tên công ty'}</p><p className="mt-1 text-sm text-slate-500">{company.industry || 'Chưa cập nhật ngành nghề'} <span className="px-1.5 text-slate-300">·</span> Phòng ban: {data.department.name}</p></div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"><Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />Liên kết tổ chức</span>
          </div>
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <Field label="Tên công ty *" name="company-name" error={fieldError('company.name')}><input {...props('name', true)} required maxLength={200} placeholder="Tên doanh nghiệp" /></Field>
            <Field label="Ngành nghề *" name="company-industry" error={fieldError('company.industry')}><input {...props('industry', true)} required maxLength={120} placeholder="Ví dụ: Công nghệ thông tin" /></Field>
            <Field label="Website" name="company-website" error={fieldError('company.website')}><div className="relative"><Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input {...props('website', true)} type="url" placeholder="https://congty.vn" className={`input-field rh-profile-input mt-2 w-full pl-9 ${fieldError('company.website') ? '!border-rose-400' : ''}`} /></div></Field>
            <Field label="Địa chỉ công ty" name="company-address" error={fieldError('company.address')}><input {...props('address', true)} autoComplete="street-address" maxLength={500} placeholder="Số nhà, đường, tỉnh/thành" /></Field>
            <div className="sm:col-span-2"><Field label="Giới thiệu công ty" name="company-description" error={fieldError('company.description')}><textarea {...props('description', true)} rows={5} maxLength={5000} placeholder="Mô tả ngắn về doanh nghiệp và môi trường làm việc…" className={`input-field rh-profile-input mt-2 w-full resize-y ${fieldError('company.description') ? '!border-rose-400' : ''}`} /></Field><p className="mt-1.5 text-right text-xs text-slate-400">{company.description.length}/5000</p></div>
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              {editing ? <FileUpload kind="company-logo" label="Logo công ty" value={logo} disabled={busy} onBusyChange={setUploading} onUploaded={file => { setLogo(file); setLogoChanged(true); }} onRemove={() => { setLogo(null); setLogoChanged(true); }} /> : <div className="flex items-center gap-4"><CompanyLogo name={company.name} src={companyLogoSrc} className="h-14 w-14 rounded-xl" /><div><p className="text-sm font-semibold text-slate-800">{data.company.logo_asset || data.company.logo_url ? 'Logo đang sử dụng' : 'Chưa có logo công ty'}</p><p className="mt-1 text-xs text-slate-500">Logo được hiển thị trên trang tuyển dụng của doanh nghiệp.</p></div></div>}
              {editing && <p className="mt-3 text-xs leading-5 text-slate-500">Tải logo JPG, PNG hoặc WEBP dưới 5 MB. Thay đổi có hiệu lực sau khi lưu hồ sơ công ty.</p>}
              {!logo && data.company.logo_url && !logoChanged && editing && <button type="button" disabled={busy || uploading} onClick={() => setLogoChanged(true)} className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700">Gỡ logo đang dùng</button>}
            </div>
          </div>
        </div>}

        <footer className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{uploading ? 'Đang tải logo lên…' : hasChanges ? 'Bạn có thay đổi chưa lưu.' : editing ? 'Lưu để áp dụng thay đổi.' : 'Thông tin chỉ được lưu khi bạn chọn chỉnh sửa.'}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {editing ? <><button type="button" disabled={busy || uploading} onClick={cancel} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" aria-hidden="true" />Hủy</button><button type="submit" disabled={busy || uploading || !hasChanges} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{busy ? 'Đang lưu…' : saveLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button></> : <button type="button" onClick={startEditing} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Pencil className="h-4 w-4" aria-hidden="true" />Chỉnh sửa mục này</button>}
          </div>
        </footer>
      </section>
    </div>
  </form>;
}
