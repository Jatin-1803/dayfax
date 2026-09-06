import { z } from 'zod';

export const addCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(99).default(1),
  storeId: z.string().uuid().optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
