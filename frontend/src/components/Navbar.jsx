import { useState } from "react";
import { NavLink as Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { normalizeRole } from '../features/applications/applicationPresentation';

const Navbar = () => {
	const { user: principal, logout } = useAuth();
	const user = principal ? { ...principal, name: principal.name || principal.email || 'Tài khoản',
		role: { CANDIDATE: 'job-seeker', RECRUITER: 'recruiter', ADMIN: 'admin' }[normalizeRole(principal.role)] || principal.role } : null;
	const [menuOpen, setMenuOpen] = useState(false);
	const [userDropdown, setUserDropdown] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();

	const handleLogout = () => {
		logout();
		setUserDropdown(false);
		navigate("/");
	};

	const getDashboardRoute = () => {
		if (!user) return "/";
		switch (user.role) {
			case "admin":
				return "/admin/dashboard";
			case "recruiter":
				return "/recruiter/dashboard";
			case "job-seeker":
				return "/user/dashboard";
			default:
				return "/";
		}
	};

	const isActive = (path) => location.pathname === path;

	const roleLabel = {
		'admin': { text: 'Admin', color: 'bg-amber-100 text-amber-800 border-amber-300' },
		'recruiter': { text: 'Nhà tuyển dụng', color: 'bg-purple-100 text-purple-800 border-purple-300' },
		'job-seeker': { text: 'Ứng viên', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
	};

	return (
		<nav aria-label="Điều hướng chính" onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); setUserDropdown(false); } }} className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">

					{/* Logo TopCV/ITviec style */}
					<div className="flex items-center gap-8">
						<Link to="/" className="flex items-center gap-2.5 group">
							<div className="h-10 w-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
								<span className="text-white font-extrabold text-xl tracking-tight">J</span>
							</div>
							<div className="flex flex-col">
								<div className="flex items-center gap-1.5">
									<span className="text-xl font-extrabold text-slate-900 tracking-tight">
										JobPortal
									</span>
									<span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
										IT
									</span>
								</div>
								<span className="text-[10px] text-slate-400 font-medium -mt-1 hidden sm:block">
									Ít nhưng mà chất
								</span>
							</div>
						</Link>

						{/* Desktop Navigation Links */}
						<div className="hidden lg:flex items-center space-x-1">
							<Link
								to="/jobs"
								aria-label="Việc Làm IT"
								className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
									isActive('/jobs')
										? 'bg-blue-50 text-blue-700'
										: 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
								}`}
							>
								<span>Việc Làm IT</span>
								<span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
									HOT
								</span>
							</Link>

							{user && (
								<Link
									to={getDashboardRoute()}
									className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
										location.pathname.includes('dashboard')
											? 'bg-blue-50 text-blue-700'
											: 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
									}`}
								>
									Bảng Điều Khiển
								</Link>
							)}

							{user && user.role !== 'admin' && (
								<Link
									to="/profile"
									className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
										isActive('/profile')
											? 'bg-blue-50 text-blue-700'
											: 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
									}`}
								>
									{user.role === 'recruiter' ? 'Hồ Sơ Doanh Nghiệp' : 'Hồ Sơ & CV'}
								</Link>
							)}
						</div>
					</div>

					{/* Right Side Actions */}
					<div className="hidden lg:flex items-center space-x-3">
						{/* Recruiter fast action */}
						{(!user || user.role === 'recruiter') && (
							<Link
								to={user ? "/recruiter/jobs/create" : "/login"}
								aria-label="Đăng Tin Tuyển Dụng"
								className="text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
							>
								<span>🏢</span>
								<span>Đăng Tin Tuyển Dụng</span>
							</Link>
						)}

						{user ? (
							<div className="relative">
								<button
									aria-label="Menu tài khoản" aria-expanded={userDropdown} aria-controls="account-navigation"
									onClick={() => setUserDropdown(!userDropdown)}
									className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
								>
									<div className="h-9 w-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
										{user.name?.charAt(0).toUpperCase()}
									</div>
									<div className="text-left hidden xl:block">
										<p className="text-xs font-bold text-slate-800 leading-tight max-w-[120px] truncate">
											{user.name}
										</p>
										<span className="text-[10px] text-slate-500 font-medium capitalize">
											{roleLabel[user.role]?.text || user.role}
										</span>
									</div>
									<svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</button>

								{/* User Dropdown Menu */}
								{userDropdown && (
									<div
										id="account-navigation"
										className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in"
										onMouseLeave={() => setUserDropdown(false)}
									>
										<div className="px-4 py-2.5 border-b border-slate-100">
											<p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
											<p className="text-xs text-slate-500 truncate">{user.email}</p>
											<span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleLabel[user.role]?.color}`}>
												{roleLabel[user.role]?.text}
											</span>
										</div>

										<Link
											to={getDashboardRoute()}
											onClick={() => setUserDropdown(false)}
											className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
										>
											<span>📊</span> Bảng điều khiển
										</Link>

										{user.role !== 'admin' && (
											<Link
												to="/profile"
												onClick={() => setUserDropdown(false)}
												className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
											>
												<span>👤</span> Hồ sơ cá nhân
											</Link>
										)}

										{user.role === 'recruiter' && (
											<Link
												to="/recruiter/jobs/create"
												onClick={() => setUserDropdown(false)}
												className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
											>
												<span>➕</span> Đăng việc mới
											</Link>
										)}

										<div className="border-t border-slate-100 mt-1 pt-1">
											<button
												onClick={handleLogout}
												className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
											>
												<span>🚪</span> Đăng xuất
											</button>
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="flex items-center gap-2">
								<Link
									to="/login"
									className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
								>
									Đăng nhập
								</Link>
								<Link
									to="/register"
									className="btn-primary text-sm px-4 py-2"
								>
									Đăng ký
								</Link>
							</div>
						)}
					</div>

					{/* Mobile Menu Button */}
					<div className="lg:hidden flex items-center">
						<button
							aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation"
							onClick={() => setMenuOpen(!menuOpen)}
							className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition"
						>
							<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								{menuOpen ? (
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								) : (
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
								)}
							</svg>
						</button>
					</div>
				</div>

				{/* Mobile Navigation Drawer */}
				{menuOpen && (
					<div id="mobile-navigation" className="lg:hidden py-4 border-t border-slate-100 space-y-2 bg-white rounded-b-2xl animate-fade-in">
						<Link
							to="/jobs"
							aria-label="Việc Làm IT"
							onClick={() => setMenuOpen(false)}
							className="block px-4 py-2.5 rounded-xl text-base font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-600"
						>
							💼 Việc Làm IT
						</Link>

						{user ? (
							<>
								<div className="px-4 py-2 bg-slate-50 rounded-xl my-2 border border-slate-100">
									<p className="font-bold text-slate-900 text-sm">{user.name}</p>
									<p className="text-xs text-slate-500">{user.email}</p>
								</div>

								<Link
									to={getDashboardRoute()}
									onClick={() => setMenuOpen(false)}
									className="block px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									Bảng Điều Khiển
								</Link>

								{user.role !== 'admin' && (
									<Link
										to="/profile"
										onClick={() => setMenuOpen(false)}
										className="block px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
									>
										{user.role === 'recruiter' ? 'Hồ Sơ Doanh Nghiệp' : 'Hồ Sơ & CV'}
									</Link>
								)}

								{user.role === 'recruiter' && <Link to="/recruiter/jobs/create" onClick={() => setMenuOpen(false)} className="block px-4 py-2 rounded-xl text-sm font-semibold text-blue-600">Đăng Tin Tuyển Dụng</Link>}
								<button
									onClick={handleLogout}
									className="w-full text-left px-4 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50"
								>
									🚪 Đăng xuất
								</button>
							</>
						) : (
							<div className="pt-2 flex flex-col gap-2 px-2">
								<Link
									to="/login"
									onClick={() => setMenuOpen(false)}
									className="btn-secondary w-full text-center py-2.5 text-sm"
								>
									Đăng nhập
								</Link>
								<Link
									to="/register"
									onClick={() => setMenuOpen(false)}
									className="btn-primary w-full text-center py-2.5 text-sm"
								>
									Đăng ký tài khoản
								</Link>
							</div>
						)}
					</div>
				)}
			</div>
		</nav>
	);
};

export default Navbar;
