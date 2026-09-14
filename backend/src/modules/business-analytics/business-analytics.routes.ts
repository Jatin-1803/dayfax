import { Router } from 'express';
import {
  authenticate,
  requireAdminPrincipal,
  requirePermission,
} from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { BusinessAnalyticsController } from './business-analytics.controller.js';
import {
  analyticsExportQuerySchema,
  analyticsOrderIdParamsSchema,
  analyticsOrdersQuerySchema,
  analyticsProductsQuerySchema,
  analyticsSummaryQuerySchema,
  analyticsTrendQuerySchema,
} from './business-analytics.schema.js';

const controller = new BusinessAnalyticsController();
export const adminBusinessAnalyticsRouter = Router();

adminBusinessAnalyticsRouter.use(
  authenticate,
  requireAdminPrincipal(),
  requirePermission('analytics.view'),
);

adminBusinessAnalyticsRouter.get(
  '/summary',
  validateRequest(analyticsSummaryQuerySchema, 'query'),
  controller.summary,
);

adminBusinessAnalyticsRouter.get(
  '/trend',
  validateRequest(analyticsTrendQuerySchema, 'query'),
  controller.trend,
);

adminBusinessAnalyticsRouter.get(
  '/order-profit',
  validateRequest(analyticsOrdersQuerySchema, 'query'),
  controller.orderProfit,
);

adminBusinessAnalyticsRouter.get(
  '/order-profit/:id',
  validateRequest(analyticsOrderIdParamsSchema, 'params'),
  controller.orderDetail,
);

adminBusinessAnalyticsRouter.get(
  '/product-profit',
  validateRequest(analyticsProductsQuerySchema, 'query'),
  controller.productProfit,
);

adminBusinessAnalyticsRouter.get(
  '/export',
  requirePermission('analytics.export'),
  validateRequest(analyticsExportQuerySchema, 'query'),
  controller.exportReport,
);
