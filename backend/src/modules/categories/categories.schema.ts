import { z } from 'zod';

export const listCategoriesSchema = z.object({
  parentId: z.string().uuid().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema>;
