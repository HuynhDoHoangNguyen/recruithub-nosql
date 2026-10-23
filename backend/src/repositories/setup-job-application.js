import 'dotenv/config';
import { JobApplicationRepository } from './job-application.repository.js';

try {
  await new JobApplicationRepository().initialize();
  console.log('Đã thiết lập index và view tuyển dụng; không sửa business documents.');
} catch {
  console.error('Không thể thiết lập CouchDB. Kiểm tra kết nối, database và quyền cấu hình.');
  process.exitCode = 1;
}
