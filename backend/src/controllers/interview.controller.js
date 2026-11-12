export function interviewController(service) {
  return {
    create: async (req, res) => {
      const data = await service.create(req.user, req.validated.body);
      res.status(data.created ? 201 : 200).json({ success: true, data });
    },
    list: async (req, res) => {
      const data = await service.list(req.user, req.validated.query);
      res.status(200).json({ success: true, data });
    },
    complete: async (req, res) => {
      const data = await service.complete(req.user, req.validated.params.id, req.validated.body);
      res.status(200).json({ success: true, data });
    },
    listFeedback: async (req, res) => {
      const data = await service.listFeedback(req.user, req.validated.query);
      res.status(200).json({ success: true, data });
    },
  };
}
