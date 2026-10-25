import { useAuth } from '../context/useAuth';
import { normalizeRole } from '../features/applications/applicationPresentation';
import PrivateAssetImage from './uploads/PrivateAssetImage';

export default function AccountHeader({ title, action, organization, profile, email, id }) {
  const { user } = useAuth();
  const role = { CANDIDATE: 'Ứng Viên IT', RECRUITER: 'Nhà Tuyển Dụng', ADMIN: 'Quản trị viên' }[normalizeRole(user?.role)];
  const name = profile?.profile?.full_name || user?.name || user?.email || 'Tài khoản đang đăng nhập';
  return <header id={id} className="rh-account-header card p-6 sm:p-8 scroll-mt-24"><div className="flex flex-col lg:flex-row lg:items-center gap-6">
    <div className="flex items-center gap-5 min-w-0">{profile?.avatar ? <PrivateAssetImage asset={profile.avatar} fallback={name.charAt(0).toUpperCase()} /> : <div className="h-20 w-20 shrink-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-md"><span className="text-white text-3xl font-extrabold" aria-hidden="true">{name.charAt(0).toUpperCase()}</span></div>}
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 break-words">{profile?.profile?.full_name || user?.name || profile?.profile?.role || title}</h1><span className="rounded-full px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold">{role}</span></div>
        <p className="text-sm text-slate-500 break-all mt-1">{email || organization?.email || user?.email || name}</p>
        <p className="text-xs text-blue-600 mt-1">{organization ? `${organization.company.name} · ${organization.department.name}` : profile?.skills?.length ? profile.skills.slice(0, 3).map(skill => skill.name).join(', ') : title}</p>
      </div></div><div className="lg:ml-auto flex flex-wrap gap-3 shrink-0">{action}</div>
  </div></header>;
}
