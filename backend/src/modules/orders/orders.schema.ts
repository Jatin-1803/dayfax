import { z } from 'zod';

export const checkoutSchema = z.object({
  addressId: z.string().uuid(),
  paymentMethod: z.enum(['COD', 'UPI', 'CARD', 'WALLET']).default('COD'),
  notes: z.string().trim().max(500).optional(),
  /** Client-generated key to make checkout safe under retries / double taps. */
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1).max(128),
  razorpayPaymentId: z.string().min(1).max(128),
  razorpaySignature: z.string().min(1).max(256),
});

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const quoteSchema = z.object({
  addressId: z.string().uuid().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';
