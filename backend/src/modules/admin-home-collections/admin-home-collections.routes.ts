import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminHomeCollectionsController } from './admin-home-collections.controller.js';
import {
  createHomeCollectionSchema,
  homeCollectionIdParamsSchema,
  patchHomeCollectionSchema,
} from '../home-collections/home-collections.schema.js';

const controller = new AdminHomeCollectionsController();
export const adminHomeCollectionsRouter = Router();

adminHomeCollectionsRouter.use(authenticate, requireAdminPrincipal());

adminHomeCollectionsRouter.get('/', controller.list);
adminHomeCollectionsRouter.post('/', validateRequest(createHomeCollectionSchema), controller.create);
adminHomeCollectionsRouter.patch(
  '/:id',
  validateRequest(homeCollectionIdParamsSchema, 'params'),
  validateRequest(patchHomeCollectionSchema),
  controller.patch,
);
adminHomeCollectionsRouter.delete(
  '/:id',
  validateRequest(homeCollectionIdParamsSchema, 'params'),
  controller.remove,
);
