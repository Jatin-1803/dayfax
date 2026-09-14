import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminNotificationsController } from './admin-notifications.controller.js';
import { sendPromoSchema } from './admin-notifications.schema.js';

const controller = new AdminNotificationsController();
export const adminNotificationsRouter = Router();

adminNotificationsRouter.use(authenticate, requireAdminPrincipal());

adminNotificationsRouter.get('/order-alerts', controller.listOrderAlerts);
adminNotificationsRouter.get('/', controller.list);
adminNotificationsRouter.post('/', validateRequest(sendPromoSchema), controller.send);
