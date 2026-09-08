import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import {
  bannerIdParamsSchema,
  createBannerSchema,
  patchBannerSchema,
} from '../banners/banners.schema.js';
import { AdminBannersController } from './admin-banners.controller.js';

const controller = new AdminBannersController();
export const adminBannersRouter = Router();

adminBannersRouter.use(authenticate, requireAdminPrincipal());

adminBannersRouter.get('/', controller.list);
adminBannersRouter.post('/', validateRequest(createBannerSchema), controller.create);
adminBannersRouter.patch(
  '/:id',
  validateRequest(bannerIdParamsSchema, 'params'),
  validateRequest(patchBannerSchema),
  controller.patch,
);
adminBannersRouter.delete(
  '/:id',
  validateRequest(bannerIdParamsSchema, 'params'),
  controller.remove,
);
