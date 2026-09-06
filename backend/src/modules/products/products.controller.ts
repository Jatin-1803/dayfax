import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { ProductsService } from './products.service.js';
import type { ListProductsQuery } from './products.schema.js';

export class ProductsController {
  constructor(private readonly service = new ProductsService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.query as unknown as ListProductsQuery);
      sendSuccess(res, data, 'Products fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId =
        typeof req.query.storeId === 'string' ? req.query.storeId : undefined;
      const data = await this.service.getByIdOrSlug(req.params.idOrSlug as string, storeId);
      sendSuccess(res, data, 'Product fetched');
    } catch (error) {
      next(error);
    }
  };
}
