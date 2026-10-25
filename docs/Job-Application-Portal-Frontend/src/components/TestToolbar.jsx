// src/components/TestToolbar.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resetDb, createMockJwt, getDb } from '../services/mockData.js';

const TestToolbar = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [toastMsg, setToastMsg] = useState('');
	const { user, login, logout } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const showFeedback = (msg) => {
		setToastMsg(msg);
		setTimeout(() => setToastMsg(''), 2500);
	};

	const switchRole = (roleKey) => {
		const db = getDb();
		let targetUser = null;
		let targetRoute = '/';

		if (roleKey === 'admin') {
			targetUser = db.users.find(u => u.role === 'admin') || db.users[0];
			targetRoute = '/admin/dashboard';
		} else if (roleKey === 'recruiter') {
			targetUser = db.users.find(u => u.role === 'recruiter') || db.users[1];
			targetRoute = '/recruiter/dashboard';
		} else if (roleKey === 'job-seeker') {
			targetUser = db.users.find(u => u.role === 'job-seeker') || db.users[2];
			targetRoute = '/user/dashboard';
		} else if (roleKey === 'guest') {
			logout();
			showFeedback('Đã đăng xuất về chế độ Khách (Guest)!');
			navigate('/');
			return;
		}

		if (targetUser) {
			const token = createMockJwt(targetUser);
			login(token);
			showFeedback(`Đã chuyển sang vai trò: ${targetUser.role.toUpperCase()} (${targetUser.name})`);
			navigate(targetRoute);
		}
	};

	const handleResetData = () => {
		if (window.confirm('Khôi phục toàn bộ dữ liệu mẫu (Users, Jobs, Applications) về ban đầu?')) {
			resetDb();
			showFeedback('✅ Đã khôi phục dữ liệu mẫu thành công!');
			window.location.reload();
		}
	};

	return (
		<div className="fixed bottom-5 right-5 z-50 font-sans">
			{/* Toast notification */}
			{toastMsg && (
				<div className="mb-2 px-4 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
					<span>✨</span>
					<span>{toastMsg}</span>
				</div>
			)}

			{/* Main Widget */}
			{isOpen ? (
				<div className="bg-white/95 backdrop-blur-md border border-blue-200 shadow-2xl rounded-2xl w-80 p-4 text-gray-800 transition-all">
					{/* Header */}
					<div className="flex items-center justify-between border-b pb-3 mb-3">
						<div className="flex items-center gap-2">
							<span className="flex h-3 w-3 relative">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
							</span>
							<h3 className="font-bold text-sm text-gray-900">Demo Testing Hub</h3>
						</div>
						<button
							onClick={() => setIsOpen(false)}
							className="text-gray-400 hover:text-gray-600 text-sm p-1 rounded-md hover:bg-gray-100"
							title="Thu nhỏ"
						>
							✕
						</button>
					</div>

					{/* Current User Info */}
					<div className="bg-blue-50/70 rounded-xl p-2.5 mb-3 text-xs border border-blue-100">
						<div className="flex items-center justify-between mb-1">
							<span className="text-gray-500">Trạng thái hiện tại:</span>
							<span className="font-bold uppercase px-2 py-0.5 rounded text-[10px] bg-blue-600 text-white">
								{user ? user.role : 'Khách (Guest)'}
							</span>
						</div>
						{user && (
							<div className="text-gray-700 font-medium truncate">
								👤 {user.name} ({user.email})
							</div>
						)}
					</div>

					{/* 1-Click Role Switcher */}
					<div className="mb-3">
						<p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
							⚡ Chuyển đổi vai trò nhanh
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							<button
								onClick={() => switchRole('job-seeker')}
								className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left border flex items-center gap-1.5 transition ${
									user?.role === 'job-seeker'
										? 'bg-blue-600 text-white border-blue-600 shadow'
										: 'bg-white hover:bg-blue-50 text-gray-700 border-gray-200'
								}`}
							>
								<span>👤</span> Job Seeker
							</button>

							<button
								onClick={() => switchRole('recruiter')}
								className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left border flex items-center gap-1.5 transition ${
									user?.role === 'recruiter'
										? 'bg-purple-600 text-white border-purple-600 shadow'
										: 'bg-white hover:bg-purple-50 text-gray-700 border-gray-200'
								}`}
							>
								<span>🏢</span> Recruiter
							</button>

							<button
								onClick={() => switchRole('admin')}
								className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left border flex items-center gap-1.5 transition ${
									user?.role === 'admin'
										? 'bg-amber-600 text-white border-amber-600 shadow'
										: 'bg-white hover:bg-amber-50 text-gray-700 border-gray-200'
								}`}
							>
								<span>👑</span> Admin
							</button>

							<button
								onClick={() => switchRole('guest')}
								className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left border flex items-center gap-1.5 transition ${
									!user
										? 'bg-gray-800 text-white border-gray-800 shadow'
										: 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
								}`}
							>
								<span>🚪</span> Đăng xuất
							</button>
						</div>
					</div>

					{/* Quick Links */}
					<div className="mb-3">
						<p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
							🧭 Truy cập nhanh các trang
						</p>
						<div className="grid grid-cols-2 gap-1 text-xs">
							{[
								{ label: 'Trang chủ', path: '/' },
								{ label: 'DS Việc làm', path: '/jobs' },
								{ label: 'Chi tiết Job mẫu', path: '/jobs/job_1' },
								{ label: 'Hồ sơ Profile', path: '/profile' },
								{ label: 'Đăng tin Job', path: '/recruiter/jobs/create' },
								{ label: 'Admin Panel', path: '/admin/dashboard' }
							].map((item) => (
								<button
									key={item.path}
									onClick={() => navigate(item.path)}
									className={`text-left px-2 py-1 rounded text-xs transition ${
										location.pathname === item.path
											? 'text-blue-600 font-bold bg-blue-50'
											: 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
									}`}
								>
									• {item.label}
								</button>
							))}
						</div>
					</div>

					{/* Reset Mock Data */}
					<div className="border-t pt-2.5 flex items-center justify-between">
						<button
							onClick={handleResetData}
							className="text-[11px] text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
						>
							<span>🔄</span> Khôi phục dữ liệu gốc
						</button>
						<span className="text-[10px] text-gray-400">Mock Mode Active</span>
					</div>
				</div>
			) : (
				/* Minimized Floating Button */
				<button
					onClick={() => setIsOpen(true)}
					className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white"
					title="Mở bảng điều khiển kiểm thử"
				>
					<span className="text-base">🧪</span>
					<span className="text-xs font-semibold">Test Data Toolbar</span>
					<span className="bg-white/20 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full">
						{user ? user.role : 'Guest'}
					</span>
				</button>
			)}
		</div>
	);
};

export default TestToolbar;
