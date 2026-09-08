import { Router } from 'express';
import { validateRequest } from '../../common/middleware/validate.js';
import { ProductsController } from './products.controller.js';
import {
  getProductQuerySchema,
  listProductsSchema,
  similarProductsSchema,
} from './products.schema.js';

const controller = new ProductsController();
export const productsRouter = Router();

productsRouter.get('/', validateRequest(listProductsSchema, 'query'), controller.list);
productsRouter.get(
  '/:idOrSlug/similar',
  validateRequest(similarProductsSchema, 'query'),
  controller.listSimilar,
);
productsRouter.get(
  '/:idOrSlug',
  validateRequest(getProductQuerySchema, 'query'),
  controller.getOne,
);
