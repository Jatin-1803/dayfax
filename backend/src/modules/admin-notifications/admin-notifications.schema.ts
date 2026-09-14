import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

export const sendPromoSchema = z.object({
  audience: z.enum(['CUSTOMERS', 'PARTNERS', 'ALL']),
  title: text(160),
  titleHi: optionalText(160),
  body: text(500),
  bodyHi: optionalText(500),
});

export type SendPromoInput = z.infer<typeof sendPromoSchema>;
