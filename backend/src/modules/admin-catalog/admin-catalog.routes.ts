import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import {
  adminIdParamsSchema,
  createCategorySchema,
  patchCategorySchema,
  patchProductSchema,
} from './admin-catalog.schema.js';

const controller = new AdminCatalogController();
export const adminCatalogRouter = Router();

adminCatalogRouter.use(authenticate, requireAdminPrincipal());

adminCatalogRouter.post(
  '/categories',
  validateRequest(createCategorySchema),
  controller.createCategory,
);

adminCatalogRouter.patch(
  '/categories/:id',
  validateRequest(adminIdParamsSchema, 'params'),
  validateRequest(patchCategorySchema),
  controller.patchCategory,
);

adminCatalogRouter.get(
  '/products/:id',
  validateRequest(adminIdParamsSchema, 'params'),
  controller.getProduct,
);

adminCatalogRouter.patch(
  '/products/:id',
  validateRequest(adminIdParamsSchema, 'params'),
  validateRequest(patchProductSchema),
  controller.patchProduct,
);
