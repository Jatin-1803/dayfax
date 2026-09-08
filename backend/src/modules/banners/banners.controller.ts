import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { BannersService } from './banners.service.js';
import type { ListPublicBannersQuery } from './banners.schema.js';

export class BannersController {
  constructor(private readonly service = new BannersService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListPublicBannersQuery;
      const data = await this.service.listActive(query.lang);
      sendSuccess(res, data, 'Banners fetched');
    } catch (error) {
      next(error);
    }
  };
}
