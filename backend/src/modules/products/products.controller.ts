import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { ProductsService } from './products.service.js';
import type {
  GetProductQuery,
  ListProductsQuery,
  SimilarProductsQuery,
} from './products.schema.js';

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

  listSimilar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listSimilar(
        req.params.idOrSlug as string,
        req.query as unknown as SimilarProductsQuery,
      );
      sendSuccess(res, data, 'Similar products fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getByIdOrSlug(
        req.params.idOrSlug as string,
        req.query as unknown as GetProductQuery,
      );
      sendSuccess(res, data, 'Product fetched');
    } catch (error) {
      next(error);
    }
  };
}
