import { getAuditDatabaseConfig } from '../../backend/src/config/audit-database.config.js';
import { AuditEventRepository } from '../../backend/src/repositories/audit-event.repository.js';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--dry-run', '--apply'].includes(args[0]))) {
    throw new Error('Usage: node scripts/database/prune-audit-events.mjs [--dry-run|--apply]');
  }
  const config = getAuditDatabaseConfig();
  const dryRun = args[0] !== '--apply';
  const results = await new AuditEventRepository(config).prune({ dryRun });
  console.log(JSON.stringify({ database: config.database, dry_run: dryRun, results }));
  if (Object.values(results).some(result => result.errors)) process.exitCode = 1;
} catch (error) {
  console.error(error.code || error.message);
  process.exitCode = 1;
}
