// src/services/mockData.js
/**
 * Mock database and seed data for local testing of Job Application Portal.
 * All state is persisted in localStorage so user interactions (apply, create job,
 * edit profile, update status, withdraw, delete) persist across reloads.
 */

const STORAGE_KEY = 'job_portal_mock_db_v2';

// Initial Users
export const INITIAL_USERS = [
	{
		_id: 'user_admin_1',
		name: 'Nguyễn Văn Quản Trị (Admin)',
		email: 'admin@demo.com',
		password: 'password123',
		role: 'admin',
		createdAt: '2024-01-10T08:00:00.000Z',
		updatedAt: '2024-01-15T08:00:00.000Z',
		skills: ['System Administration', 'Security', 'Database Management'],
		languages: ['Vietnamese', 'English'],
		clubs: ['Tech Management Association'],
		education: [
			{ institution: 'Đại học Bách Khoa Hà Nội', institute: 'Đại học Bách Khoa Hà Nội', course: 'Hệ thống Thông tin', grade: '3.8 / 4.0' }
		],
		internships: [],
		projects: [],
		certifications: [],
		awards: []
	},
	{
		_id: 'user_recruiter_1',
		name: 'Lê Hoàng (Senior Recruiter)',
		email: 'recruiter@demo.com',
		password: 'password123',
		role: 'recruiter',
		company: 'VNG Tech Hub',
		position: 'Lead Technical Recruiter',
		industry: 'Technology & Gaming',
		companyWebsite: 'https://vng.com.vn',
		location: 'TP. Hồ Chí Minh, Vietnam',
		bio: 'Chuyên viên tuyển dụng kỹ thuật cao cấp với 7 năm kinh nghiệm săn đón nhân tài trong mảng Web, Mobile, AI và Cloud Computing.',
		phone: '+84 901 234 567',
		createdAt: '2024-02-01T08:00:00.000Z',
		updatedAt: '2024-03-01T08:00:00.000Z',
		skills: ['Technical Recruiting', 'Talent Acquisition', 'HR Strategy'],
		languages: ['Vietnamese', 'English'],
		clubs: ['Vietnam HR Tech Forum'],
		education: [
			{ institution: 'Đại học Kinh tế TP.HCM', institute: 'Đại học Kinh tế TP.HCM', course: 'Quản trị Nhân lực', grade: '3.5 / 4.0' }
		],
		internships: [],
		projects: [],
		certifications: [],
		awards: []
	},
	{
		_id: 'user_seeker_1',
		name: 'Trần Minh (Fullstack Developer)',
		email: 'seeker@demo.com',
		password: 'password123',
		role: 'job-seeker',
		location: 'Hà Nội, Vietnam',
		phone: '+84 987 654 321',
		gender: 'Male',
		dob: '1998-08-15',
		resumeUrl: 'https://example.com/resumes/tran-minh-cv.pdf',
		bio: 'Kỹ sư phần mềm Fullstack với 3+ năm kinh nghiệm thực chiến với React, Node.js, TypeScript và hệ sinh thái đám mây AWS. Đam mê tối ưu hiệu năng và trải nghiệm người dùng cao cấp.',
		skills: ['JavaScript', 'React', 'TypeScript', 'Node.js', 'MongoDB', 'Docker', 'AWS', 'Tailwind CSS', 'Git', 'Problem Solving'],
		languages: ['Vietnamese (Bản ngữ)', 'English (Thành thạo - IELTS 7.5)'],
		education: [
			{
				institution: 'Đại học Bách Khoa Hà Nội',
				institute: 'Đại học Bách Khoa Hà Nội',
				course: 'Cử nhân Kỹ thuật Phần mềm',
				grade: '3.6 / 4.0 (Giỏi)'
			}
		],
		internships: [
			{
				company: 'FPT Software Corp',
				role: 'Frontend Developer Intern',
				duration: '06/2021 - 12/2021',
				description: 'Xây dựng giao diện dashboard phân tích dữ liệu lớn bằng React và Redux Toolkit, tối ưu tốc độ phản hồi 35%.'
			}
		],
		projects: [
			{
				title: 'Job Portal Application Platform',
				description: 'Cổng tuyển dụng thông minh kết nối ứng viên và nhà tuyển dụng với giao diện trực quan, hỗ trợ quy trình nộp hồ sơ thời gian thực.',
				technologies: ['React', 'Node.js', 'Tailwind CSS', 'Vite'],
				link: 'https://github.com/example/job-portal'
			},
			{
				title: 'High-Scale E-Commerce Microservices',
				description: 'Kiến trúc microservices xử lý 10,000 requests/s với message broker Kafka và Redis Cache.',
				technologies: ['Node.js', 'Docker', 'Redis', 'Kafka', 'MongoDB'],
				link: 'https://github.com/example/ecommerce-microservices'
			}
		],
		certifications: [
			{
				name: 'AWS Certified Solutions Architect – Associate',
				title: 'AWS Certified Solutions Architect – Associate',
				issuer: 'Amazon Web Services',
				date: '2023-11'
			},
			{
				name: 'Meta Certified Frontend Developer',
				title: 'Meta Certified Frontend Developer',
				issuer: 'Coursera & Meta',
				date: '2023-05'
			}
		],
		awards: [
			{
				name: 'Quán quân Hackathon Bach Khoa Tech 2022',
				title: 'Quán quân Hackathon Bach Khoa Tech 2022',
				issuer: 'HUST Innovation Club',
				date: '2022-10'
			}
		],
		clubs: ['Google Developer Student Club (Core Team)', 'BK Coding Society'],
		createdAt: '2024-02-10T08:00:00.000Z',
		updatedAt: '2024-03-02T08:00:00.000Z'
	},
	{
		_id: 'user_seeker_2',
		name: 'Đỗ Thu Hà',
		email: 'ha.dothu@example.com',
		password: 'password123',
		role: 'job-seeker',
		location: 'TP. Hồ Chí Minh, Vietnam',
		phone: '+84 912 345 678',
		gender: 'Female',
		dob: '2000-05-20',
		resumeUrl: 'https://example.com/resumes/ha-dothu-cv.pdf',
		bio: 'UI/UX Designer & Product Designer với con mắt thẩm mỹ tinh tế, thành thạo Figma, Design System và User Testing.',
		skills: ['Figma', 'HTML', 'CSS', 'Communication', 'Problem Solving'],
		languages: ['Vietnamese', 'English'],
		education: [
			{ institution: 'Đại học Kiến Trúc TP.HCM', institute: 'Đại học Kiến Trúc TP.HCM', course: 'Thiết kế Đồ họa & Tương tác', grade: '3.7 / 4.0' }
		],
		internships: [
			{ company: 'Momo Fintech', role: 'UI/UX Designer Intern', duration: '08/2022 - 02/2023', description: 'Thiết kế các flow chuyển tiền và liên kết thẻ ngân hàng.' }
		],
		projects: [
			{ title: 'Smart Banking App Redesign', description: 'Thiết kế lại luồng onboarding ứng dụng tài chính giúp tăng conversion rate 25%.', technologies: ['Figma', 'Protopie'], link: 'https://behance.net/smart-banking' }
		],
		certifications: [
			{ name: 'Google UX Design Professional Certificate', title: 'Google UX Design Professional Certificate', issuer: 'Google', date: '2023-01' }
		],
		awards: [],
		clubs: ['Vietnam Design Community'],
		createdAt: '2024-02-12T08:00:00.000Z',
		updatedAt: '2024-03-01T08:00:00.000Z'
	},
	{
		_id: 'user_seeker_3',
		name: 'Phạm Quốc Bảo',
		email: 'bao.pham@example.com',
		password: 'password123',
		role: 'job-seeker',
		location: 'Đà Nẵng, Vietnam',
		phone: '+84 933 456 789',
		gender: 'Male',
		dob: '1997-12-03',
		resumeUrl: 'https://example.com/resumes/bao-pham-backend.pdf',
		bio: 'Backend Engineer chuyên sâu Python, Django, FastAPI và xử lý phân tích dữ liệu lớn.',
		skills: ['Python', 'Django', 'Docker', 'AWS', 'Swagger', 'Git', 'Problem Solving'],
		languages: ['Vietnamese', 'English (IELTS 6.5)'],
		education: [
			{ institution: 'Đại học Bách Khoa Đà Nẵng', institute: 'Đại học Bách Khoa Đà Nẵng', course: 'Công nghệ Thông tin', grade: '3.4 / 4.0' }
		],
		internships: [],
		projects: [],
		certifications: [],
		awards: [],
		clubs: [],
		createdAt: '2024-02-18T08:00:00.000Z',
		updatedAt: '2024-03-01T08:00:00.000Z'
	},
	{
		_id: 'user_recruiter_2',
		name: 'Ngô Đình Trí (Shopee HR)',
		email: 'tri.recruiter@shopee.vn',
		password: 'password123',
		role: 'recruiter',
		company: 'Shopee Vietnam',
		position: 'Tech Talent Acquisition Specialist',
		industry: 'E-Commerce',
		companyWebsite: 'https://shopee.vn',
		location: 'Hà Nội, Vietnam',
		bio: 'Đại diện tuyển dụng khối kỹ sư hạ tầng và dữ liệu tại Shopee Vietnam.',
		phone: '+84 902 334 556',
		createdAt: '2024-01-20T08:00:00.000Z',
		updatedAt: '2024-02-28T08:00:00.000Z',
		skills: ['HR', 'Sourcing', 'Interviewing'],
		languages: ['Vietnamese', 'English'],
		clubs: [],
		education: [],
		internships: [],
		projects: [],
		certifications: [],
		awards: []
	}
];

// Initial Jobs
export const INITIAL_JOBS = [
	{
		_id: 'job_1',
		title: 'Senior Frontend Engineer (React / TypeScript)',
		company: 'VNG Tech Hub',
		companyInitials: 'VNG',
		companyLogoBg: 'from-blue-600 to-indigo-700',
		companyVerified: true,
		location: 'TP. Hồ Chí Minh (Hybrid)',
		city: 'TP. Hồ Chí Minh',
		workMode: 'Hybrid',
		salary: 55000,
		salaryFormatted: '$2,500 - $3,500 / tháng',
		isHot: true,
		postedTime: 'Hôm nay',
		description: `Chúng tôi đang tìm kiếm Senior Frontend Engineer tài năng gia nhập đội ngũ phát triển nền tảng phục vụ hàng triệu người dùng tại VNG.

Trách nhiệm chính:
• Xây dựng và tối ưu giao diện web ứng dụng hiện đại bằng React 19, TypeScript và Vite.
• Thiết kế kiến trúc component có khả năng mở rộng, tái sử dụng cao và tương thích chuẩn Design System.
• Đo lường và tối ưu hóa Web Vitals (LCP, FID, CLS), giảm dung lượng bundle và tăng tốc độ tải trang.
• Phối hợp chặt chẽ với Product Managers, UI/UX Designers và đội ngũ Backend Engineers.

Yêu cầu ứng viên:
• 4+ năm kinh nghiệm làm việc thực chiến với React, TypeScript, HTML5, CSS3/Tailwind.
• Nắm vững kiến trúc State Management (Zustand/Redux), Async handling, WebSockets.
• Hiểu sâu về tối ưu render, browser caching và bundling performance.
• Có kinh nghiệm viết Unit Test (Jest, React Testing Library) và CI/CD.

Quyền lợi hấp dẫn:
• Thu nhập lên tới $3,500/tháng + thưởng tháng 13 & KPIs 2-4 tháng lương.
• Bảo hiểm sức khỏe quốc tế cao cấp cho cá nhân và gia đình.
• Môi trường làm việc Hybrid (lên văn phòng 2 ngày/tuần, tự do chọn ngày WFH).
• Thiết bị làm việc: MacBook Pro M3 Max + màn hình 4K Dell UltraSharp.`,
		tags: ['React', 'TypeScript', 'Tailwind', 'Frontend'],
		skills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Git', 'Problem Solving'],
		experienceLevel: 'senior',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_1',
			name: 'Lê Hoàng (Senior Recruiter)',
			email: 'recruiter@demo.com'
		},
		applications: ['app_1', 'app_4', 'app_5'],
		createdAt: '2024-03-01T10:00:00.000Z',
		updatedAt: '2024-03-05T10:00:00.000Z'
	},
	{
		_id: 'job_2',
		title: 'Fullstack Node.js & React Developer',
		company: 'VNG Tech Hub',
		companyInitials: 'VNG',
		companyLogoBg: 'from-blue-600 to-indigo-700',
		companyVerified: true,
		location: 'TP. Hồ Chí Minh (Remote)',
		city: 'TP. Hồ Chí Minh',
		workMode: 'Remote',
		salary: 42000,
		salaryFormatted: '$1,800 - $2,500 / tháng',
		isHot: true,
		postedTime: '1 ngày trước',
		description: `Tham gia vào nhóm phát triển giải pháp dịch vụ đám mây và cổng tương tác dịch vụ số cho doanh nghiệp.

Công việc chính:
• Phát triển RESTful API và GraphQL backend bằng Node.js, Express và MongoDB.
• Xây dựng các trang quản trị dashboard và ứng dụng client với React, Redux, Tailwind.
• Tích hợp hệ thống phân tán, message queue và dịch vụ thanh toán trực tuyến.
• Đảm bảo mã nguồn chất lượng cao, tuân thủ các quy tắc bảo mật OWASP.

Yêu cầu:
• 3+ năm kinh nghiệm Fullstack với Node.js và React.
• Thành thạo MongoDB, Redis, Docker và Docker-compose.
• Kỹ năng viết mã sạch, tư duy giải quyết vấn đề nhanh nhạy.`,
		tags: ['Node.js', 'React', 'MongoDB', 'Fullstack'],
		skills: ['Node.js', 'React', 'MongoDB', 'Express', 'Docker', 'AWS', 'Git'],
		experienceLevel: 'mid',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_1',
			name: 'Lê Hoàng (Senior Recruiter)',
			email: 'recruiter@demo.com'
		},
		applications: ['app_2'],
		createdAt: '2024-03-02T11:00:00.000Z',
		updatedAt: '2024-03-02T11:00:00.000Z'
	},
	{
		_id: 'job_3',
		title: 'Cloud DevOps & Infrastructure Engineer (AWS/K8s)',
		company: 'Shopee Vietnam',
		companyInitials: 'SP',
		companyLogoBg: 'from-orange-500 to-red-600',
		companyVerified: true,
		location: 'Hà Nội (Onsite)',
		city: 'Hà Nội',
		workMode: 'Onsite',
		salary: 62000,
		salaryFormatted: '$2,500 - $3,800 / tháng',
		isHot: true,
		postedTime: '2 ngày trước',
		description: `Shopee Vietnam mở rộng đội ngũ DevOps để quản lý và vận hành hệ thống thương mại điện tử hàng đầu Đông Nam Á.

Nhiệm vụ:
• Thiết kế, quản lý hạ tầng Kubernetes cluster chạy trên AWS và Private Cloud.
• Xây dựng pipeline CI/CD tự động hóa kiểm thử, quét mã bảo mật và deploy với GitLab CI/ArgoCD.
• Giám sát hệ thống với Prometheus, Grafana, ELK Stack và thiết lập hệ thống cảnh báo tức thì.
• Tối ưu chi phí hạ tầng và đảm bảo uptime 99.99% cho các ngày siêu sale lớn.

Yêu cầu:
• Có kinh nghiệm thực chiến với Kubernetes, Terraform, Docker, AWS.
• Thành thạo scripting với Bash shell và Python.
• Tư duy phân tích sự cố và xử lý nghẽn mạng, I/O nhanh chóng.`,
		tags: ['AWS', 'Docker', 'CI/CD', 'Kubernetes'],
		skills: ['AWS', 'Docker', 'CI/CD', 'Bash', 'Python', 'Problem Solving'],
		experienceLevel: 'senior',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_2',
			name: 'Ngô Đình Trí (Shopee HR)',
			email: 'tri.recruiter@shopee.vn'
		},
		applications: [],
		createdAt: '2024-03-03T09:00:00.000Z',
		updatedAt: '2024-03-03T09:00:00.000Z'
	},
	{
		_id: 'job_4',
		title: 'Mobile App Developer (React Native / iOS & Android)',
		company: 'Grab Financial Group',
		companyInitials: 'GRB',
		companyLogoBg: 'from-emerald-600 to-teal-700',
		companyVerified: true,
		location: 'TP. Hồ Chí Minh (Hybrid)',
		city: 'TP. Hồ Chí Minh',
		workMode: 'Hybrid',
		salary: 38000,
		salaryFormatted: '$1,600 - $2,300 / tháng',
		isHot: false,
		postedTime: '3 ngày trước',
		description: `Tìm kiếm kỹ sư Mobile React Native đam mê xây dựng ứng dụng ví điện tử và mạng xã hội phục vụ hàng chục triệu lượt tải.

Trách nhiệm:
• Lập trình ứng dụng đa nền tảng iOS & Android bằng React Native và TypeScript.
• Tối ưu hiệu năng animation 60fps và bộ nhớ, tích hợp Native Modules khi cần.
• Phối hợp với team Backend để thiết kế API mượt mà và hỗ trợ chế độ Offline-first.

Yêu cầu:
• 2+ năm kinh nghiệm React Native chuyên nghiệp.
• Hiểu rõ quy trình build và phát hành app lên Apple App Store và Google Play Store.
• Thành thạo Redux/Zustand và các thư viện Native animation.`,
		tags: ['React Native', 'Mobile', 'iOS', 'Android'],
		skills: ['React Native', 'JavaScript', 'TypeScript', 'Redux', 'Git'],
		experienceLevel: 'mid',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_1',
			name: 'Lê Hoàng (Senior Recruiter)',
			email: 'recruiter@demo.com'
		},
		applications: ['app_3'],
		createdAt: '2024-03-04T14:00:00.000Z',
		updatedAt: '2024-03-04T14:00:00.000Z'
	},
	{
		_id: 'job_5',
		title: 'Backend Python / Django Specialist',
		company: 'Shopee Vietnam',
		companyInitials: 'SP',
		companyLogoBg: 'from-orange-500 to-red-600',
		companyVerified: true,
		location: 'Hà Nội (Hybrid)',
		city: 'Hà Nội',
		workMode: 'Hybrid',
		salary: 45000,
		salaryFormatted: '$1,800 - $2,600 / tháng',
		isHot: false,
		postedTime: '4 ngày trước',
		description: `Phát triển hệ thống microservices quản lý kho bãi, theo dõi đơn hàng và giải pháp thanh toán.

Yêu cầu:
• Có kinh nghiệm vững chắc với Python, Django REST Framework hoặc FastAPI.
• Nắm vững cơ sở dữ liệu PostgreSQL, cơ chế Indexing, Query Optimization.
• Hiểu rõ Docker, Swagger và quy trình kiểm thử tự động.`,
		tags: ['Python', 'Django', 'PostgreSQL', 'Backend'],
		skills: ['Python', 'Django', 'Swagger', 'Docker', 'Git', 'Problem Solving'],
		experienceLevel: 'mid',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_2',
			name: 'Ngô Đình Trí (Shopee HR)',
			email: 'tri.recruiter@shopee.vn'
		},
		applications: [],
		createdAt: '2024-03-05T08:30:00.000Z',
		updatedAt: '2024-03-05T08:30:00.000Z'
	},
	{
		_id: 'job_6',
		title: 'UI/UX Product Designer (Design System & Figma)',
		company: 'MoMo Fintech',
		companyInitials: 'MM',
		companyLogoBg: 'from-pink-600 to-rose-700',
		companyVerified: true,
		location: 'TP. Hồ Chí Minh (Onsite)',
		city: 'TP. Hồ Chí Minh',
		workMode: 'Onsite',
		salary: 32000,
		salaryFormatted: '$1,300 - $1,900 / tháng',
		isHot: true,
		postedTime: '5 ngày trước',
		description: `Cần tuyển UI/UX Designer sáng tạo, đam mê nghiên cứu trải nghiệm người dùng và thiết kế Design System cho sản phẩm ứng dụng số thế hệ mới.

Nhiệm vụ:
• Nghiên cứu người dùng, xây dựng User Persona, User Journey Map và Wireframes.
• Thiết kế giao diện trực quan, tương tác cao với Figma.
• Duy trì và phát triển Design System đồng nhất cùng đội ngũ Frontend.`,
		tags: ['Figma', 'UI/UX', 'Product Design'],
		skills: ['Figma', 'Communication', 'Problem Solving', 'HTML', 'CSS'],
		experienceLevel: 'entry',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_1',
			name: 'Lê Hoàng (Senior Recruiter)',
			email: 'recruiter@demo.com'
		},
		applications: [],
		createdAt: '2024-03-06T15:00:00.000Z',
		updatedAt: '2024-03-06T15:00:00.000Z'
	},
	{
		_id: 'job_7',
		title: 'AI & Large Language Model (LLM) Engineer',
		company: 'FPT Software AI Center',
		companyInitials: 'FPT',
		companyLogoBg: 'from-blue-700 to-cyan-600',
		companyVerified: true,
		location: 'Đà Nẵng (Remote)',
		city: 'Đà Nẵng',
		workMode: 'Remote',
		salary: 75000,
		salaryFormatted: '$3,000 - $4,500 / tháng',
		isHot: true,
		postedTime: '1 tuần trước',
		description: `Nghiên cứu và phát triển trợ lý ảo AI thông minh, hệ thống gợi ý sản phẩm tự động và tìm kiếm ngữ nghĩa thông minh với RAG (Retrieval-Augmented Generation).

Yêu cầu:
• Thành thạo Python, PyTorch/TensorFlow, LangChain, LlamaIndex, Vector Database.
• Kinh nghiệm fine-tuning mô hình ngôn ngữ mã nguồn mở và tối ưu hóa suy luận (vLLM, TensorRT-LLM).
• Có tư duy giải thuật xuất sắc và khả năng đọc hiểu tài liệu nghiên cứu AI mới nhất.`,
		tags: ['AI', 'LLM', 'Python', 'Machine Learning'],
		skills: ['Python', 'Docker', 'AWS', 'Problem Solving', 'Git'],
		experienceLevel: 'senior',
		status: 'open',
		jobType: 'full-time',
		createdBy: {
			_id: 'user_recruiter_2',
			name: 'Ngô Đình Trí (Shopee HR)',
			email: 'tri.recruiter@shopee.vn'
		},
		applications: [],
		createdAt: '2024-03-07T16:00:00.000Z',
		updatedAt: '2024-03-07T16:00:00.000Z'
	},
	{
		_id: 'job_8',
		title: 'Junior Frontend Developer (Fresher / Internship)',
		company: 'VNG Tech Hub',
		companyInitials: 'VNG',
		companyLogoBg: 'from-blue-600 to-indigo-700',
		companyVerified: true,
		location: 'Hà Nội (Hybrid)',
		city: 'Hà Nội',
		workMode: 'Hybrid',
		salary: 16000,
		salaryFormatted: '$600 - $900 / tháng',
		isHot: false,
		postedTime: '2 tuần trước',
		description: `Vị trí dành cho sinh viên mới tốt nghiệp hoặc lập trình viên fresher đam mê học hỏi cùng đội ngũ kỹ sư kỳ cựu. Được đào tạo bài bản về React, quy trình Agile và tham gia dự án thực tế.`,
		tags: ['React', 'JavaScript', 'Fresher', 'Internship'],
		skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Git', 'Communication'],
		experienceLevel: 'entry',
		status: 'closed',
		jobType: 'internship',
		createdBy: {
			_id: 'user_recruiter_1',
			name: 'Lê Hoàng (Senior Recruiter)',
			email: 'recruiter@demo.com'
		},
		applications: [],
		createdAt: '2024-02-20T10:00:00.000Z',
		updatedAt: '2024-02-20T10:00:00.000Z'
	}
];

// Initial Applications
export const INITIAL_APPLICATIONS = [
	{
		_id: 'app_1',
		jobId: 'job_1',
		applicantId: 'user_seeker_1',
		status: 'pending',
		resume: 'https://example.com/resumes/tran-minh-cv.pdf',
		resumeUrl: 'https://example.com/resumes/tran-minh-cv.pdf',
		createdAt: '2024-03-08T10:00:00.000Z',
		updatedAt: '2024-03-08T10:00:00.000Z'
	},
	{
		_id: 'app_2',
		jobId: 'job_2',
		applicantId: 'user_seeker_1',
		status: 'accepted',
		resume: 'https://example.com/resumes/tran-minh-cv.pdf',
		resumeUrl: 'https://example.com/resumes/tran-minh-cv.pdf',
		createdAt: '2024-03-05T14:20:00.000Z',
		updatedAt: '2024-03-07T09:10:00.000Z'
	},
	{
		_id: 'app_3',
		jobId: 'job_4',
		applicantId: 'user_seeker_1',
		status: 'rejected',
		resume: 'https://example.com/resumes/tran-minh-cv.pdf',
		resumeUrl: 'https://example.com/resumes/tran-minh-cv.pdf',
		createdAt: '2024-02-28T09:15:00.000Z',
		updatedAt: '2024-03-01T15:30:00.000Z'
	},
	{
		_id: 'app_4',
		jobId: 'job_1',
		applicantId: 'user_seeker_2',
		status: 'pending',
		resume: 'https://example.com/resumes/ha-dothu-cv.pdf',
		resumeUrl: 'https://example.com/resumes/ha-dothu-cv.pdf',
		createdAt: '2024-03-09T11:00:00.000Z',
		updatedAt: '2024-03-09T11:00:00.000Z'
	},
	{
		_id: 'app_5',
		jobId: 'job_1',
		applicantId: 'user_seeker_3',
		status: 'accepted',
		resume: 'https://example.com/resumes/bao-pham-backend.pdf',
		resumeUrl: 'https://example.com/resumes/bao-pham-backend.pdf',
		createdAt: '2024-03-06T16:45:00.000Z',
		updatedAt: '2024-03-07T14:00:00.000Z'
	}
];

// In-memory fallback if localStorage is unavailable
const memoryStore = {};
const safeGetItem = (k) => {
	try {
		if (typeof localStorage !== 'undefined') return localStorage.getItem(k);
	} catch (e) {
		console.warn('localStorage read error:', e);
	}
	return memoryStore[k] || null;
};

const safeSetItem = (k, v) => {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(k, v);
			return;
		}
	} catch (e) {
		console.warn('localStorage write error:', e);
	}
	memoryStore[k] = v;
};

// Database Management
export function getDb() {
	try {
		const raw = safeGetItem(STORAGE_KEY);
		if (raw) {
			return JSON.parse(raw);
		}
	} catch (e) {
		console.warn('Could not read mock DB from storage, initializing fresh:', e);
	}

	const initialDb = {
		users: JSON.parse(JSON.stringify(INITIAL_USERS)),
		jobs: JSON.parse(JSON.stringify(INITIAL_JOBS)),
		applications: JSON.parse(JSON.stringify(INITIAL_APPLICATIONS))
	};
	saveDb(initialDb);
	return initialDb;
}

export function saveDb(db) {
	try {
		safeSetItem(STORAGE_KEY, JSON.stringify(db));
	} catch (e) {
		console.error('Failed to save mock DB:', e);
	}
}

export function resetDb() {
	const fresh = {
		users: JSON.parse(JSON.stringify(INITIAL_USERS)),
		jobs: JSON.parse(JSON.stringify(INITIAL_JOBS)),
		applications: JSON.parse(JSON.stringify(INITIAL_APPLICATIONS))
	};
	saveDb(fresh);
	return fresh;
}

// Generate valid JWT string that jwt-decode can parse
export function createMockJwt(user) {
	const header = { alg: 'HS256', typ: 'JWT' };
	const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year expiration
	const payload = {
		_id: user._id,
		id: user._id,
		userId: user._id,
		name: user.name,
		email: user.email,
		role: user.role,
		exp: exp
	};

	const encode = (obj) => {
		try {
			const str = JSON.stringify(obj);
			if (typeof btoa !== 'undefined') {
				return btoa(unescape(encodeURIComponent(str)))
					.replace(/\+/g, '-')
					.replace(/\//g, '_')
					.replace(/=+$/, '');
			}
			if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
				return globalThis.Buffer.from(str).toString('base64url');
			}
			return '';
		} catch {
			try {
				if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
					return globalThis.Buffer.from(JSON.stringify(obj)).toString('base64url');
				}
				return '';
			} catch {
				return '';
			}
		}
	};

	return `${encode(header)}.${encode(payload)}.mock_signature_job_portal`;
}

// Helper to decode user from token
export function getUserFromToken(token) {
	if (!token) return null;
	try {
		const parts = token.split('.');
		if (parts.length >= 2) {
			let json = '';
			if (typeof atob !== 'undefined') {
				json = decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))));
			} else if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
				json = globalThis.Buffer.from(parts[1], 'base64url').toString('utf8');
			}
			const payload = JSON.parse(json);
			const db = getDb();
			return db.users.find(u => u._id === payload._id || u.email === payload.email) || payload;
		}
	} catch (e) {
		console.error('Failed to parse token in mock DB:', e);
	}
	return null;
}

