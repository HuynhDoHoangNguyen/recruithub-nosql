import client from '../services/api';

async function message(error) {
  let body = error.response?.data;
  if (body instanceof Blob) { try { body = JSON.parse(await body.text()); } catch { body = null; } }
  return Object.assign(new Error(body?.error?.message || 'Không tải được file. Vui lòng thử lại.'), { status: error.response?.status, code: body?.error?.code });
}
export const assetApi = {
  async preview(id, { signal } = {}) {
    try { return (await client.get(`/v1/uploads/${encodeURIComponent(id)}/preview`, { signal, timeout: 20000 })).data.data; }
    catch (error) { if (error.code === 'ERR_CANCELED') throw error; throw await message(error); }
  },
  async upload(kind, file, onProgress) {
    try {
      const response = await client.post(`/v1/uploads/${kind}`, file, { timeout: 60000,
        headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
        onUploadProgress: event => onProgress?.(event.total ? Math.round(event.loaded / event.total * 100) : 0),
      });
      return response.data.data;
    } catch (error) { throw await message(error); }
  },
  async content(id, { signal } = {}) {
    try { return (await client.get(`/v1/uploads/${encodeURIComponent(id)}/content`, { responseType: 'blob', signal, timeout: 60000 })).data; }
    catch (error) { if (error.code === 'ERR_CANCELED') throw error; throw await message(error); }
  },
};
