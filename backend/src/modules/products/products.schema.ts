import { z } from 'zod';
import { appLangSchema } from '../i18n/i18n.schema.js';

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
  lang: appLangSchema,
});

export type ListProductsQuery = z.infer<typeof listProductsSchema>;

export const similarProductsSchema = z.object({
  storeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(24).optional(),
  lang: appLangSchema,
});

export type SimilarProductsQuery = z.infer<typeof similarProductsSchema>;

export const getProductQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  lang: appLangSchema,
});

export type GetProductQuery = z.infer<typeof getProductQuerySchema>;
