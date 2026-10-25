import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const JobCard = ({
	job,
	onDelete,
	onStatusChange,
	onUpdate,
	expandedJobId,
	setExpandedJobId
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editedJob, setEditedJob] = useState({ ...job });
	const [applicants, setApplicants] = useState([]);
	const [loadingApplicants, setLoadingApplicants] = useState(false);

	const isExpanded = expandedJobId === job._id;

	const toggleExpand = async () => {
		if (isExpanded) {
			setExpandedJobId(null);
		} else {
			setExpandedJobId(job._id);
			if (applicants.length === 0) {
				setLoadingApplicants(true);
				try {
					const res = await api.get(`/apply/${job._id}/applications`);
					setApplicants(res.data || []);
				} catch (err) {
					console.error("Error fetching applicants:", err);
				} finally {
					setLoadingApplicants(false);
				}
			}
		}
	};

	const handleChange = (e) => {
		const { name, value } = e.target;
		setEditedJob(prev => ({ ...prev, [name]: value }));
	};

	const handleSave = async () => {
		await onUpdate(editedJob._id, editedJob);
		setIsEditing(false);
	};

	const handleStatusUpdate = async (applicationId, newStatus) => {
		try {
			await api.put(`/apply/${applicationId}/status`, { status: newStatus });
			setApplicants(prev =>
				prev.map(app => app._id === applicationId ? { ...app, status: newStatus } : app)
			);
		} catch (err) {
			console.error(err);
			alert("Cập nhật trạng thái ứng viên thất bại");
		}
	};

	return (
		<div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 sm:p-6 space-y-4">
			{isEditing ? (
				<div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
					<input
						className="input-field"
						name="title"
						placeholder="Tiêu đề việc làm"
						value={editedJob.title}
						onChange={handleChange}
					/>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<input
							className="input-field"
							name="location"
							placeholder="Địa điểm làm việc"
							value={editedJob.location}
							onChange={handleChange}
						/>
						<select
							name="jobType"
							value={editedJob.jobType}
							onChange={handleChange}
							className="input-field"
						>
							<option value="full-time">Full-time</option>
							<option value="part-time">Part-time</option>
							<option value="internship">Internship</option>
							<option value="contract">Contract</option>
						</select>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<button
							onClick={() => {
								setIsEditing(false);
								setEditedJob(job);
							}}
							className="btn-secondary text-xs px-3 py-1.5"
						>
							Hủy bỏ
						</button>
						<button
							onClick={handleSave}
							className="btn-primary text-xs px-4 py-1.5"
						>
							Lưu thay đổi
						</button>
					</div>
				</div>
			) : (
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-start gap-4">
						<div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${job.companyLogoBg || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0`}>
							{job.companyInitials || job.company?.substring(0, 3).toUpperCase()}
						</div>
						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<h3 className="text-base sm:text-lg font-bold text-slate-900">
									{job.title}
								</h3>
								<span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
									job.status === 'open'
										? 'bg-emerald-50 text-emerald-700 border-emerald-200'
										: 'bg-slate-100 text-slate-600 border-slate-200'
								}`}>
									{job.status === 'open' ? '● Đang mở' : '○ Đã đóng'}
								</span>
							</div>

							<div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
								<span>📍 {job.location}</span>
								<span>•</span>
								<span className="capitalize">{job.jobType}</span>
								<span>•</span>
								<span className="font-semibold text-emerald-700">
									{job.salaryFormatted || `$${job.salary?.toLocaleString()}`}
								</span>
							</div>
						</div>
					</div>

					{/* Actions Bar */}
					<div className="flex items-center gap-2 flex-wrap shrink-0">
						<button
							onClick={toggleExpand}
							className={`text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
								isExpanded
									? 'bg-blue-600 text-white'
									: 'bg-blue-50 text-blue-700 hover:bg-blue-100'
							}`}
						>
							<span>👥</span>
							<span>{isExpanded ? 'Ẩn hồ sơ' : `Xem ứng viên (${job.applications?.length || 0})`}</span>
						</button>

						<button
							onClick={() => onStatusChange(job._id, job.status === 'open' ? 'closed' : 'open')}
							className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
							title="Đổi trạng thái tin"
						>
							{job.status === 'open' ? 'Đóng tin' : 'Mở lại'}
						</button>

						<button
							onClick={() => setIsEditing(true)}
							className="text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
						>
							✏️ Sửa
						</button>

						<button
							onClick={() => onDelete(job._id)}
							className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition"
							title="Xóa tin này"
						>
							🗑️ Xóa
						</button>
					</div>
				</div>
			)}

			{/* Expanded Applicant List (TopCV style) */}
			{isExpanded && (
				<div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-fade-in">
					<div className="flex items-center justify-between">
						<h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
							Danh sách ứng viên đã nộp hồ sơ
						</h4>
						<span className="text-xs text-slate-400">
							{applicants.length} ứng viên
						</span>
					</div>

					{loadingApplicants ? (
						<div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
							<span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
							<span>Đang tải danh sách ứng viên...</span>
						</div>
					) : applicants.length === 0 ? (
						<div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
							Chưa có ứng viên nào nộp đơn vào vị trí này.
						</div>
					) : (
						<div className="space-y-2.5">
							{applicants.map((app) => (
								<div
									key={app._id}
									className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
								>
									<div className="flex items-center gap-3">
										<div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
											{app.applicant?.name?.charAt(0).toUpperCase()}
										</div>
										<div>
											<div className="flex items-center gap-2">
												<p className="text-sm font-bold text-slate-900">{app.applicant?.name}</p>
												<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
													app.status === 'accepted'
														? 'bg-emerald-100 text-emerald-800 border-emerald-300'
														: app.status === 'rejected'
														? 'bg-red-100 text-red-800 border-red-300'
														: 'bg-amber-100 text-amber-800 border-amber-300'
												}`}>
													{app.status === 'accepted' ? 'Đã duyệt' : app.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
												</span>
											</div>
											<p className="text-xs text-slate-500">{app.applicant?.email}</p>
											<div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
												<span>Nộp ngày: {new Date(app.createdAt).toLocaleDateString()}</span>
												{app.resume && (
													<>
														<span>•</span>
														<a
															href={app.resume}
															target="_blank"
															rel="noreferrer"
															className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
														>
															<span>📄</span> Xem CV đính kèm
														</a>
													</>
												)}
											</div>
										</div>
									</div>

									{/* Status Decision Buttons */}
									<div className="flex items-center gap-2 shrink-0">
										{app.status !== 'accepted' && (
											<button
												onClick={() => handleStatusUpdate(app._id, 'accepted')}
												className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
											>
												✓ Chấp thuận
											</button>
										)}
										{app.status !== 'rejected' && (
											<button
												onClick={() => handleStatusUpdate(app._id, 'rejected')}
												className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200 transition"
											>
												✕ Từ chối
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

const RecruiterDashboard = () => {
	const [jobs, setJobs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [recruiter, setRecruiter] = useState(null);
	const [expandedJobId, setExpandedJobId] = useState(null);

	useEffect(() => {
		const fetchJobs = async () => {
			try {
				const [jobsRes, profileRes] = await Promise.all([
					api.get("/jobs/myjobs"),
					api.get("/users/me")
				]);
				setJobs(jobsRes.data || []);
				setRecruiter(profileRes.data || null);
			} catch (err) {
				console.error("Error loading dashboard:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchJobs();
	}, []);

	const handleDelete = async (id) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa tin tuyển dụng này không?")) return;
		try {
			await api.delete(`/jobs/${id}`);
			setJobs(jobs.filter(job => job._id !== id));
		} catch (err) {
			console.error(err);
			alert("Xóa tin tuyển dụng thất bại");
		}
	};

	const handleStatusChange = async (id, newStatus) => {
		try {
			await api.put(`/jobs/${id}/status`, { status: newStatus });
			setJobs(prev => prev.map(job =>
				job._id === id ? { ...job, status: newStatus } : job
			));
		} catch (err) {
			console.error(err);
			alert("Cập nhật trạng thái thất bại");
		}
	};

	const handleUpdate = async (id, updatedData) => {
		try {
			await api.put(`/jobs/${id}`, updatedData);
			setJobs(prev => prev.map(job => job._id === id ? { ...job, ...updatedData } : job));
		} catch (err) {
			console.error(err);
			alert("Cập nhật thông tin thất bại");
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
				<div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	const openJobs = jobs.filter(j => j.status === 'open').length;

	return (
		<div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto space-y-6">

				{/* Top Recruiter Header */}
				<div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
					<div className="flex items-center gap-4 sm:gap-5">
						<div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-extrabold shadow-md shrink-0">
							{recruiter?.name?.charAt(0).toUpperCase() || 'R'}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
									{recruiter?.name || 'Nhà Tuyển Dụng'}
								</h1>
								<span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-purple-300">
									Doanh nghiệp
								</span>
							</div>
							<p className="text-xs sm:text-sm text-slate-500 mt-0.5">
								🏢 {recruiter?.company || 'VNG Tech Hub'} • {recruiter?.position || 'Talent Acquisition'}
							</p>
							<p className="text-xs text-blue-600 font-medium mt-1">
								✉️ {recruiter?.email}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3 shrink-0">
						<Link
							to="/recruiter/jobs/create"
							className="btn-primary text-xs px-5 py-2.5 flex items-center gap-2"
						>
							<span>➕</span>
							<span>Đăng Tin Tuyển Dụng Mới</span>
						</Link>
					</div>
				</div>

				{/* Metric Counters */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
							💼
						</div>
						<div>
							<p className="text-2xl font-extrabold text-slate-900">{jobs.length}</p>
							<p className="text-xs text-slate-500 font-medium">Tổng việc làm đã đăng</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
							⚡
						</div>
						<div>
							<p className="text-2xl font-extrabold text-emerald-600">{openJobs}</p>
							<p className="text-xs text-slate-500 font-medium">Đang mở tuyển dụng</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl">
							👥
						</div>
						<div>
							<p className="text-2xl font-extrabold text-purple-600">
								{jobs.reduce((acc, j) => acc + (j.applications?.length || 0), 0)}
							</p>
							<p className="text-xs text-slate-500 font-medium">Tổng ứng viên ứng tuyển</p>
						</div>
					</div>
				</div>

				{/* Jobs List Header */}
				<div className="space-y-4">
					<div className="flex items-center justify-between text-xs text-slate-500 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
						<span>Danh sách tin tuyển dụng ({jobs.length})</span>
						<span className="text-[11px] text-slate-400">Bấm "Xem ứng viên" để duyệt hồ sơ ứng tuyển</span>
					</div>

					{jobs.length === 0 ? (
						<div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
							<div className="text-5xl mb-3">🏢</div>
							<h3 className="text-base font-bold text-slate-800 mb-1">
								Bạn chưa đăng tin tuyển dụng nào
							</h3>
							<p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto">
								Bắt đầu tìm kiếm nhân tài IT chất lượng cao bằng cách đăng tin ngay.
							</p>
							<Link to="/recruiter/jobs/create" className="btn-primary text-xs px-5 py-2.5">
								Đăng tin tuyển dụng ngay
							</Link>
						</div>
					) : (
						<div className="space-y-4">
							{jobs.map(job => (
								<JobCard
									key={job._id}
									job={job}
									onDelete={handleDelete}
									onStatusChange={handleStatusChange}
									onUpdate={handleUpdate}
									expandedJobId={expandedJobId}
									setExpandedJobId={setExpandedJobId}
								/>
							))}
						</div>
					)}
				</div>

			</div>
		</div>
	);
};

export default RecruiterDashboard;
