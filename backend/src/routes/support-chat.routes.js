import express, { Router } from 'express';
import { ApiError } from '../middleware/job-application.middleware.js';
import { createSupportChatLimit } from '../middleware/support-chat-limit.js';
import { supportChatSchema } from '../schemas/support-chat.schema.js';
import { getSupportChatConfig } from '../config/support-chat.config.js';
import { SupportChatService } from '../services/support-chat.service.js';
import { createSupportChatController } from '../controllers/support-chat.controller.js';

export function createSupportChatRoutes({ env = process.env, service, jobSearch, fetchImpl, now } = {}) {
  const router = Router();
  const config = getSupportChatConfig(env);
  const limit = createSupportChatLimit({ ...config, now });
  router.post('/chat', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    express.json({ limit: '16kb' }),
    (req, res, next) => {
      const parsed = supportChatSchema.safeParse(req.body);
      if (!parsed.success) return next(new ApiError(400, 'CHAT_INVALID_INPUT', 'Câu hỏi hoặc lịch sử không hợp lệ (tối đa 1.000 ký tự mỗi tin nhắn).'));
      req.validatedChat = parsed.data; next();
    }, limit, createSupportChatController(service || new SupportChatService(config, { jobSearch, fetchImpl })));
  router.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ success: false, error: { code: 'CHAT_INVALID_INPUT', message: 'Nội dung chat quá dài.' } });
    next(error);
  });
  return router;
}
