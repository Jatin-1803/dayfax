import { z } from 'zod';

export const adminListOrdersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  status: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ])
    .optional(),
  storeId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
});

export const adminOrderIdParamsSchema = z.object({
  idOrNumber: z.string().trim().min(1).max(64),
});

export const adminPatchOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
  note: z.string().trim().max(500).optional(),
});

export const adminAssignOrderSchema = z.object({
  partnerId: z.string().uuid(),
});

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersSchema>;
export type AdminPatchOrderStatusInput = z.infer<typeof adminPatchOrderStatusSchema>;
export type AdminAssignOrderInput = z.infer<typeof adminAssignOrderSchema>;
