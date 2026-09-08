import { Router } from 'express';
import { validateRequest } from '../../common/middleware/validate.js';
import { CategoriesController } from './categories.controller.js';
import { getCategoryQuerySchema, listCategoriesSchema } from './categories.schema.js';

const controller = new CategoriesController();
export const categoriesRouter = Router();

categoriesRouter.get('/', validateRequest(listCategoriesSchema, 'query'), controller.list);
categoriesRouter.get(
  '/:idOrSlug',
  validateRequest(getCategoryQuerySchema, 'query'),
  controller.getOne,
);
