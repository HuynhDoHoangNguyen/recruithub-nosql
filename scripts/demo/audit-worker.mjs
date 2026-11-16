import { loadBackendEnvironment } from '../../backend/src/config/load-environment.js';
import { getAuditDatabaseConfig } from '../../backend/src/config/audit-database.config.js';
import { createAuditSource } from '../../backend/src/repositories/job-application-audit-source.repository.js';
import { AuditEventRepository } from '../../backend/src/repositories/audit-event.repository.js';
import { AuditDeliveryService } from '../../backend/src/services/audit-delivery.service.js';

loadBackendEnvironment();
const worker = new AuditDeliveryService({ source: createAuditSource(process.env),
  sink: new AuditEventRepository(getAuditDatabaseConfig()), fallback: record => process.stderr.write(JSON.stringify(record) + '\n') });
const once = process.argv.includes('--once');
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
do {
  const result = await worker.runBatch({ limit: 100 });
  if (once || Object.values(result).some(value => typeof value === 'number' && value > 0)) console.log(JSON.stringify(result));
  if (!once && !stopped) await new Promise(resolve => setTimeout(resolve, 2000));
} while (!once && !stopped);
