import { loadBackendEnvironment } from '../config/load-environment.js';
import { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { createCouchDbClient } from '../services/couchdb.client.js';
import { CouchDbError } from '../services/couchdb.errors.js';
import { ADMIN_USER_STATISTICS_DESIGN } from './admin-statistics.repository.js';

loadBackendEnvironment();

const client = createCouchDbClient({ config: getAuthDatabaseConfig() });

try {
  let current;
  try {
    current = await client.getDocument(ADMIN_USER_STATISTICS_DESIGN._id);
  } catch (error) {
    if (!(error instanceof CouchDbError) || error.code !== 'NOT_FOUND') throw error;
  }

  if (!current) {
    await client.createDocument(ADMIN_USER_STATISTICS_DESIGN);
    console.log('Admin statistics views installed.');
  } else {
    const views = { ...(current.views ?? {}) };
    let changed = false;
    for (const [name, definition] of Object.entries(ADMIN_USER_STATISTICS_DESIGN.views)) {
      if (!views[name]) {
        views[name] = definition;
        changed = true;
      } else if (views[name].map !== definition.map || views[name].reduce !== definition.reduce) {
        throw new Error(`Existing Admin view ${name} differs from the source contract; refusing to overwrite it.`);
      }
    }
    if (changed) {
      await client.updateDocument({ ...current, language: 'javascript', views }, current._rev);
      console.log('Admin statistics view definitions updated.');
    } else {
      console.log('Admin statistics views are already current.');
    }
  }
} catch (error) {
  console.error(`Could not install Admin statistics views (${error?.code ?? 'SETUP_FAILED'}). Check database availability and permissions.`);
  process.exitCode = 1;
}
