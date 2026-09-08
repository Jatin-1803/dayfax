import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminRefreshInput = z.infer<typeof adminRefreshSchema>;
