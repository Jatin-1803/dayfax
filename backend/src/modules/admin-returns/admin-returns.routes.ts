import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminReturnsController } from './admin-returns.controller.js';
import {
  adminListReturnsSchema,
  adminMarkPaidSchema,
  adminRejectReturnSchema,
  adminReturnIdSchema,
} from './admin-returns.schema.js';

const controller = new AdminReturnsController();
export const adminReturnsRouter = Router();

adminReturnsRouter.use(authenticate, requireAdminPrincipal());

adminReturnsRouter.get('/', validateRequest(adminListReturnsSchema, 'query'), controller.list);
adminReturnsRouter.get('/:id', validateRequest(adminReturnIdSchema, 'params'), controller.getOne);
adminReturnsRouter.post(
  '/:id/approve',
  validateRequest(adminReturnIdSchema, 'params'),
  controller.approve,
);
adminReturnsRouter.post(
  '/:id/reject',
  validateRequest(adminReturnIdSchema, 'params'),
  validateRequest(adminRejectReturnSchema),
  controller.reject,
);
adminReturnsRouter.post(
  '/:id/mark-paid',
  validateRequest(adminReturnIdSchema, 'params'),
  validateRequest(adminMarkPaidSchema),
  controller.markPaid,
);
adminReturnsRouter.post(
  '/:id/retry-refund',
  validateRequest(adminReturnIdSchema, 'params'),
  controller.retryRefund,
);
adminReturnsRouter.post(
  '/payouts/:paymentId/mark-paid',
  validateRequest(adminMarkPaidSchema),
  controller.markCancelPaid,
);
