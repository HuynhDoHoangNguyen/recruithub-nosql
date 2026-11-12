import { pathToFileURL } from 'node:url';
import { getAuditDatabaseConfig } from '../../backend/src/config/audit-database.config.js';
import { auditDesignPath, buildAuditDesign, createAuditTransport } from '../../backend/src/repositories/audit-event.repository.js';
import { canonicalHash } from '../../backend/src/utils/normalization.utils.js';

export async function provisionAuditStore(environment = process.env) {
  const config = getAuditDatabaseConfig(environment);
  const { AUDIT_COUCHDB_WRITER: writer, AUDIT_COUCHDB_READER: reader, AUDIT_COUCHDB_PRUNER: pruner } = environment;
  const names = [writer, reader, pruner];
  if (names.some(name => !name || !/^[a-zA-Z0-9_.-]{1,100}$/.test(name))
    || new Set([...names, config.username]).size !== 4) {
    throw new Error('Provide distinct CouchDB provisioner, writer, reader and pruner accounts.');
  }
  const http = createAuditTransport(config, fetch, environment);
  const design = buildAuditDesign({ writer, pruner });
  const security = { admins: { names: [], roles: [] }, members: { names, roles: [] } };
  const creation = await http('', 'PUT', undefined, [412]);
  const current = await http(auditDesignPath, 'GET', undefined, [404]);
  if (current.data) {
    const { _rev, ...existing } = current.data;
    if (canonicalHash(existing) !== canonicalHash(design)) throw new Error('Audit store design differs from requested configuration.');
    const { data } = await http('_security');
    if (canonicalHash(data) !== canonicalHash(security)) throw new Error('Audit store membership differs from requested configuration.');
    return { database: config.database, created: false };
  }
  const { data } = await http('_all_docs?limit=0');
  if (data.total_rows !== 0) throw new Error('Refusing to provision a nonempty unmanaged database.');
  await http('_security', 'PUT', security);
  await http(auditDesignPath, 'PUT', design);
  return { database: config.database, created: creation.status !== 412 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await provisionAuditStore()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
