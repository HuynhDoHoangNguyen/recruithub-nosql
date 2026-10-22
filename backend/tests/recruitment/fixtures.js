import { createHmac, randomBytes } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { ApiError } from '../../src/middleware/job-application.middleware.js';
import { userIdFromEmail } from '../../src/utils/id.utils.js';
import { interviewIdFromRound } from '../../src/utils/interview-validation.utils.js';

export const baseTime = '2026-10-22T12:00:00.000Z';
const provenance = { classification: 'derived', generated: false, transform_version: 'test-fixture' };
export const jobInput = { title: 'Kỹ sư Backend', seniority: 'MID', industry: 'SaaS', description: 'Phát triển hệ thống tuyển dụng.',
  responsibilities: ['Xây dựng API'], requirements: { general: ['Hiểu NoSQL'], experience: { status: 'NO_MINIMUM' },
    education: { status: 'NO_MINIMUM' }, project: { status: 'NO_REQUIREMENT' } },
  required_skills: ['JavaScript', 'CouchDB'], optional_skills: ['Docker'], status: 'OPEN', deadline: '2026-10-30T12:00:00.000Z' };

function user(name, role) {
  const email = `${name}@example.invalid`;
  return { _id: userIdFromEmail(email), type: 'user', email, email_normalized: email, role, account_status: 'ACTIVE',
    password_hash: 'test-only-not-a-login-credential-hash', created_at: baseTime, updated_at: baseTime, provenance };
}

export class MemoryRepository {
  constructor(docs) { this.docs = new Map(docs.map(doc => [doc._id, { ...structuredClone(doc), _rev: '1-fixture' }])); this.writes = []; }
  async get(id) { return structuredClone(this.docs.get(id) || null); }
  async put(doc) {
    if (this.beforePut) await this.beforePut(doc);
    const existing = this.docs.get(doc._id);
    if ((existing && existing._rev !== doc._rev) || (!existing && doc._rev)) throw new ApiError(409, 'CONFLICT', 'Dữ liệu đã thay đổi.');
    const saved = { ...structuredClone(doc), _rev: `${existing ? Number(existing._rev.split('-')[0]) + 1 : 1}-fixture` };
    this.docs.set(doc._id, saved); this.writes.push(structuredClone(saved));
    return structuredClone(saved);
  }
  async profile(type, userId) {
    const values = [...this.docs.values()].filter(doc => doc.type === type && doc.user_id === userId);
    if (values.length !== 1) throw new ApiError(403, 'PROFILE_REQUIRED', 'Hồ sơ chưa được thiết lập.');
    return structuredClone(values[0]);
  }
  async find(selector, { limit = 20, bookmark, sort = [] } = {}) {
    const values = [...this.docs.values()].filter(doc => Object.entries(selector).every(([key, value]) =>
      typeof value === 'object' ? doc[key] >= value.$gte : doc[key] === value));
    values.sort((a, b) => {
      for (const entry of sort) {
        const [field, direction] = Object.entries(entry)[0];
        const diff = String(a[field]).localeCompare(String(b[field]));
        if (diff) return direction === 'desc' ? -diff : diff;
      }
      return a._id.localeCompare(b._id);
    });
    const offset = Number(bookmark || 0);
    return { items: structuredClone(values.slice(offset, offset + limit)), bookmark: String(offset + limit), has_more: offset + limit < values.length };
  }
  async allInterviews(id) { return structuredClone([...this.docs.values()].filter(doc => doc.type === 'interview' && doc.application_id === id)); }
  async stats(id) {
    const jobs = [...this.docs.values()].filter(doc => doc.type === 'job' && doc.recruiter_id === id);
    const apps = [...this.docs.values()].filter(doc => doc.type === 'application' && jobs.some(job => job._id === doc.job_id));
    const counts = (items, field) => items.reduce((result, item) => ({ ...result, [item[field]]: (result[item[field]] || 0) + 1 }), {});
    return { jobs: counts(jobs, 'status'), applications: counts(apps, 'current_stage'), total_applications: apps.length };
  }
}

export function createFixture() {
  const users = { candidate: user('candidate-one', 'CANDIDATE'), otherCandidate: user('candidate-two', 'CANDIDATE'),
    recruiter: user('recruiter-one', 'RECRUITER'), otherRecruiter: user('recruiter-two', 'RECRUITER'), admin: user('admin-test', 'ADMIN') };
  const company = { _id: 'company:test', type: 'company', name: 'Công ty kiểm thử', industry: 'SaaS', created_at: baseTime, updated_at: baseTime, provenance };
  const department = { _id: 'department:test', type: 'department', company_id: company._id, name: 'Kỹ thuật', key: 'engineering', created_at: baseTime, updated_at: baseTime, provenance };
  const recruiter = { _id: 'recruiter:one', type: 'recruiter', user_id: users.recruiter._id, company_id: company._id,
    department_id: department._id, created_at: baseTime, updated_at: baseTime, provenance };
  const otherRecruiter = { ...recruiter, _id: 'recruiter:two', user_id: users.otherRecruiter._id };
  const candidate = { _id: 'candidate:one', type: 'candidate', user_id: users.candidate._id,
    profile: { role: 'Backend Engineer', seniority: 'MID', industry: 'SaaS', years_experience: 2, experience_months: 24 },
    skills: [{ name: 'JavaScript', normalized: 'javascript' }], education: [], experience: [], projects: [],
    data_availability: { skills: 'AVAILABLE', experience: 'PARTIAL', education: 'UNAVAILABLE', projects: 'UNAVAILABLE' },
    created_at: baseTime, updated_at: baseTime, provenance };
  const otherCandidate = { ...candidate, _id: 'candidate:two', user_id: users.otherCandidate._id };
  const job = { ...structuredClone(jobInput), required_skills: ['javascript', 'couchdb'], optional_skills: ['docker'],
    _id: 'job:one', type: 'job', recruiter_id: recruiter._id, company_id: company._id, department_id: department._id,
    created_at: baseTime, updated_at: baseTime, published_at: baseTime, provenance };
  const otherJob = { ...job, _id: 'job:two', recruiter_id: otherRecruiter._id };
  const repo = new MemoryRepository([...Object.values(users), company, department, recruiter, otherRecruiter, candidate, otherCandidate, job, otherJob]);
  const clock = { time: Date.parse(baseTime) };
  return { repo, users, candidate, recruiter, job, otherJob, now: () => new Date(clock.time), clock };
}

export function signToken(env, userDoc, overrides = {}, headerOverrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...headerOverrides })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ sub: userDoc._id, role: userDoc.role, exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })).toString('base64url');
  return `${header}.${claims}.${createHmac('sha256', env.JWT_SECRET).update(`${header}.${claims}`).digest('base64url')}`;
}
export async function startFixture(t, options = {}) {
  const fixture = createFixture();
  const jwtEnv = { JWT_SECRET: randomBytes(48).toString('base64url'), JWT_ALGORITHM: 'HS256', ...options.jwtEnv };
  const app = createApp({ ...options, repository: fixture.repo, now: fixture.now, jwtEnv });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  async function request(method, path, payload, who = 'candidate', tokenOverride) {
    const token = tokenOverride ?? (who ? signToken(jwtEnv, fixture.users[who]) : null);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, { method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    return { status: response.status, body: await response.json() };
  }
  return { ...fixture, request, jwtEnv };
}
export const submission = { resume_text: 'Tôi xây dựng API với JavaScript và CouchDB.', cover_letter: 'Kính gửi bộ phận tuyển dụng.' };
export const mutation = (app, action = {}) => ({ expected_rev: app._rev, expected_stage: app.current_stage, ...action });
export function interviewFor(application, recruiter, { round = 1, completed = true, result = 'PASSED' } = {}) {
  const timestamp = application.stage_history.find(event => event.to_stage === 'INTERVIEW').timestamp;
  return { _id: interviewIdFromRound(application._id, round), type: 'interview', application_id: application._id, candidate_id: application.candidate_id,
    job_id: application.job_id, interviewer_id: recruiter._id, round, interview_type: 'TECHNICAL', scheduled_at: timestamp,
    ...(completed ? { completed_at: timestamp, result, score: 80 } : {}), created_at: timestamp, updated_at: timestamp, provenance };
}
export async function apply(fixture) {
  return fixture.request('POST', '/applications', { job_id: fixture.job._id, submission });
}
export async function advance(fixture, application, toStage, extra = {}) {
  fixture.clock.time += 60000;
  return fixture.request('PATCH', `/applications/${encodeURIComponent(application._id)}/stage`, mutation(application, { to_stage: toStage, ...extra }), 'recruiter');
}
