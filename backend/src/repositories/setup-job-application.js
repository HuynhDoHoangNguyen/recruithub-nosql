import { loadBackendEnvironment } from '../config/load-environment.js';
import { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { JobApplicationRepository } from './job-application.repository.js';

loadBackendEnvironment();

try {
  const config = getAuthDatabaseConfig();
  const authHeader = config.username && config.password
    ? `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
    : undefined;
  await new JobApplicationRepository({ ...config, authHeader }).initialize();
  console.log('Đã thiết lập index và view tuyển dụng; không sửa business documents.');
} catch {
  console.error('Không thể thiết lập CouchDB. Kiểm tra kết nối, database và quyền cấu hình.');
  process.exitCode = 1;
}
