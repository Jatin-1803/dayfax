import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import type { ListPublicHomeCollectionQuery } from './home-collections.schema.js';
import { HomeCollectionsService } from './home-collections.service.js';

export class HomeCollectionsController {
  constructor(private readonly service = new HomeCollectionsService()) {}

  getActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListPublicHomeCollectionQuery;
      const data = await this.service.getActive(query.lang);
      sendSuccess(res, data, 'Home collection fetched');
    } catch (error) {
      next(error);
    }
  };
}
