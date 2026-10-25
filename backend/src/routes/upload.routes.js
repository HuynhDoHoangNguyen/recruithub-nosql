import { Router, raw } from 'express';
import { ApiError, requireRoles, validate } from '../middleware/job-application.middleware.js';
import { assetParamsSchema, MAX_UPLOAD_BYTES, uploadKindSchema } from '../schemas/upload.schema.js';

export function createUploadRoutes({ authenticate, uploads }) {
  const router = Router();
  router.post('/uploads/:kind', authenticate, requireRoles('CANDIDATE', 'RECRUITER'), validate(uploadKindSchema, 'params'),
    raw({ type: 'application/octet-stream', limit: MAX_UPLOAD_BYTES }), async (req, res) => {
      let name; try { name = decodeURIComponent(req.get('X-File-Name') || ''); } catch { throw new ApiError(400, 'INVALID_FILE', 'Tên file không hợp lệ.'); }
      const data = await uploads.upload(req.user, req.params.kind, req.body, name);
      res.status(201).json({ success: true, data, message: 'Đã tải file lên.' });
    });
  const content = publicLogo => async (req, res) => {
    const { asset, bytes } = await uploads.content(req.params.id, req.user, publicLogo);
    const filename = encodeURIComponent(asset.file_name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`);
    res.set({ 'Content-Type': asset.content_type, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': publicLogo ? 'public, max-age=31536000, immutable' : 'private, no-store',
      'Content-Disposition': `${asset.kind === 'resume' ? 'attachment' : 'inline'}; filename*=UTF-8''${filename}` });
    res.send(bytes);
  };
  router.get('/uploads/:id/content', authenticate, validate(assetParamsSchema, 'params'), content(false));
  router.get('/uploads/:id/preview', authenticate, validate(assetParamsSchema, 'params'), async (req, res) => {
    const data = await uploads.preview(req.params.id, req.user);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  });
  router.get('/media/company-logos/:id', validate(assetParamsSchema, 'params'), content(true));
  router.use((error, req, res, next) => error.type === 'entity.too.large'
    ? next(new ApiError(413, 'FILE_TOO_LARGE', 'Kích thước file phải dưới 5 MB.')) : next(error));
  return router;
}
