import { ApiError } from '../middleware/job-application.middleware.js';
import { supportChatInstructions } from './support-chat.knowledge.js';
import { supportChatIntentSchema, supportChatResponseSchema, supportSearchInstructions } from '../schemas/support-chat-intent.schema.js';

const unavailable = () => new ApiError(503, 'CHAT_UNAVAILABLE', 'AI hiện chưa khả dụng. Bạn vẫn có thể dùng các câu hỏi FAQ bên dưới.');

// Native fetch calls the documented Gemini REST API once. No SDK retry or dynamic host.
export class SupportChatService {
  constructor(config, { fetchImpl = fetch, jobSearch } = {}) { this.config = config; this.fetch = fetchImpl; this.jobSearch = jobSearch; }

  async reply({ message, history }, { signal } = {}) {
    const config = this.config;
    if (!config.enabled) throw unavailable();
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
    try {
      const response = await this.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${supportChatInstructions}\n${supportSearchInstructions}` }] },
          contents: [...history.map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })),
            { role: 'user', parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: config.maxOutputTokens, temperature: 0.3,
            responseMimeType: 'application/json', responseSchema: supportChatResponseSchema },
        }),
      });
      if (!response.ok) throw unavailable();
      const data = await response.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('\n').trim();
      if (candidate?.finishReason !== 'STOP' || !text || text.length > 6000 || data.promptFeedback?.blockReason) throw unavailable();
      const intent = supportChatIntentSchema.safeParse(JSON.parse(text));
      if (!intent.success) throw unavailable();
      if (intent.data.intent === 'search_jobs') {
        clearTimeout(timer);
        if (!this.jobSearch) throw unavailable();
        return await this.jobSearch.search(intent.data, { signal: controller.signal });
      }
      return { mode: 'ai', provider: 'gemini', reply: intent.data.reply };
    } catch (error) {
      if (timedOut) throw new ApiError(504, 'CHAT_TIMEOUT', 'AI trả lời quá chậm. Bạn hãy dùng FAQ hoặc thử lại sau.');
      if (error?.code === 'CHAT_SEARCH_UNAVAILABLE') throw error;
      throw unavailable();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}
