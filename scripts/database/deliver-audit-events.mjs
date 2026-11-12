import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAuditDatabaseConfig } from '../../backend/src/config/audit-database.config.js';
import { AuditEventRepository } from '../../backend/src/repositories/audit-event.repository.js';
import { AuditDeliveryService } from '../../backend/src/services/audit-delivery.service.js';

const [adapterPath, batchSize, ...extra] = process.argv.slice(2);
const limit = batchSize === undefined ? 50 : Number(batchSize);
if (!adapterPath || extra.length || !Number.isInteger(limit) || limit < 1 || limit > 100) {
  console.error('Usage: node scripts/database/deliver-audit-events.mjs <source-adapter-module> [batch-size]');
  process.exitCode = 1;
} else {
  try {
    const config = getAuditDatabaseConfig();
    const { createAuditSource } = await import(pathToFileURL(resolve(adapterPath)).href);
    const source = await createAuditSource(process.env);
    const report = await new AuditDeliveryService({
      source,
      sink: new AuditEventRepository(config),
      fallback: record => process.stderr.write(JSON.stringify(record) + '\n'),
    }).runBatch({ limit });
    console.log(JSON.stringify(report));
    if (report.sink_retryable || report.source_retryable || report.source_changed
      || report.quarantined || report.invalid_source) process.exitCode = 1;
  } catch {
    console.error('AUDIT_DELIVERY_RUN_FAILED');
    process.exitCode = 1;
  }
}
