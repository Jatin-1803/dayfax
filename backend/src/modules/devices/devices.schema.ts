import { z } from 'zod';

export const registerDeviceSchema = z.object({
  token: z.string().trim().min(20).max(512),
  platform: z.enum(['android', 'ios']),
  locale: z.enum(['en', 'hi']).default('en'),
  appRole: z.enum(['CUSTOMER', 'DELIVERY_PARTNER']),
});

export const unregisterDeviceSchema = z.object({
  token: z.string().trim().min(20).max(512),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type UnregisterDeviceInput = z.infer<typeof unregisterDeviceSchema>;
