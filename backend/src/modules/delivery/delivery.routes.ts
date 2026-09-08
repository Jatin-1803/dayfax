import { Router } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { DeliveryController } from './delivery.controller.js';
import { listJobsSchema, updateAssignmentStatusSchema } from './delivery.schema.js';

const controller = new DeliveryController();
export const deliveryRouter = Router();

deliveryRouter.use(authenticate, requireRoles('DELIVERY_PARTNER', 'ADMIN'));

deliveryRouter.get('/stats', controller.stats);
deliveryRouter.get('/jobs', validateRequest(listJobsSchema, 'query'), controller.listJobs);
deliveryRouter.get('/jobs/:idOrOrderId', controller.getJob);
deliveryRouter.post('/orders/:orderId/accept', controller.acceptOrder);
deliveryRouter.post('/orders/:orderId/payment/qr', controller.createPaymentQr);
deliveryRouter.post('/orders/:orderId/payment/check', controller.checkPayment);
deliveryRouter.post('/orders/:orderId/payment/cash', controller.collectCash);
deliveryRouter.post('/jobs/:orderId/claim', controller.claimJob);
deliveryRouter.post(
  '/jobs/:assignmentId/accept',
  controller.acceptJob,
);
deliveryRouter.post(
  '/jobs/:assignmentId/status',
  validateRequest(updateAssignmentStatusSchema),
  controller.updateStatus,
);
