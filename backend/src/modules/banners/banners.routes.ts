import { Router } from 'express';
import { validateRequest } from '../../common/middleware/validate.js';
import { BannersController } from './banners.controller.js';
import { listPublicBannersQuerySchema } from './banners.schema.js';

const controller = new BannersController();
export const bannersRouter = Router();

bannersRouter.get('/', validateRequest(listPublicBannersQuerySchema, 'query'), controller.list);
