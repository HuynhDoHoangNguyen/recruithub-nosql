import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
	const { user, login } = useAuth();
	const navigate = useNavigate();
	const [form, setForm] = useState({ email: '', password: '' });
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	const handleChange = (e) =>
		setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await api.post('/auth/login', form);
			const { accessToken, refreshToken } = res.data;
			login(accessToken, refreshToken);
		} catch (err) {
			setError(err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại!');
		} finally {
			setLoading(false);
		}
	};

	const handleQuickLogin = async (email, role) => {
		setError('');
		setLoading(true);
		try {
			const res = await api.post('/auth/login', { email, password: 'password123' });
			const { accessToken, refreshToken } = res.data;
			login(accessToken, refreshToken);
			if (role === 'admin') navigate('/admin/dashboard');
			else if (role === 'recruiter') navigate('/recruiter/dashboard');
			else navigate('/user/dashboard');
		} catch (err) {
			setError(err.response?.data?.message || 'Đăng nhập nhanh thất bại');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (user) navigate('/');
	}, [user, navigate]);

	return (
		<main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
			<div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden grid lg:grid-cols-12 min-h-[620px]">
				
				{/* LEFT COLUMN: BRANDED TECH SHOWCASE (ITviec / TopCV Style - 5 cols) */}
				<div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
					{/* Decorative background glow */}
					<div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
					<div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

					{/* Brand Logo */}
					<div className="relative z-10">
						<Link to="/" className="flex items-center gap-2.5 mb-8">
							<div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-md">
								J
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-xl font-extrabold tracking-tight">JobPortal</span>
								<span className="bg-red-600 text-[10px] font-black px-1.5 py-0.5 rounded">IT</span>
							</div>
						</Link>

						<div className="space-y-4">
							<span className="inline-block px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold border border-white/10">
								🚀 100,000+ Lập trình viên tin dùng
							</span>
							<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
								Tìm việc IT mơ ước & bứt phá thu nhập
							</h2>
							<p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
								Gia nhập JobPortal IT để kết nối trực tiếp với 200+ doanh nghiệp công nghệ hàng đầu và cập nhật mức lương mới nhất.
							</p>
						</div>

						{/* Highlights */}
						<div className="mt-8 space-y-3.5 text-xs text-slate-200 font-medium">
							<div className="flex items-center gap-3">
								<span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
								<span>Việc làm IT chọn lọc, thông tin lương minh bạch</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
								<span>Ứng tuyển 1-click, theo dõi trạng thái đơn trực tiếp</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
								<span>Cơ hội từ VNG, Shopee, Grab, FPT Software, MoMo</span>
							</div>
						</div>
					</div>

					{/* Partner badges footer */}
					<div className="relative z-10 pt-8 border-t border-white/10 text-[11px] text-slate-400">
						<span>Hợp tác tuyển dụng cùng các Tech Hub hàng đầu Việt Nam</span>
					</div>
				</div>

				{/* RIGHT COLUMN: MODERN AUTH CARD (7 cols) */}
				<div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
					
					{/* Tabs: Login / Register */}
					<div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
						<Link
							to="/login"
							className="text-base font-extrabold text-blue-700 border-b-2 border-blue-600 pb-2 -mb-3.5 px-2"
						>
							Đăng Nhập
						</Link>
						<Link
							to="/register"
							className="text-base font-semibold text-slate-400 hover:text-slate-700 pb-2 px-2 transition"
						>
							Đăng Ký Tài Khoản
						</Link>
					</div>

					{/* 1-Click Demo Accounts Bar */}
					<div className="mb-6 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl shadow-sm">
						<div className="flex items-center justify-between mb-2">
							<span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
								⚡ Tài khoản test nhanh (1-Click)
							</span>
							<span className="text-[10px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded-full border border-blue-200">
								Demo Mode
							</span>
						</div>
						<div className="grid grid-cols-3 gap-2">
							<button
								type="button"
								onClick={() => handleQuickLogin('seeker@demo.com', 'job-seeker')}
								className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold bg-white text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-600 hover:text-white transition shadow-sm cursor-pointer"
							>
								<span>👤</span>
								<span className="truncate">Job Seeker</span>
							</button>
							<button
								type="button"
								onClick={() => handleQuickLogin('recruiter@demo.com', 'recruiter')}
								className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold bg-white text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-600 hover:text-white transition shadow-sm cursor-pointer"
							>
								<span>🏢</span>
								<span className="truncate">Recruiter</span>
							</button>
							<button
								type="button"
								onClick={() => handleQuickLogin('admin@demo.com', 'admin')}
								className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold bg-white text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white transition shadow-sm cursor-pointer"
							>
								<span>👑</span>
								<span className="truncate">Admin</span>
							</button>
						</div>
					</div>

					{/* Error Alert */}
					{error && (
						<div
							role="alert"
							className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-600 flex items-center gap-2"
						>
							<span>⚠️</span>
							<span>{error}</span>
						</div>
					)}

					{/* Login Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">
								Email đăng nhập
							</label>
							<input
								name="email"
								id="email"
								type="email"
								placeholder="name@example.com"
								value={form.email}
								onChange={handleChange}
								autoComplete="email"
								required
								className="input-field"
							/>
						</div>

						<div>
							<div className="flex items-center justify-between mb-1.5">
								<label htmlFor="password" className="block text-xs font-bold text-slate-700">
									Mật khẩu
								</label>
								<a href="#" className="text-xs font-semibold text-blue-600 hover:underline">
									Quên mật khẩu?
								</a>
							</div>
							<div className="relative">
								<input
									name="password"
									id="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="••••••••"
									value={form.password}
									onChange={handleChange}
									autoComplete="current-password"
									required
									className="input-field pr-11"
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
									onClick={() => setShowPassword(!showPassword)}
									tabIndex={-1}
								>
									{showPassword ? (
										<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
										</svg>
									) : (
										<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
									)}
								</button>
							</div>
						</div>

						<div className="flex items-center text-xs">
							<label htmlFor="remember-me" className="flex items-center text-slate-600 cursor-pointer">
								<input
									id="remember-me"
									name="remember-me"
									type="checkbox"
									className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
								/>
								<span className="ml-2 font-medium">Ghi nhớ đăng nhập</span>
							</label>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="btn-primary w-full py-3.5 text-sm font-bold shadow-md cursor-pointer"
						>
							{loading && (
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							)}
							<span>{loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}</span>
							<svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</button>
					</form>

					<p className="mt-6 text-center text-xs text-slate-500">
						Chưa có tài khoản?{' '}
						<Link to="/register" className="font-bold text-blue-700 hover:underline">
							Đăng ký ngay miễn phí
						</Link>
					</p>
				</div>

			</div>
		</main>
	);
};

export default Login;
