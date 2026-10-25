import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

const CreateJob = () => {
	const [form, setForm] = useState({
		title: '',
		company: '',
		location: '',
		description: '',
		salary: '',
		tags: '',
		skills: '',
		experienceLevel: 'entry',
		status: 'open',
		jobType: 'full-time',
	});

	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');
	const navigate = useNavigate();

	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const isFormValid =
		form.title.trim() &&
		form.company.trim() &&
		form.location.trim() &&
		form.description.trim() &&
		form.salary;

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setMessage('');

		const payload = {
			...form,
			salary: Number(form.salary),
			salaryFormatted: `$${Number(form.salary).toLocaleString()} / năm`,
			tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
			skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
			companyVerified: true,
			isHot: true,
			postedTime: 'Hôm nay'
		};

		try {
			await api.post('/jobs/create', payload);
			setMessage('✅ Đăng tin tuyển dụng thành công! Đang chuyển hướng...');
			setTimeout(() => navigate('/recruiter/dashboard'), 1200);
		} catch (err) {
			console.error('Error creating job', err);
			const errMsg = err.response?.data?.message || '❌ Đăng việc làm thất bại. Vui lòng thử lại!';
			setMessage(errMsg);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
			<div className="max-w-4xl mx-auto space-y-6">
				
				{/* Breadcrumb */}
				<nav className="text-xs text-slate-400 flex items-center gap-2">
					<Link to="/" className="hover:text-blue-600">Trang chủ</Link>
					<span>/</span>
					<Link to="/recruiter/dashboard" className="hover:text-blue-600">Bảng điều khiển tuyển dụng</Link>
					<span>/</span>
					<span className="text-slate-700 font-semibold">Đăng tin mới</span>
				</nav>

				{/* Form Card */}
				<form
					onSubmit={handleSubmit}
					className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-8"
				>
					{/* Header */}
					<div className="border-b border-slate-100 pb-5">
						<span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
							Dành cho Nhà tuyển dụng
						</span>
						<h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
							Đăng Tin Tuyển Dụng IT Mới
						</h1>
						<p className="text-slate-500 text-xs sm:text-sm mt-1">
							Tiếp cận hơn 50,000+ hồ sơ kỹ sư phần mềm và lập trình viên chất lượng cao.
						</p>
					</div>

					{message && (
						<div
							className={`p-4 rounded-xl text-xs font-semibold ${
								message.includes('✅')
									? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
									: 'bg-red-50 text-red-800 border border-red-200'
							}`}
						>
							{message}
						</div>
					)}

					{/* 1. Basic Info */}
					<div className="space-y-4">
						<h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
							<span className="text-blue-600">📌</span>
							<span>Thông Tin Vị Trí</span>
						</h3>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Chức danh / Tiêu đề việc làm <span className="text-red-500">*</span>
								</label>
								<input
									name="title"
									value={form.title}
									onChange={handleChange}
									placeholder="VD: Senior Frontend Engineer (React/TypeScript)"
									className="input-field"
									required
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Tên doanh nghiệp / Công ty <span className="text-red-500">*</span>
								</label>
								<input
									name="company"
									value={form.company}
									onChange={handleChange}
									placeholder="VD: VNG Tech Hub"
									className="input-field"
									required
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Địa điểm làm việc <span className="text-red-500">*</span>
								</label>
								<input
									name="location"
									value={form.location}
									onChange={handleChange}
									placeholder="VD: TP. Hồ Chí Minh (Hybrid)"
									className="input-field"
									required
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Mức lương năm (USD) <span className="text-red-500">*</span>
								</label>
								<input
									type="number"
									name="salary"
									value={form.salary}
									onChange={handleChange}
									placeholder="VD: 55000"
									className="input-field"
									required
								/>
							</div>
						</div>
					</div>

					{/* 2. Job Description */}
					<div className="space-y-4 pt-4 border-t border-slate-100">
						<h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
							<span className="text-blue-600">📝</span>
							<span>Mô Tả Công Việc & Yêu Cầu</span>
						</h3>

						<div>
							<label className="block text-xs font-bold text-slate-700 mb-1.5">
								Chi tiết công việc, yêu cầu kỹ thuật & quyền lợi <span className="text-red-500">*</span>
							</label>
							<textarea
								name="description"
								value={form.description}
								onChange={handleChange}
								rows={7}
								placeholder="Mô tả cụ thể trách nhiệm, kỹ năng cần có, chế độ đãi ngộ (Lương tháng 13, thiết bị làm việc, bảo hiểm...)"
								className="input-field font-sans"
								required
							/>
							<div className="flex justify-between text-[11px] text-slate-400 mt-1">
								<span>Khuyên dùng: Viết rõ ràng các gạch đầu dòng để ứng viên dễ đọc</span>
								<span>{form.description.length} / 2000 ký tự</span>
							</div>
						</div>
					</div>

					{/* 3. Skills & Tags */}
					<div className="space-y-4 pt-4 border-t border-slate-100">
						<h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
							<span className="text-blue-600">🛠️</span>
							<span>Kỹ Năng & Từ Khóa Tìm Kiếm</span>
						</h3>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Thẻ tag nổi bật (cách nhau bởi dấu phẩy)
								</label>
								<input
									name="tags"
									value={form.tags}
									onChange={handleChange}
									placeholder="VD: React, TypeScript, Tailwind"
									className="input-field"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Kỹ năng chuyên môn (cách nhau bởi dấu phẩy)
								</label>
								<input
									name="skills"
									value={form.skills}
									onChange={handleChange}
									placeholder="VD: React, JavaScript, HTML, CSS, Git"
									className="input-field"
								/>
							</div>
						</div>
					</div>

					{/* 4. Categorization */}
					<div className="space-y-4 pt-4 border-t border-slate-100">
						<h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
							<span className="text-blue-600">⚙️</span>
							<span>Thiết Lập Khác</span>
						</h3>

						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Cấp bậc
								</label>
								<select
									name="experienceLevel"
									value={form.experienceLevel}
									onChange={handleChange}
									className="input-field cursor-pointer"
								>
									<option value="entry">Entry / Fresher</option>
									<option value="mid">Mid-level</option>
									<option value="senior">Senior Developer</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Hình thức làm việc
								</label>
								<select
									name="jobType"
									value={form.jobType}
									onChange={handleChange}
									className="input-field cursor-pointer"
								>
									<option value="full-time">Full-time (Toàn thời gian)</option>
									<option value="part-time">Part-time (Bán thời gian)</option>
									<option value="internship">Thực tập sinh (Internship)</option>
									<option value="contract">Hợp đồng (Contract)</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 mb-1.5">
									Trạng thái đăng tuyển
								</label>
								<select
									name="status"
									value={form.status}
									onChange={handleChange}
									className="input-field cursor-pointer"
								>
									<option value="open">Mở tuyển dụng (Open)</option>
									<option value="closed">Tạm đóng (Closed)</option>
								</select>
							</div>
						</div>
					</div>

					{/* Submit & Cancel */}
					<div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
						<Link
							to="/recruiter/dashboard"
							className="btn-secondary text-xs px-5 py-3"
						>
							Hủy bỏ
						</Link>
						<button
							type="submit"
							disabled={loading || !isFormValid}
							className="btn-primary text-xs px-8 py-3 disabled:opacity-50 cursor-pointer"
						>
							{loading ? 'Đang tạo việc làm...' : 'Đăng Tin Tuyển Dụng Ngay'}
						</button>
					</div>
				</form>

			</div>
		</div>
	);
};

export default CreateJob;
