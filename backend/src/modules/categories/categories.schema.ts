import { z } from 'zod';
import { appLangSchema } from '../i18n/i18n.schema.js';

export const listCategoriesSchema = z.object({
  parentId: z.string().uuid().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /** When true and parentId is omitted, return parent and child categories. */
  includeChildren: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  lang: appLangSchema,
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema>;

export const getCategoryQuerySchema = z.object({
  lang: appLangSchema,
});

export type GetCategoryQuery = z.infer<typeof getCategoryQuerySchema>;
