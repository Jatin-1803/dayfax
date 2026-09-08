import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminZonesController } from './admin-zones.controller.js';
import {
  adminSlabParamsSchema,
  adminZoneIdParamsSchema,
  createDeliveryZoneSchema,
  createFeeSlabSchema,
  createLocationSchema,
  createServiceAreaSchema,
  patchDeliveryZoneSchema,
  patchFeeSlabSchema,
  patchLocationSchema,
  patchServiceAreaSchema,
} from './admin-zones.schema.js';

const controller = new AdminZonesController();
export const adminZonesRouter = Router();

adminZonesRouter.use(authenticate, requireAdminPrincipal());

adminZonesRouter.get('/locations', controller.listLocations);
adminZonesRouter.post(
  '/locations',
  validateRequest(createLocationSchema),
  controller.createLocation,
);
adminZonesRouter.patch(
  '/locations/:id',
  validateRequest(adminZoneIdParamsSchema, 'params'),
  validateRequest(patchLocationSchema),
  controller.patchLocation,
);

adminZonesRouter.get('/service-areas', controller.listServiceAreas);
adminZonesRouter.post(
  '/service-areas',
  validateRequest(createServiceAreaSchema),
  controller.createServiceArea,
);
adminZonesRouter.patch(
  '/service-areas/:id',
  validateRequest(adminZoneIdParamsSchema, 'params'),
  validateRequest(patchServiceAreaSchema),
  controller.patchServiceArea,
);

adminZonesRouter.get('/delivery-zones', controller.listDeliveryZones);
adminZonesRouter.post(
  '/delivery-zones',
  validateRequest(createDeliveryZoneSchema),
  controller.createDeliveryZone,
);
adminZonesRouter.patch(
  '/delivery-zones/:id',
  validateRequest(adminZoneIdParamsSchema, 'params'),
  validateRequest(patchDeliveryZoneSchema),
  controller.patchDeliveryZone,
);

adminZonesRouter.get(
  '/delivery-zones/:id/slabs',
  validateRequest(adminZoneIdParamsSchema, 'params'),
  controller.listFeeSlabs,
);
adminZonesRouter.post(
  '/delivery-zones/:id/slabs',
  validateRequest(adminZoneIdParamsSchema, 'params'),
  validateRequest(createFeeSlabSchema),
  controller.createFeeSlab,
);
adminZonesRouter.patch(
  '/delivery-zones/:zoneId/slabs/:slabId',
  validateRequest(adminSlabParamsSchema, 'params'),
  validateRequest(patchFeeSlabSchema),
  controller.patchFeeSlab,
);
adminZonesRouter.delete(
  '/delivery-zones/:zoneId/slabs/:slabId',
  validateRequest(adminSlabParamsSchema, 'params'),
  controller.deleteFeeSlab,
);
