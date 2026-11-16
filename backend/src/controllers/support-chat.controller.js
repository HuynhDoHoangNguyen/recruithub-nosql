export function createSupportChatController(service) {
  return async (req, res) => {
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    try {
      const data = await service.reply(req.validatedChat, { signal: controller.signal });
      if (!res.destroyed) res.json({ success: true, data, message: 'Đã nhận hướng dẫn từ AI.' });
    } finally { res.removeListener('close', disconnect); }
  };
}
