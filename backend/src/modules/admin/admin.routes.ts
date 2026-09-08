import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminController } from './admin.controller.js';
import {
  createDeliveryPartnerSchema,
  listDeliveryPartnersSchema,
} from './admin.schema.js';

const controller = new AdminController();
export const adminRouter = Router();

adminRouter.use(authenticate, requireAdminPrincipal());

adminRouter.get(
  '/delivery-partners',
  validateRequest(listDeliveryPartnersSchema, 'query'),
  controller.listDeliveryPartners,
);
adminRouter.post(
  '/delivery-partners',
  validateRequest(createDeliveryPartnerSchema),
  controller.createDeliveryPartner,
);
