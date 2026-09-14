import { z } from 'zod';
import { appLangSchema } from '../i18n/i18n.schema.js';
import { HOME_COLLECTION_ITEM_LIMIT } from './home-collections.eligibility.js';

const prioritySchema = z.number().int().min(0).max(1000);
const dateTimeSchema = z.coerce.date();

const headlineHiInput = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return value ?? null;
    return value.length === 0 ? null : value;
  });

/** Patch must omit the field when the client did not send it. */
const headlineHiPatch = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return value.length === 0 ? null : value;
  });

export const productIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(HOME_COLLECTION_ITEM_LIMIT)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Duplicate products are not allowed',
  });

export const listPublicHomeCollectionQuerySchema = z.object({
  lang: appLangSchema,
});

export type ListPublicHomeCollectionQuery = z.infer<typeof listPublicHomeCollectionQuerySchema>;

export const homeCollectionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createHomeCollectionSchema = z
  .object({
    headline: z.string().trim().min(1).max(120),
    headlineHi: headlineHiInput,
    priority: prioritySchema.optional().default(0),
    isActive: z.boolean().optional().default(true),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    productIds: productIdsSchema,
  })
  .refine((value) => value.endAt.getTime() > value.startAt.getTime(), {
    message: 'End time must be after start time',
    path: ['endAt'],
  });

export type CreateHomeCollectionInput = z.infer<typeof createHomeCollectionSchema>;

export const patchHomeCollectionSchema = z
  .object({
    headline: z.string().trim().min(1).max(120).optional(),
    headlineHi: headlineHiPatch,
    priority: prioritySchema.optional(),
    isActive: z.boolean().optional(),
    startAt: dateTimeSchema.optional(),
    endAt: dateTimeSchema.optional(),
    productIds: productIdsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field' })
  .refine(
    (value) =>
      value.startAt == null ||
      value.endAt == null ||
      value.endAt.getTime() > value.startAt.getTime(),
    { message: 'End time must be after start time', path: ['endAt'] },
  );

export type PatchHomeCollectionInput = z.infer<typeof patchHomeCollectionSchema>;
