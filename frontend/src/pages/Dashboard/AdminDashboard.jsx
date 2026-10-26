import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaUsers, FaUserTie, FaUserCheck, FaUserLock, FaSearch, FaFilter, FaEye, FaSyncAlt, FaChevronLeft, FaChevronRight, FaTimes, FaShieldAlt, FaBriefcase } from 'react-icons/fa';
import api from '../../services/api';

const statCards = [
  { key: 'totalUsers', label: 'Tổng người dùng', icon: FaUsers, tone: 'blue' },
  { key: 'totalCandidates', label: 'Ứng viên', icon: FaUserTie, tone: 'blue' },
  { key: 'active', label: 'Đang hoạt động', icon: FaUserCheck, tone: 'blue' },
  { key: 'locked', label: 'Đã khóa', icon: FaUserLock, tone: 'blue' },
  { key: 'totalJobs', label: 'Tổng tin tuyển dụng', icon: FaBriefcase, tone: 'blue' },
];

const tones = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
};

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <article className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value ?? '—'}</p></div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon aria-hidden="true" /></span>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const style = status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : status === 'LOCKED' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200';
  const label = status === 'ACTIVE' ? 'Hoạt động' : status === 'LOCKED' ? 'Đã khóa' : 'Cần đặt lại mật khẩu';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>{label}</span>;
}

function RoleBadge({ role }) {
  const style = role === 'ADMIN' ? 'bg-blue-50 text-blue-700' : role === 'RECRUITER' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{role === 'ADMIN' ? 'Admin' : role === 'RECRUITER' ? 'Nhà tuyển dụng' : 'Ứng viên'}</span>;
}

function RoleDistribution({ roles = {}, total = 0 }) {
  const segments = [
    { key: 'CANDIDATE', label: 'Ứng viên', color: '#2563eb' },
    { key: 'RECRUITER', label: 'Nhà tuyển dụng', color: '#4f46e5' },
    { key: 'ADMIN', label: 'Admin', color: '#0ea5e9' },
  ];
  const circumference = 2 * Math.PI * 42;
  let offset = 0;

  return (
    <div className="mt-5 flex min-w-0 flex-col items-center gap-5">
      <div className="relative h-40 w-40 shrink-0" role="img" aria-label="Biểu đồ vòng tròn phân bổ tài khoản theo vai trò">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          {segments.map((segment) => {
            const value = Number(roles[segment.key] || 0);
            const length = total > 0 ? (value / total) * circumference : 0;
            const currentOffset = offset;
            offset += length;
            return <circle key={segment.key} cx="50" cy="50" r="42" fill="none" stroke={segment.color} strokeWidth="12" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} strokeLinecap="round" className="transition-all duration-500" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold tracking-tight text-slate-900">{total}</span><span className="text-xs font-medium text-slate-500">tài khoản</span></div>
      </div>
      <div className="grid w-full max-w-sm gap-3">
        {segments.map((segment) => {
          const value = Number(roles[segment.key] || 0);
          const percent = total ? Math.round((value / total) * 100) : 0;
          return <div key={segment.key} className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"><div className="flex min-w-0 flex-1 items-start gap-2.5"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} /><span className="min-w-0 whitespace-normal break-words text-sm font-medium leading-5 text-slate-600">{segment.label}</span></div><span className="shrink-0 whitespace-nowrap text-sm font-bold text-slate-900">{value} <span className="font-medium text-slate-400">({percent}%)</span></span></div>;
        })}
      </div>
    </div>
  );
}

function StatusDistribution({ statuses = {} }) {
  const rows = [
    { key: 'ACTIVE', label: 'Hoạt động', color: 'bg-emerald-500', text: 'text-emerald-700' },
    { key: 'LOCKED', label: 'Đã khóa', color: 'bg-rose-500', text: 'text-rose-700' },
    { key: 'RESET_REQUIRED', label: 'Cần đặt lại mật khẩu', color: 'bg-amber-500', text: 'text-amber-700' },
  ];
  const total = rows.reduce((sum, row) => sum + Number(statuses[row.key] || 0), 0);

  return (
    <div className="mt-6 space-y-5" aria-label="Biểu đồ cột trạng thái tài khoản">
      {rows.map((row) => {
        const value = Number(statuses[row.key] || 0);
        const percent = total ? (value / total) * 100 : 0;
        return <div key={row.key}><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-600">{row.label}</span><span className={`text-sm font-bold ${row.text}`}>{value}<span className="ml-1 font-medium text-slate-400">({Math.round(percent)}%)</span></span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.color} transition-all duration-500`} style={{ width: `${percent}%` }} /></div></div>;
      })}
      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">Tỷ lệ tính trên tổng trạng thái tài khoản đang được thống kê.</p>
    </div>
  );
}

function JobStatusDistribution({ jobs = {} }) {
  const rows = [
    { key: 'OPEN', label: 'Đang tuyển', color: 'bg-emerald-500' },
    { key: 'DRAFT', label: 'Bản nháp', color: 'bg-amber-500' },
    { key: 'CLOSED', label: 'Đã đóng', color: 'bg-slate-500' },
  ];
  const total = Number(jobs.total || 0);
  return <div className="mt-6 space-y-5" aria-label="Biểu đồ trạng thái tin tuyển dụng">
    {rows.map(({ key, label, color }) => {
      const value = Number(jobs.statuses?.[key] || 0);
      const percent = total ? value / total * 100 : 0;
      return <div key={key}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium text-slate-600">{label}</span><span className="font-bold text-slate-900">{value}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div>;
    })}
  </div>;
}

function UserActionSelect({ user, onView, onStatusChange, onPasswordReset, disabled = false }) {
  const canManageStatus = ['CANDIDATE', 'RECRUITER'].includes(user.role) && ['ACTIVE', 'LOCKED'].includes(user.account_status);
  const canResetPassword = ['CANDIDATE', 'RECRUITER'].includes(user.role) && user.account_status === 'RESET_REQUIRED';

  const handleChange = (event) => {
    const selected = event.currentTarget.value;
    event.currentTarget.value = '';
    if (selected === 'details') onView(user.id);
    if (selected === 'status') onStatusChange(user);
    if (selected === 'reset') onPasswordReset(user);
  };

  return (
    <select
      defaultValue=""
      onChange={handleChange}
      disabled={disabled}
      aria-label={`Thao tác cho ${user.email}`}
      className="input-field !h-10 !w-40 !py-1.5 text-xs font-semibold shadow-sm focus:!border-blue-400 focus:!ring-2 focus:!ring-blue-100"
    >
      <option value="">Chọn thao tác</option>
      <option value="details">Chi tiết</option>
      {canManageStatus && <option value="status">{user.account_status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</option>}
      {canResetPassword && <option value="reset">Reset mật khẩu</option>}
      {user.role === 'ADMIN' && <option value="admin-managed" disabled>Admin do operator quản lý</option>}
    </select>
  );
}

const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [role, setRole] = useState(searchParams.get('role') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [cursor, setCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [statusError, setStatusError] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [issuedResetCredential, setIssuedResetCredential] = useState(null);
  const [resetCredentialCopied, setResetCredentialCopied] = useState(false);

  const load = useCallback(async (next = null) => {
    setLoading(true);
    setError('');
    setTotalCount(null);
    setStatsLoading(true);
    setStatsError('');
    const params = { limit: 20, ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}), ...(next ? { cursor: next } : {}) };
    const [statsResult, usersResult] = await Promise.allSettled([
      api.get('/v1/admin/stats'), api.get('/v1/admin/users', { params }),
    ]);
    if (statsResult.status === 'fulfilled' && statsResult.value.data?.data?.source === 'couchdb_mapreduce') {
      setStats(statsResult.value.data.data);
    } else {
      setStats(null);
      const requestError = statsResult.status === 'rejected' ? statsResult.reason : null;
      setStatsError(requestError?.response?.data?.error?.message || 'Thống kê MapReduce chưa sẵn sàng. Không hiển thị số liệu ước tính.');
    }
    setStatsLoading(false);
    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value.data?.data?.users || []);
      const count = usersResult.value.data?.data?.totalCount;
      setTotalCount(Number.isSafeInteger(count) && count >= 0 ? count : null);
      setNextCursor(usersResult.value.data?.data?.nextCursor || null);
      setCursor(next);
    } else {
      setError(usersResult.reason?.response?.data?.error?.message || 'Không tải được danh sách tài khoản.');
    }
    setLoading(false);
  }, [debouncedSearch, role, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, role, status, setSearchParams]);

  useEffect(() => {
    setCursorHistory([]);
    load();
  }, [load]);

  const viewUser = async (id) => {
    setError('');
    try {
      const response = await api.get(`/v1/admin/users/${encodeURIComponent(id)}`);
      setSelectedUser(response.data?.data?.user);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Không tải được chi tiết tài khoản.');
    }
  };

  const beginStatusChange = async (item) => {
    if (!['CANDIDATE', 'RECRUITER'].includes(item.role) || !['ACTIVE', 'LOCKED'].includes(item.account_status) || statusUpdatingId) return;
    setStatusError('');
    setNotice('');
    setStatusUpdatingId(item.id);
    try {
      const response = await api.get(`/v1/admin/users/${encodeURIComponent(item.id)}`);
      const detail = response.data?.data?.user;
      const revision = response.headers?.etag?.replace(/^"|"$/g, '') || response.headers?.ETag?.replace(/^"|"$/g, '');
      if (!detail || !revision) throw new Error('Cannot read the current account revision. Refresh the list.');
      if (!['CANDIDATE', 'RECRUITER'].includes(detail.role) || !['ACTIVE', 'LOCKED'].includes(detail.account_status)) {
        setUsers((current) => current.map((user) => user.id === item.id ? detail : user));
        throw new Error('The account status changed. The list has been refreshed.');
      }
      setPendingStatusChange({ user: detail, revision, nextStatus: detail.account_status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' });
    } catch (requestError) {
      setStatusError(requestError.response?.data?.error?.message || requestError.message || 'Could not load the account revision.');
    } finally {
      setStatusUpdatingId('');
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange || statusUpdatingId) return;
    const { user, revision, nextStatus } = pendingStatusChange;
    setStatusUpdatingId(user.id);
    setStatusError('');
    setNotice('');
    try {
      const response = await api.patch(`/v1/admin/users/${encodeURIComponent(user.id)}/status`,
        { account_status: nextStatus }, { headers: { 'If-Match': `"${revision}"` } });
      const updated = response.data?.data?.user;
      if (!updated) throw new Error('The account update response is invalid.');
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedUser((current) => current?.id === updated.id ? updated : current);
      setPendingStatusChange(null);
      setNotice(nextStatus === 'LOCKED' ? 'Account locked.' : 'Account unlocked.');
      await load(cursor);
      if (selectedUser?.id === updated.id) {
        const detailResponse = await api.get(`/v1/admin/users/${encodeURIComponent(updated.id)}`);
        setSelectedUser(detailResponse.data?.data?.user);
      }
    } catch (requestError) {
      const conflict = requestError.response?.status === 409 || requestError.response?.data?.error?.code === 'REVISION_CONFLICT';
      setStatusError(conflict
        ? 'The account changed in another request. Nothing was overwritten. Refresh the list before trying again.'
        : requestError.response?.data?.error?.message || requestError.message || 'Could not update the account status.');
      if (conflict) setPendingStatusChange(null);
    } finally {
      setStatusUpdatingId('');
    }
  };

  const beginPasswordReset = async (item) => {
    if (!['CANDIDATE', 'RECRUITER'].includes(item.role) || item.account_status !== 'RESET_REQUIRED' || statusUpdatingId) return;
    setStatusError('');
    setIssuedResetCredential(null);
    setStatusUpdatingId(item.id);
    try {
      const response = await api.get(`/v1/admin/users/${encodeURIComponent(item.id)}`);
      const detail = response.data?.data?.user;
      const revision = response.headers?.etag?.replace(/^"|"$/g, '') || response.headers?.ETag?.replace(/^"|"$/g, '');
      if (!detail || !revision) throw new Error('Không đọc được revision hiện tại. Hãy làm mới danh sách.');
      if (!['CANDIDATE', 'RECRUITER'].includes(detail.role) || detail.account_status !== 'RESET_REQUIRED') {
        setUsers((current) => current.map((user) => user.id === item.id ? detail : user));
        throw new Error('Trạng thái tài khoản đã thay đổi. Danh sách đã được làm mới.');
      }
      setPendingPasswordReset({ user: detail, revision });
    } catch (requestError) {
      setStatusError(requestError.response?.data?.error?.message || requestError.message || 'Không thể tải tài khoản để đặt lại mật khẩu.');
    } finally {
      setStatusUpdatingId('');
    }
  };

  const confirmPasswordReset = async () => {
    if (!pendingPasswordReset || statusUpdatingId) return;
    const { user, revision } = pendingPasswordReset;
    setStatusUpdatingId(user.id);
    setStatusError('');
    try {
      const response = await api.post(`/v1/admin/users/${encodeURIComponent(user.id)}/password-reset`, {}, { headers: { 'If-Match': `"${revision}"` } });
      const result = response.data?.data;
      if (!result?.temporaryPassword || !result?.expiresAt || !result?.user) throw new Error('Phản hồi cấp mã reset không hợp lệ.');
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item));
      setSelectedUser((current) => current?.id === user.id ? result.user : current);
      setPendingPasswordReset(null);
      setIssuedResetCredential({ email: result.user.email, temporaryPassword: result.temporaryPassword, expiresAt: result.expiresAt });
      setResetCredentialCopied(false);
      await load(cursor);
    } catch (requestError) {
      const conflict = requestError.response?.status === 409 || requestError.response?.data?.error?.code === 'REVISION_CONFLICT';
      setStatusError(conflict
        ? 'Tài khoản vừa được cập nhật. Không có thay đổi nào bị ghi đè; hãy làm mới rồi thử lại.'
        : requestError.response?.data?.error?.message || requestError.message || 'Không thể cấp mã reset.');
      if (conflict) setPendingPasswordReset(null);
    } finally {
      setStatusUpdatingId('');
    }
  };

  const resetFilters = () => { setSearch(''); setRole(''); setStatus(''); };
  const totalPages = totalCount === null ? null : Math.ceil(totalCount / 20);
  const currentPage = users.length ? cursorHistory.length + 1 : totalCount === 0 ? 0 : cursorHistory.length + 1;

  return (
    <main className="min-h-[calc(100vh-4rem)] border-t-4 border-blue-600 bg-white px-4 py-8 text-left sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><FaShieldAlt aria-hidden="true" />Khu vực quản trị</div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-800">Tổng quan người dùng</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Theo dõi tài khoản và trạng thái hoạt động trên RecruiHub. Thống kê được tải trực tiếp từ CouchDB.</p>
          </div>
          <button className="btn-secondary w-fit" type="button" onClick={() => load(cursor)} disabled={loading}><FaSyncAlt className={`mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Làm mới</button>
        </header>

        {error && <div role="alert" className="message-error flex flex-wrap items-center justify-between gap-3 shadow-sm"><span>{error}</span><button type="button" className="font-semibold underline" onClick={() => load(cursor)}>Retry</button></div>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</p>}
        {statusError && <div role="alert" className="message-error flex flex-wrap items-center justify-between gap-3 shadow-sm"><span>{statusError}</span><button type="button" className="font-semibold underline" onClick={async () => { setStatusError(''); await load(cursor); if (selectedUser) await viewUser(selectedUser.id); }}>Refresh list</button></div>}

        <section aria-label="Thống kê tài khoản" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map(({ key, ...card }) => <StatCard key={key} {...card} value={key === 'active' ? stats?.statuses?.ACTIVE : key === 'locked' ? stats?.statuses?.LOCKED : key === 'totalJobs' ? stats?.jobs?.total : stats?.[key]} />)}
        </section>

        {statsLoading && <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Đang tải thống kê CouchDB MapReduce…</p>}
        {statsError && <div role="alert" className="message-error flex flex-wrap items-center justify-between gap-3"><span>{statsError}</span><button type="button" className="font-semibold underline" onClick={() => load(cursor)} disabled={statsLoading}>Thử lại thống kê</button></div>}
        {stats && <p className="text-xs font-medium text-slate-500">Nguồn thống kê: CouchDB MapReduce</p>}

        {stats && <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Phân bổ vai trò</h2><p className="mt-1 text-sm text-slate-500">Tỷ trọng tài khoản theo nhóm người dùng</p></div><FaUsers className="text-lg text-blue-600" aria-hidden="true" /></div>
            <RoleDistribution roles={stats.roles} total={stats.totalUsers || 0} />
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Trạng thái tài khoản</h2><p className="mt-1 text-sm text-slate-500">So sánh số lượng theo trạng thái</p></div><FaUserCheck className="text-lg text-blue-600" aria-hidden="true" /></div>
            <StatusDistribution statuses={stats.statuses} />
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Trạng thái tin tuyển dụng</h2><p className="mt-1 text-sm text-slate-500">Số lượng theo trạng thái từ view TV2</p></div><FaBriefcase className="text-lg text-blue-600" aria-hidden="true" /></div>
            <JobStatusDistribution jobs={stats.jobs} />
          </article>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
          <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/40 p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="text-lg font-bold text-slate-900">Danh sách tài khoản</h2><p className="mt-1 text-sm text-slate-500">Tìm kiếm, lọc và xem chi tiết người dùng.</p></div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{users.length} tài khoản trên trang</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_210px_auto_auto]">
              <label className="relative block sm:col-span-2 xl:col-span-1"><span className="sr-only">Tìm theo email</span><FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input className="input-field !h-11 !pl-11 shadow-sm focus:!border-blue-400 focus:!ring-2 focus:!ring-blue-100" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo email…" /></label>
              <label><span className="sr-only">Lọc theo vai trò</span><select className="input-field !h-11 !py-2.5 shadow-sm focus:!border-blue-400 focus:!ring-2 focus:!ring-blue-100" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Tất cả vai trò</option><option value="CANDIDATE">Ứng viên</option><option value="RECRUITER">Nhà tuyển dụng</option><option value="ADMIN">Admin</option></select></label>
              <label><span className="sr-only">Lọc theo trạng thái</span><select className="input-field !h-11 !py-2.5 shadow-sm focus:!border-blue-400 focus:!ring-2 focus:!ring-blue-100" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Đã khóa</option><option value="RESET_REQUIRED">Cần đặt lại mật khẩu</option></select></label>
              <button className="btn-primary !h-11 min-w-24 justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-blue-900/15" type="button" onClick={() => { setCursorHistory([]); load(); }} disabled={loading}><FaFilter className="mr-2" aria-hidden="true" />Lọc</button>
              <button className="btn-secondary !h-11 min-w-24 justify-center rounded-xl border-blue-100 bg-white" type="button" onClick={resetFilters} disabled={!search && !role && !status}>Xóa lọc</button>
            </div>
            <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-xs leading-5 text-slate-600">CANDIDATE/RECRUITER ACTIVE có thể khóa; LOCKED có thể mở khóa. Với RESET_REQUIRED, Admin có thể cấp mã reset dùng một lần; chủ tài khoản đặt mật khẩu mới để kích hoạt. ADMIN do operator quản lý.</p>
          </div>

          {loading && !stats ? <div role="status" aria-label="Loading accounts" className="space-y-3 p-5 sm:p-6">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : users.length === 0 && !loading ? (
            <div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FaUsers aria-hidden="true" /></div><p className="mt-4 font-semibold text-slate-800">Không tìm thấy tài khoản</p><p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] table-fixed text-left text-sm"><colgroup><col style={{ width: "40%" }} /><col style={{ width: "14%" }} /><col style={{ width: "19%" }} /><col style={{ width: "11%" }} /><col style={{ width: "200px" }} /></colgroup>
                <thead className="bg-blue-50/80 text-xs uppercase tracking-wide text-blue-800"><tr><th className="px-5 py-4 font-semibold">Tài khoản</th><th className="px-5 py-4 font-semibold">Vai trò</th><th className="px-5 py-4 font-semibold">Trạng thái</th><th className="px-5 py-4 font-semibold">Ngày tạo</th><th className="px-5 py-4 text-right font-semibold">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{users.map((item) => <tr key={item.id} className="transition hover:bg-blue-50/40"><td className="px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold uppercase text-blue-700">{(item.email || '?').charAt(0)}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{item.email}</p><p className="mt-0.5 truncate text-xs text-slate-400">{item.id}</p></div></div></td><td className="px-5 py-4"><RoleBadge role={item.role} /></td><td className="px-5 py-4"><StatusBadge status={item.account_status} /></td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '—'}</td><td className="px-5 py-4"><div className="flex justify-end"><UserActionSelect user={item} onView={viewUser} onStatusChange={beginStatusChange} onPasswordReset={beginPasswordReset} disabled={Boolean(statusUpdatingId)} /></div></td></tr>)}</tbody>
              </table>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
            <p className="text-xs text-slate-500" aria-live="polite">{loading ? 'Đang cập nhật…' : `Trang ${cursorHistory.length + 1} · ${users.length} tài khoản trên trang`}</p>
            <nav className="flex items-center gap-2" aria-label="Phân trang danh sách người dùng"><button className="btn-secondary !rounded-lg !px-3 !py-2" type="button" aria-label="Trang trước" disabled={!cursorHistory.length || loading} onClick={() => { const previous = cursorHistory.at(-1) ?? null; setCursorHistory((history) => history.slice(0, -1)); load(previous); }}><FaChevronLeft aria-hidden="true" /></button><span className="min-w-20 text-center text-sm font-semibold text-slate-700" aria-current="page">{currentPage} / {totalPages ?? '…'}</span><button className="btn-secondary !rounded-lg !px-3 !py-2" type="button" aria-label="Trang tiếp" disabled={!nextCursor || loading} onClick={() => { setCursorHistory((history) => [...history, cursor]); load(nextCursor); }}><FaChevronRight aria-hidden="true" /></button></nav>
          </footer>
        </section>
      </div>

      {selectedUser && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedUser(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="admin-user-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/50 bg-white p-6 shadow-2xl sm:p-8">
          <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Thông tin tài khoản</p><h2 id="admin-user-title" className="mt-2 break-all text-xl font-bold text-slate-900">{selectedUser.email}</h2><p className="mt-1 text-sm text-slate-500">Chi tiết người dùng trong hệ thống</p></div><button className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" type="button" aria-label="Đóng chi tiết" onClick={() => setSelectedUser(null)}><FaTimes aria-hidden="true" /></button></header>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vai trò</p><div className="mt-2"><RoleBadge role={selectedUser.role} /></div></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</p><div className="mt-2"><StatusBadge status={selectedUser.account_status} /></div></div><div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày tạo</p><p className="mt-2 font-medium text-slate-800">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('vi-VN') : '—'}</p></div></div>
          {["CANDIDATE", "RECRUITER"].includes(selectedUser.role) && selectedUser.account_status === "RESET_REQUIRED" && <button className="mt-5 btn-primary" type="button" disabled={Boolean(statusUpdatingId)} onClick={() => beginPasswordReset(selectedUser)}>Reset mật khẩu</button>}
          {selectedUser.role === 'ADMIN' && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><FaShieldAlt className="mr-2 inline" aria-hidden="true" />Trạng thái và khôi phục tài khoản Admin do operator quản lý ngoài MVP.</div>}


          <footer className="mt-7 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row"><button className="btn-secondary" type="button" onClick={() => setSelectedUser(null)}>Đóng</button><UserActionSelect user={selectedUser} onView={viewUser} onStatusChange={beginStatusChange} onPasswordReset={beginPasswordReset} disabled={Boolean(statusUpdatingId)} /></footer>
        </section>
      </div>}
      {pendingStatusChange && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation">
        <section role="alertdialog" aria-modal="true" aria-labelledby="status-confirm-title" className="w-full max-w-md rounded-2xl border border-white/50 bg-white p-6 shadow-2xl sm:p-8">
          <h2 id="status-confirm-title" className="text-lg font-bold text-slate-900">Confirm {pendingStatusChange.nextStatus === 'LOCKED' ? 'lock' : 'unlock'}</h2>
          <p className="mt-3 break-all text-sm leading-6 text-slate-600">{pendingStatusChange.user.email}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{pendingStatusChange.nextStatus === 'LOCKED' ? 'Protected requests will reject this user after the change.' : 'An unexpired 15-minute access token may work again after unlock.'}</p>
          <footer className="mt-6 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row">
            <button className="btn-secondary" type="button" disabled={Boolean(statusUpdatingId)} onClick={() => setPendingStatusChange(null)}>Cancel</button>
            <button className="btn-primary" type="button" disabled={Boolean(statusUpdatingId)} onClick={confirmStatusChange}>{statusUpdatingId === pendingStatusChange.user.id ? 'Updating…' : pendingStatusChange.nextStatus === 'LOCKED' ? 'Confirm lock' : 'Confirm unlock'}</button>
          </footer>
        </section>
      </div>}
      {pendingPasswordReset && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation">
        <section role="alertdialog" aria-modal="true" aria-labelledby="password-reset-title" className="w-full max-w-md rounded-2xl border border-white/50 bg-white p-6 shadow-2xl sm:p-8">
          <h2 id="password-reset-title" className="text-lg font-bold text-slate-900">Cấp mã reset mật khẩu?</h2>
          <p className="mt-3 break-all text-sm font-semibold text-slate-700">{pendingPasswordReset.user.email}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Mã dùng một lần có hiệu lực 24 giờ. Thao tác này chưa kích hoạt tài khoản; người dùng cần tự đặt mật khẩu mới tại trang reset.</p>
          {statusError && <p role="alert" className="message-error mt-4">{statusError}</p>}
          <footer className="mt-6 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row">
            <button className="btn-secondary" type="button" disabled={Boolean(statusUpdatingId)} onClick={() => setPendingPasswordReset(null)}>Hủy</button>
            <button className="btn-primary" type="button" disabled={Boolean(statusUpdatingId)} onClick={confirmPasswordReset}>{statusUpdatingId === pendingPasswordReset.user.id ? 'Đang tạo mã…' : 'Tạo mã reset'}</button>
          </footer>
        </section>
      </div>}
      {issuedResetCredential && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="issued-reset-title" className="w-full max-w-lg rounded-2xl border border-white/50 bg-white p-6 shadow-2xl sm:p-8">
          <h2 id="issued-reset-title" className="text-lg font-bold text-slate-900">Mã reset dùng một lần</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Gửi mã này cho chủ tài khoản qua kênh riêng. Mã chỉ hiển thị lần này và hết hạn lúc {new Date(issuedResetCredential.expiresAt).toLocaleString('vi-VN')}.</p>
          <p className="mt-3 break-all rounded-xl border border-amber-200 bg-amber-50 p-4 font-mono text-sm text-slate-900" aria-label="Mã reset một lần">{issuedResetCredential.temporaryPassword}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">Người dùng mở <span className="font-semibold">/reset-password</span>, nhập email và mã này, rồi tự chọn mật khẩu mới. Không ghi mã vào báo cáo hoặc gửi vào kênh công khai.</p>
          <footer className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button className="btn-primary" type="button" onClick={() => setIssuedResetCredential(null)}>Đã lưu mã</button>
          </footer>
        </section>
      </div>}
    </main>
  );
};

export default AdminDashboard;
