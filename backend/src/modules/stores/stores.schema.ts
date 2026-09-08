import { z } from 'zod';

export const listStoresQuerySchema = z.object({
  popular: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  storeType: z.enum(['FOOD', 'GROCERY', 'VEGETABLES', 'MIXED', 'OTHER']).optional(),
  serviceAreaId: z.string().uuid().optional(),
});

export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>;
