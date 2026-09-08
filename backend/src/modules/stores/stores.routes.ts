import { Router } from 'express';
import { validateRequest } from '../../common/middleware/validate.js';
import { StoresController } from './stores.controller.js';
import { listStoresQuerySchema } from './stores.schema.js';

const controller = new StoresController();
export const storesRouter = Router();

storesRouter.get('/', validateRequest(listStoresQuerySchema, 'query'), controller.list);
storesRouter.get('/:idOrSlug', controller.getOne);
