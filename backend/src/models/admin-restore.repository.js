import { backupError, BACKUP_LIMITS } from './admin-backup.schema.js';
import { assertTarget } from './admin-restore.schema.js';
import { BackupSourceReader } from './admin-backup-source.repository.js';

export const PRIVATE_SECURITY = Object.freeze({ admins: { names: [], roles: ['_admin'] }, members: { names: [], roles: ['_admin'] } });
export function isPrivateSecurity(security) {
  if (!security || typeof security !== 'object') return false;
  return ['admins', 'members'].every(key => {
    const names = security[key]?.names ?? [], roles = security[key]?.roles ?? [];
    return Array.isArray(names) && names.length === 0 && Array.isArray(roles)
      && (key === 'admins' && roles.length === 0 || roles.length === 1 && roles[0] === '_admin');
  });
}

export class RestoreRepository {
  constructor(config, target, { env = process.env, request = fetch, limits = BACKUP_LIMITS } = {}) {
    assertTarget(target, env);
    this.config = { ...config, database: target }; this.target = target; this.request = request; this.limits = limits;
    this.creationAttempted = false; this.created = false;
  }
  async http(method, endpoint, signal, body, allow404 = false) {
    try {
      const { url, username, password, timeoutMs } = this.config;
      const response = await this.request(`${url}${endpoint}`, { method, redirect: 'error',
        headers: { Accept: 'application/json', ...(username ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs || 5000)]),
      });
      if (allow404 && response.status === 404) return null;
      if ([409, 412].includes(response.status)) throw backupError('TARGET_EXISTS', 409);
      if (!response.ok) throw backupError('DATABASE_UNAVAILABLE');
      if (method === 'HEAD') return true;
      let bytes = 0; const chunks = [];
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > this.limits.record) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (['TARGET_EXISTS', 'BACKUP_LIMIT_EXCEEDED'].includes(error?.code)) throw error;
      throw backupError('DATABASE_UNAVAILABLE');
    }
  }
  endpoint(suffix = '') { return `/${encodeURIComponent(this.target)}${suffix}`; }
  async createPrivate(signal) {
    // Confirm all nodes create private databases BEFORE creating any target.
    const session = await this.http('GET', '/_session', signal);
    if (!session.userCtx?.roles?.includes('_admin')) throw backupError('RESTORE_SECURITY_ERROR');
    const server = await this.http('GET', '/', signal);
    if (!/^3\./.test(server.version || '')) throw backupError('RESTORE_SECURITY_ERROR');
    const membership = await this.http('GET', '/_membership', signal);
    if (!membership.all_nodes?.length || !membership.cluster_nodes?.length
      || membership.all_nodes.some(node => !membership.cluster_nodes.includes(node))) throw backupError('RESTORE_SECURITY_ERROR');
    for (const node of membership.all_nodes) {
      const settings = await this.http('GET', `/_node/${encodeURIComponent(node)}/_config/couchdb`, signal);
      // Unset default_security uses CouchDB 3's documented admin_only default.
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)
        || (settings.default_security !== undefined && settings.default_security !== 'admin_only')) throw backupError('RESTORE_SECURITY_ERROR');
    }
    if (await this.http('HEAD', this.endpoint(), signal, undefined, true)) throw backupError('TARGET_EXISTS', 409);
    this.creationAttempted = true;
    const result = await this.http('PUT', this.endpoint('?partitioned=false'), signal);
    if (result.ok !== true) throw backupError('DATABASE_UNAVAILABLE');
    this.created = true;
    if (!isPrivateSecurity(await this.http('GET', this.endpoint('/_security'), signal))) throw backupError('RESTORE_SECURITY_ERROR');
    await this.http('PUT', this.endpoint('/_security'), signal, PRIVATE_SECURITY);
    await this.assertPrivate(signal);
  }
  assertCreated() { if (!this.created) throw backupError('RESTORE_SECURITY_ERROR'); }
  async assertPrivate(signal) {
    this.assertCreated();
    if (!isPrivateSecurity(await this.http('GET', this.endpoint('/_security'), signal))) throw backupError('RESTORE_SECURITY_ERROR');
  }
  async bulk(docs, signal) { this.assertCreated(); return this.http('POST', this.endpoint('/_bulk_docs'), signal, { docs, new_edits: true }); }
  async get(id, signal) {
    this.assertCreated();
    const documentPath = id.startsWith('_design/') ? `_design/${encodeURIComponent(id.slice(8))}` : encodeURIComponent(id);
    return this.http('GET', this.endpoint(`/${documentPath}?attachments=true&conflicts=true`), signal, undefined, true);
  }
  async indexes(signal) { this.assertCreated(); return this.http('GET', this.endpoint('/_index'), signal); }
  async createIndex(index, signal) {
    this.assertCreated();
    return this.http('POST', this.endpoint('/_index'), signal, { name: index.name, ddoc: index.ddoc.replace(/^_design\//, ''),
      type: 'json', index: index.index, partitioned: false });
  }
  reader() { this.assertCreated(); return new BackupSourceReader(this.config, { request: this.request, limits: this.limits }); }
}
