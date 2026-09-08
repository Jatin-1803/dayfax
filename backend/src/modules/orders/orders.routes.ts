import { Router } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { OrdersController } from './orders.controller.js';
import {
  checkoutSchema,
  listOrdersSchema,
  quoteSchema,
  verifyPaymentSchema,
} from './orders.schema.js';

const controller = new OrdersController();
export const ordersRouter = Router();

ordersRouter.use(authenticate, requireRoles('CUSTOMER', 'ADMIN'));

ordersRouter.get('/quote', validateRequest(quoteSchema, 'query'), controller.quote);
ordersRouter.post('/checkout', validateRequest(checkoutSchema), controller.checkout);
ordersRouter.post(
  '/:idOrNumber/payments/verify',
  validateRequest(verifyPaymentSchema),
  controller.verifyPayment,
);
ordersRouter.get('/', validateRequest(listOrdersSchema, 'query'), controller.list);
ordersRouter.get('/:idOrNumber/timeline', controller.timeline);
ordersRouter.get('/:idOrNumber', controller.getOne);
