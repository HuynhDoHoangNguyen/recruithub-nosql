import { useCallback, useEffect, useRef, useState } from 'react';
import { FaBriefcase, FaGraduationCap, FaLightbulb, FaPlus, FaSave, FaUndo, FaUser, FaTrash } from 'react-icons/fa';
import api from '../services/api';
import { candidateProfilePatch, hasInvalidDateRange, profileCollectionChanged, updatedProfileItem } from '../utils/candidateProfileForm';

const copy = (value) => JSON.parse(JSON.stringify(value));
const readProfile = (response) => response.data?.data?.profile;
const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelClass = 'block text-sm font-semibold text-slate-700';

function SectionHeading({ icon: Icon, title, description }) {
  return <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon aria-hidden="true" /></span><div><h2 className="text-base font-bold text-slate-900">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div></div>;
}

function TextField({ label, value, onChange, type = 'text', ...props }) {
  return <label className={labelClass}>{label}<input className={inputClass} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function CollectionSection({ title, description, icon, children, onAdd, addLabel }) {
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-7">
    <SectionHeading icon={icon} title={title} description={description} />
    <div className="space-y-4">{children}</div>
    <button type="button" onClick={onAdd} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><FaPlus aria-hidden="true" />{addLabel}</button>
  </section>;
}

function RemoveButton({ onClick, label }) {
  return <button type="button" onClick={onClick} aria-label={label} className="mt-1 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><FaTrash aria-hidden="true" />Xóa mục</button>;
}

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const saveLock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setConflict(false);
    try {
      const response = await api.get('/v1/candidate/profile/me');
      const data = readProfile(response);
      if (!data) throw new Error('Phản hồi hồ sơ không hợp lệ.');
      setProfile(copy(data));
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
    };
    setProfile((current) => ({ ...current, [collection]: [...current[collection], emptyItems[collection]] }));
  };
  const removeItem = (collection, index) => setProfile((current) => ({
    ...current,
    [collection]: current[collection].filter((_, itemIndex) => itemIndex !== index),
  }));

  const save = async (event) => {
    event.preventDefault();
    if (saveLock.current || !profile || !baseline) return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    setConflict(false);
    const patch = candidateProfilePatch(profile, baseline);
    if (!profile.profile.full_name?.trim() || !profile.profile.role?.trim() || !profile.profile.industry?.trim()) {
      setError('Họ tên, vị trí mong muốn và ngành nghề không được để trống.');
      setSaving(false);
      saveLock.current = false;
      return;
    }
    if (!Number.isInteger(profile.profile.years_experience) || profile.profile.years_experience < 0 || profile.profile.years_experience > 80) {
      setError('Số năm kinh nghiệm phải là số nguyên từ 0 đến 80.');
      setSaving(false);
      saveLock.current = false;
      return;
    }
    if (baseline.profile.summary && !profile.profile.summary?.trim()) {
      setError('API hiện tại không cho xóa phần giới thiệu đã có. Hãy nhập nội dung thay thế; quy tắc xóa cần được thống nhất ở contract.');
      setSaving(false);
      saveLock.current = false;
      return;
    }
    const invalidSkill = (patch.skills || []).some((item) => !item.name?.trim() || !item.normalized?.trim());
    const normalizedSkills = (patch.skills || []).map((item) => (item.normalized || '').normalize('NFKC').trim().toLowerCase());
    const duplicateSkills = new Set(normalizedSkills).size !== normalizedSkills.length;
    const invalidEducation = (patch.education || []).some((item) => !item.degree);
    const invalidProject = (patch.projects || []).some((item) => !item.name?.trim() || !Array.isArray(item.technologies));
    if (invalidSkill || duplicateSkills || invalidEducation || invalidProject) {
      setError('Hoàn thiện các trường bắt buộc trong kỹ năng, học vấn và dự án trước khi lưu.');
      setSaving(false);
      saveLock.current = false;
      return;
    }
    if (hasInvalidDateRange(profile.education, baseline.education) || hasInvalidDateRange(profile.experience, baseline.experience)) {
      setError('Ngày kết thúc không được trước ngày bắt đầu. Hãy kiểm tra lại mục học vấn hoặc kinh nghiệm.');
      setSaving(false);
      saveLock.current = false;
      return;
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

  const cancel = () => { setProfile(copy(baseline)); setError(''); setNotice(''); setConflict(false); };

  if (loading) return <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50"><div role="status" className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-lg"><span className="loading-spinner" aria-hidden="true" />Đang tải hồ sơ…</div></main>;
  if (!profile) return <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-12 sm:px-6"><div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-lg"><div role="alert" className="message-error">{error || 'Không tìm thấy hồ sơ ứng viên.'}</div><button type="button" className="btn-primary mt-5" onClick={load}>Thử tải lại</button></div></main>;

  const fullName = profile.profile.full_name || 'Hồ sơ của tôi';
  const initials = fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'C';
  const completionFields = ['full_name', 'role', 'industry', 'seniority', 'years_experience', 'summary'];
  const completion = Math.round((completionFields.filter((key) => Boolean(profile.profile[key])).length / completionFields.length) * 100);
  const changed = Boolean(baseline && (['skills', 'education', 'experience', 'projects'].some((key) => profileCollectionChanged(profile, baseline, key)) || !['full_name', 'role', 'industry', 'seniority', 'years_experience', 'summary'].every((key) => profile.profile[key] === baseline.profile[key])));

  return <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 text-left sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Không gian ứng viên</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Hồ sơ của bạn</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Quản lý thông tin nghề nghiệp và từng mục trong hồ sơ của bạn.</p></div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Hồ sơ cá nhân</span>
      </header>
      {error && <div role="alert" className="message-error mb-5 shadow-sm">{error}{conflict && <button type="button" onClick={load} className="ml-3 font-semibold underline">Tải phiên bản mới</button>}</div>}
      {notice && <div role="status" className="message-success mb-5 shadow-sm">{notice}</div>}

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
            <div className="h-20 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500" /><div className="px-5 pb-5">
              <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-2xl font-bold text-blue-700 shadow-md">{initials}</div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">{fullName}</h2><p className="mt-1 text-sm text-slate-500">{profile.profile.role || 'Chưa cập nhật vị trí mong muốn'}</p>
              <div className="mt-4 flex flex-wrap gap-2">{profile.profile.industry && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{profile.profile.industry}</span>}{profile.profile.seniority && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{profile.profile.seniority}</span>}</div>
              <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">Mức độ hoàn thiện</span><span className="font-bold text-blue-700">{completion}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all" style={{ width: `${completion}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">Bổ sung phần giới thiệu và thông tin nghề nghiệp để hoàn thiện hồ sơ.</p></div>
            </div>
          </section>
          <section className="rounded-2xl border border-blue-100 bg-blue-50/80 p-5 shadow-sm"><div className="flex gap-3"><FaLightbulb className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" /><div><h3 className="text-sm font-bold text-slate-800">Mẹo hồ sơ</h3><p className="mt-1 text-sm leading-6 text-slate-600">Thêm thông tin thật về kỹ năng và kinh nghiệm; các mục hiện có được giữ nguyên khi bạn sửa từng trường.</p></div></div></section>
        </aside>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-7">
            <SectionHeading icon={FaUser} title="Thông tin nghề nghiệp" description="Thông tin cơ bản theo hồ sơ Candidate hiện tại." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Họ và tên" value={profile.profile.full_name} onChange={(value) => changeProfile('full_name', value)} maxLength={120} autoComplete="name" />
              <TextField label="Vị trí mong muốn" value={profile.profile.role} onChange={(value) => changeProfile('role', value)} maxLength={120} />
              <TextField label="Ngành nghề" value={profile.profile.industry} onChange={(value) => changeProfile('industry', value)} maxLength={80} />
              <label className={labelClass}>Cấp độ<select className={inputClass} value={profile.profile.seniority} onChange={(event) => changeProfile('seniority', event.target.value)}><option value="JUNIOR">Junior</option><option value="MID">Mid-level</option><option value="SENIOR">Senior</option></select></label>
              <TextField label="Số năm kinh nghiệm" type="number" min="0" max="80" value={profile.profile.years_experience} onChange={(value) => changeProfile('years_experience', value)} />
              <div className="flex items-end rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><FaBriefcase className="mr-2 shrink-0 text-blue-600" aria-hidden="true" />Thông tin được lưu trong hồ sơ Candidate.</div>
            </div>
            <label className={`${labelClass} mt-4`}>Giới thiệu<textarea className={inputClass} rows="4" value={profile.profile.summary || ''} onChange={(event) => changeProfile('summary', event.target.value)} maxLength={4000} placeholder="Chia sẻ ngắn về kinh nghiệm, thế mạnh và mục tiêu nghề nghiệp…" /></label>
          </section>

          <CollectionSection title="Kỹ năng" description="Thêm, sửa hoặc xóa từng kỹ năng." icon={FaLightbulb} addLabel="Thêm kỹ năng" onAdd={() => addItem('skills')}>
            {profile.skills.map((skill, index) => <div key={`skill-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><TextField label={`Tên kỹ năng ${index + 1}`} value={skill.name} onChange={(value) => changeItem('skills', index, 'name', value)} maxLength={120} placeholder="Ví dụ: React" /><RemoveButton label={`Xóa kỹ năng ${index + 1}`} onClick={() => removeItem('skills', index)} /></div>)}
            {profile.skills.length === 0 && <p className="text-sm text-slate-500">Chưa có kỹ năng. Bạn có thể thêm kỹ năng khi sẵn sàng.</p>}
          </CollectionSection>

          <CollectionSection title="Học vấn" description="Bằng cấp và thông tin học tập theo Candidate schema." icon={FaGraduationCap} addLabel="Thêm học vấn" onAdd={() => addItem('education')}>
            {profile.education.map((item, index) => <div key={`education-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <label className={labelClass}>Bằng cấp<select className={inputClass} value={item.degree || 'BACHELOR'} onChange={(event) => changeItem('education', index, 'degree', event.target.value)}><option value="HIGH_SCHOOL">Trung học</option><option value="BACHELOR">Cử nhân</option><option value="MASTER">Thạc sĩ</option><option value="DOCTORATE">Tiến sĩ</option></select></label>
              <TextField label="Trường" value={item.institution} onChange={(value) => changeItem('education', index, 'institution', value)} maxLength={200} />
              <TextField label="Chuyên ngành" value={item.field_of_study} onChange={(value) => changeItem('education', index, 'field_of_study', value)} maxLength={200} />
              <TextField label="Ngày bắt đầu (nếu có)" value={item.start_date} onChange={(value) => changeItem('education', index, 'start_date', value)} placeholder="YYYY-MM hoặc ISO date" />
              <TextField label="Ngày kết thúc (nếu có)" value={item.end_date} onChange={(value) => changeItem('education', index, 'end_date', value)} placeholder="YYYY-MM hoặc ISO date" />
              <div className="sm:col-span-2"><RemoveButton label={`Xóa mục học vấn ${index + 1}`} onClick={() => removeItem('education', index)} /></div>
            </div>)}
            {profile.education.length === 0 && <p className="text-sm text-slate-500">Chưa có thông tin học vấn.</p>}
          </CollectionSection>

          <CollectionSection title="Kinh nghiệm làm việc" description="Mỗi mục giữ nguyên employer, role, ngày tháng và mô tả hiện có." icon={FaBriefcase} addLabel="Thêm kinh nghiệm" onAdd={() => addItem('experience')}>
            {profile.experience.map((item, index) => <div key={`experience-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <TextField label="Chức danh" value={item.role} onChange={(value) => changeItem('experience', index, 'role', value)} maxLength={200} />
              <TextField label="Đơn vị làm việc" value={item.employer} onChange={(value) => changeItem('experience', index, 'employer', value)} maxLength={200} />
              <TextField label="Ngày bắt đầu" value={item.start_date} onChange={(value) => changeItem('experience', index, 'start_date', value)} placeholder="YYYY-MM hoặc ISO date" />
              <TextField label="Ngày kết thúc" value={item.end_date} onChange={(value) => changeItem('experience', index, 'end_date', value)} placeholder="Để trống nếu đang làm" />
              <label className={`${labelClass} sm:col-span-2`}>Mô tả<textarea className={inputClass} rows="3" value={item.description || ''} onChange={(event) => changeItem('experience', index, 'description', event.target.value)} maxLength={4000} /></label>
              <div className="sm:col-span-2"><RemoveButton label={`Xóa kinh nghiệm ${index + 1}`} onClick={() => removeItem('experience', index)} /></div>
            </div>)}
            {profile.experience.length === 0 && <p className="text-sm text-slate-500">Chưa có kinh nghiệm. Không có dữ liệu nào được tự tạo.</p>}
          </CollectionSection>

          <CollectionSection title="Dự án" description="Nhập tên, vai trò, công nghệ và mô tả cho từng dự án." icon={FaLightbulb} addLabel="Thêm dự án" onAdd={() => addItem('projects')}>
            {profile.projects.map((item, index) => <div key={`project-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <TextField label="Tên dự án" value={item.name} onChange={(value) => changeItem('projects', index, 'name', value)} maxLength={200} />
              <TextField label="Vai trò" value={item.role} onChange={(value) => changeItem('projects', index, 'role', value)} maxLength={200} />
              <TextField label="Công nghệ (phân tách bằng dấu phẩy)" value={(item.technologies || []).join(', ')} onChange={(value) => changeItem('projects', index, 'technologies', value.split(',').map((entry) => entry.trim()).filter(Boolean))} />
              <label className={labelClass}>Mô tả<textarea className={inputClass} rows="3" value={item.description || ''} onChange={(event) => changeItem('projects', index, 'description', event.target.value)} maxLength={4000} /></label>
              <div className="sm:col-span-2"><RemoveButton label={`Xóa dự án ${index + 1}`} onClick={() => removeItem('projects', index)} /></div>
            </div>)}
            {profile.projects.length === 0 && <p className="text-sm text-slate-500">Chưa có dự án.</p>}
          </CollectionSection>

          <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <button type="button" disabled={!changed || saving} onClick={cancel} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><FaUndo aria-hidden="true" />Hủy thay đổi</button>
            <button type="submit" disabled={saving || !changed} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <span role="status">Đang lưu…</span> : <><FaSave aria-hidden="true" />Lưu hồ sơ</>}</button>
          </div>
        </div>
      </form>
    </div>
  </main>;
};

export default Profile;
