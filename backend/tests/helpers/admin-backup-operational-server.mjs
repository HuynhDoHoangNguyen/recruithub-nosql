// Test entry point: real production routes/Auth/JWT, isolated environment supplied by parent.
import { createApp } from '../../src/app.js';
import { AdminBackupService } from '../../src/services/admin-backup.service.js';
import { BackupJobStore } from '../../src/services/admin-backup-job.service.js';

const store = new BackupJobStore({ root: process.env.BR005_SPOOL });
await store.initialize();
const service = new AdminBackupService({ env: process.env, store });
const app = createApp({ jwtEnv: process.env, backupService: service });
const server = app.listen(0, '127.0.0.1', () => {
  process.send?.({ type: 'ready', port: server.address().port });
});
process.on('message', async message => {
  if (message?.type !== 'stop') return;
  await Promise.allSettled([...service.pending.values()]);
  store.close(); server.close(() => process.exit(0)); server.closeAllConnections();
});
