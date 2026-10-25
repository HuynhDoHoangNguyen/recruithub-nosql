// src/pages/Jobs/JobList.jsx
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

const SDE_SKILLS = [
	'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'AWS', 'Docker',
	'MongoDB', 'Express', 'Redux', 'CI/CD', 'Git', 'Django', 'Figma', 'React Native'
];

const JobList = () => {
	const [searchParams] = useSearchParams();
	const initialQuery = searchParams.get('q') || '';
	const initialLocation = searchParams.get('location') || '';

	const [jobs, setJobs] = useState([]);
	const [search, setSearch] = useState(initialQuery);
	const [loading, setLoading] = useState(false);
	const [showAllSkills, setShowAllSkills] = useState(false);
	const [showMobileFilters, setShowMobileFilters] = useState(false);
	const [filters, setFilters] = useState({
		workMode: '',
		location: initialLocation,
		company: '',
		experienceLevel: '',
		skills: [],
	});

	const fetchJobs = async (searchQuery = '') => {
		setLoading(true);
		try {
			let url = '/jobs/all';
			if (searchQuery.trim()) {
				url += `?q=${encodeURIComponent(searchQuery.trim())}`;
			}
			const res = await api.get(url);
			setJobs(res.data || []);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchJobs(search);
	}, [search]);

	const handleFilterChange = (e) => {
		const { name, value, checked, type } = e.target;
		if (type === 'checkbox') {
			setFilters((prev) => ({
				...prev,
				skills: checked
					? [...prev.skills, value]
					: prev.skills.filter((s) => s !== value),
			}));
		} else {
			setFilters((prev) => ({ ...prev, [name]: value }));
		}
	};

	const clearFilters = () => {
		setFilters({
			workMode: '',
			location: '',
			company: '',
			experienceLevel: '',
			skills: [],
		});
		setSearch('');
	};

	const filteredJobs = jobs.filter((job) => {
		const loc = (job.location || '').toLowerCase();
		const comp = (job.company || '').toLowerCase();
		const jobSkills = (job.skills || []).map((s) => s.toLowerCase());
		const exp = (job.experienceLevel || '').toLowerCase();

		const matchesLocation = filters.location
			? loc.includes(filters.location.toLowerCase())
			: true;

		const matchesCompany = filters.company
			? comp.includes(filters.company.toLowerCase())
			: true;

		const matchesExp = filters.experienceLevel
			? exp === filters.experienceLevel.toLowerCase()
			: true;

		const matchesSkills =
			filters.skills.length > 0
				? filters.skills.every((skill) => jobSkills.includes(skill.toLowerCase()))
				: true;

		let matchesWorkMode = true;
		if (filters.workMode === 'remote') {
			matchesWorkMode = loc.includes('remote');
		} else if (filters.workMode === 'onsite') {
			matchesWorkMode = loc.includes('onsite');
		} else if (filters.workMode === 'hybrid') {
			matchesWorkMode = loc.includes('hybrid');
		}

		return matchesLocation && matchesCompany && matchesSkills && matchesWorkMode && matchesExp;
	});

	const hasActiveFilters =
		filters.workMode ||
		filters.location ||
		filters.company ||
		filters.experienceLevel ||
		filters.skills.length > 0 ||
		search.trim();

	return (
		<div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto space-y-6">

				{/* Breadcrumb & Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<nav className="text-xs text-slate-400 mb-1 flex items-center gap-2">
							<Link to="/" className="hover:text-blue-600">Trang chủ</Link>
							<span>/</span>
							<span className="text-slate-700 font-semibold">Việc Làm IT</span>
						</nav>
						<h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
							<span>Tuyển Dụng Việc Làm IT Toàn Quốc</span>
							<span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
								{filteredJobs.length} vị trí
							</span>
						</h1>
					</div>

					{/* Fast Search input */}
					<div className="flex items-center gap-2 w-full md:w-80">
						<div className="relative w-full">
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Lọc nhanh theo từ khóa..."
								className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm"
							/>
							<svg className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>
						<button
							onClick={() => setShowMobileFilters(!showMobileFilters)}
							className="md:hidden p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 shrink-0"
						>
							⚙️
						</button>
					</div>
				</div>

				{/* Main 2-Column Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

					{/* LEFT COLUMN: FILTERS SIDEBAR (TopCV/ITviec style) */}
					<div className={`lg:block ${showMobileFilters ? 'block' : 'hidden'} lg:col-span-1`}>
						<div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-6 sticky top-20">
							
							{/* Filter Header */}
							<div className="flex items-center justify-between border-b border-slate-100 pb-3">
								<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
									<span>🔍</span>
									<span>Bộ Lọc Nâng Cao</span>
								</h2>
								{hasActiveFilters && (
									<button
										onClick={clearFilters}
										className="text-xs text-red-600 hover:text-red-700 font-semibold hover:underline"
									>
										Xóa lọc
									</button>
								)}
							</div>

							{/* Work Mode */}
							<div>
								<h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
									Hình Thức Làm Việc
								</h3>
								<div className="space-y-1.5">
									{[
										{ key: '', label: 'Tất cả hình thức' },
										{ key: 'hybrid', label: 'Hybrid (Linh hoạt)' },
										{ key: 'remote', label: 'Remote (Làm từ xa)' },
										{ key: 'onsite', label: 'Onsite (Tại văn phòng)' },
									].map((item) => (
										<label
											key={item.key}
											className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition ${
												filters.workMode === item.key
													? 'bg-blue-50 text-blue-700 font-bold'
													: 'text-slate-600 hover:bg-slate-50'
											}`}
										>
											<div className="flex items-center gap-2">
												<input
													type="radio"
													name="workMode"
													value={item.key}
													checked={filters.workMode === item.key}
													onChange={handleFilterChange}
													className="accent-blue-600"
												/>
												<span>{item.label}</span>
											</div>
										</label>
									))}
								</div>
							</div>

							{/* Experience Level */}
							<div>
								<h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
									Cấp Bậc & Kinh Nghiệm
								</h3>
								<div className="space-y-1.5">
									{[
										{ key: '', label: 'Tất cả cấp bậc' },
										{ key: 'entry', label: 'Fresher / Entry' },
										{ key: 'mid', label: 'Mid-level' },
										{ key: 'senior', label: 'Senior Developer' },
									].map((item) => (
										<label
											key={item.key}
											className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition ${
												filters.experienceLevel === item.key
													? 'bg-blue-50 text-blue-700 font-bold'
													: 'text-slate-600 hover:bg-slate-50'
											}`}
										>
											<div className="flex items-center gap-2">
												<input
													type="radio"
													name="experienceLevel"
													value={item.key}
													checked={filters.experienceLevel === item.key}
													onChange={handleFilterChange}
													className="accent-blue-600"
												/>
												<span>{item.label}</span>
											</div>
										</label>
									))}
								</div>
							</div>

							{/* Location */}
							<div>
								<h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
									Địa Điểm
								</h3>
								<select
									name="location"
									value={filters.location}
									onChange={handleFilterChange}
									className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
								>
									<option value="">Tất cả địa điểm</option>
									<option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
									<option value="Hà Nội">Hà Nội</option>
									<option value="Đà Nẵng">Đà Nẵng</option>
									<option value="Remote">Làm việc từ xa</option>
								</select>
							</div>

							{/* Skills Multi-Select */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
										Kỹ Năng ({filters.skills.length})
									</h3>
									{filters.skills.length > 0 && (
										<button
											onClick={() => setFilters({ ...filters, skills: [] })}
											className="text-[11px] text-blue-600 hover:underline"
										>
											Bỏ chọn
										</button>
									)}
								</div>

								<div className="space-y-1 max-h-48 overflow-y-auto pr-1">
									{(showAllSkills ? SDE_SKILLS : SDE_SKILLS.slice(0, 7)).map((skill) => (
										<label
											key={skill}
											className="flex items-center gap-2 p-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
										>
											<input
												type="checkbox"
												name="skills"
												value={skill}
												checked={filters.skills.includes(skill)}
												onChange={handleFilterChange}
												className="accent-blue-600 rounded"
											/>
											<span className={filters.skills.includes(skill) ? 'font-bold text-blue-700' : ''}>
												{skill}
											</span>
										</label>
									))}
								</div>

								<button
									onClick={() => setShowAllSkills(!showAllSkills)}
									className="mt-2 text-xs text-blue-600 font-semibold hover:underline block"
								>
									{showAllSkills ? 'Thu gọn ▲' : `Xem thêm (+${SDE_SKILLS.length - 7}) ▼`}
								</button>
							</div>

						</div>
					</div>

					{/* RIGHT COLUMN: JOB LISTINGS FEED (TopCV/ITviec style) */}
					<div className="lg:col-span-3 space-y-4">

						{/* Results bar */}
						<div className="flex items-center justify-between text-xs text-slate-500 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
							<span>
								Hiển thị <strong className="text-slate-900">{filteredJobs.length}</strong> việc làm phù hợp
							</span>
							<span className="text-[11px] text-slate-400">
								Sắp xếp theo: <strong>Mới nhất</strong>
							</span>
						</div>

						{/* Job Cards */}
						{loading ? (
							<div className="bg-white rounded-2xl p-12 text-center border border-slate-200 flex flex-col items-center justify-center">
								<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
								<p className="text-xs text-slate-500 font-semibold">Đang tải danh sách việc làm...</p>
							</div>
						) : filteredJobs.length === 0 ? (
							<div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
								<div className="text-5xl mb-3">🔍</div>
								<h3 className="text-lg font-bold text-slate-800 mb-1">
									Không tìm thấy việc làm phù hợp
								</h3>
								<p className="text-slate-500 text-sm max-w-md mx-auto mb-5">
									Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để xem toàn bộ cơ hội việc làm IT.
								</p>
								<button
									onClick={clearFilters}
									className="btn-primary text-xs px-5 py-2.5"
								>
									Xóa bộ lọc và thử lại
								</button>
							</div>
						) : (
							filteredJobs.map((job) => (
								<Link
									to={`/jobs/${job._id}`}
									key={job._id}
									className="block bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 hover:border-blue-300 shadow-sm hover:shadow-hover transition-all duration-200 group relative"
								>
									<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
										
										{/* Left: Logo & Job Details */}
										<div className="flex items-start gap-4 flex-1">
											{/* Company Initials Avatar */}
											<div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${job.companyLogoBg || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0 mt-0.5`}>
												{job.companyInitials || job.company?.substring(0, 3).toUpperCase()}
											</div>

											<div className="space-y-1.5 flex-1">
												<div className="flex items-center gap-2 flex-wrap">
													<span className="text-xs font-semibold text-slate-500">
														{job.company}
													</span>
													{job.companyVerified && (
														<span className="text-blue-500 text-xs font-bold" title="Nhà tuyển dụng xác thực">
															✓ Verified
														</span>
													)}
													{job.isHot && (
														<span className="badge-hot">
															<span>🔥</span> HOT
														</span>
													)}
												</div>

												<h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
													{job.title}
												</h3>

												{/* Salary & Location pills */}
												<div className="flex items-center gap-3 flex-wrap text-xs pt-0.5">
													<span className="badge-salary">
														<span>💵</span>
														<span>{job.salaryFormatted || `$${job.salary?.toLocaleString()} / năm`}</span>
													</span>

													<span className="text-slate-500 flex items-center gap-1">
														<span>📍</span>
														<span>{job.city || job.location}</span>
													</span>

													<span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-medium text-[11px]">
														{job.workMode || job.jobType}
													</span>
												</div>
											</div>
										</div>

										{/* Right: Apply Action */}
										<div className="sm:text-right shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex sm:flex-col items-center sm:items-end justify-between gap-2">
											<span className="text-xs text-slate-400">
												{job.postedTime || 'Gần đây'}
											</span>
											<span className="text-xs font-bold text-blue-600 group-hover:text-blue-700 bg-blue-50 group-hover:bg-blue-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1">
												<span>Ứng tuyển ngay</span>
												<span>→</span>
											</span>
										</div>

									</div>

									{/* Tech Stack Chips */}
									{job.skills && job.skills.length > 0 && (
										<div className="mt-4 pt-3 border-t border-slate-100/80 flex flex-wrap gap-1.5">
											{job.skills.map((skill, idx) => (
												<span
													key={idx}
													className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md"
												>
													{skill}
												</span>
											))}
										</div>
									)}
								</Link>
							))
						)}
					</div>

				</div>

			</div>
		</div>
	);
};

export default JobList;
