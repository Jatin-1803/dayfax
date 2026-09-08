import { z } from 'zod';

export const adminStoreIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const adminStoreProductParamsSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
});

const storeTypeSchema = z.enum(['FOOD', 'GROCERY', 'VEGETABLES', 'MIXED', 'OTHER']);

export const createStoreSchema = z.object({
  serviceAreaId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180).optional(),
  storeType: storeTypeSchema.default('FOOD'),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  phoneCountryCode: z.string().trim().max(8).optional().default('+91'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
    .optional()
    .nullable(),
  addressLine1: z.string().trim().max(255).nullable().optional(),
  addressLine2: z.string().trim().max(255).nullable().optional(),
  landmark: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  pincode: z.string().trim().max(12).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isPopular: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const patchStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    storeType: storeTypeSchema.optional(),
    imageUrl: z.string().trim().max(512).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    phoneCountryCode: z.string().trim().max(8).nullable().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
      .nullable()
      .optional(),
    addressLine1: z.string().trim().max(255).nullable().optional(),
    addressLine2: z.string().trim().max(255).nullable().optional(),
    landmark: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    pincode: z.string().trim().max(12).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    isPopular: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export type PatchStoreInput = z.infer<typeof patchStoreSchema>;

export const patchStoreProductSchema = z
  .object({
    isAvailable: z.boolean().optional(),
    pricePaise: z.number().int().positive().optional(),
    mrpPaise: z.number().int().positive().optional(),
    quantityAvailable: z.number().int().min(0).optional(),
    unitLabel: z.string().trim().min(1).max(40).optional(),
    name: z.string().trim().min(1).max(180).optional(),
    nameHi: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    descriptionHi: z.string().trim().max(8000).nullable().optional(),
    brand: z.string().trim().max(120).nullable().optional(),
    imageUrl: z.string().trim().max(512).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export type PatchStoreProductInput = z.infer<typeof patchStoreProductSchema>;

export const createAdminProductSchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().trim().min(1).max(140).optional().default('food'),
  name: z.string().trim().min(1).max(180),
  nameHi: z.string().trim().max(180).nullable().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  descriptionHi: z.string().trim().max(8000).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  unitLabel: z.string().trim().min(1).max(40).optional().default('1 pc'),
  pricePaise: z.number().int().positive(),
  mrpPaise: z.number().int().positive().optional(),
  quantityAvailable: z.number().int().min(0).optional().default(100),
  isAvailable: z.boolean().optional().default(true),
});

export type CreateAdminProductInput = z.infer<typeof createAdminProductSchema>;
