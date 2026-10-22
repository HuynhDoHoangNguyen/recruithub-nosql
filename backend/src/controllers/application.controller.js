export function applicationController(service) {
  const send = (action, status = 200, message = 'Đã tải hồ sơ ứng tuyển.') => async (req, res) => {
    res.status(status).json({ success: true, data: await action(req), message });
  };
  return {
    context: send(req => service.context(req.user)),
    create: send(req => service.create(req.user, req.validated.body), 201, 'Đã nộp hồ sơ ứng tuyển.'),
    mine: send(req => service.mine(req.user, req.validated.query)),
    detail: send(req => service.detail(req.user, req.params.id)),
    applicants: send(req => service.applicants(req.user, req.params.id, req.validated.query)),
    withdraw: send(req => service.transition(req.user, req.params.id, req.validated.body, true), 200, 'Đã rút đơn. Lịch sử hồ sơ được lưu lại.'),
    stage: send(req => service.transition(req.user, req.params.id, req.validated.body), 200, 'Đã chuyển trạng thái hồ sơ.'),
  };
}
