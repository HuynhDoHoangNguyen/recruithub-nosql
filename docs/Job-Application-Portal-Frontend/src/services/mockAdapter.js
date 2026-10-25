// src/services/mockAdapter.js
import {
	getDb,
	saveDb,
	createMockJwt,
	getUserFromToken
} from './mockData.js';

// Simulated network delay (ms) for realistic UX transitions
const NETWORK_DELAY = 120;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockAxiosAdapter(config) {
	await delay(NETWORK_DELAY);

	const method = (config.method || 'get').toLowerCase();
	// Normalize URL: remove origin / baseURL if present
	let url = config.url || '';
	url = url.replace(/^https?:\/\/[^/]+/, '');
	url = url.replace(/^\/api/, ''); // remove prefix /api if exists

	// Split pathname and search query
	const [pathname, queryString] = url.split('?');
	const queryParams = new URLSearchParams(queryString || '');

	// Extract token from Authorization header or localStorage
	const authHeader = config.headers?.Authorization || config.headers?.authorization;
	let token = null;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		token = authHeader.substring(7);
	}
	if (!token) {
		try {
			if (typeof localStorage !== 'undefined') {
				token = localStorage.getItem('accessToken');
			}
		} catch {
			// ignore storage access error
		}
	}
	const currentUser = getUserFromToken(token);

	// Parse body data
	let body = {};
	if (config.data) {
		try {
			body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
		} catch {
			body = config.data;
		}
	}

	const db = getDb();

	// --- 1. AUTH ROUTES ---
	if (method === 'post' && pathname === '/auth/login') {
		const email = body.email?.trim().toLowerCase();
		const password = body.password;

		// Match existing user or create on-the-fly for any test email
		let user = db.users.find(u => u.email.toLowerCase() === email);
		if (!user) {
			// Auto create test user if unknown email entered
			const role = email.includes('admin') ? 'admin' : (email.includes('recruit') ? 'recruiter' : 'job-seeker');
			user = {
				_id: 'user_' + Date.now(),
				name: email.split('@')[0],
				email: email,
				password: password || '123456',
				role: role,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				skills: [],
				education: [],
				projects: []
			};
			db.users.push(user);
			saveDb(db);
		}

		const accessToken = createMockJwt(user);
		return createResponse({
			accessToken,
			refreshToken: 'mock_refresh_token_' + user._id,
			user
		}, config);
	}

	if (method === 'post' && pathname === '/auth/register') {
		const { name, email, password, role } = body;
		const normalizedEmail = email?.trim().toLowerCase();

		let user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
		if (user) {
			// Already exists, just return token for easy testing
			const accessToken = createMockJwt(user);
			return createResponse({ accessToken, user }, config);
		}

		user = {
			_id: 'user_' + Date.now(),
			name: name || 'Người dùng mới',
			email: normalizedEmail,
			password: password,
			role: role || 'job-seeker',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			skills: ['JavaScript', 'React'],
			education: [],
			projects: [],
			internships: [],
			certifications: [],
			awards: [],
			clubs: []
		};
		db.users.push(user);
		saveDb(db);

		const accessToken = createMockJwt(user);
		return createResponse({ accessToken, user }, config);
	}

	if (method === 'post' && (pathname === '/auth/logout' || pathname === '/logout')) {
		return createResponse({ message: 'Logged out successfully' }, config);
	}

	if (method === 'post' && pathname === '/auth/refresh') {
		const user = currentUser || db.users[2];
		return createResponse({ accessToken: createMockJwt(user) }, config);
	}

	// --- 2. USER ROUTES ---
	if (method === 'get' && pathname === '/users/me') {
		const user = currentUser || db.users.find(u => u.role === 'job-seeker') || db.users[0];
		return createResponse(user, config);
	}

	if (method === 'put' && pathname === '/users/me') {
		const userId = currentUser?._id;
		const userIndex = db.users.findIndex(u => u._id === userId || u.email === currentUser?.email);
		if (userIndex !== -1) {
			db.users[userIndex] = {
				...db.users[userIndex],
				...body,
				updatedAt: new Date().toISOString()
			};
			saveDb(db);
			return createResponse(db.users[userIndex], config);
		}
		return createResponse(body, config);
	}

	// --- 3. JOB ROUTES ---
	if (method === 'get' && pathname === '/jobs/recent') {
		const limit = parseInt(queryParams.get('limit') || '6', 10);
		const recentJobs = db.jobs.slice(0, limit);
		return createResponse({ jobs: recentJobs }, config);
	}

	if (method === 'get' && pathname === '/jobs/all') {
		const search = (queryParams.get('q') || '').toLowerCase().trim();
		let result = [...db.jobs];
		if (search) {
			result = result.filter(j =>
				j.title?.toLowerCase().includes(search) ||
				j.company?.toLowerCase().includes(search) ||
				j.location?.toLowerCase().includes(search) ||
				j.skills?.some(s => s.toLowerCase().includes(search)) ||
				j.tags?.some(t => t.toLowerCase().includes(search))
			);
		}
		return createResponse(result, config);
	}

	if (method === 'get' && pathname === '/jobs/myjobs') {
		const userId = currentUser?._id;
		const userEmail = currentUser?.email;
		let recruiterJobs = db.jobs.filter(j =>
			(j.createdBy?._id && j.createdBy._id === userId) ||
			(j.createdBy?.email && j.createdBy.email === userEmail)
		);
		// If recruiter hasn't created any yet, show recruiter_1's jobs so page isn't empty
		if (recruiterJobs.length === 0) {
			recruiterJobs = db.jobs.filter(j => j.createdBy?._id === 'user_recruiter_1');
		}
		return createResponse(recruiterJobs, config);
	}

	// GET /jobs/:id
	const jobDetailsMatch = pathname.match(/^\/jobs\/([^/]+)$/);
	if (method === 'get' && jobDetailsMatch) {
		const jobId = jobDetailsMatch[1];
		const job = db.jobs.find(j => j._id === jobId);
		if (job) {
			return createResponse(job, config);
		}
		return createErrorResponse('Job not found', 404, config);
	}

	if (method === 'post' && pathname === '/jobs/create') {
		const newJob = {
			_id: 'job_' + Date.now(),
			...body,
			createdBy: {
				_id: currentUser?._id || 'user_recruiter_1',
				name: currentUser?.name || 'Recruiter',
				email: currentUser?.email || 'recruiter@demo.com'
			},
			applications: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		db.jobs.unshift(newJob);
		saveDb(db);
		return createResponse({ message: 'Job created successfully', job: newJob }, config);
	}

	// PUT /jobs/:id/status
	const jobStatusMatch = pathname.match(/^\/jobs\/([^/]+)\/status$/);
	if (method === 'put' && jobStatusMatch) {
		const jobId = jobStatusMatch[1];
		const job = db.jobs.find(j => j._id === jobId);
		if (job) {
			job.status = body.status;
			job.updatedAt = new Date().toISOString();
			saveDb(db);
			return createResponse(job, config);
		}
		return createErrorResponse('Job not found', 404, config);
	}

	// PUT /jobs/:id
	if (method === 'put' && jobDetailsMatch) {
		const jobId = jobDetailsMatch[1];
		const jobIndex = db.jobs.findIndex(j => j._id === jobId);
		if (jobIndex !== -1) {
			db.jobs[jobIndex] = {
				...db.jobs[jobIndex],
				...body,
				updatedAt: new Date().toISOString()
			};
			saveDb(db);
			return createResponse(db.jobs[jobIndex], config);
		}
		return createErrorResponse('Job not found', 404, config);
	}

	// DELETE /jobs/:id
	if (method === 'delete' && jobDetailsMatch) {
		const jobId = jobDetailsMatch[1];
		db.jobs = db.jobs.filter(j => j._id !== jobId);
		db.applications = db.applications.filter(a => a.jobId !== jobId);
		saveDb(db);
		return createResponse({ message: 'Job deleted successfully' }, config);
	}

	// --- 4. APPLICATION (APPLY) ROUTES ---
	// GET /apply/:id/status
	const applyStatusMatch = pathname.match(/^\/apply\/([^/]+)\/status$/);
	if (method === 'get' && applyStatusMatch) {
		const jobId = applyStatusMatch[1];
		const userId = currentUser?._id || 'user_seeker_1';
		const app = db.applications.find(a => a.jobId === jobId && a.applicantId === userId);
		if (app) {
			return createResponse({
				applied: true,
				status: app.status,
				applicationId: app._id
			}, config);
		}
		return createResponse({
			applied: false,
			status: null,
			applicationId: null
		}, config);
	}

	// GET /apply/:jobId/applications (Recruiter view applicants)
	const jobApplicantsMatch = pathname.match(/^\/apply\/([^/]+)\/applications$/);
	if (method === 'get' && jobApplicantsMatch) {
		const jobId = jobApplicantsMatch[1];
		const apps = db.applications
			.filter(a => a.jobId === jobId)
			.map(a => {
				const applicant = db.users.find(u => u._id === a.applicantId) || {
					name: 'Ứng viên tiềm năng',
					email: 'candidate@example.com'
				};
				return {
					...a,
					resume: a.resume || a.resumeUrl || 'https://example.com/resume.pdf',
					applicant: {
						_id: applicant._id,
						name: applicant.name,
						email: applicant.email
					}
				};
			});
		return createResponse(apps, config);
	}

	// GET /apply/my (Job seeker view applied jobs)
	if (method === 'get' && pathname === '/apply/my') {
		const userId = currentUser?._id || 'user_seeker_1';
		const myApps = db.applications
			.filter(a => a.applicantId === userId)
			.map(a => {
				const job = db.jobs.find(j => j._id === a.jobId);
				return {
					...a,
					job: job || null
				};
			});
		return createResponse(myApps, config);
	}

	// POST /apply/:jobId (Submit application)
	const applyJobMatch = pathname.match(/^\/apply\/([^/]+)$/);
	if (method === 'post' && applyJobMatch) {
		const jobId = applyJobMatch[1];
		const userId = currentUser?._id || 'user_seeker_1';

		let app = db.applications.find(a => a.jobId === jobId && a.applicantId === userId);
		if (!app) {
			app = {
				_id: 'app_' + Date.now(),
				jobId: jobId,
				applicantId: userId,
				status: 'pending',
				resume: body.resumeUrl || 'https://example.com/my-resume.pdf',
				resumeUrl: body.resumeUrl || 'https://example.com/my-resume.pdf',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			db.applications.unshift(app);

			// Link into job
			const job = db.jobs.find(j => j._id === jobId);
			if (job && !job.applications?.includes(app._id)) {
				job.applications = job.applications || [];
				job.applications.push(app._id);
			}

			saveDb(db);
		}

		return createResponse({
			message: 'Applied successfully',
			application: app
		}, config);
	}

	// PUT /apply/:applicationId/status (Recruiter accept/reject)
	const updateAppStatusMatch = pathname.match(/^\/apply\/([^/]+)\/status$/);
	if (method === 'put' && updateAppStatusMatch) {
		const applicationId = updateAppStatusMatch[1];
		const app = db.applications.find(a => a._id === applicationId);
		if (app) {
			app.status = body.status;
			app.updatedAt = new Date().toISOString();
			saveDb(db);
			return createResponse(app, config);
		}
		return createErrorResponse('Application not found', 404, config);
	}

	// DELETE /apply/:applicationId (Withdraw application)
	if (method === 'delete' && applyJobMatch) {
		const applicationId = applyJobMatch[1];
		db.applications = db.applications.filter(a => a._id !== applicationId);
		// Also clean up in jobs
		db.jobs.forEach(j => {
			if (j.applications) {
				j.applications = j.applications.filter(id => id !== applicationId);
			}
		});
		saveDb(db);
		return createResponse({ message: 'Application withdrawn successfully' }, config);
	}

	// --- 5. ADMIN ROUTES ---
	if (method === 'get' && pathname === '/admin/stats') {
		const stats = {
			totalUsers: db.users.length,
			totalJobs: db.jobs.length,
			totalApplications: db.applications.length
		};
		return createResponse({ stats }, config);
	}

	if (method === 'get' && pathname === '/admin/users') {
		return createResponse(db.users, config);
	}

	if (method === 'get' && pathname === '/admin/jobs') {
		return createResponse(db.jobs, config);
	}

	const adminDeleteUserMatch = pathname.match(/^\/admin\/users\/([^/]+)$/);
	if (method === 'delete' && adminDeleteUserMatch) {
		const id = adminDeleteUserMatch[1];
		db.users = db.users.filter(u => u._id !== id);
		saveDb(db);
		return createResponse({ message: 'User deleted successfully' }, config);
	}

	const adminDeleteJobMatch = pathname.match(/^\/admin\/jobs\/([^/]+)$/);
	if (method === 'delete' && adminDeleteJobMatch) {
		const id = adminDeleteJobMatch[1];
		db.jobs = db.jobs.filter(j => j._id !== id);
		db.applications = db.applications.filter(a => a.jobId !== id);
		saveDb(db);
		return createResponse({ message: 'Job deleted successfully' }, config);
	}

	// Fallback for unhandled endpoints
	console.warn(`[Mock API] Unhandled request: ${method.toUpperCase()} ${url}`);
	return createResponse({ message: 'OK (Mock)', data: [] }, config);
}

function createResponse(data, config, status = 200) {
	return {
		data,
		status,
		statusText: 'OK',
		headers: { 'content-type': 'application/json' },
		config,
		request: {}
	};
}

function createErrorResponse(message, status = 400, config) {
	const error = new Error(message);
	error.response = {
		data: { message, error: message },
		status,
		statusText: status === 404 ? 'Not Found' : 'Bad Request',
		headers: { 'content-type': 'application/json' },
		config
	};
	return Promise.reject(error);
}
