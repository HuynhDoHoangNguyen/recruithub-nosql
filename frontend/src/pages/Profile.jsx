import { useCallback, useEffect, useState } from 'react';
import { FaBriefcase, FaGraduationCap, FaLightbulb, FaSave, FaUndo, FaUser } from 'react-icons/fa';
import api from '../services/api';

const readProfile = (response) => response.data?.data?.profile;
const linesToItems = (value, mapper) => value.split('\n').map((line) => line.trim()).filter(Boolean).map(mapper);
const formatEducation = (items = []) => items.map((item) => [item.degree, item.institution || '', item.field_of_study || ''].join('|')).join('\n');
const formatExperience = (items = []) => items.map((item) => [item.role || '', item.employer || '', item.description || ''].join('|')).join('\n');
const formatProjects = (items = []) => items.map((item) => [item.name, (item.technologies || []).join(','), item.description || ''].join('|')).join('\n');

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelClass = 'block text-sm font-semibold text-slate-700';

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [revision, setRevision] = useState(null);
  const [skillsText, setSkillsText] = useState('');
  const [educationText, setEducationText] = useState('');
  const [experienceText, setExperienceText] = useState('');
  const [projectsText, setProjectsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/v1/candidate/profile/me');
      const data = readProfile(response);
      setProfile(data);
      setBaseline(data);
      setRevision(response.headers.etag?.replace(/^"|"$/g, '') || null);
      setSkillsText((data.skills || []).map((skill) => skill.name).join(', '));
      setEducationText(formatEducation(data.education));
      setExperienceText(formatExperience(data.experience));
      setProjectsText(formatProjects(data.projects));
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Không thể tải hồ sơ ứng viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeProfile = (field, value) => setProfile((current) => ({
    ...current,
    profile: { ...current.profile, [field]: field === 'years_experience' ? Number(value) : value },
  }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const permittedProfileFields = ['full_name', 'role', 'industry', 'seniority', 'years_experience', 'summary'];
    const patch = { profile: Object.fromEntries(permittedProfileFields.map((key) => [key, profile.profile[key]]).filter(([, value]) => value !== undefined)) };
    if (skillsText !== (baseline.skills || []).map((item) => item.name).join(', ')) {
      patch.skills = [...new Set(skillsText.split(',').map((item) => item.trim()).filter(Boolean))]
        .map((name) => ({ name, normalized: name.normalize('NFKC').toLowerCase() }));
    }
    if (educationText !== formatEducation(baseline.education)) {
      patch.education = linesToItems(educationText, (line) => {
        const [degree, institution, field_of_study] = line.split('|').map((item) => item.trim());
        return { degree: degree?.toUpperCase(), ...(institution ? { institution } : {}), ...(field_of_study ? { field_of_study } : {}) };
      });
    }
    if (experienceText !== formatExperience(baseline.experience)) {
      patch.experience = linesToItems(experienceText, (line) => {
        const [role, employer, description] = line.split('|').map((item) => item.trim());
        return { ...(role ? { role } : {}), ...(employer ? { employer } : {}), ...(description ? { description } : {}) };
      });
    }
    if (projectsText !== formatProjects(baseline.projects)) {
      patch.projects = linesToItems(projectsText, (line) => {
        const [name, technologies = '', description = ''] = line.split('|').map((item) => item.trim());
        return { name, technologies: technologies.split(',').map((item) => item.trim()).filter(Boolean), ...(description ? { description } : {}) };
      });
    }
    try {
      if (!revision) throw new Error('Thiếu phiên bản hồ sơ. Hãy tải lại trước khi lưu.');
      await api.patch('/v1/candidate/profile/me', patch, { headers: { 'If-Match': `"${revision}"` } });
      setNotice('Hồ sơ đã được lưu.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || requestError.message || 'Không thể lưu hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50"><div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-lg"><span className="loading-spinner" aria-hidden="true" />Đang tải hồ sơ…</div></main>;
  if (!profile) return <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-12 sm:px-6"><div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-lg"><div role="alert" className="message-error">{error || 'Không tìm thấy hồ sơ ứng viên.'}</div><button className="btn-primary mt-5" onClick={load}>Thử tải lại</button></div></main>;

  const fullName = profile.profile.full_name || 'Hồ sơ của tôi';
  const initials = fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'C';
  const completionFields = ['full_name', 'role', 'industry', 'seniority', 'years_experience', 'summary'];
  const completedFields = completionFields.filter((key) => Boolean(profile.profile[key])).length;
  const completion = Math.round((completedFields / completionFields.length) * 100);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 text-left sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Không gian ứng viên</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Hồ sơ của bạn</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Quản lý thông tin nghề nghiệp để nhà tuyển dụng hiểu rõ hơn về kinh nghiệm và thế mạnh của bạn.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Hồ sơ cá nhân</span>
        </header>

        {error && <div role="alert" className="message-error mb-5 shadow-sm">{error}</div>}
        {notice && <div role="status" className="message-success mb-5 shadow-sm">{notice}</div>}

        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
              <div className="h-20 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500" />
              <div className="px-5 pb-5">
                <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-2xl font-bold text-blue-700 shadow-md">{initials}</div>
                <h2 className="mt-4 text-lg font-bold text-slate-900">{fullName}</h2>
                <p className="mt-1 text-sm text-slate-500">{profile.profile.role || 'Chưa cập nhật vị trí mong muốn'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.profile.industry && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{profile.profile.industry}</span>}
                  {profile.profile.seniority && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{profile.profile.seniority}</span>}
                </div>
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">Mức độ hoàn thiện</span><span className="font-bold text-blue-700">{completion}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all" style={{ width: `${completion}%` }} /></div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">Bổ sung phần giới thiệu và thông tin nghề nghiệp để hoàn thiện hồ sơ.</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-blue-50/80 p-5 shadow-sm">
              <div className="flex gap-3"><FaLightbulb className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" /><div><h3 className="text-sm font-bold text-slate-800">Mẹo hồ sơ</h3><p className="mt-1 text-sm leading-6 text-slate-600">Mô tả ngắn gọn mục tiêu nghề nghiệp và cập nhật kỹ năng phù hợp với vị trí bạn đang tìm.</p></div></div>
            </section>
          </aside>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-7">
              <SectionHeading icon={FaUser} title="Thông tin nghề nghiệp" description="Các thông tin cơ bản hiển thị trong hồ sơ ứng viên." />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>Họ và tên<input className={inputClass} value={profile.profile.full_name || ''} onChange={(e) => changeProfile('full_name', e.target.value)} maxLength={120} autoComplete="name" /></label>
                <label className={labelClass}>Vị trí mong muốn<input className={inputClass} value={profile.profile.role || ''} onChange={(e) => changeProfile('role', e.target.value)} maxLength={120} placeholder="Ví dụ: Frontend Developer" /></label>
                <label className={labelClass}>Ngành nghề<input className={inputClass} value={profile.profile.industry || ''} onChange={(e) => changeProfile('industry', e.target.value)} maxLength={80} placeholder="Ví dụ: Công nghệ thông tin" /></label>
                <label className={labelClass}>Cấp độ<select className={inputClass} value={profile.profile.seniority} onChange={(e) => changeProfile('seniority', e.target.value)}><option value="JUNIOR">Junior</option><option value="MID">Mid-level</option><option value="SENIOR">Senior</option></select></label>
                <label className={labelClass}>Số năm kinh nghiệm<input className={inputClass} type="number" min="0" max="80" value={profile.profile.years_experience} onChange={(e) => changeProfile('years_experience', e.target.value)} /></label>
                <div className="flex items-end rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><FaBriefcase className="mr-2 shrink-0 text-blue-600" aria-hidden="true" />Thông tin được lưu trong hồ sơ Candidate của bạn.</div>
              </div>
              <label className={`${labelClass} mt-4`}>Giới thiệu<textarea className={inputClass} rows="4" value={profile.profile.summary || ''} onChange={(e) => changeProfile('summary', e.target.value)} maxLength={4000} placeholder="Chia sẻ ngắn về kinh nghiệm, thế mạnh và mục tiêu nghề nghiệp…" /></label>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-7">
              <SectionHeading icon={FaLightbulb} title="Kỹ năng" description="Liệt kê những kỹ năng bạn muốn nhà tuyển dụng chú ý." />
              <label className={labelClass}>Kỹ năng, phân tách bằng dấu phẩy<textarea className={inputClass} rows="3" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, Node.js, SQL" /></label>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-7">
              <SectionHeading icon={FaGraduationCap} title="Học vấn, kinh nghiệm và dự án" description="Mỗi dòng là một mục. Dùng dấu | để phân tách các trường." />
              <div className="grid gap-4 xl:grid-cols-2">
                <label className={labelClass}>Học vấn<textarea className={inputClass} rows="4" value={educationText} onChange={(e) => setEducationText(e.target.value)} placeholder="BACHELOR | Trường đại học | Chuyên ngành" /></label>
                <label className={labelClass}>Kinh nghiệm<textarea className={inputClass} rows="4" value={experienceText} onChange={(e) => setExperienceText(e.target.value)} placeholder="Vai trò | Nhà tuyển dụng | Mô tả" /></label>
                <label className={`${labelClass} xl:col-span-2`}>Dự án<textarea className={inputClass} rows="4" value={projectsText} onChange={(e) => setProjectsText(e.target.value)} placeholder="Tên dự án | Công nghệ, công cụ | Mô tả" /></label>
              </div>
            </section>

            <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur">
              <button className="btn-secondary" type="button" onClick={load} disabled={saving}><FaUndo className="mr-2" aria-hidden="true" />Tải lại</button>
              <button className="btn-primary" type="submit" disabled={saving}>{saving ? <><span className="loading-spinner mr-2 border-white border-t-transparent" aria-hidden="true" />Đang lưu…</> : <><FaSave className="mr-2" aria-hidden="true" />Lưu hồ sơ</>}</button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
};

export default Profile;
