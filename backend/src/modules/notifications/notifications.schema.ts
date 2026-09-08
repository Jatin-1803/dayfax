import { z } from 'zod';

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  unreadOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
