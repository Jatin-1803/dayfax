import { z } from 'zod';

export const adminListReturnsSchema = z.object({
  status: z
    .enum([
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'PICKUP_IN_PROGRESS',
      'PICKED_UP',
      'REFUND_PENDING',
      'REFUNDED',
    ])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const adminReturnIdSchema = z.object({
  id: z.string().uuid(),
});

export const adminRejectReturnSchema = z.object({
  note: z.string().trim().min(3).max(500),
});

export const adminMarkPaidSchema = z.object({
  payoutRef: z.string().trim().max(128).optional(),
});

export type AdminListReturnsQuery = z.infer<typeof adminListReturnsSchema>;
export type AdminRejectReturnInput = z.infer<typeof adminRejectReturnSchema>;
export type AdminMarkPaidInput = z.infer<typeof adminMarkPaidSchema>;
