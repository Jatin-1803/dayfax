import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import type {
  CreateHomeCollectionInput,
  PatchHomeCollectionInput,
} from '../home-collections/home-collections.schema.js';
import { HomeCollectionsService } from '../home-collections/home-collections.service.js';

export class AdminHomeCollectionsController {
  constructor(private readonly service = new HomeCollectionsService()) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listAdmin();
      sendSuccess(res, data, 'Home collections fetched');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.create(req.body as CreateHomeCollectionInput);
      sendSuccess(res, data, 'Home collection created', 201);
    } catch (error) {
      next(error);
    }
  };

  patch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patch(
        req.params.id as string,
        req.body as PatchHomeCollectionInput,
      );
      sendSuccess(res, data, 'Home collection updated');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.remove(req.params.id as string);
      sendSuccess(res, null, 'Home collection deleted');
    } catch (error) {
      next(error);
    }
  };
}
