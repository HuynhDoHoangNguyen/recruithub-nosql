import api from '../services/api';

export async function sendSupportChat(message, history, signal) {
  const response = await api.post('/v1/support/chat', { message, history }, { signal, timeout: 20000 });
  const data = response.data?.data;
  if (!['ai', 'jobs'].includes(data?.mode) || typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 6000) {
    throw new Error('Invalid support response');
  }
  if (data.mode === 'jobs' && (!Array.isArray(data.jobs) || data.jobs.length > 5
    || !Array.isArray(data.filter_labels) || data.filter_labels.some(label => typeof label !== 'string')
    || data.jobs.some(job => !/^job:[a-z0-9:_-]+$/i.test(job.id) || typeof job.title !== 'string'
      || !Array.isArray(job.required_skills) || job.required_skills.some(skill => typeof skill !== 'string')
      || !Number.isFinite(Date.parse(job.deadline)))
    || !/^\/jobs(?:\?|$)/.test(data.search_url))) throw new Error('Invalid job search response');
  return data;
}
