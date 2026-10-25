import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const POPULAR_SKILLS = [
	'React', 'Node.js', 'TypeScript', 'Python', 'Docker', 'AWS', 'Golang', 'AI / LLM'
];

const TOP_COMPANIES = [
	{ name: 'VNG Tech Hub', initials: 'VNG', color: 'from-blue-600 to-indigo-700', jobsCount: '5 việc làm' },
	{ name: 'Shopee Vietnam', initials: 'SP', color: 'from-orange-500 to-red-600', jobsCount: '4 việc làm' },
	{ name: 'Grab Financial', initials: 'GRB', color: 'from-emerald-600 to-teal-700', jobsCount: '3 việc làm' },
	{ name: 'FPT Software', initials: 'FPT', color: 'from-blue-700 to-cyan-600', jobsCount: '6 việc làm' },
	{ name: 'MoMo Fintech', initials: 'MM', color: 'from-pink-600 to-rose-700', jobsCount: '2 việc làm' },
];

const Landing = () => {
	const [query, setQuery] = useState('');
	const [selectedLocation, setSelectedLocation] = useState('');
	const [latestJobs, setLatestJobs] = useState([]);
	const [loading, setLoading] = useState(true);
	const { user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		const fetchRecentJobs = async () => {
			try {
				const res = await api.get('/jobs/recent?limit=6');
				setLatestJobs(res.data.jobs || []);
			} catch (err) {
				console.error('Failed to fetch recent jobs', err);
			} finally {
				setLoading(false);
			}
		};
		fetchRecentJobs();
	}, [user]);

	const handleSearch = (e) => {
		if (e) e.preventDefault();
		const params = new URLSearchParams();
		if (query.trim()) params.append('q', query.trim());
		if (selectedLocation) params.append('location', selectedLocation);
		navigate(`/jobs?${params.toString()}`);
	};

	const handleSkillClick = (skill) => {
		navigate(`/jobs?q=${encodeURIComponent(skill)}`);
	};

	const CATEGORY_TABS = ['Tất cả', 'Frontend', 'Backend', 'Fullstack', 'DevOps', 'Mobile', 'AI & Data'];
	const [activeCategory, setActiveCategory] = useState('Tất cả');

	const displayedJobs = latestJobs.filter((job) => {
		if (activeCategory === 'Tất cả') return true;
		const text = `${job.title} ${job.tags?.join(' ')} ${job.skills?.join(' ')}`.toLowerCase();
		if (activeCategory === 'Frontend') return text.includes('frontend') || text.includes('react') || text.includes('vue');
		if (activeCategory === 'Backend') return text.includes('backend') || text.includes('node') || text.includes('java') || text.includes('golang');
		if (activeCategory === 'Fullstack') return text.includes('fullstack');
		if (activeCategory === 'DevOps') return text.includes('devops') || text.includes('cloud') || text.includes('aws') || text.includes('docker');
		if (activeCategory === 'Mobile') return text.includes('mobile') || text.includes('react native') || text.includes('ios') || text.includes('android');
		if (activeCategory === 'AI & Data') return text.includes('ai') || text.includes('data') || text.includes('python') || text.includes('llm');
		return true;
	});

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
				<div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-50">
			{/* HERO SECTION - TopCV / ITviec Style */}
			<section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
				{/* Background decorative glow */}
				<div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
				<div className="absolute bottom-0 left-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

				<div className="relative max-w-6xl mx-auto text-center space-y-8">
					{/* Badge */}
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-blue-200">
						<span className="flex h-2 w-2 relative">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
						</span>
						<span>Cổng thông tin tuyển dụng IT chất lượng cao</span>
					</div>

					{/* Main Headline */}
					<div className="space-y-4 max-w-4xl mx-auto">
						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
							Khám Phá Cơ Hội Việc Làm IT
							<span className="block mt-1 bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
								Lương Cao & Đãi Ngộ Hàng Đầu
							</span>
						</h1>
						<p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
							Kết nối trực tiếp với 200+ công ty công nghệ & unicorn uy tín tại Việt Nam. Mức lương minh bạch, phỏng vấn nhanh, phản hồi trực tiếp.
						</p>
					</div>

					{/* 3-Section Floating Search Bar */}
					<div className="max-w-4xl mx-auto">
						<form
							onSubmit={handleSearch}
							className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-2xl flex flex-col md:flex-row items-center gap-2 text-slate-800 border border-slate-100"
						>
							{/* Keyword Search */}
							<div className="flex-1 flex items-center gap-3 w-full px-3 py-2">
								<svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
								<input
									type="text"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder="Tên công việc, kỹ năng (React, Node, DevOps...)"
									className="w-full text-sm outline-none text-slate-800 placeholder:text-slate-400 font-medium"
								/>
							</div>

							<div className="hidden md:block w-px h-8 bg-slate-200"></div>

							{/* Location Dropdown */}
							<div className="flex items-center gap-2.5 w-full md:w-56 px-3 py-2">
								<svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<select
									value={selectedLocation}
									onChange={(e) => setSelectedLocation(e.target.value)}
									className="w-full text-sm outline-none text-slate-700 bg-transparent font-medium cursor-pointer"
								>
									<option value="">Tất cả địa điểm</option>
									<option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
									<option value="Hà Nội">Hà Nội</option>
									<option value="Đà Nẵng">Đà Nẵng</option>
									<option value="Remote">Làm việc từ xa (Remote)</option>
								</select>
							</div>

							{/* Search CTA Button */}
							<button
								type="submit"
								className="w-full md:w-auto px-7 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-150 flex items-center justify-center gap-2 text-sm shrink-0 cursor-pointer"
							>
								<span>Tìm Kiếm</span>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
								</svg>
							</button>
						</form>

						{/* Popular Tags */}
						<div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
							<span className="text-slate-400 font-semibold flex items-center gap-1">
								<span>🔥 Gợi ý:</span>
							</span>
							{POPULAR_SKILLS.map((skill) => (
								<button
									key={skill}
									onClick={() => handleSkillClick(skill)}
									className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition font-medium border border-white/10 cursor-pointer"
								>
									{skill}
								</button>
							))}
						</div>
					</div>

					{/* Key Metrics */}
					<div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-white/10 text-center">
						<div>
							<p className="text-2xl sm:text-3xl font-extrabold text-white">500+</p>
							<p className="text-xs text-slate-400 mt-1">Việc làm IT tuyển chọn</p>
						</div>
						<div>
							<p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">Up to $4,500</p>
							<p className="text-xs text-slate-400 mt-1">Mức lương cạnh tranh</p>
						</div>
						<div>
							<p className="text-2xl sm:text-3xl font-extrabold text-white">200+</p>
							<p className="text-xs text-slate-400 mt-1">Doanh nghiệp Tech uy tín</p>
						</div>
						<div>
							<p className="text-2xl sm:text-3xl font-extrabold text-indigo-400">98%</p>
							<p className="text-xs text-slate-400 mt-1">Phản hồi hồ sơ trong 48h</p>
						</div>
					</div>
				</div>
			</section>

			{/* TOP COMPANIES SECTION */}
			<section className="py-8 bg-white border-b border-slate-200/80">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
						Được tin tưởng bởi các doanh nghiệp công nghệ hàng đầu
					</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
						{TOP_COMPANIES.map((company) => (
							<div
								key={company.name}
								onClick={() => navigate(`/jobs?q=${encodeURIComponent(company.name)}`)}
								className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/60 hover:bg-white hover:shadow-sm cursor-pointer transition"
							>
								<div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${company.color} flex items-center justify-center text-white font-extrabold text-xs shadow-sm shrink-0`}>
									{company.initials}
								</div>
								<div className="truncate">
									<h4 className="text-xs font-bold text-slate-800 truncate">{company.name}</h4>
									<p className="text-[11px] text-blue-600 font-medium">{company.jobsCount}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* FEATURED IT JOBS - ITviec / TopCV Style */}
			<section className="py-14 bg-slate-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
						<div>
							<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mb-2">
								<span>⭐</span>
								<span>Cơ Hội Mới Nhất</span>
							</div>
							<h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
								Việc Làm IT Tiêu Biểu
							</h2>
							<p className="text-slate-500 text-sm mt-1">
								Các vị trí kỹ thuật hấp dẫn được đăng tuyển trực tiếp từ nhà tuyển dụng
							</p>
						</div>

						<Link
							to="/jobs"
							className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition shrink-0"
						>
							<span>Xem tất cả việc làm ({latestJobs.length})</span>
							<span>→</span>
						</Link>
					</div>

					{/* Category Tabs (TopCV/ITviec style) */}
					<div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
						{CATEGORY_TABS.map((cat) => (
							<button
								key={cat}
								onClick={() => setActiveCategory(cat)}
								className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
									activeCategory === cat
										? 'bg-blue-600 text-white shadow-sm'
										: 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
								}`}
							>
								{cat}
							</button>
						))}
					</div>

					{/* Job Cards Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{displayedJobs.length === 0 ? (
							<div className="col-span-full bg-white rounded-2xl p-10 text-center border border-slate-200">
								<p className="text-sm font-semibold text-slate-500">
									Không có việc làm nào phù hợp với danh mục này.
								</p>
								<button
									onClick={() => setActiveCategory('Tất cả')}
									className="mt-3 text-xs text-blue-600 font-bold hover:underline"
								>
									Xem tất cả việc làm
								</button>
							</div>
						) : (
							displayedJobs.map((job) => (
							<div
								key={job._id}
								onClick={() => navigate(`/jobs/${job._id}`)}
								className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-hover transition-all duration-200 flex flex-col justify-between cursor-pointer group relative"
							>
								{/* Card Header with Company Avatar & Hot Badge */}
								<div>
									<div className="flex items-start justify-between gap-3 mb-3.5">
										<div className="flex items-center gap-3">
											<div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${job.companyLogoBg || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0`}>
												{job.companyInitials || job.company?.substring(0, 3).toUpperCase()}
											</div>
											<div>
												<div className="flex items-center gap-1">
													<p className="text-xs font-semibold text-slate-600 truncate max-w-[150px]">
														{job.company}
													</p>
													{job.companyVerified && (
														<span className="text-blue-500 text-xs" title="Doanh nghiệp xác thực">✓</span>
													)}
												</div>
												<span className="text-[11px] text-slate-400">
													{job.postedTime || 'Gần đây'}
												</span>
											</div>
										</div>

										{job.isHot && (
											<span className="badge-hot">
												<span>🔥</span> HOT
											</span>
										)}
									</div>

									{/* Job Title */}
									<h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-3">
										{job.title}
									</h3>

									{/* Salary Pill (TopCV Signature Emerald Badge) */}
									<div className="mb-3">
										<span className="badge-salary">
											<span>💵</span>
											<span>{job.salaryFormatted || `$${job.salary?.toLocaleString()} / năm`}</span>
										</span>
									</div>

									{/* Location & Work Mode */}
									<div className="flex items-center gap-3 text-xs text-slate-500 mb-3.5">
										<span className="flex items-center gap-1 truncate">
											<span>📍</span> {job.city || job.location}
										</span>
										<span>•</span>
										<span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-[11px]">
											{job.workMode || job.jobType}
										</span>
									</div>

									{/* Skill Chips */}
									{job.tags && job.tags.length > 0 && (
										<div className="flex flex-wrap gap-1.5 mb-4">
											{job.tags.slice(0, 3).map((tag, idx) => (
												<span
													key={idx}
													className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md"
												>
													{tag}
												</span>
											))}
										</div>
									)}
								</div>

								{/* Card Footer */}
								<div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
									<span className="text-slate-400">Cập nhật liên tục</span>
									<span className="text-blue-600 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
										<span>Ứng tuyển ngay</span>
										<span>→</span>
									</span>
								</div>
							</div>
						))
					)}
					</div>
				</div>
			</section>

			{/* VALUE PROPOSITION SECTION */}
			<section className="py-16 bg-white border-t border-slate-200/80">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center max-w-3xl mx-auto mb-12">
						<h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
							Tại Sao Lập Trình Viên Chọn JobPortal IT?
						</h2>
						<p className="text-slate-500 text-sm mt-2">
							Nền tảng tối ưu trải nghiệm tìm việc với tiêu chuẩn cao nhất dành riêng cho dân IT
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-6">
						{[
							{
								icon: '🎯',
								title: 'Việc Làm IT Chọn Lọc',
								desc: '100% tin tuyển dụng được kiểm duyệt chặt chẽ, mô tả stack công nghệ rõ ràng và minh bạch mức lương.'
							},
							{
								icon: '⚡',
								title: 'Ứng Tuyển Siêu Tốc',
								desc: 'Nộp hồ sơ trực tiếp chỉ với 1 click, theo dõi trạng thái hồ sơ theo thời gian thực (Đã nhận, Đang duyệt, Chấp thuận).'
							},
							{
								icon: '🚀',
								title: 'Bảng Điều Khiển Đa Năng',
								desc: 'Dashboard chuyên nghiệp cho cả Ứng viên (quản lý CV, lịch sử ứng tuyển) và Nhà tuyển dụng (sàng lọc, duyệt ứng viên).'
							}
						].map((item, idx) => (
							<div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all">
								<div className="text-3xl mb-3">{item.icon}</div>
								<h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
								<p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* RECRUITER CTA BANNER */}
			<section className="py-14 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
					<div>
						<h2 className="text-2xl sm:text-3xl font-extrabold">
							Bạn là Doanh nghiệp muốn tuyển dụng nhân tài IT?
						</h2>
						<p className="text-blue-100 text-sm mt-2 max-w-xl">
							Đăng tin tuyển dụng và tiếp cận hơn 50,000+ hồ sơ lập trình viên chất lượng cao trên JobPortal IT ngay hôm nay.
						</p>
					</div>
					<div className="flex gap-3 shrink-0">
						<Link
							to="/recruiter/jobs/create"
							className="px-6 py-3 rounded-xl font-bold bg-white text-blue-700 hover:bg-blue-50 shadow-md transition cursor-pointer text-sm"
						>
							Đăng Việc Miễn Phí
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
};

export default Landing;
