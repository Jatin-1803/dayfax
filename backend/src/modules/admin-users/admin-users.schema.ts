import { z } from 'zod';

export const adminListUsersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  q: z.string().trim().max(80).optional(),
  role: z.enum(['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN']).optional(),
});

export const adminUserIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const adminGrantRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN']),
});

export const adminRevokeRoleParamsSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN']),
});

const adminPasswordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const adminResetPasswordSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    password: adminPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type AdminListUsersQuery = z.infer<typeof adminListUsersSchema>;
export type AdminGrantRoleInput = z.infer<typeof adminGrantRoleSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
