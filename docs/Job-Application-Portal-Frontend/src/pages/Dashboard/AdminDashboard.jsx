import React, { useEffect, useState } from "react";
import api from "../../services/api";
import {
	FaUsers,
	FaBriefcase,
	FaFileAlt,
} from "react-icons/fa";

const StatCard = ({ icon, label, count, color = "blue" }) => {
	const Icon = icon;
	const colorMap = {
		blue: "bg-blue-50 text-blue-600",
		emerald: "bg-emerald-50 text-emerald-600",
		purple: "bg-purple-50 text-purple-600",
	};

	return (
		<div className="flex items-center p-6 bg-white rounded-3xl shadow-sm border border-slate-200/90 space-x-4">
			<div className={`h-14 w-14 rounded-2xl ${colorMap[color] || colorMap.blue} flex items-center justify-center text-2xl font-bold shrink-0`}>
				<Icon />
			</div>
			<div>
				<p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
				<p className="text-3xl font-black text-slate-900 mt-0.5">{count}</p>
			</div>
		</div>
	);
};

const AdminDashboard = () => {
	const [users, setUsers] = useState([]);
	const [jobs, setJobs] = useState([]);
	const [stats, setStats] = useState({ totalUsers: 0, totalJobs: 0, totalApplications: 0 });
	const [selectedUserId, setSelectedUserId] = useState(null);
	const [selectedJobId, setSelectedJobId] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				const [statsRes, usersRes, jobsRes] = await Promise.all([
					api.get("/admin/stats"),
					api.get("/admin/users"),
					api.get("/admin/jobs"),
				]);
				setStats(statsRes.data.stats);
				setUsers(usersRes.data);
				setJobs(jobsRes.data);
			} catch (err) {
				console.error("❌ Failed to load dashboard:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboard();
	}, []);

	const handleDeleteUser = async (id) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản người dùng này không?")) return;
		try {
			await api.delete(`/admin/users/${id}`);
			setUsers((prev) => prev.filter((u) => u._id !== id));
			setStats((prev) => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
			setSelectedUserId(null);
		} catch {
			alert("❌ Xóa tài khoản thất bại.");
		}
	};

	const handleDeleteJob = async (id) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa tin tuyển dụng này không?")) return;
		try {
			await api.delete(`/admin/jobs/${id}`);
			const deletedJob = jobs.find((j) => j._id === id);
			const removedApplications = deletedJob?.applications?.length || 0;
			setJobs((prev) => prev.filter((j) => j._id !== id));
			setStats((prev) => ({
				...prev,
				totalJobs: prev.totalJobs - 1,
				totalApplications: prev.totalApplications - removedApplications,
			}));
			setSelectedJobId(null);
		} catch {
			alert("❌ Xóa tin việc làm thất bại.");
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
				<div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	const roleBadge = (role) => {
		switch (role) {
			case 'admin':
				return <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">Admin</span>;
			case 'recruiter':
				return <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-purple-300">Nhà tuyển dụng</span>;
			default:
				return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">Ứng viên</span>;
		}
	};

	return (
		<div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto space-y-8">
				<div>
					<span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
						Hệ Thống Quản Trị Trung Tâm
					</span>
					<h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
						Admin System Dashboard
					</h1>
					<p className="text-xs sm:text-sm text-slate-500 mt-0.5">
						Quản lý tài khoản người dùng, danh sách việc làm và giám sát dữ liệu toàn sàn JobPortal IT.
					</p>
				</div>

				{/* Stats Section */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
					<StatCard icon={FaUsers} label="Tổng Số Người Dùng" count={stats.totalUsers} color="blue" />
					<StatCard icon={FaBriefcase} label="Tổng Việc Làm Đã Đăng" count={stats.totalJobs} color="emerald" />
					<StatCard icon={FaFileAlt} label="Tổng Đơn Ứng Tuyển" count={stats.totalApplications} color="purple" />
				</div>

				{/* Users Table */}
				<div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 border border-slate-200/90 space-y-4">
					<div className="flex items-center justify-between pb-3 border-b border-slate-100">
						<div>
							<h2 className="text-base font-bold text-slate-900">
								Danh Sách Tài Khoản Người Dùng ({users.length})
							</h2>
							<p className="text-xs text-slate-400">Tất cả tài khoản Ứng viên, Doanh nghiệp và Quản trị viên</p>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full text-xs text-left">
							<thead>
								<tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
									<th className="p-3.5 font-bold">Họ và tên</th>
									<th className="p-3.5 font-bold">Email</th>
									<th className="p-3.5 font-bold">Vai trò</th>
									<th className="p-3.5 font-bold text-center">Thao tác</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{users.map((u) => (
									<React.Fragment key={u._id}>
										<tr className="hover:bg-slate-50 transition">
											<td className="p-3.5 font-bold text-slate-900 flex items-center gap-2.5">
												<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
													{u.name?.charAt(0).toUpperCase()}
												</div>
												<span>{u.name}</span>
											</td>
											<td className="p-3.5 text-slate-600">{u.email}</td>
											<td className="p-3.5">{roleBadge(u.role)}</td>
											<td className="p-3.5 text-center space-x-3">
												<button
													onClick={() => {
														setSelectedUserId((prev) => (prev === u._id ? null : u._id));
														setSelectedJobId(null);
													}}
													className="text-blue-600 font-bold hover:underline"
												>
													{selectedUserId === u._id ? 'Thu gọn ▲' : 'Chi tiết ▼'}
												</button>
												<button
													onClick={() => handleDeleteUser(u._id)}
													className="text-red-600 font-bold hover:underline"
												>
													Xóa
												</button>
											</td>
										</tr>
										{selectedUserId === u._id && (
											<tr>
												<td colSpan="4" className="p-5 bg-blue-50/70 border-b border-blue-100">
													<div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-sm space-y-3">
														<div className="flex items-center justify-between pb-2 border-b border-slate-100">
															<h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
																Chi Tiết Tài Khoản: {u.name}
															</h4>
															<button onClick={() => setSelectedUserId(null)} className="text-xs text-slate-400 hover:text-slate-700">Đóng ✕</button>
														</div>
														<div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-700">
															<p><strong>Email:</strong> {u.email}</p>
															<p><strong>Vai trò:</strong> {u.role}</p>
															<p><strong>Địa điểm:</strong> {u.location || 'N/A'}</p>
															<p><strong>Số điện thoại:</strong> {u.phone || 'N/A'}</p>
															{u.skills?.length > 0 && (
																<p className="sm:col-span-2">
																	<strong>Kỹ năng:</strong> {u.skills.join(", ")}
																</p>
															)}
															{u.bio && (
																<p className="sm:col-span-2">
																	<strong>Giới thiệu:</strong> {u.bio}
																</p>
															)}
														</div>
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* Jobs Table */}
				<div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 border border-slate-200/90 space-y-4">
					<div className="flex items-center justify-between pb-3 border-b border-slate-100">
						<div>
							<h2 className="text-base font-bold text-slate-900">
								Danh Sách Việc Làm Toàn Sàn ({jobs.length})
							</h2>
							<p className="text-xs text-slate-400">Giám sát và kiểm duyệt các tin tuyển dụng IT</p>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full text-xs text-left">
							<thead>
								<tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
									<th className="p-3.5 font-bold">Vị trí tuyển dụng</th>
									<th className="p-3.5 font-bold">Doanh nghiệp</th>
									<th className="p-3.5 font-bold">Địa điểm</th>
									<th className="p-3.5 font-bold">Mức lương</th>
									<th className="p-3.5 font-bold">Trạng thái</th>
									<th className="p-3.5 font-bold text-center">Thao tác</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{jobs.map((job) => (
									<React.Fragment key={job._id}>
										<tr className="hover:bg-slate-50 transition">
											<td className="p-3.5 font-bold text-slate-900">{job.title}</td>
											<td className="p-3.5 text-slate-600">{job.company}</td>
											<td className="p-3.5 text-slate-600">{job.city || job.location}</td>
											<td className="p-3.5 font-bold text-emerald-700">
												{job.salaryFormatted || `$${job.salary?.toLocaleString()}`}
											</td>
											<td className="p-3.5">
												<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
													job.status === 'open'
														? 'bg-emerald-50 text-emerald-700 border-emerald-200'
														: 'bg-slate-100 text-slate-600 border-slate-200'
												}`}>
													{job.status === 'open' ? 'Đang mở' : 'Đã đóng'}
												</span>
											</td>
											<td className="p-3.5 text-center space-x-3">
												<button
													onClick={() => {
														setSelectedJobId((prev) => (prev === job._id ? null : job._id));
														setSelectedUserId(null);
													}}
													className="text-blue-600 font-bold hover:underline"
												>
													{selectedJobId === job._id ? 'Thu gọn ▲' : 'Xem ▼'}
												</button>
												<button
													onClick={() => handleDeleteJob(job._id)}
													className="text-red-600 font-bold hover:underline"
												>
													Xóa
												</button>
											</td>
										</tr>
										{selectedJobId === job._id && (
											<tr>
												<td colSpan="6" className="p-5 bg-blue-50/70 border-b border-blue-100">
													<div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-sm space-y-3">
														<div className="flex items-center justify-between pb-2 border-b border-slate-100">
															<h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
																Chi Tiết Việc Làm: {job.title}
															</h4>
															<button onClick={() => setSelectedJobId(null)} className="text-xs text-slate-400 hover:text-slate-700">Đóng ✕</button>
														</div>
														<div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-700">
															<p><strong>Công ty:</strong> {job.company}</p>
															<p><strong>Địa điểm:</strong> {job.location}</p>
															<p><strong>Hình thức:</strong> {job.workMode || job.jobType}</p>
															<p><strong>Cấp bậc:</strong> {job.experienceLevel || 'Senior'}</p>
															<p className="sm:col-span-2"><strong>Mô tả:</strong> {job.description}</p>
															{job.tags?.length > 0 && (
																<p className="sm:col-span-2">
																	<strong>Kỹ năng:</strong> {job.tags.join(", ")}
																</p>
															)}
														</div>
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AdminDashboard;
