import { z } from 'zod';

export const appLangSchema = z.enum(['en', 'hi']).default('en');
export type AppLang = z.infer<typeof appLangSchema>;

export const i18nBundleQuerySchema = z.object({
  lang: appLangSchema,
});

export type I18nBundleQuery = z.infer<typeof i18nBundleQuerySchema>;

export const listUiStringsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  q: z.string().trim().min(1).max(160).optional(),
});

export type ListUiStringsQuery = z.infer<typeof listUiStringsQuerySchema>;

export const createUiStringSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:[._][a-z0-9]+)*$/i, 'Key must be dotted alphanumeric'),
  en: z.string().min(1).max(4000),
  hi: z.string().min(1).max(4000),
});

export type CreateUiStringInput = z.infer<typeof createUiStringSchema>;

export const updateUiStringSchema = z.object({
  en: z.string().min(1).max(4000).optional(),
  hi: z.string().min(1).max(4000).optional(),
}).refine((v) => v.en !== undefined || v.hi !== undefined, {
  message: 'Provide en and/or hi',
});

export type UpdateUiStringInput = z.infer<typeof updateUiStringSchema>;

export const uiStringKeyParamsSchema = z.object({
  key: z.string().trim().min(1).max(160),
});
