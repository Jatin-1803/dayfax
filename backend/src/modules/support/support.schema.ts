import { z } from 'zod';

export { SUPPORT_AGENT_NAME } from './support-agent-policy.js';

export const openConversationSchema = z.object({
  lang: z.enum(['en', 'hi']).optional(),
});

export const sendSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  lang: z.enum(['en', 'hi']).optional(),
});

const damagePhotoUrl = z
  .string()
  .trim()
  .regex(
    /^\/media\/returns\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i,
    'Photo must be an uploaded image',
  );

export const reportDamagedItemsSchema = z.object({
  customerNote: z.string().trim().min(3).max(1000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
        note: z.string().trim().max(255).optional(),
      }),
    )
    .min(1)
    .max(40),
  photoUrls: z.array(damagePhotoUrl).min(1).max(3),
});

export type OpenConversationInput = z.infer<typeof openConversationSchema>;
export type SendSupportMessageInput = z.infer<typeof sendSupportMessageSchema>;
export type ReportDamagedItemsInput = z.infer<typeof reportDamagedItemsSchema>;
