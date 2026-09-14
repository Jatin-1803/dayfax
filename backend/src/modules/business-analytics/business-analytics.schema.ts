import { z } from 'zod';

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const analyticsRangeSchema = z
  .object({
    preset: z
      .enum([
        'today',
        'yesterday',
        'last_7_days',
        'last_30_days',
        'this_month',
        'last_month',
        'this_year',
        'custom',
      ])
      .optional()
      .default('last_30_days'),
    from: dateYmd.optional(),
    to: dateYmd.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.preset === 'custom') {
      if (!v.from || !v.to) {
        ctx.addIssue({
          code: 'custom',
          message: 'Custom range requires from and to dates',
          path: ['from'],
        });
      } else if (v.from > v.to) {
        ctx.addIssue({
          code: 'custom',
          message: 'from must be on or before to',
          path: ['from'],
        });
      }
    }
  });

export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>;

export const analyticsSummaryQuerySchema = analyticsRangeSchema;

export const analyticsTrendQuerySchema = analyticsRangeSchema.extend({
  granularity: z.enum(['day', 'week', 'month']).optional().default('day'),
});

export const analyticsOrdersQuerySchema = analyticsRangeSchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().trim().max(120).optional(),
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
  paymentMethod: z.enum(['COD', 'ONLINE']).optional(),
  profit: z.enum(['positive', 'negative', 'unknown']).optional(),
  sort: z
    .enum([
      'latest',
      'profit_desc',
      'profit_asc',
      'sales_desc',
      'cost_desc',
    ])
    .optional()
    .default('latest'),
});

export const analyticsProductsQuerySchema = analyticsRangeSchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().trim().max(120).optional(),
  sort: z
    .enum([
      'revenue_desc',
      'profit_desc',
      'profit_asc',
      'margin_desc',
      'margin_asc',
      'units_desc',
    ])
    .optional()
    .default('profit_desc'),
});

export const analyticsOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const analyticsExportQuerySchema = analyticsRangeSchema.extend({
  report: z.enum(['summary', 'orders', 'products', 'returns']).default('summary'),
  format: z.enum(['csv']).optional().default('csv'),
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
  paymentMethod: z.enum(['COD', 'ONLINE']).optional(),
  profit: z.enum(['positive', 'negative', 'unknown']).optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(40).optional(),
});

export type AnalyticsSummaryQueryInput = z.infer<typeof analyticsSummaryQuerySchema>;
export type AnalyticsTrendQueryInput = z.infer<typeof analyticsTrendQuerySchema>;
export type AnalyticsOrdersQueryInput = z.infer<typeof analyticsOrdersQuerySchema>;
export type AnalyticsProductsQueryInput = z.infer<typeof analyticsProductsQuerySchema>;
export type AnalyticsExportQueryInput = z.infer<typeof analyticsExportQuerySchema>;
