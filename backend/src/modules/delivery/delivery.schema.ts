import { z } from 'zod';

export const deliveryAssignmentStatusSchema = z.enum([
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const listJobsSchema = z.object({
  tab: z.enum(['available', 'active', 'completed']).default('available'),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const updateAssignmentStatusSchema = z
  .object({
    status: z.enum(['IN_PROGRESS', 'COMPLETED', 'REJECTED']),
    note: z.string().trim().max(255).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    deliveryOtp: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Delivery OTP must be 4 digits')
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'COMPLETED' && !value.deliveryOtp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryOtp'],
        message: 'Delivery OTP is required to confirm delivery',
      });
    }
  });

export type DeliveryAssignmentStatus = z.infer<typeof deliveryAssignmentStatusSchema>;
export type ListJobsQuery = z.infer<typeof listJobsSchema>;
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;

export const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] as const;
export const AVAILABLE_ORDER_STATUSES = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'] as const;
