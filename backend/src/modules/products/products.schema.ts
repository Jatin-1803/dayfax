import { z } from 'zod';

export const listProductsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().trim().min(1).optional(),
  storeId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  popular: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ListProductsQuery = z.infer<typeof listProductsSchema>;
