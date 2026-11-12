import { loadBackendEnvironment } from '../config/load-environment.js';
import { getDatabaseConfig } from '../config/database.config.js';
import { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { JobApplicationRepository } from './job-application.repository.js';

loadBackendEnvironment();

async function initializeConfig(config, label) {
  if (!config) return;
  const authHeader = config.username && config.password
    ? `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
    : undefined;
  await new JobApplicationRepository({ ...config, authHeader }).initialize();
  console.log(`Đã thiết lập index và view tuyển dụng cho [${label}: ${config.database}]; không sửa business documents.`);
}

try {
  // 1. Primary dataset (for public job catalog queries)
  try {
    const primaryConfig = getDatabaseConfig();
    await initializeConfig(primaryConfig, 'Primary DB');
  } catch (err) {
    console.warn('Không thể thiết lập index cho Primary DB:', err.message);
  }

  // 2. Isolated auth & application database
  try {
    const authConfig = getAuthDatabaseConfig();
    await initializeConfig(authConfig, 'Auth DB');
  } catch (err) {
    console.warn('Không thể thiết lập index cho Auth DB:', err.message);
  }
} catch (error) {
  console.error('Không thể thiết lập CouchDB. Kiểm tra kết nối, database và quyền cấu hình.', error);
  process.exitCode = 1;
}
