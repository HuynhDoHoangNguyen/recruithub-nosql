import { getDatabaseConfig } from '../config/database.config.js';
import { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { getAuditDatabaseConfig } from '../config/audit-database.config.js';
import { backupError } from '../models/admin-backup.schema.js';

export class BackupSourceRegistry {
  constructor(env = process.env) { this.env = env; }
  entries() {
    const seen = new Set();
    return [['business', 'Dữ liệu nghiệp vụ', getDatabaseConfig],
      ['identity', 'Tài khoản, nghiệp vụ và tệp đính kèm', getAuthDatabaseConfig],
      ['audit', 'Vết kiểm toán và nhật ký', getAuditDatabaseConfig]].map(([id, label, configure]) => {
      try {
        const config = configure(this.env);
        if (config.database.startsWith('_')) throw new Error('system database');
        const identity = `${new URL(config.url).href}|${config.database}`;
        if (seen.has(identity)) return { id, label, available: false, reason: 'DUPLICATE_SOURCE', scope: 'single_database_current_state' };
        seen.add(identity);
        return { id, label, available: true, reason: null, scope: 'single_database_current_state', config };
      } catch {
        return { id, label, available: false, reason: 'SOURCE_CONFIGURATION_UNAVAILABLE', scope: 'single_database_current_state' };
      }
    });
  }
  list() { return this.entries().map(({ config: _config, ...entry }) => entry); }
  resolve(id) {
    const source = this.entries().find(entry => entry.id === id && entry.available);
    if (!source) throw backupError('BACKUP_CONFIGURATION_ERROR');
    return source.config;
  }
}
