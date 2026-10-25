import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, CheckCircle2, FileText, GraduationCap, MapPin, Pencil, Phone, Save, Sparkles, Target, Undo2, UserRound } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/useAuth';
import FileUpload from '../components/uploads/FileUpload';
import PrivateAssetImage from '../components/uploads/PrivateAssetImage';
import ProfileSections from '../features/profile/ProfileSections';
import { candidateProfilePatch, profileCollectionChanged, updatedProfileItem, PROFILE_FIELDS, COLLECTION_FIELDS } from '../utils/candidateProfileForm';
import { candidateProfileErrors } from '../features/profile/profileValidation';
const copy = value => JSON.parse(JSON.stringify(value));
const readProfile = response => response.data?.data?.profile;
const profileTabs = [
  ['general', 'Thông tin chung', UserRound], ['skills', 'Kỹ năng & Chuyên môn', Sparkles],
  ['experience', 'Kinh nghiệm & Dự án', BriefcaseBusiness], ['education', 'Học vấn & Bằng cấp', GraduationCap], ['cv', 'CV Đính Kèm', FileText],
];
const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const saveLock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState('general');
  const auth = useAuth();
  const [showValidation, setShowValidation] = useState(false);
  const [touched, setTouched] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setConflict(false);
    try {
      const response = await api.get('/v1/candidate/profile/me');
      const data = readProfile(response);
      if (!data) throw new Error('Phản hồi hồ sơ không hợp lệ.');
      setProfile(copy(data));
      setEditing(false);
      setShowValidation(false); setTouched({});
      setBaseline(copy(data));
      setRevision(response.headers.etag?.replace(/^"|"$/g, '') || null);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || requestError.message || 'Không thể tải hồ sơ ứng viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeProfile = (field, value) => setProfile((current) => ({
    ...current,
    profile: { ...current.profile, [field]: field === 'years_experience' ? (value === '' ? 0 : Number(value)) : value },
  }));
  const changeItem = (collection, index, field, value) => setProfile((current) => ({
    ...current,
    [collection]: current[collection].map((item, itemIndex) => itemIndex === index ? updatedProfileItem(item, field, value) : item),
  }));
  const addItem = (collection) => {
    const emptyItems = {
      skills: { name: '', normalized: '' },
      education: { degree: 'BACHELOR' },
      experience: {},
      projects: { name: '', technologies: [] },
      languages: { name: '' },
    };
    setProfile((current) => ({ ...current, [collection]: [...(current[collection] || []), emptyItems[collection]] }));
  };
  const removeItem = (collection, index) => setProfile((current) => ({
    ...current,
    [collection]: current[collection].filter((_, itemIndex) => itemIndex !== index),
  }));

  const save = async (event) => {
    event.preventDefault();
    if (saveLock.current || uploading || !profile || !baseline || !editing || !changed) return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    setConflict(false);
    const patch = candidateProfilePatch(profile, baseline);
    const errors = candidateProfileErrors(profile, baseline);
    if (Object.keys(errors).length) {
      setShowValidation(true);
      const first = Object.keys(errors)[0].split('.')[0];
      setActive(({ profile: 'general', skills: 'skills', languages: 'skills', education: 'education', experience: 'experience', projects: 'experience' })[first] || 'general');
      setError('Vui lòng kiểm tra các trường được đánh dấu trước khi lưu.');
      setSaving(false); saveLock.current = false; return;
    }
    try {
      if (!revision) throw new Error('Thiếu phiên bản hồ sơ. Hãy tải lại trước khi lưu.');
      await api.patch('/v1/candidate/profile/me', patch, { headers: { 'If-Match': `"${revision}"` } });
      setNotice('Hồ sơ đã được lưu.');
      await load();
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        setConflict(true);
        setError('Hồ sơ đã được thay đổi ở phiên khác. Bản sửa hiện tại vẫn được giữ; tải phiên bản mới sẽ thay thế các sửa đổi này.');
      } else {
        setError(requestError.response?.data?.error?.message || requestError.message || 'Không thể lưu hồ sơ.');
      }
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  };

  const cancel = () => { setShowValidation(false); setTouched({}); setEditing(false); setProfile(copy(baseline)); setError(''); setNotice(''); setConflict(false); };

  if (loading) return <main className="rh-surface-page rh-candidate-profile flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50"><div role="status" className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-lg"><span className="loading-spinner" aria-hidden="true" />Đang tải hồ sơ…</div></main>;
  if (!profile) return <main className="rh-surface-page rh-candidate-profile min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-12 sm:px-6"><div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-lg"><div role="alert" className="message-error">{error || 'Không tìm thấy hồ sơ ứng viên.'}</div><button type="button" className="btn-primary mt-5" onClick={load}>Thử tải lại</button></div></main>;

  const allErrors = candidateProfileErrors(profile, baseline);
  const fieldErrors = Object.fromEntries(Object.entries(allErrors).filter(([key]) => showValidation || touched[key]));
  const onBlurField = path => setTouched(current => ({ ...current, [path]: true }));
  const fullName = profile.profile.full_name || auth?.user?.name || 'Hồ sơ của tôi';
  const initials = fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'UV';
  const checks = [profile.profile.full_name, profile.profile.role, profile.profile.summary, profile.profile.phone, profile.profile.location, profile.skills?.length, profile.education?.length, profile.experience?.length || profile.projects?.length, profile.resume_file, profile.avatar];
  const completion = Math.round(checks.filter(Boolean).length / checks.length * 100);
  const changed = Boolean(baseline && ((profile.resume_file?.asset_id || null) !== (baseline.resume_file?.asset_id || null) || (profile.avatar?.asset_id || null) !== (baseline.avatar?.asset_id || null) || COLLECTION_FIELDS.some(key => profileCollectionChanged(profile, baseline, key)) || !PROFILE_FIELDS.every(key => profile.profile[key] === baseline.profile[key])));
  const actions = editing ? <><button type="button" disabled={saving || uploading} onClick={cancel} className="btn-secondary text-sm"><Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />Hủy thay đổi</button><button type="submit" disabled={saving || uploading || !changed} className="btn-primary text-sm disabled:opacity-50"><Save className="mr-2 h-4 w-4" aria-hidden="true" />{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></> : <button type="button" onClick={() => { setEditing(true); setNotice(''); }} className="btn-primary text-sm"><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />Chỉnh sửa hồ sơ</button>;
  return <main className="rh-surface-page rh-candidate-profile min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-7 text-left sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <nav aria-label="Đường dẫn hồ sơ" className="mb-6 flex gap-3 text-xs text-slate-400"><Link to="/" className="hover:text-blue-600">Trang chủ</Link><span>/</span><span className="text-slate-700">Hồ Sơ & CV Cá Nhân</span></nav>
    <h1 className="sr-only">Hồ sơ của bạn</h1>
    {error && <div role="alert" className="message-error mb-5">{error}{conflict && <button type="button" onClick={load} className="ml-3 font-semibold underline">Tải phiên bản mới</button>}</div>}
    {notice && <div role="status" className="message-success mb-5">{notice}</div>}
    <form noValidate onSubmit={save}>
      <header className="rh-panel rh-account-header relative mb-7 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"><div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center"><div className="shrink-0 self-start"><PrivateAssetImage asset={profile.avatar} fallback={initials} className="h-28 w-28 sm:h-32 sm:w-32" />{editing && <FileUpload variant="button" kind="avatar" label="Ảnh đại diện ứng viên" value={profile.avatar} disabled={saving || uploading} onBusyChange={setUploading} onUploaded={avatar => setProfile(current => ({ ...current, avatar }))} onRemove={() => setProfile(current => ({ ...current, avatar: undefined }))} />}</div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{fullName}</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ứng Viên IT</span></div><p className="mt-2 break-all text-slate-500">{auth?.user?.email || ''}</p><p className="mt-2 text-sm text-slate-500">{profile.profile.role}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">{profile.profile.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-rose-500" />{profile.profile.location}</span>}{profile.profile.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-rose-500" />{profile.profile.phone}</span>}</div></div>
          <div className="flex flex-wrap gap-2 md:ml-auto">{actions}</div>
        </div>
        <div className="mt-7 border-t border-slate-100 pt-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm"><p className="flex items-center gap-2 font-semibold text-slate-700"><Target className="h-4 w-4 text-rose-500" />Độ hoàn thiện hồ sơ: <strong className="text-blue-600">{completion}%</strong></p><p className="flex items-center gap-1 text-xs text-slate-400">{completion === 100 ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" />Đã hoàn thiện hồ sơ</> : 'Bổ sung thông tin để nhà tuyển dụng hiểu bạn hơn'}</p></div><div role="progressbar" aria-label="Độ hoàn thiện hồ sơ" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all" style={{ width: `${completion}%` }} /></div></div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)]"><aside className="rh-panel rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24"><h2 className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Mục hồ sơ</h2><div role="tablist" aria-label="Các mục hồ sơ" aria-orientation="vertical" className="space-y-2">{profileTabs.map(([key, label, Icon]) => <button type="button" role="tab" key={key} id={`profile-tab-${key}`} aria-controls="profile-panel" aria-selected={active === key} onClick={() => setActive(key)} onKeyDown={event => { const index = profileTabs.findIndex(tab => tab[0] === key); const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0; if (delta) { event.preventDefault(); const next = profileTabs[(index + delta + profileTabs.length) % profileTabs.length][0]; setActive(next); document.getElementById(`profile-tab-${next}`)?.focus(); } }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition ${active === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</button>)}</div></aside>
        <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${active}`} className="min-w-0"><ProfileSections {...{ active, editing, profile, changeProfile, changeItem, addItem, removeItem, setProfile, uploading, saving, setUploading, fieldErrors, onBlurField }} email={auth?.user?.email || ''} /></div>
      </div>
      {editing && <div className="rh-panel sticky bottom-3 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-xs text-slate-500">{uploading ? 'Đang tải file lên…' : changed ? 'Bạn có thay đổi chưa lưu' : 'Các thay đổi sẽ được lưu cùng hồ sơ'}</p><button type="submit" disabled={saving || uploading || !changed} className="btn-primary text-sm disabled:opacity-50"><Save className="mr-2 h-4 w-4" aria-hidden="true" />Lưu thay đổi</button></div>}
    </form>
  </div></main>;
};
export default Profile;
