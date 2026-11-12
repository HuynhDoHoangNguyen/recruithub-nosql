import api from '../services/api';

async function list(path, params) {
  const response = await api.get(path, { params });
  return response.data?.data ?? { items: [], has_more: false, next_cursor: null };
}

export const adminAuditApi = {
  listAuditTrails: params => list('/v1/admin/audit-trails', params),
  listSystemLogs: params => list('/v1/admin/system-logs', params),
};

