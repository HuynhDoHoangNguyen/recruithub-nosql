import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { isPublicJobsMockMode, listPublicJobs } from '../services/publicJobsApi';
import jobSearchImage from '../assets/jobSearch.png';

const Landing = () => {
	const [query, setQuery] = useState('');
	const [latestJobs, setLatestJobs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const navigate = useNavigate();

	useEffect(() => {
		let active = true;
		listPublicJobs({ pageSize: 3, sort: 'newest' })
			.then((result) => { if (active) setLatestJobs(result.jobs); })
			.catch((requestError) => { if (active) setError(requestError.message || 'Could not load public jobs.'); })
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, []);

	const handleSearch = () => {
		if (query.trim()) navigate(`/jobs?q=${encodeURIComponent(query)}`);
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
			{/* Hero Section */}
			<section className="relative overflow-hidden">
				{/* Background Pattern */}
				<div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-blue-800/5"></div>
				<div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full -translate-y-48 translate-x-48 opacity-20"></div>
				<div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-200 rounded-full translate-y-40 -translate-x-40 opacity-20"></div>
				
				<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
					<div className="grid lg:grid-cols-2 gap-12 items-center">
						{/* Left Content */}
						<div className="text-center lg:text-left space-y-8 animate-fade-in">
							<div className="space-y-6">
								<h1 className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">Find Your<span className="block bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Dream Job</span></h1>
								<p className="text-xl text-gray-600 max-w-2xl">Connect with opportunities that match your skills and aspirations.</p>
							</div>
							<form className="flex flex-col sm:flex-row gap-3" onSubmit={(event) => { event.preventDefault(); handleSearch(); }}>
								<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs by title, company, or skill" className="input-field flex-1" aria-label="Search public jobs" />
								<button className="btn-primary" type="submit">Search Jobs</button>
							</form>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"><Link to="/register" className="btn-primary text-lg px-8 py-4">Get Started Free</Link><Link to="/login" className="btn-secondary text-lg px-8 py-4">Sign In</Link></div>
						</div>
						{/* Right Image */}
						<div className="flex justify-center lg:justify-end">
							<div className="relative">
								<div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl transform rotate-6 opacity-20"></div>
								<img
									src={jobSearchImage}
									alt="Job search illustration"
									className="relative w-full max-w-lg rounded-3xl shadow-2xl animate-fade-in"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Latest public jobs */}
			<section className="py-16 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					{isPublicJobsMockMode && <p className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Development fixture preview. TV2 public jobs API integration is pending.</p>}
					{error && <p role="alert" className="message-error mb-5">{error}</p>}
					<div className="text-center mb-10"><h2 className="text-4xl font-bold text-gray-900 mb-3">Latest Opportunities</h2><p className="text-lg text-gray-600">Only open job fixtures appear in this development preview.</p></div>
					{loading ? <p role="status" className="py-10 text-center text-blue-700">Loading jobs...</p> : latestJobs.length === 0 ? <p className="py-10 text-center text-gray-500">No public jobs are available.</p> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{latestJobs.map((job) => <Link key={job.id} to={'/jobs/' + encodeURIComponent(job.id)} className="card card-hover p-6"><span className="text-xs font-semibold text-green-700">OPEN</span><h3 className="mt-2 text-xl font-semibold text-gray-900">{job.title}</h3><p className="mt-1 text-gray-600">{job.company.name} ? {job.industry}</p><p className="mt-3 line-clamp-2 text-sm text-gray-700">{job.description}</p><p className="mt-3 text-xs text-gray-500">{job.seniority} ? {new Date(job.createdAt).toLocaleDateString('vi-VN')}</p></Link>)}</div>}
					<div className="mt-8 text-center"><Link to="/jobs" className="btn-secondary">View all jobs</Link></div>
				</div>
			</section>

			{/* Features */}
			<section className="py-20 bg-gradient-to-br from-blue-50 to-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-4xl font-bold text-gray-900 mb-4">
							Why Choose JobPortal?
						</h2>
						<p className="text-xl text-gray-600 max-w-3xl mx-auto">
							We provide the tools and platform you need to succeed in your career journey
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-3">
						{[
							{ 
								title: 'For Job Seekers', 
								text: 'Discover top job opportunities, apply effortlessly, and track your progress in real time.',
								icon: '👤'
							},
							{ 
								title: 'For Recruiters', 
								text: 'Post jobs, filter candidates, and streamline your hiring process with ease.',
								icon: '🏢'
							},
							{ 
								title: 'Smart Dashboards', 
								text: 'Get a personalized dashboard whether you are an applicant, recruiter, or admin.',
								icon: '📊'
							}
						].map(({ title, text, icon }) => (
							<div key={title} className="card p-8 text-center group">
								<div className="text-4xl mb-4">{icon}</div>
								<h3 className="text-2xl font-semibold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">
									{title}
								</h3>
								<p className="text-gray-600 leading-relaxed">{text}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="bg-gray-900 text-white py-16">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
						{/* Company Info */}
						<div className="md:col-span-2">
							<div className="flex items-center mb-6">
								<div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg">
									<span className="text-white font-bold text-lg">J</span>
								</div>
								<span className="ml-3 text-2xl font-bold">JobPortal</span>
							</div>
							<p className="text-gray-400 mb-6 max-w-md">
								Connecting talented professionals with amazing opportunities. Your career journey starts here.
							</p>
							<div className="flex space-x-4">
								{['facebook', 'twitter', 'linkedin', 'instagram'].map((social) => (
									<a
										key={social}
										href="#"
										className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
									>
										<span className="sr-only">{social}</span>
										<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" clipRule="evenodd" />
										</svg>
									</a>
								))}
							</div>
						</div>

						{/* Quick Links */}
						<div>
							<h3 className="text-lg font-semibold mb-4">Quick Links</h3>
							<ul className="space-y-2">
								{['About Us', 'Careers', 'Help Center', 'Contact'].map((link) => (
									<li key={link}>
										<Link to="#" className="text-gray-400 hover:text-white transition-colors">
											{link}
										</Link>
									</li>
								))}
							</ul>
						</div>

						{/* Legal */}
						<div>
							<h3 className="text-lg font-semibold mb-4">Legal</h3>
							<ul className="space-y-2">
								{['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'].map((link) => (
									<li key={link}>
										<Link to="#" className="text-gray-400 hover:text-white transition-colors">
											{link}
										</Link>
									</li>
								))}
							</ul>
						</div>
					</div>

					<div className="border-t border-gray-800 mt-12 pt-8 text-center">
						<p className="text-gray-400">
							© 2024 JobPortal. All rights reserved.
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
};

export default Landing;
