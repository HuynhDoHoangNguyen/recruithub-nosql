import { ApiError } from './job-application.middleware.js';

export function createSupportChatLimit({ rateLimit = 5, maxConcurrent = 2, now = Date.now } = {}) {
  const clients = new Map();
  let active = 0;
  return (req, res, next) => {
    const time = now();
    for (const [ip, bucket] of clients) if (bucket.until <= time) clients.delete(ip);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = clients.get(ip) || { count: 0, until: time + 60000 };
    if (bucket.count >= rateLimit || active >= maxConcurrent || (!clients.has(ip) && clients.size >= 1000)) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.until - time) / 1000))));
      return next(new ApiError(429, 'CHAT_RATE_LIMITED', 'Đã đạt giới hạn hỗ trợ AI. Vui lòng chờ hoặc dùng FAQ.'));
    }
    bucket.count += 1; clients.set(ip, bucket); active += 1;
    let released = false;
    const release = () => { if (!released) { released = true; active -= 1; } };
    res.once('finish', release); res.once('close', release);
    next();
  };
}
