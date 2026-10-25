export function jobController(service) {
  const send = (action, status = 200, message = 'Đã tải dữ liệu tuyển dụng.') => async (req, res) => {
    res.status(status).json({ success: true, data: await action(req), message });
  };
  return {
    context: send(req => service.context(req.user)),
    list: send(req => service.list(req.user, req.validated.query)),
    stats: send(req => service.stats(req.user)),
    detail: send(req => service.detail(req.user, req.params.id)),
    create: send(req => service.create(req.user, req.validated.body), 201, 'Đã tạo tin tuyển dụng.'),
    edit: send(req => service.update(req.user, req.params.id, req.validated.body), 200, 'Đã lưu tin tuyển dụng.'),
    remove: send(req => service.remove(req.user, req.params.id, req.validated.body), 200, 'Đã xóa tin khỏi danh sách. Hồ sơ ứng viên được giữ lại.'),
    status: send(req => service.update(req.user, req.params.id, req.validated.body, true), 200, 'Đã cập nhật trạng thái tin.'),
    metadata: send(() => service.metadata()),
    publicList: send(req => service.publicList(req.validated.query)),
    publicDetail: send(req => service.publicDetail(req.params.id)),
  };
}
