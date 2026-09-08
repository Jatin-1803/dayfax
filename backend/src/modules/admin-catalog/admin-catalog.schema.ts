import { z } from 'zod';

export const adminIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameHi: z.string().trim().max(120).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  slug: z.string().trim().min(1).max(140).optional(),
  iconKey: z.string().trim().max(64).nullable().optional(),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const patchCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    nameHi: z.string().trim().max(120).nullable().optional(),
    iconKey: z.string().trim().max(64).nullable().optional(),
    imageUrl: z.string().trim().max(512).nullable().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export type PatchCategoryInput = z.infer<typeof patchCategorySchema>;

export const patchProductSchema = z
  .object({
    name: z.string().trim().min(1).max(180).optional(),
    nameHi: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    descriptionHi: z.string().trim().max(8000).nullable().optional(),
    brand: z.string().trim().max(120).nullable().optional(),
    subCategory: z.string().trim().max(120).nullable().optional(),
    subCategoryHi: z.string().trim().max(120).nullable().optional(),
    imageUrl: z.string().trim().max(512).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export type PatchProductInput = z.infer<typeof patchProductSchema>;
