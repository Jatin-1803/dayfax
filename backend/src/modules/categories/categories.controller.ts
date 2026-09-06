import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { CategoriesService } from './categories.service.js';
import type { ListCategoriesQuery } from './categories.schema.js';

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
      const data = await this.service.getByIdOrSlug(req.params.idOrSlug as string);
      sendSuccess(res, data, 'Category fetched');
    } catch (error) {
      next(error);
    }
  };
}
