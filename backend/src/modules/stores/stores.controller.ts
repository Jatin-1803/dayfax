import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { StoresService } from './stores.service.js';
import type { ListStoresQuery } from './stores.schema.js';

export class StoresController {
  constructor(private readonly service = new StoresService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.query as unknown as ListStoresQuery);
      sendSuccess(res, data, 'Stores fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getByIdOrSlug(req.params.idOrSlug as string);
      sendSuccess(res, data, 'Store fetched');
    } catch (error) {
      next(error);
    }
  };
}
