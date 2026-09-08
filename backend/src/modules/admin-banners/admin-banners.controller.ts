import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { BannersService } from '../banners/banners.service.js';
import type { CreateBannerInput, PatchBannerInput } from '../banners/banners.schema.js';

export class AdminBannersController {
  constructor(private readonly service = new BannersService()) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listAdmin();
      sendSuccess(res, data, 'Banners fetched');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.create(req.body as CreateBannerInput);
      sendSuccess(res, data, 'Banner created', 201);
    } catch (error) {
      next(error);
    }
  };

  patch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patch(req.params.id as string, req.body as PatchBannerInput);
      sendSuccess(res, data, 'Banner updated');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.remove(req.params.id as string);
      sendSuccess(res, null, 'Banner deleted');
    } catch (error) {
      next(error);
    }
  };
}
