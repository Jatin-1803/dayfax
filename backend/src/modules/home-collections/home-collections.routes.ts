import { Router } from 'express';
import { validateRequest } from '../../common/middleware/validate.js';
import { HomeCollectionsController } from './home-collections.controller.js';
import { listPublicHomeCollectionQuerySchema } from './home-collections.schema.js';

const controller = new HomeCollectionsController();
export const homeCollectionsRouter = Router();

homeCollectionsRouter.get(
  '/active',
  validateRequest(listPublicHomeCollectionQuerySchema, 'query'),
  controller.getActive,
);
