import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import {
  adminAssignOrderSchema,
  adminListOrdersSchema,
  adminOrderIdParamsSchema,
  adminPatchOrderStatusSchema,
} from './admin-orders.schema.js';

const controller = new AdminOrdersController();
export const adminOrdersRouter = Router();

adminOrdersRouter.use(authenticate, requireAdminPrincipal());

adminOrdersRouter.get(
  '/',
  validateRequest(adminListOrdersSchema, 'query'),
  controller.list,
);
adminOrdersRouter.get(
  '/:idOrNumber',
  validateRequest(adminOrderIdParamsSchema, 'params'),
  controller.getOne,
);
adminOrdersRouter.patch(
  '/:idOrNumber/status',
  validateRequest(adminOrderIdParamsSchema, 'params'),
  validateRequest(adminPatchOrderStatusSchema),
  controller.patchStatus,
);
adminOrdersRouter.post(
  '/:idOrNumber/assign',
  validateRequest(adminOrderIdParamsSchema, 'params'),
  validateRequest(adminAssignOrderSchema),
  controller.assign,
);
