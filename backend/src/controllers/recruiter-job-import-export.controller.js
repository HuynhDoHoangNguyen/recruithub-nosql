export function recruiterJobImportExportController(service) {
  return {
    preview: async (req, res) => res.json({ success: true, data: await service.preview(req.user, req.validated.body) }),
    confirm: async (req, res) => res.status(201).json({ success: true, data: await service.confirm(req.user, req.validated.body), message: 'Đã hoàn tất nhập tin tuyển dụng.' }),
    template: (req, res) => {
      const file = service.template(req.validated.query.format);
      res.set({ 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.fileName}"`, 'Cache-Control': 'no-store' }).send(file.content);
    },
    export: async (req, res) => {
      const file = await service.export(req.user, req.validated.query);
      res.set({ 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.fileName}"`, 'Cache-Control': 'no-store' }).send(file.content);
    },
  };
}
