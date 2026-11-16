import { z } from 'zod';

const content = z.string().trim().min(1).max(1000);
export const supportChatSchema = z.object({
  message: content,
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content }).strict()).max(6).default([]),
}).strict().refine(value => value.history.reduce((size, item) => size + item.content.length, 0) <= 4000,
  { message: 'Lịch sử hội thoại quá dài.', path: ['history'] });
