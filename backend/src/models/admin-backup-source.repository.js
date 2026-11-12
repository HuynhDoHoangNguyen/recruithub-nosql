import { BACKUP_LIMITS, backupError } from './admin-backup.schema.js';

/** Export-only adapter: no method can write to CouchDB. */
export class BackupSourceReader {
  constructor(config, { request = fetch, limits = BACKUP_LIMITS } = {}) {
    this.config = config; this.request = request; this.limits = limits;
  }
  async read(endpoint, signal) {
    const { url, database, username, password, timeoutMs } = this.config;
    try {
      const response = await this.request(`${url}/${encodeURIComponent(database)}${endpoint}`, {
        method: 'GET', redirect: 'error',
        headers: { Accept: 'application/json', ...(username ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` } : {}) },
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs || 5000)]),
      });
      if (!response.ok) throw backupError('DATABASE_UNAVAILABLE');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > this.limits.record) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error?.code === 'BACKUP_LIMIT_EXCEEDED') throw error;
      throw backupError('DATABASE_UNAVAILABLE');
    }
  }
  metadata(signal) { return this.read('', signal); }
  indexes(signal) { return this.read('/_index', signal); }
  async *documents(signal) {
    let after;
    while (true) {
      const query = new URLSearchParams({ limit: String(this.limits.page) });
      if (after !== undefined) { query.set('startkey', JSON.stringify(after)); query.set('skip', '1'); }
      const page = await this.read(`/_all_docs?${query}`, signal);
      if (!Array.isArray(page.rows)) throw backupError('INVALID_BACKUP', 400);
      for (const row of page.rows) {
        if (!row.id || !row.value?.rev || row.value.deleted || row.id.startsWith('_local/')) throw backupError('INVALID_BACKUP', 400);
        const params = new URLSearchParams({ rev: row.value.rev, attachments: 'true', conflicts: 'true', deleted_conflicts: 'true' });
        const documentPath = row.id.startsWith('_design/') ? `_design/${encodeURIComponent(row.id.slice(8))}` : encodeURIComponent(row.id);
        const doc = await this.read(`/${documentPath}?${params}`, signal);
        if (doc._id !== row.id || doc._rev !== row.value.rev) throw backupError('SOURCE_CHANGED', 409);
        yield doc;
      }
      if (page.rows.length < this.limits.page) break;
      const next = page.rows.at(-1).id;
      if (next === after) throw backupError('INVALID_BACKUP', 400);
      after = next;
    }
  }
}
