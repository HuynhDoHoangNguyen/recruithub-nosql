import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Register = () => {
	const navigate = useNavigate();
	const { login } = useAuth();
	const [form, setForm] = useState({
		name: '',
		email: '',
		password: '',
		role: 'job-seeker',
	});
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	const handleChange = (event) => {
		setForm({ ...form, [event.target.name]: event.target.value });
	};

	const isStrongPassword = (password) => {
		return password.length >= 6 && /[A-Z]/.test(password) && /\d/.test(password);
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');

		if (!isStrongPassword(form.password)) {
			setError(
				'Mật khẩu phải có ít nhất 6 ký tự, bao gồm ít nhất 1 chữ hoa và 1 chữ số.'
			);
			return;
		}

		try {
			setLoading(true);
			const response = await api.post('/auth/register', form);
			const accessToken = response.data?.accessToken;

			if (accessToken) {
				login(accessToken);
				navigate(form.role === 'recruiter' ? '/recruiter/dashboard' : '/user/dashboard');
				return;
			}

			setError('Đăng ký thành công nhưng chưa nhận được token. Vui lòng đăng nhập.');
			navigate('/login');
		} catch (requestError) {
			setError(
				requestError.response?.data?.message ||
				requestError.response?.data?.error ||
				'Đăng ký tài khoản thất bại'
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
			<div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden grid lg:grid-cols-12 min-h-[660px]">
				
				{/* LEFT COLUMN: BRANDED TECH SHOWCASE (ITviec / TopCV Style - 5 cols) */}
				<div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
					<div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
					<div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

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
								✨ Khởi đầu sự nghiệp công nghệ
							</span>
							<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
								Tạo tài khoản & kết nối nhà tuyển dụng IT
							</h2>
							<p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
								Chỉ mất 30 giây để bắt đầu tiếp cận hàng trăm việc làm IT hấp dẫn với mức đãi ngộ cao nhất thị trường.
							</p>
						</div>

						<div className="mt-8 space-y-3.5 text-xs text-slate-200 font-medium">
							<div className="flex items-center gap-3">
								<span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
								<span>Hồ sơ bảo mật, kiểm soát ai có thể xem CV</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
								<span>Gợi ý việc làm chuẩn xác theo tech stack của bạn</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
								<span>Tích hợp công cụ quản lý ứng tuyển trực quan</span>
							</div>
						</div>
					</div>

					<div className="relative z-10 pt-8 border-t border-white/10 text-[11px] text-slate-400">
						<span>© 2026 JobPortal IT. Nền tảng việc làm chuyên biệt ngành IT.</span>
					</div>
				</div>

				{/* RIGHT COLUMN: MODERN REGISTRATION FORM (7 cols) */}
				<div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
					
					{/* Tabs: Login / Register */}
					<div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
						<Link
							to="/login"
							className="text-base font-semibold text-slate-400 hover:text-slate-700 pb-2 px-2 transition"
						>
							Đăng Nhập
						</Link>
						<Link
							to="/register"
							className="text-base font-extrabold text-blue-700 border-b-2 border-blue-600 pb-2 -mb-3.5 px-2"
						>
							Đăng Ký Tài Khoản
						</Link>
					</div>

					{error && (
						<div
							role="alert"
							className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-600 flex items-center gap-2"
						>
							<span>⚠️</span>
							<span>{error}</span>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Role Selection */}
						<div>
							<label className="mb-1.5 block text-xs font-bold text-slate-700">
								Tôi muốn tham gia với vai trò:
							</label>
							<div className="grid grid-cols-2 gap-3">
								<label
									className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition ${
										form.role === 'job-seeker'
											? 'border-blue-600 bg-blue-50/70 shadow-sm'
											: 'border-slate-200 hover:border-slate-300 bg-white'
									}`}
								>
									<input
										type="radio"
										name="role"
										value="job-seeker"
										checked={form.role === 'job-seeker'}
										onChange={handleChange}
										className="sr-only"
									/>
									<span className="text-2xl">👤</span>
									<div>
										<p className="text-xs font-bold text-slate-900">Ứng Viên IT</p>
										<p className="text-[11px] text-slate-500">Tìm việc làm phù hợp</p>
									</div>
								</label>

								<label
									className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition ${
										form.role === 'recruiter'
											? 'border-blue-600 bg-blue-50/70 shadow-sm'
											: 'border-slate-200 hover:border-slate-300 bg-white'
									}`}
								>
									<input
										type="radio"
										name="role"
										value="recruiter"
										checked={form.role === 'recruiter'}
										onChange={handleChange}
										className="sr-only"
									/>
									<span className="text-2xl">🏢</span>
									<div>
										<p className="text-xs font-bold text-slate-900">Nhà Tuyển Dụng</p>
										<p className="text-[11px] text-slate-500">Đăng tin & tìm nhân tài</p>
									</div>
								</label>
							</div>
						</div>

						{/* Full Name */}
						<div>
							<label htmlFor="name" className="mb-1.5 block text-xs font-bold text-slate-700">
								Họ và tên
							</label>
							<input
								name="name"
								id="name"
								type="text"
								placeholder="Nguyễn Văn A"
								value={form.name}
								onChange={handleChange}
								autoComplete="name"
								required
								className="input-field"
							/>
						</div>

						{/* Email */}
						<div>
							<label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">
								Email cá nhân / công việc
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

						{/* Password */}
						<div>
							<label htmlFor="password" className="mb-1.5 block text-xs font-bold text-slate-700">
								Mật khẩu
							</label>
							<div className="relative">
								<input
									name="password"
									id="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Tối thiểu 6 ký tự (1 chữ hoa, 1 số)"
									value={form.password}
									onChange={handleChange}
									autoComplete="new-password"
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

						<button
							type="submit"
							disabled={loading}
							className="btn-primary w-full py-3.5 text-sm font-bold shadow-md cursor-pointer mt-2"
						>
							{loading && (
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							)}
							<span>{loading ? 'Đang tạo tài khoản...' : 'Đăng Ký Tài Khoản'}</span>
							<svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</button>
					</form>

					<p className="mt-6 text-center text-xs text-slate-500">
						Đã có tài khoản?{' '}
						<Link to="/login" className="font-bold text-blue-700 hover:underline">
							Đăng nhập tại đây
						</Link>
					</p>
				</div>

			</div>
		</main>
	);
};

export default Register;
