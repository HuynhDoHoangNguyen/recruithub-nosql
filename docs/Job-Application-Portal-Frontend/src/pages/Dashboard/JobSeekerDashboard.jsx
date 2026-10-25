import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const statusConfig = {
	pending: { 
		color: "bg-amber-50 text-amber-800 border-amber-200", 
		icon: "⏳",
		label: "Đang xét duyệt"
	},
	accepted: { 
		color: "bg-emerald-50 text-emerald-800 border-emerald-200", 
		icon: "✅",
		label: "Được chấp nhận"
	},
	rejected: { 
		color: "bg-red-50 text-red-800 border-red-200", 
		icon: "❌",
		label: "Chưa phù hợp"
	},
};

const ApplicationCard = ({ application, onWithdraw }) => {
	const { job } = application;
	const status = statusConfig[application.status] || statusConfig.pending;

	if (!job) {
		return (
			<div className="bg-white rounded-2xl p-6 border border-red-200 shadow-sm flex items-center justify-between">
				<div>
					<h3 className="text-sm font-bold text-red-700 mb-1">
						Tin tuyển dụng không còn tồn tại
					</h3>
					<p className="text-xs text-slate-500">
						Công việc này đã bị gỡ hoặc đóng tuyển dụng.
					</p>
				</div>
				<button
					onClick={() => onWithdraw(application._id)}
					className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-xl transition"
				>
					Xóa đơn này
				</button>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-hover hover:border-blue-300 transition-all duration-200 group">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
				{/* Company & Title */}
				<div className="flex items-start gap-4">
					<div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${job.companyLogoBg || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0`}>
						{job.companyInitials || job.company?.substring(0, 3).toUpperCase()}
					</div>
					<div>
						<p className="text-xs font-semibold text-slate-500 mb-0.5">
							{job.company}
						</p>
						<Link to={`/jobs/${job._id}`} className="group-hover:text-blue-600 transition-colors">
							<h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
								{job.title}
							</h3>
						</Link>
						<div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
							<span>📍 {job.city || job.location}</span>
							<span>•</span>
							<span className="font-semibold text-emerald-700">
								{job.salaryFormatted || `$${job.salary?.toLocaleString()}`}
							</span>
						</div>
					</div>
				</div>

				{/* Status Badge */}
				<div className="shrink-0">
					<span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ${status.color}`}>
						<span>{status.icon}</span>
						<span>{status.label}</span>
					</span>
				</div>
			</div>

			{/* Tags */}
			{job.tags && job.tags.length > 0 && (
				<div className="flex flex-wrap gap-1.5 mb-4">
					{job.tags.slice(0, 4).map((tag, index) => (
						<span
							key={index}
							className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md"
						>
							{tag}
						</span>
					))}
				</div>
			)}

			{/* Footer: Date & Actions */}
			<div className="flex items-center justify-between pt-3.5 border-t border-slate-100 text-xs">
				<span className="text-slate-400">
					Đã nộp vào ngày: <strong className="text-slate-600">{new Date(application.createdAt).toLocaleDateString()}</strong>
				</span>
				<div className="flex items-center gap-3">
					<Link
						to={`/jobs/${job._id}`}
						className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
					>
						Xem chi tiết →
					</Link>
					<span className="text-slate-300">|</span>
					<button
						onClick={() => onWithdraw(application._id)}
						className="font-semibold text-red-500 hover:text-red-700 transition"
					>
						Rút đơn
					</button>
				</div>
			</div>
		</div>
	);
};

const JobSeekerDashboard = () => {
	const [user, setUser] = useState(null);
	const [applications, setApplications] = useState([]);
	const [filteredApplications, setFilteredApplications] = useState([]);
	const [statusFilter, setStatusFilter] = useState("all");
	const [loading, setLoading] = useState(true);

	const fetchAll = async () => {
		setLoading(true);
		try {
			const userRes = await api.get("/users/me");
			const appsRes = await api.get("/apply/my");
			setUser(userRes.data);
			setApplications(appsRes.data || []);
			setFilteredApplications(appsRes.data || []);
		} catch (err) {
			console.error("Error loading dashboard data", err);
		} finally {
			setLoading(false);
		}
	};

	const handleWithdraw = async (id) => {
		if (!window.confirm("Bạn có chắc chắn muốn rút đơn ứng tuyển này?")) return;
		try {
			await api.delete(`/apply/${id}`);
			const updated = applications.filter((app) => app._id !== id);
			setApplications(updated);
			filterApplications(statusFilter, updated);
		} catch (err) {
			console.error("Withdraw failed", err);
			alert("Rút đơn không thành công.");
		}
	};

	const filterApplications = (status, list = applications) => {
		if (status === "all") {
			setFilteredApplications(list);
		} else {
			setFilteredApplications(list.filter((app) => app.status === status));
		}
	};

	const handleFilterChange = (status) => {
		setStatusFilter(status);
		filterApplications(status, applications);
	};

	useEffect(() => {
		fetchAll();
	}, []);

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
				<div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	if (!user) return null;

	const getStats = () => {
		const total = applications.length;
		const pending = applications.filter((app) => app.status === "pending").length;
		const accepted = applications.filter((app) => app.status === "accepted").length;
		const rejected = applications.filter((app) => app.status === "rejected").length;
		return { total, pending, accepted, rejected };
	};

	const stats = getStats();

	return (
		<div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto space-y-6">
				
				{/* Top Profile Banner (TopCV style) */}
				<div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
					<div className="flex items-center gap-4 sm:gap-5">
						<div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-md shrink-0">
							{user.name?.charAt(0).toUpperCase()}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
									{user.name}
								</h1>
								<span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
									Đang tìm việc
								</span>
							</div>
							<p className="text-xs sm:text-sm text-slate-500 mt-0.5">{user.email}</p>
							<p className="text-xs text-blue-600 font-medium mt-1">
								📍 {user.location || 'Việt Nam'} • 📄 {user.skills?.slice(0, 3).join(', ') || 'Lập trình viên IT'}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3 shrink-0">
						<Link
							to="/profile"
							className="btn-secondary text-xs px-4 py-2.5"
						>
							Cập nhật CV / Profile
						</Link>
						<Link
							to="/jobs"
							className="btn-primary text-xs px-4 py-2.5"
						>
							Tìm việc mới →
						</Link>
					</div>
				</div>

				{/* 4 Stats Cards */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold">
							📄
						</div>
						<div>
							<p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
							<p className="text-xs text-slate-500 font-medium">Tổng đơn ứng tuyển</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold">
							⏳
						</div>
						<div>
							<p className="text-2xl font-extrabold text-amber-600">{stats.pending}</p>
							<p className="text-xs text-slate-500 font-medium">Đang xét duyệt</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
							✅
						</div>
						<div>
							<p className="text-2xl font-extrabold text-emerald-600">{stats.accepted}</p>
							<p className="text-xs text-slate-500 font-medium">Được chấp nhận</p>
						</div>
					</div>

					<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
						<div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-2xl font-bold">
							❌
						</div>
						<div>
							<p className="text-2xl font-extrabold text-red-600">{stats.rejected}</p>
							<p className="text-xs text-slate-500 font-medium">Chưa phù hợp</p>
						</div>
					</div>
				</div>

				{/* 2-Column: Filter Tabs & Application Cards */}
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
					{/* Left status filter */}
					<div className="lg:col-span-1 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-1.5 sticky top-20">
						<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 py-2">
							Trạng Thái Ứng Tuyển
						</h3>
						{[
							{ key: "all", label: "Tất cả đơn nộp", count: stats.total, icon: "📋" },
							{ key: "pending", label: "Đang xét duyệt", count: stats.pending, icon: "⏳" },
							{ key: "accepted", label: "Được chấp nhận", count: stats.accepted, icon: "✅" },
							{ key: "rejected", label: "Chưa phù hợp", count: stats.rejected, icon: "❌" }
						].map(({ key, label, count, icon }) => (
							<button
								key={key}
								onClick={() => handleFilterChange(key)}
								className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
									statusFilter === key
										? "bg-blue-600 text-white shadow-sm"
										: "text-slate-700 hover:bg-slate-100"
								}`}
							>
								<div className="flex items-center gap-2">
									<span>{icon}</span>
									<span>{label}</span>
								</div>
								<span className={`px-2 py-0.5 rounded-full text-[10px] ${
									statusFilter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
								}`}>
									{count}
								</span>
							</button>
						))}
					</div>

					{/* Right Applications Feed */}
					<div className="lg:col-span-3 space-y-4">
						<div className="flex items-center justify-between text-xs text-slate-500 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
							<span>Danh sách đơn ứng tuyển (<strong>{filteredApplications.length}</strong>)</span>
							<span className="text-[11px] text-slate-400">Tự động cập nhật thời gian thực</span>
						</div>

						{filteredApplications.length === 0 ? (
							<div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
								<div className="text-5xl mb-3">📬</div>
								<h3 className="text-base font-bold text-slate-800 mb-1">
									Không có đơn ứng tuyển nào ở mục này
								</h3>
								<p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto">
									Khám phá ngay các cơ hội việc làm IT hấp dẫn và ứng tuyển ngay hôm nay.
								</p>
								<Link to="/jobs" className="btn-primary text-xs px-5 py-2.5">
									Khám phá việc làm IT
								</Link>
							</div>
						) : (
							<div className="space-y-4">
								{filteredApplications.map((app) => (
									<ApplicationCard key={app._id} application={app} onWithdraw={handleWithdraw} />
								))}
							</div>
						)}
					</div>
				</div>

			</div>
		</div>
	);
};

export default JobSeekerDashboard;
