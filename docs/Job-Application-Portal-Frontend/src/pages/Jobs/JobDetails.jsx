import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const JobDetails = () => {
	const { id } = useParams();
	const [job, setJob] = useState(null);
	const [relatedJobs, setRelatedJobs] = useState([]);
	const [applied, setApplied] = useState(false);
	const [status, setStatus] = useState(null);
	const [applicationId, setApplicationId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [applySuccess, setApplySuccess] = useState(false);
	const { user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		const fetchData = async () => {
			try {
				const jobRes = await api.get(`/jobs/${id}`);
				setJob(jobRes.data);

				// Fetch related jobs
				try {
					const allRes = await api.get('/jobs/recent?limit=4');
					const list = allRes.data?.jobs || [];
					setRelatedJobs(list.filter((j) => j._id !== id).slice(0, 3));
				} catch {
					// safe fallback
				}

				if (user?.role === 'job-seeker') {
					const appRes = await api.get(`/apply/${id}/status`);
					setApplied(appRes.data.applied);
					setStatus(appRes.data.status);
					setApplicationId(appRes.data.applicationId);
				}
			} catch (err) {
				console.error('Error fetching job or application:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [id, user]);

	const handleApply = async () => {
		if (!user) {
			navigate('/login');
			return;
		}
		setIsProcessing(true);
		setApplySuccess(false);
		try {
			const res = await api.post(`/apply/${id}`, {
				resumeUrl: user.resumeUrl || 'https://example.com/my-resume.pdf',
			});
			setApplied(true);
			setStatus(res.data?.application?.status || 'pending');
			setApplicationId(res.data?.application?._id);
			setApplySuccess(true);
			setTimeout(() => setApplySuccess(false), 4000);
		} catch (err) {
			console.error('Application failed', err);
			alert('Không thể nộp đơn lúc này. Vui lòng thử lại!');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleWithdraw = async () => {
		if (!applicationId) return;
		if (!window.confirm('Bạn có chắc chắn muốn rút hồ sơ ứng tuyển này không?')) return;
		setIsProcessing(true);
		try {
			await api.delete(`/apply/${applicationId}`);
			setApplied(false);
			setStatus(null);
			setApplicationId(null);
		} catch (err) {
			console.error('Failed to withdraw application', err);
			alert('Không thể rút hồ sơ lúc này.');
		} finally {
			setIsProcessing(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
				<div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	if (!job) {
		return (
			<div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
				<div className="text-5xl mb-3">⚠️</div>
				<h2 className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy công việc này</h2>
				<p className="text-slate-500 text-sm mb-5">Công việc này có thể đã hết hạn hoặc bị xóa.</p>
				<Link to="/jobs" className="btn-primary text-xs">
					Quay lại danh sách việc làm
				</Link>
			</div>
		);
	}

	const statusBadgeConfig = {
		accepted: { label: 'Được chấp nhận (Accepted)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✅' },
		rejected: { label: 'Không phù hợp (Not Selected)', color: 'bg-red-100 text-red-800 border-red-300', icon: '❌' },
		pending: { label: 'Đang xét duyệt (Under Review)', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: '⏳' },
	};

	// Helper to split description lines into readable visual points
	const descriptionParagraphs = job.description
		? job.description.split('\n').filter((line) => line.trim().length > 0)
		: [];

	return (
		<div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-6xl mx-auto space-y-6">

				{/* Breadcrumb */}
				<nav className="text-xs text-slate-400 flex items-center gap-2">
					<Link to="/" className="hover:text-blue-600">Trang chủ</Link>
					<span>/</span>
					<Link to="/jobs" className="hover:text-blue-600">Việc Làm IT</Link>
					<span>/</span>
					<span className="text-slate-700 font-semibold truncate max-w-xs">{job.title}</span>
				</nav>

				{/* TOP HEADER CARD (TopCV / ITviec signature style) */}
				<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
					{/* Accent gradient bar on top */}
					<div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"></div>

					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-1">
						{/* Left info */}
						<div className="flex items-start gap-5">
							{/* Company Logo Avatar */}
							<div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br ${job.companyLogoBg || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-extrabold text-xl shadow-md shrink-0`}>
								{job.companyInitials || job.company?.substring(0, 3).toUpperCase()}
							</div>

							<div className="space-y-2">
								<div className="flex items-center gap-2 flex-wrap">
									<h2 className="text-sm font-bold text-slate-600">
										{job.company}
									</h2>
									<span className="text-blue-500 text-xs font-bold flex items-center gap-1" title="Doanh nghiệp xác thực">
										<span>✓</span> Đã xác thực
									</span>
									{job.isHot && (
										<span className="badge-hot">
											<span>🔥</span> HOT
										</span>
									)}
								</div>

								<h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
									{job.title}
								</h1>

								{/* Highlights */}
								<div className="flex flex-wrap items-center gap-3 pt-1">
									<span className="badge-salary text-sm px-3.5 py-1">
										<span>💵</span>
										<span>{job.salaryFormatted || `$${job.salary?.toLocaleString()} / năm`}</span>
									</span>

									<span className="text-xs text-slate-600 flex items-center gap-1 font-medium bg-slate-100 px-3 py-1 rounded-full">
										<span>📍</span> {job.city || job.location}
									</span>

									<span className="text-xs text-blue-700 font-semibold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
										{job.workMode || job.jobType}
									</span>

									<span className="text-xs text-slate-500 font-medium">
										Hạn nộp: <strong className="text-slate-700">15 ngày nữa</strong>
									</span>
								</div>
							</div>
						</div>

						{/* Right Apply Button Action */}
						<div className="shrink-0 flex flex-col sm:items-end gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
							{applySuccess && (
								<span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
									🎉 Ứng tuyển thành công!
								</span>
							)}

							{user?.role === 'job-seeker' ? (
								!applied ? (
									<button
										onClick={handleApply}
										disabled={isProcessing}
										className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
									>
										<span>⚡</span>
										<span>{isProcessing ? 'Đang gửi hồ sơ...' : 'Ứng Tuyển Ngay'}</span>
									</button>
								) : (
									<div className="flex flex-col sm:items-end gap-2">
										<div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${statusBadgeConfig[status]?.color || 'bg-slate-100 text-slate-700'}`}>
											<span>{statusBadgeConfig[status]?.icon}</span>
											<span>{statusBadgeConfig[status]?.label || 'Đã nộp đơn'}</span>
										</div>
										<button
											onClick={handleWithdraw}
											disabled={isProcessing}
											className="text-xs text-red-600 hover:text-red-700 font-semibold hover:underline"
										>
											{isProcessing ? 'Đang xử lý...' : 'Rút đơn ứng tuyển'}
										</button>
									</div>
								)
							) : !user ? (
								<button
									onClick={() => navigate('/login')}
									className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md text-sm hover:from-blue-700 hover:to-indigo-700 transition"
								>
									Đăng Nhập Để Ứng Tuyển
								</button>
							) : (
								<span className="text-xs text-slate-400 italic">
									(Chế độ {user.role})
								</span>
							)}
						</div>
					</div>
				</div>

				{/* 4 QUICK METRICS CARDS (TopCV Signature UX) */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
							💰
						</div>
						<div>
							<p className="text-[11px] text-slate-400 font-medium">Mức thu nhập</p>
							<p className="text-xs sm:text-sm font-extrabold text-emerald-700">
								{job.salaryFormatted || `$${job.salary?.toLocaleString()}`}
							</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
							📍
						</div>
						<div>
							<p className="text-[11px] text-slate-400 font-medium">Địa điểm</p>
							<p className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[120px]">
								{job.city || job.location}
							</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
							💼
						</div>
						<div>
							<p className="text-[11px] text-slate-400 font-medium">Kinh nghiệm</p>
							<p className="text-xs sm:text-sm font-bold text-slate-800 capitalize">
								{job.experienceLevel || 'Senior'}
							</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
							⚡
						</div>
						<div>
							<p className="text-[11px] text-slate-400 font-medium">Hình thức</p>
							<p className="text-xs sm:text-sm font-bold text-slate-800 capitalize">
								{job.workMode || job.jobType}
							</p>
						</div>
					</div>
				</div>

				{/* 2-COLUMN MAIN CONTENT */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
					
					{/* LEFT COLUMN: JOB DESCRIPTION (68%) */}
					<div className="lg:col-span-2 space-y-6">

						{/* Detailed Description with Visual Structure */}
						<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
							<div>
								<h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
									<span className="text-blue-600">📋</span>
									<span>Mô Tả Chi Tiết Công Việc</span>
								</h2>
								<div className="space-y-3">
									{descriptionParagraphs.map((para, idx) => (
										<div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
											<span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
											<span>{para}</span>
										</div>
									))}
								</div>
							</div>

							{/* Skills Required */}
							{job.tags && job.tags.length > 0 && (
								<div className="pt-6 border-t border-slate-100">
									<h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
										<span className="text-blue-600">🛠️</span>
										<span>Kỹ Năng & Stack Công Nghệ Yêu Cầu</span>
									</h2>
									<div className="flex flex-wrap gap-2">
										{job.tags.map((tag, idx) => (
											<span
												key={idx}
												className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"
											>
												{tag}
											</span>
										))}
										{job.skills && job.skills.map((skill, idx) => (
											<span
												key={'sk_' + idx}
												className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700"
											>
												{skill}
											</span>
										))}
									</div>
								</div>
							)}

							{/* Perks & Benefits (TopCV/ITviec signature) */}
							<div className="pt-6 border-t border-slate-100">
								<h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
									<span className="text-emerald-600">🎁</span>
									<span>Phúc Lợi & Đãi Ngộ Hấp Dẫn</span>
								</h2>
								<div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-700 font-medium">
									<div className="p-3.5 bg-slate-50 rounded-2xl flex items-center gap-2.5 border border-slate-100">
										<span className="text-emerald-600 font-bold text-sm">✓</span>
										<span>Lương tháng 13 + Thưởng hiệu suất KPIs</span>
									</div>
									<div className="p-3.5 bg-slate-50 rounded-2xl flex items-center gap-2.5 border border-slate-100">
										<span className="text-emerald-600 font-bold text-sm">✓</span>
										<span>MacBook Pro M3 Max + Màn hình 4K</span>
									</div>
									<div className="p-3.5 bg-slate-50 rounded-2xl flex items-center gap-2.5 border border-slate-100">
										<span className="text-emerald-600 font-bold text-sm">✓</span>
										<span>Bảo hiểm sức khỏe quốc tế cao cấp</span>
									</div>
									<div className="p-3.5 bg-slate-50 rounded-2xl flex items-center gap-2.5 border border-slate-100">
										<span className="text-emerald-600 font-bold text-sm">✓</span>
										<span>Làm việc linh hoạt Hybrid (2 ngày WFH)</span>
									</div>
								</div>
							</div>
						</div>

					</div>

					{/* RIGHT COLUMN: STICKY SIDEBAR (32%) */}
					<div className="space-y-5 sticky top-20">
						
						{/* Company Overview Card */}
						<div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
							<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
								Thông Tin Doanh Nghiệp
							</h3>

							<div className="flex items-center gap-3">
								<div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${job.companyLogoBg || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0`}>
									{job.companyInitials || job.company?.substring(0, 3).toUpperCase()}
								</div>
								<div>
									<h4 className="text-sm font-bold text-slate-900">{job.company}</h4>
									<p className="text-xs text-slate-500">Tập đoàn công nghệ</p>
								</div>
							</div>

							<div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
								<div className="flex justify-between">
									<span className="text-slate-400">Quy mô:</span>
									<span className="font-semibold text-slate-800">1,000+ nhân viên</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Địa điểm:</span>
									<span className="font-semibold text-slate-800">{job.location}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Quốc gia:</span>
									<span className="font-semibold text-slate-800">Việt Nam</span>
								</div>
							</div>
						</div>

						{/* Security / Verification Guarantee Card */}
						<div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-5 border border-blue-200/80 text-xs space-y-2">
							<div className="flex items-center gap-2 font-bold text-blue-900">
								<span>🛡️</span>
								<span>Bảo Chứng Từ JobPortal IT</span>
							</div>
							<p className="text-slate-600 leading-relaxed text-[11px]">
								Tin tuyển dụng đã được xác minh thông tin doanh nghiệp. Hồ sơ của bạn được gửi trực tiếp đến phòng nhân sự, bảo mật tuyệt đối.
							</p>
						</div>

						{/* Similar Jobs Quick Feed */}
						{relatedJobs.length > 0 && (
							<div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
								<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
									Việc Làm Tương Tự
								</h3>
								<div className="space-y-3">
									{relatedJobs.map((rJob) => (
										<Link
											key={rJob._id}
											to={`/jobs/${rJob._id}`}
											className="block p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group"
										>
											<h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 line-clamp-1">
												{rJob.title}
											</h4>
											<div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
												<span className="truncate max-w-[120px]">{rJob.company}</span>
												<span className="font-bold text-emerald-700">{rJob.salaryFormatted}</span>
											</div>
										</Link>
									))}
								</div>
							</div>
						)}

					</div>

				</div>

			</div>
		</div>
	);
};

export default JobDetails;
