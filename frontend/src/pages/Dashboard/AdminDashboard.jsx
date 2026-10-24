import { useCallback, useEffect, useState } from 'react';
import { FaUsers, FaUserTie, FaUserCheck, FaUserLock, FaSearch, FaFilter, FaEye, FaSyncAlt, FaChevronLeft, FaChevronRight, FaTimes, FaShieldAlt } from 'react-icons/fa';
import api from '../../services/api';

const statCards = [
  { key: 'totalUsers', label: 'Tổng người dùng', icon: FaUsers, tone: 'blue' },
  { key: 'totalCandidates', label: 'Ứng viên', icon: FaUserTie, tone: 'violet' },
  { key: 'active', label: 'Đang hoạt động', icon: FaUserCheck, tone: 'emerald' },
  { key: 'locked', label: 'Đã khóa', icon: FaUserLock, tone: 'amber' },
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
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{role === 'ADMIN' ? 'Admin' : role === 'RECRUITER' ? 'Nhà tuyển dụng' : 'Ứng viên'}</span>;
}

function RoleDistribution({ roles = {}, total = 0 }) {
  const segments = [
    { key: 'CANDIDATE', label: 'Ứng viên', color: '#2563eb' },
    { key: 'RECRUITER', label: 'Nhà tuyển dụng', color: '#8b5cf6' },
    { key: 'ADMIN', label: 'Admin', color: '#f59e0b' },
  ];
  const circumference = 2 * Math.PI * 42;
  let offset = 0;

  return (
    <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
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
      <div className="grid w-full gap-3 sm:max-w-xs">
        {segments.map((segment) => {
          const value = Number(roles[segment.key] || 0);
          const percent = total ? Math.round((value / total) * 100) : 0;
          return <div key={segment.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} /><span className="truncate text-sm font-medium text-slate-600">{segment.label}</span></div><span className="whitespace-nowrap text-sm font-bold text-slate-900">{value} <span className="font-medium text-slate-400">({percent}%)</span></span></div>;
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

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [etag, setEtag] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback(async (next = null) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 20, ...(search ? { search } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}), ...(next ? { cursor: next } : {}) };
      const [statsResponse, userResponse] = await Promise.all([
        api.get('/v1/admin/stats'),
        api.get('/v1/admin/users', { params }),
      ]);
      setStats(statsResponse.data?.data);
      setUsers(userResponse.data?.data?.users || []);
      setNextCursor(userResponse.data?.data?.nextCursor || null);
      setCursor(next);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Không tải được dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  }, [search, role, status]);

  useEffect(() => { load(); }, [load]);

  const viewUser = async (id) => {
    setError('');
    try {
      const response = await api.get(`/v1/admin/users/${encodeURIComponent(id)}`);
      setSelectedUser(response.data?.data?.user);
      setEtag(response.headers.etag || '');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Không tải được chi tiết tài khoản.');
    }
  };

  const changeStatus = async () => {
    if (!selectedUser || !etag) return;
    const nextStatus = selectedUser.account_status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
    const action = nextStatus === 'LOCKED' ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản ${selectedUser.email}?`)) return;
    setWorking(true);
    setError('');
    try {
      await api.patch(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/status`, { account_status: nextStatus }, { headers: { 'If-Match': etag } });
      setSelectedUser(null);
      setEtag('');
      await load(cursor);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Không thể thay đổi trạng thái tài khoản.');
    } finally {
      setWorking(false);
    }
  };

  const resetFilters = () => { setSearch(''); setRole(''); setStatus(''); };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 text-left sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><FaShieldAlt aria-hidden="true" />Khu vực quản trị</div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tổng quan người dùng</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Theo dõi tài khoản và trạng thái hoạt động trên RecruiHub. Thống kê được tải trực tiếp từ CouchDB.</p>
          </div>
          <button className="btn-secondary w-fit" type="button" onClick={() => load(cursor)} disabled={loading}><FaSyncAlt className={`mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Làm mới</button>
        </header>

        {error && <div role="alert" className="message-error shadow-sm">{error}</div>}

        <section aria-label="Thống kê tài khoản" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => <StatCard key={card.key} {...card} value={card.key === 'active' ? stats?.statuses?.ACTIVE : card.key === 'locked' ? stats?.statuses?.LOCKED : stats?.[card.key]} />)}
        </section>

        {stats && <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Phân bổ vai trò</h2><p className="mt-1 text-sm text-slate-500">Tỷ trọng tài khoản theo nhóm người dùng</p></div><FaUsers className="text-lg text-blue-600" aria-hidden="true" /></div>
            <RoleDistribution roles={stats.roles} total={stats.totalUsers || 0} />
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Trạng thái tài khoản</h2><p className="mt-1 text-sm text-slate-500">So sánh số lượng theo trạng thái</p></div><FaUserCheck className="text-lg text-emerald-600" aria-hidden="true" /></div>
            <StatusDistribution statuses={stats.statuses} />
          </article>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="text-lg font-bold text-slate-900">Danh sách tài khoản</h2><p className="mt-1 text-sm text-slate-500">Tìm kiếm, lọc và xem chi tiết người dùng.</p></div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{users.length} tài khoản trên trang</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_190px_auto_auto]">
              <label className="relative block"><span className="sr-only">Tìm theo email</span><FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input className="input-field !pl-11" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Tìm theo email…" /></label>
              <label><span className="sr-only">Lọc theo vai trò</span><select className="input-field !py-3" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Tất cả vai trò</option><option value="CANDIDATE">Ứng viên</option><option value="RECRUITER">Nhà tuyển dụng</option><option value="ADMIN">Admin</option></select></label>
              <label><span className="sr-only">Lọc theo trạng thái</span><select className="input-field !py-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Đã khóa</option><option value="RESET_REQUIRED">Cần đặt lại mật khẩu</option></select></label>
              <button className="btn-primary" type="button" onClick={() => load()} disabled={loading}><FaFilter className="mr-2" aria-hidden="true" />Lọc</button>
              <button className="btn-secondary" type="button" onClick={resetFilters} disabled={!search && !role && !status}>Xóa lọc</button>
            </div>
          </div>

          {loading && !stats ? <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm font-medium text-slate-500"><span className="loading-spinner" aria-hidden="true" />Đang tải dữ liệu…</div> : users.length === 0 ? (
            <div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FaUsers aria-hidden="true" /></div><p className="mt-4 font-semibold text-slate-800">Không tìm thấy tài khoản</p><p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4 font-semibold">Tài khoản</th><th className="px-5 py-4 font-semibold">Vai trò</th><th className="px-5 py-4 font-semibold">Trạng thái</th><th className="px-5 py-4 font-semibold">Ngày tạo</th><th className="px-5 py-4 text-right font-semibold">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{users.map((item) => <tr key={item.id} className="transition hover:bg-blue-50/40"><td className="px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold uppercase text-blue-700">{(item.email || '?').charAt(0)}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{item.email}</p><p className="mt-0.5 truncate text-xs text-slate-400">{item.id}</p></div></div></td><td className="px-5 py-4"><RoleBadge role={item.role} /></td><td className="px-5 py-4"><StatusBadge status={item.account_status} /></td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '—'}</td><td className="px-5 py-4 text-right"><button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100" type="button" onClick={() => viewUser(item.id)}><FaEye aria-hidden="true" />Chi tiết</button></td></tr>)}</tbody>
              </table>
            </div>
          )}

          <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">
            <p className="text-xs text-slate-500">{loading ? 'Đang cập nhật…' : 'Danh sách người dùng'}</p>
            <div className="flex gap-2"><button className="btn-secondary !rounded-lg !px-3 !py-2" type="button" aria-label="Trang trước" disabled={!cursor || loading} onClick={() => load()}><FaChevronLeft aria-hidden="true" /></button><button className="btn-secondary !rounded-lg !px-3 !py-2" type="button" aria-label="Trang tiếp" disabled={!nextCursor || loading} onClick={() => load(nextCursor)}><FaChevronRight aria-hidden="true" /></button></div>
          </footer>
        </section>
      </div>

      {selectedUser && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedUser(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="admin-user-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/50 bg-white p-6 shadow-2xl sm:p-8">
          <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Thông tin tài khoản</p><h2 id="admin-user-title" className="mt-2 break-all text-xl font-bold text-slate-900">{selectedUser.email}</h2><p className="mt-1 text-sm text-slate-500">Chi tiết người dùng trong hệ thống</p></div><button className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" type="button" aria-label="Đóng chi tiết" onClick={() => setSelectedUser(null)}><FaTimes aria-hidden="true" /></button></header>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vai trò</p><div className="mt-2"><RoleBadge role={selectedUser.role} /></div></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</p><div className="mt-2"><StatusBadge status={selectedUser.account_status} /></div></div><div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày tạo</p><p className="mt-2 font-medium text-slate-800">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('vi-VN') : '—'}</p></div></div>
          {selectedUser.role === 'ADMIN' && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><FaShieldAlt className="mr-2 inline" aria-hidden="true" />Trạng thái và khôi phục tài khoản Admin do operator quản lý ngoài MVP.</div>}
          {selectedUser.role !== 'ADMIN' && selectedUser.account_status !== 'RESET_REQUIRED' && <button className="btn-primary mt-6" type="button" disabled={working || !etag} onClick={changeStatus}>{working ? 'Đang cập nhật…' : selectedUser.account_status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}</button>}
          {selectedUser.role !== 'ADMIN' && selectedUser.account_status === 'RESET_REQUIRED' && <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Tài khoản cần đặt lại mật khẩu được bảo vệ và không thể kích hoạt tại đây.</div>}
          <footer className="mt-7 flex justify-end border-t border-slate-100 pt-5"><button className="btn-secondary" type="button" onClick={() => setSelectedUser(null)}>Đóng</button></footer>
        </section>
      </div>}
    </main>
  );
};

export default AdminDashboard;
