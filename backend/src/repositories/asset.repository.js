import { JobApplicationRepository } from './job-application.repository.js';
import { getAuthDatabaseConfig } from '../config/auth-database.config.js';
import { ApiError } from '../middleware/job-application.middleware.js';

export class AssetRepository extends JobApplicationRepository {
  async readContent(id) {
    let response;
    try { response = await this.request(`${this.config.url}/${encodeURIComponent(this.config.database)}/${encodeURIComponent(id)}/content`, {
      headers: this.config.authHeader ? { Authorization: this.config.authHeader } : {}, signal: AbortSignal.timeout(15000),
    }); } catch { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không tải được file từ cơ sở dữ liệu.'); }
    if (response.status === 404) throw new ApiError(404, 'FILE_NOT_FOUND', 'Không tìm thấy file.');
    if (!response.ok) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Không tải được file.');
    return Buffer.from(await response.arrayBuffer());
  }
}
export function createAssetRepository(environment = process.env) {
  let repository;
  const get = () => {
    if (!repository) {
      const config = getAuthDatabaseConfig(environment);
      const authHeader = config.username && config.password ? `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}` : undefined;
      repository = new AssetRepository({ ...config, authHeader });
    }
    return repository;
  };
  return Object.fromEntries(['get', 'put', 'readContent'].map(method => [method, (...args) => get()[method](...args)]));
}
