import { z } from 'zod';

export const createDeliveryPartnerSchema = z.object({
  phoneCountryCode: z.string().trim().min(1).max(8).default('+91'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  fullName: z.string().trim().min(1).max(120).optional(),
});

export type CreateDeliveryPartnerInput = z.infer<typeof createDeliveryPartnerSchema>;

export const listDeliveryPartnersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().trim().max(80).optional(),
});

export type ListDeliveryPartnersQuery = z.infer<typeof listDeliveryPartnersSchema>;
