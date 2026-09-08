import { z } from 'zod';

const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Pincode must be 6 digits')
  .optional();

const addressFields = {
  label: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(255),
  line2: z.string().trim().max(255).optional(),
  landmark: z.string().trim().max(255).optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().max(120).optional(),
  pincode: pincodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  serviceAreaId: z.string().uuid().optional(),
  deliveryZoneId: z.string().uuid().optional(),
  isDefault: z.boolean().optional(),
};

export const createAddressSchema = z.object({
  ...addressFields,
  label: addressFields.label.default('Home'),
});

export const updateAddressSchema = z
  .object({
    label: addressFields.label.optional(),
    fullName: addressFields.fullName.optional(),
    line1: addressFields.line1.optional(),
    line2: addressFields.line2,
    landmark: addressFields.landmark,
    city: addressFields.city.optional(),
    state: addressFields.state,
    pincode: addressFields.pincode,
    latitude: addressFields.latitude,
    longitude: addressFields.longitude,
    serviceAreaId: addressFields.serviceAreaId,
    deliveryZoneId: addressFields.deliveryZoneId,
    isDefault: addressFields.isDefault,
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'At least one field is required',
  });

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
