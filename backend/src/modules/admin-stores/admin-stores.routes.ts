import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminStoresController } from './admin-stores.controller.js';
import {
  adminStoreIdParamsSchema,
  adminStoreProductParamsSchema,
  createAdminProductSchema,
  createStoreSchema,
  patchStoreProductSchema,
  patchStoreSchema,
} from './admin-stores.schema.js';

const controller = new AdminStoresController();
export const adminStoresRouter = Router();

adminStoresRouter.use(authenticate, requireAdminPrincipal());

adminStoresRouter.get('/', controller.list);
adminStoresRouter.post('/', validateRequest(createStoreSchema), controller.create);
adminStoresRouter.post(
  '/products',
  validateRequest(createAdminProductSchema),
  controller.createProduct,
);
adminStoresRouter.get(
  '/:id/products',
  validateRequest(adminStoreIdParamsSchema, 'params'),
  controller.listProducts,
);
adminStoresRouter.patch(
  '/:id/products/:productId',
  validateRequest(adminStoreProductParamsSchema, 'params'),
  validateRequest(patchStoreProductSchema),
  controller.patchStoreProduct,
);
adminStoresRouter.get(
  '/:id',
  validateRequest(adminStoreIdParamsSchema, 'params'),
  controller.getOne,
);
adminStoresRouter.patch(
  '/:id',
  validateRequest(adminStoreIdParamsSchema, 'params'),
  validateRequest(patchStoreSchema),
  controller.patch,
);
