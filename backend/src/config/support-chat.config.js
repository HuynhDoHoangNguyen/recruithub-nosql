const integer = (value, fallback, max) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
};

export function getSupportChatConfig(env = process.env) {
  const apiKey = (env.GEMINI_API_KEY || '').trim();
  const model = (env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const timeoutMs = integer(env.SUPPORT_CHAT_TIMEOUT_MS, 12000, 30000);
  const maxOutputTokens = integer(env.SUPPORT_CHAT_MAX_OUTPUT_TOKENS, 500, 1000);
  const rateLimit = integer(env.SUPPORT_CHAT_RATE_LIMIT_PER_MINUTE, 5, 30) || 5;
  const maxConcurrent = integer(env.SUPPORT_CHAT_MAX_CONCURRENT, 2, 5) || 2;
  return { apiKey, model, timeoutMs, maxOutputTokens, rateLimit, maxConcurrent,
    enabled: env.SUPPORT_CHAT_AI_ENABLED === 'true' && apiKey.length >= 20
      && !/PASTE|REPLACE|YOUR_API_KEY/i.test(apiKey) && /^[a-z0-9.-]{1,80}$/.test(model)
      && Boolean(timeoutMs && maxOutputTokens) };
}
