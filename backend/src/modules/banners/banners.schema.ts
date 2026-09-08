import { z } from 'zod';
import { appLangSchema } from '../i18n/i18n.schema.js';

const ALLOWED_LINK_PREFIXES = [
  '/home',
  '/search',
  '/shops',
  '/products/',
  '/notifications',
  '/categories',
  '/category/',
  '/orders',
  '/cart',
  '/profile',
  '/addresses',
] as const;

export function isAllowedBannerLinkPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('://') || value.includes('..') || value.includes('\\')) return false;
  if (value.includes('?') || value.includes('#')) return false;
  if (!/^\/[a-z0-9/_-]+$/i.test(value)) return false;
  return ALLOWED_LINK_PREFIXES.some(
    (prefix) => value === prefix || value.startsWith(`${prefix}/`) || (prefix.endsWith('/') && value.startsWith(prefix)),
  );
}

const linkPathSchema = z
  .string()
  .trim()
  .max(255)
  .refine((value) => value.length === 0 || isAllowedBannerLinkPath(value), {
    message: 'Link must be an in-app path such as /categories or /shops',
  })
  .transform((value) => (value.length === 0 ? null : value));

const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      value.startsWith('/media/') || /^https?:\/\/.+/i.test(value),
    { message: 'Image must be an uploaded file or an http(s) URL' },
  );

const prioritySchema = z.number().int().min(0).max(1000);

const dateTimeSchema = z.coerce.date();

export const listPublicBannersQuerySchema = z.object({
  lang: appLangSchema,
});

export type ListPublicBannersQuery = z.infer<typeof listPublicBannersQuerySchema>;

export const bannerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createBannerSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    titleHi: z.string().trim().max(120).nullable().optional(),
    imageUrl: imageUrlSchema,
    linkPath: linkPathSchema.nullable().optional(),
    priority: prioritySchema.optional().default(0),
    isActive: z.boolean().optional().default(true),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
  })
  .refine((value) => value.endAt.getTime() > value.startAt.getTime(), {
    message: 'End time must be after start time',
    path: ['endAt'],
  });

export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const patchBannerSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    titleHi: z.string().trim().max(120).nullable().optional(),
    imageUrl: imageUrlSchema.optional(),
    linkPath: linkPathSchema.nullable().optional(),
    priority: prioritySchema.optional(),
    isActive: z.boolean().optional(),
    startAt: dateTimeSchema.optional(),
    endAt: dateTimeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field' })
  .refine(
    (value) =>
      value.startAt == null ||
      value.endAt == null ||
      value.endAt.getTime() > value.startAt.getTime(),
    { message: 'End time must be after start time', path: ['endAt'] },
  );

export type PatchBannerInput = z.infer<typeof patchBannerSchema>;
