import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  state: z.string().trim().max(80).nullable().optional(),
  countryCode: z.string().trim().length(2).default('IN'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const createServiceAreaSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).optional(),
  isActive: z.boolean().optional().default(true),
});

export const createDeliveryZoneSchema = z.object({
  serviceAreaId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  deliveryFeePaise: z.number().int().min(0),
  minOrderPaise: z.number().int().min(0),
  freeDeliveryAbovePaise: z.number().int().min(0).nullable().optional(),
  etaMinutes: z.number().int().positive().max(240),
  isActive: z.boolean().optional().default(true),
});

export const patchDeliveryZoneSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    deliveryFeePaise: z.number().int().min(0).optional(),
    minOrderPaise: z.number().int().min(0).optional(),
    freeDeliveryAbovePaise: z.number().int().min(0).nullable().optional(),
    etaMinutes: z.number().int().positive().max(240).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const patchLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().max(80).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const patchServiceAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const createFeeSlabSchema = z.object({
  fromKm: z.number().min(0).max(500),
  toKm: z.number().min(0).max(500).nullable().optional(),
  feePaise: z.number().int().min(0),
}).refine(
  (v) => v.toKm == null || v.toKm > v.fromKm,
  { message: 'toKm must be greater than fromKm' },
);

export const patchFeeSlabSchema = z
  .object({
    fromKm: z.number().min(0).max(500).optional(),
    toKm: z.number().min(0).max(500).nullable().optional(),
    feePaise: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const adminZoneIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const adminSlabParamsSchema = z.object({
  zoneId: z.string().uuid(),
  slabId: z.string().uuid(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type CreateServiceAreaInput = z.infer<typeof createServiceAreaSchema>;
export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;
export type PatchDeliveryZoneInput = z.infer<typeof patchDeliveryZoneSchema>;
export type PatchLocationInput = z.infer<typeof patchLocationSchema>;
export type PatchServiceAreaInput = z.infer<typeof patchServiceAreaSchema>;
export type CreateFeeSlabInput = z.infer<typeof createFeeSlabSchema>;
export type PatchFeeSlabInput = z.infer<typeof patchFeeSlabSchema>;
