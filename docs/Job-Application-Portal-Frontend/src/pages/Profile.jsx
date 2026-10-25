import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';

const Profile = () => {
	const [user, setUser] = useState(null);
	const [formData, setFormData] = useState({});
	const [editSection, setEditSection] = useState(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [activeTab, setActiveTab] = useState('general');
	const [saveSuccess, setSaveSuccess] = useState(false);

	const fetchProfile = async () => {
		setLoading(true);
		try {
			const { data } = await api.get('/users/me');
			setUser(data);
			setFormData(data);
		} catch (err) {
			console.error('Failed to load user profile', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchProfile();
	}, []);

	const handleInputChange = (field, value) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleArrayItemChange = (section, index, field, value) => {
		const updated = [...(formData[section] || [])];
		if (typeof updated[index] === 'string') {
			updated[index] = value;
		} else {
			updated[index] = {
				...updated[index],
				[field]: value,
			};
		}
		setFormData((prev) => ({ ...prev, [section]: updated }));
	};

	const handleAddItem = (section) => {
		const templates = {
			education: { institution: '', course: '', grade: '' },
			internships: { company: '', role: '', duration: '', description: '' },
			projects: { title: '', description: '', technologies: [], link: '' },
			certifications: { title: '', issuer: '', date: '' },
			awards: { title: '', issuer: '', date: '' },
			skills: 'Kỹ năng mới',
			languages: 'Ngôn ngữ mới',
		};
		const newItem = templates[section] || '';
		const current = formData[section] || [];
		setFormData((prev) => ({ ...prev, [section]: [...current, newItem] }));
	};

	const handleRemoveItem = (section, index) => {
		const current = formData[section] || [];
		setFormData((prev) => ({
			...prev,
			[section]: current.filter((_, i) => i !== index),
		}));
	};

	const handleSave = async () => {
		setSaving(true);
		setSaveSuccess(false);
		try {
			const { data } = await api.put('/users/me', formData);
			setUser(data);
			setFormData(data);
			setEditSection(null);
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			console.error('Failed to save profile', err);
			alert('Lưu hồ sơ thất bại. Vui lòng kiểm tra lại!');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
				<div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	if (!user || user.role === 'admin') {
		return (
			<div className="max-w-4xl mx-auto py-12 px-4 text-center">
				<div className="text-4xl mb-3">🛡️</div>
				<h2 className="text-xl font-bold text-slate-800">Tài khoản Quản Trị Viên</h2>
				<p className="text-slate-500 text-sm mt-1">
					Tài khoản Admin quản lý thông tin toàn hệ thống qua Dashboard.
				</p>
				<Link to="/admin/dashboard" className="btn-primary inline-block mt-4 text-xs">
					Đến Trang Quản Trị
				</Link>
			</div>
		);
	}

	const isRecruiter = user.role === 'recruiter';

	// Compute profile completeness percentage (TopCV style)
	const calculateCompleteness = () => {
		let score = 30; // base account
		if (formData.phone) score += 10;
		if (formData.location) score += 10;
		if (formData.bio) score += 15;
		if (formData.skills?.length > 0) score += 15;
		if (formData.education?.length > 0 || formData.company) score += 10;
		if (formData.projects?.length > 0 || formData.companyWebsite) score += 10;
		return Math.min(100, score);
	};

	const completeness = calculateCompleteness();

	return (
		<div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
			{saving && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
					<div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
						<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
						<span className="text-sm font-bold text-slate-800">Đang lưu thay đổi...</span>
					</div>
				</div>
			)}

			<div className="max-w-6xl mx-auto space-y-6">
				{/* Breadcrumb */}
				<nav className="text-xs text-slate-400 flex items-center gap-2">
					<Link to="/" className="hover:text-blue-600">Trang chủ</Link>
					<span>/</span>
					<span className="text-slate-700 font-semibold">
						{isRecruiter ? 'Hồ Sơ Doanh Nghiệp' : 'Hồ Sơ & CV Cá Nhân'}
					</span>
				</nav>

				{/* Header Banner - TopCV Profile Card */}
				<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
					<div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"></div>

					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
						<div className="flex items-center gap-5">
							{/* Avatar */}
							<div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-md shrink-0">
								{user.name?.charAt(0).toUpperCase()}
							</div>

							<div className="space-y-1">
								<div className="flex items-center gap-2 flex-wrap">
									<h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
										{user.name}
									</h1>
									<span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
										isRecruiter
											? 'bg-purple-50 text-purple-700 border-purple-200'
											: 'bg-emerald-50 text-emerald-700 border-emerald-200'
									}`}>
										{isRecruiter ? '🏢 Nhà Tuyển Dụng' : '🚀 Ứng Viên IT'}
									</span>
								</div>

								<p className="text-xs sm:text-sm text-slate-500">{user.email}</p>

								<div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
									<span>📍 {user.location || 'Việt Nam'}</span>
									{user.phone && <span>• 📞 {user.phone}</span>}
									{user.company && <span>• 🏢 {user.company}</span>}
								</div>
							</div>
						</div>

						{/* Quick Action */}
						<div className="flex flex-col sm:items-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
							{saveSuccess && (
								<span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-fade-in">
									✓ Đã cập nhật thành công!
								</span>
							)}
							{editSection ? (
								<div className="flex items-center gap-2">
									<button
										onClick={() => {
											setFormData(user);
											setEditSection(null);
										}}
										className="btn-secondary text-xs px-3.5 py-2"
									>
										Hủy
									</button>
									<button
										onClick={handleSave}
										className="btn-primary text-xs px-4 py-2"
									>
										💾 Lưu thay đổi
									</button>
								</div>
							) : (
								<button
									onClick={() => setEditSection('all')}
									className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
								>
									<span>✏️</span>
									<span>Chỉnh sửa hồ sơ</span>
								</button>
							)}
						</div>
					</div>

					{/* Profile Completeness Bar (TopCV Signature) */}
					<div className="mt-6 pt-5 border-t border-slate-100">
						<div className="flex items-center justify-between text-xs mb-2">
							<span className="font-bold text-slate-700 flex items-center gap-1.5">
								<span>🎯</span>
								<span>Độ hoàn thiện hồ sơ:</span>
								<strong className="text-blue-600 font-extrabold">{completeness}%</strong>
							</span>
							<span className="text-slate-400 font-medium">
								{completeness >= 80 ? '🌟 Đạt chuẩn chuyên nghiệp' : '💡 Bổ sung thêm để tăng tỷ lệ liên hệ'}
							</span>
						</div>
						<div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
								style={{ width: `${completeness}%` }}
							></div>
						</div>
					</div>
				</div>

				{/* 2-Column Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
					{/* Left Tab Navigation */}
					<div className="lg:col-span-1 bg-white rounded-2xl p-3 border border-slate-200/90 shadow-sm space-y-1 sticky top-20">
						<h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">
							Mục Hồ Sơ
						</h3>
						{[
							{ key: 'general', label: 'Thông tin chung', icon: '👤' },
							...(!isRecruiter
								? [
										{ key: 'skills', label: 'Kỹ năng & Chuyên môn', icon: '⚡' },
										{ key: 'experience', label: 'Kinh nghiệm & Dự án', icon: '💼' },
										{ key: 'education', label: 'Học vấn & Bằng cấp', icon: '🎓' },
										{ key: 'resume', label: 'CV Đính Kèm', icon: '📄' },
								  ]
								: [
										{ key: 'company', label: 'Thông tin công ty', icon: '🏢' },
								  ]),
						].map((tab) => (
							<button
								key={tab.key}
								onClick={() => setActiveTab(tab.key)}
								className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
									activeTab === tab.key
										? 'bg-blue-600 text-white shadow-sm'
										: 'text-slate-700 hover:bg-slate-50'
								}`}
							>
								<span>{tab.icon}</span>
								<span>{tab.label}</span>
							</button>
						))}
					</div>

					{/* Right Content Panels */}
					<div className="lg:col-span-3 space-y-6">
						{/* TAB 1: THÔNG TIN CHUNG */}
						{activeTab === 'general' && (
							<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
								<div className="flex items-center justify-between pb-4 border-b border-slate-100">
									<div>
										<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
											<span>👤</span>
											<span>Thông Tin Cơ Bản</span>
										</h2>
										<p className="text-xs text-slate-500 mt-0.5">
											Thông tin liên hệ trực tiếp cho nhà tuyển dụng
										</p>
									</div>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
									<div>
										<label className="block font-bold text-slate-700 mb-1.5">Họ và tên</label>
										{editSection ? (
											<input
												className="input-field"
												value={formData.name || ''}
												onChange={(e) => handleInputChange('name', e.target.value)}
											/>
										) : (
											<p className="p-3 bg-slate-50 rounded-xl font-medium text-slate-800 border border-slate-100">
												{formData.name || 'Chưa cập nhật'}
											</p>
										)}
									</div>

									<div>
										<label className="block font-bold text-slate-700 mb-1.5">Email liên hệ</label>
										<p className="p-3 bg-slate-50 rounded-xl font-medium text-slate-500 border border-slate-100">
											{formData.email} (Không đổi)
										</p>
									</div>

									<div>
										<label className="block font-bold text-slate-700 mb-1.5">Số điện thoại</label>
										{editSection ? (
											<input
												className="input-field"
												value={formData.phone || ''}
												placeholder="0912 345 678"
												onChange={(e) => handleInputChange('phone', e.target.value)}
											/>
										) : (
											<p className="p-3 bg-slate-50 rounded-xl font-medium text-slate-800 border border-slate-100">
												{formData.phone || 'Chưa cập nhật số điện thoại'}
											</p>
										)}
									</div>

									<div>
										<label className="block font-bold text-slate-700 mb-1.5">Tỉnh / Thành phố</label>
										{editSection ? (
											<input
												className="input-field"
												value={formData.location || ''}
												placeholder="Hồ Chí Minh, Hà Nội..."
												onChange={(e) => handleInputChange('location', e.target.value)}
											/>
										) : (
											<p className="p-3 bg-slate-50 rounded-xl font-medium text-slate-800 border border-slate-100">
												{formData.location || 'Chưa cập nhật địa điểm'}
											</p>
										)}
									</div>

									<div className="sm:col-span-2">
										<label className="block font-bold text-slate-700 mb-1.5">
											Giới thiệu tóm tắt (Bio / Summary)
										</label>
										{editSection ? (
											<textarea
												rows={4}
												className="input-field"
												value={formData.bio || ''}
												placeholder="Tóm tắt về kinh nghiệm, mục tiêu nghề nghiệp và thế mạnh kỹ thuật..."
												onChange={(e) => handleInputChange('bio', e.target.value)}
											/>
										) : (
											<div className="p-4 bg-slate-50 rounded-xl font-medium text-slate-700 border border-slate-100 leading-relaxed whitespace-pre-line">
												{formData.bio || 'Chưa có thông tin giới thiệu bản thân.'}
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{/* TAB 2: KỸ NĂNG & CÔNG NGHỆ */}
						{activeTab === 'skills' && !isRecruiter && (
							<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
								<div className="flex items-center justify-between pb-4 border-b border-slate-100">
									<div>
										<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
											<span>⚡</span>
											<span>Kỹ Năng & Stack Công Nghệ</span>
										</h2>
										<p className="text-xs text-slate-500 mt-0.5">
											Các ngôn ngữ lập trình, framework, công cụ bạn sử dụng thành thạo
										</p>
									</div>
									{editSection && (
										<button
											onClick={() => handleAddItem('skills')}
											className="btn-secondary text-xs px-3 py-1.5"
										>
											+ Thêm kỹ năng
										</button>
									)}
								</div>

								{/* Skills Pills */}
								<div>
									<h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
										Kỹ năng chuyên môn ({formData.skills?.length || 0})
									</h4>
									{(!formData.skills || formData.skills.length === 0) ? (
										<p className="text-xs text-slate-400 italic">Chưa có kỹ năng nào.</p>
									) : (
										<div className="flex flex-wrap gap-2">
											{formData.skills.map((skill, idx) => (
												<div
													key={idx}
													className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"
												>
													{editSection ? (
														<input
															type="text"
															className="bg-transparent outline-none w-24 text-xs font-bold text-blue-800"
															value={skill}
															onChange={(e) => handleArrayItemChange('skills', idx, null, e.target.value)}
														/>
													) : (
														<span>{skill}</span>
													)}
													{editSection && (
														<button
															onClick={() => handleRemoveItem('skills', idx)}
															className="text-red-500 hover:text-red-700 font-bold ml-1"
														>
															×
														</button>
													)}
												</div>
											))}
										</div>
									)}
								</div>

								{/* Languages */}
								<div className="pt-4 border-t border-slate-100">
									<div className="flex items-center justify-between mb-2">
										<h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
											Ngoại ngữ ({formData.languages?.length || 0})
										</h4>
										{editSection && (
											<button
												onClick={() => handleAddItem('languages')}
												className="text-xs text-blue-600 font-semibold hover:underline"
											>
												+ Thêm ngoại ngữ
											</button>
										)}
									</div>
									{(!formData.languages || formData.languages.length === 0) ? (
										<p className="text-xs text-slate-400 italic">Chưa có ngoại ngữ nào.</p>
									) : (
										<div className="flex flex-wrap gap-2">
											{formData.languages.map((lang, idx) => (
												<span
													key={idx}
													className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-slate-100 text-slate-700"
												>
													{lang}
													{editSection && (
														<button
															onClick={() => handleRemoveItem('languages', idx)}
															className="text-red-500 hover:text-red-700 font-bold ml-1"
														>
															×
														</button>
													)}
												</span>
											))}
										</div>
									)}
								</div>
							</div>
						)}

						{/* TAB 3: KINH NGHIỆM & DỰ ÁN */}
						{activeTab === 'experience' && !isRecruiter && (
							<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
								<div className="flex items-center justify-between pb-4 border-b border-slate-100">
									<div>
										<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
											<span>💼</span>
											<span>Kinh Nghiệm Làm Việc & Dự Án</span>
										</h2>
										<p className="text-xs text-slate-500 mt-0.5">
											Lịch sử công tác, dự án tiêu biểu và vai trò đảm nhiệm
										</p>
									</div>
									{editSection && (
										<button
											onClick={() => handleAddItem('projects')}
											className="btn-secondary text-xs px-3 py-1.5"
										>
											+ Thêm dự án
										</button>
									)}
								</div>

								{/* Projects List */}
								<div className="space-y-4">
									{(!formData.projects || formData.projects.length === 0) ? (
										<div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
											<p className="text-xs text-slate-400 italic">Chưa có dự án nào được thêm.</p>
										</div>
									) : (
										formData.projects.map((proj, idx) => (
											<div
												key={idx}
												className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
											>
												<div className="flex items-start justify-between gap-3">
													<div className="flex-1">
														{editSection ? (
															<input
																className="input-field mb-2"
																placeholder="Tên dự án (VD: Hệ thống thương mại điện tử Microservices)"
																value={proj.title || ''}
																onChange={(e) => handleArrayItemChange('projects', idx, 'title', e.target.value)}
															/>
														) : (
															<h4 className="text-sm font-bold text-slate-900">
																{proj.title || 'Dự án chưa đặt tên'}
															</h4>
														)}
													</div>
													{editSection && (
														<button
															onClick={() => handleRemoveItem('projects', idx)}
															className="text-xs text-red-500 font-bold hover:underline"
														>
															Xóa
														</button>
													)}
												</div>

												{editSection ? (
													<textarea
														rows={2}
														className="input-field"
														placeholder="Mô tả công việc, giải pháp và kết quả đạt được..."
														value={proj.description || ''}
														onChange={(e) => handleArrayItemChange('projects', idx, 'description', e.target.value)}
													/>
												) : (
													<p className="text-xs text-slate-600 leading-relaxed">
														{proj.description || 'Không có mô tả.'}
													</p>
												)}

												{proj.link && !editSection && (
													<a
														href={proj.link}
														target="_blank"
														rel="noreferrer"
														className="text-xs text-blue-600 hover:underline font-semibold block"
													>
														🔗 Xem sản phẩm / GitHub →
													</a>
												)}
											</div>
										))
									)}
								</div>
							</div>
						)}

						{/* TAB 4: HỌC VẤN */}
						{activeTab === 'education' && !isRecruiter && (
							<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
								<div className="flex items-center justify-between pb-4 border-b border-slate-100">
									<div>
										<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
											<span>🎓</span>
											<span>Học Vấn & Chứng Chỉ</span>
										</h2>
										<p className="text-xs text-slate-500 mt-0.5">
											Bằng cấp đại học và chứng chỉ nghề nghiệp quốc tế
										</p>
									</div>
									{editSection && (
										<button
											onClick={() => handleAddItem('education')}
											className="btn-secondary text-xs px-3 py-1.5"
										>
											+ Thêm học vấn
										</button>
									)}
								</div>

								<div className="space-y-4">
									{(!formData.education || formData.education.length === 0) ? (
										<div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
											<p className="text-xs text-slate-400 italic">Chưa có thông tin học vấn.</p>
										</div>
									) : (
										formData.education.map((edu, idx) => (
											<div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
												<div className="flex justify-between items-start">
													<div>
														<h4 className="text-sm font-bold text-slate-900">
															{edu.institution || 'Trường / Cơ sở đào tạo'}
														</h4>
														<p className="text-xs text-slate-500">
															{edu.course || 'Chuyên ngành'} {edu.grade ? `• Xếp loại: ${edu.grade}` : ''}
														</p>
													</div>
													{editSection && (
														<button
															onClick={() => handleRemoveItem('education', idx)}
															className="text-xs text-red-500 hover:underline"
														>
															Xóa
														</button>
													)}
												</div>
											</div>
										))
									)}
								</div>
							</div>
						)}

						{/* TAB 5: CV ĐÍNH KÈM */}
						{activeTab === 'resume' && !isRecruiter && (
							<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
								<div className="pb-4 border-b border-slate-100">
									<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
										<span>📄</span>
										<span>CV / Hồ Sơ Trực Tuyến</span>
									</h2>
									<p className="text-xs text-slate-500 mt-0.5">
										File CV sẽ được tự động gửi kèm khi bạn ứng tuyển vào bất kỳ công việc nào
									</p>
								</div>

								<div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
									<div className="flex items-center gap-4">
										<div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm shrink-0">
											📄
										</div>
										<div>
											<h4 className="text-sm font-bold text-slate-900">
												CV_ChuyenNghiep_{user.name?.replace(/\s+/g, '_')}.pdf
											</h4>
											<p className="text-xs text-slate-500 mt-0.5">
												Định dạng PDF • Cập nhật lần cuối: Hôm nay
											</p>
										</div>
									</div>

									<div className="flex items-center gap-2 w-full sm:w-auto">
										<a
											href={formData.resumeUrl || 'https://example.com/resume.pdf'}
											target="_blank"
											rel="noreferrer"
											className="btn-primary text-xs px-4 py-2 w-full sm:w-auto text-center"
										>
											Xem CV hiện tại
										</a>
									</div>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-700 mb-1.5">
										Đường dẫn CV trực tuyến (Google Drive, Notion, Portfolio):
									</label>
									{editSection ? (
										<input
											className="input-field text-xs"
											value={formData.resumeUrl || ''}
											placeholder="https://drive.google.com/..."
											onChange={(e) => handleInputChange('resumeUrl', e.target.value)}
										/>
									) : (
										<p className="text-xs text-blue-600 font-medium truncate">
											{formData.resumeUrl || 'https://example.com/demo-cv.pdf'}
										</p>
									)}
								</div>
							</div>
						)}

						{/* TAB COMPANY: CHO RECRUITER */}
						{activeTab === 'company' && isRecruiter && (
							<div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
								<div className="pb-4 border-b border-slate-100">
									<h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
										<span>🏢</span>
										<span>Thông Tin Doanh Nghiệp Tuyển Dụng</span>
									</h2>
									<p className="text-xs text-slate-500 mt-0.5">
										Thông tin sẽ hiển thị công khai trên các tin tuyển dụng bạn đăng tải
									</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
									<div>
										<label className="block font-bold text-slate-700 mb-1.5">Tên công ty / Doanh nghiệp</label>
										{editSection ? (
											<input
												className="input-field"
												value={formData.company || ''}
												onChange={(e) => handleInputChange('company', e.target.value)}
											/>
										) : (
											<p className="p-3 bg-slate-50 rounded-xl font-medium text-slate-800 border border-slate-100">
												{formData.company || 'VNG Tech Hub'}
											</p>
										)}
									</div>

									<div>
										<label className="block font-bold text-slate-700 mb-1.5">Website doanh nghiệp</label>
										{editSection ? (
											<input
												className="input-field"
												value={formData.companyWebsite || ''}
												placeholder="https://company.vn"
												onChange={(e) => handleInputChange('companyWebsite', e.target.value)}
											/>
										) : (
											<p className="p-3 bg-slate-50 rounded-xl font-medium text-blue-600 border border-slate-100">
												{formData.companyWebsite || 'https://careers.vng.com.vn'}
											</p>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Profile;
