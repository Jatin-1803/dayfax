import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { CategoriesService } from './categories.service.js';
import type { GetCategoryQuery, ListCategoriesQuery } from './categories.schema.js';

export class CategoriesController {
  constructor(private readonly service = new CategoriesService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.query as unknown as ListCategoriesQuery);
      sendSuccess(res, data, 'Categories fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getByIdOrSlug(
        req.params.idOrSlug as string,
        req.query as unknown as GetCategoryQuery,
      );
      sendSuccess(res, data, 'Category fetched');
    } catch (error) {
      next(error);
    }
  };
}
